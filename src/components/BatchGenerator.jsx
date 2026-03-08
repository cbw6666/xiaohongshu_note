import { useState, useRef, useEffect } from 'react'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'
import { callAI, buildNotePrompt, parseNoteResponse, calcTitleLen, buildRetitlePrompt } from '../services/aiService.js'

export default function BatchGenerator({ settings, shops, onGenerated }) {
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

    abortRef.current = false
    setGenerating(true)
    setProgress({ current: 0, total: totalNotes, text: '准备生成...' })

    const results = []
    let count = 0

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

            const coverTemplateId = product.customCoverTemplateId || selectedCoverTemplates[count % selectedCoverTemplates.length]

            count++
            setProgress({
              current: count,
              total: totalNotes,
              text: `${shop.name} / ${account.name} / ${product.name.slice(0, 10)}... 第${i + 1}篇`,
            })

            // 清理商品名称中可能混入的商品ID等信息
            const cleanName = (product.name || '').replace(/\n?\s*商品\s*ID\s*[:：]\s*[\s\S]*/i, '').replace(/\n?\s*预览\s*$/, '').trim()
            const itemId = product.productId || ((product.name || '').match(/商品\s*ID\s*[:：]\s*([a-zA-Z0-9]+)/i) || [])[1] || ''

            try {
              const messages = buildNotePrompt(product)
              const raw = await callAI(settings, messages)
              const parsed = parseNoteResponse(raw)

              // 校验标题字数，超过20字则只重新生成标题（最多重试2次）
              let finalTitle = parsed.title
              const MAX_TITLE_LEN = 20
              const MAX_RETITLE_RETRIES = 2
              if (finalTitle && calcTitleLen(finalTitle) > MAX_TITLE_LEN) {
                for (let retry = 0; retry < MAX_RETITLE_RETRIES; retry++) {
                  try {
                    const retitleMessages = buildRetitlePrompt(finalTitle, parsed.content, product.name)
                    const newTitle = (await callAI(settings, retitleMessages)).trim()
                    if (newTitle && calcTitleLen(newTitle) <= MAX_TITLE_LEN) {
                      finalTitle = newTitle
                      break
                    }
                  } catch (e) {
                    console.warn('重新生成标题失败:', e)
                  }
                }
              }

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
                title: finalTitle || `${cleanName}种草`,
                content: parsed.content || raw,
                tags: parsed.tags || '',
                coverTitle: product.customCoverTitle || parsed.coverTitle || cleanName.slice(0, 8),
                coverSubtitle: product.customCoverSubtitle || parsed.coverSubtitle || product.sellingPoints?.slice(0, 15) || '',
                raw,
                createdAt: new Date().toISOString(),
              })
            } catch (err) {
              console.error('生成失败:', err)
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
                title: `[生成失败] ${cleanName}`,
                content: `错误: ${err.message}`,
                tags: '',
                coverTitle: product.customCoverTitle || cleanName.slice(0, 8),
                coverSubtitle: product.customCoverSubtitle || '',
                raw: '',
                error: true,
                createdAt: new Date().toISOString(),
              })
            }

            if (count < totalNotes) {
              await new Promise(r => setTimeout(r, 800))
            }
          }
        }
      }
    }

    setGenerating(false)
    setProgress({ current: totalNotes, total: totalNotes, text: '生成完成！' })
    onGenerated(results)
  }

  const handleStop = () => {
    abortRef.current = true
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
      </div>
    </div>
  )
}
