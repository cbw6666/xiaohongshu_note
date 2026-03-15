/**
 * 小红书笔记解析服务
 * 从链接解析 noteId → 通过 Vite Proxy 请求页面 → 提取 __INITIAL_STATE__ → 解析笔记数据（含图片）
 */

// ============ 防风控工具函数 ============

/** 可中断的延迟 */
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

/** 随机延迟（min~max 毫秒） */
export function randomDelay(minMs, maxMs, signal) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return delay(ms, signal)
}

// 采集速度预设（毫秒）
export const SPEED_PRESETS = {
  conservative: { label: '保守（推荐）', noteMin: 8000, noteMax: 12000, imgMin: 300, imgMax: 1000, batchRest: [180000, 300000], batchSize: 40 },
  moderate:     { label: '适中',         noteMin: 5000, noteMax: 8000,  imgMin: 200, imgMax: 800,  batchRest: [120000, 180000], batchSize: 40 },
  fast:         { label: '快速（有风险）', noteMin: 3000, noteMax: 5000,  imgMin: 100, imgMax: 500,  batchRest: [60000, 120000],  batchSize: 50 },
}

/**
 * 风控退避管理器
 * 遇到风控拦截时指数退避：2min → 4min → 10min，连续3次暂停当前批次
 */
export class RateLimitManager {
  constructor() {
    this.consecutiveBlocks = 0
    this.maxConsecutive = 3
    this.backoffSteps = [2 * 60 * 1000, 4 * 60 * 1000, 10 * 60 * 1000] // 2min, 4min, 10min
    this.onWaiting = null // callback(remainMs) — 通知 UI 倒计时
    this.onResumed = null // callback() — 退避结束
  }

  reset() {
    this.consecutiveBlocks = 0
  }

  /** 成功请求后调用 */
  recordSuccess() {
    this.consecutiveBlocks = 0
  }

  /** 被拦截后调用，返回 { shouldStop, waitMs } */
  recordBlock() {
    this.consecutiveBlocks++
    if (this.consecutiveBlocks >= this.maxConsecutive) {
      return { shouldStop: true, waitMs: 0 }
    }
    const idx = Math.min(this.consecutiveBlocks - 1, this.backoffSteps.length - 1)
    return { shouldStop: false, waitMs: this.backoffSteps[idx] }
  }

  /** 执行退避等待（带倒计时回调） */
  async wait(waitMs, signal) {
    const endTime = Date.now() + waitMs
    // 每秒回调一次更新倒计时
    while (Date.now() < endTime) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const remain = endTime - Date.now()
      this.onWaiting?.(remain)
      await delay(Math.min(1000, remain), signal)
    }
    this.onResumed?.()
  }
}

/**
 * 从小红书链接中提取 noteId
 * 支持多种链接格式:
 *   https://www.xiaohongshu.com/explore/69aec53d0000000016009923
 *   https://www.xiaohongshu.com/discovery/item/69aec53d0000000016009923
 *   https://xhslink.com/xxxxx (短链)
 */
export function extractNoteId(url) {
  if (!url || typeof url !== 'string') return null
  url = url.trim()

  // 标准 explore 链接
  const exploreMatch = url.match(/xiaohongshu\.com\/explore\/([a-f0-9]{24})/)
  if (exploreMatch) return exploreMatch[1]

  // discovery/item 链接
  const itemMatch = url.match(/xiaohongshu\.com\/discovery\/item\/([a-f0-9]{24})/)
  if (itemMatch) return itemMatch[1]

  // 笔记详情链接
  const noteMatch = url.match(/xiaohongshu\.com\/.*?\/([a-f0-9]{24})/)
  if (noteMatch) return noteMatch[1]

  // 纯 noteId
  if (/^[a-f0-9]{24}$/.test(url)) return url

  return null
}

/**
 * 从小红书链接中提取查询参数（xsec_token 等）
 */
function extractQueryParams(url) {
  try {
    const u = new URL(url)
    return {
      xsec_token: u.searchParams.get('xsec_token') || '',
      xsec_source: u.searchParams.get('xsec_source') || '',
    }
  } catch {
    return { xsec_token: '', xsec_source: '' }
  }
}

