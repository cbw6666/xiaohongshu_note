const PRODUCT_NAME_SUFFIXES = [
  '资料大全',
  '备考资料',
  '学习资料',
  '笔记模板',
  '历年真题',
  '真题模板',
  '真题汇编',
  '题库汇总',
  '题库',
  '汇总',
  '总结',
  '大全',
  '模板',
  '模版',
  '资料',
  '教程',
  '课程',
  '教材',
  '讲义',
  '笔记',
  '电子版',
  '打印版',
  '冲刺卷',
  '预测卷',
  '五色笔记',
  '三色笔记',
  '四色笔记',
  '预览',
]

const COVER_BAD_ENDINGS = /(点击|购买|下单|链接|卡片|私信|冲鸭|冲呀|安排|入手|收藏|评论|关注)$/
const COVER_NOISE = /(真的|家人们|姐妹们|宝子们|谁懂啊|绝了|救命|yyds|哈哈哈|呜呜|！！*|？？*|[!！?？~～]+)$/g

function normalizeText(value = '') {
  return String(value || '')
    .replace(/\r?\n/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .trim()
}

function compactText(value = '') {
  return normalizeText(value)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function stripEmojiLike(value = '') {
  return String(value || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\uFE0F]/g, '')
}

function cleanPhrase(value = '') {
  return compactText(stripEmojiLike(value))
    .replace(/^[-—~·•,，。；;：:【】\[\]()（）]+/, '')
    .replace(/[-—~·•,，。；;：:【】\[\]()（）]+$/, '')
    .replace(COVER_NOISE, '')
    .trim()
}

function measureLen(value = '') {
  return Array.from(String(value || '')).length
}

function truncateByLen(value = '', maxLen = 18) {
  let output = ''
  let len = 0
  for (const ch of Array.from(String(value || ''))) {
    if (len >= maxLen) break
    output += ch
    len += 1
  }
  return output.trim()
}

function trimToSemanticBoundary(value = '', maxLen = 18) {
  const text = cleanPhrase(value)
  if (!text) return ''
  if (measureLen(text) <= maxLen) return text

  const boundaryChars = new Set(['，', '。', '、', '；', '：', '/', '|', '-', ' '])
  let output = ''
  let len = 0
  let lastBoundary = -1

  for (const ch of Array.from(text)) {
    if (len >= maxLen) break
    output += ch
    if (boundaryChars.has(ch)) lastBoundary = output.length - 1
    len += 1
  }

  if (lastBoundary >= 4) {
    return output.slice(0, lastBoundary).trim()
  }
  return output.trim()
}

function uniqueList(items = []) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const text = cleanPhrase(item)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

function splitPhrases(value = '') {
  return uniqueList(
    normalizeText(value)
      .split(/[\n,，。！？!?；;：:|/]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function stripProductNameNoise(value = '') {
  let text = normalizeText(value)
    .replace(/\n?\s*商品\s*ID\s*[:：]?\s*[\s\S]*/i, '')
    .replace(/\n?\s*预览\s*$/i, '')
    .replace(/^\d{2,4}(?:年)?/, '')
    .trim()

  let changed = true
  while (changed && text) {
    changed = false
    for (const suffix of PRODUCT_NAME_SUFFIXES) {
      if (text.endsWith(suffix)) {
        text = text.slice(0, -suffix.length).trim()
        changed = true
      }
    }
  }

  return text
}

function pickCandidate(candidates = [], minLen = 8, maxLen = 18) {
  const list = uniqueList(candidates)
  const inRange = list.find((item) => {
    const len = measureLen(item)
    return len >= minLen && len <= maxLen
  })
  if (inRange) return inRange

  const shorter = list.find((item) => measureLen(item) >= Math.max(4, minLen - 2))
  if (shorter && measureLen(shorter) <= maxLen) return shorter

  const longer = list.find((item) => measureLen(item) > maxLen)
  if (longer) return trimToSemanticBoundary(longer, maxLen)

  return list[0] || ''
}

function buildTitleCandidates({ title = '', productName = '', sellingPoints = '' }) {
  const cleanTitle = cleanPhrase(title).replace(COVER_BAD_ENDINGS, '').trim()
  const cleanName = stripProductNameNoise(productName)
  const candidates = [
    ...splitPhrases(cleanTitle),
    cleanTitle,
    ...splitPhrases(cleanName),
    cleanName,
    ...splitPhrases(sellingPoints),
  ]

  return uniqueList(candidates)
    .map((item) => trimToSemanticBoundary(item, 18))
    .filter(Boolean)
}

function buildSubtitleCandidates({ sellingPoints = '', content = '' }) {
  const normalizedSellingPoints = normalizeText(sellingPoints)
  const contentLines = normalizeText(content)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)

  const contentCandidates = contentLines
    .flatMap((line) => splitPhrases(line))
    .filter((item) => !COVER_BAD_ENDINGS.test(item))

  const candidates = [
    ...splitPhrases(normalizedSellingPoints),
    normalizedSellingPoints,
    ...contentCandidates,
  ]

  return uniqueList(candidates)
    .map((item) => trimToSemanticBoundary(item, 15))
    .filter((item) => item && measureLen(item) >= 4)
}

export function buildAutoCoverCopy({ title = '', content = '', productName = '', sellingPoints = '' } = {}) {
  const titleCandidates = buildTitleCandidates({ title, productName, sellingPoints })
  const subtitleCandidates = buildSubtitleCandidates({ sellingPoints, content })

  const coverTitle =
    pickCandidate(titleCandidates, 8, 18) ||
    trimToSemanticBoundary(stripProductNameNoise(productName), 18) ||
    trimToSemanticBoundary(cleanPhrase(title), 18) ||
    '备考重点'

  const coverSubtitle =
    pickCandidate(subtitleCandidates, 6, 15) ||
    ''

  return {
    coverTitle,
    coverSubtitle,
  }
}
