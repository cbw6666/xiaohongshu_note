import ExcelJS from 'exceljs'

function cellToText(cell) {
  if (!cell) return ''
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }
  if (value?.text) return String(value.text).trim()
  if (value?.result != null) return String(value.result).trim()
  if (value?.hyperlink) return String(value.text || value.hyperlink).trim()
  if (Array.isArray(value?.richText)) {
    return value.richText.map(t => t?.text || '').join('').trim()
  }
  return String(value).trim()
}

function cellToOutputValue(cell) {
  if (!cell) return ''
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value?.text) return value.text
  if (value?.result != null) return value.result
  if (value?.hyperlink) return value.text || value.hyperlink
  if (Array.isArray(value?.richText)) {
    return value.richText.map(t => t?.text || '').join('')
  }
  return String(value)
}

function isSummaryRow(texts) {
  const text = texts.filter(Boolean).join(' ')
  if (!text) return true
  return /采集完成\s*\|\s*总计|总计:\s*\d+\s*\|\s*成功:\s*\d+\s*\|\s*失败:\s*\d+/.test(text)
}

function buildImageRowMap(worksheet) {
  const map = new Map()
  for (const img of worksheet.getImages()) {
    const sourceRow = Math.floor(img.range.tl.row) + 1 // excel row number
    if (!map.has(sourceRow)) map.set(sourceRow, [])
    map.get(sourceRow).push(img)
  }
  return map
}

function copyRowImages({
  sourceWorkbook,
  sourceRowImages,
  sourceRowNumber,
  targetWorkbook,
  targetSheet,
  targetRowNumber,
}) {
  const images = sourceRowImages.get(sourceRowNumber) || []
  for (const img of images) {
    const sourceMedia = sourceWorkbook.getImage(img.imageId)
    if (!sourceMedia?.buffer || !sourceMedia?.extension) continue

    const newImageId = targetWorkbook.addImage({
      buffer: sourceMedia.buffer,
      extension: sourceMedia.extension,
    })

    const srcTlRow = img.range.tl.row
    const rowDelta = (targetRowNumber - 1) - Math.floor(srcTlRow)
    const newRange = {
      tl: {
        col: img.range.tl.col,
        row: srcTlRow + rowDelta,
      },
      editAs: img.range.editAs || 'oneCell',
    }

    if (img.range.ext) {
      newRange.ext = { width: img.range.ext.width, height: img.range.ext.height }
    }

    if (img.range.br) {
      newRange.br = {
        col: img.range.br.col,
        row: img.range.br.row + rowDelta,
      }
    }

    targetSheet.addImage(newImageId, newRange)
  }
}

/**
 * 合并多个 Excel 文件（优先保证“行内容 + 图片锚点”一致性）
 */
export async function mergeExcelFiles() {
  if (!('showOpenFilePicker' in window) || !('showSaveFilePicker' in window)) {
    throw new Error('当前浏览器不支持文件选择/保存 API，请使用 Chrome 或 Edge 最新版本')
  }

  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toTimeString().slice(0, 5).replace(':', '')

  // 必须在用户手势上下文中尽早触发，避免后续异步处理导致被浏览器拦截
  const outputHandle = await window.showSaveFilePicker({
    suggestedName: `小红书笔记_合并_${date}_${time}.xlsx`,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  const sourceHandles = await window.showOpenFilePicker({
    multiple: true,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  if (!sourceHandles || sourceHandles.length === 0) throw new Error('未选择文件')
  if (sourceHandles.length < 2) throw new Error('请至少选择 2 个 Excel 文件进行合并')

  const sourceFiles = await Promise.all(sourceHandles.map(h => h.getFile()))

  const outputWorkbook = new ExcelJS.Workbook()
  const outputSheet = outputWorkbook.addWorksheet('笔记')

  let initialized = false
  let maxColCount = 0
  let mergedRowCount = 0

  for (const file of sourceFiles) {
    const sourceBuffer = await file.arrayBuffer()
    const sourceWorkbook = new ExcelJS.Workbook()
    await sourceWorkbook.xlsx.load(sourceBuffer)
    const sourceSheet = sourceWorkbook.worksheets[0]
    if (!sourceSheet) continue

    const sourceColCount = sourceSheet.columnCount || sourceSheet.actualColumnCount || 0
    maxColCount = Math.max(maxColCount, sourceColCount)

    if (!initialized) {
      const headers = []
      for (let col = 1; col <= sourceColCount; col++) {
        headers.push(cellToText(sourceSheet.getRow(1).getCell(col)) || `列${col}`)
      }
      const headerRow = outputSheet.addRow(headers)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
      })

      for (let col = 1; col <= sourceColCount; col++) {
        const w = sourceSheet.getColumn(col)?.width
        outputSheet.getColumn(col).width = typeof w === 'number' ? w : 14
      }
      initialized = true
    } else {
      for (let col = 1; col <= sourceColCount; col++) {
        const w = sourceSheet.getColumn(col)?.width
        if (typeof w === 'number') {
          const prev = outputSheet.getColumn(col).width || 10
          outputSheet.getColumn(col).width = Math.max(prev, w)
        }
      }
    }

    const sourceRowImages = buildImageRowMap(sourceSheet)

    sourceSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const rowTexts = []
      const rowValues = []
      for (let col = 1; col <= maxColCount; col++) {
        const cell = row.getCell(col)
        rowTexts.push(cellToText(cell))
        rowValues.push(cellToOutputValue(cell))
      }

      const hasImage = sourceRowImages.has(rowNumber)
      if (isSummaryRow(rowTexts) && !hasImage) return

      const targetRow = outputSheet.addRow(rowValues)
      if (row.height) targetRow.height = row.height
      if (!row.height && hasImage) targetRow.height = 140

      targetRow.eachCell((cell, colNumber) => {
        if (colNumber === 6) {
          cell.alignment = { wrapText: true, vertical: 'top' }
        } else {
          cell.alignment = { vertical: 'middle', wrapText: true }
        }
      })

      copyRowImages({
        sourceWorkbook,
        sourceRowImages,
        sourceRowNumber: rowNumber,
        targetWorkbook: outputWorkbook,
        targetSheet: outputSheet,
        targetRowNumber: targetRow.number,
      })

      mergedRowCount++
    })
  }

  if (!initialized) throw new Error('未读取到可合并的工作表')

  const outBuffer = await outputWorkbook.xlsx.writeBuffer()
  const writable = await outputHandle.createWritable()
  await writable.write(outBuffer)
  await writable.close()

  return {
    fileCount: sourceFiles.length,
    rowCount: mergedRowCount,
  }
}
