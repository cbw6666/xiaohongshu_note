/**
 * 字体定义和加载工具
 * 
 * 字体风格：
 * - HEITI:    超粗黑体（Noto Sans SC 900）— 冲击力强
 * - SONGTI:   衬线粗体（Noto Serif SC 900）— 正式感
 * - KUAILE:   圆体/可爱体（ZCOOL KuaiLe）— 活泼可爱
 * - QINGKE:   潮酷黑体（ZCOOL QingKe HuangYou）— 潮流感
 * - XIAOWEI:  文艺细体（ZCOOL XiaoWei）— 文艺清新
 * - MASHAN:   手写楷体（Ma Shan Zheng）— 手写感
 * - LONGCANG: 手写潦草（Long Cang）— 随性潦草
 */

export const FONTS = {
  HEITI: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  SONGTI: '"Noto Serif SC", "STSong", "SimSun", serif',
  KUAILE: '"ZCOOL KuaiLe", "PingFang SC", sans-serif',
  QINGKE: '"ZCOOL QingKe HuangYou", "PingFang SC", sans-serif',
  XIAOWEI: '"ZCOOL XiaoWei", "PingFang SC", sans-serif',
  MASHAN: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
  LONGCANG: '"Long Cang", "STXingkai", cursive',
}

// 需要预加载的字体列表
const FONT_FACES = [
  { family: 'Noto Sans SC', weight: '900' },
  { family: 'Noto Serif SC', weight: '900' },
  { family: 'ZCOOL KuaiLe', weight: '400' },
  { family: 'ZCOOL QingKe HuangYou', weight: '400' },
  { family: 'ZCOOL XiaoWei', weight: '400' },
  { family: 'Ma Shan Zheng', weight: '400' },
  { family: 'Long Cang', weight: '400' },
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
