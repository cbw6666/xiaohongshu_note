import { useState, useEffect, useRef } from 'react'

export default function Settings({ settings, onSave }) {
  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef(null)

  const getProfiles = (state = form) => Array.isArray(state.profiles) && state.profiles.length > 0
    ? state.profiles
    : [{
      id: 'cfg_legacy_default',
      name: '默认配置',
      apiKey: state.apiKey || '',
      endpointId: state.endpointId || '',
      baseUrl: state.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
    }]

  const getActiveProfile = (state = form) => {
    const profiles = getProfiles(state)
    const activeId = state.activeProfileId && profiles.some(item => item.id === state.activeProfileId)
      ? state.activeProfileId
      : profiles[0].id
    return profiles.find(item => item.id === activeId) || profiles[0]
  }

  // 同步外部 settings prop 变化
  useEffect(() => {
    setForm({ ...settings })
  }, [settings])

  const updateForm = (next) => {
    setForm(next)
    setSaved(false)

    // 自动保存（防抖 500ms）
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSave(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 500)
  }

  const updateActiveProfile = (patch = {}) => {
    const profiles = getProfiles(form)
    const active = getActiveProfile(form)
    const nextProfiles = profiles.map(item => {
      if (item.id !== active.id) return item
      return { ...item, ...patch }
    })
    const nextActive = nextProfiles.find(item => item.id === active.id) || nextProfiles[0]
    const next = {
      ...form,
      profiles: nextProfiles,
      activeProfileId: nextActive.id,
      apiKey: nextActive.apiKey || '',
      endpointId: nextActive.endpointId || '',
      baseUrl: nextActive.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
    }
    updateForm(next)
  }

  const handleChange = (key, val) => {
    updateActiveProfile({ [key]: val })
  }

  const handleImageGenerationChange = (key, val) => {
    updateForm({
      ...form,
      imageGeneration: {
        ...(form.imageGeneration || {}),
        [key]: val,
      },
    })
  }

  const handleSwitchProfile = (profileId) => {
    const profiles = getProfiles(form)
    const selected = profiles.find(item => item.id === profileId)
    if (!selected) return
    updateForm({
      ...form,
      activeProfileId: selected.id,
      apiKey: selected.apiKey || '',
      endpointId: selected.endpointId || '',
      baseUrl: selected.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
    })
  }

  const handleAddProfile = () => {
    const profiles = getProfiles(form)
    const nextProfile = {
      id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `新配置${profiles.length + 1}`,
      apiKey: '',
      endpointId: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    }
    updateForm({
      ...form,
      profiles: [...profiles, nextProfile],
      activeProfileId: nextProfile.id,
      apiKey: nextProfile.apiKey,
      endpointId: nextProfile.endpointId,
      baseUrl: nextProfile.baseUrl,
    })
  }

  const handleSave = () => {
    clearTimeout(debounceRef.current)
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activeProfile = getActiveProfile(form)
  const profiles = getProfiles(form)

  return (
    <div className="panel">
      <h2>⚙️ AI 配置</h2>
      <div className="form-group">
        <label>当前配置</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={activeProfile.id}
            onChange={e => handleSwitchProfile(e.target.value)}
            style={{ flex: 1 }}
          >
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleAddProfile}>
            + 新增配置
          </button>
        </div>
      </div>
      <div className="form-group">
        <label>配置名称</label>
        <input
          value={activeProfile.name || ''}
          onChange={e => updateActiveProfile({ name: e.target.value })}
          placeholder="例如 字节方舟 / aicodee"
        />
      </div>
      <div className="form-group">
        <label>API Key</label>
        <input
          type="password"
          value={activeProfile.apiKey || ''}
          onChange={e => handleChange('apiKey', e.target.value)}
          placeholder="输入 API Key"
        />
      </div>
      <div className="form-group">
        <label>推理接入点 ID (Endpoint ID)</label>
        <input
          value={activeProfile.endpointId || ''}
          onChange={e => handleChange('endpointId', e.target.value)}
          placeholder="例如 ep-2024xxxx / MiniMax-M2.7-highspeed"
        />
      </div>
      <div className="form-group">
        <label>Base URL</label>
        <input
          value={activeProfile.baseUrl || ''}
          onChange={e => handleChange('baseUrl', e.target.value)}
          placeholder="https://xxx.com/v1"
        />
      </div>

      <div className="image-generation-settings" style={{
        margin: '18px 0 14px',
        padding: 14,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fafafa',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>图片生成配置</h3>
        <div className="form-group">
          <label>图片生成 API Key</label>
          <input
            type="password"
            value={form.imageGeneration?.apiKey || ''}
            onChange={e => handleImageGenerationChange('apiKey', e.target.value)}
            placeholder="留空则沿用当前配置的 API Key"
          />
        </div>
        <div className="form-group">
          <label>Seedream 接入点 ID</label>
          <input
            value={form.imageGeneration?.endpointId || ''}
            onChange={e => handleImageGenerationChange('endpointId', e.target.value)}
            placeholder="例如 doubao-seedream-4-5-xxxx 或对应接入点 ID"
          />
        </div>
        <div className="form-group">
          <label>图片生成 Base URL</label>
          <input
            value={form.imageGeneration?.baseUrl || ''}
            onChange={e => handleImageGenerationChange('baseUrl', e.target.value)}
            placeholder="留空则使用 https://ark.cn-beijing.volces.com/api/v3"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>生成参考比例</label>
            <select
              value={form.imageGeneration?.size || 'auto'}
              onChange={e => handleImageGenerationChange('size', e.target.value)}
            >
              <option value="auto">自动匹配原封面</option>
              <option value="1:1">1:1</option>
              <option value="3:4">3:4</option>
              <option value="4:3">4:3</option>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </select>
          </div>
          <div className="form-group">
            <label>清晰度</label>
            <select
              value={form.imageGeneration?.resolution || '2K'}
              onChange={e => handleImageGenerationChange('resolution', e.target.value)}
            >
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#777', margin: '2px 0 0' }}>
          用于“笔记采集”里的封面 AI 重绘；最终图片会自动处理成和原封面相同的像素尺寸。
        </p>
      </div>

      <button className="btn-primary" onClick={handleSave}>
        {saved ? '✅ 已保存' : '保存配置'}
      </button>

      <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
        💡 可保存多套配置并切换使用；输入后自动保存到浏览器本地
      </p>
    </div>
  )
}
