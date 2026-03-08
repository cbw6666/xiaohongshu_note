import { useState, useEffect } from 'react'
import Settings from './components/Settings.jsx'
import ShopManager from './components/ShopManager.jsx'
import ProductManager from './components/ProductManager.jsx'
import AccountManager from './components/AccountManager.jsx'
import BatchGenerator from './components/BatchGenerator.jsx'
import NotePreview from './components/NotePreview.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import CoverGallery from './components/CoverGallery.jsx'
import { loadSettings, saveSettings, loadShops, saveShops, loadGenerated, saveGenerated } from './utils/storage.js'

const TABS = [
  { id: 'shops', label: '🏪 店铺管理' },
  { id: 'generate', label: '🚀 批量生成' },
  { id: 'results', label: '📋 生成结果' },
  { id: 'covers', label: '🎨 封面预览' },
  { id: 'settings', label: '⚙️ 设置' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('shops')
  const [settings, setSettings] = useState(loadSettings)
  const [shops, setShops] = useState(loadShops)
  const [generated, setGenerated] = useState(loadGenerated)
  const [innerImagesMap, setInnerImagesMap] = useState({}) // { [productId]: [base64...] }
  const [storageWarning, setStorageWarning] = useState(null)
  const [activeShopId, setActiveShopId] = useState(() => {
    const s = loadShops()
    return s.length > 0 ? s[0].id : ''
  })

  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => { saveShops(shops) }, [shops])
  useEffect(() => {
    const result = saveGenerated(generated)
    if (result.status === 'trimmed') {
      setStorageWarning({
        message: `存储空间不足，仅保留了最新 ${result.kept} 条笔记（共 ${result.total} 条）。`,
        advice: '建议先导出 Excel 再清空历史笔记，然后重新生成。',
      })
    } else if (result.status === 'cleared' || result.status === 'error') {
      setStorageWarning({
        message: '存储空间严重不足，缓存已被清空。',
        advice: '请清理浏览器存储后重新生成。',
      })
    } else if (storageWarning) {
      setStorageWarning(null)
    }
  }, [generated])

  const activeShop = shops.find(s => s.id === activeShopId) || null

  const handleUpdateShop = (updatedShop) => {
    setShops(prev => prev.map(s => s.id === updatedShop.id ? updatedShop : s))
  }

  const handleGenerated = (newNotes) => {
    setGenerated(prev => [...newNotes, ...prev])
    setActiveTab('results')
  }

  const handleUpdateNote = (noteId, updates) => {
    setGenerated(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n))
  }

  const handleDeleteNote = (noteId) => {
    setGenerated(prev => prev.filter(n => n.id !== noteId))
  }

  const handleClearAll = () => {
    if (confirm('确认清空所有已生成的笔记？')) {
      setGenerated([])
    }
  }

  const configOk = settings.apiKey && settings.endpointId
  const hasValidShop = shops.some(s => s.products.length > 0 && s.accounts.length > 0)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>📕 小红书批量笔记生成器</h1>
          <p className="header-sub">多店铺 · 多账号 · AI文案 + 封面图一键生成</p>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'results' && generated.length > 0 && (
              <span className="tab-badge">{generated.length}</span>
            )}
            {tab.id === 'shops' && shops.length > 0 && (
              <span className="tab-badge">{shops.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* 顶部提示 */}
      {!configOk && activeTab !== 'settings' && (
        <div className="alert alert-warn" onClick={() => setActiveTab('settings')}>
          ⚠️ 请先完成 AI 配置（点击前往设置）
        </div>
      )}
      {configOk && shops.length === 0 && activeTab !== 'shops' && (
        <div className="alert alert-info" onClick={() => setActiveTab('shops')}>
          💡 请先创建店铺并添加商品和账号（点击前往）
        </div>
      )}

      {/* 存储空间不足警告 */}
      {storageWarning && (
        <div style={{
          margin: '0 20px', padding: '12px 18px',
          background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 13, color: '#e65100',
        }}>
          <span style={{ flex: 1 }}>
            ⚠️ <strong>{storageWarning.message}</strong>{' '}{storageWarning.advice}
          </span>
          <button
            onClick={() => { setActiveTab('results'); setStorageWarning(null) }}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: '#e65100', color: '#fff', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
            }}
          >
            📋 前往清理
          </button>
          <button
            onClick={() => setStorageWarning(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, color: '#999', padding: '0 4px',
            }}
          >✕</button>
        </div>
      )}

      <main className="main-content">
        {activeTab === 'settings' && (
          <Settings settings={settings} onSave={setSettings} />
        )}

        {activeTab === 'shops' && (
          <div className="shop-layout">
            <div className="shop-sidebar">
              <ShopManager
                shops={shops}
                onUpdate={setShops}
                activeShopId={activeShopId}
                onSelectShop={setActiveShopId}
              />
            </div>
            {activeShop && (
              <div className="shop-detail">
                <ProductManager shop={activeShop} onUpdateShop={handleUpdateShop} settings={settings} innerImagesMap={innerImagesMap} setInnerImagesMap={setInnerImagesMap} />
                <AccountManager shop={activeShop} onUpdateShop={handleUpdateShop} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'generate' && (
          <BatchGenerator
            settings={settings}
            shops={shops}
            onGenerated={handleGenerated}
            innerImagesMap={innerImagesMap}
          />
        )}

        {activeTab === 'results' && (
          <>
            <NotePreview
              notes={generated}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
            />
            {generated.length > 0 && (
              <>
                <ExportPanel notes={generated} innerImagesMap={innerImagesMap} />
                <div className="panel">
                  <button className="btn-danger" onClick={handleClearAll}>🗑 清空全部笔记</button>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'covers' && (
          <CoverGallery />
        )}
      </main>

      <footer className="app-footer">
        <p>数据保存在浏览器本地 · 不会上传任何内容</p>
      </footer>
    </div>
  )
}
