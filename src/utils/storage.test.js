import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadSettings,
  normalizeSettingsState,
  resolveProfileImageGeneration,
  saveSettings,
} from './storage.js'

function createLocalStorage() {
  const values = new Map()
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('migrates legacy global image settings only to the active profile', () => {
  const settings = normalizeSettingsState({
    activeProfileId: 'profile_b',
    profiles: [
      { id: 'profile_a', name: 'A', apiKey: 'key-a', endpointId: 'chat-a' },
      { id: 'profile_b', name: 'B', apiKey: 'key-b', endpointId: 'chat-b' },
    ],
    imageGeneration: {
      endpointId: 'seedream-b',
      size: '3:4',
      resolution: '4K',
    },
  })

  assert.equal(settings.profiles[0].imageGeneration.endpointId, '')
  assert.equal(settings.profiles[1].imageGeneration.endpointId, 'seedream-b')
  assert.equal(settings.imageGeneration.apiKey, 'key-b')
  assert.equal(settings.imageGeneration.endpointId, 'seedream-b')
})

test('resolves inherited and dedicated image credentials correctly', () => {
  const inherited = resolveProfileImageGeneration({
    apiKey: 'profile-key',
    baseUrl: 'https://profile.example/v1',
    imageGeneration: {
      inheritApiKey: true,
      inheritBaseUrl: true,
      apiKey: 'unused-key',
      baseUrl: 'https://unused.example/v1',
      endpointId: 'seedream-a',
    },
  })
  assert.equal(inherited.apiKey, 'profile-key')
  assert.equal(inherited.baseUrl, 'https://profile.example/v1')

  const dedicated = resolveProfileImageGeneration({
    apiKey: 'profile-key',
    baseUrl: 'https://profile.example/v1',
    imageGeneration: {
      inheritApiKey: false,
      inheritBaseUrl: false,
      apiKey: 'image-key',
      baseUrl: 'https://image.example/v1',
      endpointId: 'seedream-b',
    },
  })
  assert.equal(dedicated.apiKey, 'image-key')
  assert.equal(dedicated.baseUrl, 'https://image.example/v1')
})

test('saves and reloads per-profile image settings synchronously', () => {
  globalThis.localStorage = createLocalStorage()
  const settings = normalizeSettingsState({
    activeProfileId: 'profile_a',
    profiles: [{
      id: 'profile_a',
      name: 'A',
      apiKey: 'key-a',
      endpointId: 'chat-a',
      imageGeneration: {
        inheritApiKey: true,
        inheritBaseUrl: true,
        endpointId: 'seedream-a',
        size: '1:1',
        resolution: '2K',
      },
    }],
  })

  saveSettings(settings)
  const loaded = loadSettings()
  assert.equal(loaded.profiles[0].imageGeneration.endpointId, 'seedream-a')
  assert.equal(loaded.imageGeneration.apiKey, 'key-a')
})
