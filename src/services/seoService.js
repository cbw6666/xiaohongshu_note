const DEFAULT_ENABLED_POSITIONS = {
  title: true,
  intro: true,
  middle: true,
  ending: true,
  tags: true,
}

const DEFAULT_ANTI_STUFFING = {
  titleMaxKeywordCount: 2,
  bodyMaxRepeatPerWord: 3,
  minKeywordGapChars: 12,
  noAdjacentDuplicate: true,
}

const TITLE_INTENT_TOKENS = [
  '备考攻略',
  '怎么备考',
  '历年真题',
  '答案模板',
  '答题技巧',
  '电子版资料',
  '专项训练',
  '训练题',
  '备考',
  '攻略',
  '真题',
  '模板',
  '题型',
  '技巧',
  '资料',
  '电子版',
  '训练',
  '公式',
  '提高',
  '提升',
  '冲刺',
  '复习',
  '重点',
  '考点',
  '知识点',
  '题库',
  '案例',
  '中级',
  '高级',
  '初级',
  '项目管理师',
  '工程师',
]

const BODY_INTENT_TOKENS = [
  ...TITLE_INTENT_TOKENS,
  '推荐',
  '总结',
  '解析',
  '经验',
  '笔记',
  '资料包',
  '练习',
]

const WEAK_INTENT_PATTERNS = [
  /报名/,
  /时间/,
  /入口/,
  /条件/,
  /费用/,
  /价格/,
  /哪个老师/,
  /老师的课/,
  /哪个好考/,
  /好考吗/,
  /难不难/,
  /难吗/,
  /入户/,
  /挂靠/,
  /工资/,
  /薪资/,
  /待遇/,
  /前景/,
  /含金量/,
  /培训/,
  /机构/,
]

const FRAGMENT_TAIL_TOKENS = [
  '项目管理师中级',
  '项目管理工程师',
  '备考攻略',
  '怎么备考',
  '历年真题',
  '答案模板',
  '答题技巧',
  '电子版资料',
  '专项训练',
  '训练题',
  '报名时间',
  '哪个老师的课好',
  '哪个好考',
  '备考',
  '攻略',
  '真题',
  '模板',
  '题型',
  '技巧',
  '资料',
  '训练',
  '公式',
  '提高',
  '中级',
  '高级',
  '初级',
]

const GENERIC_TAG_FALLBACKS = ['资料', '模板', '真题', '技巧', '攻略', '题型', '备考']

const NOISE_FRAGMENTS = new Set(['推荐', '教程', '经验', '总结', '大全', '合集', '干货', '收藏', '分享'])

const GENERIC_SINGLE_FRAGMENTS = new Set([
  '怎么',
  '备考',
  '攻略',
  '中级',
  '高级',
  '初级',
  '真题',
  '模板',
  '题型',
  '技巧',
  '资料',
  '训练',
  '公式',
  '提高',
  '提升',
])

