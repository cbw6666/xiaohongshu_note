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
  const [activeShopId, setActiveShopId] = useState(() => {
    const s = loadShops()
    return s.length > 0 ? s[0].id : ''
  })

  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => { saveShops(shops) }, [shops])
  useEffect(() => { saveGenerated(generated) }, [generated])

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
                <ProductManager shop={activeShop} onUpdateShop={handleUpdateShop} settings={settings} />
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
                <ExportPanel notes={generated} />
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
