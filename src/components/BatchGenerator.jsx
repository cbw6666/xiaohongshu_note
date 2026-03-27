import { useState, useRef, useEffect } from 'react'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'
import { callAI, buildNotePrompt, parseNoteResponse, calcTitleLen, buildRetitlePrompt } from '../services/aiService.js'
import { humanizeNote } from '../services/humanizerService.js'
import { perturbContent, perturbTitle } from '../services/textPerturbation.js'
import {
  buildSeoPlan,
  buildSeoPromptSection,
  buildRetitleSeoPromptSection,
  enforceSeoResult,
  getProtectedKeywords,
} from '../services/seoService.js'
import { deduplicateImage } from '../utils/imageDeduplicator.js'
import { createStreamWriter } from '../utils/streamExportUtils.js'
import { mergeExcelFiles } from '../utils/excelMergeUtils.js'
import { shuffleExcelRows } from '../utils/excelShuffleUtils.js'
import { renderCoverToBlob } from '../utils/coverRenderer.js'

export default function BatchGenerator({ settings, shops, onGenerated, innerImagesMap }) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' })
  const [selectedShops, setSelectedShops] = useState([])
  const [productConfig, setProductConfig] = useState({})
  const [selectedCoverTemplates, setSelectedCoverTemplates] = useState(COVER_TEMPLATES.map(t => t.id))
  const abortRef = useRef(false)

  const validShops = shops.filter(s => s.products.length > 0 && s.accounts.length > 0)

  useEffect(() => {
    const validIds = validShops.map(s => s.id)
    if (validIds.length > 0 && selectedShops.length === 0) {
      setSelectedShops(validIds)
    }
    setSelectedShops(prev => prev.filter(id => validIds.includes(id)))

    setProductConfig(prev => {
      const next = { ...prev }
      validShops.forEach(shop => {
        shop.products.forEach(p => {
          if (!(p.id in next)) {
            next[p.id] = { selected: true, count: 3 }
          }
        })
      })
      return next
    })
  }, [shops])

  const toggleAll = (list, setList, allIds) => {
    setList(prev => prev.length === allIds.length ? [] : [...allIds])
  }

  const toggleItem = (list, setList, id) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleProduct = (productId) => {
    setProductConfig(prev => ({
      ...prev,
      [productId]: { ...prev[productId], selected: !prev[productId]?.selected }
    }))
  }

  const setProductCount = (productId, count) => {
    const n = Math.max(1, Math.min(50, parseInt(count) || 1))
    setProductConfig(prev => ({
      ...prev,
      [productId]: { ...prev[productId], count: n }
    }))
  }

  const toggleAllProducts = (shop) => {
    const allSelected = shop.products.every(p => productConfig[p.id]?.selected)
    setProductConfig(prev => {
      const next = { ...prev }
      shop.products.forEach(p => {
        next[p.id] = { ...next[p.id], selected: !allSelected }
      })
      return next
    })
  }

  const totalNotes = selectedShops.reduce((sum, shopId) => {
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return sum
    return sum + shop.products.reduce((pSum, p) => {
      const cfg = productConfig[p.id]
      if (!cfg?.selected) return pSum
      return pSum + (cfg.count || 3) * shop.accounts.length
    }, 0)
  }, 0)

  const handleGenerate = async () => {
    if (!settings.apiKey || !settings.endpointId) {
      alert('请先配置 AI API Key 和推理接入点')
      return
    }
    if (selectedShops.length === 0) {
      alert('请至少选择一个店铺')
      return
    }
    if (totalNotes === 0) {
      alert('请至少选择一个商品')
      return
    }

    // 先让用户选择 Excel 保存位置
    let writer
    try {
      writer = await createStreamWriter()
    } catch (err) {
      if (err.name === 'AbortError') return
      alert('创建文件失败: ' + err.message)
      return
    }

    abortRef.current = false
    setGenerating(true)
    setProgress({ current: 0, total: totalNotes, text: '准备生成...' })

    const results = []
    let count = 0
    let successCount = 0
    let failCount = 0

    // 对封面模板列表做 Fisher-Yates 打散，避免顺序模式过于规律
    const shuffledCoverTemplates = [...selectedCoverTemplates]
    for (let k = shuffledCoverTemplates.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [shuffledCoverTemplates[k], shuffledCoverTemplates[j]] = [shuffledCoverTemplates[j], shuffledCoverTemplates[k]]
    }

    for (const shopId of selectedShops) {
      if (abortRef.current) break
      const shop = shops.find(s => s.id === shopId)
      if (!shop) continue

      const { accounts } = shop
      const selectedProducts = shop.products.filter(p => productConfig[p.id]?.selected)

      for (const product of selectedProducts) {
        if (abortRef.current) break
        const noteCount = productConfig[product.id]?.count || 3

        for (const account of accounts) {
          if (abortRef.current) break

          for (let i = 0; i < noteCount; i++) {
            if (abortRef.current) break

            const coverTemplateId = product.customCoverTemplateId || shuffledCoverTemplates[count % shuffledCoverTemplates.length]

            count++
            setProgress({
              current: count,
              total: totalNotes,
              text: `${shop.name} / ${account.name} / ${product.name.slice(0, 10)}... 第${i + 1}篇`,
            })

            // 清理商品名称中可能混入的商品ID等信息
            const cleanName = (product.name || '').replace(/\n?\s*商品\s*ID\s*[:：]\s*[\s\S]*/i, '').replace(/\n?\s*预览\s*$/, '').trim()
            const itemId = product.productId || ((product.name || '').match(/商品\s*ID\s*[:：]\s*([a-zA-Z0-9]+)/i) || [])[1] || ''
            const seoPlan = buildSeoPlan(product, i)

            let noteTitle = ''
            let noteContent = ''
            let noteTags = ''
            let noteCoverTitle = ''
            let noteCoverSubtitle = ''
            let isError = false
            let innerImageCount = 0

            try {
              const messages = buildNotePrompt(product, { noteIndex: i })
              if (seoPlan) {
                messages[1].content = `${messages[1].content}\n\n${buildSeoPromptSection(seoPlan)}`
              }
              const raw = await callAI(settings, messages)
              const parsed = parseNoteResponse(raw)

              // 校验标题字数，超过20字则重新生成标题，重试到满足要求为止
              let finalTitle = parsed.title
              const MAX_TITLE_LEN = 20
              const SAFE_LIMIT = 10
              let retitleAttempt = 0
              while (finalTitle && calcTitleLen(finalTitle) > MAX_TITLE_LEN && retitleAttempt < SAFE_LIMIT) {
                retitleAttempt++
                try {
                  const retitleMessages = buildRetitlePrompt(finalTitle, parsed.content, product.name)
                  if (seoPlan) {
                    retitleMessages[1].content = `${retitleMessages[1].content}\n\n${buildRetitleSeoPromptSection(seoPlan)}`
                  }
                  const newTitle = (await callAI(settings, retitleMessages)).trim()
                  if (newTitle) finalTitle = newTitle
                } catch (e) {
                  console.warn(`重新生成标题失败(第${retitleAttempt}次):`, e)
                }
              }
              if (finalTitle && calcTitleLen(finalTitle) > MAX_TITLE_LEN) {
                let truncated = ''
                let len = 0
                for (const ch of finalTitle) {
                  const chLen = ch.codePointAt(0) > 0xFFFF ? 2 : 1
                  if (len + chLen > MAX_TITLE_LEN) break
                  truncated += ch
                  len += chLen
                }
                finalTitle = truncated
              }

              noteTitle = finalTitle || `${cleanName}种草`
              noteContent = parsed.content || raw
              noteTags = parsed.tags || ''
              noteCoverTitle = product.customCoverTitle || parsed.coverTitle || cleanName.slice(0, 8)
              noteCoverSubtitle = product.customCoverSubtitle || parsed.coverSubtitle || product.sellingPoints?.slice(0, 15) || ''
              successCount++

              // 去AI味（跳过标题，只处理正文，保护爆款标题公式）
              if (settings.apiKey && noteContent) {
                setProgress({
                  current: count,
                  total: totalNotes,
                  text: `${shop.name} / ${account.name} / ${product.name.slice(0, 10)}... 第${i + 1}篇 去AI味...`,
                })
                try {
                  const humanized = await humanizeNote(
                    settings,
                    { title: noteTitle, content: noteContent, tags: noteTags },
                    { skipTitle: true }
                  )
                  if (humanized?.content) noteContent = humanized.content
                } catch (e) {
                  console.warn('去AI味失败，使用原文:', e)
                }
              }

              // 文本扰动（本地处理，不调用AI）— 进一步降低AI文本指纹
              const protectedKeywords = seoPlan ? getProtectedKeywords(seoPlan) : []
              noteContent = perturbContent(noteContent, { protectedKeywords })
              noteTitle = perturbTitle(noteTitle, { protectedKeywords })

              if (seoPlan) {
                const seoFixed = enforceSeoResult(
                  {
                    title: noteTitle,
                    content: noteContent,
                    tags: noteTags,
                    coverTitle: noteCoverTitle,
                  },
                  seoPlan,
                )
                noteTitle = seoFixed.title || noteTitle
                noteContent = seoFixed.content || noteContent
                noteTags = seoFixed.tags || noteTags
                noteCoverTitle = seoFixed.coverTitle || noteCoverTitle
              }

              // 扰动后再次校验标题字数
              if (noteTitle && calcTitleLen(noteTitle) > MAX_TITLE_LEN) {
                let truncated = ''
                let len = 0
                for (const ch of noteTitle) {
                  const chLen = ch.codePointAt(0) > 0xFFFF ? 2 : 1
                  if (len + chLen > MAX_TITLE_LEN) break
                  truncated += ch
                  len += chLen
                }
                noteTitle = truncated
              }
            } catch (err) {
              console.error('生成失败:', err)
              noteTitle = `[生成失败] ${cleanName}`
              noteContent = `错误: ${err.message}`
              noteTags = ''
              noteCoverTitle = product.customCoverTitle || cleanName.slice(0, 8)
              noteCoverSubtitle = product.customCoverSubtitle || ''
              isError = true
              failCount++
            }

            // --- 流式写入 Excel：渲染封面 + 内页图去重 + appendRow ---
            setProgress({
              current: count,
              total: totalNotes,
              text: `${shop.name} / ${account.name} / ${product.name.slice(0, 10)}... 第${i + 1}篇 写入Excel...`,
            })

            // 渲染封面图
            let coverImage = null
            try {
              const blob = await renderCoverToBlob(coverTemplateId, { title: noteCoverTitle, subtitle: noteCoverSubtitle }, count)
              coverImage = await new Promise(resolve => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.readAsDataURL(blob)
              })
            } catch (e) {
              console.warn('渲染封面失败:', e)
            }

            // 对内页图进行去重处理
            const rawInnerImages = innerImagesMap?.[product.id] || []
            let dedupedInnerImages = []
            if (rawInnerImages.length > 0) {
              setProgress({
                current: count,
                total: totalNotes,
                text: `${shop.name} / ${account.name} / ${product.name.slice(0, 10)}... 第${i + 1}篇 内页图去重...`,
              })
              for (const img of rawInnerImages) {
                dedupedInnerImages.push(await deduplicateImage(img))
              }
            }
            innerImageCount = dedupedInnerImages.length

            // 写入 Excel
            try {
              await writer.appendRow({
                shopName: shop.name,
                accountName: account.name,
                productName: cleanName,
                productItemId: itemId,
                title: noteTitle,
                content: noteContent,
                tags: noteTags.split(/\s+/).filter(Boolean),
                coverImage,
                innerImages: dedupedInnerImages,
              })
            } catch (e) {
              console.error('写入Excel失败:', e)
            }

            // 释放图片引用，帮助 GC
            coverImage = null
            dedupedInnerImages = null

            // 轻量数据 push 到 results（不含图片和 raw）
            results.push({
              id: `${Date.now()}_${count}`,
              shopId: shop.id,
              shopName: shop.name,
              accountId: account.id,
              accountName: account.name,
              productId: product.id,
              productItemId: itemId,
              productName: cleanName,
              coverTemplateId,
              title: noteTitle,
              content: noteContent,
              tags: noteTags,
              coverTitle: noteCoverTitle,
              coverSubtitle: noteCoverSubtitle,
              innerImageCount,
              error: isError || undefined,
              createdAt: new Date().toISOString(),
            })

            if (count < totalNotes) {
              await new Promise(r => setTimeout(r, 800))
            }
          }
        }
      }
    }

    // 写入汇总信息
    try {
      await writer.finalize({ total: count, success: successCount, fail: failCount })
    } catch (e) {
      console.error('写入汇总失败:', e)
    }

    setGenerating(false)
    setProgress({ current: totalNotes, total: totalNotes, text: '生成完成！Excel 已自动保存' })
    onGenerated(results)
  }

  const handleStop = () => {
    abortRef.current = true
  }

  const handleMergeExcels = async () => {
    try {
      const result = await mergeExcelFiles()
      alert(`合并完成：共合并 ${result.fileCount} 个文件，输出 ${result.rowCount} 条记录`)
    } catch (err) {
      if (err?.name === 'AbortError') return
      alert(`合并失败：${err.message || err}`)
    }
  }

  const handleShuffleExcel = async () => {
    try {
      const result = await shuffleExcelRows()
      alert(`打乱完成：文件 ${result.fileName} 已打乱，共 ${result.rowCount} 条记录`)
    } catch (err) {
      if (err?.name === 'AbortError') return
      alert(`打乱失败：${err.message || err}`)
    }
  }

  return (
    <div className="panel">
      <h2>🚀 批量生成</h2>

      {/* 店铺选择 */}
      <div className="select-section">
        <div className="select-header">
          <h3>选择店铺</h3>
          {validShops.length > 0 && (
            <button className="btn-link" onClick={() => toggleAll(selectedShops, setSelectedShops, validShops.map(s => s.id))}>
              {selectedShops.length === validShops.length ? '取消全选' : '全选'}
            </button>
          )}
        </div>
        <div className="chip-list">
          {validShops.map(s => (
            <label key={s.id} className={`chip ${selectedShops.includes(s.id) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={selectedShops.includes(s.id)}
                onChange={() => toggleItem(selectedShops, setSelectedShops, s.id)}
              />
              {s.name}
              <span className="chip-detail">{s.products.length}商品·{s.accounts.length}账号</span>
            </label>
          ))}
          {validShops.length === 0 && (
            <p className="hint">没有可用的店铺（需要至少1个商品+1个账号）</p>
          )}
        </div>
      </div>

      {/* 选中店铺详情 — 商品选择+篇数设置 */}
      {selectedShops.length > 0 && (
        <div className="select-section">
          <h3>选择商品与生成篇数</h3>
          <p className="hint" style={{ margin: '-4px 0 10px', fontSize: 12 }}>
            勾选需要生成笔记的商品，并设置每个商品每个账号的生成篇数
          </p>
          <div className="shop-detail-list">
            {selectedShops.map(shopId => {
              const shop = shops.find(s => s.id === shopId)
              if (!shop) return null
              const allSelected = shop.products.every(p => productConfig[p.id]?.selected)
              const shopNotes = shop.products.reduce((s, p) => {
                const cfg = productConfig[p.id]
                return s + (cfg?.selected ? (cfg.count || 3) * shop.accounts.length : 0)
              }, 0)
              return (
                <div key={shop.id} className="shop-detail-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div className="shop-detail-name" style={{ margin: 0 }}>{shop.name}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: '#888' }}>
                        账号：{shop.accounts.map(a => a.name).join('、')}
                      </span>
                      <button className="btn-link" style={{ fontSize: 12 }} onClick={() => toggleAllProducts(shop)}>
                        {allSelected ? '取消全选' : '全选'}
                      </button>
                    </div>
                  </div>

                  {shop.products.map(p => {
                    const cfg = productConfig[p.id] || { selected: true, count: 3 }
                    const refCount = (p.references || []).length
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', marginBottom: 4,
                        background: cfg.selected ? '#f0faf0' : '#fafafa',
                        borderRadius: 8, border: `1px solid ${cfg.selected ? '#c8e6c9' : '#eee'}`,
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="checkbox"
                          checked={cfg.selected}
                          onChange={() => toggleProduct(p.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span style={{
                          flex: 1, fontSize: 13,
                          color: cfg.selected ? '#333' : '#aaa',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {p.name}
                          {refCount > 0 && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: '#e65100' }}>🔥{refCount}篇参考</span>
                          )}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => setProductCount(p.id, cfg.count - 1)}
                            disabled={!cfg.selected || cfg.count <= 1}
                            style={{
                              width: 24, height: 24, borderRadius: 4, border: '1px solid #ddd',
                              background: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: '22px',
                              color: cfg.selected ? '#333' : '#ccc'
                            }}
                          >−</button>
                          <input
                            type="number"
                            min={1} max={50}
                            value={cfg.count}
                            onChange={e => setProductCount(p.id, e.target.value)}
                            disabled={!cfg.selected}
                            style={{
                              width: 42, height: 24, textAlign: 'center', borderRadius: 4,
                              border: '1px solid #ddd', fontSize: 13
                            }}
                          />
                          <button
                            onClick={() => setProductCount(p.id, cfg.count + 1)}
                            disabled={!cfg.selected || cfg.count >= 50}
                            style={{
                              width: 24, height: 24, borderRadius: 4, border: '1px solid #ddd',
                              background: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: '22px',
                              color: cfg.selected ? '#333' : '#ccc'
                            }}
                          >+</button>
                          <span style={{ fontSize: 11, color: '#888', width: 28 }}>篇</span>
                        </div>
                        {cfg.selected && (
                          <span style={{ fontSize: 11, color: '#666', flexShrink: 0, width: 80, textAlign: 'right' }}>
                            × {shop.accounts.length}账号 = {cfg.count * shop.accounts.length}篇
                          </span>
                        )}
                      </div>
                    )
                  })}

                  <div style={{ textAlign: 'right', marginTop: 6, fontSize: 12, color: '#e53935', fontWeight: 600 }}>
                    该店铺小计：{shopNotes} 篇
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 封面模板选择 */}
      <div className="select-section">
        <div className="select-header">
          <h3>封面模板</h3>
          <button className="btn-link" onClick={() => toggleAll(selectedCoverTemplates, setSelectedCoverTemplates, COVER_TEMPLATES.map(t => t.id))}>
            {selectedCoverTemplates.length === COVER_TEMPLATES.length ? '取消全选' : '全选'}
          </button>
        </div>
        <div className="chip-list">
          {COVER_TEMPLATES.map(t => (
            <label key={t.id} className={`chip ${selectedCoverTemplates.includes(t.id) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={selectedCoverTemplates.includes(t.id)}
                onChange={() => toggleItem(selectedCoverTemplates, setSelectedCoverTemplates, t.id)}
              />
              {t.name}
            </label>
          ))}
        </div>
      </div>

      {/* 多样性 Tips */}
      {selectedShops.length > 0 && totalNotes > 0 && (
        <div style={{
          margin: '16px 0', padding: '14px 16px',
          background: '#fffbeb', borderRadius: 10,
          border: '1px solid #fde68a', fontSize: 13, lineHeight: 1.8
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#b45309' }}>
            💡 内容多样性 & 防AI检测说明
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#78350f' }}>
            <li>系统内置 <strong>10种笔记类型 × 25种写法风格</strong>，批量生成时自动轮换，<strong>250篇内</strong>每篇写法组合不重复</li>
            <li>System Prompt 内置 <strong>去AI味专项指令</strong>：禁用AI高频词、强制口语化、禁止三段式排比、要求句式长短交替</li>
            <li>生成后自动执行 <strong>AI去痕 + 本地文本扰动</strong> 双层处理，同义词替换、标点微调、段落呼吸感随机化</li>
            <li>封面模板采用 <strong>随机打散分配</strong>，避免连续重复出现相同视觉风格</li>
            <li>上传爆文参考 + 生成风格模板可进一步提升多样性，建议每商品 <strong>≥3篇</strong> 爆文效果最佳</li>
            <li>发布时每个账号 <strong>间隔3小时以上</strong>，避免短时间密集发布被判定为机器行为</li>
          </ul>
          {/* 动态警告：检测爆文/模板不足的商品 */}
          {(() => {
            const warnings = []
            selectedShops.forEach(shopId => {
              const shop = shops.find(s => s.id === shopId)
              if (!shop) return
              shop.products.forEach(p => {
                const cfg = productConfig[p.id]
                if (!cfg?.selected) return
                const refCount = (p.references || []).length
                const enabledTplCount = (p.styleTemplates || []).filter(t => t.enabled !== false).length
                const noteCount = cfg.count || 3
                if (refCount === 0 && enabledTplCount === 0 && noteCount > 1) {
                  warnings.push({ name: p.name, type: 'none', noteCount })
                } else if (refCount < 3 && enabledTplCount < 3 && noteCount > 3) {
                  warnings.push({ name: p.name, refCount, enabledTplCount, noteCount, type: 'low' })
                } else if (noteCount > refCount * 2 && refCount > 0) {
                  warnings.push({ name: p.name, refCount, noteCount, type: 'ratio' })
                }
              })
            })
            if (warnings.length === 0) return null
            return (
              <div style={{
                marginTop: 10, padding: '8px 12px',
                background: '#fff3e0', borderRadius: 8,
                border: '1px solid #ffcc80', fontSize: 12, color: '#e65100'
              }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{ marginBottom: i < warnings.length - 1 ? 4 : 0 }}>
                    {w.type === 'none' && (
                      <>💡 「{w.name.slice(0, 15)}」没有爆文和模板，系统将使用内置写法轮换保证差异性，添加爆文可进一步提升质量</>
                    )}
                    {w.type === 'low' && (
                      <>💡 「{w.name.slice(0, 15)}」仅有 {w.refCount} 篇爆文 + {w.enabledTplCount} 个模板，建议补充至≥3个以获得更好的多样性</>
                    )}
                    {w.type === 'ratio' && (
                      <>💡 「{w.name.slice(0, 15)}」{w.refCount} 篇爆文生成 {w.noteCount} 篇，部分笔记的爆文参考素材将重复，但写法风格仍会差异化</>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* 生成信息 */}
      <div className="gen-info">
        <p>
          已选 <strong>{selectedShops.length}</strong> 个店铺，共{' '}
          <strong>{totalNotes}</strong> 篇笔记待生成
        </p>
      </div>

      {/* 进度条 */}
      {generating && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${totalNotes > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
          <span className="progress-text">{progress.text} ({progress.current}/{progress.total})</span>
        </div>
      )}

      <div className="btn-row">
        {!generating ? (
          <button
            className="btn-primary btn-large"
            onClick={handleGenerate}
            disabled={selectedShops.length === 0 || totalNotes === 0}
          >
            🚀 开始批量生成
          </button>
        ) : (
          <button className="btn-danger btn-large" onClick={handleStop}>
            ⏹ 停止生成
          </button>
        )}
        <button
          className="btn-secondary btn-large"
          onClick={handleMergeExcels}
          disabled={generating}
          title="把多份批量生成/批量采集导出的 Excel 合并为一个文件"
        >
          🧩 合并 Excel
        </button>
        <button
          className="btn-secondary btn-large"
          onClick={handleShuffleExcel}
          disabled={generating}
          title="选择一个 Excel 文件并打乱数据行顺序"
        >
          🔀 打乱行顺序
        </button>
      </div>
    </div>
  )
}
