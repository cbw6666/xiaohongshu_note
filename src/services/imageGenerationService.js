const DEFAULT_IMAGE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

const COVER_REDRAW_PROMPT = `请基于参考图做中度图生图重绘，生成一张同类型的小红书封面。

目标效果：先判断原图属于什么封面风格大类（如实拍随手拍、资料海报、产品图、人像图、截图类、清单图、氛围图等），再保持同一风格大类做重绘。新图必须像同主题、同风格大类下重新制作的一张封面，不能只是原图缩放、压缩、修清晰或照抄。

必须保留：
1. 原图的封面风格大类、主体类型、视觉用途和小红书封面属性。
2. 原图实际存在的核心主体、商品/资料主题、使用场景、背景类型和关键道具；不要凭空换成不相关品类。
3. 封面大字的主要含义和层级，中文尽量准确。

必须明显变化：
1. 重新生成背景和主体周围的细节纹理，不要逐像素复制原图纹理、照片噪点、文字纹理或局部污点。
2. 调整原图实际存在的主体、道具、背景元素的位置、角度、距离、比例或遮挡关系，让它像同类风格下重新制作的图。
3. 调整光线、色温、清晰度、拍摄/排版距离或取景范围，保留同类风格但不要复刻原图。
4. 重新设计封面大字的字体、描边、阴影、字号或排布，但保留主要含义；文字必须加粗醒目，适合小红书手机缩略图阅读。
5. 可以使用描边、投影、局部高亮、底色块或标签形状强调重点文字，但不要遮挡主体。
6. 去掉平台截图 UI、头像、昵称、水印、黑边、底部工具条。
7. 以下变化项至少做到两项：改变取景范围、改变拍摄/排版角度、改变主体或道具位置、改变文字排布、改变背景细节层次、改变光影方向。

禁止：
1. 不要把一种封面风格大类改成另一种完全不同的风格。
2. 不要输出与原图几乎一样的构图和细节。
3. 不要删除原图的真实背景和主要物体。

输出：只生成图片，不要解释。`

function trimTrailingSlash(url = '') {
  return String(url || '').replace(/\/+$/, '')
}

function normalizeDataUrl(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.startsWith('data:image/')) return text
  if (/^[A-Za-z0-9+/=]+$/.test(text.slice(0, 80))) {
    return `data:image/jpeg;base64,${text}`
  }
  return text
}

function getImageRatio(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl?.startsWith('data:image/')) {
      resolve('1:1')
      return
    }

    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalWidth / Math.max(1, img.naturalHeight)
      if (ratio < 0.7) resolve('9:16')
      else if (ratio < 0.9) resolve('3:4')
      else if (ratio > 1.6) resolve('16:9')
      else if (ratio > 1.15) resolve('4:3')
      else resolve('1:1')
    }
    img.onerror = () => resolve('1:1')
    img.src = dataUrl
  })
}

function getImageInfo(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl?.startsWith('data:image/')) {
      reject(new Error('无法读取原封面尺寸'))
      return
    }

    const img = new Image()
    img.onload = () => resolve({
      img,
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}

async function resizeImageToMatch(sourceDataUrl, targetWidth, targetHeight) {
  if (!sourceDataUrl?.startsWith('data:image/')) return sourceDataUrl
  if (!targetWidth || !targetHeight) return sourceDataUrl

  const { img } = await getImageInfo(sourceDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return sourceDataUrl

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight)
  const drawWidth = img.naturalWidth * scale
  const drawHeight = img.naturalHeight * scale
  const dx = (targetWidth - drawWidth) / 2
  const dy = (targetHeight - drawHeight) / 2

  ctx.drawImage(img, dx, dy, drawWidth, drawHeight)
  return canvas.toDataURL('image/jpeg', 0.92)
}

async function fetchImageAsDataUrl(url, signal) {
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`生成图片下载失败 (${resp.status})`)

  const blob = await resp.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error(`生成结果不是图片: ${blob.type || 'unknown'}`)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function pickGeneratedImage(data) {
  const candidates = []

  if (Array.isArray(data?.data)) candidates.push(...data.data)
  if (Array.isArray(data?.images)) candidates.push(...data.images)
  if (Array.isArray(data?.result?.images)) candidates.push(...data.result.images)
  if (data?.url || data?.b64_json) candidates.push(data)
  if (data?.result?.url || data?.result?.b64_json) candidates.push(data.result)

  for (const item of candidates) {
    if (typeof item === 'string') return item
    if (item?.b64_json) return normalizeDataUrl(item.b64_json)
    if (item?.base64) return normalizeDataUrl(item.base64)
    if (item?.image_base64) return normalizeDataUrl(item.image_base64)
    if (item?.url) return item.url
  }

  return ''
}

export async function redrawCoverImage(originalCover, settings = {}, { signal } = {}) {
  const imageSettings = settings.imageGeneration || {}
  const apiKey = imageSettings.apiKey || settings.apiKey
  const endpointId = imageSettings.endpointId
  const baseUrl = trimTrailingSlash(imageSettings.baseUrl || settings.baseUrl || DEFAULT_IMAGE_BASE_URL)

  if (!apiKey || !endpointId) {
    throw new Error('请先在设置中配置图片生成 API Key 和 Seedream 接入点 ID')
  }
  if (!originalCover) throw new Error('没有可重绘的封面图')

  const originalInfo = await getImageInfo(originalCover)
  const aspectRatio = imageSettings.size === 'auto'
    ? await getImageRatio(originalCover)
    : (imageSettings.size || '1:1')
  const outputSize = imageSettings.resolution || '2K'

  const body = {
    model: endpointId,
    prompt: `${COVER_REDRAW_PROMPT}\n\n画面比例请保持为 ${aspectRatio}，最终画布尺寸参考原图 ${originalInfo.width}x${originalInfo.height}。`,
    image: originalCover,
    size: outputSize,
    n: 1,
    sequential_image_generation: 'disabled',
    response_format: 'b64_json',
    watermark: false,
  }

  const resp = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`封面重绘请求失败 (${resp.status}): ${err}`)
  }

  const data = await resp.json()
  const image = pickGeneratedImage(data)
  if (!image) throw new Error('封面重绘返回为空')

  if (image.startsWith('http://') || image.startsWith('https://')) {
    const generatedDataUrl = await fetchImageAsDataUrl(image, signal)
    return resizeImageToMatch(generatedDataUrl, originalInfo.width, originalInfo.height)
  }

  const dataUrl = normalizeDataUrl(image)
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('封面重绘返回了无法识别的图片格式')
  }
  return resizeImageToMatch(dataUrl, originalInfo.width, originalInfo.height)
}
