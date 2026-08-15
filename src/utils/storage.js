const KEYS = {
  SETTINGS: 'rb_settings',
  SHOPS: 'rb_shops',
  GENERATED: 'rb_generated',
  STYLE_TEMPLATES: 'rb_style_templates',
  FISSION: 'rb_fission',
}

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_IMAGE_GENERATION = {
  apiKey: '',
  endpointId: '',
  baseUrl: '',
  inheritApiKey: true,
  inheritBaseUrl: true,
  size: 'auto',
  resolution: '2K',
}

function normalizeImageGeneration(raw, profile = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const profileBaseUrl = profile.baseUrl || DEFAULT_BASE_URL
  const sourceApiKey = source.apiKey || ''
  const sourceBaseUrl = source.baseUrl || ''
  const inheritApiKey = typeof source.inheritApiKey === 'boolean'
    ? source.inheritApiKey
    : !sourceApiKey
  const inheritBaseUrl = typeof source.inheritBaseUrl === 'boolean'
    ? source.inheritBaseUrl
    : (!sourceBaseUrl || sourceBaseUrl === profileBaseUrl)

  return {
    ...DEFAULT_IMAGE_GENERATION,
    ...source,
    apiKey: sourceApiKey,
    endpointId: source.endpointId || '',
    baseUrl: sourceBaseUrl,
    inheritApiKey,
    inheritBaseUrl,
    size: source.size || 'auto',
    resolution: ['2K', '4K'].includes(source.resolution) ? source.resolution : '2K',
  }
}

export function resolveProfileImageGeneration(profile = {}) {
  const imageGeneration = normalizeImageGeneration(profile.imageGeneration, profile)
  return {
    ...imageGeneration,
    apiKey: imageGeneration.inheritApiKey ? (profile.apiKey || '') : imageGeneration.apiKey,
    baseUrl: imageGeneration.inheritBaseUrl
      ? (profile.baseUrl || DEFAULT_BASE_URL)
      : (imageGeneration.baseUrl || DEFAULT_BASE_URL),
  }
}

function createProfile(overrides = {}) {
  const profile = {
    id: overrides.id || `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name || '默认配置',
    apiKey: overrides.apiKey || '',
    endpointId: overrides.endpointId || '',
    baseUrl: overrides.baseUrl || DEFAULT_BASE_URL,
  }
  return {
    ...profile,
    imageGeneration: normalizeImageGeneration(overrides.imageGeneration, profile),
  }
}

export function normalizeSettingsState(raw) {
  // 新版：多配置结构
  if (raw && Array.isArray(raw.profiles) && raw.profiles.length > 0) {
    const baseProfiles = raw.profiles.map((item, idx) => createProfile({
      ...item,
      name: item?.name || `配置${idx + 1}`,
      baseUrl: item?.baseUrl || DEFAULT_BASE_URL,
    }))

    const activeProfileId = raw.activeProfileId && baseProfiles.some(p => p.id === raw.activeProfileId)
      ? raw.activeProfileId
      : baseProfiles[0].id

    const hasPerProfileImageSettings = raw.profiles.some(item => item?.imageGeneration)
    const profiles = baseProfiles.map((profile, index) => {
      const storedProfileSettings = raw.profiles[index]?.imageGeneration
      const legacySettings = !hasPerProfileImageSettings && profile.id === activeProfileId
        ? raw.imageGeneration
        : null
      return {
        ...profile,
        imageGeneration: normalizeImageGeneration(storedProfileSettings || legacySettings, profile),
      }
    })

    const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0]

    return {
      ...raw,
      apiKey: activeProfile.apiKey || '',
      endpointId: activeProfile.endpointId || '',
      baseUrl: activeProfile.baseUrl || DEFAULT_BASE_URL,
      profiles,
      activeProfileId,
      imageGeneration: resolveProfileImageGeneration(activeProfile),
    }
  }

  // 旧版：单配置结构 -> 自动迁移为多配置
  const legacyProfile = createProfile({
    id: 'cfg_legacy_default',
    name: '字节方舟',
    apiKey: raw?.apiKey || '',
    endpointId: raw?.endpointId || '',
    baseUrl: raw?.baseUrl || DEFAULT_BASE_URL,
    imageGeneration: raw?.imageGeneration,
  })

  return {
    apiKey: legacyProfile.apiKey,
    endpointId: legacyProfile.endpointId,
    baseUrl: legacyProfile.baseUrl,
    profiles: [legacyProfile],
    activeProfileId: legacyProfile.id,
    imageGeneration: resolveProfileImageGeneration(legacyProfile),
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS)
    if (!raw) return normalizeSettingsState(null)
    return normalizeSettingsState(JSON.parse(raw))
  } catch { return normalizeSettingsState(null) }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(normalizeSettingsState(settings)))
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
  // 存储前剥离大字段，避免 base64 图片撑爆 localStorage
  const lite = notes.map(n => {
    const { innerImages, raw, downloadedImages, coverImage, ...rest } = n
    return rest
  })

  // 先尝试直接保存
  try {
    localStorage.setItem(KEYS.GENERATED, JSON.stringify(lite))
    return { status: 'ok' }
  } catch {
    // 配额不足，尝试截断保存
  }

  // 逐步减少数据量直到能存下
  let trimmed = lite
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

export function loadFissionData() {
  try {
    const raw = localStorage.getItem(KEYS.FISSION)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveFissionData(data) {
  try {
    localStorage.setItem(KEYS.FISSION, JSON.stringify(data))
  } catch (e) {
    console.warn('保存裂变数据失败:', e.message)
  }
}
