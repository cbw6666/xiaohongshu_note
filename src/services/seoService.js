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

const TAG_FILLER_SUFFIX = ['notes', 'tips', 'guide', 'method', 'share', 'summary', 'plan', 'template', 'checklist', 'review']

function normalizeWord(value) {
  return String(value || '')
    .replace(/^#/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueWords(words = []) {
  const out = []
  const seen = new Set()
  for (const raw of words) {
    const word = normalizeWord(raw)
    if (!word || seen.has(word)) continue
    seen.add(word)
    out.push(word)
  }
  return out
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

  return {
    word,
    weight,
    locked: Boolean(item.locked),
  }
}

function normalizeKeywordPool(pool, fallback = [], fallbackWeight = 1) {
  const parsedPool = Array.isArray(pool) ? pool : []
  const merged = [...fallback, ...parsedPool]
    .map((item) => normalizeKeywordItem(item, fallbackWeight))
    .filter(Boolean)

  const map = new Map()
  merged.forEach((item) => {
    if (!map.has(item.word)) {
      map.set(item.word, item)
      return
    }
    const prev = map.get(item.word)
    map.set(item.word, {
      word: item.word,
      weight: Math.max(prev.weight, item.weight),
      locked: prev.locked || item.locked,
    })
  })

  return [...map.values()]
}

function extractTags(input) {
  if (Array.isArray(input)) return uniqueWords(input)
  return uniqueWords(
    String(input || '')
      .split(/[\s,，]+/)
      .filter(Boolean),
  )
}

function byWeightDesc(a, b) {
  if (b.weight !== a.weight) return b.weight - a.weight
  return a.word.localeCompare(b.word, 'zh-Hans-CN')
}

function chooseKeywordFromPool(pool, noteIndex, excluded = []) {
  const excludedSet = new Set(excluded.map(normalizeWord).filter(Boolean))
  const candidates = pool.filter((item) => item.word && !excludedSet.has(item.word))
  if (candidates.length === 0) return ''

  const locked = candidates.filter((item) => item.locked).sort(byWeightDesc)
  if (locked.length > 0) {
    return locked[noteIndex % locked.length].word
  }

  const sorted = [...candidates].sort(byWeightDesc)
  const weighted = []
  sorted.forEach((item) => {
    const repeat = Math.max(1, Math.round(item.weight * 2))
    for (let i = 0; i < repeat; i++) weighted.push(item.word)
  })

  const stableList = uniqueWords(weighted.length > 0 ? weighted : sorted.map((item) => item.word))
  return stableList.length > 0 ? stableList[noteIndex % stableList.length] : ''
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  for (const ch of text) {
    const size = ch.codePointAt(0) > 0xffff ? 2 : 1
    if (used + size > maxLen) break
    out += ch
    used += size
  }
  return out
}

function getKeywordIndexes(text, keyword) {
  const indexes = []
  if (!text || !keyword) return indexes
  let start = 0
  while (start < text.length) {
    const index = text.indexOf(keyword, start)
    if (index < 0) break
    indexes.push(index)
    start = index + keyword.length
  }
  return indexes
}

function countKeyword(text, keyword) {
  return getKeywordIndexes(text, keyword).length
}

function replaceKeywordAt(text, index, keyword, replacement) {
  return `${text.slice(0, index)}${replacement}${text.slice(index + keyword.length)}`
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

export function normalizeSeoConfig(rawConfig = {}, product = {}) {
  const source = rawConfig || {}
  const seedKeyword = normalizeWord(source.seedKeyword)
  const coreKeyword = normalizeWord(source.coreKeyword || seedKeyword)

  const longTailKeywords = uniqueWords(source.longTailKeywords || [])
  const keywordPools = source.keywordPools || {}

  const normalizedCorePool = normalizeKeywordPool(
    keywordPools.core,
    coreKeyword ? [{ word: coreKeyword, weight: 3, locked: true }] : [],
    2,
  )
  const normalizedScenePool = normalizeKeywordPool(keywordPools.scene, [], 1.2)
  const normalizedLongTailPool = normalizeKeywordPool(
    keywordPools.longTail,
    longTailKeywords.map((word) => ({ word, weight: 1.5, locked: false })),
    1.5,
  )

  const requiredTags = extractTags(source.requiredTags)
  const extendedTags = extractTags(source.extendedTags)

  const enabledPositions = {
    ...DEFAULT_ENABLED_POSITIONS,
    ...(source.enabledPositions || {}),
  }

  const antiStuffing = mergeAntiStuffing(source.antiStuffing)

  return {
    mode: source.mode || 'direct',
    seedKeyword,
    coreKeyword,
    longTailKeywords,
    keywordPools: {
      core: normalizedCorePool,
      scene: normalizedScenePool,
      longTail: normalizedLongTailPool,
    },
    requiredTags,
    extendedTags,
    enabledPositions,
    antiStuffing,
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
      cfg.longTailKeywords.length > 0 ||
      cfg.requiredTags.length > 0 ||
      cfg.extendedTags.length > 0 ||
      cfg.keywordPools.core.length > 0 ||
      cfg.keywordPools.scene.length > 0 ||
      cfg.keywordPools.longTail.length > 0,
  )
}

function buildTagSet(plan, existingTagsText = '') {
  const existingTags = extractTags(existingTagsText)
  const required = plan.config.requiredTags
  const extended = plan.config.extendedTags
  const fromPools = uniqueWords([
    ...plan.selectedKeywords,
    ...plan.config.longTailKeywords,
    ...plan.config.keywordPools.scene.map((item) => item.word),
    ...plan.config.keywordPools.longTail.map((item) => item.word),
  ])

  const ordered = uniqueWords([...required, ...extended, ...fromPools, ...existingTags])

  if (ordered.length < 10 && plan.coreKeyword) {
    for (let i = 0; ordered.length < 10 && i < TAG_FILLER_SUFFIX.length; i++) {
      const candidate = `${plan.coreKeyword}${TAG_FILLER_SUFFIX[i]}`
      if (!ordered.includes(candidate)) ordered.push(candidate)
    }
  }

  let autoIndex = 1
  while (ordered.length < 10) {
    const fallback = plan.coreKeyword ? `${plan.coreKeyword}_tag_${autoIndex}` : `tag_${autoIndex}`
    if (!ordered.includes(fallback)) ordered.push(fallback)
    autoIndex++
  }

  return ordered.slice(0, 10)
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

  const sceneKeyword = chooseKeywordFromPool(config.keywordPools.scene, noteIndex, [coreKeyword])
  const longTailKeyword = chooseKeywordFromPool(config.keywordPools.longTail, noteIndex, [coreKeyword, sceneKeyword])

  const titleMaxKeywordCount = config.antiStuffing.titleMaxKeywordCount
  const selectedKeywords = uniqueWords([coreKeyword, sceneKeyword, longTailKeyword])
  const titleKeywords = selectedKeywords.slice(0, Math.max(1, titleMaxKeywordCount))
  const bodyKeywords = uniqueWords([coreKeyword, ...selectedKeywords.slice(1)])

  const lockedKeywords = uniqueWords([
    coreKeyword,
    ...config.keywordPools.core.filter((item) => item.locked).map((item) => item.word),
    ...config.keywordPools.scene.filter((item) => item.locked).map((item) => item.word),
    ...config.keywordPools.longTail.filter((item) => item.locked).map((item) => item.word),
  ])

  return {
    config,
    coreKeyword,
    selectedKeywords,
    titleKeywords,
    bodyKeywords,
    lockedKeywords,
    suggestedTags: buildTagSet({ config, coreKeyword, selectedKeywords }, ''),
  }
}

export function getProtectedKeywords(plan) {
  if (!plan) return []
  return uniqueWords([
    ...plan.lockedKeywords,
    ...plan.titleKeywords,
    ...plan.bodyKeywords,
    ...plan.config.requiredTags,
    ...plan.config.extendedTags,
  ])
}

export function buildSeoPromptSection(plan) {
  if (!plan) return ''

  const titleKeywords = uniqueWords(plan.titleKeywords).slice(0, plan.config.antiStuffing.titleMaxKeywordCount)
  const bodyKeywords = uniqueWords(plan.bodyKeywords)
  const tags = uniqueWords(plan.suggestedTags).slice(0, 10)

  return `
--- SEO rules (inject naturally, keep original style) ---
Title:
- core keyword must be in first 10 chars: ${plan.coreKeyword}
- preferred title keywords: ${titleKeywords.join(', ') || plan.coreKeyword}
- title length must be <= 20

Body:
- core keyword total occurrence: 3-5
- distribute to intro/middle/ending naturally
- preferred body keywords: ${bodyKeywords.join(', ') || plan.coreKeyword}

Tags:
- exactly 10 tags
- required tags first, then extended tags
- preferred tags: ${tags.join(', ')}

Anti-stuffing:
- max title keyword count: ${plan.config.antiStuffing.titleMaxKeywordCount}
- max repeat per keyword in body: ${plan.config.antiStuffing.bodyMaxRepeatPerWord}
- no adjacent duplicate keywords: ${plan.config.antiStuffing.noAdjacentDuplicate ? 'yes' : 'no'}
- min gap between same keyword: ${plan.config.antiStuffing.minKeywordGapChars}

Conflict handling:
- user custom prompt has higher priority
- keep minimum seo constraints: core keyword presence + title <= 20
`.trim()
}

export function buildRetitleSeoPromptSection(plan) {
  if (!plan) return ''
  const titleKeywords = uniqueWords(plan.titleKeywords).slice(0, plan.config.antiStuffing.titleMaxKeywordCount)
  return `
SEO title hard rules:
- core keyword in first 10 chars: ${plan.coreKeyword}
- preferred title keywords: ${titleKeywords.join(', ') || plan.coreKeyword}
- title length <= 20
- keep original writing tone
`.trim()
}

function enforceTitleKeywords(title, plan, maxLen = 20) {
  if (!plan) return truncateByLen(title || '', maxLen)

  let nextTitle = String(title || '').trim()
  const coreKeyword = plan.coreKeyword
  const keywordLimit = plan.config.antiStuffing.titleMaxKeywordCount
  const preferredKeywords = uniqueWords(plan.titleKeywords).slice(0, Math.max(1, keywordLimit))

  if (!nextTitle) nextTitle = coreKeyword
  if (!nextTitle.includes(coreKeyword)) {
    nextTitle = `${coreKeyword} ${nextTitle}`.trim()
  }

  const coreIndex = nextTitle.indexOf(coreKeyword)
  if (coreIndex > 10) {
    nextTitle = nextTitle.replace(coreKeyword, '').replace(/\s+/g, ' ').trim()
    nextTitle = `${coreKeyword} ${nextTitle}`.trim()
  }

  for (const keyword of preferredKeywords) {
    if (!keyword || keyword === coreKeyword) continue
    if (nextTitle.includes(keyword)) continue
    const candidate = `${nextTitle} ${keyword}`.trim()
    if (calcTextLen(candidate) <= maxLen) {
      nextTitle = candidate
    }
  }

  const existsKeywords = preferredKeywords.filter((keyword) => keyword && nextTitle.includes(keyword))
  if (existsKeywords.length > keywordLimit) {
    const removable = existsKeywords.slice(keywordLimit)
    removable.forEach((keyword) => {
      if (keyword === coreKeyword) return
      nextTitle = nextTitle.replace(keyword, '').replace(/\s+/g, ' ').trim()
    })
  }

  nextTitle = truncateByLen(nextTitle, maxLen)
  if (!nextTitle.includes(coreKeyword)) {
    const fallback = truncateByLen(`${coreKeyword} ${nextTitle}`.trim(), maxLen)
    nextTitle = fallback.includes(coreKeyword) ? fallback : truncateByLen(coreKeyword, maxLen)
  }

  return nextTitle
}

function enforceBodyKeywordDistribution(content, plan) {
  if (!plan) return content

  let text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) return text

  const { enabledPositions, antiStuffing } = plan.config
  const coreKeyword = plan.coreKeyword
  const altKeywords = plan.bodyKeywords.filter((word) => word && word !== coreKeyword)
  const getAlt = (index = 0) => altKeywords[index % Math.max(1, altKeywords.length)] || coreKeyword

  let paragraphs = text.split('\n')
  const getNonEmptyIndexes = () => paragraphs.map((line, idx) => (line.trim() ? idx : -1)).filter((idx) => idx >= 0)

  let nonEmptyIndexes = getNonEmptyIndexes()
  if (nonEmptyIndexes.length === 0) {
    paragraphs = [text]
    nonEmptyIndexes = [0]
  }

  const introIndex = nonEmptyIndexes[0]
  const middleIndex = nonEmptyIndexes[Math.floor(nonEmptyIndexes.length / 2)]
  const endingIndex = nonEmptyIndexes[nonEmptyIndexes.length - 1]

  const appendKeywordToParagraph = (paragraphIndex, keyword) => {
    if (paragraphIndex === undefined || paragraphIndex < 0 || !paragraphs[paragraphIndex]) return
    if (paragraphs[paragraphIndex].includes(keyword)) return

    const line = paragraphs[paragraphIndex].trim()
    const needsComma = line && !/[。！？!?]$/.test(line)
    paragraphs[paragraphIndex] = needsComma ? `${line}，${keyword}` : `${line} ${keyword}`
  }

  let coreCount = countKeyword(paragraphs.join('\n'), coreKeyword)

  if (enabledPositions.intro && coreCount < 3) {
    appendKeywordToParagraph(introIndex, coreKeyword)
    coreCount = countKeyword(paragraphs.join('\n'), coreKeyword)
  }
  if (enabledPositions.middle && coreCount < 3) {
    appendKeywordToParagraph(middleIndex, coreKeyword)
    coreCount = countKeyword(paragraphs.join('\n'), coreKeyword)
  }
  if (enabledPositions.ending && coreCount < 3) {
    appendKeywordToParagraph(endingIndex, coreKeyword)
    coreCount = countKeyword(paragraphs.join('\n'), coreKeyword)
  }

  while (coreCount < 3) {
    appendKeywordToParagraph(endingIndex, coreKeyword)
    const merged = paragraphs.join('\n')
    const nextCount = countKeyword(merged, coreKeyword)
    if (nextCount === coreCount) break
    coreCount = nextCount
  }

  let mergedText = paragraphs.join('\n')
  const wordsToCheck = uniqueWords([coreKeyword, ...altKeywords])

  wordsToCheck.forEach((keyword) => {
    if (!keyword) return

    const maxRepeat = antiStuffing.bodyMaxRepeatPerWord
    let indexes = getKeywordIndexes(mergedText, keyword)

    while (indexes.length > maxRepeat) {
      const idx = indexes[indexes.length - 1]
      const replacement = altKeywords.find((word) => word && word !== keyword) || ''
      mergedText = replacement
        ? replaceKeywordAt(mergedText, idx, keyword, replacement)
        : replaceKeywordAt(mergedText, idx, keyword, '')
      indexes = getKeywordIndexes(mergedText, keyword)
    }

    if (antiStuffing.noAdjacentDuplicate) {
      const adjacentPattern = new RegExp(`(${escapeRegExp(keyword)})(\\s*[^\\w\\s]?\\s*)(${escapeRegExp(keyword)})`, 'g')
      const replacement = altKeywords.find((word) => word && word !== keyword) || keyword
      mergedText = mergedText.replace(adjacentPattern, (_, first, split) => `${first}${split}${replacement}`)
    }

    if (antiStuffing.minKeywordGapChars > 0) {
      let nextIndexes = getKeywordIndexes(mergedText, keyword)
      let changed = true
      while (changed) {
        changed = false
        for (let i = 1; i < nextIndexes.length; i++) {
          if (nextIndexes[i] - nextIndexes[i - 1] >= antiStuffing.minKeywordGapChars) continue
          const replacement = getAlt(i)
          mergedText = replacement && replacement !== keyword
            ? replaceKeywordAt(mergedText, nextIndexes[i], keyword, replacement)
            : replaceKeywordAt(mergedText, nextIndexes[i], keyword, '')
          nextIndexes = getKeywordIndexes(mergedText, keyword)
          changed = true
          break
        }
      }
    }
  })

  return mergedText
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function enforceTagList(tags, plan) {
  if (!plan || !plan.config.enabledPositions.tags) return tags
  const tagSet = buildTagSet(plan, tags)
  return tagSet.slice(0, 10).map((tag) => `#${tag}`).join(' ')
}

function enforceCoverTitle(coverTitle, plan) {
  if (!plan) return coverTitle
  const title = String(coverTitle || '').trim()
  if (!title) return plan.coreKeyword
  if (title.includes(plan.coreKeyword)) return title
  return truncateByLen(`${plan.coreKeyword} ${title}`.trim(), 18)
}

export function enforceSeoResult(note, plan) {
  if (!plan) return note
  return {
    ...note,
    title: enforceTitleKeywords(note.title || '', plan, 20),
    content: enforceBodyKeywordDistribution(note.content || '', plan),
    tags: enforceTagList(note.tags || '', plan),
    coverTitle: enforceCoverTitle(note.coverTitle || '', plan),
  }
}
