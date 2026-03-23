/**
 * 图片去重引擎（优化版）
 * 通过 Canvas 对图片进行多维度微调处理，使输出图片的 MD5/pHash/CNN 特征与原图不同
 * 
 * 策略：对检测有效但肉眼不敏感的处理（裁剪/缩放/旋转/JPEG重压缩）保持力度
 *       纯粹影响视觉的处理（边框/emoji/色膜/暗角/色偏）大幅降低
 */

// ============ 工具函数 ============

function clamp(val) {
  return Math.max(0, Math.min(255, Math.round(val)))
}

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1))
}

/**
 * RGB → HSL
 * @returns {[number, number, number]} [h(0~360), s(0~1), l(0~1)]
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s, l]
}

/**
 * HSL → RGB
 * @param {number} h 色相 0~360
 * @param {number} s 饱和度 0~1
 * @param {number} l 亮度 0~1
 * @returns {[number, number, number]} [r, g, b] 0~255
 */
function hslToRgb(h, s, l) {
  h /= 360
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/**
 * 从图片边缘采样获取平均颜色（用于边框颜色）
 */
function sampleEdgeColor(imageData, w, h) {
  const data = imageData.data
  let rSum = 0, gSum = 0, bSum = 0, count = 0

  const samplePixel = (x, y) => {
    const idx = (y * w + x) * 4
    rSum += data[idx]
    gSum += data[idx + 1]
    bSum += data[idx + 2]
    count++
  }

  // 采样四条边（每隔几个像素采一次，避免全部遍历太慢）
  const step = Math.max(1, Math.floor(Math.max(w, h) / 50))
  for (let x = 0; x < w; x += step) {
    samplePixel(x, 0)          // 上边
    samplePixel(x, h - 1)      // 下边
  }
  for (let y = 0; y < h; y += step) {
    samplePixel(0, y)          // 左边
    samplePixel(w - 1, y)      // 右边
  }

  if (count === 0) return { r: 255, g: 255, b: 255 }
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  }
}

// 预设 emoji 池（常见装饰类，不会显得突兀）
const EMOJI_POOL = [
  '✨', '🌟', '💫', '⭐', '🌸', '🌺', '🌷', '🍀',
  '🦋', '🌈', '☁️', '💕', '💗', '🎀', '🎵', '🍃',
  '🌙', '⚡', '🔥', '💎', '🧸', '🎈', '🪄', '🫧',
]

// ============ 主处理函数 ============

/**
 * 加载 base64 图片为 Image 对象
 */
function loadImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = base64
  })
}

/**
 * 对图片进行去重处理（优化版：检测有效的保持力度，视觉影响大的降低）
 * @param {string} base64Src 原图 base64
 * @param {object} options 处理选项
 * @returns {string} 处理后的 base64
 */
