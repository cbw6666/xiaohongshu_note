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
    const sourceRow = Math.floor(img.range.tl.row) + 1
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
 * 分割 Excel 文件
 * @param {Object} options
 * @param {'byParts'|'byCount'} options.mode - 分割模式：按份数 / 按每份条数
 * @param {number} options.value - 份数 或 每份条数
 * @returns {Promise<{totalRows: number, fileCount: number, rowsPerFile: number[]}>}
 */
export async function splitExcelFile({ mode, value }) {
  if (!('showOpenFilePicker' in window) || !('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持文件选择 API，请使用 Chrome 或 Edge 最新版本')
  }

  // 1. 先让用户选择源文件（在用户手势上下文中）
  const [sourceHandle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  // 2. 让用户选择输出目录
  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })

  // 3. 读取源文件
  const sourceFile = await sourceHandle.getFile()
  const sourceBuffer = await sourceFile.arrayBuffer()
  const sourceWorkbook = new ExcelJS.Workbook()
  await sourceWorkbook.xlsx.load(sourceBuffer)
  const sourceSheet = sourceWorkbook.worksheets[0]
  if (!sourceSheet) throw new Error('未找到工作表')

  const sourceColCount = sourceSheet.columnCount || sourceSheet.actualColumnCount || 0
  const sourceRowImages = buildImageRowMap(sourceSheet)

  // 4. 提取数据行（跳过表头和汇总行）
  const dataRows = []
  sourceSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const rowTexts = []
    for (let col = 1; col <= sourceColCount; col++) {
      rowTexts.push(cellToText(row.getCell(col)))
    }

    const hasImage = sourceRowImages.has(rowNumber)
    if (isSummaryRow(rowTexts) && !hasImage) return

    dataRows.push({ rowNumber, row })
  })

  if (dataRows.length === 0) throw new Error('Excel 中没有数据行')

  // 5. 计算分片策略
  let chunks = []
  if (mode === 'byParts') {
    const parts = Math.min(value, dataRows.length)
    const base = Math.floor(dataRows.length / parts)
    const remainder = dataRows.length % parts
    let offset = 0
    for (let i = 0; i < parts; i++) {
      const size = base + (i < remainder ? 1 : 0)
      chunks.push(dataRows.slice(offset, offset + size))
      offset += size
    }
  } else {
    // byCount
    for (let i = 0; i < dataRows.length; i += value) {
      chunks.push(dataRows.slice(i, i + value))
    }
  }

  // 6. 提取表头信息（只做一次）
  const headers = []
  for (let col = 1; col <= sourceColCount; col++) {
    headers.push(cellToText(sourceSheet.getRow(1).getCell(col)) || `列${col}`)
  }

  const columnWidths = []
  for (let col = 1; col <= sourceColCount; col++) {
    const w = sourceSheet.getColumn(col)?.width
    columnWidths.push(typeof w === 'number' ? w : 14)
  }

  // 7. 生成基础文件名
  const baseName = sourceFile.name.replace(/\.xlsx$/i, '')

  // 8. 逐个分片写入文件
  const rowsPerFile = []

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]
    const outputWorkbook = new ExcelJS.Workbook()
    const outputSheet = outputWorkbook.addWorksheet('笔记')

    // 写入表头
    const headerRow = outputSheet.addRow(headers)
    headerRow.height = 28
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
    })

    // 设置列宽
    for (let col = 1; col <= sourceColCount; col++) {
      outputSheet.getColumn(col).width = columnWidths[col - 1]
    }

    // 写入数据行 + 图片
    for (const { rowNumber, row } of chunk) {
      const rowValues = []
      for (let col = 1; col <= sourceColCount; col++) {
        rowValues.push(cellToOutputValue(row.getCell(col)))
      }

      const targetRow = outputSheet.addRow(rowValues)
      if (row.height) targetRow.height = row.height
      if (!row.height && sourceRowImages.has(rowNumber)) targetRow.height = 140

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
    }

    // 保存文件
    const fileName = `${baseName}_分割_${idx + 1}of${chunks.length}.xlsx`
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    const buffer = await outputWorkbook.xlsx.writeBuffer()
    await writable.write(buffer)
    await writable.close()

    rowsPerFile.push(chunk.length)
  }

  return {
    totalRows: dataRows.length,
    fileCount: chunks.length,
    rowsPerFile,
  }
}
