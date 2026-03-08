import { useState } from 'react'

export default function Settings({ settings, onSave }) {
  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)

  const handleChange = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="panel">
      <h2>⚙️ AI 配置</h2>
      <div className="form-group">
        <label>API Key</label>
        <input
          type="password"
          value={form.apiKey}
          onChange={e => handleChange('apiKey', e.target.value)}
          placeholder="输入火山方舟 API Key"
        />
      </div>
      <div className="form-group">
        <label>推理接入点 ID (Endpoint ID)</label>
        <input
          value={form.endpointId}
          onChange={e => handleChange('endpointId', e.target.value)}
          placeholder="例如 ep-2024xxxx"
        />
      </div>
      <div className="form-group">
        <label>Base URL</label>
        <input
          value={form.baseUrl}
          onChange={e => handleChange('baseUrl', e.target.value)}
          placeholder="https://ark.cn-beijing.volces.com/api/v3"
        />
      </div>

      <button className="btn-primary" onClick={handleSave}>
        {saved ? '✅ 已保存' : '保存配置'}
      </button>
    </div>
  )
}
