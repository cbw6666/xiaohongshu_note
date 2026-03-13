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

let fontsLoaded = false
let loadPromise = null

/**
 * 确保所有字体已加载
 */
export function ensureFontsLoaded() {
  if (fontsLoaded) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = Promise.all(
    FONT_FACES.map(({ family, weight }) => {
      return document.fonts.load(`${weight} 48px "${family}"`, '测试字体ABCabc123')
        .catch(() => {
          console.warn(`字体加载失败: ${family}`)
        })
    })
  ).then(() => {
    fontsLoaded = true
    console.log('所有封面字体已加载')
  })

  return loadPromise
}
