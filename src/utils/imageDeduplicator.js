/**
 * 图片去重引擎
 * 通过 Canvas 对图片进行微调处理，使输出图片的 MD5 与原图不同
 * 处理方式：亮度微调、对比度微调、随机像素噪点、微裁剪、JPEG 质量变化
 */

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
 * 对图片进行去重处理
 * @param {string} base64Src 原图 base64
 * @param {object} options 处理选项
 * @returns {string} 处理后的 base64
 */
export async function deduplicateImage(base64Src, options = {}) {
  const {
    brightness = randomRange(-3, 3),       // 亮度微调 (-10 ~ 10)
    contrast = randomRange(-2, 2),          // 对比度微调 (-5 ~ 5)
    noise = randomRange(1, 3),              // 噪点强度 (0 ~ 10)
    cropPixels = randomRange(1, 3),         // 边缘裁剪像素 (0 ~ 5)
    quality = randomRange(0.88, 0.95),      // JPEG 质量 (0.8 ~ 1.0)
    rotation = randomRange(-0.3, 0.3),      // 微旋转角度 (-1 ~ 1 度)
  } = options

  const img = await loadImage(base64Src)

  // 计算裁剪后的尺寸
  const srcW = img.width
  const srcH = img.height
  const outW = srcW - cropPixels * 2
  const outH = srcH - cropPixels * 2

  if (outW < 100 || outH < 100) {
    // 图片太小，不裁剪
    return base64Src
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')

  // 微旋转
  if (Math.abs(rotation) > 0.05) {
    const rad = (rotation * Math.PI) / 180
    ctx.translate(outW / 2, outH / 2)
    ctx.rotate(rad)
    ctx.translate(-outW / 2, -outH / 2)
  }

  // 绘制裁剪后的图片
  ctx.drawImage(
    img,
    cropPixels, cropPixels, outW, outH,  // 源区域（裁剪边缘）
    0, 0, outW, outH                      // 目标区域
  )

  // 获取像素数据进行处理
  const imageData = ctx.getImageData(0, 0, outW, outH)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // 亮度调整
    if (brightness !== 0) {
      data[i] = clamp(data[i] + brightness)
      data[i + 1] = clamp(data[i + 1] + brightness)
      data[i + 2] = clamp(data[i + 2] + brightness)
    }

    // 对比度调整
    if (contrast !== 0) {
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      data[i] = clamp(factor * (data[i] - 128) + 128)
      data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128)
      data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128)
    }

    // 随机噪点
    if (noise > 0 && Math.random() < 0.3) { // 30% 的像素添加噪点
      const n = randomRange(-noise, noise)
      data[i] = clamp(data[i] + n)
      data[i + 1] = clamp(data[i + 1] + n)
      data[i + 2] = clamp(data[i + 2] + n)
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // 输出为 JPEG（质量随机化也改变 MD5）
  return canvas.toDataURL('image/jpeg', quality)
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

// 工具函数
function clamp(val) {
  return Math.max(0, Math.min(255, Math.round(val)))
}

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}
