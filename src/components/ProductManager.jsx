import { useState } from 'react'
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from '../services/aiService.js'

export default function ProductManager({ shop, onUpdateShop }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', productId: '', description: '', audience: '', sellingPoints: '' })
  const [promptEditing, setPromptEditing] = useState(null)
  const [promptForm, setPromptForm] = useState({ customSystemPrompt: '', customUserPrompt: '' })
  // 爆文参考
  const [refEditing, setRefEditing] = useState(null) // 正在编辑爆文的商品ID
  const [refForm, setRefForm] = useState({ title: '', content: '', tags: '' })

  if (!shop) return <div className="panel"><p className="empty-state">请先在左侧选择一个店铺</p></div>

  const products = shop.products || []

  const resetForm = () => {
    setForm({ name: '', productId: '', description: '', audience: '', sellingPoints: '' })
    setEditing(null)
  }

  const handleEdit = (p) => {
    setEditing(p.id)
    setForm({
      name: p.name,
      productId: p.productId || '',
      description: p.description || '',
      audience: p.audience || '',
      sellingPoints: p.sellingPoints || '',
    })
  }

  const handleSave = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === editing ? { ...p, ...form } : p),
    })
    resetForm()
  }

  const handleDelete = (id) => {
    onUpdateShop({ ...shop, products: products.filter(p => p.id !== id) })
  }

  // 提示词编辑
  const handleEditPrompt = (p) => {
    setPromptEditing(p.id)
    setPromptForm({
      customSystemPrompt: p.customSystemPrompt || '',
      customUserPrompt: p.customUserPrompt || '',
    })
  }

  const handleSavePrompt = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === promptEditing ? {
        ...p,
        customSystemPrompt: promptForm.customSystemPrompt.trim() || undefined,
        customUserPrompt: promptForm.customUserPrompt.trim() || undefined,
      } : p),
    })
    setPromptEditing(null)
    setPromptForm({ customSystemPrompt: '', customUserPrompt: '' })
  }

  const handleResetPrompt = (field) => {
    if (field === 'system') {
      setPromptForm(prev => ({ ...prev, customSystemPrompt: DEFAULT_SYSTEM_PROMPT }))
    } else {
      setPromptForm(prev => ({ ...prev, customUserPrompt: DEFAULT_USER_PROMPT }))
    }
  }

  const handleClearPrompt = () => {
    setPromptForm({ customSystemPrompt: '', customUserPrompt: '' })
  }

  // 爆文参考管理
  const handleOpenRef = (p) => {
    setRefEditing(p.id)
    setRefForm({ title: '', content: '', tags: '' })
  }

  const handleAddRef = () => {
    if (!refForm.title.trim() && !refForm.content.trim()) return
    const product = products.find(p => p.id === refEditing)
    if (!product) return
    const newRef = {
      id: Date.now().toString(),
      title: refForm.title.trim(),
      content: refForm.content.trim(),
      tags: refForm.tags.trim(),
    }
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === refEditing
        ? { ...p, references: [...(p.references || []), newRef] }
        : p
      ),
    })
    setRefForm({ title: '', content: '', tags: '' })
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

  return (
    <div className="panel">
      <h2>📦 商品管理 <span className="panel-sub">— {shop.name}</span></h2>
      <p className="hint" style={{ marginBottom: 12 }}>商品从千帆导入，可补充信息、添加爆文参考、定制提示词</p>

      {/* 基础信息编辑表单 */}
      {editing && (
        <>
          <div className="form-grid">
            <div className="form-group">
              <label>商品名称</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="商品名称"
              />
            </div>
            {form.productId && (
              <div className="form-group">
                <label>商品ID</label>
                <span style={{ fontSize: 12, color: '#aaa', lineHeight: '38px' }}>{form.productId}</span>
              </div>
            )}
            <div className="form-group">
              <label>目标人群</label>
              <input
                value={form.audience}
                onChange={e => setForm(p => ({ ...p, audience: e.target.value }))}
                placeholder="例如：考研党、大学生"
              />
            </div>
            <div className="form-group">
              <label>核心卖点</label>
              <input
                value={form.sellingPoints}
                onChange={e => setForm(p => ({ ...p, sellingPoints: e.target.value }))}
                placeholder="用逗号分隔多个卖点"
              />
            </div>
            <div className="form-group full-width">
              <label>商品描述</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="简要描述资料内容和特点"
                rows={2}
              />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn-primary" onClick={handleSave}>保存修改</button>
            <button className="btn-secondary" onClick={resetForm}>取消</button>
          </div>
        </>
      )}

      {/* 爆文参考编辑面板 */}
      {refEditing && (
        <div style={{
          background: '#fff8f0', border: '1px solid #ffcc80', borderRadius: 12,
          padding: 20, marginBottom: 16
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
            🔥 爆文参考 — {products.find(p => p.id === refEditing)?.name}
          </h3>
          <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
            粘贴小红书爆款笔记的标题和正文，系统会自动分析爆款因子并仿写。可添加多篇参考。
          </p>

          {/* 已添加的爆文列表 */}
          {(() => {
            const refs = products.find(p => p.id === refEditing)?.references || []
            return refs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {refs.map((ref, idx) => (
                  <div key={ref.id} style={{
                    background: '#fff', border: '1px solid #ffe0b2', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 8, position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                          参考{idx + 1}：{ref.title || '(无标题)'}
                        </div>
                        <div style={{
                          fontSize: 12, color: '#666', lineHeight: 1.6,
                          maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {ref.content?.slice(0, 100)}{ref.content?.length > 100 ? '...' : ''}
                        </div>
                        {ref.tags && (
                          <div style={{ fontSize: 11, color: '#e65100', marginTop: 4 }}>{ref.tags}</div>
                        )}
                      </div>
                      <button
                        className="btn-sm btn-danger"
                        style={{ marginLeft: 10, flexShrink: 0 }}
                        onClick={() => handleDeleteRef(refEditing, ref.id)}
                      >删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* 添加新爆文 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>添加参考爆文</label>
            <input
              value={refForm.title}
              onChange={e => setRefForm(p => ({ ...p, title: e.target.value }))}
              placeholder="爆文标题"
              style={{ width: '100%', marginBottom: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
            />
            <textarea
              value={refForm.content}
              onChange={e => setRefForm(p => ({ ...p, content: e.target.value }))}
              placeholder="粘贴爆文正文内容..."
              rows={6}
              style={{ width: '100%', marginBottom: 8, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}
            />
            <input
              value={refForm.tags}
              onChange={e => setRefForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="标签（可选），例如：#考研 #上岸 #复试"
              style={{ width: '100%', marginBottom: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
            />
          </div>

          <div className="btn-row">
            <button className="btn-primary" onClick={handleAddRef}
              disabled={!refForm.title.trim() && !refForm.content.trim()}>
              添加此爆文
            </button>
            <button className="btn-secondary" onClick={() => setRefEditing(null)}>完成</button>
          </div>
        </div>
      )}

      {/* 提示词编辑面板 */}
      {promptEditing && (
        <div className="prompt-editor" style={{
          background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 12,
          padding: 20, marginBottom: 16
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
            ✏️ 自定义提示词 — {products.find(p => p.id === promptEditing)?.name}
          </h3>
          <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
            留空则使用默认提示词。提示词中的 <code>{'{变量}'}</code> 会在生成时自动替换为"补充信息"中的内容，无需手动填写。
          </p>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>System Prompt（角色设定）</label>
              <button className="btn-sm" onClick={() => handleResetPrompt('system')}
                style={{ fontSize: 11, padding: '2px 8px' }}>填入默认值</button>
            </div>
            <textarea
              value={promptForm.customSystemPrompt}
              onChange={e => setPromptForm(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
              placeholder={DEFAULT_SYSTEM_PROMPT}
              rows={8}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
            />
          </div>

          <div className="btn-row">
            <button className="btn-primary" onClick={handleSavePrompt}>保存提示词</button>
            <button className="btn-secondary" onClick={handleClearPrompt}>清空（恢复默认）</button>
            <button className="btn-secondary" onClick={() => { setPromptEditing(null) }}>取消</button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="item-list">
          {products.map(p => {
            const refCount = (p.references || []).length
            return (
              <div key={p.id} className="item-card">
                <div className="item-info">
                  <strong>{p.name}</strong>
                  <span className="item-meta">
                    {p.productId && <span className="product-id">ID: {p.productId}</span>}
                    {p.audience || '未设置人群'}
                    {p.sellingPoints && <span style={{ marginLeft: 6, color: '#888' }}>· {p.sellingPoints}</span>}
                    {refCount > 0 && (
                      <span style={{ marginLeft: 6, color: '#e65100', fontWeight: 600 }}>🔥 {refCount}篇爆文参考</span>
                    )}
                    {(p.customSystemPrompt || p.customUserPrompt) && (
                      <span style={{ marginLeft: 6, color: '#e67e22', fontWeight: 600 }}>📝 已定制提示词</span>
                    )}
                  </span>
                </div>
                <div className="item-actions">
                  <button className="btn-sm" onClick={() => handleEdit(p)}>补充信息</button>
                  <button className="btn-sm" onClick={() => handleOpenRef(p)}
                    style={{ background: refCount > 0 ? '#fff3e0' : undefined }}>
                    {refCount > 0 ? `爆文参考(${refCount})` : '爆文参考'}
                  </button>
                  <button className="btn-sm" onClick={() => handleEditPrompt(p)}
                    style={{ background: (p.customSystemPrompt || p.customUserPrompt) ? '#fff3e0' : undefined }}>
                    {(p.customSystemPrompt || p.customUserPrompt) ? '编辑提示词' : '定制提示词'}
                  </button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(p.id)}>删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {products.length === 0 && <p className="empty-state">该店铺还没有商品，请在店铺管理中从千帆导入</p>}
    </div>
  )
}
