const MAX_COVER_VARIANTS = 10

function trimText(value) {
  return String(value || '').trim()
}

function hasCoverPayload(variant) {
  if (!variant) return false
  return Boolean(
    trimText(variant.coverTitle) ||
    trimText(variant.coverSubtitle) ||
    trimText(variant.coverTemplateId),
  )
}

function createVariantId(seed = '') {
  return `cv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}${seed ? `_${seed}` : ''}`
}

function normalizeVariant(variant, index = 0) {
  return {
    id: trimText(variant?.id) || createVariantId(String(index)),
    coverTitle: trimText(variant?.coverTitle),
    coverSubtitle: trimText(variant?.coverSubtitle),
    coverTemplateId: trimText(variant?.coverTemplateId),
    enabled: variant?.enabled !== false,
  }
}

export function normalizeCoverVariants(product = {}) {
  const rawList = Array.isArray(product?.customCoverVariants)
    ? product.customCoverVariants
    : null

  if (rawList && rawList.length > 0) {
    return rawList
      .map((variant, index) => normalizeVariant(variant, index))
      .slice(0, MAX_COVER_VARIANTS)
  }

  const legacyVariant = normalizeVariant({
    id: 'legacy',
    coverTitle: product?.customCoverTitle,
    coverSubtitle: product?.customCoverSubtitle,
    coverTemplateId: product?.customCoverTemplateId,
    enabled: true,
  })

  return hasCoverPayload(legacyVariant) ? [legacyVariant] : []
}

export function pickCoverVariant(variants = [], index = 0) {
  if (!Array.isArray(variants) || variants.length === 0) return null
  const usable = variants.filter((variant) => variant.enabled !== false && hasCoverPayload(variant))
  if (usable.length === 0) return null

  const safeIndex = Math.max(0, Number.isFinite(index) ? Math.floor(index) : 0)
  return usable[safeIndex % usable.length]
}

export function syncLegacyCoverFields(product, variants = []) {
  const normalized = (Array.isArray(variants) ? variants : [])
    .map((variant, index) => normalizeVariant(variant, index))
    .filter(hasCoverPayload)
    .slice(0, MAX_COVER_VARIANTS)

  const first = normalized[0]
  return {
    ...product,
    customCoverVariants: normalized.length > 0 ? normalized : undefined,
    customCoverTitle: first?.coverTitle || undefined,
    customCoverSubtitle: first?.coverSubtitle || undefined,
    customCoverTemplateId: first?.coverTemplateId || undefined,
  }
}

export function createBlankCoverVariant(seed = '') {
  return {
    id: createVariantId(seed),
    coverTitle: '',
    coverSubtitle: '',
    coverTemplateId: '',
    enabled: true,
  }
}