/**
 * 将图片 URL 转换为代理 URL
 * 支持多种小红书 CDN 域名
 */
function toProxyImageUrl(originalUrl) {
  if (!originalUrl) return null
  try {
    const u = new URL(originalUrl)
    const host = u.hostname
    // sns-img-bd.xhscdn.com
    if (host.includes('sns-img-bd')) {
      return '/xhs-img' + u.pathname
    }
    // sns-img-qc.xhscdn.com
    if (host.includes('sns-img-qc')) {
      return '/xhs-img-qc' + u.pathname
    }
    // sns-img-hw.xhscdn.com
    if (host.includes('sns-img-hw')) {
      return '/xhs-img-hw' + u.pathname
    }
    // sns-webpic-qc.xhscdn.com 等 webpic 域名
    if (host.includes('sns-webpic')) {
      return '/xhs-webpic' + u.pathname
    }
    // ci.xiaohongshu.com
    if (host.includes('ci.xiaohongshu.com')) {
      return '/xhs-ci' + u.pathname
    }
    // 通用 xhscdn.com
    if (host.includes('xhscdn.com')) {
      return '/xhs-img' + u.pathname
    }
    // 通用 xiaohongshu.com 图片
    if (host.includes('xiaohongshu.com')) {
      return '/xhs-ci' + u.pathname
    }
    return originalUrl
  } catch {
    return originalUrl
  }
}

/**
 * 解析 __INITIAL_STATE__ 中的笔记数据
 */
