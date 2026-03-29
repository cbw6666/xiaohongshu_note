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

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return Boolean(value)
}

const uniqueBy = (items, getKey) => {
  const seen = new Set()
  const out = []
  for (const item of items || []) {
    const key = String(getKey(item) || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

// 合并两条“同一商品”记录，优先保留已有配置，补齐缺失字段
const mergeProductRecord = (base, incoming) => ({
  ...base,
  productId: normalizeProductId(base?.productId || incoming?.productId || ''),
  name: normalizeProductName(base?.name || incoming?.name || ''),
  description: hasValue(base?.description) ? base.description : (incoming?.description || ''),
  audience: hasValue(base?.audience) ? base.audience : (incoming?.audience || ''),
  sellingPoints: hasValue(base?.sellingPoints) ? base.sellingPoints : (incoming?.sellingPoints || ''),
  customSystemPrompt: hasValue(base?.customSystemPrompt) ? base.customSystemPrompt : incoming?.customSystemPrompt,
  customUserPrompt: hasValue(base?.customUserPrompt) ? base.customUserPrompt : incoming?.customUserPrompt,
  customCoverTitle: hasValue(base?.customCoverTitle) ? base.customCoverTitle : incoming?.customCoverTitle,
  customCoverSubtitle: hasValue(base?.customCoverSubtitle) ? base.customCoverSubtitle : incoming?.customCoverSubtitle,
  customCoverTemplateId: hasValue(base?.customCoverTemplateId) ? base.customCoverTemplateId : incoming?.customCoverTemplateId,
  customCoverVariants: hasValue(base?.customCoverVariants) ? base.customCoverVariants : incoming?.customCoverVariants,
  references: uniqueBy([...(base?.references || []), ...(incoming?.references || [])], r => r?.id || r?.text),
  styleTemplates: uniqueBy([...(base?.styleTemplates || []), ...(incoming?.styleTemplates || [])], t => t?.id || t?.name),
  seoConfig: hasValue(base?.seoConfig) ? base.seoConfig : incoming?.seoConfig,
})

// 同 productId 的重复商品做合并（保留最早那条，避免打散已配置的本地数据）
const dedupeProductsByProductId = (products = []) => {
  const merged = []
  const indexByPid = new Map()
  let removed = 0

  for (const product of products) {
    const pid = normalizeProductId(product?.productId || '')
    if (!pid) {
      merged.push(product)
      continue
    }

    const existIdx = indexByPid.get(pid)
    if (existIdx === undefined) {
      indexByPid.set(pid, merged.length)
      merged.push(product)
      continue
    }

    merged[existIdx] = mergeProductRecord(merged[existIdx], product)
    removed++
  }

  return { products: merged, removed }
}

// 同名合并：用于修复“旧记录无ID + 新记录有ID”的重复场景
// 仅在两个记录 ID 一致或其中一条缺失 ID 时才合并，避免误合并不同商品。
const dedupeProductsByName = (products = []) => {
  const merged = []
  const indexByName = new Map()
  let removed = 0

  for (const product of products) {
    const nameKey = normalizeProductName(product?.name || '').toLowerCase()
    if (!nameKey) {
      merged.push(product)
      continue
    }

    const existIdx = indexByName.get(nameKey)
    if (existIdx === undefined) {
      indexByName.set(nameKey, merged.length)
      merged.push(product)
      continue
    }

    const current = merged[existIdx]
    const currentPid = normalizeProductId(current?.productId || '')
    const nextPid = normalizeProductId(product?.productId || '')
    const canMerge = !currentPid || !nextPid || currentPid === nextPid

    if (!canMerge) {
      // 同名但不同ID，视为不同商品，保留
      merged.push(product)
      continue
    }

    merged[existIdx] = mergeProductRecord(current, product)
    removed++
  }

  return { products: merged, removed }
}

const dedupeProducts = (products = []) => {
  const byId = dedupeProductsByProductId(products)
  const byName = dedupeProductsByName(byId.products)
  return {
    products: byName.products,
    removedById: byId.removed,
    removedByName: byName.removed,
    removed: byId.removed + byName.removed,
  }
}

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
      const existingIndexById = new Map()
      const existingIndexByName = new Map()

      mergedProducts.forEach((product, index) => {
        const pid = normalizeProductId(product.productId || '')
        const nameKey = normalizeProductName(product.name || '').toLowerCase()
        if (pid && !existingIndexById.has(pid)) existingIndexById.set(pid, index)
        if (nameKey && !existingIndexByName.has(nameKey)) existingIndexByName.set(nameKey, index)
      })

      let updatedCount = 0
      let unchangedCount = 0
      const newProducts = []

      dedupedIncomingProducts.forEach((incomingProduct, i) => {
        const incomingPid = normalizeProductId(incomingProduct.productId || '')
        const incomingName = normalizeProductName(incomingProduct.name || '')
        const incomingNameKey = incomingName.toLowerCase()

        // 匹配优先级：先按商品ID，再按商品名（用于给旧商品补ID，避免新增重复项）
        const existingIndex = (
          (incomingPid ? existingIndexById.get(incomingPid) : undefined) ??
          (incomingNameKey ? existingIndexByName.get(incomingNameKey) : undefined)
        )

        if (existingIndex !== undefined) {
          const current = mergedProducts[existingIndex]
          const nextProductId = normalizeProductId(current.productId || incomingPid || '')
          const nextName = incomingName || current.name || ''
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

          if (nextProductId) existingIndexById.set(nextProductId, existingIndex)
          if (nextName) existingIndexByName.set(normalizeProductName(nextName).toLowerCase(), existingIndex)

          return
        }

        const newProduct = {
          id: `${Date.now()}_${i}`,
          productId: incomingPid || '',
          name: incomingName || '',
          description: incomingProduct.description || '',
          audience: '',
          sellingPoints: '',
        }

        mergedProducts.push(newProduct)
        newProducts.push(newProduct)

        const newIndex = mergedProducts.length - 1
        if (incomingPid) existingIndexById.set(incomingPid, newIndex)
        if (incomingNameKey) existingIndexByName.set(incomingNameKey, newIndex)
      })

      const dedupedMerged = dedupeProducts(mergedProducts)

      const merged = {
        ...existing,
        name: shopData.shopName || existing.name,
        shopId: shopData.shopId || existing.shopId,
        products: dedupedMerged.products,
      }

      const updated = shops.map((s, i) => (i === existIdx ? merged : s))
      onUpdate(updated)
      onSelectShop(merged.id)

      const parts = []
      if (newProducts.length > 0) parts.push(`新增 ${newProducts.length} 个商品`)
      if (updatedCount > 0) parts.push(`更新 ${updatedCount} 个商品`)
      if (unchangedCount > 0) parts.push(`${unchangedCount} 个商品无变化`)
      if (dedupedMerged.removedById > 0) parts.push(`按ID合并重复 ${dedupedMerged.removedById} 个商品`)
      if (dedupedMerged.removedByName > 0) parts.push(`按名称合并重复 ${dedupedMerged.removedByName} 个商品`)

      alert(`已同步店铺「${merged.name}」：${parts.length > 0 ? parts.join('，') : '无变化'}`)
    } else {
      const dedupedNew = dedupeProducts(
        dedupedIncomingProducts.map((p, i) => ({
          id: `${Date.now()}_${i}`,
          productId: p.productId || '',
          name: p.name || '',
          description: p.description || '',
          audience: '',
          sellingPoints: '',
        })),
      )

      const newShop = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: shopData.shopName || '未命名店铺',
        shopId: shopData.shopId || '',
        products: dedupedNew.products,
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
