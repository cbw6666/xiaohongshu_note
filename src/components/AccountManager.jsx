import { useState } from 'react'

export default function AccountManager({ shop, onUpdateShop }) {
  const [form, setForm] = useState({ name: '' })

  if (!shop) return <div className="panel"><p className="empty-state">请先在左侧选择一个店铺</p></div>

  const accounts = shop.accounts || []

  const handleAdd = () => {
    if (!form.name.trim()) return
    const newAcc = { ...form, id: Date.now().toString() }
    onUpdateShop({ ...shop, accounts: [...accounts, newAcc] })
    setForm({ name: '' })
  }

  const handleDelete = (id) => {
    onUpdateShop({ ...shop, accounts: accounts.filter(a => a.id !== id) })
  }

  const handleBatchAdd = () => {
    const count = prompt('批量添加账号数量（将自动命名为 账号1、账号2...）：', '10')
    if (!count) return
    const num = parseInt(count)
    if (isNaN(num) || num < 1) return
    const existingCount = accounts.length
    const newAccounts = Array.from({ length: num }, (_, i) => ({
      id: Date.now().toString() + i,
      name: `${shop.name}-账号${existingCount + i + 1}`,
    }))
    onUpdateShop({ ...shop, accounts: [...accounts, ...newAccounts] })
  }

  return (
    <div className="panel">
      <h2>👤 账号管理 <span className="panel-sub">— {shop.name}</span></h2>

      <div className="form-grid">
        <div className="form-group">
          <label>账号名称</label>
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="例如：学习小助手"
          />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={handleAdd}>添加账号</button>
        <button className="btn-secondary" onClick={handleBatchAdd}>批量添加</button>
      </div>

      {accounts.length > 0 && (
        <div className="item-list">
          {accounts.map(a => (
            <div key={a.id} className="item-card">
              <div className="item-info">
                <strong>{a.name}</strong>
              </div>
              <div className="item-actions">
                <button className="btn-sm btn-danger" onClick={() => handleDelete(a.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="hint">已添加 {accounts.length} 个账号</p>
    </div>
  )
}
