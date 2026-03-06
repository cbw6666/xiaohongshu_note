const KEYS = {
  SETTINGS: 'rb_settings',
  SHOPS: 'rb_shops',
  GENERATED: 'rb_generated',
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS)
    return raw ? JSON.parse(raw) : {
      apiKey: '',
      endpointId: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      notesPerAccount: 5,
    }
  } catch { return { apiKey: '', endpointId: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', notesPerAccount: 5 } }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings))
}

export function loadShops() {
  try {
    const raw = localStorage.getItem(KEYS.SHOPS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveShops(shops) {
  localStorage.setItem(KEYS.SHOPS, JSON.stringify(shops))
}

export function loadGenerated() {
  try {
    const raw = localStorage.getItem(KEYS.GENERATED)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveGenerated(notes) {
  localStorage.setItem(KEYS.GENERATED, JSON.stringify(notes))
}