function normalizeWord(value) {
  return String(value || '')
    .replace(/^#/, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactWord(value) {
  return normalizeWord(value).replace(/\s+/g, '')
}

function uniqueWords(words = []) {
  const out = []
  const seen = new Set()
  for (const raw of words) {
    const word = normalizeWord(raw)
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
  }
  return out
}

function extractPhraseList(input) {
  if (Array.isArray(input)) {
    return uniqueWords(
      input.flatMap((item) => {
        if (typeof item === 'string') return extractPhraseList(item)
        if (item?.word) return [item.word]
        return []
      }),
    )
  }

  return uniqueWords(
    String(input || '')
      .split(/\r?\n|[,，；;]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function extractTags(input) {
  if (Array.isArray(input)) return uniqueWords(input.map((item) => compactWord(item)))
  return uniqueWords(
    String(input || '')
      .split(/[\s,，；;]+/)
      .map((item) => compactWord(item))
      .filter(Boolean),
  )
}

function normalizeKeywordItem(item, fallbackWeight = 1) {
  if (!item) return null
  if (typeof item === 'string') {
    const word = normalizeWord(item)
    return word ? { word, weight: fallbackWeight, locked: false } : null
  }

  const word = normalizeWord(item.word)
  if (!word) return null

  const parsedWeight = Number(item.weight)
  const weight = Number.isFinite(parsedWeight) ? Math.max(0.1, Math.min(10, parsedWeight)) : fallbackWeight
  return { word, weight, locked: Boolean(item.locked) }
}

function byWeightDesc(a, b) {
  if (b.weight !== a.weight) return b.weight - a.weight
  return a.word.localeCompare(b.word, 'zh-Hans-CN')
}

function normalizeKeywordPool(pool, fallback = [], fallbackWeight = 1) {
  const parsedPool = Array.isArray(pool) ? pool : []
  const merged = [...fallback, ...parsedPool]
    .map((item) => normalizeKeywordItem(item, fallbackWeight))
    .filter(Boolean)

  const map = new Map()
  merged.forEach((item) => {
    const key = item.word.toLowerCase()
    const prev = map.get(key)
    if (!prev) {
      map.set(key, item)
      return
    }
    map.set(key, {
      word: item.word,
      weight: Math.max(prev.weight, item.weight),
      locked: prev.locked || item.locked,
    })
  })

  return [...map.values()].sort(byWeightDesc)
}

function chooseKeywordsFromPool(pool, count = 1, noteIndex = 0, excluded = []) {
  const excludedSet = new Set(excluded.map((item) => normalizeWord(item).toLowerCase()).filter(Boolean))
  const candidates = (Array.isArray(pool) ? pool : []).filter((item) => item.word && !excludedSet.has(item.word.toLowerCase()))
  if (candidates.length === 0 || count <= 0) return []

  const locked = candidates.filter((item) => item.locked).sort(byWeightDesc)
  const unlocked = candidates.filter((item) => !item.locked).sort(byWeightDesc)
  const ordered = [...locked, ...unlocked]
  const out = []
  const seen = new Set()
  const start = noteIndex % Math.max(1, ordered.length)

  for (let step = 0; step < ordered.length && out.length < count; step += 1) {
    const item = ordered[(start + step) % ordered.length]
    const key = item.word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item.word)
  }

  return out
}

function chooseKeywordFromPool(pool, noteIndex, excluded = []) {
  return chooseKeywordsFromPool(pool, 1, noteIndex, excluded)[0] || ''
}

function calcTextLen(text) {
  let len = 0
  for (const ch of String(text || '')) {
    len += ch.codePointAt(0) > 0xffff ? 2 : 1
  }
  return len
}

function truncateByLen(text, maxLen) {
  if (!text) return ''
  let out = ''
  let used = 0
  for (const ch of String(text || '')) {
    const size = ch.codePointAt(0) > 0xffff ? 2 : 1
    if (used + size > maxLen) break
    out += ch
    used += size
  }
  return out
}

function mergeAntiStuffing(rawAntiStuffing = {}) {
  return {
    titleMaxKeywordCount: Math.max(
      1,
      Math.min(4, Number(rawAntiStuffing.titleMaxKeywordCount) || DEFAULT_ANTI_STUFFING.titleMaxKeywordCount),
    ),
    bodyMaxRepeatPerWord: Math.max(
      1,
      Math.min(6, Number(rawAntiStuffing.bodyMaxRepeatPerWord) || DEFAULT_ANTI_STUFFING.bodyMaxRepeatPerWord),
    ),
    minKeywordGapChars: Math.max(
      0,
      Math.min(80, Number(rawAntiStuffing.minKeywordGapChars) || DEFAULT_ANTI_STUFFING.minKeywordGapChars),
    ),
    noAdjacentDuplicate:
      rawAntiStuffing.noAdjacentDuplicate === undefined
        ? DEFAULT_ANTI_STUFFING.noAdjacentDuplicate
        : Boolean(rawAntiStuffing.noAdjacentDuplicate),
  }
}

function containsAnyToken(text, tokens = []) {
  return tokens.some((token) => token && String(text || '').includes(token))
}

function isGenericSingleFragment(word) {
  return GENERIC_SINGLE_FRAGMENTS.has(compactWord(word))
}

function isWeakIntent(word) {
  return WEAK_INTENT_PATTERNS.some((pattern) => pattern.test(String(word || '')))
}

function isTitleIntent(word) {
  return TITLE_INTENT_TOKENS.some((token) => String(word || '').includes(token))
}

function isBodyIntent(word) {
  return BODY_INTENT_TOKENS.some((token) => String(word || '').includes(token))
}

function stripSeedPrefix(term, seedKeyword, coreKeyword) {
  const normalizedTerm = compactWord(term)
  const prefixes = uniqueWords([coreKeyword, seedKeyword])
    .map((item) => compactWord(item))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  for (const prefix of prefixes) {
    if (!normalizedTerm.startsWith(prefix)) continue
    const stripped = normalizedTerm.slice(prefix.length).replace(/^[的和与及\-—_/:：]+/, '').trim()
    if (stripped) return stripped
  }

  return normalizedTerm
}

function sanitizeFragment(word, seedKeyword, coreKeyword) {
  const compact = compactWord(word)
    .replace(/^[的和与及]+/, '')
    .replace(/[()（）【】[\]<>]/g, '')
    .replace(/^[\-—_/:：]+|[\-—_/:：]+$/g, '')
    .trim()

  if (!compact) return ''
  if (compact.length < 2 || compact.length > 14) return ''
  if (/^\d+$/.test(compact)) return ''
  if (compact === compactWord(seedKeyword) || compact === compactWord(coreKeyword)) return ''
  if (NOISE_FRAGMENTS.has(compact)) return ''
  return compact
}

function isLikelyFullSearchTerm(word, seedKeyword = '', coreKeyword = '') {
  const compact = compactWord(word)
  const seed = compactWord(seedKeyword)
  const core = compactWord(coreKeyword)
  if (!compact) return false
  if (isGenericSingleFragment(compact)) return false
  if (compact.length < 4) return false

  const hasAnchor = (seed && compact.includes(seed)) || (core && compact.includes(core))
  if (!hasAnchor) return false
  if (isWeakIntent(compact)) return compact.length >= 6
  return compact.length >= Math.max(4, Math.min(24, compactWord(core || seed).length + 2))
}

function collectFragment(map, rawWord, weight, seedKeyword, coreKeyword) {
  const word = sanitizeFragment(rawWord, seedKeyword, coreKeyword)
  if (!word) return
  const key = word.toLowerCase()
  const prev = map.get(key)
  if (!prev) {
    map.set(key, { word, weight, locked: false })
    return
  }
  prev.weight = Math.max(prev.weight, weight)
}

function extractFragmentsFromTerm(term, seedKeyword, coreKeyword) {
  const normalizedTerm = compactWord(term)
  const stripped = stripSeedPrefix(normalizedTerm, seedKeyword, coreKeyword)
  const candidates = []

  if (stripped && !isGenericSingleFragment(stripped)) {
    candidates.push({ word: stripped, weight: 2.6 })
  }

  if (!stripped || isWeakIntent(stripped)) return candidates

  const matchedToken = [...FRAGMENT_TAIL_TOKENS]
    .sort((a, b) => b.length - a.length)
    .find((token) => stripped.endsWith(token) && stripped !== token)

  if (!matchedToken) return candidates

  const head = stripped.slice(0, stripped.length - matchedToken.length)
  if (head && !isGenericSingleFragment(head)) {
    candidates.push({ word: head, weight: matchedToken.length >= 4 ? 2.2 : 1.8 })
  }
  if (!isGenericSingleFragment(matchedToken)) {
    candidates.push({ word: matchedToken, weight: isWeakIntent(matchedToken) ? 1.2 : 2.4 })
  }

  return candidates
}

function extractAutoFragments(rawSearchTerms = [], seedKeyword = '', coreKeyword = '') {
  const map = new Map()
  extractPhraseList(rawSearchTerms).forEach((term) => {
    extractFragmentsFromTerm(term, seedKeyword, coreKeyword).forEach((item) => {
      collectFragment(map, item.word, item.weight, seedKeyword, coreKeyword)
    })
  })
  return [...map.values()].sort(byWeightDesc)
}

function buildFragmentBuckets(autoFragments = []) {
  const title = []
  const body = []
  const tags = []
  const weak = []

  autoFragments.forEach((item) => {
    const word = normalizeWord(item.word)
    if (!word) return

    if (isWeakIntent(word)) {
      weak.push({ word, weight: item.weight + 0.4, locked: false })
      tags.push({ word, weight: item.weight, locked: false })
      return
    }

    if (isGenericSingleFragment(word)) return

    if (isTitleIntent(word)) {
      title.push({ word, weight: item.weight + 1.2, locked: false })
      body.push({ word, weight: item.weight + 0.8, locked: false })
      tags.push({ word, weight: item.weight + 0.6, locked: false })
      return
    }

    if (isBodyIntent(word) || word.length <= 8) {
      body.push({ word, weight: item.weight + 0.4, locked: false })
      tags.push({ word, weight: item.weight + 0.3, locked: false })
      if (word.length <= 8 && !containsAnyToken(word, ['报名', '时间', '老师', '入户'])) {
        title.push({ word, weight: item.weight, locked: false })
      }
      return
    }

    tags.push({ word, weight: item.weight, locked: false })
  })

  return {
    title: normalizeKeywordPool(title, [], 1.8),
    body: normalizeKeywordPool(body, [], 1.6),
    tags: normalizeKeywordPool(tags, [], 1.4),
    weak: normalizeKeywordPool(weak, [], 1.1),
  }
}

function getMatchedKeywords(text, keywords = []) {
  const source = String(text || '')
  return uniqueWords(keywords.filter((keyword) => keyword && source.includes(keyword)))
}

function getParagraphs(text = '') {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return normalized.length > 0 ? normalized : [String(text || '').trim()].filter(Boolean)
}

function deriveTagVariants(words = []) {
  const variants = []
  const tokens = uniqueWords([
    ...GENERIC_TAG_FALLBACKS,
    ...TITLE_INTENT_TOKENS,
    '项目管理师',
    '工程师',
    '中级',
    '高级',
    '初级',
  ]).sort((a, b) => b.length - a.length)

  words.forEach((word) => {
    const compact = compactWord(word)
    if (!compact) return

    tokens.forEach((token) => {
      if (compact !== token && compact.includes(token)) variants.push(token)
    })

    const levelMatch = compact.match(/(.+?)(中级|高级|初级)$/)
    if (levelMatch) variants.push(levelMatch[1], levelMatch[2])

    const intentMatch = compact.match(/(.+?)(备考攻略|怎么备考|真题|模板|题型|技巧|资料|攻略|备考|训练|公式|提高)$/)
    if (intentMatch) variants.push(intentMatch[1], intentMatch[2])
  })

  return uniqueWords(variants.map((item) => compactWord(item)))
}

function buildAllowedTagWords(plan) {
  const derivedFallbacks = GENERIC_TAG_FALLBACKS.filter((token) =>
    plan.config.autoFragments.some((item) => item.word.includes(token) || token.includes(item.word)),
  )
  const exactSearchTags = plan.config.rawSearchTerms.map((item) => compactWord(item))
  const derivedVariants = deriveTagVariants([
    ...plan.titleFragments,
    ...plan.bodyFragments,
    ...plan.tagFragments,
  ])

  return uniqueWords([
    ...plan.config.requiredTags,
    ...plan.config.extendedTags,
    plan.coreKeyword,
    ...exactSearchTags,
    ...plan.titleFragments,
    ...plan.bodyFragments,
    ...plan.tagFragments,
    ...derivedVariants,
    ...plan.weakTagFragments.slice(0, 2),
    ...derivedFallbacks,
  ]).map((item) => compactWord(item))
}

function buildTagSet(plan, existingTagsText = '') {
  const existingTags = extractTags(existingTagsText).map((item) => compactWord(item))
  const allowed = buildAllowedTagWords(plan)
  const exactSearchTags = plan.config.rawSearchTerms.map((item) => compactWord(item))
  const strongOrdered = uniqueWords([
    ...plan.config.requiredTags,
    plan.coreKeyword,
    ...exactSearchTags,
    ...plan.config.extendedTags,
    ...existingTags.filter((tag) => allowed.includes(tag)),
  ]).map((item) => compactWord(item))

  const fallbackOrdered = uniqueWords([
    ...plan.titleFragments,
    ...plan.bodyFragments,
    ...plan.tagFragments,
    ...deriveTagVariants([...plan.titleFragments, ...plan.bodyFragments, ...plan.tagFragments]),
  ]).map((item) => compactWord(item))

  const padded = [...strongOrdered]

  for (const token of fallbackOrdered) {
    if (padded.length >= 10) break
    const compact = compactWord(token)
    if (!compact || padded.includes(compact)) continue
    padded.push(compact)
  }

  for (const token of GENERIC_TAG_FALLBACKS.filter((item) => allowed.includes(compactWord(item)))) {
    if (padded.length >= 6) break
    const compact = compactWord(token)
    if (!padded.includes(compact)) padded.push(compact)
  }

  for (const token of plan.weakTagFragments.slice(0, 2)) {
    if (padded.length >= 6) break
    const compact = compactWord(token)
    if (!padded.includes(compact)) padded.push(compact)
  }

  for (const token of GENERIC_TAG_FALLBACKS) {
    if (padded.length >= 6) break
    const compact = compactWord(token)
    if (!padded.includes(compact)) padded.push(compact)
  }

  for (const token of GENERIC_TAG_FALLBACKS) {
    if (padded.length >= 6) break
    const candidate = compactWord(`${plan.coreKeyword}${token}`)
    if (!padded.includes(candidate)) padded.push(candidate)
  }

  return padded.slice(0, Math.min(10, Math.max(6, padded.length)))
}

export function normalizeSeoConfig(rawConfig = {}, product = {}) {
  const source = rawConfig || {}
  const seedKeyword = normalizeWord(source.seedKeyword)
  const coreKeyword = normalizeWord(source.coreKeyword || seedKeyword)
  const keywordPools = source.keywordPools || {}

  const explicitTerms = uniqueWords([
    ...extractPhraseList(source.rawSearchTerms),
    ...extractPhraseList(source.longTailKeywords),
  ]).filter((word) => isLikelyFullSearchTerm(word, seedKeyword, coreKeyword))

  const fallbackPoolTerms = (Array.isArray(keywordPools.longTail) ? keywordPools.longTail.map((item) => item?.word || '') : [])
    .map((word) => normalizeWord(word))
    .filter((word) => isLikelyFullSearchTerm(word, seedKeyword, coreKeyword))

  const rawSearchTerms = explicitTerms.length > 0 ? explicitTerms : uniqueWords(fallbackPoolTerms)
  const autoFragments = extractAutoFragments(rawSearchTerms, seedKeyword, coreKeyword)
  const fragmentBuckets = buildFragmentBuckets(autoFragments)

  return {
    mode: source.mode || 'direct',
    seedKeyword,
    coreKeyword,
    rawSearchTerms,
    autoFragments,
    fragmentBuckets,
    longTailKeywords: rawSearchTerms,
    keywordPools: {
      core: normalizeKeywordPool(
        keywordPools.core,
        coreKeyword ? [{ word: coreKeyword, weight: 3, locked: true }] : [],
        2,
      ),
      scene: normalizeKeywordPool(keywordPools.scene, [], 1.2),
      longTail: normalizeKeywordPool(keywordPools.longTail, autoFragments, 1.5),
    },
    requiredTags: extractTags(source.requiredTags),
    extendedTags: extractTags(source.extendedTags),
    enabledPositions: {
      ...DEFAULT_ENABLED_POSITIONS,
      ...(source.enabledPositions || {}),
    },
    antiStuffing: mergeAntiStuffing(source.antiStuffing),
    _productName: product.name || '',
  }
}

export function keywordPoolToText(pool = []) {
  return (Array.isArray(pool) ? pool : [])
    .filter((item) => item?.word)
    .map((item) => `${item.word}|${item.weight ?? 1}|${item.locked ? 1 : 0}`)
    .join('\n')
}

export function keywordTextToPool(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [wordRaw = '', weightRaw = '1', lockedRaw = '0'] = line.split('|').map((part) => part.trim())
      return normalizeKeywordItem(
        {
          word: wordRaw,
          weight: Number(weightRaw) || 1,
          locked: lockedRaw === '1' || /^true$/i.test(lockedRaw),
        },
        1,
      )
    })
    .filter(Boolean)
}

export function hasSeoRules(product) {
  const cfg = normalizeSeoConfig(product?.seoConfig || {}, product)
  return Boolean(
    cfg.seedKeyword ||
      cfg.coreKeyword ||
      cfg.rawSearchTerms.length > 0 ||
      cfg.autoFragments.length > 0 ||
      cfg.requiredTags.length > 0 ||
      cfg.extendedTags.length > 0 ||
      cfg.keywordPools.core.length > 0 ||
      cfg.keywordPools.scene.length > 0 ||
      cfg.keywordPools.longTail.length > 0,
  )
}

export function buildSeoPlan(product, noteIndex = 0) {
  const config = normalizeSeoConfig(product?.seoConfig || {}, product)
  if (!hasSeoRules(product)) return null

  const coreKeyword =
    chooseKeywordFromPool(config.keywordPools.core, noteIndex) ||
    config.coreKeyword ||
    config.seedKeyword ||
    ''

  if (!coreKeyword) return null

  const titlePool = config.fragmentBuckets.title.length > 0 ? config.fragmentBuckets.title : config.fragmentBuckets.body
  const bodyPool = config.fragmentBuckets.body.length > 0 ? config.fragmentBuckets.body : config.keywordPools.longTail
  const tagPool = config.fragmentBuckets.tags.length > 0 ? config.fragmentBuckets.tags : config.keywordPools.longTail
  const weakPool = config.fragmentBuckets.weak

  const strongTitlePool = titlePool.filter((item) => !isGenericSingleFragment(item.word))
  const strongBodyPool = bodyPool.filter((item) => !isWeakIntent(item.word) && !isGenericSingleFragment(item.word))
  const fallbackBodyPool = bodyPool.filter((item) => !isWeakIntent(item.word))
  const strongTagPool = tagPool.filter((item) => !isWeakIntent(item.word) && !isGenericSingleFragment(item.word))
  const fallbackTagPool = tagPool.filter((item) => !isWeakIntent(item.word))

  const titleFragments = chooseKeywordsFromPool(
    strongTitlePool.length > 0 ? strongTitlePool : titlePool,
    Math.min(2, Math.max(1, titlePool.length)),
    noteIndex,
    [coreKeyword],
  )

  const bodyFragments = uniqueWords([
    ...titleFragments,
    ...chooseKeywordsFromPool(
      strongBodyPool.length > 0 ? strongBodyPool : fallbackBodyPool,
      4,
      noteIndex + 1,
      [coreKeyword, ...titleFragments],
    ),
  ]).slice(0, 4)

  if (bodyFragments.length < 3) {
    bodyFragments.push(
      ...chooseKeywordsFromPool(
        fallbackBodyPool.length > 0 ? fallbackBodyPool : tagPool,
        5,
        noteIndex + 2,
        [coreKeyword, ...titleFragments, ...bodyFragments],
      ).slice(0, Math.max(0, 3 - bodyFragments.length)),
    )
  }

  const weakTagFragments = chooseKeywordsFromPool(weakPool, 2, noteIndex + 3, [coreKeyword, ...bodyFragments])
  const tagFragments = uniqueWords([
    ...titleFragments,
    ...bodyFragments,
    ...chooseKeywordsFromPool(
      strongTagPool.length > 0 ? strongTagPool : fallbackTagPool,
      8,
      noteIndex + 4,
      [coreKeyword, ...bodyFragments],
    ),
  ]).slice(0, 8)

  const plan = {
    noteIndex,
    config,
    coreKeyword,
    titleFragments,
    bodyFragments: uniqueWords(bodyFragments),
    tagFragments,
    weakTagFragments,
    selectedKeywords: uniqueWords([coreKeyword, ...titleFragments, ...bodyFragments]),
    titleKeywords: uniqueWords([coreKeyword, ...titleFragments]).slice(0, Math.max(2, config.antiStuffing.titleMaxKeywordCount)),
    bodyKeywords: uniqueWords([coreKeyword, ...bodyFragments]),
    lockedKeywords: uniqueWords([
      coreKeyword,
      ...config.keywordPools.core.filter((item) => item.locked).map((item) => item.word),
      ...config.keywordPools.scene.filter((item) => item.locked).map((item) => item.word),
      ...config.keywordPools.longTail.filter((item) => item.locked).map((item) => item.word),
    ]),
  }

  plan.suggestedTags = buildTagSet(plan, '')
  return plan
}

export function getProtectedKeywords(plan) {
  if (!plan) return []
  return uniqueWords([
    ...plan.lockedKeywords,
    ...plan.titleKeywords,
    ...plan.bodyKeywords,
    ...plan.suggestedTags,
    ...plan.config.requiredTags,
    ...plan.config.extendedTags,
  ])
}

export function buildSeoPromptSection(plan) {
  if (!plan) return ''

  return `
--- SEO text rules (write naturally, no meta SEO phrasing) ---
Title:
- core keyword must appear within the first 10 chars: ${plan.coreKeyword}
- include 1-2 high-intent search phrases: ${plan.titleFragments.join(', ') || plan.coreKeyword}
- title length must be <= 20
- avoid empty emotional-only titles
- avoid plain keyword stitching; keep a clear hook, contrast, warning, result, or question
- keep titles varied across notes instead of repeating the same sentence pattern

Body:
- within the first 2 sentences, naturally include the core keyword and at least 2 search phrases
- prioritize these search phrases in the body: ${plan.bodyFragments.join(', ') || plan.coreKeyword}
- cover at least 3 different search phrases across the full body
- mention the core keyword naturally 2-3 times, and reinforce it once near the ending
- do not use meta wording such as "围绕这些搜索点" or "下面继续覆盖这些关键词"

Tags:
- output 6-10 tags
- prioritize these tags: ${plan.suggestedTags.join(', ') || plan.coreKeyword}
- do not add unrelated hot tags
`.trim()
}

export function buildRetitleSeoPromptSection(plan) {
  if (!plan) return ''
  return `
SEO title hard rules:
- core keyword must appear within the first 10 chars: ${plan.coreKeyword}
- include at least 1 search phrase: ${plan.titleFragments.join(', ') || plan.coreKeyword}
- title length must be <= 20
- keep the tone natural
- avoid plain keyword stitching
- keep one clear hook or angle, and make the sentence pattern feel different from similar titles
`.trim()
}

function buildCompliantTitle(plan, originalTitle = '') {
  const fragments = uniqueWords(plan.titleFragments).slice(0, 2)
  const firstFragment = fragments[0] || ''
  let rebuilt = String(originalTitle || '').replace(/\r?\n/g, ' ').replace(/\s+/g, '').trim()
  const noteOffset = Math.abs(Number(plan.noteIndex) || 0)

  const fallbackPatterns = uniqueWords([
    firstFragment ? `${plan.coreKeyword}${firstFragment}别踩坑` : '',
    firstFragment ? `${plan.coreKeyword}${firstFragment}这样更稳` : '',
    firstFragment ? `${plan.coreKeyword}${firstFragment}怎么选` : '',
    firstFragment ? `${plan.coreKeyword}${firstFragment}有必要吗` : '',
    firstFragment ? `${plan.coreKeyword}：${firstFragment}` : '',
    firstFragment ? `${plan.coreKeyword}${firstFragment}` : '',
    plan.coreKeyword,
  ]).filter(Boolean)
  const orderedFallbacks = fallbackPatterns.map((_, index) => fallbackPatterns[(index + noteOffset) % fallbackPatterns.length])
  const pickFallback = () => orderedFallbacks.find((item) => item && calcTextLen(item) <= 20) || truncateByLen(plan.coreKeyword, 20)

  if (!rebuilt) {
    return pickFallback()
  }

  if (!rebuilt.includes(plan.coreKeyword)) {
    const prefixed = `${plan.coreKeyword}：${rebuilt}`
    rebuilt = calcTextLen(prefixed) <= 20 ? prefixed : `${plan.coreKeyword}${rebuilt}`
  }

  if (rebuilt.indexOf(plan.coreKeyword) > 10) {
    const withoutCore = rebuilt.replace(plan.coreKeyword, '').trim()
    const prefixed = `${plan.coreKeyword}：${withoutCore}`
    rebuilt = calcTextLen(prefixed) <= 20 ? prefixed : `${plan.coreKeyword}${withoutCore}`
  }

  if (firstFragment && !rebuilt.includes(firstFragment)) {
    const appended = `${rebuilt}，${firstFragment}`
    if (calcTextLen(appended) <= 20) {
      rebuilt = appended
    } else {
      rebuilt = pickFallback()
    }
  }

  rebuilt = truncateByLen(rebuilt, 20)
  if (!rebuilt) {
    rebuilt = pickFallback()
  }
  return rebuilt
}

function enforceTitleKeywords(title, plan, maxLen = 20) {
  if (!plan) return truncateByLen(title || '', maxLen)

  let nextTitle = String(title || '').replace(/\r?\n/g, ' ').replace(/\s+/g, '').trim()
  const hasCore = nextTitle.includes(plan.coreKeyword)
  const coreIndex = hasCore ? nextTitle.indexOf(plan.coreKeyword) : -1
  const matchedFragments = getMatchedKeywords(nextTitle, plan.titleFragments)

  if (!hasCore || coreIndex > 10 || matchedFragments.length < 1 || calcTextLen(nextTitle) > maxLen) {
    return buildCompliantTitle(plan, nextTitle)
  }

  return truncateByLen(nextTitle, maxLen)
}

function enforceBodyKeywordDistribution(content, plan) {
  if (!plan) return content
  const text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) return text

  return getParagraphs(text)
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function enforceTagList(tags, plan) {
  if (!plan || !plan.config.enabledPositions.tags) return tags
  return buildTagSet(plan, tags).map((tag) => `#${compactWord(tag)}`).join(' ')
}

export function enforceSeoResult(note, plan) {
  if (!plan) return note
  return {
    ...note,
    content: enforceBodyKeywordDistribution(note.content || '', plan),
    tags: enforceTagList(note.tags || '', plan),
    coverTitle: note.coverTitle || '',
  }
}

export function auditSeoTextResult(note, plan) {
  if (!plan) return { pass: true, issues: [], titleWarnings: [], metrics: {} }

  const title = String(note?.title || '').replace(/\s+/g, '').trim()
  const content = String(note?.content || '').trim()
  const tags = extractTags(note?.tags || '')
  const paragraphs = getParagraphs(content)
  const introText = paragraphs.slice(0, 2).join('\n')
  const endingText = paragraphs[paragraphs.length - 1] || ''
  const titleFragmentHits = getMatchedKeywords(title, plan.titleFragments)
  const introFragmentHits = getMatchedKeywords(introText, plan.bodyFragments)
  const bodyFragmentHits = getMatchedKeywords(content, plan.bodyFragments)
  const allowedTags = new Set(buildTagSet(plan, '').map((item) => compactWord(item)))
  const invalidTags = tags.filter((tag) => !allowedTags.has(compactWord(tag)))
  const issues = []
  const titleWarnings = []

  if (!title.includes(plan.coreKeyword)) {
    issues.push(`标题缺少核心词：${plan.coreKeyword}`)
  } else if (title.indexOf(plan.coreKeyword) > 10) {
    issues.push(`标题核心词没有前置到前10字：${plan.coreKeyword}`)
  }

  if (calcTextLen(title) > 20) {
    issues.push(`标题超过20字：当前 ${calcTextLen(title)} 字`)
  }

  if (titleFragmentHits.length < 1 && plan.titleFragments.length > 0) {
    issues.push(`标题缺少高意图搜索片段：${plan.titleFragments[0]}`)
  }

  titleWarnings.push(...issues)
  issues.length = 0

  if (!introText.includes(plan.coreKeyword) || introFragmentHits.length < Math.min(2, Math.max(1, plan.bodyFragments.length))) {
    issues.push('正文开头缺少“核心词 + 长尾片段”的自然组合句')
  }

  if (bodyFragmentHits.length < Math.min(3, Math.max(1, plan.bodyFragments.length))) {
    issues.push(`正文覆盖的搜索片段不足：当前 ${bodyFragmentHits.length} 个`)
  }

  if (!endingText.includes(plan.coreKeyword)) {
    issues.push(`正文结尾缺少核心词强化：${plan.coreKeyword}`)
  }

  if (tags.length < 6 || tags.length > 10) {
    issues.push(`标签数量不符合要求：当前 ${tags.length} 个`)
  }

  if (invalidTags.length > 0) {
    issues.push(`标签包含词池外内容：${invalidTags.join('、')}`)
  }

  return {
    pass: issues.length === 0,
    issues,
    titleWarnings,
    metrics: {
      titleLength: calcTextLen(title),
      titleCoreIndex: title.indexOf(plan.coreKeyword),
      titleFragmentHits,
      introFragmentHits,
      bodyFragmentHits,
      tagCount: tags.length,
      invalidTags,
    },
  }
}

export function buildSeoRepairPrompt(note, plan) {
  const audit = auditSeoTextResult(note, plan)
  const bodyFragments = plan.bodyFragments.join(', ') || plan.coreKeyword
  const tagFragments = buildTagSet(plan, '').join(', ') || plan.coreKeyword

  return [
    {
      role: 'system',
      content:
        'You rewrite only body and tags for XiaoHongShu SEO. Keep the style natural. Do not explain anything. Keep the title unchanged. Do not output any cover fields.',
    },
    {
      role: 'user',
      content: `Rewrite only the body and tags while keeping the original meaning and tone. Do not change the title.

Core keyword: ${plan.coreKeyword}
Preferred body phrases: ${bodyFragments}
Preferred tags: ${tagFragments}

Requirements:
1. Keep the title unchanged.
2. In the first 2 sentences of the body, naturally include the core keyword and at least 2 search phrases.
3. Cover at least 3 different search phrases across the body, and reinforce the core keyword once near the ending.
4. Output 6-10 tags and only use the provided search phrases or tags.
5. Do not use meta SEO phrasing such as "围绕这些搜索点" or "下面继续覆盖这些关键词". Write it like a normal natural post.

Current issues:
${audit.issues.length > 0 ? audit.issues.map((item, index) => `${index + 1}. ${item}`).join('\n') : 'None'}

Current title (keep as-is):
${note?.title || ''}
 
Current content:
---正文---
${note?.content || ''}
---标签---
${note?.tags || ''}

Output strictly in this format:
---正文---
rewritten body
---标签---
#标签1 #标签2 #标签3`,
    },
  ]
}
