/**
 * 字体定义和加载工具
 * 
 * 所有封面模板统一使用超粗黑体（Noto Sans SC 900）
 */

export const FONTS = {
  HEITI: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
}

// 需要预加载的字体列表
const FONT_FACES = [
  { family: 'Noto Sans SC', weight: '900' },
]

// === 图片预加载缓存 ===
const imageCache = {}

// 需要预加载的封面背景图
const PRELOAD_IMAGES = [
  { id: 'torn_paper_green_bg', src: import.meta.env.BASE_URL + 'covers/torn_paper_green_bg.png' },
  { id: 'torn_paper_green_v2', src: import.meta.env.BASE_URL + 'covers/torn_paper_green_v2.png' },
]

function preloadImage(id, src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => { imageCache[id] = img; resolve() }
    img.onerror = () => { console.warn(`封面背景图加载失败: ${id}`); resolve() }
    img.src = src
  })
}

/**
 * 获取已缓存的图片（同步）
 */
export function getCachedImage(id) {
  return imageCache[id] || null
}

let fontsLoaded = false
let loadPromise = null

/**
 * 确保所有字体和图片资源已加载
 */
export function ensureFontsLoaded() {
  if (fontsLoaded) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = Promise.all([
    // 字体加载
    ...FONT_FACES.map(({ family, weight }) => {
      return document.fonts.load(`${weight} 48px "${family}"`, '测试字体ABCabc123')
        .catch(() => {
          console.warn(`字体加载失败: ${family}`)
        })
    }),
    // 图片预加载
    ...PRELOAD_IMAGES.map(({ id, src }) => preloadImage(id, src)),
  ]).then(() => {
    fontsLoaded = true
    console.log('所有封面字体和图片资源已加载')
  })

  return loadPromise
}
