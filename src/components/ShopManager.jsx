import { useState } from 'react'
import QianfanSync from './QianfanSync'

const normalizeProductId = (value = '') => String(value)
  .replace(/^(?:商品ID|商品Id|ID)\s*[:：]\s*/i, '')
  .trim()

const normalizeProductName = (value = '') => String(value)
  .replace(/\s*(?:商品ID|商品Id|ID)\s*[:：]\s*[A-Za-z0-9_-]+/gi, ' ')
  .replace(/\s*预览\b/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildIncomingProduct = (product) => {
  const rawName = String(product?.name || product?.title || '')
  const nameIdMatch = rawName.match(/商品\s*ID\s*[:：]\s*([a-zA-Z0-9_-]+)/i)
  const productId = normalizeProductId(product?.productId || product?.id || '') || (nameIdMatch ? nameIdMatch[1] : '')
  return {
    productId,
    name: normalizeProductName(rawName),
    description: String(product?.description || product?.desc || '').trim(),
  }
}

const getProductMatchKey = (product) => {
  const productId = normalizeProductId(product?.productId || '')
  if (productId) return `id:${productId}`

  const normalizedName = normalizeProductName(product?.name || '').toLowerCase()
  if (normalizedName) return `name:${normalizedName}`

  return ''
}

export default function ShopManager({ shops, onUpdate, activeShopId, onSelectShop }) {
  const [showSync, setShowSync] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  const handleDelete = (id) => {
    if (!confirm('确认删除该店铺及其全部商品和账号？')) return

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

    onUpdate(shops.map(s => (s.id === renaming ? { ...s, name: renameVal.trim() } : s)))
    setRenaming(null)
    setRenameVal('')
  }

  const handleResync = (shop) => {
    onSelectShop(shop.id)
    setShowSync(true)
  }

  const handleQianfanImport = (shopData) => {
    const incomingProducts = (shopData.products || [])
      .map(buildIncomingProduct)
      .filter(p => p.productId || p.name)

    const dedupedIncomingProducts = []
    const seenIncomingKeys = new Set()
    for (const product of incomingProducts) {
      const key = getProductMatchKey(product)
      if (!key || seenIncomingKeys.has(key)) continue
      seenIncomingKeys.add(key)
      dedupedIncomingProducts.push(product)
    }

    const existIdx = shops.findIndex(s =>
      (shopData.shopId && s.shopId === shopData.shopId) ||
      s.name === shopData.shopName
    )

    if (existIdx >= 0) {
      const existing = shops[existIdx]
      const mergedProducts = existing.products.map(p => ({ ...p }))
      const existingIndexByKey = new Map()

      mergedProducts.forEach((product, index) => {
        const key = getProductMatchKey(product)
        if (key && !existingIndexByKey.has(key)) {
          existingIndexByKey.set(key, index)
        }
      })

      let updatedCount = 0
      let unchangedCount = 0
      const newProducts = []

      dedupedIncomingProducts.forEach((incomingProduct, i) => {
        const key = getProductMatchKey(incomingProduct)
        const existingIndex = key ? existingIndexByKey.get(key) : undefined

        if (existingIndex !== undefined) {
          const current = mergedProducts[existingIndex]
          const nextProductId = normalizeProductId(current.productId || incomingProduct.productId || '')
          const nextName = incomingProduct.name || current.name || ''
          const nextDescription = incomingProduct.description || current.description || ''
          const currentDescription = current.description || ''

          if (
            nextProductId !== normalizeProductId(current.productId || '') ||
            nextName !== (current.name || '') ||
            nextDescription !== currentDescription
          ) {
            mergedProducts[existingIndex] = {
              ...current,
              productId: nextProductId,
              name: nextName,
              description: nextDescription,
            }
            updatedCount++
          } else {
            unchangedCount++
          }

          return
        }

        const newProduct = {
          id: `${Date.now()}_${i}`,
          productId: incomingProduct.productId || '',
          name: incomingProduct.name || '',
          description: incomingProduct.description || '',
          audience: '',
          sellingPoints: '',
        }

        mergedProducts.push(newProduct)
        newProducts.push(newProduct)

        if (key) {
          existingIndexByKey.set(key, mergedProducts.length - 1)
        }
      })

      const merged = {
        ...existing,
        name: shopData.shopName || existing.name,
        shopId: shopData.shopId || existing.shopId,
        products: mergedProducts,
      }

      const updated = shops.map((s, i) => (i === existIdx ? merged : s))
      onUpdate(updated)
      onSelectShop(merged.id)

      const parts = []
      if (newProducts.length > 0) parts.push(`新增 ${newProducts.length} 个商品`)
      if (updatedCount > 0) parts.push(`更新 ${updatedCount} 个商品`)
      if (unchangedCount > 0) parts.push(`${unchangedCount} 个商品无变化`)

      alert(`已同步店铺「${merged.name}」：${parts.length > 0 ? parts.join('，') : '无变化'}`)
    } else {
      const newShop = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: shopData.shopName || '未命名店铺',
        shopId: shopData.shopId || '',
        products: dedupedIncomingProducts.map((p, i) => ({
          id: `${Date.now()}_${i}`,
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
      <h2>🏬 店铺管理</h2>

      <div className="btn-row">
        <button
          className={`btn-import ${showSync ? 'active' : ''}`}
          onClick={() => setShowSync(!showSync)}
        >
          🔗 {showSync ? '收起千帆同步' : '从千帆同步店铺'}
        </button>
      </div>

      {showSync && (
        <QianfanSync onImport={handleQianfanImport} />
      )}

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
                        if (e.key === 'Escape') {
                          setRenaming(null)
                          setRenameVal('')
                        }
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
                  <button className="btn-sm" onClick={() => handleResync(shop)}>🔄 同步</button>
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
