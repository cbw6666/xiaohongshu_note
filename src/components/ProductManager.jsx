import { useState, useRef } from 'react'
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT, callAI, buildAnalysisPrompt } from '../services/aiService.js'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'
import CoverCanvas from './CoverCanvas.jsx'

export default function ProductManager({ shop, onUpdateShop, settings, innerImagesMap, setInnerImagesMap }) {
  const [promptEditing, setPromptEditing] = useState(null)
  const [promptForm, setPromptForm] = useState({ customSystemPrompt: '', customUserPrompt: '' })
  // 爆文参考
  const [refEditing, setRefEditing] = useState(null)
  const [refForm, setRefForm] = useState({ text: '' })
  // AI 分析状态
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisPreview, setAnalysisPreview] = useState(null) // { text, analysis }
  const [analysisError, setAnalysisError] = useState('')
  // 风格模板
  const [saveAsTemplate, setSaveAsTemplate] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [showTemplateList, setShowTemplateList] = useState(false)
  // 封面自定义
  const [coverEditing, setCoverEditing] = useState(null)
  const [coverForm, setCoverForm] = useState({ coverTitle: '', coverSubtitle: '', coverTemplateId: '' })
  const [coverPreviewTplId, setCoverPreviewTplId] = useState(COVER_TEMPLATES[0]?.id || '')
  // 内页图上传
  const innerImageInputRef = useRef(null)
  const [innerImageTarget, setInnerImageTarget] = useState(null) // 当前正在上传内页图的商品ID
  // 内页图拖拽排序
  const [dragIndex, setDragIndex] = useState(null)
  const [dragProductId, setDragProductId] = useState(null)

  if (!shop) return <div className="panel"><p className="empty-state">请先在左侧选择一个店铺</p></div>

  const products = shop.products || []

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
    setRefForm({ text: '' })
    setAnalysisPreview(null)
    setAnalysisError('')
    setSaveAsTemplate(true)
    setTemplateName('')
    setShowTemplateList(false)
  }

  const handleAddRef = () => {
    if (!refForm.text.trim()) return
    const product = products.find(p => p.id === refEditing)
    if (!product) return
    const newRef = {
      id: Date.now().toString(),
      text: refForm.text.trim(),
    }
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === refEditing
        ? { ...p, references: [...(p.references || []), newRef] }
        : p
      ),
    })
    setRefForm({ text: '' })
    setAnalysisPreview(null)
  }

  // AI 分析后添加
  const handleAnalyzeAndAdd = async () => {
    if (!refForm.text.trim()) return
    if (!settings?.apiKey || !settings?.endpointId) {
      setAnalysisError('请先在设置页面配置 AI API Key 和推理接入点')
      return
    }

    setAnalyzing(true)
    setAnalysisError('')
    setAnalysisPreview(null)

    try {
      const messages = buildAnalysisPrompt(refForm.text.trim())
      const analysis = await callAI(settings, messages)
      setAnalysisPreview({ text: refForm.text.trim(), analysis })
    } catch (err) {
      setAnalysisError(`分析失败: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // 确认保存分析结果
  const handleConfirmAnalysis = () => {
    if (!analysisPreview) return
    const product = products.find(p => p.id === refEditing)
    if (!product) return
    const newRef = {
      id: Date.now().toString(),
      text: analysisPreview.text,
      analysis: analysisPreview.analysis,
    }
    // 是否同时保存为风格模板
    let updatedTemplates = product.styleTemplates || []
    if (saveAsTemplate && templateName.trim()) {
      updatedTemplates = [...updatedTemplates, {
        id: Date.now().toString() + '_t',
        name: templateName.trim(),
        sourceText: analysisPreview.text.slice(0, 200),
        analysis: analysisPreview.analysis,
        enabled: true,
        createdAt: Date.now(),
      }]
    }
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === refEditing
        ? { ...p, references: [...(p.references || []), newRef], styleTemplates: updatedTemplates }
        : p
      ),
    })
    setRefForm({ text: '' })
    setAnalysisPreview(null)
    setTemplateName('')
    setSaveAsTemplate(true)
  }

  // 切换风格模板启用/禁用
  const handleToggleTemplate = (productId, templateId) => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === productId
        ? { ...p, styleTemplates: (p.styleTemplates || []).map(t =>
            t.id === templateId ? { ...t, enabled: !t.enabled } : t
          )}
        : p
      ),
    })
  }

  // 删除风格模板
  const handleDeleteTemplate = (productId, templateId) => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === productId
        ? { ...p, styleTemplates: (p.styleTemplates || []).filter(t => t.id !== templateId) }
        : p
      ),
    })
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

  // 封面自定义
  const handleEditCover = (p) => {
    setCoverEditing(p.id)
    setCoverForm({
      coverTitle: p.customCoverTitle || '',
      coverSubtitle: p.customCoverSubtitle || '',
      coverTemplateId: p.customCoverTemplateId || '',
    })
    setCoverPreviewTplId(p.customCoverTemplateId || COVER_TEMPLATES[0]?.id || '')
  }

  const handleSaveCover = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === coverEditing ? {
        ...p,
        customCoverTitle: coverForm.coverTitle.trim() || undefined,
        customCoverSubtitle: coverForm.coverSubtitle.trim() || undefined,
        customCoverTemplateId: coverForm.coverTemplateId || undefined,
      } : p),
    })
    setCoverEditing(null)
  }

  const handleClearCover = () => {
    onUpdateShop({
      ...shop,
      products: products.map(p => p.id === coverEditing ? {
        ...p,
        customCoverTitle: undefined,
        customCoverSubtitle: undefined,
        customCoverTemplateId: undefined,
      } : p),
    })
    setCoverEditing(null)
  }

  // 内页图处理
  const handleInnerImageUpload = (productId) => {
    setInnerImageTarget(productId)
    innerImageInputRef.current?.click()
  }

  const handleInnerImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !innerImageTarget) return

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(file)
      })
    })

    Promise.all(readers).then(base64List => {
      setInnerImagesMap(prev => ({
        ...prev,
        [innerImageTarget]: [...(prev[innerImageTarget] || []), ...base64List]
      }))
      setInnerImageTarget(null)
    })

    // 重置 input 以允许重复上传同一文件
    e.target.value = ''
  }

  const handleDeleteInnerImage = (productId, index) => {
    setInnerImagesMap(prev => ({
      ...prev,
      [productId]: (prev[productId] || []).filter((_, i) => i !== index)
    }))
  }

  const handleClearInnerImages = (productId) => {
    setInnerImagesMap(prev => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  // 内页图拖拽排序
  const handleInnerImageDragStart = (e, productId, idx) => {
    setDragIndex(idx)
    setDragProductId(productId)
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.style.opacity = '0.4'
  }

  const handleInnerImageDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
    setDragIndex(null)
    setDragProductId(null)
  }

  const handleInnerImageDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleInnerImageDrop = (productId, dropIdx) => {
    if (dragIndex === null || dragProductId !== productId || dragIndex === dropIdx) return
    setInnerImagesMap(prev => {
      const imgs = [...(prev[productId] || [])]
      const [moved] = imgs.splice(dragIndex, 1)
      imgs.splice(dropIdx, 0, moved)
      return { ...prev, [productId]: imgs }
    })
    setDragIndex(null)
    setDragProductId(null)
  }

  return (
    <div className="panel">
      {/* 隐藏的内页图文件上传 input */}
      <input
        ref={innerImageInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInnerImageChange}
      />
      <h2>📦 商品管理 <span className="panel-sub">— {shop.name}</span></h2>
      <p className="hint" style={{ marginBottom: 12 }}>商品从千帆导入，可添加爆文参考（支持 AI 分析爆款因子）、定制提示词</p>

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
            直接粘贴小红书爆款笔记（标题+正文+标签均可），系统会自动分析爆款因子并仿写。可添加多篇参考。
          </p>

          {/* 已添加的爆文列表 */}
          {(() => {
            const refs = products.find(p => p.id === refEditing)?.references || []
            return refs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {refs.map((ref, idx) => {
                  // 兼容新旧格式：新格式用 ref.text，旧格式拼接 title+content
                  const displayText = ref.text || [ref.title, ref.content, ref.tags].filter(Boolean).join('\n')
                  return (
                    <div key={ref.id} style={{
                      background: '#fff', border: `1px solid ${ref.analysis ? '#ce93d8' : '#ffe0b2'}`, borderRadius: 8,
                      padding: '10px 14px', marginBottom: 8, position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            参考{idx + 1}
                            {ref.analysis && (
                              <span style={{ marginLeft: 8, fontSize: 11, color: '#7b1fa2', fontWeight: 600 }}>🔍 已分析爆款因子</span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 12, color: '#666', lineHeight: 1.6,
                            maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'pre-line'
                          }}>
                            {displayText.slice(0, 150)}{displayText.length > 150 ? '...' : ''}
                          </div>
                        </div>
                        <button
                          className="btn-sm btn-danger"
                          style={{ marginLeft: 10, flexShrink: 0 }}
                          onClick={() => handleDeleteRef(refEditing, ref.id)}
                        >删除</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* AI 分析结果预览 */}
          {analysisPreview && (
            <div style={{
              background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 10,
              padding: 16, marginBottom: 14
            }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#7b1fa2' }}>🔍 爆款因子分析结果</h4>
              <div style={{
                fontSize: 12, color: '#444', lineHeight: 1.8,
                maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-line',
                background: '#fff', borderRadius: 8, padding: 12
              }}>
                {analysisPreview.analysis}
              </div>
              {/* 保存为风格模板选项 */}
              <div style={{
                marginTop: 12, padding: '10px 14px', background: '#ede7f6',
                borderRadius: 8, border: '1px solid #d1c4e9'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  💾 同时保存为风格模板（可复用到其他爆文）
                </label>
                {saveAsTemplate && (
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="输入模板名称，如：种草测评风格、情绪共鸣体..."
                    style={{
                      marginTop: 8, width: '100%', padding: '6px 10px',
                      borderRadius: 6, border: '1px solid #b39ddb', fontSize: 13,
                      outline: 'none'
                    }}
                  />
                )}
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={handleConfirmAnalysis}
                  disabled={saveAsTemplate && !templateName.trim()}>
                  {saveAsTemplate ? '确认添加 + 保存模板' : '确认添加（含分析结果）'}
                </button>
                <button className="btn-secondary" onClick={() => setAnalysisPreview(null)}>
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 分析错误提示 */}
          {analysisError && (
            <div style={{
              background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8,
              padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#c62828'
            }}>
              {analysisError}
            </div>
          )}

          {/* 已保存的风格模板 */}
          {(() => {
            const currentProduct = products.find(p => p.id === refEditing)
            const templates = currentProduct?.styleTemplates || []
            if (templates.length === 0) return null
            const enabledCount = templates.filter(t => t.enabled !== false).length
            return (
              <div style={{ marginBottom: 14 }}>
                <button
                  onClick={() => setShowTemplateList(!showTemplateList)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: '1px solid #b39ddb',
                    background: showTemplateList ? '#ede7f6' : '#f3e5f5', color: '#7b1fa2',
                    cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 8
                  }}
                >
                  {showTemplateList ? '收起模板列表' : `💾 风格模板 (${enabledCount}/${templates.length} 启用)`}
                </button>
                {showTemplateList && (
                  <div style={{
                    background: '#faf5ff', border: '1px solid #d1c4e9', borderRadius: 10,
                    padding: 12
                  }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7b1fa2' }}>
                      启用的模板在批量生成时会自动轮换使用——每篇笔记仅参考 1 个模板，确保多样性。建议启用 ≥3 个模板效果最佳。
                    </p>
                    {templates.map(t => {
                      const isEnabled = t.enabled !== false
                      return (
                        <div key={t.id} style={{
                          background: isEnabled ? '#fff' : '#f5f5f5',
                          border: `1px solid ${isEnabled ? '#e1bee7' : '#e0e0e0'}`,
                          borderRadius: 8, padding: '8px 12px', marginBottom: 6,
                          opacity: isEnabled ? 1 : 0.65,
                          transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => handleToggleTemplate(refEditing, t.id)}
                                style={{ width: 16, height: 16, accentColor: '#7b1fa2' }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: isEnabled ? '#6a1b9a' : '#999' }}>
                                  {t.name}
                                </div>
                                <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                                  来源: {t.sourceText?.slice(0, 50)}{(t.sourceText?.length || 0) > 50 ? '...' : ''}
                                </div>
                              </div>
                            </label>
                            <button
                              className="btn-sm btn-danger"
                              style={{ flexShrink: 0, marginLeft: 8 }}
                              onClick={() => handleDeleteTemplate(refEditing, t.id)}
                            >删除</button>
                          </div>
                          <details style={{ marginTop: 6 }}>
                            <summary style={{ fontSize: 11, color: '#9575cd', cursor: 'pointer' }}>查看分析内容</summary>
                            <div style={{
                              fontSize: 11, color: '#555', lineHeight: 1.7, marginTop: 4,
                              maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-line',
                              background: '#f9f5ff', borderRadius: 6, padding: 8
                            }}>
                              {t.analysis}
                            </div>
                          </details>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* 添加新爆文 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>添加参考爆文</label>
            <textarea
              value={refForm.text}
              onChange={e => setRefForm({ text: e.target.value })}
              placeholder="直接粘贴爆文内容（标题+正文+标签均可）..."
              rows={8}
              style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}
              disabled={analyzing}
            />
          </div>

          <div className="btn-row">
            <button className="btn-primary" onClick={handleAddRef}
              disabled={!refForm.text.trim() || analyzing}>
              直接添加
            </button>
            <button
              onClick={handleAnalyzeAndAdd}
              disabled={!refForm.text.trim() || analyzing}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #ce93d8',
                background: analyzing ? '#f3e5f5' : '#7b1fa2', color: analyzing ? '#7b1fa2' : '#fff',
                cursor: (!refForm.text.trim() || analyzing) ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 13
              }}
            >
              {analyzing ? '🔄 AI 分析中...' : '🔍 AI 分析后添加'}
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
            留空则使用默认提示词。提示词中的 <code>{'{变量}'}</code> 会在生成时自动替换。
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

      {/* 封面自定义编辑面板 */}
      {coverEditing && (
        <div style={{
          background: '#f0f7ff', border: '1px solid #90caf9', borderRadius: 12,
          padding: 20, marginBottom: 16
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
            🎨 自定义封面 — {products.find(p => p.id === coverEditing)?.name}
          </h3>
          <p className="hint" style={{ marginBottom: 14, fontSize: 12 }}>
            填写后批量生成时将使用你的自定义内容作为封面，不再由 AI 生成。留空则仍由 AI 自动生成。
          </p>

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* 左侧表单 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  封面主标题 <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>（建议8-18字，按回车可手动控制换行位置）</span>
                </label>
                <textarea
                  value={coverForm.coverTitle}
                  onChange={e => setCoverForm(prev => ({ ...prev, coverTitle: e.target.value }))}
                  placeholder={"如：逼自己做自媒体的\n第一天建议收藏\n\n按回车键换行，精确控制每行显示内容"}
                  maxLength={50}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #90caf9', fontSize: 13, outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5
                  }}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {coverForm.coverTitle.replace(/\n/g, '').length}字（不含换行）
                    {coverForm.coverTitle.includes('\n') && <span style={{ color: '#1565c0', marginLeft: 6 }}>已手动分{coverForm.coverTitle.split('\n').filter(Boolean).length}行</span>}
                  </span>
                  <span style={{ color: '#aaa' }}>回车=换行 · 不换行则自动排版</span>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  封面副标题 <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>（建议15字以内，封面补充说明）</span>
                </label>
                <input
                  type="text"
                  value={coverForm.coverSubtitle}
                  onChange={e => setCoverForm(prev => ({ ...prev, coverSubtitle: e.target.value }))}
                  placeholder="如：万能模板+高分框架"
                  maxLength={25}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #90caf9', fontSize: 13, outline: 'none'
                  }}
                />
                <div style={{ fontSize: 11, color: coverForm.coverSubtitle.length > 15 ? '#e53935' : '#888', marginTop: 2 }}>
                  {coverForm.coverSubtitle.length}/25字
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  指定封面模板 <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>（可选，不选则按批量生成设置轮询）</span>
                </label>
                <select
                  value={coverForm.coverTemplateId}
                  onChange={e => {
                    setCoverForm(prev => ({ ...prev, coverTemplateId: e.target.value }))
                    if (e.target.value) setCoverPreviewTplId(e.target.value)
                  }}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #90caf9', fontSize: 13
                  }}
                >
                  <option value="">不指定（按批量生成设置）</option>
                  {COVER_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.desc}</option>
                  ))}
                </select>
              </div>

              {/* 预览模板切换（仅在未指定模板时显示） */}
              {!coverForm.coverTemplateId && coverForm.coverTitle && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>切换预览模板：</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {COVER_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setCoverPreviewTplId(t.id)}
                        style={{
                          padding: '2px 8px', borderRadius: 4, border: '1px solid #ccc',
                          background: coverPreviewTplId === t.id ? '#1565c0' : '#fff',
                          color: coverPreviewTplId === t.id ? '#fff' : '#555',
                          cursor: 'pointer', fontSize: 11
                        }}
                      >{t.name}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button className="btn-primary" onClick={handleSaveCover}
                  disabled={!coverForm.coverTitle.trim() && !coverForm.coverSubtitle.trim() && !coverForm.coverTemplateId}>
                  保存封面设置
                </button>
                {(products.find(p => p.id === coverEditing)?.customCoverTitle ||
                  products.find(p => p.id === coverEditing)?.customCoverSubtitle ||
                  products.find(p => p.id === coverEditing)?.customCoverTemplateId) && (
                  <button className="btn-danger" onClick={handleClearCover}>
                    清除自定义（恢复AI生成）
                  </button>
                )}
                <button className="btn-secondary" onClick={() => setCoverEditing(null)}>取消</button>
              </div>
            </div>

            {/* 右侧实时预览 */}
            {coverForm.coverTitle && (
              <div style={{
                flexShrink: 0, width: 180, textAlign: 'center'
              }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>实时预览</div>
                <CoverCanvas
                  templateId={coverForm.coverTemplateId || coverPreviewTplId}
                  data={{
                    title: coverForm.coverTitle,
                    subtitle: coverForm.coverSubtitle
                  }}
                  colorIdx={0}
                  width={170}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  {COVER_TEMPLATES.find(t => t.id === (coverForm.coverTemplateId || coverPreviewTplId))?.name}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="item-list">
          {products.map(p => {
            const refCount = (p.references || []).length
            const hasAnalysis = (p.references || []).some(r => r.analysis)
            const templateCount = (p.styleTemplates || []).length
            const enabledTemplateCount = (p.styleTemplates || []).filter(t => t.enabled !== false).length
            const hasCover = p.customCoverTitle || p.customCoverSubtitle
            const innerImages = innerImagesMap[p.id] || []
            return (
              <div key={p.id} className="item-card">
                <div className="item-info">
                  <strong>{p.name}</strong>
                  <span className="item-meta">
                    {p.productId && <span className="product-id">ID: {p.productId}</span>}
                    {refCount > 0 && (
                      <span style={{ marginLeft: 6, color: '#e65100', fontWeight: 600 }}>
                        🔥 {refCount}篇爆文参考
                        {hasAnalysis && <span style={{ color: '#7b1fa2' }}> (含AI分析)</span>}
                        {refCount < 3 && <span style={{ color: '#f57c00', fontWeight: 400, fontSize: 11 }}> (建议≥3篇)</span>}
                      </span>
                    )}
                    {refCount === 0 && (
                      <span style={{ marginLeft: 6, color: '#bbb', fontSize: 11 }}>
                        建议添加≥3篇爆文参考以提高生成多样性
                      </span>
                    )}
                    {templateCount > 0 && (
                      <span style={{ marginLeft: 6, color: '#6a1b9a', fontWeight: 600 }}>
                        💾 {enabledTemplateCount}/{templateCount}个模板启用
                      </span>
                    )}
                    {hasCover && (
                      <span style={{ marginLeft: 6, color: '#1565c0', fontWeight: 600 }}>🎨 已定制封面</span>
                    )}
                    {(p.customSystemPrompt || p.customUserPrompt) && (
                      <span style={{ marginLeft: 6, color: '#e67e22', fontWeight: 600 }}>📝 已定制提示词</span>
                    )}
                    {innerImages.length > 0 && (
                      <span style={{ marginLeft: 6, color: '#00897b', fontWeight: 600 }}>🖼️ {innerImages.length}张内页图</span>
                    )}
                  </span>
                </div>
                <div className="item-actions">
                  <button className="btn-sm" onClick={() => handleInnerImageUpload(p.id)}
                    style={{ background: innerImages.length > 0 ? '#e0f2f1' : undefined }}>
                    {innerImages.length > 0 ? `内页图(${innerImages.length})` : '添加内页图'}
                  </button>
                  <button className="btn-sm" onClick={() => handleOpenRef(p)}
                    style={{ background: refCount > 0 ? '#fff3e0' : undefined }}>
                    {refCount > 0 ? `爆文参考(${refCount})` : '爆文参考'}
                  </button>
                  <button className="btn-sm" onClick={() => handleEditCover(p)}
                    style={{ background: hasCover ? '#e3f2fd' : undefined }}>
                    {hasCover ? '编辑封面' : '自定义封面'}
                  </button>
                  <button className="btn-sm" onClick={() => handleEditPrompt(p)}
                    style={{ background: (p.customSystemPrompt || p.customUserPrompt) ? '#fff3e0' : undefined }}>
                    {(p.customSystemPrompt || p.customUserPrompt) ? '编辑提示词' : '定制提示词'}
                  </button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(p.id)}>删除</button>
                </div>
                {/* 内页图预览 */}
                {innerImages.length > 0 && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', background: '#f0faf8',
                    borderRadius: 8, border: '1px solid #b2dfdb'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#00897b' }}>
                        🖼️ 内页图 ({innerImages.length}张) — 拖拽可调整顺序，刷新页面后需重新上传
                      </span>
                      <button
                        className="btn-sm btn-danger"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => handleClearInnerImages(p.id)}
                      >清空全部</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {innerImages.map((img, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => handleInnerImageDragStart(e, p.id, idx)}
                          onDragEnd={handleInnerImageDragEnd}
                          onDragOver={handleInnerImageDragOver}
                          onDrop={() => handleInnerImageDrop(p.id, idx)}
                          style={{
                            position: 'relative', display: 'inline-block',
                            cursor: 'grab',
                            border: (dragIndex === idx && dragProductId === p.id) ? '2px solid #00897b' : '2px solid transparent',
                            borderRadius: 8, padding: 1,
                            transition: 'border-color 0.2s',
                          }}
                        >
                          <img
                            src={img}
                            alt={`内页图${idx + 1}`}
                            style={{
                              width: 80, height: 80, objectFit: 'cover',
                              borderRadius: 6, border: '1px solid #ccc',
                              pointerEvents: 'none',
                            }}
                          />
                          <span style={{
                            position: 'absolute', bottom: 2, left: 2,
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            fontSize: 10, padding: '1px 5px', borderRadius: 4,
                          }}>{idx + 1}</span>
                          <button
                            onClick={() => handleDeleteInnerImage(p.id, idx)}
                            style={{
                              position: 'absolute', top: -6, right: -6,
                              width: 20, height: 20, borderRadius: '50%',
                              background: '#e53935', color: '#fff', border: 'none',
                              cursor: 'pointer', fontSize: 12, lineHeight: '18px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >×</button>
                        </div>
                      ))}
                      <button
                        onClick={() => handleInnerImageUpload(p.id)}
                        style={{
                          width: 80, height: 80, borderRadius: 6,
                          border: '2px dashed #b2dfdb', background: '#e0f2f1',
                          cursor: 'pointer', fontSize: 24, color: '#00897b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >+</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {products.length === 0 && <p className="empty-state">该店铺还没有商品，请在店铺管理中从千帆导入</p>}
    </div>
  )
}
