import ExcelJS from 'exceljs'

function cellToText(cell) {
  if (!cell) return ''
  const { value, text } = cell
  if (text) return String(text).trim()
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }
  if (value?.text) return String(value.text).trim()
  if (value?.result != null) return String(value.result).trim()
  if (value?.hyperlink) return String(value.hyperlink).trim()
  if (Array.isArray(value?.richText)) {
    return value.richText.map(t => t?.text || '').join('').trim()
  }
  return String(value).trim()
}

function isSummaryRow(values) {
  const text = values.filter(Boolean).join(' ')
  if (!text) return true
  return /采集完成\s*\|\s*总计|总计:\s*\d+\s*\|\s*成功:\s*\d+\s*\|\s*失败:\s*\d+/.test(text)
}

function copyRowImages({
  sourceWorkbook,
  sourceImagesByRow,
  sourceRowNumber,
  targetWorkbook,
  targetSheet,
  targetRowNumber,
}) {
  const images = sourceImagesByRow.get(sourceRowNumber) || []
  for (const image of images) {
    try {
      const sourceMedia = sourceWorkbook.getImage(image.imageId)
      if (!sourceMedia?.buffer || !sourceMedia?.extension) continue

      const newImageId = targetWorkbook.addImage({
        buffer: sourceMedia.buffer,
        extension: sourceMedia.extension,
      })

      const tlRowOffset = image.range.tl.row - Math.floor(image.range.tl.row)
      const newRange = {
        tl: {
          col: image.range.tl.col,
          row: targetRowNumber - 1 + tlRowOffset,
        },
        editAs: image.range.editAs || 'oneCell',
      }

      if (image.range.ext) {
        newRange.ext = {
          width: image.range.ext.width,
          height: image.range.ext.height,
        }
      }

      if (image.range.br) {
        const brRowOffset = image.range.br.row - Math.floor(image.range.br.row)
        newRange.br = {
          col: image.range.br.col,
          row: targetRowNumber - 1 + brRowOffset,
        }
      }

      targetSheet.addImage(newImageId, newRange)
    } catch (err) {
      console.warn('复制图片失败，已跳过:', err)
    }
  }
}

/**
 * 合并多个 Excel（表头一致）并导出为新文件。
 * 会保留每行文本与图片，自动跳过空行与汇总行。
 */
export async function mergeExcelFiles() {
  if (!('showOpenFilePicker' in window) || !('showSaveFilePicker' in window)) {
    throw new Error('当前浏览器不支持文件选择/保存 API，请使用 Chrome 或 Edge 最新版本')
  }

  const sourceHandles = await window.showOpenFilePicker({
    multiple: true,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  if (!sourceHandles || sourceHandles.length === 0) {
    throw new Error('未选择文件')
  }
  if (sourceHandles.length < 2) {
    throw new Error('请至少选择 2 个 Excel 文件进行合并')
  }

  const sourceFiles = await Promise.all(sourceHandles.map(h => h.getFile()))
  const sourceBooks = []

  for (const file of sourceFiles) {
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) continue

    sourceBooks.push({
      workbook,
      sheet,
      fileName: file.name,
    })
  }

  if (sourceBooks.length === 0) {
    throw new Error('未读取到有效的工作表')
  }

  const maxColumnCount = sourceBooks.reduce(
    (max, item) => Math.max(max, item.sheet.columnCount || item.sheet.actualColumnCount || 0),
    0
  )

  const mergedHeaders = Array.from({ length: maxColumnCount }, (_, idx) => {
    const col = idx + 1
    for (const item of sourceBooks) {
      const text = cellToText(item.sheet.getRow(1).getCell(col))
      if (text) return text
    }
    return `列${col}`
  })

  const outputWorkbook = new ExcelJS.Workbook()
  const outputSheet = outputWorkbook.addWorksheet('笔记')
  const headerRow = outputSheet.addRow(mergedHeaders)
  headerRow.height = 28
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 12 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
  })

  for (let col = 1; col <= maxColumnCount; col++) {
    let width = 14
    for (const item of sourceBooks) {
      const w = item.sheet.getColumn(col)?.width
      if (typeof w === 'number' && w > width) width = w
    }
    outputSheet.getColumn(col).width = width
  }

  let mergedRowCount = 0

  for (const source of sourceBooks) {
    const sourceImagesByRow = new Map()
    for (const image of source.sheet.getImages()) {
      const sourceRowNumber = Math.floor(image.range.tl.row) + 1
      if (sourceRowNumber < 2) continue
      if (!sourceImagesByRow.has(sourceRowNumber)) sourceImagesByRow.set(sourceRowNumber, [])
      sourceImagesByRow.get(sourceRowNumber).push(image)
    }

    source.sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const values = []
      for (let col = 1; col <= maxColumnCount; col++) {
        values.push(cellToText(row.getCell(col)))
      }

      if (isSummaryRow(values)) return

      const targetRow = outputSheet.addRow(values)
      if (row.height) targetRow.height = row.height
      targetRow.eachCell((cell, colNumber) => {
        cell.alignment = colNumber === 6
          ? { wrapText: true, vertical: 'top' }
          : { vertical: 'middle', wrapText: true }
      })

      copyRowImages({
        sourceWorkbook: source.workbook,
        sourceImagesByRow,
        sourceRowNumber: rowNumber,
        targetWorkbook: outputWorkbook,
        targetSheet: outputSheet,
        targetRowNumber: targetRow.number,
      })

      mergedRowCount++
    })
  }

  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toTimeString().slice(0, 5).replace(':', '')
  const outputHandle = await window.showSaveFilePicker({
    suggestedName: `小红书笔记_合并_${date}_${time}.xlsx`,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  const outBuffer = await outputWorkbook.xlsx.writeBuffer()
  const writable = await outputHandle.createWritable()
  await writable.write(outBuffer)
  await writable.close()

  return {
    fileCount: sourceBooks.length,
    rowCount: mergedRowCount,
  }
}