function parseInitialState(html, noteId) {
  // 尝试多种正则匹配 __INITIAL_STATE__
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/s,
    /window\.__INITIAL_STATE__\s*=\s*({.+?});\s*<\/script>/s,
    /__INITIAL_STATE__\s*=\s*({[\s\S]+?})\s*;?\s*<\/script>/,
  ]

  let stateStr = null
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      stateStr = match[1]
      break
    }
  }

  if (!stateStr) {
    // 尝试从 meta 标签提取基础信息作为降级
    return parseFromMeta(html)
  }

  try {
    // 处理特殊编码
    stateStr = stateStr
      .replace(/\\u002F/g, '/')
      .replace(/undefined/g, 'null')

    const state = JSON.parse(stateStr)

    // 提取笔记详情
    const noteMap = state?.note?.noteDetailMap || state?.note?.noteDetail || {}
    let noteData = null

    // 直接用 noteId 精确查找
    if (noteMap[noteId]) {
      noteData = noteMap[noteId]?.note || noteMap[noteId]
    } else {
      // 模糊匹配：noteDetailMap 的 key 可能有前缀（如 "note_" + noteId）
      const matchKey = Object.keys(noteMap).find(k => k.includes(noteId))
      if (matchKey) {
        noteData = noteMap[matchKey]?.note || noteMap[matchKey]
      } else {
        // 仅当 noteMap 中只有 1 条笔记时才取（避免取到不相关的推荐笔记）
        const keys = Object.keys(noteMap)
        if (keys.length === 1) {
          noteData = noteMap[keys[0]]?.note || noteMap[keys[0]]
        }
      }
    }

    if (!noteData) {
      return parseFromMeta(html)
    }

    // 提取标签（从 tagList + desc 中的 #话题 合并）
    const tags = []
    if (noteData.tagList && Array.isArray(noteData.tagList)) {
      noteData.tagList.forEach(t => {
        if (t.name) tags.push(t.name)
      })
    }
    // 从 desc 中提取 #话题标签 并合并到 tags（去重）
    const descText = noteData.desc || ''
    const descTagMatches = descText.match(/#[^\s#]+/g) || []
    descTagMatches.forEach(t => {
      const tagName = t.replace(/^#/, '')
      if (tagName && !tags.includes(tagName)) {
        tags.push(tagName)
      }
    })

    // 提取图片
    const images = []
    if (noteData.imageList && Array.isArray(noteData.imageList)) {
      noteData.imageList.forEach((img, idx) => {
        // 优先使用带 http 的完整 URL，尝试多个字段
        const candidates = [
          img.urlDefault,
          img.url,
          img.urlPre,
          // infoList 中可能有不同尺寸的图片
          ...(img.infoList || []).map(info => info.url),
        ].filter(Boolean)

        // 找出带 http 的完整 URL
        let url = candidates.find(u => u.startsWith('http')) || candidates[0] || ''

        if (url) {
          // 如果不是完整 URL，尝试拼接域名
          if (!url.startsWith('http')) {
            // 优先用 ci.xiaohongshu.com（新版 CDN），回退到 sns-img-bd
            url = 'https://ci.xiaohongshu.com/' + url
          }

          console.log(`[图片${idx + 1}] 原始URL: ${url}`)

          images.push({
            url,
            width: img.width || 0,
            height: img.height || 0,
            proxyUrl: toProxyImageUrl(url),
            // 备用代理 URL，如果主 CDN 404 可以尝试
            fallbackUrls: [
              toProxyImageUrl(url.replace('ci.xiaohongshu.com', 'sns-img-bd.xhscdn.com')),
              toProxyImageUrl(url.replace('ci.xiaohongshu.com', 'sns-webpic-qc.xhscdn.com')),
            ].filter(u => u !== toProxyImageUrl(url)),
          })
        }
      })
    }

    // 正文去标签后为空时，用标题兜底
    let cleanContent = descText.replace(/#[^\s#]+/g, '').trim()
    let contentFromTitle = false
    if (!cleanContent) {
      cleanContent = noteData.title || ''
      contentFromTitle = true
    }

    return {
      success: true,
      title: noteData.title || '',
      content: cleanContent,
      contentFromTitle,
      tags,
      images,
      author: noteData.user?.nickname || '',
      likes: noteData.interactInfo?.likedCount || '0',
      noteId,
    }
  } catch (e) {
    console.error('解析 __INITIAL_STATE__ 失败:', e)
    return parseFromMeta(html)
  }
}

/**
 * 从 meta 标签提取基础信息（降级方案）
 */
function parseFromMeta(html) {
  const titleMatch = html.match(/<meta[^>]*name=["']og:title["'][^>]*content=["']([^"']+)["']/)
    || html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/)
    || html.match(/<title>([^<]+)<\/title>/)

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/)
    || html.match(/<meta[^>]*name=["']og:description["'][^>]*content=["']([^"']+)["']/)

  if (!titleMatch && !descMatch) {
    return { success: false, error: '无法解析笔记内容' }
  }

  // 从正文中提取标签
  const desc = descMatch?.[1] || ''
  const tagMatches = desc.match(/#[^\s#]+/g) || []
  let cleanDesc = desc.replace(/#[^\s#]+/g, '').trim()
  const title = titleMatch?.[1]?.replace(' - 小红书', '')?.trim() || ''

  let contentFromTitle = false
  if (!cleanDesc) {
    cleanDesc = title
    contentFromTitle = true
  }

  return {
    success: true,
    title,
    content: cleanDesc,
    contentFromTitle,
    tags: tagMatches.map(t => t.replace('#', '')),
    images: [],
    author: '',
    likes: '0',
    noteId: '',
    partial: true, // 标记为不完整解析
  }
}

/**
 * 通过代理请求解析单条笔记
 */
export async function parseNote(url, { signal } = {}) {
  const noteId = extractNoteId(url)
  if (!noteId) {
    return { success: false, error: '无效的小红书链接', url }
  }

  const { xsec_token, xsec_source } = extractQueryParams(url)

  // 构建代理 URL（带上原始查询参数）
  let proxyPath = `/xhs-proxy/explore/${noteId}`
  const params = new URLSearchParams()
  if (xsec_token) params.set('xsec_token', xsec_token)
  if (xsec_source) params.set('xsec_source', xsec_source)
  const qs = params.toString()
  if (qs) proxyPath += '?' + qs

  const maxRetries = 2
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // 重试前等待一下
        await new Promise(r => setTimeout(r, 1000 + attempt * 1000))
      }

      const resp = await fetch(proxyPath, {
        signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      // 检测风控拦截（代理返回 403 + JSON）
      if (resp.status === 403) {
        try {
          const data = await resp.json()
          if (data.blocked) {
            if (attempt < maxRetries) continue // 重试
            return { success: false, error: data.message || '该笔记被小红书风控拦截', url, noteId, blocked: true }
          }
        } catch {}
        if (attempt < maxRetries) continue
        return { success: false, error: '请求被拒绝 (403)', url, noteId, blocked: true }
      }

      // 461/471 是小红书风控状态码
      if (resp.status === 461 || resp.status === 471) {
        if (attempt < maxRetries) continue
        return { success: false, error: `风控拦截 (${resp.status})`, url, noteId, blocked: true }
      }

      if (!resp.ok) {
        if (attempt < maxRetries) continue
        return { success: false, error: `请求失败 (${resp.status})`, url, noteId }
      }

      const html = await resp.text()

      // 检查是否被拦截（验证码页面）
      if (html.includes('验证码') || html.includes('captcha') || html.length < 1000) {
        if (attempt < maxRetries) continue
        return { success: false, error: '被反爬拦截，请稍后重试或手动填写', url, noteId, blocked: true }
      }

      const result = parseInitialState(html, noteId)
      return { ...result, url, noteId: noteId }
    } catch (e) {
      if (e.name === 'AbortError') {
        return { success: false, error: '已取消', url, noteId }
      }
      if (attempt < maxRetries) continue
      return { success: false, error: e.message || '网络错误', url, noteId }
    }
  }

  return { success: false, error: '重试次数用尽，请稍后再试', url, noteId }
}

/**
 * 下载图片并转为 base64，支持回退到备用 URL
 */
export async function downloadImage(proxyUrl, { signal, fallbackUrls = [] } = {}) {
  const urls = [proxyUrl, ...fallbackUrls].filter(Boolean)

  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal })
      if (!resp.ok) {
        if (resp.status === 404 && urls.indexOf(url) < urls.length - 1) {
          console.warn(`图片 404，尝试备用 CDN: ${url}`)
          continue
        }
        throw new Error(`HTTP ${resp.status}`)
      }

      const blob = await resp.blob()
      // 验证确实是图片
      if (!blob.type.startsWith('image/') && blob.size < 1000) {
        console.warn(`返回非图片内容: ${url}, type=${blob.type}, size=${blob.size}`)
        continue
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      if (e.name === 'AbortError') return null
      console.warn('图片下载失败:', url, e.message)
      if (urls.indexOf(url) < urls.length - 1) continue
    }
  }

  return null
}

/**
 * 批量解析笔记（带并发控制）
 */
export async function batchParseNotes(urls, { concurrency = 2, onProgress, signal } = {}) {
  const results = []
  let completed = 0

  // 简单的并发池
  const pool = []
  for (let i = 0; i < urls.length; i++) {
    const task = (async () => {
      const result = await parseNote(urls[i], { signal })

      // 如果解析成功且有图片，尝试下载图片
      if (result.success && result.images?.length > 0) {
        const downloadedImages = []
        for (const img of result.images) {
          if (signal?.aborted) break
          const base64 = await downloadImage(img.proxyUrl || img.url, { signal, fallbackUrls: img.fallbackUrls })
          if (base64) {
            downloadedImages.push(base64)
          }
        }
        result.downloadedImages = downloadedImages
      }

      completed++
      results[i] = result
      onProgress?.({ completed, total: urls.length, current: result })
    })()

    pool.push(task)

    // 并发控制
    if (pool.length >= concurrency) {
      await Promise.race(pool)
      // 移除已完成的
      for (let j = pool.length - 1; j >= 0; j--) {
        const status = await Promise.race([pool[j].then(() => 'done'), Promise.resolve('pending')])
        if (status === 'done') pool.splice(j, 1)
      }
    }
  }

  await Promise.all(pool)
  return results
}
