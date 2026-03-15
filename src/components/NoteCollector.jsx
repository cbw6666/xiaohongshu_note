import { useState, useRef, useCallback } from 'react'
import { parseExcel, generateTemplate } from '../utils/excelImporter.js'
import { extractNoteId, parseNote, downloadImage, randomDelay, delay, SPEED_PRESETS, RateLimitManager } from '../services/noteParserService.js'
import { rewriteContent, rewriteTitle } from '../services/rewriteService.js'
import { deduplicateImage } from '../utils/imageDeduplicator.js'
import { humanizeNote } from '../services/humanizerService.js'
import { createStreamWriter } from '../utils/streamExportUtils.js'

// 状态枚举
const STATUS = {
  IDLE: 'idle',
  PARSING_EXCEL: 'parsing_excel',
  FETCHING: 'fetching',
  REWRITING: 'rewriting',
  PAUSED: 'paused',          // 风控退避暂停中
  BATCH_RESTING: 'batch_resting', // 批间休息中
  ONE_CLICK: 'one_click',    // 一键采集+处理+导出中
}

/** 格式化毫秒为 mm:ss */
function formatCountdown(ms) {
  if (ms <= 0) return '00:00'
  const sec = Math.ceil(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function NoteCollector({ settings, shops = [], activeShopId, onGenerated }) {
  // Excel 数据
  const [excelData, setExcelData] = useState(null) // { headers, columnMapping, rows }
  const [notes, setNotes] = useState([]) // 解析后的笔记列表

  // 从商品中提取 itemId（与 BatchGenerator 逻辑一致）
  const extractItemId = (product) => {
    if (!product) return ''
    return product.productId || ((product.name || '').match(/商品\s*ID\s*[:：]\s*([a-zA-Z0-9]+)/i) || [])[1] || ''
  }

  // 店铺/商品/账号选择 — 初始化时就根据默认店铺填入
  const initShopId = activeShopId || shops[0]?.id || ''
  const initShop = shops.find(s => s.id === initShopId) || null
  const initProduct = initShop?.products?.[0] || null
  const initAccount = initShop?.accounts?.[0] || null

  const [selectedShopId, setSelectedShopId] = useState(initShopId)
  const [selectedProductId, setSelectedProductId] = useState(initProduct?.id || '')
  const [selectedAccountId, setSelectedAccountId] = useState(initAccount?.id || '')

  const selectedShop = shops.find(s => s.id === selectedShopId) || null

  // 统一设置
  const [globalSettings, setGlobalSettings] = useState({
    shopName: initShop?.name || '',
    accountName: initAccount?.name || '',
    productName: initProduct?.name || '',
    productItemId: extractItemId(initProduct),
    rewritePrompt: '',
    enableRewrite: true,
    enableHumanize: true,
    enableImageDedup: true,
    maxTags: 10,
  })

  // 切换店铺时联动
  const handleSelectShop = (shopId) => {
    setSelectedShopId(shopId)
    const shop = shops.find(s => s.id === shopId)
    if (shop) {
      const firstProduct = shop.products?.[0]
      const firstAccount = shop.accounts?.[0]
      setSelectedProductId(firstProduct?.id || '')
      setSelectedAccountId(firstAccount?.id || '')
      setGlobalSettings(prev => ({
        ...prev,
        shopName: shop.name,
        accountName: firstAccount?.name || '',
        productName: firstProduct?.name || '',
        productItemId: extractItemId(firstProduct),
      }))
    }
  }

  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId)
    const product = selectedShop?.products?.find(p => p.id === productId)
    if (product) {
      setGlobalSettings(prev => ({
        ...prev,
        productName: product.name,
        productItemId: extractItemId(product),
      }))
    }
  }

  const handleSelectAccount = (accountId) => {
    setSelectedAccountId(accountId)
    const account = selectedShop?.accounts?.find(a => a.id === accountId)
    if (account) {
      setGlobalSettings(prev => ({ ...prev, accountName: account.name }))
    }
  }

  // 状态
  const [status, setStatus] = useState(STATUS.IDLE)
  const [progress, setProgress] = useState({ completed: 0, total: 0, text: '' })
  const [expandedNotes, setExpandedNotes] = useState(new Set())
  const [editingNote, setEditingNote] = useState(null)

  // 防风控相关状态
  const [speedMode, setSpeedMode] = useState('conservative') // conservative / moderate / fast
  const [countdown, setCountdown] = useState(0) // 倒计时剩余毫秒
  const [countdownLabel, setCountdownLabel] = useState('') // 倒计时说明
  const [batchInfo, setBatchInfo] = useState(null) // { current, total } 当前批次信息
  const [fetchedSet, setFetchedSet] = useState(new Set()) // 已成功采集的 URL 集合（断点续采）

  const fileInputRef = useRef(null)
  const abortRef = useRef(null)
  const rateLimitRef = useRef(new RateLimitManager())

  // ============ Excel 上传 ============
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setStatus(STATUS.PARSING_EXCEL)
      setProgress({ completed: 0, total: 0, text: '正在解析 Excel...' })

      const data = await parseExcel(file)
      setExcelData(data)

      setStatus(STATUS.IDLE)
      setProgress({ completed: 0, total: data.rows.length, text: `成功读取 ${data.rows.length} 条链接` })
    } catch (err) {
      setStatus(STATUS.IDLE)
      setProgress({ completed: 0, total: 0, text: `Excel 解析失败: ${err.message}` })
    }

    // 重置 input，允许重新上传同一文件
    e.target.value = ''
  }, [])

  // ============ 一键解析全部链接（防风控版） ============
  const handleFetchAll = useCallback(async () => {
    // 收集待解析的条目：Excel 数据 或 手动添加的带 URL 的笔记
    let itemsToFetch = []

    if (excelData?.rows?.length) {
      itemsToFetch = excelData.rows.map(r => ({
        url: r.url,
        shopName: r.shopName,
        accountName: r.accountName,
        productName: r.productName,
        productId: r.productId,
        remark: r.remark,
      }))
    } else {
      // 从手动添加的笔记中取有 URL 但未解析的
      itemsToFetch = notes
        .filter(n => n.url && (!n.title || n.title === ''))
        .map(n => ({
          url: n.url,
          shopName: n.shopName,
          accountName: n.accountName,
          productName: n.productName,
          productId: n.productItemId,
          remark: n.remark,
          existingId: n.id,
        }))
    }

    if (itemsToFetch.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller
    setStatus(STATUS.FETCHING)

    // 断点续采：过滤掉已成功采集的
    const pendingItems = itemsToFetch.filter(item => !fetchedSet.has(item.url))

    // 如果来自 Excel 且没有断点续采记录，清空旧结果
    if (excelData?.rows?.length && fetchedSet.size === 0) {
      setNotes([])
    }

    const speed = SPEED_PRESETS[speedMode]
    const totalAll = itemsToFetch.length
    let completedAll = fetchedSet.size // 断点续采时已有的数量

    // 分批
    const batches = []
    for (let i = 0; i < pendingItems.length; i += speed.batchSize) {
      batches.push(pendingItems.slice(i, i + speed.batchSize))
    }

    const rlm = rateLimitRef.current
    rlm.reset()
    rlm.onWaiting = (remainMs) => {
      setCountdown(remainMs)
    }
    rlm.onResumed = () => {
      setCountdown(0)
      setCountdownLabel('')
    }

    const results = [...notes.filter(n => fetchedSet.has(n.url))] // 保留已采集的

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      if (controller.signal.aborted) break

      const batch = batches[batchIdx]
      setBatchInfo({ current: batchIdx + 1, total: batches.length })

      for (let i = 0; i < batch.length; i++) {
        if (controller.signal.aborted) break

        const row = batch[i]
        setProgress({
          completed: completedAll,
          total: totalAll,
          text: `[批次 ${batchIdx + 1}/${batches.length}] 正在解析第 ${completedAll + 1}/${totalAll} 条...`
        })

        // 请求前随机延迟（第一条也延迟，模拟真人浏览间隔）
        if (completedAll > 0 || i > 0) {
          setCountdownLabel('请求间隔等待中')
          try {
            const waitMs = Math.floor(Math.random() * (speed.noteMax - speed.noteMin + 1)) + speed.noteMin
            setCountdown(waitMs)
            await delay(waitMs, controller.signal)
            setCountdown(0)
            setCountdownLabel('')
          } catch (e) {
            if (e.name === 'AbortError') break
          }
        }

        const result = await parseNote(row.url, { signal: controller.signal })

        // 风控退避
        if (result.blocked) {
          const { shouldStop, waitMs } = rlm.recordBlock()
          if (shouldStop) {
            setStatus(STATUS.PAUSED)
            setProgress(prev => ({
              ...prev,
              text: `⚠️ 连续 ${rlm.maxConsecutive} 次被风控拦截，已自动暂停。点击"继续采集"可从断点恢复。`
            }))
            setCountdown(0)
            setCountdownLabel('')
            setBatchInfo(null)
            abortRef.current = null
            return
          }
          // 退避等待
          setStatus(STATUS.PAUSED)
          setCountdownLabel(`风控退避中（第 ${rlm.consecutiveBlocks} 次）`)
          setProgress(prev => ({
            ...prev,
            text: `⚠️ 检测到风控拦截，自动暂停 ${formatCountdown(waitMs)}...`
          }))
          try {
            await rlm.wait(waitMs, controller.signal)
          } catch (e) {
            if (e.name === 'AbortError') break
          }
          setStatus(STATUS.FETCHING)
          // 被拦截的这条不算成功，下次循环会重试下一条（当前条标记失败）
        } else if (result.success) {
          rlm.recordSuccess()
        }

        const note = {
          id: row.existingId || `collect_${Date.now()}_${completedAll}`,
          url: row.url,
          noteId: result.noteId || '',
          title: result.title || '',
          content: result.content || '',
          originalContent: result.content || '',
          tags: result.tags || [],
          images: result.images || [],
          downloadedImages: [],
          author: result.author || '',
          shopName: row.shopName || globalSettings.shopName,
          accountName: row.accountName || globalSettings.accountName,
          productName: row.productName || globalSettings.productName,
          productItemId: row.productId || globalSettings.productItemId,
          remark: row.remark || '',
          parseSuccess: result.success,
          parseError: result.error || '',
          partial: result.partial || false,
          rewritten: false,
          deduplicated: false,
        }

        // 尝试下载图片（带延迟）
        if (result.success && result.images?.length > 0) {
          setProgress(prev => ({ ...prev, text: `[批次 ${batchIdx + 1}/${batches.length}] 正在下载第 ${completedAll + 1} 条的图片...` }))
          const downloadedImages = []
          for (let imgIdx = 0; imgIdx < result.images.length; imgIdx++) {
            if (controller.signal.aborted) break
            // 图片下载间隔
            if (imgIdx > 0) {
              try {
                await randomDelay(speed.imgMin, speed.imgMax, controller.signal)
              } catch (e) {
                if (e.name === 'AbortError') break
              }
            }
            const img = result.images[imgIdx]
            const base64 = await downloadImage(img.proxyUrl, { signal: controller.signal, fallbackUrls: img.fallbackUrls })
            if (base64) downloadedImages.push(base64)
          }
          // 自动图片去重
          if (globalSettings.enableImageDedup && downloadedImages.length > 0) {
            setProgress(prev => ({ ...prev, text: `正在对第 ${completedAll + 1} 条的图片去重...` }))
            for (let imgIdx = 0; imgIdx < downloadedImages.length; imgIdx++) {
              downloadedImages[imgIdx] = await deduplicateImage(downloadedImages[imgIdx])
            }
            note.deduplicated = true
          }
          note.downloadedImages = downloadedImages
        }

        results.push(note)
        completedAll++

        // 断点续采：记录已成功的 URL
        if (result.success) {
          setFetchedSet(prev => new Set([...prev, row.url]))
        }

        // 实时更新列表
        if (excelData?.rows?.length) {
          setNotes([...results])
        } else {
          setNotes(prev => {
            const updated = [...prev]
            const existIdx = updated.findIndex(n => n.id === note.id)
            if (existIdx >= 0) {
              updated[existIdx] = note
            } else {
              updated.push(note)
            }
            return updated
          })
        }
      }

      // 批间休息（最后一批不休息）
      if (batchIdx < batches.length - 1 && !controller.signal.aborted) {
        const restMs = Math.floor(Math.random() * (speed.batchRest[1] - speed.batchRest[0] + 1)) + speed.batchRest[0]
        setStatus(STATUS.BATCH_RESTING)
        setCountdownLabel(`批间休息中（${batchIdx + 1}/${batches.length} 批完成）`)
        setCountdown(restMs)
        setProgress(prev => ({
          ...prev,
          text: `✅ 第 ${batchIdx + 1} 批完成，休息 ${formatCountdown(restMs)} 后继续...`
        }))

        try {
          const endTime = Date.now() + restMs
          while (Date.now() < endTime) {
            if (controller.signal.aborted) break
            setCountdown(endTime - Date.now())
            await delay(Math.min(1000, endTime - Date.now()), controller.signal)
          }
        } catch (e) {
          if (e.name === 'AbortError') break
        }
        setCountdown(0)
        setCountdownLabel('')
        setStatus(STATUS.FETCHING)
      }
    }

    setStatus(STATUS.IDLE)
    setBatchInfo(null)
    setCountdown(0)
    setCountdownLabel('')
    const successCount = results.filter(n => n.parseSuccess).length
    setProgress({
      completed: results.length,
      total: totalAll,
      text: `✅ 解析完成！成功 ${successCount}/${totalAll} 条`
    })
    abortRef.current = null
  }, [excelData, globalSettings, notes, speedMode, fetchedSet])

  // ============ 一键改写全部 ============
  const handleRewriteAll = useCallback(async () => {
    if (!settings?.apiKey) {
      alert('请先在设置中配置 AI API Key')
      return
    }

    const toRewrite = notes.filter(n => n.parseSuccess && n.content)
    if (toRewrite.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller
    setStatus(STATUS.REWRITING)

    for (let i = 0; i < toRewrite.length; i++) {
      if (controller.signal.aborted) break

      const note = toRewrite[i]
      setProgress({
        completed: i,
        total: toRewrite.length,
        text: `正在改写第 ${i + 1}/${toRewrite.length} 条...`
      })

      // 先改写正文
      let rewrittenContent = note.content
      let rewrittenTitle = note.title
      if (globalSettings.enableRewrite) {
        const result = await rewriteContent(note.content, settings, globalSettings.rewritePrompt)
        if (result.success) rewrittenContent = result.content

        // 改写标题
        if (note.title) {
          try {
            const rt = await rewriteTitle(note.title, settings, {
              content: rewrittenContent,
              productName: note.productName || globalSettings.productName,
            })
            if (rt.success) rewrittenTitle = rt.title
          } catch { /* 标题改写失败不影响主流程 */ }
        }
      }

      // 再去 AI 味
      if (globalSettings.enableHumanize) {
        try {
          const humanized = await humanizeNote(
            settings,
            { title: rewrittenTitle, content: rewrittenContent, tags: note.tags.map(t => '#' + t).join(' ') }
          )
          if (humanized?.content) rewrittenContent = humanized.content
          if (humanized?.title) rewrittenTitle = humanized.title
        } catch { /* 去 AI 味失败不影响主流程 */ }
      }

      setNotes(prev => prev.map(n =>
        n.id === note.id
          ? { ...n, content: rewrittenContent, title: rewrittenTitle, rewritten: true }
          : n
      ))
    }

    setStatus(STATUS.IDLE)
    setProgress(prev => ({
      ...prev,
      text: `改写完成！共 ${toRewrite.length} 条`
    }))
    abortRef.current = null
  }, [notes, settings, globalSettings])

  // ============ 导入到生成结果 ============
  const handleImportToResults = useCallback(() => {
    const validNotes = notes.filter(n => n.parseSuccess)
    if (validNotes.length === 0) {
      alert('没有可导入的笔记')
      return
    }

    const converted = validNotes.map(n => {
      const allImages = n.downloadedImages || []
      // 第一张图作为封面，其余作为内页图
      const coverImage = allImages[0] || null
      const innerImages = allImages.slice(1)

      return {
        id: n.id,
        shopName: n.shopName || globalSettings.shopName || '未设置',
        accountName: n.accountName || globalSettings.accountName || '未设置',
        productName: n.productName || globalSettings.productName || '未设置',
        productItemId: n.productItemId || globalSettings.productItemId || '',
        title: n.title,
        content: n.content,
        tags: n.tags.slice(0, globalSettings.maxTags).map(t => '#' + t).join(' '),
        coverTemplateId: null,
        coverTitle: '',
        coverSubtitle: '',
        coverImage, // 采集的封面原图 base64
        innerImages,
        source: 'collected',
      }
    })

    onGenerated(converted)
  }, [notes, globalSettings, onGenerated])

  // ============ 一键采集 + 处理 + 导出 Excel（流式写入） ============
  const [oneClickProgress, setOneClickProgress] = useState(null) // { phase, completed, total, text }
  const streamWriterRef = useRef(null)

  const handleOneClick = useCallback(async () => {
    // 收集待处理的条目
    let itemsToProcess = []

    if (excelData?.rows?.length) {
      itemsToProcess = excelData.rows.map(r => ({
        url: r.url,
        shopName: r.shopName,
        accountName: r.accountName,
        productName: r.productName,
        productId: r.productId,
        remark: r.remark,
      }))
    } else {
      itemsToProcess = notes
        .filter(n => n.url && (!n.title || n.title === ''))
        .map(n => ({
          url: n.url,
          shopName: n.shopName,
          accountName: n.accountName,
          productName: n.productName,
          productId: n.productItemId,
          remark: n.remark,
        }))
    }

    if (itemsToProcess.length === 0) {
      alert('没有待处理的链接，请先上传 Excel 文件')
      return
    }

    // 第一步：弹出"另存为"对话框，让用户选择保存位置
    let writer
    try {
      writer = await createStreamWriter()
      streamWriterRef.current = writer
    } catch (err) {
      if (err.name === 'AbortError') return // 用户取消了
      alert('创建文件失败: ' + err.message)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setStatus(STATUS.ONE_CLICK)

    const speed = SPEED_PRESETS[speedMode]
    const total = itemsToProcess.length
    let successCount = 0
    let failCount = 0

    setOneClickProgress({
      phase: '采集',
      completed: 0,
      total,
      text: '准备开始...',
      successCount: 0,
      failCount: 0,
    })

    // 分批处理
    const batches = []
    for (let i = 0; i < itemsToProcess.length; i += speed.batchSize) {
      batches.push(itemsToProcess.slice(i, i + speed.batchSize))
    }

    const rlm = rateLimitRef.current
    rlm.reset()
    let processedCount = 0

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      if (controller.signal.aborted) break

      const batch = batches[batchIdx]
      setBatchInfo({ current: batchIdx + 1, total: batches.length })

      for (let i = 0; i < batch.length; i++) {
        if (controller.signal.aborted) break

        const row = batch[i]
        processedCount++

        setOneClickProgress(prev => ({
          ...prev,
          phase: '采集',
          completed: processedCount,
          text: `[${batchIdx + 1}/${batches.length}批] 采集第 ${processedCount}/${total} 条...`,
        }))

        // 请求间隔
        if (processedCount > 1) {
          setCountdownLabel('请求间隔')
          try {
            const waitMs = Math.floor(Math.random() * (speed.noteMax - speed.noteMin + 1)) + speed.noteMin
            setCountdown(waitMs)
            await delay(waitMs, controller.signal)
            setCountdown(0)
            setCountdownLabel('')
          } catch (e) {
            if (e.name === 'AbortError') break
          }
        }

        // 采集
        const result = await parseNote(row.url, { signal: controller.signal })

        // 风控退避
        if (result.blocked) {
          const { shouldStop, waitMs } = rlm.recordBlock()
          if (shouldStop) {
            // 写入失败行
            try {
              await writer.appendRow({
                shopName: row.shopName || globalSettings.shopName,
                accountName: row.accountName || globalSettings.accountName,
                productName: row.productName || globalSettings.productName,
                productItemId: row.productId || globalSettings.productItemId,
                title: '',
                content: `风控拦截: ${result.error || '连续被拦截'}`,
                tags: [],
                status: '失败',
                url: row.url,
              })
            } catch {}
            failCount++

            setStatus(STATUS.PAUSED)
            setOneClickProgress(prev => ({
              ...prev,
              text: `⚠️ 连续 ${rlm.maxConsecutive} 次被风控拦截，已自动暂停。`,
              failCount,
            }))
            setCountdown(0)
            setCountdownLabel('')
            setBatchInfo(null)
            abortRef.current = null

            try {
              await writer.finalize({ total: processedCount, success: successCount, fail: failCount })
            } catch {}
            setStatus(STATUS.IDLE)
            streamWriterRef.current = null
            return
          }

          // 退避等待
          setCountdownLabel(`风控退避中（第 ${rlm.consecutiveBlocks} 次）`)
          setCountdown(waitMs)
          try {
            const endTime = Date.now() + waitMs
            while (Date.now() < endTime) {
              if (controller.signal.aborted) break
              setCountdown(endTime - Date.now())
              await delay(Math.min(1000, endTime - Date.now()), controller.signal)
            }
          } catch (e) {
            if (e.name === 'AbortError') break
          }
          setCountdown(0)
          setCountdownLabel('')

          // 写入失败行
          try {
            await writer.appendRow({
              shopName: row.shopName || globalSettings.shopName,
              accountName: row.accountName || globalSettings.accountName,
              productName: row.productName || globalSettings.productName,
              productItemId: row.productId || globalSettings.productItemId,
              title: '',
              content: `风控拦截: ${result.error || ''}`,
              tags: [],
              status: '失败',
              url: row.url,
            })
          } catch {}
          failCount++
          setOneClickProgress(prev => ({ ...prev, failCount }))
          continue
        }

        if (result.success) {
          rlm.recordSuccess()
        }

        // 采集失败的直接写入 Excel
        if (!result.success) {
          try {
            await writer.appendRow({
              shopName: row.shopName || globalSettings.shopName,
              accountName: row.accountName || globalSettings.accountName,
              productName: row.productName || globalSettings.productName,
              productItemId: row.productId || globalSettings.productItemId,
              title: '',
              content: `采集失败: ${result.error || '未知错误'}`,
              tags: [],
              status: '失败',
              url: row.url,
            })
          } catch {}
          failCount++
          setOneClickProgress(prev => ({ ...prev, failCount }))
          continue
        }

        // 采集成功，进行 AI 改写 + 去 AI 味
        let finalContent = result.content || ''
        let finalTitle = result.title || ''
        let finalTags = result.tags || []

        // AI 改写
        if (globalSettings.enableRewrite && settings?.apiKey && finalContent) {
          setOneClickProgress(prev => ({
            ...prev,
            phase: '改写',
            text: `[${batchIdx + 1}/${batches.length}批] 改写第 ${processedCount}/${total} 条...`,
          }))
          try {
            const rw = await rewriteContent(finalContent, settings, globalSettings.rewritePrompt)
            if (rw.success) finalContent = rw.content
          } catch { /* 改写失败不影响流程 */ }

          // 改写标题
          if (finalTitle) {
            try {
              const rt = await rewriteTitle(finalTitle, settings, {
                content: finalContent,
                productName: row.productName || globalSettings.productName,
              })
              if (rt.success) finalTitle = rt.title
            } catch { /* 标题改写失败不影响流程 */ }
          }
        }

        // 去 AI 味
        if (globalSettings.enableHumanize && settings?.apiKey && finalContent) {
          setOneClickProgress(prev => ({
            ...prev,
            phase: '去AI味',
            text: `[${batchIdx + 1}/${batches.length}批] 去AI味第 ${processedCount}/${total} 条...`,
          }))
          try {
            const humanized = await humanizeNote(
              settings,
              { title: finalTitle, content: finalContent, tags: finalTags.map(t => '#' + t).join(' ') }
            )
            if (humanized?.content) finalContent = humanized.content
            if (humanized?.title) finalTitle = humanized.title
          } catch { /* 去 AI 味失败不影响 */ }
        }

        // 写入 Excel
        setOneClickProgress(prev => ({
          ...prev,
          phase: '写入',
          text: `[${batchIdx + 1}/${batches.length}批] 写入第 ${processedCount}/${total} 条...`,
        }))

        try {
          await writer.appendRow({
            shopName: row.shopName || globalSettings.shopName,
            accountName: row.accountName || globalSettings.accountName,
            productName: row.productName || globalSettings.productName,
            productItemId: row.productId || globalSettings.productItemId,
            title: finalTitle,
            content: finalContent,
            tags: finalTags.slice(0, globalSettings.maxTags),
            status: '完成',
            url: row.url,
          })
          successCount++
        } catch (err) {
          console.error('写入 Excel 失败:', err)
          failCount++
        }

        setOneClickProgress(prev => ({
          ...prev,
          successCount,
          failCount,
        }))

        // 同时更新到页面上的笔记列表
        const note = {
          id: `oneclick_${Date.now()}_${processedCount}`,
          url: row.url,
          noteId: result.noteId || '',
          title: finalTitle,
          content: finalContent,
          originalContent: result.content || '',
          tags: finalTags,
          images: result.images || [],
          downloadedImages: [],
          author: result.author || '',
          shopName: row.shopName || globalSettings.shopName,
          accountName: row.accountName || globalSettings.accountName,
          productName: row.productName || globalSettings.productName,
          productItemId: row.productId || globalSettings.productItemId,
          remark: row.remark || '',
          parseSuccess: true,
          parseError: '',
          partial: result.partial || false,
          rewritten: globalSettings.enableRewrite,
          deduplicated: false,
        }
        setNotes(prev => [...prev, note])
      }

      // 批间休息（最后一批不休息）
      if (batchIdx < batches.length - 1 && !controller.signal.aborted) {
        const restMs = Math.floor(Math.random() * (speed.batchRest[1] - speed.batchRest[0] + 1)) + speed.batchRest[0]
        setCountdownLabel(`批间休息中（${batchIdx + 1}/${batches.length} 批完成）`)
        setCountdown(restMs)
        setOneClickProgress(prev => ({
          ...prev,
          phase: '休息',
          text: `✅ 第 ${batchIdx + 1} 批完成，休息 ${formatCountdown(restMs)} 后继续...`,
        }))

        try {
          const endTime = Date.now() + restMs
          while (Date.now() < endTime) {
            if (controller.signal.aborted) break
            setCountdown(endTime - Date.now())
            await delay(Math.min(1000, endTime - Date.now()), controller.signal)
          }
        } catch (e) {
          if (e.name === 'AbortError') break
        }
        setCountdown(0)
        setCountdownLabel('')
      }
    }

    // 写入汇总并完成
    try {
      await writer.finalize({ total, success: successCount, fail: failCount })
    } catch {}

    setStatus(STATUS.IDLE)
    setBatchInfo(null)
    setCountdown(0)
    setCountdownLabel('')
    setOneClickProgress(prev => ({
      ...prev,
      phase: '完成',
      completed: total,
      text: `✅ 全部完成！成功 ${successCount} 条，失败 ${failCount} 条，已保存到 Excel`,
    }))
    abortRef.current = null
    streamWriterRef.current = null
  }, [excelData, notes, globalSettings, settings, speedMode])

  // ============ 停止操作 ============
  const handleStop = () => {
    abortRef.current?.abort()
    setStatus(STATUS.IDLE)
    setCountdown(0)
    setCountdownLabel('')
    setBatchInfo(null)
  }

  // ============ 断点续采：从上次暂停位置继续 ============
  const handleResume = () => {
    handleFetchAll()
  }

  // ============ 重置断点（重新开始） ============
  const handleResetProgress = () => {
    setFetchedSet(new Set())
    setNotes([])
    setProgress({ completed: 0, total: 0, text: '' })
  }

  // ============ 单条笔记展开/折叠 ============
  const toggleExpand = (noteId) => {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      next.has(noteId) ? next.delete(noteId) : next.add(noteId)
      return next
    })
  }

  // ============ 编辑单条笔记 ============
  const updateNote = (noteId, field, value) => {
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, [field]: value } : n
    ))
  }

  // ============ 删除单条 ============
  const deleteNote = (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  // ============ 手动补充笔记（降级方案） ============
  const handleManualAdd = () => {
    const newId = `manual_${Date.now()}`
    setNotes(prev => [...prev, {
      id: newId,
      url: '',
      noteId: '',
      title: '',
      content: '',
      originalContent: '',
      tags: [],
      images: [],
      downloadedImages: [],
      author: '',
      shopName: globalSettings.shopName,
      accountName: globalSettings.accountName,
      productName: globalSettings.productName,
      productItemId: globalSettings.productItemId,
      remark: '',
      parseSuccess: true,
      parseError: '',
      partial: false,
      rewritten: false,
      deduplicated: false,
    }])
    // 自动展开并进入编辑模式
    setExpandedNotes(prev => new Set([...prev, newId]))
    setEditingNote(newId)
  }

  const isBusy = status !== STATUS.IDLE && status !== STATUS.PAUSED
  const isPaused = status === STATUS.PAUSED
  const isResting = status === STATUS.BATCH_RESTING
  const isOneClick = status === STATUS.ONE_CLICK
  const successCount = notes.filter(n => n.parseSuccess).length
  const failCount = notes.filter(n => !n.parseSuccess).length

  return (
    <div className="panel" style={{ maxWidth: 1200 }}>
      <h2>📥 笔记采集</h2>
      <p style={{ color: '#888', fontSize: 13, marginTop: -8 }}>
        上传包含小红书笔记链接的 Excel 文件，系统自动解析标题、正文、标签、图片
      </p>

      {/* ===== 第一步：上传 Excel ===== */}
      <div style={{
        border: '2px dashed #ddd', borderRadius: 12, padding: '30px 20px',
        textAlign: 'center', margin: '16px 0', background: '#fafafa',
        cursor: 'pointer', transition: 'all .2s',
      }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#ff4757' }}
        onDragLeave={e => { e.currentTarget.style.borderColor = '#ddd' }}
        onDrop={e => {
          e.preventDefault()
          e.currentTarget.style.borderColor = '#ddd'
          const file = e.dataTransfer.files[0]
          if (file) {
            const fakeEvent = { target: { files: [file] } }
            handleFileUpload(fakeEvent)
          }
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {excelData
            ? `已读取 ${excelData.totalRows} 条链接（点击更换文件）`
            : '点击上传或拖拽 Excel 文件到这里'
          }
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
          支持 .xlsx 格式，第一列为小红书笔记链接
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn-secondary btn-sm" onClick={generateTemplate}>
          📋 下载 Excel 模板
        </button>
        <button className="btn-secondary btn-sm" onClick={handleManualAdd}>
          ✏️ 手动添加一条
        </button>
      </div>

      {/* ===== 第二步：全局设置 ===== */}
      {(excelData || notes.length > 0) && (
        <div style={{
          background: '#f8f9fa', borderRadius: 10, padding: 16,
          marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10,
        }}>
          {shops.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', color: '#e65100', fontSize: 13 }}>
              ⚠️ 请先在「店铺管理」中创建店铺并添加商品和账号
            </div>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>店铺名称</label>
                <select value={selectedShopId} onChange={e => handleSelectShop(e.target.value)} style={{ fontSize: 13 }}>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>账号名称</label>
                <select value={selectedAccountId} onChange={e => handleSelectAccount(e.target.value)} style={{ fontSize: 13 }}>
                  {(selectedShop?.accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>商品名称</label>
                <select value={selectedProductId} onChange={e => handleSelectProduct(e.target.value)} style={{ fontSize: 13 }}>
                  {(selectedShop?.products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>商品ID</label>
                <input value={globalSettings.productItemId} readOnly style={{ fontSize: 13, background: '#eee', cursor: 'default' }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== 改写设置 ===== */}
      {(excelData || notes.length > 0) && (
        <div style={{
          background: '#fff8f0', borderRadius: 10, padding: 16,
          marginBottom: 16, border: '1px solid #ffe0c0',
        }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={globalSettings.enableRewrite}
                onChange={e => setGlobalSettings(p => ({ ...p, enableRewrite: e.target.checked }))}
              />
              启用 AI 改写
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={globalSettings.enableHumanize}
                onChange={e => setGlobalSettings(p => ({ ...p, enableHumanize: e.target.checked }))}
              />
              去 AI 味
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={globalSettings.enableImageDedup}
                onChange={e => setGlobalSettings(p => ({ ...p, enableImageDedup: e.target.checked }))}
              />
              图片去重
            </label>
          </div>
          {globalSettings.enableRewrite && (
            <textarea
              value={globalSettings.rewritePrompt}
              onChange={e => setGlobalSettings(p => ({ ...p, rewritePrompt: e.target.value }))}
              placeholder="自定义改写要求（可选），例如：改写为测评风格、突出性价比..."
              rows={2}
              style={{ width: '100%', fontSize: 13, borderRadius: 8, border: '1px solid #e0d0c0', padding: '8px 10px' }}
            />
          )}
        </div>
      )}

      {/* ===== 采集速度选择 ===== */}
      {(excelData || notes.length > 0) && (
        <div style={{
          background: '#f0f7ff', borderRadius: 10, padding: '12px 16px',
          marginBottom: 16, border: '1px solid #c0d8f0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1565c0' }}>🛡 采集速度：</span>
          {Object.entries(SPEED_PRESETS).map(([key, preset]) => (
            <label key={key} style={{
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1,
            }}>
              <input
                type="radio"
                name="speedMode"
                value={key}
                checked={speedMode === key}
                onChange={() => setSpeedMode(key)}
                disabled={isBusy || isPaused}
              />
              {preset.label}
            </label>
          ))}
          <span style={{ fontSize: 11, color: '#888' }}>
            （每条间隔 {SPEED_PRESETS[speedMode].noteMin / 1000}~{SPEED_PRESETS[speedMode].noteMax / 1000}s，每批 {SPEED_PRESETS[speedMode].batchSize} 条）
          </span>
        </div>
      )}

      {/* ===== 一键采集+处理+导出 ===== */}
      {(excelData || notes.length > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 16,
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>一键采集 + 处理 + 导出 Excel</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                自动采集全部链接 → AI改写 → 去AI味 → 实时写入Excel（每处理完一条立即保存，不丢数据）
              </div>
            </div>
          </div>

          {!isOneClick && (
            <button
              onClick={handleOneClick}
              disabled={isBusy || isPaused}
              style={{
                background: '#fff', color: '#764ba2', border: 'none',
                padding: '10px 28px', borderRadius: 8, fontWeight: 700,
                fontSize: 14, cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'all .2s',
              }}
            >
              📊 开始一键采集+导出 ({excelData?.totalRows || notes.filter(n => n.url && !n.title).length} 条)
            </button>
          )}

          {isOneClick && (
            <div>
              {/* 进度条 */}
              {oneClickProgress && oneClickProgress.total > 0 && (
                <div style={{
                  background: 'rgba(255,255,255,0.2)', borderRadius: 6,
                  height: 8, marginBottom: 10, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 6,
                    background: '#fff',
                    width: `${(oneClickProgress.completed / oneClickProgress.total) * 100}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              )}

              {/* 状态文字 */}
              {oneClickProgress && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, flex: 1, minWidth: 200 }}>
                    {oneClickProgress.text}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, opacity: 0.85 }}>
                    <span>✅ {oneClickProgress.successCount || 0}</span>
                    <span>❌ {oneClickProgress.failCount || 0}</span>
                    <span>{oneClickProgress.completed}/{oneClickProgress.total}</span>
                  </div>
                </div>
              )}

              {/* 阶段指示器 */}
              {oneClickProgress && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {['采集', '改写', '去AI味', '写入'].map(phase => (
                    <span key={phase} style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 11,
                      background: oneClickProgress.phase === phase
                        ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                      color: oneClickProgress.phase === phase ? '#764ba2' : 'rgba(255,255,255,0.6)',
                      fontWeight: oneClickProgress.phase === phase ? 700 : 400,
                      transition: 'all .3s',
                    }}>
                      {phase}
                    </span>
                  ))}
                </div>
              )}

              {/* 停止按钮 */}
              <button
                onClick={handleStop}
                style={{
                  marginTop: 10, background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  color: '#fff', padding: '6px 16px', borderRadius: 6,
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                ⏹ 停止
              </button>
            </div>
          )}

          {/* 完成后的结果提示 */}
          {!isOneClick && oneClickProgress?.phase === '完成' && (
            <div style={{
              marginTop: 10, padding: '8px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.15)', fontSize: 13,
            }}>
              {oneClickProgress.text}
            </div>
          )}
        </div>
      )}

      {/* ===== 操作按钮 ===== */}
      {(excelData || notes.length > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(() => {
            const unparsedCount = excelData?.totalRows || notes.filter(n => n.url && !n.title).length
            return unparsedCount > 0 && !isPaused && (
              <button
                className="btn-primary"
                onClick={handleFetchAll}
                disabled={isBusy}
              >
                🔍 {fetchedSet.size > 0 ? '继续采集' : '一键解析全部链接'} ({unparsedCount - fetchedSet.size > 0 ? unparsedCount - fetchedSet.size : unparsedCount})
              </button>
            )
          })()}
          {isPaused && (
            <button
              className="btn-primary"
              onClick={handleResume}
              style={{ background: '#ff9800' }}
            >
              ▶️ 从断点继续采集
            </button>
          )}
          {fetchedSet.size > 0 && !isBusy && (
            <button
              className="btn-secondary btn-sm"
              onClick={handleResetProgress}
              title="清除断点记录，从头开始"
            >
              🔄 重置进度
            </button>
          )}
          {notes.length > 0 && (
            <>
              <button
                className="btn-primary"
                onClick={handleRewriteAll}
                disabled={isBusy || isPaused || !settings?.apiKey}
                style={{ background: '#2196f3' }}
              >
                ✍️ 一键改写正文
              </button>
              <button
                className="btn-primary"
                onClick={handleImportToResults}
                disabled={isBusy || isPaused}
                style={{ background: '#4caf50' }}
              >
                📥 导入到生成结果 ({successCount})
              </button>
            </>
          )}
          {(isBusy || isResting) && !isOneClick && (
            <button className="btn-danger btn-sm" onClick={handleStop}>
              ⏹ 停止
            </button>
          )}
        </div>
      )}

      {/* ===== 进度条 + 倒计时 ===== */}
      {(isBusy || isPaused || isResting || progress.text || (isOneClick && countdown > 0)) && (
        <div style={{ marginBottom: 16 }}>
          {!isOneClick && progress.total > 0 && (
            <div className="progress-bar" style={{ marginBottom: 6 }}>
              <div
                className="progress-fill"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          )}
          {!isOneClick && <div style={{ fontSize: 13, color: '#666' }}>{progress.text}</div>}

          {/* 倒计时显示 */}
          {countdown > 0 && (
            <div style={{
              marginTop: 8, padding: '8px 14px', borderRadius: 8,
              background: isPaused ? '#fff3e0' : isResting ? '#e3f2fd' : '#f5f5f5',
              border: `1px solid ${isPaused ? '#ffe0b2' : isResting ? '#bbdefb' : '#e0e0e0'}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>{isPaused ? '⏸' : isResting ? '☕' : '⏳'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isPaused ? '#e65100' : '#1565c0' }}>
                  {countdownLabel || '等待中'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#333' }}>
                  {formatCountdown(countdown)}
                </div>
              </div>
              {batchInfo && (
                <div style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
                  批次 {batchInfo.current}/{batchInfo.total}
                </div>
              )}
            </div>
          )}

          {/* 预计时间 */}
          {isBusy && !isOneClick && progress.total > 0 && progress.completed > 0 && !countdown && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
              预计剩余 ~{formatCountdown(
                ((progress.total - progress.completed) * (SPEED_PRESETS[speedMode].noteMin + SPEED_PRESETS[speedMode].noteMax) / 2)
                + (Math.floor((progress.total - progress.completed) / SPEED_PRESETS[speedMode].batchSize) * (SPEED_PRESETS[speedMode].batchRest[0] + SPEED_PRESETS[speedMode].batchRest[1]) / 2)
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== 解析结果列表 ===== */}
      {notes.length > 0 && (
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12,
          }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              解析结果 ({notes.length} 条)
              {successCount > 0 && <span style={{ color: '#4caf50', fontSize: 12, marginLeft: 8 }}>✅ {successCount} 成功</span>}
              {failCount > 0 && <span style={{ color: '#e53935', fontSize: 12, marginLeft: 8 }}>❌ {failCount} 失败</span>}
            </h3>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setExpandedNotes(prev =>
                prev.size === notes.length ? new Set() : new Set(notes.map(n => n.id))
              )}
            >
              {expandedNotes.size === notes.length ? '全部折叠' : '全部展开'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((note, idx) => (
              <NoteCard
                key={note.id}
                note={note}
                index={idx}
                expanded={expandedNotes.has(note.id)}
                onToggle={() => toggleExpand(note.id)}
                onUpdate={updateNote}
                onDelete={() => deleteNote(note.id)}
                editing={editingNote === note.id}
                onEditToggle={() => setEditingNote(editingNote === note.id ? null : note.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 单条笔记卡片 ============
function NoteCard({ note, index, expanded, onToggle, onUpdate, onDelete, editing, onEditToggle }) {
  const statusColor = note.parseSuccess ? '#4caf50' : '#e53935'
  const statusIcon = note.parseSuccess ? '✅' : '❌'

  return (
    <div style={{
      border: '1px solid #e8e8e8', borderRadius: 10, overflow: 'hidden',
      background: note.parseSuccess ? '#fff' : '#fff5f5',
      transition: 'all .2s',
    }}>
      {/* 标题栏 */}
      <div
        onClick={onToggle}
        style={{
          padding: '10px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          background: expanded ? '#f8f9fa' : 'transparent',
          borderBottom: expanded ? '1px solid #eee' : 'none',
        }}
      >
        <span style={{ color: '#999', fontSize: 12, minWidth: 24 }}>#{index + 1}</span>
        <span style={{ fontSize: 13 }}>{statusIcon}</span>

        {/* 缩略图 */}
        {note.downloadedImages?.[0] && (
          <img
            src={note.downloadedImages[0]}
            alt=""
            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {note.title || (note.parseError ? `解析失败: ${note.parseError}` : '未解析')}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
            {note.author && `@${note.author} · `}
            {note.tags?.length > 0 && `${note.tags.length}个标签 · `}
            {note.downloadedImages?.length > 0 && `${note.downloadedImages.length}张图 · `}
            {note.rewritten && '✍️已改写 · '}
            {note.deduplicated && '🖼️已去重'}
          </div>
        </div>

        <span style={{ fontSize: 18, color: '#ccc', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          ›
        </span>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ padding: 14 }}>
          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn-secondary btn-sm" onClick={onEditToggle}>
              {editing ? '💾 完成编辑' : '✏️ 编辑'}
            </button>
            <button className="btn-danger btn-sm" onClick={onDelete}>🗑 删除</button>
          </div>

          {/* 链接 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>小红书链接</label>
            {editing ? (
              <input
                value={note.url}
                onChange={e => onUpdate(note.id, 'url', e.target.value)}
                placeholder="粘贴小红书笔记链接"
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd' }}
              />
            ) : (
              <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
                {note.url || <span style={{ color: '#ccc' }}>未填写链接</span>}
              </div>
            )}
          </div>

          {/* 标题 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>标题</label>
            {editing ? (
              <input
                value={note.title}
                onChange={e => onUpdate(note.id, 'title', e.target.value)}
                style={{ width: '100%', fontSize: 14, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd' }}
              />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 600 }}>{note.title || '-'}</div>
            )}
          </div>

          {/* 正文 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>
              正文
              {note.rewritten && <span style={{ color: '#2196f3', marginLeft: 6 }}>已改写</span>}
            </label>
            {editing ? (
              <textarea
                value={note.content}
                onChange={e => onUpdate(note.id, 'content', e.target.value)}
                rows={5}
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', resize: 'vertical' }}
              />
            ) : (
              <div style={{
                fontSize: 13, lineHeight: 1.6, color: '#333',
                background: '#f8f9fa', padding: '8px 12px', borderRadius: 8,
                whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto',
              }}>
                {note.content || '-'}
              </div>
            )}
          </div>

          {/* 标签 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>
              标签 ({note.tags?.length || 0})
            </label>
            {editing ? (
              <input
                value={(note.tags || []).join(', ')}
                onChange={e => onUpdate(note.id, 'tags', e.target.value.split(/[,，]\s*/).filter(Boolean))}
                placeholder="逗号分隔"
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd' }}
              />
            ) : (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(note.tags || []).map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: '#fff0f0', color: '#ff4757',
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 图片预览 */}
          {note.downloadedImages?.length > 0 && (
            <div>
              <label style={{ fontSize: 12, color: '#999', display: 'block', marginBottom: 4 }}>
                图片 ({note.downloadedImages.length})
                {note.deduplicated && <span style={{ color: '#ff9800', marginLeft: 6 }}>已去重</span>}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {note.downloadedImages.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`图${i + 1}`}
                    style={{
                      width: 100, height: 100, objectFit: 'cover',
                      borderRadius: 8, border: '1px solid #eee',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 商品信息 */}
          {editing && (
            <div style={{
              marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>店铺</label>
                <input
                  value={note.shopName}
                  onChange={e => onUpdate(note.id, 'shopName', e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>账号</label>
                <input
                  value={note.accountName}
                  onChange={e => onUpdate(note.id, 'accountName', e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>商品</label>
                <input
                  value={note.productName}
                  onChange={e => onUpdate(note.id, 'productName', e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>商品ID</label>
                <input
                  value={note.productItemId}
                  onChange={e => onUpdate(note.id, 'productItemId', e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* 解析错误提示 */}
          {!note.parseSuccess && (
            <div style={{
              marginTop: 10, padding: '8px 12px', background: '#ffebee',
              borderRadius: 8, fontSize: 12, color: '#c62828',
            }}>
              ⚠️ {note.parseError || '解析失败'} — 你可以点击"编辑"手动填写内容
            </div>
          )}
        </div>
      )}
    </div>
  )
}
