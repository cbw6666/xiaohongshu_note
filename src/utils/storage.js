const KEYS = {
  SETTINGS: 'rb_settings',
  SHOPS: 'rb_shops',
  GENERATED: 'rb_generated',
  STYLE_TEMPLATES: 'rb_style_templates',
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS)
    return raw ? JSON.parse(raw) : {
      apiKey: '',
      endpointId: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    }
  } catch { return { apiKey: '', endpointId: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' } }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings))
  } catch (e) {
    console.warn('保存设置失败:', e.message)
  }
}

export function loadShops() {
  try {
    const raw = localStorage.getItem(KEYS.SHOPS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveShops(shops) {
  try {
    localStorage.setItem(KEYS.SHOPS, JSON.stringify(shops))
  } catch (e) {
    console.warn('保存店铺数据失败:', e.message)
  }
}

export function loadGenerated() {
  try {
    const raw = localStorage.getItem(KEYS.GENERATED)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveGenerated(notes) {
  // 先尝试直接保存
  try {
    localStorage.setItem(KEYS.GENERATED, JSON.stringify(notes))
    return { status: 'ok' }
  } catch {
    // 配额不足，尝试截断保存
  }

  // 逐步减少数据量直到能存下
  let trimmed = notes
  while (trimmed.length > 0) {
    trimmed = trimmed.slice(0, Math.max(1, Math.floor(trimmed.length * 0.8)))
    try {
      localStorage.setItem(KEYS.GENERATED, JSON.stringify(trimmed))
      return { status: 'trimmed', kept: trimmed.length, total: notes.length }
    } catch {
      // 继续缩减
    }
  }

  // 实在存不下，清空 generated 释放空间
  try {
    localStorage.removeItem(KEYS.GENERATED)
    return { status: 'cleared', total: notes.length }
  } catch {
    return { status: 'error', total: notes.length }
  }
}

export function loadStyleTemplates() {
  try {
    const raw = localStorage.getItem(KEYS.STYLE_TEMPLATES)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveStyleTemplates(templates) {
  try {
    localStorage.setItem(KEYS.STYLE_TEMPLATES, JSON.stringify(templates))
  } catch (e) {
    console.warn('保存风格模板失败:', e.message)
  }
}
