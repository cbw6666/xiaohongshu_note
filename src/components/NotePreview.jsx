import { useState } from 'react'
import CoverCanvas from './CoverCanvas.jsx'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'

export default function NotePreview({ notes, onUpdateNote, onDeleteNote }) {
  const [filter, setFilter] = useState({ shop: '', account: '', product: '' })
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const shopNames = [...new Set(notes.map(n => n.shopName))].filter(Boolean)
  const accounts = [...new Set(notes.map(n => n.accountName))].filter(Boolean)
  const products = [...new Set(notes.map(n => n.productName))].filter(Boolean)

  const filtered = notes.filter(n => {
    if (filter.shop && n.shopName !== filter.shop) return false
    if (filter.account && n.accountName !== filter.account) return false
    if (filter.product && n.productName !== filter.product) return false
    return true
  })

  const startEdit = (note) => {
    setEditingId(note.id)
    setEditForm({
      title: note.title,
      content: note.content,
      tags: note.tags,
      coverTitle: note.coverTitle,
      coverSubtitle: note.coverSubtitle,
      coverTemplateId: note.coverTemplateId,
    })
  }

  const saveEdit = (noteId) => {
    onUpdateNote(noteId, editForm)
    setEditingId(null)
  }

  return (
    <div className="panel">
      <h2>📋 生成结果 ({notes.length} 篇)</h2>

      {notes.length > 0 && (
        <div className="filter-bar">
          <select value={filter.shop} onChange={e => setFilter(p => ({ ...p, shop: e.target.value }))}>
            <option value="">全部店铺</option>
            {shopNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filter.account} onChange={e => setFilter(p => ({ ...p, account: e.target.value }))}>
            <option value="">全部账号</option>
            {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filter.product} onChange={e => setFilter(p => ({ ...p, product: e.target.value }))}>
            <option value="">全部商品</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {(filter.shop || filter.account || filter.product) && (
            <span className="filter-count">显示 {filtered.length} / {notes.length}</span>
          )}
        </div>
      )}

      <div className="notes-grid">
        {filtered.map((note, idx) => (
          <div key={note.id} className={`note-card ${note.error ? 'error' : ''}`}>
            <div className="note-card-header" onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}>
              <div className="note-meta">
                <span className="badge badge-shop">{note.shopName}</span>
                <span className="badge">{note.accountName}</span>
                <span className="badge badge-alt">{note.productName}</span>
              </div>
              <h4 className="note-title">{note.title}</h4>
              <span className="expand-icon">{expandedId === note.id ? '▼' : '▶'}</span>
            </div>

            {expandedId === note.id && (
              <div className="note-card-body">
                {editingId === note.id ? (
                  <div className="note-edit">
                    <div className="form-group">
                      <label>标题</label>
                      <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>正文</label>
                      <textarea value={editForm.content} onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))} rows={8} />
                    </div>
                    <div className="form-group">
                      <label>标签</label>
                      <input value={editForm.tags} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))} />
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>封面主标题</label>
                        <input value={editForm.coverTitle} onChange={e => setEditForm(p => ({ ...p, coverTitle: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>封面副标题</label>
                        <input value={editForm.coverSubtitle} onChange={e => setEditForm(p => ({ ...p, coverSubtitle: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>封面模板</label>
                        <select value={editForm.coverTemplateId} onChange={e => setEditForm(p => ({ ...p, coverTemplateId: e.target.value }))}>
                          {COVER_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="btn-row">
                      <button className="btn-primary" onClick={() => saveEdit(note.id)}>保存</button>
                      <button className="btn-secondary" onClick={() => setEditingId(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-content-row">
                      <div className="note-text">
                        <p className="note-content">{note.content}</p>
                        <p className="note-tags">{note.tags}</p>
                      </div>
                      <div className="note-cover">
                        <CoverCanvas
                          templateId={note.coverTemplateId}
                          data={{ title: note.coverTitle, subtitle: note.coverSubtitle }}
                          colorIdx={idx}
                          width={200}
                        />
                      </div>
                    </div>
                    <div className="btn-row">
                      <button className="btn-sm" onClick={() => startEdit(note)}>编辑</button>
                      <button className="btn-sm btn-danger" onClick={() => onDeleteNote(note.id)}>删除</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {notes.length === 0 && <p className="empty-state">还没有生成的笔记，点击「开始批量生成」</p>}
    </div>
  )
}
