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

function shuffleArray(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
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

export async function shuffleExcelRows() {
  if (!('showOpenFilePicker' in window) || !('showSaveFilePicker' in window)) {
    throw new Error('当前浏览器不支持文件选择/保存 API，请使用 Chrome 或 Edge 最新版本')
  }

  const [sourceHandle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })
  if (!sourceHandle) {
    throw new Error('未选择文件')
  }

  const sourceFile = await sourceHandle.getFile()
  const sourceBuffer = await sourceFile.arrayBuffer()
  const sourceWorkbook = new ExcelJS.Workbook()
  await sourceWorkbook.xlsx.load(sourceBuffer)
  const sourceSheet = sourceWorkbook.worksheets[0]
  if (!sourceSheet) {
    throw new Error('未读取到有效工作表')
  }

  const colCount = sourceSheet.columnCount || sourceSheet.actualColumnCount || 0
  if (colCount === 0) {
    throw new Error('表格没有可用列')
  }

  const headers = Array.from({ length: colCount }, (_, idx) => cellToText(sourceSheet.getRow(1).getCell(idx + 1)) || `列${idx + 1}`)
  const rows = []

  sourceSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = []
    for (let col = 1; col <= colCount; col++) {
      values.push(cellToText(row.getCell(col)))
    }
    if (isSummaryRow(values)) return
    rows.push({ rowNumber, values, height: row.height })
  })

  if (rows.length < 2) {
    throw new Error('可打乱的数据行少于 2 行')
  }

  const sourceImagesByRow = new Map()
  for (const image of sourceSheet.getImages()) {
    const sourceRowNumber = Math.floor(image.range.tl.row) + 1
    if (sourceRowNumber < 2) continue
    if (!sourceImagesByRow.has(sourceRowNumber)) sourceImagesByRow.set(sourceRowNumber, [])
    sourceImagesByRow.get(sourceRowNumber).push(image)
  }

  const shuffledRows = shuffleArray(rows)

  const outputWorkbook = new ExcelJS.Workbook()
  const outputSheet = outputWorkbook.addWorksheet(sourceSheet.name || '笔记')

  const headerRow = outputSheet.addRow(headers)
  headerRow.height = 28
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 12 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
  })

  for (let col = 1; col <= colCount; col++) {
    const width = sourceSheet.getColumn(col)?.width
    outputSheet.getColumn(col).width = typeof width === 'number' ? width : 14
  }

  for (const item of shuffledRows) {
    const targetRow = outputSheet.addRow(item.values)
    if (item.height) targetRow.height = item.height
    targetRow.eachCell((cell, colNumber) => {
      cell.alignment = colNumber === 6
        ? { wrapText: true, vertical: 'top' }
        : { vertical: 'middle', wrapText: true }
    })

    copyRowImages({
      sourceWorkbook,
      sourceImagesByRow,
      sourceRowNumber: item.rowNumber,
      targetWorkbook: outputWorkbook,
      targetSheet: outputSheet,
      targetRowNumber: targetRow.number,
    })
  }

  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toTimeString().slice(0, 5).replace(':', '')
  const outputHandle = await window.showSaveFilePicker({
    suggestedName: `小红书笔记_打乱_${date}_${time}.xlsx`,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  const outBuffer = await outputWorkbook.xlsx.writeBuffer()
  const writable = await outputHandle.createWritable()
  await writable.write(outBuffer)
  await writable.close()

  return { rowCount: shuffledRows.length, fileName: sourceFile.name }
}

