import { useEffect, useState, useRef } from 'react'
import { callAI, buildAnalysisPrompt } from '../services/aiService.js'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'
import CoverCanvas from './CoverCanvas.jsx'
import { keywordPoolToText, keywordTextToPool, normalizeSeoConfig } from '../services/seoService.js'

const splitWords = (input = '') =>
  String(input || '')
    .split(/[\r\n,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const splitPhraseLines = (input = '') =>
  String(input || '')
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean)

const joinWords = (list = []) => (Array.isArray(list) ? list.join('\n') : '')

const mergePreviewWords = (...groups) => {
  const seen = new Set()
  const merged = []
  groups.flat().forEach((word) => {
    const value = String(word || '').trim()
    if (!value || seen.has(value)) return
    seen.add(value)
    merged.push(value)
  })
  return merged
}

const buildSeoForm = (product) => {
  const seoConfig = normalizeSeoConfig(product?.seoConfig || {}, product)
  return {
    seedKeyword: seoConfig.seedKeyword || '',
    coreKeyword: seoConfig.coreKeyword || '',
    longTailKeywordsText: joinWords(
      Array.isArray(seoConfig.rawSearchTerms) && seoConfig.rawSearchTerms.length > 0
        ? seoConfig.rawSearchTerms
        : seoConfig.longTailKeywords,
    ),
    corePoolText: keywordPoolToText(seoConfig.keywordPools.core),
    scenePoolText: keywordPoolToText(seoConfig.keywordPools.scene),
    longTailPoolText: keywordPoolToText(seoConfig.keywordPools.longTail),
    requiredTagsText: joinWords(seoConfig.requiredTags),
    extendedTagsText: joinWords(seoConfig.extendedTags),
    titleEnabled: seoConfig.enabledPositions.title,
    introEnabled: seoConfig.enabledPositions.intro,
    middleEnabled: seoConfig.enabledPositions.middle,
    endingEnabled: seoConfig.enabledPositions.ending,
    tagsEnabled: seoConfig.enabledPositions.tags,
    titleMaxKeywordCount: seoConfig.antiStuffing.titleMaxKeywordCount,
    bodyMaxRepeatPerWord: seoConfig.antiStuffing.bodyMaxRepeatPerWord,
    minKeywordGapChars: seoConfig.antiStuffing.minKeywordGapChars,
    noAdjacentDuplicate: seoConfig.antiStuffing.noAdjacentDuplicate,
  }
}

const buildSeoPayload = (form) => ({
  mode: 'direct',
  seedKeyword: String(form.seedKeyword || '').trim(),
  coreKeyword: String(form.coreKeyword || '').trim(),
  rawSearchTerms: splitPhraseLines(form.longTailKeywordsText),
  longTailKeywords: splitPhraseLines(form.longTailKeywordsText),
  keywordPools: {
    core: keywordTextToPool(form.corePoolText),
    scene: keywordTextToPool(form.scenePoolText),
    longTail: keywordTextToPool(form.longTailPoolText),
  },
  requiredTags: splitWords(form.requiredTagsText),
  extendedTags: splitWords(form.extendedTagsText),
  enabledPositions: {
    title: Boolean(form.titleEnabled),
    intro: Boolean(form.introEnabled),
    middle: Boolean(form.middleEnabled),
    ending: Boolean(form.endingEnabled),
    tags: Boolean(form.tagsEnabled),
  },
  antiStuffing: {
    titleMaxKeywordCount: Number(form.titleMaxKeywordCount) || 2,
    bodyMaxRepeatPerWord: Number(form.bodyMaxRepeatPerWord) || 3,
    minKeywordGapChars: Number(form.minKeywordGapChars) || 12,
    noAdjacentDuplicate: Boolean(form.noAdjacentDuplicate),
  },
})

const XHS_SEO_SYNC_SOURCE = 'xhs-seo-keyword-sync'
const XHS_SEO_SYNC_CHANNEL = 'xhs-seo-keyword-sync'
const XHS_MAX_IMPORTED_KEYWORDS = 30
const XHS_SOURCE_SCORE_MAP = {
  suggest: 1.8,
  recommend: 1.5,
  trending: 1.5,
  manual: 1.5,
}
const XHS_ALLOWED_SEARCH_SOURCES = new Set(['suggest', 'recommend', 'trending', 'manual'])
const XHS_NOISE_KEYWORDS = new Set([
  'all', 'image', 'video', 'user', 'discover', 'follow', 'message', 'live', 'publish',
  'search', 'recommend', 'related', 'more', 'back', 'login', 'register', 'settings',
  'home', 'official', 'ad', 'note', 'default', 'first_enter', 'token', 'uuid', 'traceid',
])

const hasCjk = (input = '') => /[\u3400-\u9fff]/.test(String(input || ''))

const splitKeywordText = (input = '') =>
  String(input || '')
    .split(/\r?\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeKeywordWord = (raw = '') =>
  String(raw || '')
    .replace(/^[#＃]+/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\b(pdf|docx?|xlsx?|pptx?)$/i, '')
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeKeywordKey = (raw = '') => normalizeKeywordWord(raw).toLowerCase()

const isLikelyNoiseKeyword = (word = '', seedKeyword = '') => {
  if (!word) return true
  if (word.length < 2 || word.length > 40) return true
  const seedHasCjk = hasCjk(seedKeyword)
  if (seedHasCjk && !hasCjk(word)) return true
  if (/[，。！？；：,.!?]/.test(word)) return true
  if (/^\d+(?:\.\d+){1,}/.test(word)) return true
  if (/^\d+[、.)）]/.test(word)) return true
  if (/^\d+$/.test(word)) return true
  if (/^[a-f0-9]{4,}$/i.test(word)) return true
  if (/^[a-f0-9]{1,8}(?:-[a-f0-9]{1,8})+$/i.test(word)) return true
  if (/^[A-Z0-9_]{4,}$/.test(word)) return true
  if (/^[\W_]+$/.test(word)) return true
  if (/[{}<>:=]/.test(word) || word.includes('[') || word.includes(']')) return true
  if (/(其实|觉得|就是|真的|能考|就这|建议|如果|但是|因为|我们|你们|这个|那个|这样|那样)/.test(word)) return true
  if (XHS_NOISE_KEYWORDS.has(word.toLowerCase())) return true
  if (normalizeKeywordKey(word) === normalizeKeywordKey(seedKeyword)) return true
  if (/^(click|open|copy|paste|input|output|view|retry|confirm|cancel)$/i.test(word)) return true
  return false
}

const isAcceptableImportedKeyword = (word = '', seedKeyword = '') => {
  if (!word) return false
  if (word.length < 2 || word.length > 48) return false
  const seedHasCjk = hasCjk(seedKeyword)
  if (seedHasCjk && !hasCjk(word)) return false
  if (/^[\W_]+$/.test(word)) return false
  if (normalizeKeywordKey(word) === normalizeKeywordKey(seedKeyword)) return false
  return true
}

const pickSeoSeedKeyword = (seoForm, product) => {
  const fromForm = normalizeKeywordWord(seoForm?.seedKeyword || '')
  if (fromForm) return fromForm
  const fromCore = normalizeKeywordWord(seoForm?.coreKeyword || '')
  if (fromCore) return fromCore
  return normalizeKeywordWord(product?.name || '')
}

const sanitizeImportedKeywords = (payload = {}) => {
  const fallbackSeed = normalizeKeywordWord(payload?.seedKeyword || '')
  const rawList = Array.isArray(payload?.keywords) ? payload.keywords : []
  const unique = []

  rawList.forEach((item) => {
    const wordRaw = typeof item === 'string' ? item : item?.word
    const sourceRaw = typeof item === 'string' ? 'manual' : (item?.source || 'manual')
    const source = String(sourceRaw || 'manual').toLowerCase()
    const word = String(wordRaw || '').trim()
    if (!word) return
    const scoreDefault = XHS_SOURCE_SCORE_MAP[source] || XHS_SOURCE_SCORE_MAP.manual
    const parsedScore = Number(typeof item === 'string' ? NaN : item?.score)
    const score = Number.isFinite(parsedScore) ? Math.max(0.5, Math.min(3, parsedScore)) : scoreDefault
    unique.push({ word, source, score })
  })

  return {
    seedKeyword: fallbackSeed,
    keywords: unique.slice(0, XHS_MAX_IMPORTED_KEYWORDS),
  }
}

const mergeLongTailKeywordsText = (existingText = '', incomingKeywords = [], seedKeyword = '') => {
  const existingLines = splitKeywordText(existingText)
  const incomingLines = incomingKeywords
    .map((item) => String(item?.word || '').trim())
    .filter(Boolean)
  const merged = [...existingLines, ...incomingLines]
  const deduped = []
  const seen = new Set()
  merged.forEach((word) => {
    const key = normalizeKeywordKey(word)
    if (!key || seen.has(key)) return
    seen.add(key)
    deduped.push(word)
  })
  return deduped.join('\n')
}

const mergeLongTailPoolText = (existingPoolText = '', incomingKeywords = [], seedKeyword = '') => {
  const existingLines = String(existingPoolText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const incomingLinesRaw = incomingKeywords
    .map((item) => {
      const word = String(item?.word || '').trim()
      if (!word) return ''
      const targetWeight = Number.isFinite(Number(item?.score)) ? Number(item.score) : XHS_SOURCE_SCORE_MAP.manual
      const weight = Math.max(0.1, Math.min(10, targetWeight))
      return `${word}|${weight}|0`
    })
    .filter(Boolean)

  const deduped = []
  const seen = new Set()
  const appendPoolLine = (line) => {
    const rawWord = String(line || '').split('|')[0]?.trim() || ''
    const key = normalizeKeywordKey(rawWord)
    if (!key || seen.has(key)) return
    seen.add(key)
    deduped.push(line)
  }

  existingLines.forEach(appendPoolLine)
  incomingLinesRaw.forEach(appendPoolLine)
  return deduped.join('\n')
}

const normalizeImportedKeywordPayload = (parsed, fallbackSeed = '') => {
  if (Array.isArray(parsed)) {
    return { seedKeyword: fallbackSeed, keywords: parsed }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { seedKeyword: fallbackSeed, keywords: [] }
  }
  if (Array.isArray(parsed.keywords)) {
    return {
      seedKeyword: parsed.seedKeyword || fallbackSeed,
      keywords: parsed.keywords,
    }
  }
  if (parsed.data && Array.isArray(parsed.data.keywords)) {
    return {
      seedKeyword: parsed.data.seedKeyword || parsed.seedKeyword || fallbackSeed,
      keywords: parsed.data.keywords,
    }
  }
  if (Array.isArray(parsed.words)) {
    return {
      seedKeyword: parsed.seedKeyword || fallbackSeed,
      keywords: parsed.words,
    }
  }
  return { seedKeyword: parsed.seedKeyword || fallbackSeed, keywords: [] }
}

const findJsonBlock = (text = '', startIndex = 0) => {
  const raw = String(text || '')
  let start = -1
  for (let i = Math.max(0, startIndex); i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch === '{' || ch === '[') {
      start = i
      break
    }
  }
  if (start < 0) return ''

  const open = raw[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) {
      depth += 1
      continue
    }
    if (ch === close) {
      depth -= 1
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return ''
}

const parseSeoKeywordPayloadFromText = (rawText = '', fallbackSeed = '') => {
  const text = String(rawText || '').trim()
  if (!text) return normalizeImportedKeywordPayload({}, fallbackSeed)

  const attempts = []
  attempts.push(text)

  const markerRegex = /===\s*XHS SEO LONGTAIL JSON START\s*===([\s\S]*?)===\s*XHS SEO LONGTAIL JSON END\s*===/i
  const markerMatch = text.match(markerRegex)
  if (markerMatch?.[1]) {
    const marked = findJsonBlock(markerMatch[1], 0)
    if (marked) attempts.push(marked)
  }

  const packedIndex = text.indexOf('XHS_SEO_JSON=')
  if (packedIndex >= 0) {
    const packed = findJsonBlock(text, packedIndex + 'XHS_SEO_JSON='.length)
    if (packed) attempts.push(packed)
  }

  const firstJson = findJsonBlock(text, 0)
  if (firstJson) attempts.push(firstJson)

  for (const item of attempts) {
    try {
      const parsed = JSON.parse(item)
      return normalizeImportedKeywordPayload(parsed, fallbackSeed)
    } catch {
      // try next candidate
    }
  }

  throw new Error('无法识别JSON格式，请粘贴控制台打印的JSON对象')
}

const buildXhsKeywordSyncScript = (seedKeyword) => {
  const safeSeed = JSON.stringify(String(seedKeyword || ''))
  return `(function () {
  var SOURCE = '${XHS_SEO_SYNC_SOURCE}';
  var CHANNEL = '${XHS_SEO_SYNC_CHANNEL}';
  var MAX_COUNT = ${XHS_MAX_IMPORTED_KEYWORDS};
  var seedKeyword = ${safeSeed};

  function norm(raw) {
    return String(raw || '')
      .replace(/^[#＃]+/, '')
      .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  function keyOf(word) {
    return norm(word).toLowerCase();
  }

  function hasCjk(text) {
    return /[\\u4e00-\\u9fff]/.test(String(text || ''));
  }

  var stopWords = {
    all: 1, image: 1, video: 1, user: 1, discover: 1, follow: 1, message: 1, live: 1,
    publish: 1, search: 1, recommend: 1, related: 1, more: 1, back: 1, login: 1,
    register: 1, settings: 1, home: 1, official: 1, ad: 1, note: 1,
    default: 1, first_enter: 1, token: 1, uuid: 1, traceid: 1
  };

  var sourceScoreMap = { suggest: 1.8, recommend: 1.5, trending: 1.5, manual: 1.5 };
  var seed = norm(seedKeyword);
  var seedHasCjk = hasCjk(seed);

  function buildSeedAnchor() {
    var s = seed.replace(/20\\d{2}年?/g, '').replace(/\\d+/g, '').trim();
    if (!s) s = seed;
    if (seedHasCjk) {
      s = s.replace(/[^\\u4e00-\\u9fff]/g, '');
    }
    if (s.length > 8) s = s.slice(0, 8);
    return s;
  }

  var seedAnchor = buildSeedAnchor();

  function sharedCjkCount(a, b) {
    var map = {};
    var i;
    for (i = 0; i < a.length; i += 1) map[a[i]] = 1;
    var count = 0;
    var used = {};
    for (i = 0; i < b.length; i += 1) {
      var ch = b[i];
      if (used[ch]) continue;
      used[ch] = 1;
      if (map[ch]) count += 1;
    }
    return count;
  }

  function related(word) {
    var w = norm(word);
    if (!w) return false;
    if (!seedAnchor) return true;
    if (w.indexOf(seedAnchor) >= 0 || seedAnchor.indexOf(w) >= 0) return true;
    if (seedHasCjk && hasCjk(w) && sharedCjkCount(w, seedAnchor) >= 3) return true;
    return false;
  }

  function isNoise(word) {
    var w = norm(word);
    if (!w) return true;
    if (w.length < 2 || w.length > 48) return true;
    if (seedHasCjk && !hasCjk(w)) return true;
    if (/^[\\d]+$/.test(w)) return true;
    if (/^[a-f0-9]{4,}$/i.test(w)) return true;
    if (/^[A-Z0-9_]{4,}$/.test(w)) return true;
    if (w.indexOf('[') >= 0 || w.indexOf(']') >= 0 || /[{}<>:=]/.test(w)) return true;
    if (/[，。！？；：,.!?]/.test(w)) return true;
    if (/^\\d+[、.)）]/.test(w)) return true;
    if (stopWords[keyOf(w)]) return true;
    if (keyOf(w) === keyOf(seed)) return true;
    return false;
  }

  function splitParts(text) {
    return String(text || '')
      .split(/[\\n\\r\\t,，、|/]+/)
      .map(function (p) { return norm(p); })
      .filter(Boolean);
  }

  var list = [];
  var seen = {};
  function pushWord(rawWord, source, score) {
    var w = norm(rawWord);
    if (isNoise(w)) return;
    if (!related(w)) return;
    var k = keyOf(w);
    if (!k || seen[k]) return;
    seen[k] = 1;
    list.push({
      word: w,
      source: source || 'manual',
      score: Number(score) || sourceScoreMap[source] || 1.5
    });
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var style = window.getComputedStyle(el);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function findSearchInput() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input[type="search"], input[type="text"]'));
    var best = null;
    var bestScore = -1;
    inputs.forEach(function (input) {
      if (!isVisible(input)) return;
      var r = input.getBoundingClientRect();
      if (r.width < 160 || r.height < 24) return;
      var score = 0;
      var v = norm(input.value || '');
      var ph = String(input.placeholder || '');
      if (v && related(v)) score += 4;
      if (ph.indexOf('搜索') >= 0 || ph.indexOf('Search') >= 0) score += 3;
      if (document.activeElement === input) score += 2;
      if (r.top < 240) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = input;
      }
    });
    return best;
  }

  function openSuggest(input) {
    if (!input) return;
    try {
      var old = input.value || '';
      input.focus();
      input.click();
      input.dispatchEvent(new Event('focus', { bubbles: true }));
      input.value = old + ' ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = old;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    } catch (err) {
      console.warn('[SEO keyword sync] open suggest failed', err);
    }
  }

  function collectFromDropdown() {
    var input = findSearchInput();
    if (!input) return 0;
    var ir = input.getBoundingClientRect();

    var bestBox = null;
    var bestCount = -1;

    var boxes = document.querySelectorAll('div, ul, section');
    boxes.forEach(function (box) {
      if (!isVisible(box)) return;
      var br = box.getBoundingClientRect();
      if (br.width < 180 || br.width > 980) return;
      if (br.height < 120 || br.height > 780) return;
      if (br.top < ir.bottom - 16 || br.top > ir.bottom + 120) return;
      if (Math.abs(br.left - ir.left) > 48) return;
      if (Math.abs(br.width - ir.width) > Math.max(100, ir.width * 0.3)) return;

      var rows = box.querySelectorAll('li, a, button, [role="option"], div, span');
      var cnt = 0;
      rows.forEach(function (row) {
        if (!isVisible(row)) return;
        var rr = row.getBoundingClientRect();
        if (rr.width < 110 || rr.height < 16 || rr.height > 86) return;
        var t = norm(row.textContent || '');
        if (!t || t.length > 48 || t.indexOf('\\n') >= 0) return;
        if (!related(t)) return;
        cnt += 1;
      });

      if (cnt > bestCount) {
        bestCount = cnt;
        bestBox = box;
      }
    });

    if (!bestBox) return 0;

    var added = 0;
    var rowSeen = {};
    var finalRows = bestBox.querySelectorAll('li, a, button, [role="option"], div, span');
    finalRows.forEach(function (row) {
      if (!isVisible(row)) return;
      var rr = row.getBoundingClientRect();
      if (rr.width < 110 || rr.height < 16 || rr.height > 86) return;
      var t = norm(row.textContent || '');
      if (!t || t.length > 48 || t.indexOf('\\n') >= 0) return;
      var tk = keyOf(t);
      if (rowSeen[tk]) return;
      rowSeen[tk] = 1;
      if (!related(t)) return;
      splitParts(t).forEach(function (w) {
        var before = list.length;
        pushWord(w, 'suggest', sourceScoreMap.suggest);
        if (list.length > before) added += 1;
      });
    });

    return added;
  }

  function collectFromSelectors() {
    var groups = [
      { selector: '[class*="suggest"] a, [class*="suggest"] li, [class*="suggest"] button, [class*="suggest"] span', source: 'suggest' },
      { selector: '[class*="recommend"] a, [class*="recommend"] li, [class*="recommend"] button, [class*="recommend"] span', source: 'recommend' },
      { selector: '[class*="related"] a, [class*="related"] li, [class*="related"] button, [class*="related"] span', source: 'recommend' },
      { selector: '[class*="trend"] a, [class*="trend"] li, [class*="trend"] button, [class*="trend"] span', source: 'trending' },
      { selector: '[class*="hot"] a, [class*="hot"] li, [class*="hot"] button, [class*="hot"] span', source: 'trending' },
      { selector: '[class*="query"] a, [class*="query"] li, [class*="query"] button, [class*="query"] span', source: 'trending' }
    ];

    groups.forEach(function (group) {
      try {
        var els = document.querySelectorAll(group.selector);
        els.forEach(function (el) {
          if (!isVisible(el)) return;
          var t = norm(el.textContent || '');
          if (!t || t.length > 48) return;
          if (!related(t)) return;
          splitParts(t).forEach(function (w) {
            pushWord(w, group.source, sourceScoreMap[group.source] || 1.5);
          });
        });
      } catch (err) {
        console.warn('[SEO keyword sync] selector read failed', group.selector, err);
      }
    });
  }

  function inferSource(path) {
    var p = String(path || '').toLowerCase();
    if (/(suggest|sug|hint)/.test(p)) return 'suggest';
    if (/(recommend|related)/.test(p)) return 'recommend';
    if (/(trend|hot|query)/.test(p)) return 'trending';
    return '';
  }

  function walkState(node, path, depth) {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      node.forEach(function (item, idx) { walkState(item, path + '[' + idx + ']', depth + 1); });
      return;
    }
    if (typeof node !== 'object') return;

    Object.keys(node).forEach(function (key) {
      var value = node[key];
      var nextPath = path ? path + '.' + key : key;
      var source = inferSource(nextPath);
      if (!source) {
        walkState(value, nextPath, depth + 1);
        return;
      }

      if (typeof value === 'string') {
        splitParts(value).forEach(function (w) { pushWord(w, source, sourceScoreMap[source] || 1.5); });
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(function (item) {
          if (typeof item === 'string') {
            splitParts(item).forEach(function (w) { pushWord(w, source, sourceScoreMap[source] || 1.5); });
            return;
          }
          if (!item || typeof item !== 'object') return;
          [item.word, item.searchWord, item.keyword, item.query, item.text, item.title, item.name].forEach(function (cand) {
            splitParts(cand).forEach(function (w) { pushWord(w, source, sourceScoreMap[source] || 1.5); });
          });
        });
      }

      walkState(value, nextPath, depth + 1);
    });
  }

  function collectFromState() {
    try {
      var state = window.__INITIAL_STATE__ || {};
      walkState(state, 'state', 0);
    } catch (err) {
      console.warn('[SEO keyword sync] parse state failed', err);
    }
  }

  function pickFinalKeywords() {
    var suggestOnly = list.filter(function (item) { return item.source === 'suggest'; });
    if (suggestOnly.length > 0) return suggestOnly.slice(0, MAX_COUNT);
    var preferred = list.filter(function (item) { return item.source === 'recommend' || item.source === 'trending'; });
    return preferred.slice(0, MAX_COUNT);
  }

  function post(result) {
    var packet = { source: SOURCE, type: 'data', data: result };
    var sent = false;
    var prettyJson = JSON.stringify(result, null, 2);
    var packedJson = JSON.stringify(result);

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(packet, '*');
        window.opener.postMessage(JSON.stringify(packet), '*');
        window.opener.postMessage({ source: SOURCE, type: 'data', data: JSON.stringify(result) }, '*');
        window.opener.postMessage({ source: SOURCE, payload: result }, '*');
        sent = true;
      }
    } catch (err) {
      console.warn('[SEO keyword sync] postMessage failed', err);
    }

    try {
      var bc = new BroadcastChannel(CHANNEL);
      bc.postMessage(packet);
      bc.postMessage(JSON.stringify(packet));
      bc.close();
    } catch (err) {
      console.warn('[SEO keyword sync] BroadcastChannel failed', err);
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        var maybePromise = navigator.clipboard.writeText(prettyJson);
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(function (err) {
            console.warn('[SEO keyword sync] clipboard write rejected', err);
          });
        }
      }
    } catch (err) {
      console.warn('[SEO keyword sync] clipboard write failed', err);
    }

    try {
      if (typeof copy === 'function') {
        copy(prettyJson);
        console.log('JSON copied by DevTools copy().');
      }
    } catch (err) {
      console.warn('[SEO keyword sync] DevTools copy() failed', err);
    }

    console.log('=== XHS SEO LONGTAIL JSON START ===');
    console.log(prettyJson);
    console.log('XHS_SEO_JSON=' + packedJson);
    console.log('=== XHS SEO LONGTAIL JSON END ===');
    if (sent) {
      console.log('Payload posted back to tool page.');
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            source: SOURCE,
            type: 'done',
            message: '长尾词抓取完成，已自动回填并尝试切回工具页。'
          }, '*');
          if (typeof window.opener.focus === 'function') {
            window.opener.focus();
          }
          setTimeout(function () {
            try { window.close(); } catch (err) {}
          }, 220);
        }
      } catch (err) {
        console.warn('[SEO keyword sync] auto focus/close failed', err);
      }
    } else {
      console.log('Auto-return failed, copy JSON manually into the tool page.');
    }
  }

  function run(attempt) {
    collectFromState();
    var dropdownCount = collectFromDropdown();
    if (dropdownCount < 5) collectFromSelectors();

    var suggestCount = list.filter(function (item) { return item.source === 'suggest'; }).length;
    if (suggestCount < 5 && attempt < 8) {
      openSuggest(findSearchInput());
      setTimeout(function () { run(attempt + 1); }, 300);
      return;
    }

    post({
      seedKeyword: norm(seedKeyword),
      keywords: pickFinalKeywords()
    });
  }

  openSuggest(findSearchInput());
  setTimeout(function () { run(0); }, 150);
})();`
}
export default function ProductManager({ shop, onUpdateShop, settings, innerImagesMap, setInnerImagesMap }) {
  const [promptEditing, setPromptEditing] = useState(null)
  const [promptForm, setPromptForm] = useState({ customSystemPrompt: '' })
  // 爆文参考
  const [refEditing, setRefEditing] = useState(null)
  const [refForm, setRefForm] = useState({ text: '' })
  // AI 分析状态
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisPreview, setAnalysisPreview] = useState(null) // { text, analysis }
  const [analysisError, setAnalysisError] = useState('')
  // 风格模板
  const [saveAsTemplate, setSaveAsTemplate] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [showTemplateList, setShowTemplateList] = useState(false)
  // 灏侀潰鑷畾涔?
  const [coverEditing, setCoverEditing] = useState(null)
  const [coverForm, setCoverForm] = useState({ coverTitle: '', coverSubtitle: '', coverTemplateId: '' })
  const [coverPreviewTplId, setCoverPreviewTplId] = useState(COVER_TEMPLATES[0]?.id || '')
  const [seoEditing, setSeoEditing] = useState(null)
  const [seoForm, setSeoForm] = useState(buildSeoForm({ seoConfig: {} }))
  const [seoKeywordSyncOpen, setSeoKeywordSyncOpen] = useState(false)
  const [seoKeywordSeed, setSeoKeywordSeed] = useState('')
  const [seoKeywordStatus, setSeoKeywordStatus] = useState('idle')
  const [seoKeywordMessage, setSeoKeywordMessage] = useState('')
  const [seoKeywordScriptCopied, setSeoKeywordScriptCopied] = useState(false)
  const [seoKeywordManualJson, setSeoKeywordManualJson] = useState('')
  const [seoKeywordManualError, setSeoKeywordManualError] = useState('')
  const seoKeywordWindowRef = useRef(null)
  // 内页图上传
  const innerImageInputRef = useRef(null)
  const [innerImageTarget, setInnerImageTarget] = useState(null) // 当前正在上传内页图的商品ID
  // 内页图拖拽排序
  const [dragIndex, setDragIndex] = useState(null)
  const [dragProductId, setDragProductId] = useState(null)

  if (!shop) return <div className="panel"><p className="empty-state">请先在左侧选择一个店铺</p></div>

  const products = shop.products || []

  const handleDelete = (id) => {
    onUpdateShop({ ...shop, products: products.filter(p => p.id !== id) })
  }

  // 提示词编辑
  const handleEditPrompt = (p) => {
    setPromptEditing(p.id)
    setPromptForm({
      customSystemPrompt: p.customSystemPrompt || '',
    })
  }

  const handleSavePrompt = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === promptEditing ? {
        ...p,
        customSystemPrompt: promptForm.customSystemPrompt.trim() || undefined,
        customUserPrompt: undefined,
      } : p),
    })
    setPromptEditing(null)
    setPromptForm({ customSystemPrompt: '' })
  }

  const handleClearPrompt = () => {
    setPromptForm({ customSystemPrompt: '' })
  }

  // 爆文参考管理
  const handleOpenRef = (p) => {
    setRefEditing(p.id)
    setRefForm({ text: '' })
    setAnalysisPreview(null)
    setAnalysisError('')
    setSaveAsTemplate(true)
    setTemplateName('')
    setShowTemplateList(false)
  }

  const handleAddRef = () => {
    if (!refForm.text.trim()) return
    const product = products.find(p => p.id === refEditing)
    if (!product) return
    const newRef = {
      id: Date.now().toString(),
      text: refForm.text.trim(),
    }
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === refEditing
        ? { ...p, references: [...(p.references || []), newRef] }
        : p
      ),
    })
    setRefForm({ text: '' })
    setAnalysisPreview(null)
  }

  // AI 分析后添加
  const handleAnalyzeAndAdd = async () => {
    if (!refForm.text.trim()) return
    if (!settings?.apiKey || !settings?.endpointId) {
      setAnalysisError('请先在设置页面配置 AI API Key 和推理接入点')
      return
    }

    setAnalyzing(true)
    setAnalysisError('')
    setAnalysisPreview(null)

    try {
      const messages = buildAnalysisPrompt(refForm.text.trim())
      const analysis = await callAI(settings, messages)
      setAnalysisPreview({ text: refForm.text.trim(), analysis })
    } catch (err) {
      setAnalysisError(`分析失败: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // 确认保存分析结果
  const handleConfirmAnalysis = () => {
    if (!analysisPreview) return
    const product = products.find(p => p.id === refEditing)
    if (!product) return
    const newRef = {
      id: Date.now().toString(),
      text: analysisPreview.text,
      analysis: analysisPreview.analysis,
    }
    // 是否同时保存为风格模板
    let updatedTemplates = product.styleTemplates || []
    if (saveAsTemplate && templateName.trim()) {
      updatedTemplates = [...updatedTemplates, {
        id: Date.now().toString() + '_t',
        name: templateName.trim(),
        sourceText: analysisPreview.text.slice(0, 200),
        analysis: analysisPreview.analysis,
        enabled: true,
        createdAt: Date.now(),
      }]
    }
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === refEditing
        ? { ...p, references: [...(p.references || []), newRef], styleTemplates: updatedTemplates }
        : p
      ),
    })
    setRefForm({ text: '' })
    setAnalysisPreview(null)
    setTemplateName('')
    setSaveAsTemplate(true)
  }

  // 切换风格模板启用/禁用
  const handleToggleTemplate = (productId, templateId) => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === productId
        ? { ...p, styleTemplates: (p.styleTemplates || []).map(t =>
            t.id === templateId ? { ...t, enabled: !t.enabled } : t
          )}
        : p
      ),
    })
  }

  // 删除风格模板
  const handleDeleteTemplate = (productId, templateId) => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === productId
        ? { ...p, styleTemplates: (p.styleTemplates || []).filter(t => t.id !== templateId) }
        : p
      ),
    })
  }

  const handleDeleteRef = (productId, refId) => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === productId
        ? { ...p, references: (p.references || []).filter(r => r.id !== refId) }
        : p
      ),
    })
  }

  // 灏侀潰鑷畾涔?
  const handleEditCover = (p) => {
    setCoverEditing(p.id)
    setCoverForm({
      coverTitle: p.customCoverTitle || '',
      coverSubtitle: p.customCoverSubtitle || '',
      coverTemplateId: p.customCoverTemplateId || '',
    })
    setCoverPreviewTplId(p.customCoverTemplateId || COVER_TEMPLATES[0]?.id || '')
  }

  const handleSaveCover = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === coverEditing ? {
        ...p,
        customCoverTitle: coverForm.coverTitle.trim() || undefined,
        customCoverSubtitle: coverForm.coverSubtitle.trim() || undefined,
        customCoverTemplateId: coverForm.coverTemplateId || undefined,
      } : p),
    })
    setCoverEditing(null)
  }

  const handleClearCover = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === coverEditing ? {
        ...p,
        customCoverTitle: undefined,
        customCoverSubtitle: undefined,
        customCoverTemplateId: undefined,
      } : p),
    })
    setCoverEditing(null)
  }

  const handleEditSeo = (product) => {
    setSeoEditing(product.id)
    setSeoForm(buildSeoForm(product))
  }

  const handleSaveSeo = () => {
    if (!seoEditing) return

    const payload = buildSeoPayload(seoForm)
    const normalizedPayload = normalizeSeoConfig(payload)
    const hasAnyRule = Boolean(
      normalizedPayload.seedKeyword ||
      normalizedPayload.coreKeyword ||
      normalizedPayload.rawSearchTerms?.length > 0 ||
      normalizedPayload.longTailKeywords.length > 0 ||
      normalizedPayload.requiredTags.length > 0 ||
      normalizedPayload.extendedTags.length > 0 ||
      normalizedPayload.keywordPools.core.length > 0 ||
      normalizedPayload.keywordPools.scene.length > 0 ||
      normalizedPayload.keywordPools.longTail.length > 0,
    )

    onUpdateShop({
      ...shop,
      products: products.map((p) => {
        if (p.id !== seoEditing) return p
        return {
          ...p,
          seoConfig: hasAnyRule ? normalizedPayload : undefined,
        }
      }),
    })
    setSeoEditing(null)
  }

  const handleClearSeo = () => {
    if (!seoEditing) return
    onUpdateShop({
      ...shop,
      products: products.map((p) => (p.id === seoEditing ? { ...p, seoConfig: undefined } : p)),
    })
    setSeoForm(buildSeoForm({ seoConfig: {} }))
    setSeoEditing(null)
  }

  const resetSeoKeywordSyncState = () => {
    setSeoKeywordStatus('idle')
    setSeoKeywordMessage('')
    setSeoKeywordScriptCopied(false)
    setSeoKeywordManualJson('')
    setSeoKeywordManualError('')
  }

  const closeSeoKeywordSync = () => {
    setSeoKeywordSyncOpen(false)
    resetSeoKeywordSyncState()
  }

  const tryCopySeoKeywordScript = async (seed) => {
    const scriptText = buildXhsKeywordSyncScript(seed)
    try {
      await navigator.clipboard.writeText(scriptText)
      setSeoKeywordScriptCopied(true)
      return true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = scriptText
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setSeoKeywordScriptCopied(true)
        return true
      } catch {
        setSeoKeywordScriptCopied(false)
        return false
      }
    }
  }

  const appendSeoKeywordsToForm = (payload, fromManual = false) => {
    const sanitized = sanitizeImportedKeywords(payload)
    if (!sanitized.keywords.length) {
      setSeoKeywordStatus('error')
      setSeoKeywordMessage('未提取到可用搜索词，请更换基础词或使用手动粘贴JSON。')
      return 0
    }

    setSeoForm((prev) => ({
      ...prev,
      longTailKeywordsText: mergeLongTailKeywordsText(prev.longTailKeywordsText, sanitized.keywords, sanitized.seedKeyword),
      longTailPoolText: mergeLongTailPoolText(prev.longTailPoolText, sanitized.keywords, sanitized.seedKeyword),
    }))

    const fromText = fromManual ? '（手动导入）' : ''
    setSeoKeywordStatus('done')
    setSeoKeywordMessage(`已导入 ${sanitized.keywords.length} 个原始搜索词${fromText}，后续会自动拆词用于标题、正文和标签。`)
    setSeoKeywordManualError('')
    return sanitized.keywords.length
  }

  const parseManualSeoKeywordJson = (rawText) => {
    return parseSeoKeywordPayloadFromText(rawText, seoKeywordSeed)
  }

  const handleApplySeoKeywordManualJson = () => {
    setSeoKeywordManualError('')
    const raw = String(seoKeywordManualJson || '').trim()
    if (!raw) {
      setSeoKeywordManualError('请先粘贴JSON。')
      return
    }

    try {
      const payload = parseManualSeoKeywordJson(raw)
      const added = appendSeoKeywordsToForm(payload, true)
      if (added > 0) setSeoKeywordManualJson('')
    } catch (err) {
      setSeoKeywordManualError(`JSON解析失败: ${err.message}`)
    }
  }

  const handleImportSeoKeywordFromClipboard = async () => {
    setSeoKeywordManualError('')
    try {
      const raw = String(await navigator.clipboard.readText() || '').trim()
      if (!raw) {
        setSeoKeywordManualError('剪贴板为空，请先在小红书控制台执行脚本。')
        return
      }
      const payload = parseManualSeoKeywordJson(raw)
      const added = appendSeoKeywordsToForm(payload, true)
      if (added > 0) {
        setSeoKeywordManualJson(raw)
      }
    } catch (err) {
      setSeoKeywordManualError(`剪贴板导入失败: ${err.message}`)
    }
  }

  const handleCopySeoKeywordScript = async () => {
    const product = products.find((item) => item.id === seoEditing)
    const seed = pickSeoSeedKeyword(seoForm, product)
    if (!seed) {
      setSeoKeywordStatus('error')
      setSeoKeywordMessage('请先填写基础词或核心词，再抓取搜索词。')
      return
    }

    setSeoKeywordSeed(seed)
    const copied = await tryCopySeoKeywordScript(seed)
    if (copied) {
      setSeoKeywordStatus('waiting')
      setSeoKeywordMessage('抓取脚本已复制，请到小红书搜索页控制台粘贴执行。')
      return
    }
    setSeoKeywordStatus('error')
    setSeoKeywordMessage('脚本复制失败，请手动复制并执行。')
  }

  const handleOpenSeoKeywordSync = async () => {
    const product = products.find((item) => item.id === seoEditing)
    const seed = pickSeoSeedKeyword(seoForm, product)

    setSeoKeywordSyncOpen(true)
    setSeoKeywordManualError('')
    setSeoKeywordManualJson('')
    setSeoKeywordScriptCopied(false)

    if (!seed) {
      setSeoKeywordStatus('error')
      setSeoKeywordMessage('请先填写基础词（seedKeyword）或核心词（coreKeyword）。')
      return
    }

    setSeoKeywordSeed(seed)
    const targetUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(seed)}&source=web_explore_feed`
    const win = window.open(targetUrl, '_blank')
    if (!win) {
      setSeoKeywordStatus('error')
      setSeoKeywordMessage('浏览器拦截了新标签页，请允许后重试。')
      return
    }

    seoKeywordWindowRef.current = win
    const copied = await tryCopySeoKeywordScript(seed)
    setSeoKeywordStatus('waiting')
    setSeoKeywordMessage(
      copied
        ? '已打开小红书搜索页并复制脚本，请在控制台执行；执行完成后会自动切回并回填。'
        : '已打开小红书搜索页，请先复制脚本并执行；完成后会自动尝试切回并回填。',
    )
  }

  // 内页图处理
  const handleInnerImageUpload = (productId) => {
    setInnerImageTarget(productId)
    innerImageInputRef.current?.click()
  }

  const handleInnerImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !innerImageTarget) return

    // 按文件修改时间排序（新 -> 旧，最近修改的排前面）
    files.sort((a, b) => b.lastModified - a.lastModified)

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(file)
      })
    })

    Promise.all(readers).then(base64List => {
      setInnerImagesMap(prev => ({
        ...prev,
        [innerImageTarget]: [...(prev[innerImageTarget] || []), ...base64List]
      }))
      setInnerImageTarget(null)
    })

    // 重置 input 以允许重复上传同一文件
    e.target.value = ''
  }

  const handleDeleteInnerImage = (productId, index) => {
    setInnerImagesMap(prev => ({
      ...prev,
      [productId]: (prev[productId] || []).filter((_, i) => i !== index)
    }))
  }

  const handleClearInnerImages = (productId) => {
    setInnerImagesMap(prev => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  // 内页图拖拽排序
  const handleInnerImageDragStart = (e, productId, idx) => {
    setDragIndex(idx)
    setDragProductId(productId)
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.style.opacity = '0.4'
  }

  const handleInnerImageDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
    setDragIndex(null)
    setDragProductId(null)
  }

  const handleInnerImageDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleInnerImageDrop = (productId, dropIdx) => {
    if (dragIndex === null || dragProductId !== productId || dragIndex === dropIdx) return
    setInnerImagesMap(prev => {
      const imgs = [...(prev[productId] || [])]
      const [moved] = imgs.splice(dragIndex, 1)
      imgs.splice(dropIdx, 0, moved)
      return { ...prev, [productId]: imgs }
    })
    setDragIndex(null)
    setDragProductId(null)
  }

  useEffect(() => {
    if (seoEditing) return
    setSeoKeywordSyncOpen(false)
    resetSeoKeywordSyncState()
  }, [seoEditing])

  useEffect(() => {
    const normalizeIncomingPayload = (raw) => {
      if (!raw) return null
      let incoming = raw

      if (typeof incoming === 'string') {
        try {
          incoming = JSON.parse(incoming)
        } catch {
          return null
        }
      }

      if (incoming?.source === XHS_SEO_SYNC_SOURCE && incoming?.type === 'data' && typeof incoming?.data === 'string') {
        try {
          incoming = { ...incoming, data: JSON.parse(incoming.data) }
        } catch {
          incoming = { ...incoming, data: null }
        }
      }

      if (incoming?.source === XHS_SEO_SYNC_SOURCE && incoming?.payload?.keywords) {
        return { source: XHS_SEO_SYNC_SOURCE, type: 'data', data: incoming.payload }
      }

      if (incoming?.keywords && (incoming?.seedKeyword || Array.isArray(incoming?.keywords))) {
        return { source: XHS_SEO_SYNC_SOURCE, type: 'data', data: incoming }
      }

      return incoming
    }

    const handlePayload = (rawIncoming) => {
      const incoming = normalizeIncomingPayload(rawIncoming)
      if (!incoming || incoming.source !== XHS_SEO_SYNC_SOURCE) return
      if (incoming.type === 'data' && incoming.data) {
        setSeoKeywordSyncOpen(true)
        if (incoming.data.seedKeyword) {
          setSeoKeywordSeed(normalizeKeywordWord(incoming.data.seedKeyword))
        }
        appendSeoKeywordsToForm(incoming.data, false)
        return
      }
      if (incoming.type === 'error') {
        setSeoKeywordSyncOpen(true)
        setSeoKeywordStatus('error')
        setSeoKeywordMessage(incoming.message || '抓取失败，请手动粘贴JSON导入。')
        return
      }
      if (incoming.type === 'done') {
        setSeoKeywordSyncOpen(true)
        if (incoming.message) {
          setSeoKeywordStatus((prev) => (prev === 'done' ? 'done' : 'waiting'))
          setSeoKeywordMessage(incoming.message)
        }
      }
    }

    const onWindowMessage = (event) => {
      handlePayload(event.data)
    }

    window.addEventListener('message', onWindowMessage)

    let channel = null
    try {
      channel = new BroadcastChannel(XHS_SEO_SYNC_CHANNEL)
      channel.onmessage = (event) => handlePayload(event.data)
    } catch {
      channel = null
    }

    return () => {
      window.removeEventListener('message', onWindowMessage)
      if (channel) channel.close()
    }
  }, [])

  const renderRefEditor = (product) => (
    <div className="product-inline-editor" style={{
      background: '#fff8f0', border: '1px solid #ffcc80', borderRadius: 12,
      padding: 20, marginTop: 12,
    }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
        🔥 爆文参考 - {product?.name}
      </h3>
      <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
        直接粘贴小红书爆款笔记（标题+正文+标签均可），系统会自动分析爆款因子并仿写。可添加多篇参考。
      </p>

      {(product?.references || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {(product?.references || []).map((ref, idx) => {
            const displayText = ref.text || [ref.title, ref.content, ref.tags].filter(Boolean).join('\n')
            return (
              <div key={ref.id} style={{
                background: '#fff', border: `1px solid ${ref.analysis ? '#ce93d8' : '#ffe0b2'}`, borderRadius: 8,
                padding: '10px 14px', marginBottom: 8, position: 'relative',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      参考{idx + 1}
                      {ref.analysis && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#7b1fa2', fontWeight: 600 }}>已分析爆款因子</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, color: '#666', lineHeight: 1.6,
                      maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'pre-line',
                    }}>
                      {displayText.slice(0, 150)}{displayText.length > 150 ? '...' : ''}
                    </div>
                  </div>
                  <button
                    className="btn-sm btn-danger"
                    style={{ marginLeft: 10, flexShrink: 0 }}
                    onClick={() => handleDeleteRef(product.id, ref.id)}
                  >删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {analysisPreview && (
        <div style={{
          background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 10,
          padding: 16, marginBottom: 14,
        }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#7b1fa2' }}>🔍 爆款因子分析结果</h4>
          <div style={{
            fontSize: 12, color: '#444', lineHeight: 1.8,
            maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-line',
            background: '#fff', borderRadius: 8, padding: 12,
          }}>
            {analysisPreview.analysis}
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px', background: '#ede7f6',
            borderRadius: 8, border: '1px solid #d1c4e9',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={e => setSaveAsTemplate(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              💾 同时保存为风格模板（可复用到其他爆文）
            </label>
            {saveAsTemplate && (
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="输入模板名称，如：种草测评风格、情绪共鸣体..."
                style={{
                  marginTop: 8, width: '100%', padding: '6px 10px',
                  borderRadius: 6, border: '1px solid #b39ddb', fontSize: 13,
                  outline: 'none',
                }}
              />
            )}
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={handleConfirmAnalysis}
              disabled={saveAsTemplate && !templateName.trim()}>
              {saveAsTemplate ? '确认添加 + 保存模板' : '确认添加（含分析结果）'}
            </button>
            <button className="btn-secondary" onClick={() => setAnalysisPreview(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      {analysisError && (
        <div style={{
          background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8,
          padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#c62828',
        }}>
          {analysisError}
        </div>
      )}

      {(product?.styleTemplates || []).length > 0 && (() => {
        const templates = product?.styleTemplates || []
        const enabledCount = templates.filter(t => t.enabled !== false).length
        return (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => setShowTemplateList(!showTemplateList)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid #b39ddb',
                background: showTemplateList ? '#ede7f6' : '#f3e5f5', color: '#7b1fa2',
                cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 8,
              }}
            >
              {showTemplateList ? '收起模板列表' : `💾 风格模板 (${enabledCount}/${templates.length} 启用)`}
            </button>
            {showTemplateList && (
              <div style={{
                background: '#faf5ff', border: '1px solid #d1c4e9', borderRadius: 10,
                padding: 12,
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7b1fa2' }}>
                  启用的模板在批量生成时会自动轮换使用。每篇笔记仅参考 1 个模板，确保多样性。建议至少启用 3 个模板，效果更好。
                </p>
                {templates.map(t => {
                  const isEnabled = t.enabled !== false
                  return (
                    <div key={t.id} style={{
                      background: isEnabled ? '#fff' : '#f5f5f5',
                      border: `1px solid ${isEnabled ? '#e1bee7' : '#e0e0e0'}`,
                      borderRadius: 8, padding: '8px 12px', marginBottom: 6,
                      opacity: isEnabled ? 1 : 0.65,
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleTemplate(product.id, t.id)}
                            style={{ width: 16, height: 16, accentColor: '#7b1fa2' }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isEnabled ? '#6a1b9a' : '#999' }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                              来源: {t.sourceText?.slice(0, 50)}{(t.sourceText?.length || 0) > 50 ? '...' : ''}
                            </div>
                          </div>
                        </label>
                        <button
                          className="btn-sm btn-danger"
                          style={{ flexShrink: 0, marginLeft: 8 }}
                          onClick={() => handleDeleteTemplate(product.id, t.id)}
                        >删除</button>
                      </div>
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 11, color: '#9575cd', cursor: 'pointer' }}>查看分析内容</summary>
                        <div style={{
                          fontSize: 11, color: '#555', lineHeight: 1.7, marginTop: 4,
                          maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-line',
                          background: '#f9f5ff', borderRadius: 6, padding: 8,
                        }}>
                          {t.analysis}
                        </div>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>添加参考爆文</label>
        <textarea
          value={refForm.text}
          onChange={e => setRefForm({ text: e.target.value })}
          placeholder="直接粘贴爆文内容（标题+正文+标签均可）..."
          rows={8}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}
          disabled={analyzing}
        />
      </div>

      <div className="btn-row">
        <button className="btn-primary" onClick={handleAddRef}
          disabled={!refForm.text.trim() || analyzing}>
          直接添加
        </button>
        <button
          onClick={handleAnalyzeAndAdd}
          disabled={!refForm.text.trim() || analyzing}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #ce93d8',
            background: analyzing ? '#f3e5f5' : '#7b1fa2', color: analyzing ? '#7b1fa2' : '#fff',
            cursor: (!refForm.text.trim() || analyzing) ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 13,
          }}
        >
          {analyzing ? 'AI 分析中...' : 'AI 分析后添加'}
        </button>
        <button className="btn-secondary" onClick={() => setRefEditing(null)}>完成</button>
      </div>
    </div>
  )

  const renderPromptEditor = (product) => (
    <div className="product-inline-editor prompt-editor" style={{
      background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 12,
      padding: 20, marginTop: 12,
    }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
        自定义提示词 - {product?.name}
      </h3>
      <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
        这里填写的是补充要求，不会替换系统模板。支持变量：
        <code>{'{name}'}</code> <code>{'{description}'}</code> <code>{'{audience}'}</code> <code>{'{sellingPoints}'}</code>
      </p>

      <div style={{
        background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8,
        padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#6d4c00', lineHeight: 1.8,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>建议补充（避免重复写基础规则）：</div>
        <div>- 人设身份：例如“上岸学长”“一线老师”。</div>
        <div>- 行业术语：你所在赛道常用词、黑话。</div>
        <div>- 必提/必避词：正文里必须出现或必须规避的词。</div>
        <div>- 转化偏好：你希望的结尾引导方式。</div>
        <div>- 资料细节：资料目录、页数、适用人群。</div>
        <div>- 时效信息：当前考试节点、热点方向。</div>
      </div>

      <textarea
        value={promptForm.customSystemPrompt}
        onChange={e => setPromptForm(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
        placeholder={'把你的补充要求直接贴在这里，例如：\n\n请以“上岸学长”口吻写，语气真实不鸡汤。\n正文必须提到“知识框架”和“思维导图”。\n不要出现某品牌名。\n结尾用“点击下方卡片直接领取”做引导。'}
        rows={10}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}
      />

      <div style={{
        background: '#f5f5f5', borderRadius: 8, padding: '8px 12px',
        marginBottom: 12, fontSize: 11, color: '#888', lineHeight: 1.7,
      }}>
        内置已包含：标题长度、正文长度、话题数量、合规约束、去AI味等基础规则；这里只写你的补充要求即可。
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={handleSavePrompt}>保存补充提示词</button>
        <button className="btn-secondary" onClick={handleClearPrompt}>清空（仅用内置）</button>
        <button className="btn-secondary" onClick={() => { setPromptEditing(null) }}>取消</button>
      </div>
    </div>
  )

  const renderSeoEditor = (product) => (
    (() => {
      const previewSeo = normalizeSeoConfig(buildSeoPayload(seoForm), product)
      const highIntentPreview = mergePreviewWords(
        previewSeo.fragmentBuckets.title.map((item) => item.word),
        previewSeo.fragmentBuckets.body.map((item) => item.word),
      )
      const weakPreview = previewSeo.fragmentBuckets.weak.map((item) => item.word)
      const renderPreviewGroup = (title, items, tone, emptyText) => (
        <div style={{
          border: `1px solid ${tone.border}`,
          background: tone.background,
          borderRadius: 10,
          padding: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <strong style={{ fontSize: 12, color: tone.title }}>{title}</strong>
            <span style={{ fontSize: 11, color: tone.count }}>{items.length} 个</span>
          </div>
          {items.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map((item) => (
                <span
                  key={`${title}-${item}`}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.4,
                    color: tone.text,
                    background: tone.badge,
                    border: `1px solid ${tone.badgeBorder}`,
                    borderRadius: 999,
                    padding: '4px 8px',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
              {emptyText}
            </div>
          )}
        </div>
      )

      return (
        <div className="product-inline-editor" style={{
          background: '#f4f8ff', border: '1px solid #b6d4fe', borderRadius: 12,
          padding: 20, marginTop: 12,
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
            SEO设置 - {product?.name}
          </h3>
          <p className="hint" style={{ marginBottom: 12, fontSize: 12 }}>
            配置关键词分层、标签与反堆砌参数。生成时会自动注入，不改变整体文风。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>基础词 seedKeyword</label>
              <input
                value={seoForm.seedKeyword}
                onChange={(e) => setSeoForm(prev => ({ ...prev, seedKeyword: e.target.value }))}
                placeholder="例如：中考数学"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>核心词 coreKeyword</label>
              <input
                value={seoForm.coreKeyword}
                onChange={(e) => setSeoForm(prev => ({ ...prev, coreKeyword: e.target.value }))}
                placeholder="可与基础词相同"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>原始搜索词 rawSearchTerms（每行一个，系统自动拆词）</label>
            <textarea
              rows={4}
              value={seoForm.longTailKeywordsText}
              onChange={(e) => setSeoForm(prev => ({ ...prev, longTailKeywordsText: e.target.value }))}
              placeholder={'系统集成项目管理师中级\n系统集成项目管理工程师怎么备考\n系统集成备考攻略'}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button className="btn-secondary" onClick={handleOpenSeoKeywordSync}>
                自动抓取长尾词
              </button>
              <button className="btn-secondary" onClick={handleCopySeoKeywordScript}>
                仅复制抓取脚本
              </button>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                仅抓取小红书联想词/相关搜索/热搜词，自动去重后追加；后续会自动拆词并用于标题、正文、标签，单次最多 {XHS_MAX_IMPORTED_KEYWORDS} 词
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>系统拆词预览（只读）</div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, marginBottom: 8 }}>
              保存时不会单独写入这些预览字段；系统会根据当前原始搜索词自动重新计算。
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {renderPreviewGroup(
                '清洗后原始搜索词',
                previewSeo.rawSearchTerms,
                {
                  border: '#bfdbfe',
                  background: '#eff6ff',
                  title: '#1d4ed8',
                  count: '#64748b',
                  text: '#1e3a8a',
                  badge: '#dbeafe',
                  badgeBorder: '#93c5fd',
                },
                '这里会显示系统最终保留的完整搜索句。',
              )}
              {renderPreviewGroup(
                '高意图片段（标题 / 正文优先）',
                highIntentPreview,
                {
                  border: '#bbf7d0',
                  background: '#f0fdf4',
                  title: '#15803d',
                  count: '#64748b',
                  text: '#166534',
                  badge: '#dcfce7',
                  badgeBorder: '#86efac',
                },
                '系统会从完整搜索词里自动拆出可用于标题和正文的高意图片段。',
              )}
              {renderPreviewGroup(
                '弱相关词池（仅标签兜底）',
                weakPreview,
                {
                  border: '#fde68a',
                  background: '#fffbeb',
                  title: '#b45309',
                  count: '#64748b',
                  text: '#92400e',
                  badge: '#fef3c7',
                  badgeBorder: '#fcd34d',
                },
                '弱相关词不会进标题和正文，只会在标签兜底时少量使用。',
              )}
            </div>
          </div>

          {seoKeywordSyncOpen && (
            <div style={{
              marginBottom: 12,
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              borderRadius: 10,
              padding: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>原始搜索词自动抓取（脚本模式）</strong>
                <button className="btn-secondary" onClick={closeSeoKeywordSync}>收起</button>
              </div>

              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.65, marginBottom: 8 }}>
                <div>1. 点击“自动抓取长尾词”会打开小红书搜索页并尝试自动复制脚本。</div>
                <div>2. 在新页面先点开搜索框下拉联想词，再按 `F12` 打开控制台执行脚本。</div>
                <div>3. 执行后会自动切回工具页并自动回填；若失败可点“从剪贴板导入”或手动粘贴 JSON。</div>
              </div>

              <div style={{
                fontSize: 12,
                borderRadius: 8,
                background: '#dbeafe',
                color: '#1e3a8a',
                padding: '6px 10px',
                marginBottom: 8,
              }}>
                当前基础词：{seoKeywordSeed || pickSeoSeedKeyword(seoForm, product)}
              </div>

              {seoKeywordMessage && (
                <div style={{
                  fontSize: 12,
                  borderRadius: 8,
                  padding: '6px 10px',
                  marginBottom: 8,
                  background: seoKeywordStatus === 'error' ? '#fee2e2' : (seoKeywordStatus === 'done' ? '#dcfce7' : '#fef3c7'),
                  color: seoKeywordStatus === 'error' ? '#b91c1c' : (seoKeywordStatus === 'done' ? '#166534' : '#92400e'),
                }}>
                  {seoKeywordMessage}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <button className="btn-secondary" onClick={handleCopySeoKeywordScript}>复制抓取脚本</button>
                <button className="btn-secondary" onClick={handleOpenSeoKeywordSync}>重新打开小红书页</button>
                <button className="btn-secondary" onClick={handleImportSeoKeywordFromClipboard}>从剪贴板导入</button>
                {seoKeywordScriptCopied && <span style={{ fontSize: 11, color: '#15803d' }}>脚本已复制到剪贴板</span>}
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                手动粘贴抓取结果 JSON（兜底）
              </label>
              <textarea
                rows={6}
                value={seoKeywordManualJson}
                onChange={(e) => setSeoKeywordManualJson(e.target.value)}
                placeholder={'{\n  "seedKeyword": "中考数学",\n  "keywords": [\n    { "word": "中考数学压轴题", "source": "suggest", "score": 1.8 }\n  ]\n}'}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: 12, fontFamily: 'monospace', marginBottom: 8 }}
              />
              <div className="btn-row">
                <button className="btn-primary" onClick={handleApplySeoKeywordManualJson}>导入JSON并回填</button>
                <button className="btn-secondary" onClick={() => { setSeoKeywordManualJson(''); setSeoKeywordManualError('') }}>清空JSON</button>
              </div>
              {seoKeywordManualError && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>
                  {seoKeywordManualError}
                </div>
              )}
            </div>
          )}

          <div className="btn-row">
            <button className="btn-primary" onClick={handleSaveSeo}>保存SEO设置</button>
            <button className="btn-danger" onClick={handleClearSeo}>清空SEO设置</button>
            <button className="btn-secondary" onClick={() => setSeoEditing(null)}>取消</button>
          </div>
        </div>
      )
    })()
  )

  const renderCoverEditor = (product) => (
    <div className="product-inline-editor" style={{
      background: '#f0f7ff', border: '1px solid #90caf9', borderRadius: 12,
      padding: 20, marginTop: 12,
    }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
        自定义封面 - {product?.name}
      </h3>
      <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
        填写后批量生成会优先使用你的封面内容；留空则继续使用 AI 自动生成。
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
          封面主标题 <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>（建议 8-18 字，可回车换行）</span>
        </label>
        <textarea
          value={coverForm.coverTitle}
          onChange={e => setCoverForm(prev => ({ ...prev, coverTitle: e.target.value }))}
          placeholder={'例如：逼自己做自媒体的第一天\n建议先收藏'}
          maxLength={50}
          rows={3}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid #90caf9', fontSize: 13, outline: 'none',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
          }}
        />
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {coverForm.coverTitle.replace(/\n/g, '').length}字（不含换行）
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
          封面副标题 <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>（建议 15 字以内）</span>
        </label>
        <input
          type="text"
          value={coverForm.coverSubtitle}
          onChange={e => setCoverForm(prev => ({ ...prev, coverSubtitle: e.target.value }))}
          placeholder="例如：万能模板 + 高分框架"
          maxLength={25}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid #90caf9', fontSize: 13, outline: 'none',
          }}
        />
        <div style={{ fontSize: 11, color: coverForm.coverSubtitle.length > 15 ? '#e53935' : '#888', marginTop: 2 }}>
          {coverForm.coverSubtitle.length}/25字
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
          指定封面模板 <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>（可选）</span>
        </label>
        <select
          value={coverForm.coverTemplateId}
          onChange={e => {
            setCoverForm(prev => ({ ...prev, coverTemplateId: e.target.value }))
            if (e.target.value) setCoverPreviewTplId(e.target.value)
          }}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid #90caf9', fontSize: 13,
          }}
        >
          <option value="">不指定（按批量生成设置）</option>
          {COVER_TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>{t.name} - {t.desc}</option>
          ))}
        </select>
      </div>

      {coverForm.coverTitle && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>实时预览</div>
          <CoverCanvas
            templateId={coverForm.coverTemplateId || coverPreviewTplId}
            data={{ title: coverForm.coverTitle, subtitle: coverForm.coverSubtitle }}
            colorIdx={0}
            width={200}
          />
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn-primary" onClick={handleSaveCover}
          disabled={!coverForm.coverTitle.trim() && !coverForm.coverSubtitle.trim() && !coverForm.coverTemplateId}>
          保存封面设置
        </button>
        {(product?.customCoverTitle || product?.customCoverSubtitle || product?.customCoverTemplateId) && (
          <button className="btn-danger" onClick={handleClearCover}>
            清除自定义（恢复 AI 生成）
          </button>
        )}
        <button className="btn-secondary" onClick={() => setCoverEditing(null)}>取消</button>
      </div>
    </div>
  )

  return (
    <div className="panel">
      {/* 隐藏的内页图文件上传 input */}
      <input
        ref={innerImageInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInnerImageChange}
      />
      <h2>📦 商品管理 <span className="panel-sub">- {shop.name}</span></h2>
      <p className="hint" style={{ marginBottom: 12 }}>商品从千帆导入，可添加爆文参考（支持 AI 分析爆款因子）、定制提示词</p>

      {products.length > 0 && (
        <div className="item-list">
          {products.map(p => {
            const refCount = (p.references || []).length
            const hasAnalysis = (p.references || []).some(r => r.analysis)
            const templateCount = (p.styleTemplates || []).length
            const enabledTemplateCount = (p.styleTemplates || []).filter(t => t.enabled !== false).length
            const hasCover = p.customCoverTitle || p.customCoverSubtitle
            const normalizedSeo = normalizeSeoConfig(p.seoConfig || {}, p)
            const hasSeoConfig = Boolean(
              normalizedSeo.seedKeyword ||
              normalizedSeo.coreKeyword ||
              normalizedSeo.rawSearchTerms?.length > 0 ||
              normalizedSeo.longTailKeywords.length > 0 ||
              normalizedSeo.requiredTags.length > 0 ||
              normalizedSeo.extendedTags.length > 0 ||
              normalizedSeo.keywordPools.core.length > 0 ||
              normalizedSeo.keywordPools.scene.length > 0 ||
              normalizedSeo.keywordPools.longTail.length > 0
            )
            const innerImages = innerImagesMap[p.id] || []
            return (
              <div key={p.id} className="product-item">
                <div className="item-card">
                  <div className="item-info">
                    <strong>{p.name}</strong>
                    <span className="item-meta">
                      {p.productId && <span className="product-id">ID: {p.productId}</span>}
                      {refCount > 0 && (
                        <span style={{ marginLeft: 6, color: '#e65100', fontWeight: 600 }}>
                          爆文参考 {refCount} 篇
                          {hasAnalysis && <span style={{ color: '#7b1fa2' }}>（含AI分析）</span>}
                          {refCount < 3 && <span style={{ color: '#f57c00', fontWeight: 400, fontSize: 11 }}>（建议≥3篇）</span>}
                        </span>
                      )}
                      {refCount === 0 && (
                        <span style={{ marginLeft: 6, color: '#bbb', fontSize: 11 }}>
                          建议添加至少 3 篇爆文参考以提高多样性
                        </span>
                      )}
                      {templateCount > 0 && (
                        <span style={{ marginLeft: 6, color: '#6a1b9a', fontWeight: 600 }}>
                          模板 {enabledTemplateCount}/{templateCount} 启用
                        </span>
                      )}
                      {hasCover && (
                        <span style={{ marginLeft: 6, color: '#1565c0', fontWeight: 600 }}>已定制封面</span>
                      )}
                      {(p.customSystemPrompt || p.customUserPrompt) && (
                        <span style={{ marginLeft: 6, color: '#e67e22', fontWeight: 600 }}>已定制提示词</span>
                      )}
                      {hasSeoConfig && (
                        <span style={{ marginLeft: 6, color: '#0369a1', fontWeight: 600 }}>SEO已配置</span>
                      )}
                      {innerImages.length > 0 && (
                        <span style={{ marginLeft: 6, color: '#00897b', fontWeight: 600 }}>内页图 {innerImages.length} 张</span>
                      )}
                    </span>
                  </div>
                  <div className="item-actions">
                    <button className="btn-sm" onClick={() => handleInnerImageUpload(p.id)}
                      style={{ background: innerImages.length > 0 ? '#e0f2f1' : undefined }}>
                      {innerImages.length > 0 ? `内页图(${innerImages.length})` : '添加内页图'}
                    </button>
                    <button className="btn-sm" onClick={() => handleOpenRef(p)}
                      style={{ background: refCount > 0 ? '#fff3e0' : undefined }}>
                      {refCount > 0 ? `爆文参考(${refCount})` : '爆文参考'}
                    </button>
                    <button className="btn-sm" onClick={() => handleEditCover(p)}
                      style={{ background: hasCover ? '#e3f2fd' : undefined }}>
                      {hasCover ? '编辑封面' : '自定义封面'}
                    </button>
                    <button className="btn-sm" onClick={() => handleEditPrompt(p)}
                      style={{ background: (p.customSystemPrompt || p.customUserPrompt) ? '#fff3e0' : undefined }}>
                      {(p.customSystemPrompt || p.customUserPrompt) ? '编辑提示词' : '定制提示词'}
                    </button>
                    <button className="btn-sm" onClick={() => handleEditSeo(p)}
                      style={{ background: hasSeoConfig ? '#e0f2fe' : undefined }}>
                      {hasSeoConfig ? '编辑SEO' : 'SEO设置'}
                    </button>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(p.id)}>删除</button>
                  </div>
                  {innerImages.length > 0 && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', background: '#f0faf8',
                      borderRadius: 8, border: '1px solid #b2dfdb',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#00897b' }}>
                          内页图 ({innerImages.length} 张) - 可拖拽调整顺序，刷新后需重新上传
                        </span>
                        <button
                          className="btn-sm btn-danger"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => handleClearInnerImages(p.id)}
                        >清空全部</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {innerImages.map((img, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={(e) => handleInnerImageDragStart(e, p.id, idx)}
                            onDragEnd={handleInnerImageDragEnd}
                            onDragOver={handleInnerImageDragOver}
                            onDrop={() => handleInnerImageDrop(p.id, idx)}
                            style={{
                              position: 'relative', display: 'inline-block',
                              cursor: 'grab',
                              border: (dragIndex === idx && dragProductId === p.id) ? '2px solid #00897b' : '2px solid transparent',
                              borderRadius: 8, padding: 1,
                              transition: 'border-color 0.2s',
                            }}
                          >
                            <img
                              src={img}
                              alt={`内页图${idx + 1}`}
                              style={{
                                width: 80, height: 80, objectFit: 'cover',
                                borderRadius: 6, border: '1px solid #ccc',
                                pointerEvents: 'none',
                              }}
                            />
                            <span style={{
                              position: 'absolute', bottom: 2, left: 2,
                              background: 'rgba(0,0,0,0.55)', color: '#fff',
                              fontSize: 10, padding: '1px 5px', borderRadius: 4,
                            }}>{idx + 1}</span>
                            <button
                              onClick={() => handleDeleteInnerImage(p.id, idx)}
                              style={{
                                position: 'absolute', top: -6, right: -6,
                                width: 20, height: 20, borderRadius: '50%',
                                background: '#e53935', color: '#fff', border: 'none',
                                cursor: 'pointer', fontSize: 12, lineHeight: '18px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >脳</button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleInnerImageUpload(p.id)}
                          style={{
                            width: 80, height: 80, borderRadius: 6,
                            border: '2px dashed #b2dfdb', background: '#e0f2f1',
                            cursor: 'pointer', fontSize: 24, color: '#00897b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >+</button>
                      </div>
                    </div>
                  )}
                </div>

                {refEditing === p.id && renderRefEditor(p)}
                {promptEditing === p.id && renderPromptEditor(p)}
                {seoEditing === p.id && renderSeoEditor(p)}
                {coverEditing === p.id && renderCoverEditor(p)}
              </div>
            )
          })}
        </div>
      )}

      {products.length === 0 && <p className="empty-state">该店铺还没有商品，请先在店铺管理中从千帆同步。</p>}
    </div>
  )
}