export async function deduplicateImage(base64Src, options = {}) {
  const {
    // ---- 对检测有效、肉眼不敏感 → 保持力度 ----
    cropPixels = randomInt(6, 14),
    scaleFactor = randomRange(0.94, 1.06),
    quality = randomRange(0.78, 0.90),
    rotation = randomRange(-0.8, 0.8),
    // ---- 肉眼敏感 → 大幅降低 ----
    brightness = randomRange(-3, 3),
    contrast = randomRange(-3, 3),
    noise = randomRange(2, 5),
    hueShift = randomRange(-3, 3),
    saturationShift = randomRange(-0.05, 0.05),
    colorTempR = randomInt(-3, 3),
    colorTempB = randomInt(-3, 3),
    borderWidth = randomInt(0, 3),
    overlayOpacity = randomRange(0.01, 0.02),
    vignetteStrength = randomRange(0.02, 0.04),
  } = options

  const img = await loadImage(base64Src)

  // ---- 步骤 1：随机缩放 ----
  const scaledW = Math.round(img.width * scaleFactor)
  const scaledH = Math.round(img.height * scaleFactor)

  // ---- 步骤 2：计算裁剪后的尺寸 ----
  const outW = scaledW - cropPixels * 2
  const outH = scaledH - cropPixels * 2

  if (outW < 100 || outH < 100) {
    return base64Src
  }

  // 创建主画布（先不含边框）
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')

  // ---- 步骤 3：微旋转 ----
  if (Math.abs(rotation) > 0.05) {
    const rad = (rotation * Math.PI) / 180
    ctx.translate(outW / 2, outH / 2)
    ctx.rotate(rad)
    ctx.translate(-outW / 2, -outH / 2)
  }

  // ---- 步骤 4：绘制缩放+裁剪后的图片 ----
  ctx.drawImage(
    img,
    0, 0, img.width, img.height,
    -cropPixels * (scaleFactor), -cropPixels * (scaleFactor), scaledW, scaledH
  )

  // ---- 步骤 5：逐像素处理（亮度、对比度、色相、饱和度、色温、噪点）----
  const imageData = ctx.getImageData(0, 0, outW, outH)
  const data = imageData.data

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // 色相偏移 + 饱和度调整（通过 HSL 转换）
    if (Math.abs(hueShift) > 0.5 || Math.abs(saturationShift) > 0.01) {
      let [h, s, l] = rgbToHsl(r, g, b)
      h = (h + hueShift + 360) % 360
      s = Math.max(0, Math.min(1, s + saturationShift))
      ;[r, g, b] = hslToRgb(h, s, l)
    }

    // 色温偏移（红蓝通道分别加减）
    r = clamp(r + colorTempR)
    b = clamp(b + colorTempB)

    // 亮度调整
    if (brightness !== 0) {
      r = clamp(r + brightness)
      g = clamp(g + brightness)
      b = clamp(b + brightness)
    }

    // 对比度调整
    if (Math.abs(contrast) > 0.1) {
      r = clamp(contrastFactor * (r - 128) + 128)
      g = clamp(contrastFactor * (g - 128) + 128)
      b = clamp(contrastFactor * (b - 128) + 128)
    }

    // 随机噪点（30% 的像素）
    if (noise > 0 && Math.random() < 0.3) {
      const n = randomRange(-noise, noise)
      r = clamp(r + n)
      g = clamp(g + n)
      b = clamp(b + n)
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  ctx.putImageData(imageData, 0, 0)

  // ---- 步骤 6：叠半透明中性色膜（接近白/灰，避免出现怪异色调）----
  const neutralBase = randomInt(200, 255)
  const overlayR = neutralBase + randomInt(-10, 10)
  const overlayG = neutralBase + randomInt(-10, 10)
  const overlayB = neutralBase + randomInt(-10, 10)
  ctx.fillStyle = `rgba(${overlayR}, ${overlayG}, ${overlayB}, ${overlayOpacity})`
  ctx.fillRect(0, 0, outW, outH)

  // ---- 步骤 7：渐变暗角 ----
  const centerX = outW / 2
  const centerY = outH / 2
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY)
  const vignetteGradient = ctx.createRadialGradient(
    centerX, centerY, maxRadius * 0.5,
    centerX, centerY, maxRadius
  )
  vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignetteGradient.addColorStop(1, `rgba(0, 0, 0, ${vignetteStrength})`)
  ctx.fillStyle = vignetteGradient
  ctx.fillRect(0, 0, outW, outH)

  // ---- 步骤 8：角落贴极低透明度 emoji（几乎不可见）----
  const emoji = EMOJI_POOL[randomInt(0, EMOJI_POOL.length - 1)]
  const emojiSize = randomInt(6, 10)
  const emojiOpacity = randomRange(0.03, 0.08)
  // 随机选一个角落
  const corner = randomInt(0, 3)
  const margin = randomInt(5, 15)
  let emojiX, emojiY
  switch (corner) {
    case 0: emojiX = margin; emojiY = margin + emojiSize; break                    // 左上
    case 1: emojiX = outW - emojiSize - margin; emojiY = margin + emojiSize; break  // 右上
    case 2: emojiX = margin; emojiY = outH - margin; break                          // 左下
    case 3: emojiX = outW - emojiSize - margin; emojiY = outH - margin; break       // 右下
  }
  ctx.globalAlpha = emojiOpacity
  ctx.font = `${emojiSize}px serif`
  ctx.fillText(emoji, emojiX, emojiY)
  ctx.globalAlpha = 1.0

  // ---- 步骤 9：采样边缘颜色 → 混合偏白后加极窄边框 ----
  const processedImageData = ctx.getImageData(0, 0, outW, outH)
  const edgeColor = sampleEdgeColor(processedImageData, outW, outH)

  // 边框颜色与白色混合（70%白 + 30%边缘色），让边框更融入背景
  const blendR = Math.round(edgeColor.r * 0.3 + 255 * 0.7)
  const blendG = Math.round(edgeColor.g * 0.3 + 255 * 0.7)
  const blendB = Math.round(edgeColor.b * 0.3 + 255 * 0.7)

  // 创建带边框的最终画布
  const finalW = outW + borderWidth * 2
  const finalH = outH + borderWidth * 2
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = finalW
  finalCanvas.height = finalH
  const finalCtx = finalCanvas.getContext('2d')

  // 先画边框背景色（混合后的浅色）
  finalCtx.fillStyle = `rgb(${blendR}, ${blendG}, ${blendB})`
  finalCtx.fillRect(0, 0, finalW, finalH)

  // 再把处理好的图画上去（居中）
  finalCtx.drawImage(canvas, borderWidth, borderWidth)

  // ---- 步骤 10：输出 JPEG ----
  return finalCanvas.toDataURL('image/jpeg', quality)
}

/**
 * 批量去重处理
 */
export async function batchDeduplicate(images, options = {}, onProgress) {
  const results = []
  for (let i = 0; i < images.length; i++) {
    const result = await deduplicateImage(images[i], options)
    results.push(result)
    onProgress?.({ completed: i + 1, total: images.length })
  }
  return results
}
