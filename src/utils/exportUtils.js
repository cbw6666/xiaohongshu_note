import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { renderCoverToBlob } from './coverRenderer.js'

// 将 Blob 转为 base64 字符串
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
}

// 清理商品名称中混入的商品ID、"预览"等多余信息
function cleanProductName(name) {
  if (!name) return ''
  // 去掉 "商品ID:" 及其后面的ID值、"预览" 等多余内容
  return name
    .replace(/\n?\s*商品\s*ID\s*[:：]\s*[\s\S]*/i, '')
    .replace(/\n?\s*预览\s*$/, '')
    .trim()
}

// 从商品名称中提取商品ID（如果 productItemId 为空）
function extractProductId(name, existingId) {
  if (existingId) return existingId
  if (!name) return ''
  const match = name.match(/商品\s*ID\s*[:：]\s*([a-zA-Z0-9]+)/i)
  return match ? match[1] : ''
}

export async function exportExcel(notes, onProgress) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('笔记')

  // 表头：按截图字段排列
  const headers = ['店铺', '账号', '商品名称', '商品ID', '笔记标题', '正文', '标签', '笔记封面']
  const headerRow = sheet.addRow(headers)

  // 表头样式
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    }
  })

  // 设置列宽
  sheet.columns = [
    { width: 14 },  // 店铺
    { width: 14 },  // 账号
    { width: 20 },  // 商品名称
    { width: 14 },  // 商品ID
    { width: 28 },  // 笔记标题
    { width: 50 },  // 正文
    { width: 24 },  // 标签
    { width: 22 },  // 笔记封面
  ]

  // 封面图目标尺寸（像素），用于单元格内显示
  const coverW = 140
  const coverH = 187

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]

    if (onProgress) {
      onProgress({ current: i + 1, total: notes.length })
    }

    const row = sheet.addRow([
      n.shopName,
      n.accountName,
      cleanProductName(n.productName),
      extractProductId(n.productName, n.productItemId),
      n.title,
      n.content,
      (n.tags || '').split(/\s+/).filter(Boolean).join(','),
      '', // 封面图占位
    ])

    // 设置行高以容纳封面图
    row.height = coverH * 0.75  // Excel 行高单位约为像素的 0.75

    // 正文列自动换行
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' }
    // 其他列垂直居中
    for (let c = 1; c <= 8; c++) {
      if (c !== 6) {
        row.getCell(c).alignment = { vertical: 'middle', wrapText: true }
      }
    }

    // 渲染封面图并嵌入
    try {
      const blob = await renderCoverToBlob(
        n.coverTemplateId,
        { title: n.coverTitle, subtitle: n.coverSubtitle },
        i
      )
      const base64 = await blobToBase64(blob)
      const imageId = workbook.addImage({
        base64,
        extension: 'png',
      })

      // 将图片锚定到笔记封面列（第8列，索引7）
      sheet.addImage(imageId, {
        tl: { col: 7, row: i + 1 },  // +1 因为表头占第0行
        ext: { width: coverW, height: coverH },
      })
    } catch (err) {
      console.warn(`封面图渲染失败(第${i + 1}条):`, err)
      row.getCell(8).value = '[封面生成失败]'
    }
  }

  // 导出
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const date = new Date().toISOString().slice(0, 10)
  saveAs(blob, `小红书笔记_${date}.xlsx`)
}
