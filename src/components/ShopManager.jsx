import { useState } from 'react'
import QianfanSync from './QianfanSync'

export default function ShopManager({ shops, onUpdate, activeShopId, onSelectShop }) {
  const [showSync, setShowSync] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  const handleDelete = (id) => {
    if (!confirm('确认删除该店铺及其所有商品和账号？')) return
    const updated = shops.filter(s => s.id !== id)
    onUpdate(updated)
    if (activeShopId === id) {
      onSelectShop(updated[0]?.id || '')
    }
  }

  const startRename = (shop) => {
    setRenaming(shop.id)
    setRenameVal(shop.name)
  }

  const handleRename = () => {
    if (!renameVal.trim()) return
    onUpdate(shops.map(s => s.id === renaming ? { ...s, name: renameVal.trim() } : s))
    setRenaming(null)
    setRenameVal('')
  }

  // 从千帆同步导入店铺
  const handleQianfanImport = (shopData) => {
    // 检查是否已存在同名/同ID店铺，存在则更新商品
    const existIdx = shops.findIndex(s =>
      (shopData.shopId && s.shopId === shopData.shopId) ||
      s.name === shopData.shopName
    )

    if (existIdx >= 0) {
      // 已存在 → 合并商品（用productId去重）
      const existing = shops[existIdx]
      const existingIds = new Set(existing.products.map(p => p.productId))
      const newProducts = (shopData.products || [])
        .filter(p => !existingIds.has(p.productId))
        .map((p, i) => ({
          id: Date.now().toString() + i,
          productId: p.productId || '',
          name: p.name || '',
          description: p.description || '',
          audience: '',
          sellingPoints: '',
        }))

      const merged = {
        ...existing,
        name: shopData.shopName || existing.name,
        shopId: shopData.shopId || existing.shopId,
        products: [...existing.products, ...newProducts],
      }

      const updated = shops.map((s, i) => i === existIdx ? merged : s)
      onUpdate(updated)
      onSelectShop(merged.id)
      alert(`已更新店铺「${merged.name}」，新增 ${newProducts.length} 个商品（跳过 ${shopData.products.length - newProducts.length} 个重复商品）`)
    } else {
      // 新店铺
      const newShop = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: shopData.shopName || '未命名店铺',
        shopId: shopData.shopId || '',
        products: (shopData.products || []).map((p, i) => ({
          id: Date.now().toString() + i,
          productId: p.productId || '',
          name: p.name || '',
          description: p.description || '',
          audience: '',
          sellingPoints: '',
        })),
        accounts: [],
      }
      const updated = [...shops, newShop]
      onUpdate(updated)
      onSelectShop(newShop.id)
      alert(`成功导入店铺「${newShop.name}」，共 ${newShop.products.length} 个商品`)
    }

    setShowSync(false)
  }

  return (
    <div className="panel">
      <h2>🏪 店铺管理</h2>

      <div className="btn-row">
        <button
          className={`btn-import ${showSync ? 'active' : ''}`}
          onClick={() => setShowSync(!showSync)}
        >
          🔗 {showSync ? '收起千帆同步' : '从千帆同步店铺'}
        </button>
      </div>

      {/* 千帆同步面板 */}
      {showSync && (
        <QianfanSync onImport={handleQianfanImport} />
      )}

      {/* 店铺列表 */}
      {shops.length > 0 && (
        <div className="shop-list">
          {shops.map(shop => (
            <div
              key={shop.id}
              className={`shop-card ${activeShopId === shop.id ? 'active' : ''}`}
              onClick={() => onSelectShop(shop.id)}
            >
              <div className="shop-info">
                {renaming === shop.id ? (
                  <div className="rename-row" onClick={e => e.stopPropagation()}>
                    <input
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename()
                        if (e.key === 'Escape') { setRenaming(null); setRenameVal('') }
                      }}
                      autoFocus
                      className="rename-input"
                    />
                    <div className="btn-row" style={{ marginTop: 4 }}>
                      <button className="btn-sm btn-primary" onClick={handleRename}>保存</button>
                      <button className="btn-sm" onClick={() => { setRenaming(null); setRenameVal('') }}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong>{shop.name}</strong>
                    <span className="shop-stats">
                      {shop.shopId && <span className="product-id" style={{ marginRight: 4 }}>ID: {shop.shopId}</span>}
                      {shop.products.length} 个商品 · {shop.accounts.length} 个账号
                    </span>
                  </>
                )}
              </div>
              {renaming !== shop.id && (
                <div className="item-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-sm" onClick={() => startRename(shop)}>重命名</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(shop.id)}>删除</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {shops.length === 0 && !showSync && (
        <p className="empty-state">还没有店铺，请点击上方按钮从千帆同步</p>
      )}
    </div>
  )
}
