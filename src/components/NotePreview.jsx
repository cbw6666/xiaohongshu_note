import { useState, useRef, useEffect } from 'react'
import CoverCanvas from './CoverCanvas.jsx'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'
import { humanizeNote } from '../services/humanizerService.js'

export default function NotePreview({ notes, onUpdateNote, onDeleteNote, settings }) {
  const [filter, setFilter] = useState({ shop: '', account: '', product: '' })
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // 去AI味相关状态
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [humanizing, setHumanizing] = useState(false)
  const [humanizeProgress, setHumanizeProgress] = useState(null) // { current, total, text }
  const [humanizedIds, setHumanizedIds] = useState(new Set())
  const [singleHumanizingId, setSingleHumanizingId] = useState(null)
  const abortRef = useRef(false)

  const shopNames = [...new Set(notes.map(n => n.shopName))].filter(Boolean)
  const accounts = [...new Set(notes.map(n => n.accountName))].filter(Boolean)
  const products = [...new Set(notes.map(n => n.productName))].filter(Boolean)

  const filtered = notes.filter(n => {
    if (filter.shop && n.shopName !== filter.shop) return false
    if (filter.account && n.accountName !== filter.account) return false
    if (filter.product && n.productName !== filter.product) return false
    return true
  })

  const filteredIds = new Set(filtered.map(n => n.id))
  const selectedInView = [...selectedIds].filter(id => filteredIds.has(id))
  const allSelected = filtered.length > 0 && filtered.every(n => selectedIds.has(n.id))

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(n => next.delete(n.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(n => next.add(n.id))
        return next
      })
    }
  }

  const handleHumanizeSingle = async (note) => {
    if (!settings?.apiKey || !settings?.endpointId) {
      alert('请先在设置中配置 API Key 和推理接入点')
      return
    }
    setSingleHumanizingId(note.id)
    try {
      const result = await humanizeNote(settings, note)
      onUpdateNote(note.id, { title: result.title, content: result.content })
      setHumanizedIds(prev => new Set(prev).add(note.id))
    } catch (err) {
      alert('去AI味失败: ' + err.message)
    }
    setSingleHumanizingId(null)
  }

  const handleHumanizeBatch = async () => {
    if (!settings?.apiKey || !settings?.endpointId) {
      alert('请先在设置中配置 API Key 和推理接入点')
      return
    }
    const targetNotes = notes.filter(n => selectedIds.has(n.id))
    if (targetNotes.length === 0) return

    setHumanizing(true)
    abortRef.current = false
    setHumanizeProgress({ current: 0, total: targetNotes.length, text: '准备中...' })

    for (let i = 0; i < targetNotes.length; i++) {
      if (abortRef.current) break
      const note = targetNotes[i]
      setHumanizeProgress({
        current: i,
        total: targetNotes.length,
        text: `正在处理第 ${i + 1}/${targetNotes.length} 篇：${note.title?.slice(0, 20) || ''}...`,
      })
      try {
        const result = await humanizeNote(settings, note)
        onUpdateNote(note.id, { title: result.title, content: result.content })
        setHumanizedIds(prev => new Set(prev).add(note.id))
      } catch (err) {
        console.error(`去痕失败 [${note.id}]:`, err)
      }
      setHumanizeProgress(prev => ({ ...prev, current: i + 1 }))
    }

    setHumanizing(false)
    setHumanizeProgress(null)
    setSelectedIds(new Set())
  }

  const handleStopHumanize = () => {
    abortRef.current = true
  }

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
        <>
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

          {/* 批量去AI味工具栏 */}
          <div className="humanize-toolbar">
            <label className="humanize-select-all" onClick={toggleSelectAll}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                disabled={humanizing}
              />
              <span>全选</span>
            </label>

            {selectedInView.length > 0 && (
              <span className="humanize-selected-count">已选 {selectedInView.length} 篇</span>
            )}

            <div className="humanize-toolbar-actions">
              {!humanizing ? (
                <button
                  className="btn-humanize"
                  disabled={selectedInView.length === 0}
                  onClick={handleHumanizeBatch}
                >
                  🪄 批量去AI味{selectedInView.length > 0 ? ` (${selectedInView.length}篇)` : ''}
                </button>
              ) : (
                <button className="btn-humanize btn-humanize-stop" onClick={handleStopHumanize}>
                  ⏹ 停止
                </button>
              )}
            </div>
          </div>

          {/* 去痕进度条 */}
          {humanizeProgress && (
            <div className="progress-bar" style={{ marginTop: 0, marginBottom: 16 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${(humanizeProgress.current / humanizeProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #9C27B0, #CE93D8)',
                }}
              />
              <span className="progress-text">{humanizeProgress.text}</span>
            </div>
          )}
        </>
      )}

      <div className="notes-grid">
        {filtered.map((note, idx) => {
          const isHumanized = humanizedIds.has(note.id)
          const isHumanizingSingle = singleHumanizingId === note.id

          return (
            <div key={note.id} className={`note-card ${note.error ? 'error' : ''} ${isHumanized ? 'humanized' : ''}`}>
              <div className="note-card-header">
                <input
                  type="checkbox"
                  className="note-checkbox"
                  checked={selectedIds.has(note.id)}
                  onChange={(e) => toggleSelect(note.id, e)}
                  disabled={humanizing}
                />
                <div
                  className="note-card-header-content"
                  onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                >
                  <div className="note-meta">
                    <span className="badge badge-shop">{note.shopName}</span>
                    <span className="badge">{note.accountName}</span>
                    <span className="badge badge-alt">{note.productName}</span>
                    {isHumanized && <span className="badge badge-humanized">✓ 已去痕</span>}
                  </div>
                  <h4 className="note-title">{note.title}</h4>
                  <span className="expand-icon">{expandedId === note.id ? '▼' : '▶'}</span>
                </div>
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
                      {note.source !== 'collected' && (
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
                      )}
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
                          {note.source === 'collected' && note.coverImage ? (
                            <img
                              src={note.coverImage}
                              alt="封面"
                              style={{ width: 200, borderRadius: 8, objectFit: 'cover' }}
                            />
                          ) : (
                            <CoverCanvas
                              templateId={note.coverTemplateId}
                              data={{ title: note.coverTitle, subtitle: note.coverSubtitle }}
                              colorIdx={idx}
                              width={200}
                            />
                          )}
                        </div>
                      </div>
                      {/* 内页图预览 */}
                      {(note.innerImages || []).length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                            {note.source === 'collected'
                              ? `采集图片 (${note.innerImages.length}张)`
                              : `内页图 (${note.innerImages.length}张)`
                            }
                          </p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {note.innerImages.slice(0, 4).map((img, j) => (
                                <img
                                  key={j}
                                  src={img}
                                  alt={`图${j + 1}`}
                                  style={{ width: 140, height: 187, objectFit: 'cover', borderRadius: 6 }}
                                />
                            ))}
                            {note.innerImages.length > 4 && (
                              <span style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>
                                +{note.innerImages.length - 4} 张
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="btn-row">
                        <button className="btn-sm" onClick={() => startEdit(note)}>编辑</button>
                        <button
                          className="btn-sm btn-humanize-single"
                          onClick={() => handleHumanizeSingle(note)}
                          disabled={isHumanizingSingle || humanizing}
                        >
                          {isHumanizingSingle ? '⏳ 处理中...' : '🪄 去AI味'}
                        </button>
                        <button className="btn-sm btn-danger" onClick={() => onDeleteNote(note.id)}>删除</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {notes.length === 0 && <p className="empty-state">还没有生成的笔记，点击「开始批量生成」</p>}
    </div>
  )
}
