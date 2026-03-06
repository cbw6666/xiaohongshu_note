import { COVER_TEMPLATES } from '../templates/coverTemplates.js'

const CANVAS_W = 1242
const CANVAS_H = 1660

export function renderCover(templateId, data, colorIdx = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  const tpl = COVER_TEMPLATES.find(t => t.id === templateId)
  if (!tpl) {
    ctx.fillStyle = '#FFF3E0'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#333'
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('模板未找到', CANVAS_W / 2, CANVAS_H / 2)
    return canvas
  }

  tpl.render(ctx, CANVAS_W, CANVAS_H, data, colorIdx)
  return canvas
}

export function renderCoverToDataURL(templateId, data, colorIdx = 0) {
  const canvas = renderCover(templateId, data, colorIdx)
  return canvas.toDataURL('image/png')
}

export function renderCoverToBlob(templateId, data, colorIdx = 0) {
  const canvas = renderCover(templateId, data, colorIdx)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
