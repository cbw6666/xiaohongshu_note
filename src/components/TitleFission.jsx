import { useState, useRef, useCallback, useEffect } from 'react'
import { callAI, calcTitleLen } from '../services/aiService.js'
import {
  buildAnalyzeTitlesPrompt,
  buildFissionPrompt,
  parseFissionResult,
  fixOverLimitTitle,
} from '../services/titleFissionService.js'
import { appendTitleVariants, validateTitleVariantAgainstProduct } from '../services/titleVariantService.js'
import { loadFissionData, saveFissionData } from '../utils/storage.js'

export default function TitleFission({
  settings,
  shops = [],
  activeShopId = '',
  onUpdateShop,
  importedTitlesText = '',
  importedTitlesNonce = 0,
}) {
  // === 状态 ===
  const [step, setStep] = useState(1) // 当前步骤 1-5
  const [titles, setTitles] = useState('') // 爆款标题输入（每行一个）
  const [analysis, setAnalysis] = useState('') // AI 分析结果
  const [product, setProduct] = useState({ name: '', description: '', audience: '', sellingPoints: '', keyword: '' })
  const [useKeyword, setUseKeyword] = useState(false) // 是否用关键词模式
  const [fissionCount, setFissionCount] = useState(10) // 生成数量
  const [results, setResults] = useState([]) // 裂变结果
  const [history, setHistory] = useState(() => loadFissionData()) // 历史记录
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [copied, setCopied] = useState(null) // 复制反馈
  const abortRef = useRef(null)
  const [selectedShopId, setSelectedShopId] = useState(activeShopId || shops[0]?.id || '')
  const [selectedProductId, setSelectedProductId] = useState('')
  const importedNonceRef = useRef(0)

  useEffect(() => {
    const fallbackShopId = activeShopId || shops[0]?.id || ''
    setSelectedShopId(prev => {
      if (prev && shops.some(shop => shop.id === prev)) return prev
      return fallbackShopId
    })
  }, [activeShopId, shops])

  const selectedShop = shops.find(shop => shop.id === selectedShopId) || null
  const selectableProducts = selectedShop?.products || []
  const selectedProduct = selectableProducts.find(item => item.id === selectedProductId) || null

  useEffect(() => {
    if (!selectedShop) {
      setSelectedProductId('')
      return
    }
    setSelectedProductId(prev => {
      if (prev && selectableProducts.some(item => item.id === prev)) return prev
      return selectableProducts[0]?.id || ''
    })
  }, [selectedShopId, selectableProducts.length])

  useEffect(() => {
    if (!selectedProduct || useKeyword) return
    setProduct(prev => ({
      ...prev,
      name: selectedProduct.name || '',
      description: selectedProduct.description || '',
      audience: selectedProduct.audience || '',
      sellingPoints: selectedProduct.sellingPoints || '',
    }))
  }, [selectedProductId, useKeyword])

  useEffect(() => {
    if (!importedTitlesText || !importedTitlesNonce) return
    if (importedNonceRef.current === importedTitlesNonce) return
    importedNonceRef.current = importedTitlesNonce

    const list = String(importedTitlesText || '')
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean)
    if (list.length === 0) return

    setTitles(list.join('\n'))
    setStep(1)
    setError('')
    setStatusMessage(`已从笔记采集导入 ${list.length} 条标题`)
  }, [importedTitlesText, importedTitlesNonce])

  // 步骤标签
  const STEPS = [
    { num: 1, label: '录入爆款标题' },
    { num: 2, label: 'AI 分析规律' },
    { num: 3, label: '目标商品/主题' },
    { num: 4, label: '裂变生成' },
    { num: 5, label: '结果管理' },
  ]

  // 标题列表（解析输入）
  const titleList = titles.split('\n').map(t => t.trim()).filter(Boolean)

  // === 步骤1：分析爆款标题 ===
  const handleAnalyze = useCallback(async () => {
    setStatusMessage('')
    if (titleList.length < 3) {
      setError('请至少输入3个爆款标题')
      return
    }
    if (!settings.apiKey || !settings.endpointId) {
      setError('请先在设置中配置 API Key 和推理接入点')
      return
    }

    setLoading(true)
    setError('')
    try {
      const messages = buildAnalyzeTitlesPrompt(titleList)
      const result = await callAI(settings, messages)
      setAnalysis(result)
      setStep(2)
    } catch (e) {
      setError('分析失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }, [titleList, settings])

  // === 步骤4：裂变生成 ===
  const handleFission = useCallback(async () => {
    setStatusMessage('')
    if (!analysis) {
      setError('请先完成爆款标题分析')
      return
    }
    if (!useKeyword && !product.name) {
      setError('请填写商品名称或切换到关键词模式')
      return
    }
    if (useKeyword && !product.keyword) {
      setError('请填写主题关键词')
      return
    }

    setLoading(true)
    setError('')
    try {
      const productInfo = useKeyword ? { keyword: product.keyword } : product
      const messages = buildFissionPrompt(analysis, productInfo, fissionCount)
      const raw = await callAI(settings, messages)
      const parsed = parseFissionResult(raw)

      if (parsed.length === 0) {
        setError('未能解析出有效标题，请重试')
        setLoading(false)
        return
      }

      setResults(parsed)
      setStep(5)

      // 保存到历史
      const record = {
        id: Date.now().toString(36),
        time: new Date().toLocaleString(),
        titleCount: titleList.length,
        product: useKeyword ? product.keyword : product.name,
        results: parsed,
      }
      const newHistory = [record, ...history].slice(0, 20) // 最多保存20条
      setHistory(newHistory)
      saveFissionData(newHistory)
    } catch (e) {
      setError('裂变生成失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }, [analysis, product, useKeyword, fissionCount, settings, titleList, history])

  // === 修复超限标题 ===
  const handleFixTitle = useCallback(async (idx) => {
    const item = results[idx]
    if (!item || !item.overLimit) return

    setLoading(true)
    setError('')
    setStatusMessage('')
    try {
      const fixed = await fixOverLimitTitle(settings, item.title, item.formula)
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, title: fixed.title, len: fixed.len, overLimit: fixed.overLimit } : r))
    } catch (e) {
      setError('标题修复失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }, [results, settings])

  // === 复制单条标题 ===
  const handleCopy = useCallback((title, idx) => {
    setStatusMessage('')
    navigator.clipboard.writeText(title).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 1500)
    })
  }, [])

  // === 批量复制所有标题 ===
  const handleCopyAll = useCallback(() => {
    setStatusMessage('')
    const text = results.map((r, i) => `${i + 1}. ${r.title}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied('all')
      setTimeout(() => setCopied(null), 1500)
    })
  }, [results])

  // === 从历史恢复 ===
  const handleRestoreHistory = useCallback((record) => {
    setStatusMessage('')
    setResults(record.results)
    setStep(5)
  }, [])

  // === 删除历史 ===
  const handleDeleteHistory = useCallback((id) => {
    const newHistory = history.filter(h => h.id !== id)
    setHistory(newHistory)
    saveFissionData(newHistory)
  }, [history])

  // === 清空历史 ===
  const handleClearHistory = useCallback(() => {
    setHistory([])
    saveFissionData([])
  }, [])

  const handleChooseProduct = useCallback((shopId, productId) => {
    setSelectedShopId(shopId)
    setSelectedProductId(productId)
    const shop = shops.find(item => item.id === shopId)
    const productItem = shop?.products?.find(item => item.id === productId)
    if (!productItem) return
    setUseKeyword(false)
    setProduct(prev => ({
      ...prev,
      name: productItem.name || '',
      description: productItem.description || '',
      audience: productItem.audience || '',
      sellingPoints: productItem.sellingPoints || '',
    }))
    setError('')
    setStatusMessage('')
  }, [shops])

  const handleSaveToProduct = useCallback(async () => {
    setError('')
    setStatusMessage('')

    if (!selectedShop || !selectedProduct) {
      setError('请先选择要保存到的商品。')
      return
    }
    if (results.length === 0) {
      setError('当前没有可保存的标题。')
      return
    }

    setLoading(true)
    try {
      const normalizedItems = []
      const savedIndexes = new Map()

      for (let index = 0; index < results.length; index += 1) {
        const item = results[index]
        let nextTitle = String(item.title || '').trim()
        let nextLen = calcTitleLen(nextTitle)
        let overLimit = nextLen > 20

        if (overLimit) {
          const fixed = await fixOverLimitTitle(settings, nextTitle, item.formula)
          nextTitle = String(fixed.title || nextTitle).trim()
          nextLen = fixed.len
          overLimit = fixed.overLimit
        }

        if (overLimit || !nextTitle) continue

        const validation = validateTitleVariantAgainstProduct(selectedProduct, nextTitle)
        if (!validation.valid) continue

        normalizedItems.push({
          title: nextTitle,
          formula: item.formula,
          enabled: true,
          source: 'fission',
          createdAt: new Date().toISOString(),
        })
        savedIndexes.set(index, {
          title: nextTitle,
          len: nextLen,
          overLimit: false,
        })
      }

      if (normalizedItems.length === 0) {
        setError('没有可保存的标题。请先修复超长标题，或换一批更贴合商品的裂变标题。')
        setLoading(false)
        return
      }

      const updatedShop = {
        ...selectedShop,
        products: (selectedShop.products || []).map(item => {
          if (item.id !== selectedProduct.id) return item
          return appendTitleVariants(item, normalizedItems)
        }),
      }

      onUpdateShop?.(updatedShop)

      setResults(prev => prev.map((item, index) => {
        const saved = savedIndexes.get(index)
        return saved
          ? { ...item, title: saved.title, len: saved.len, overLimit: saved.overLimit }
          : item
      }))

      setStatusMessage(`已保存 ${normalizedItems.length} 条标题到商品「${selectedProduct.name}」标题池。`)
    } catch (e) {
      setError(`保存到商品标题池失败：${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [onUpdateShop, results, selectedProduct, selectedShop, settings])

  // 配置检查
  const configOk = settings.apiKey && settings.endpointId

  return (
    <div className="panel" style={{ maxWidth: 960 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>🔥 标题裂变</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>
        录入爆款标题 → AI 分析规律 → 批量裂变生成同风格新标题
      </p>

      {/* 步骤指示器 */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#f8f9fa', borderRadius: 12, padding: 6,
      }}>
        {STEPS.map(s => (
          <button
            key={s.num}
            onClick={() => {
              // 允许回退或点击已完成步骤
              if (s.num <= step || (s.num === 2 && analysis) || (s.num === 5 && results.length > 0)) {
                setStep(s.num)
              }
            }}
            style={{
              flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: step === s.num ? 700 : 500, cursor: 'pointer',
              background: step === s.num ? '#fff' : 'transparent',
              color: step === s.num ? '#e53e3e' : s.num <= step ? '#333' : '#bbb',
              boxShadow: step === s.num ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{
              display: 'inline-block', width: 20, height: 20, lineHeight: '20px',
              borderRadius: '50%', fontSize: 11, marginRight: 4,
              background: s.num < step ? '#48bb78' : step === s.num ? '#e53e3e' : '#ddd',
              color: '#fff',
            }}>
              {s.num < step ? '✓' : s.num}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030',
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ flex: 1 }}>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 14,
          }}>✕</button>
        </div>
      )}

      {statusMessage && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749',
          fontSize: 13,
        }}>
          {statusMessage}
        </div>
      )}

      {/* ========== 步骤1：录入爆款标题 ========== */}
      {step === 1 && (
        <div>
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10,
            padding: 14, marginBottom: 16, fontSize: 13, color: '#92400e',
          }}>
            💡 <strong>使用方法：</strong>将你收集的小红书爆款标题粘贴到下方（每行一个），建议至少10个以上效果更佳。
            AI 会分析这些标题的共同规律，然后为你的商品批量裂变生成同风格的新标题。
          </div>

          <div className="form-group">
            <label>爆款标题库（每行一个）</label>
            <textarea
              value={titles}
              onChange={e => setTitles(e.target.value)}
              placeholder={'例如：\n求求了别再买教辅了❗这套资料直接封神\n考研人看过来！这份笔记让我三个月逆袭上岸\n后悔没早知道😭这份资料早看早上岸\n工作三年才明白，这份行业报告值得反复看\n...'}
              rows={12}
              style={{
                width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd',
                fontSize: 13, lineHeight: 1.8, resize: 'vertical', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              已输入 <strong style={{ color: titleList.length >= 3 ? '#48bb78' : '#e53e3e' }}>
                {titleList.length}
              </strong> 个标题
              {titleList.length < 3 && '（至少需要3个）'}
              {titleList.length >= 10 && ' ✨ 数量充足，分析效果好'}
            </span>
            <button
              className="btn-primary"
              disabled={loading || titleList.length < 3 || !configOk}
              onClick={handleAnalyze}
              style={{ minWidth: 140 }}
            >
              {loading ? '⏳ AI 分析中...' : '🔍 开始分析规律'}
            </button>
          </div>
        </div>
      )}

      {/* ========== 步骤2：AI 分析结果 ========== */}
      {step === 2 && (
        <div>
          <div style={{
            background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 10,
            padding: 14, marginBottom: 16, fontSize: 13, color: '#276749',
          }}>
            ✅ 已分析 <strong>{titleList.length}</strong> 个爆款标题的规律。
            查看分析结果后，点击「下一步」填写目标商品信息。
          </div>

          <div style={{
            background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: 16, maxHeight: 500, overflow: 'auto', fontSize: 13, lineHeight: 1.8,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {analysis}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 12 }}>
            <button
              className="btn-secondary"
              onClick={() => setStep(1)}
            >
              ← 返回修改标题
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-secondary"
                disabled={loading}
                onClick={handleAnalyze}
              >
                🔄 重新分析
              </button>
              <button
                className="btn-primary"
                onClick={() => setStep(3)}
              >
                下一步 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 步骤3：目标商品/主题 ========== */}
      {step === 3 && (
        <div>
          <div style={{
            background: '#ebf8ff', border: '1px solid #90cdf4', borderRadius: 10,
            padding: 14, marginBottom: 16, fontSize: 13, color: '#2a4365',
          }}>
            📦 填写你想要裂变生成标题的目标商品或主题信息。
          </div>

          {/* 模式切换 */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16,
            background: '#f8f9fa', borderRadius: 8, padding: 4,
          }}>
            <button
              onClick={() => setUseKeyword(false)}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: !useKeyword ? '#fff' : 'transparent',
                color: !useKeyword ? '#e53e3e' : '#888',
                boxShadow: !useKeyword ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              📦 商品模式
            </button>
            <button
              onClick={() => setUseKeyword(true)}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: useKeyword ? '#fff' : 'transparent',
                color: useKeyword ? '#e53e3e' : '#888',
                boxShadow: useKeyword ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              🔑 关键词模式
            </button>
          </div>

          {useKeyword ? (
            <div className="form-group">
              <label>主题关键词</label>
              <input
                type="text"
                value={product.keyword}
                onChange={e => setProduct(p => ({ ...p, keyword: e.target.value }))}
                placeholder="如：考研资料、理财知识、育儿指南"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 12, color: '#999', marginTop: 4, display: 'block' }}>
                关键词模式适合快速生成，不需要详细商品信息
              </span>
            </div>
          ) : (
            <>
              {shops.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group">
                    <label>关联店铺</label>
                    <select
                      value={selectedShopId}
                      onChange={e => handleChooseProduct(e.target.value, shops.find(shop => shop.id === e.target.value)?.products?.[0]?.id || '')}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      {shops.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>关联商品</label>
                    <select
                      value={selectedProductId}
                      onChange={e => handleChooseProduct(selectedShopId, e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      {selectableProducts.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>商品名称 <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="text"
                  value={product.name}
                  onChange={e => setProduct(p => ({ ...p, name: e.target.value }))}
                  placeholder="如：2025考研政治冲刺笔记"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group">
                <label>商品描述</label>
                <input
                  type="text"
                  value={product.description}
                  onChange={e => setProduct(p => ({ ...p, description: e.target.value }))}
                  placeholder="简要描述商品内容和特点"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>目标人群</label>
                  <input
                    type="text"
                    value={product.audience}
                    onChange={e => setProduct(p => ({ ...p, audience: e.target.value }))}
                    placeholder="如：考研学生、职场新人"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="form-group">
                  <label>核心卖点</label>
                  <input
                    type="text"
                    value={product.sellingPoints}
                    onChange={e => setProduct(p => ({ ...p, sellingPoints: e.target.value }))}
                    placeholder="如：全面系统、一站式备考"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* 生成数量 */}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label>裂变生成数量</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[5, 10, 15, 20, 30].map(n => (
                <button
                  key={n}
                  onClick={() => setFissionCount(n)}
                  style={{
                    padding: '6px 16px', borderRadius: 6, border: '1px solid',
                    borderColor: fissionCount === n ? '#e53e3e' : '#ddd',
                    background: fissionCount === n ? '#fff5f5' : '#fff',
                    color: fissionCount === n ? '#e53e3e' : '#666',
                    fontWeight: fissionCount === n ? 700 : 400,
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {n} 个
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 12 }}>
            <button className="btn-secondary" onClick={() => setStep(2)}>
              ← 返回查看分析
            </button>
            <button
              className="btn-primary"
              disabled={loading || (!useKeyword && !product.name) || (useKeyword && !product.keyword)}
              onClick={handleFission}
              style={{ minWidth: 160 }}
            >
              {loading ? '⏳ 裂变生成中...' : `🚀 裂变生成 ${fissionCount} 个标题`}
            </button>
          </div>
        </div>
      )}

      {/* ========== 步骤4：裂变生成中（loading 过渡） ========== */}
      {step === 4 && loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔥</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>AI 正在裂变生成标题...</p>
          <p style={{ fontSize: 13, color: '#888' }}>基于分析出的爆款公式，为你的商品生成全新标题</p>
          <div className="progress-bar" style={{ marginTop: 24, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="progress-fill" style={{ width: '60%', transition: 'width 2s' }} />
          </div>
        </div>
      )}

      {/* ========== 步骤5：结果管理 ========== */}
      {step === 5 && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
              🎯 已生成 {results.length} 个标题
              {results.some(r => r.overLimit) && (
                <span style={{ color: '#e53e3e', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                  （{results.filter(r => r.overLimit).length} 个超出字数限制）
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {!useKeyword && selectedProduct && (
                <button
                  className="btn-primary btn-sm"
                  disabled={loading || results.length === 0}
                  onClick={handleSaveToProduct}
                >
                  保存到商品标题池
                </button>
              )}
              <button
                className="btn-secondary btn-sm"
                onClick={handleCopyAll}
              >
                {copied === 'all' ? '✅ 已复制' : '📋 复制全部'}
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setStep(3)}
              >
                🔄 重新生成
              </button>
            </div>
          </div>

          {/* 结果列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  background: item.overLimit ? '#fff5f5' : '#fafafa',
                  border: `1px solid ${item.overLimit ? '#feb2b2' : '#e2e8f0'}`,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  fontSize: 12, color: '#999', fontWeight: 600, minWidth: 24, textAlign: 'center',
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#333', wordBreak: 'break-word' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    公式：{item.formula}
                    <span style={{
                      marginLeft: 8,
                      color: item.overLimit ? '#e53e3e' : '#48bb78',
                      fontWeight: item.overLimit ? 600 : 400,
                    }}>
                      {item.len}/20字 {item.overLimit ? '⚠️ 超限' : '✓'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {item.overLimit && (
                    <button
                      onClick={() => handleFixTitle(idx)}
                      disabled={loading}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #feb2b2',
                        background: '#fff5f5', color: '#e53e3e', fontSize: 11,
                        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
                      }}
                    >
                      ✂️ 缩写
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(item.title, idx)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                      background: copied === idx ? '#f0fff4' : '#fff', fontSize: 11,
                      cursor: 'pointer', color: copied === idx ? '#48bb78' : '#666',
                    }}
                  >
                    {copied === idx ? '✅' : '📋'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 快速操作 */}
          {results.some(r => r.overLimit) && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                className="btn-primary btn-sm"
                disabled={loading}
                onClick={async () => {
                  setLoading(true)
                  setError('')
                  try {
                    const overItems = results.map((r, i) => ({ ...r, idx: i })).filter(r => r.overLimit)
                    for (const item of overItems) {
                      const fixed = await fixOverLimitTitle(settings, item.title, item.formula)
                      setResults(prev => prev.map((r, i) => i === item.idx ? { ...r, title: fixed.title, len: fixed.len, overLimit: fixed.overLimit } : r))
                      await new Promise(r => setTimeout(r, 500))
                    }
                  } catch (e) {
                    setError('批量修复失败：' + e.message)
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                {loading ? '⏳ 修复中...' : `✂️ 一键修复所有超限标题（${results.filter(r => r.overLimit).length}个）`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========== 历史记录（步骤1或5底部显示） ========== */}
      {(step === 1 || step === 5) && history.length > 0 && (
        <div style={{ marginTop: 32, borderTop: '1px solid #eee', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#555' }}>📜 历史记录</h3>
            <button
              onClick={handleClearHistory}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid #feb2b2',
                background: '#fff5f5', color: '#e53e3e', fontSize: 11,
                cursor: 'pointer',
              }}
            >
              🗑 清空
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(record => (
              <div
                key={record.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 8,
                  background: '#fafafa', border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>
                    {record.product}
                    <span style={{ color: '#999', fontWeight: 400, marginLeft: 8 }}>
                      ({record.results.length} 个标题)
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {record.time} · 基于 {record.titleCount} 个爆款标题分析
                  </div>
                </div>
                <button
                  onClick={() => handleRestoreHistory(record)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: '1px solid #90cdf4',
                    background: '#ebf8ff', color: '#2a4365', fontSize: 11,
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  查看
                </button>
                <button
                  onClick={() => handleDeleteHistory(record.id)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, border: 'none',
                    background: 'none', color: '#ccc', fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
