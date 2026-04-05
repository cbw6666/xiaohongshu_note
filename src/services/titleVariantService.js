function sanitizeProductName(name = '') {
  return String(name || '')
    .replace(/\n?\s*商品\s*ID\s*[:：]?\s*[\s\S]*/i, '')
    .replace(/\n?\s*预览\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const TITLE_TERM_STOPWORDS = new Set([
  '攻略',
  '资料',
  '教程',
  '模板',
  '模版',
  '大全',
  '合集',
  '笔记',
  '真题',
  '题库',
  '汇总',
  '总结',
  '电子版',
  '打印版',
  '学习',
  '备考',
  '提分',
  '上岸',
  '速背',
  '速记',
  '重点',
  '高频',
  '精选',
  '最新',
  '新版',
  '全套',
  '完整',
  '必备',
  '冲刺',
  '干货',
  '收藏',
  '分享',
  '预览',
])

function normalizeTitleKey(title = '') {
  return String(title || '')
    .replace(/[\s,，。?!！？、:：;；"'“”‘’()（）【】[\]<>《》\-—~]/g, '')
    .toLowerCase()
}

function stripGenericProductSuffix(value = '') {
  let next = String(value || '').replace(/^\d{2,4}(?:年)?/, '').trim()
  let prev = ''

  while (next && prev !== next) {
    prev = next
    next = next
      .replace(/(资料大全|备考资料|学习资料|笔记模板|历年真题|真题模板|真题汇编|题库汇总|题库|汇总|总结|大全|模板|模版|资料|教程|课程|教材|讲义|笔记|电子版|打印版|冲刺卷|预测卷|五色笔记|三色笔记|四色笔记|预览)$/g, '')
      .trim()
  }

  return next
}

function extractTermCandidates(value = '') {
  return String(value || '')
    .split(/[\n\r,，。；;、|/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function explodeCompactNameTerms(value = '') {
  return String(value || '')
    .split(/(?:备考|学习|复习|资料|模板|模版|笔记|真题|题库|汇总|总结|大全|电子版|打印版|全套|冲刺|速记|速背|高频|专项|精选|最新|新版|历年|教材|讲义|题集|题本|宝典|题单|题包)+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function extractSpecializedNameTerms(value = '') {
  const text = String(value || '')
  const matches = new Set()
  const patterns = [
    /[\u4e00-\u9fa5A-Za-z]{2,}(项目管理师|项目管理工程师|统计师|工程师|教师|英语|语文|数学|面试|申论|行测|教资|事业编|公务员|系统集成|软考|高项|中项)/g,
    /(高项|中项|软考|教资|申论|行测|面试|英语|语文|数学|统计师|系统集成|学位英语)/g,
  ]

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      if (match?.[0]) matches.add(match[0])
    }
  })

  return [...matches]
}

function normalizeProductTerm(term = '') {
  return String(term || '')
    .replace(/^\d{2,4}(?:年)?/, '')
    .replace(/^(最新|新版|全套|完整|精选|冲刺|必备|高频|速记|速背)+/, '')
    .replace(/[【】[\]()（）]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function extractProductTitleTerms(product = {}) {
  const terms = []
  const addTerm = (value) => {
    const term = normalizeProductTerm(value)
    if (!term || term.length < 2) return
    if (TITLE_TERM_STOPWORDS.has(term)) return
    if (/^\d+$/.test(term)) return
    terms.push(term)
  }

  const cleanName = sanitizeProductName(product?.name || '')
  const strippedName = stripGenericProductSuffix(cleanName)

  addTerm(cleanName)
  addTerm(strippedName)
  extractTermCandidates(cleanName).forEach(addTerm)
  extractTermCandidates(strippedName).forEach(addTerm)
  explodeCompactNameTerms(cleanName).forEach(addTerm)
  explodeCompactNameTerms(strippedName).forEach(addTerm)
  extractSpecializedNameTerms(cleanName).forEach(addTerm)
  extractSpecializedNameTerms(strippedName).forEach(addTerm)
  extractTermCandidates(product?.sellingPoints || '').forEach(addTerm)
  extractTermCandidates(product?.description || '').forEach(addTerm)

  const seen = new Set()
  return terms
    .filter((term) => {
      const key = term.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.length - a.length)
}

function findMatchedProductTerm(product, title) {
  const normalizedTitle = normalizeTitleKey(title)
  return extractProductTitleTerms(product).find((term) => normalizedTitle.includes(normalizeTitleKey(term))) || ''
}

function createVariantId(prefix = 'title') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createBlankTitleVariant(prefix = 'manual') {
  return {
    id: createVariantId(prefix),
    title: '',
    formula: '',
    enabled: true,
    source: prefix,
    createdAt: new Date().toISOString(),
  }
}

export function normalizeTitleVariants(product = {}) {
  return (Array.isArray(product?.titleVariants) ? product.titleVariants : [])
    .map((item, index) => {
      const title = String(item?.title || '').trim()
      if (!title) return null
      return {
        id: item?.id || createVariantId(`title_${index}`),
        title,
        formula: String(item?.formula || '').trim(),
        enabled: item?.enabled !== false,
        source: String(item?.source || 'manual').trim() || 'manual',
        createdAt: item?.createdAt || new Date().toISOString(),
      }
    })
    .filter(Boolean)
}

export function appendTitleVariants(product = {}, items = []) {
  const current = normalizeTitleVariants(product)
  const incoming = (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: item?.id || createVariantId(`fission_${index}`),
      title: String(item?.title || '').trim(),
      formula: String(item?.formula || '').trim(),
      enabled: item?.enabled !== false,
      source: String(item?.source || 'fission').trim() || 'fission',
      createdAt: item?.createdAt || new Date().toISOString(),
    }))
    .filter((item) => item.title)

  const merged = [...current]
  const seen = new Set(current.map((item) => normalizeTitleKey(item.title)))

  incoming.forEach((item) => {
    const key = normalizeTitleKey(item.title)
    if (!key || seen.has(key)) return
    seen.add(key)
    merged.push(item)
  })

  return {
    ...product,
    titleVariants: merged,
    titleVariantMode: product?.titleVariantMode || 'prefer_pool',
    titleVariantCursor: Number.isFinite(Number(product?.titleVariantCursor)) ? Number(product.titleVariantCursor) : 0,
  }
}

export function pickTitleVariant(variants = [], index = 0) {
  const enabled = (Array.isArray(variants) ? variants : []).filter((item) => item && item.enabled !== false && String(item.title || '').trim())
  if (enabled.length === 0) return null
  const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0
  return enabled[((safeIndex % enabled.length) + enabled.length) % enabled.length]
}

export function validateTitleVariantAgainstProduct(product = {}, title = '') {
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) return { valid: false, matchedTerm: '', reason: '标题为空' }
  const matchedTerm = findMatchedProductTerm(product, cleanTitle)
  if (!matchedTerm) {
    return { valid: false, matchedTerm: '', reason: '未命中商品相关词' }
  }
  return { valid: true, matchedTerm, reason: '' }
}

