/**
 * 文本扰动服务 — 在AI生成+去AI味之后的最终本地处理层
 * 目的：通过本地规则对文案做微扰动，进一步降低AI文本指纹
 * 不依赖AI接口，纯本地JS处理，零成本
 */

// 同义词替换表（AI高频词 → 小红书口语化替代）
const SYNONYM_MAP = {
  '此外': ['还有就是', '对了', '另外说一嘴'],
  '值得注意的是': ['划重点', '敲黑板', ''],
  '总而言之': ['反正就是', '总之', '说白了'],
  '与此同时': ['而且', '顺便说', ''],
  '综上所述': ['所以呢', '总之就是', '说到底'],
  '毫无疑问': ['真的', '确实', '不得不说'],
  '事实上': ['说实话', '讲真', '不瞒你说'],
  '具体来说': ['就是说', '怎么讲呢', '简单来说'],
  '换句话说': ['说白了', '就是', '也就是说'],
  '至关重要': ['超重要', '太关键了', '真的很重要'],
  '不容忽视': ['不能忽略', '得注意', '千万别忘了'],
  '引人注目': ['很亮眼', '太吸睛了', '超抢眼'],
  '令人惊叹': ['绝了', '太牛了', '真的惊到我了'],
  '显而易见': ['明摆着', '很明显', '一眼就能看出来'],
  '不仅如此': ['而且啊', '还有', '关键是'],
  '由此可见': ['所以说', '你看', '这就说明了'],
  '首先': ['先说', '第一个要说的', ''],
  '其次': ['然后', '再来', '还有就是'],
  '最后': ['最后说一个', '还有', '对了'],
  '因此': ['所以', '所以说', '这就是为啥'],
  '然而': ['但是吧', '不过', '可是呢'],
  '尽管': ['虽然', '虽说', '话是这么说'],
  '不可否认': ['确实', '说实话', '不得不承认'],
  '毋庸置疑': ['真的', '绝对是', '没得说'],
  '值得一提': ['说到这个', '对了', '顺便提一嘴'],
  '令人遗憾': ['可惜', '有点遗憾', '美中不足'],
  '相较于': ['比起', '跟...比', '和...一比'],
  '从而': ['这样', '就能', '然后就'],
  '进而': ['接着', '然后', '这样一来'],
  '诸如': ['比如', '像是', '就像'],
  '涵盖': ['包含', '有', '覆盖了'],
  '提升': ['提高', '拉高', '变好'],
  '增强': ['加强', '变强', '更好'],
  '呈现': ['展示', '表现', '表现出来'],
  '凸显': ['突出', '体现', '很明显'],
}

// 标点扰动规则
const PUNCTUATION_VARIANTS = [
  { from: '。', to: ['～', '！', '。'], weight: [0.15, 0.1, 0.75] },
  { from: '！', to: ['！！', '！！！', '！'], weight: [0.2, 0.1, 0.7] },
  { from: '？', to: ['？？', '？？？', '？'], weight: [0.15, 0.05, 0.8] },
]

// 随机选择（加权）
function weightedRandom(options, weights) {
  const r = Math.random()
  let sum = 0
  for (let i = 0; i < options.length; i++) {
    sum += weights[i]
    if (r <= sum) return options[i]
  }
  return options[options.length - 1]
}

/**
 * 同义词替换：随机替换文本中的AI高频词
 * @param {string} text 
 * @param {number} probability 每个匹配项被替换的概率 (0-1)
 */
function applySynonymReplacement(text, probability = 0.7) {
  let result = text
  for (const [aiWord, alternatives] of Object.entries(SYNONYM_MAP)) {
    if (result.includes(aiWord) && Math.random() < probability) {
      const replacement = alternatives[Math.floor(Math.random() * alternatives.length)]
      // 只替换第一个出现的
      result = result.replace(aiWord, replacement)
    }
  }
  return result
}

/**
 * 标点微扰动：偶尔变化标点风格
 * @param {string} text 
 * @param {number} probability 
 */
function applyPunctuationPerturbation(text, probability = 0.12) {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const rule = PUNCTUATION_VARIANTS.find(r => r.from === ch)
    if (rule && Math.random() < probability) {
      result += weightedRandom(rule.to, rule.weight)
    } else {
      result += ch
    }
  }
  return result
}

/**
 * 段间空行随机化：随机在某些段落之间添加或删除空行
 */
function applyParagraphSpacing(text) {
  const paragraphs = text.split('\n')
  const result = []
  for (let i = 0; i < paragraphs.length; i++) {
    result.push(paragraphs[i])
    // 10%概率在非空段落后添加一个空行（增加呼吸感）
    if (paragraphs[i].trim() && i < paragraphs.length - 1 && Math.random() < 0.1) {
      result.push('')
    }
  }
  return result.join('\n')
}

/**
 * 对正文执行全部扰动
 */
export function perturbContent(content) {
  if (!content) return content
  
  let result = content
  
  // 1. 同义词替换（AI高频词 → 口语化）
  result = applySynonymReplacement(result, 0.7)
  
  // 2. 标点微扰动
  result = applyPunctuationPerturbation(result, 0.1)
  
  // 3. 段间空行随机化
  result = applyParagraphSpacing(result)
  
  return result
}

/**
 * 对标题执行轻量扰动（标题只做同义词替换，不动标点）
 */
export function perturbTitle(title) {
  if (!title) return title
  return applySynonymReplacement(title, 0.5)
}
