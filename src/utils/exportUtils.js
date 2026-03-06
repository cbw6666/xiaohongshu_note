import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { renderCoverToBlob } from './coverRenderer.js'

export function notesToCSV(notes) {
  const headers = ['店铺', '账号', '商品名称', '商品ID', '标题', '正文', '标签', '封面主标题', '封面副标题', '封面模板']
  const escape = (s) => {
    if (!s) return ''
    const str = String(s).replace(/"/g, '""')
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
  }

  const rows = notes.map(n => [
    n.shopName,
    n.accountName,
    n.productName,
    n.productItemId || '',
    n.title,
    n.content,
    n.tags,
    n.coverTitle,
    n.coverSubtitle,
    n.coverTemplateId,
  ].map(escape).join(','))

  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n')
}

export async function exportAll(notes) {
  const zip = new JSZip()

  // CSV
  const csv = notesToCSV(notes)
  zip.file('笔记文案.csv', csv)

  // 按店铺/账号分文件夹存封面图
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    const blob = await renderCoverToBlob(
      note.coverTemplateId,
      { title: note.coverTitle, subtitle: note.coverSubtitle },
      i
    )
    const folderName = `封面图/${note.shopName}/${note.accountName}`.replace(/[\\:*?"<>|]/g, '_')
    const fileName = `${i + 1}_${note.productName}.png`.replace(/[/\\:*?"<>|]/g, '_')
    zip.file(`${folderName}/${fileName}`, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const date = new Date().toISOString().slice(0, 10)
  saveAs(zipBlob, `小红书笔记_${date}.zip`)
}

export function downloadCSV(notes) {
  const csv = notesToCSV(notes)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const date = new Date().toISOString().slice(0, 10)
  saveAs(blob, `笔记文案_${date}.csv`)
}
