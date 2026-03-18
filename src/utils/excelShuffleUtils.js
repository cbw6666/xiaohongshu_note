import JSZip from 'jszip'

/**
 * 判断是否为汇总行
 */
function isSummaryRow(texts) {
  const text = texts.filter(Boolean).join(' ')
  if (!text) return true
  return /采集完成\s*\|\s*总计|总计:\s*\d+\s*\|\s*成功:\s*\d+\s*\|\s*失败:\s*\d+/.test(text)
}

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 从 sheet XML 中提取单元格纯文本值
 */
function extractCellText(cellNode) {
  // <c> 节点的 <v> 或 <is><t> 子节点
  const vMatch = cellNode.match(/<v[^>]*>([\s\S]*?)<\/v>/)
  if (vMatch) return vMatch[1].trim()
  const tMatch = cellNode.match(/<t[^>]*>([\s\S]*?)<\/t>/)
  if (tMatch) return tMatch[1].trim()
  return ''
}

/**
 * 从 sheet XML 中提取某行所有单元格的文本内容（用于判断汇总行）
 */
function extractRowTexts(rowXml, sharedStrings) {
  const texts = []
  const cellRegex = /<c\s[^>]*?>([\s\S]*?)<\/c>/g
  let cellMatch
  while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
    const fullCell = cellMatch[0]
    const tAttr = fullCell.match(/\bt="([^"]*)"/)
    const cellType = tAttr ? tAttr[1] : ''
    const rawText = extractCellText(fullCell)

    if (cellType === 's' && sharedStrings && rawText) {
      // shared string 索引
      const idx = parseInt(rawText, 10)
      texts.push(sharedStrings[idx] || '')
    } else {
      texts.push(rawText)
    }
  }
  return texts
}

/**
 * 解析 sharedStrings.xml，返回字符串数组
 */
function parseSharedStrings(xml) {
  if (!xml) return []
  const strings = []
  const siRegex = /<si>([\s\S]*?)<\/si>/g
  let siMatch
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1]
    // 可能是 <t>text</t> 或 <r><t>text</t></r> 多段富文本
    const parts = []
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g
    let tMatch
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      parts.push(tMatch[1])
    }
    strings.push(parts.join(''))
  }
  return strings
}

/**
 * 从 row XML 中提取行号
 */
function getRowNumber(rowXml) {
  const match = rowXml.match(/<row\s[^>]*?r="(\d+)"/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * 替换 row XML 中的行号，同时更新所有单元格引用（如 A2 → A5）
 */
function setRowNumber(rowXml, newRowNum) {
  // 替换 <row r="X"> 中的行号
  let result = rowXml.replace(/(<row\s[^>]*?r=")(\d+)(")/,
    (_, before, _oldNum, after) => `${before}${newRowNum}${after}`)

  // 替换所有单元格引用 r="A2" → r="A5"
  result = result.replace(/(<c\s[^>]*?r=")([A-Z]+)(\d+)(")/g,
    (_, before, col, _oldNum, after) => `${before}${col}${newRowNum}${after}`)

  return result
}

/**
 * 解析 drawing XML 中的所有 anchor（twoCellAnchor / oneCellAnchor）
 * 返回 anchor 信息数组，每个包含原始 XML、关联的行号范围
 */
function parseAnchors(drawingXml) {
  const anchors = []
  // 匹配 twoCellAnchor 和 oneCellAnchor
  const anchorRegex = /<xdr:(twoCellAnchor|oneCellAnchor)([\s\S]*?)<\/xdr:\1>/g
  let match
  while ((match = anchorRegex.exec(drawingXml)) !== null) {
    const anchorXml = match[0]
    const type = match[1]

    // 提取 <xdr:from><xdr:row>X</xdr:row>
    const fromRowMatch = anchorXml.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const fromRow = fromRowMatch ? parseInt(fromRowMatch[1], 10) : 0

    // 对于 twoCellAnchor，还有 <xdr:to><xdr:row>
    let toRow = fromRow
    if (type === 'twoCellAnchor') {
      const toRowMatch = anchorXml.match(/<xdr:to>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
      toRow = toRowMatch ? parseInt(toRowMatch[1], 10) : fromRow
    }

    anchors.push({ xml: anchorXml, type, fromRow, toRow })
  }
  return anchors
}

/**
 * 修改 anchor XML 中的行号
 * rowMapping: Map<oldRow, newRow>
 */
function remapAnchorRows(anchorXml, anchorType, rowMapping) {
  let result = anchorXml

  // 修改 <xdr:from> 中的 <xdr:row>
  result = result.replace(
    /(<xdr:from>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/,
    (full, before, oldRow, after) => {
      const newRow = rowMapping.get(parseInt(oldRow, 10))
      return newRow !== undefined ? `${before}${newRow}${after}` : full
    }
  )

  // 修改 <xdr:to> 中的 <xdr:row>（twoCellAnchor）
  if (anchorType === 'twoCellAnchor') {
    result = result.replace(
      /(<xdr:to>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/,
      (full, before, oldRow, after) => {
        const newRow = rowMapping.get(parseInt(oldRow, 10))
        return newRow !== undefined ? `${before}${newRow}${after}` : full
      }
    )
  }

  return result
}

/**
 * 打乱 Excel 文件行顺序（使用 JSZip 直接操作底层 XML，图片不解码）
 */
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
  if (!sourceHandle) throw new Error('未选择文件')

  const sourceFile = await sourceHandle.getFile()
  const sourceBuffer = await sourceFile.arrayBuffer()

  // 用 JSZip 加载（图片等二进制文件不会被解码到内存，lazy 模式）
  const zip = await JSZip.loadAsync(sourceBuffer)

  // 释放源 buffer，让 GC 回收
  // sourceBuffer 已被 JSZip 使用，这里置 null 不影响 zip 对象
  // （JSZip 内部已持有引用，但提前置 null 可以让引擎知道外部不再需要）

  // 读取 sharedStrings.xml（用于解析单元格文本）
  const ssFile = zip.file('xl/sharedStrings.xml')
  const sharedStrings = ssFile ? parseSharedStrings(await ssFile.async('string')) : []

  // 读取 sheet XML
  const sheetFile = zip.file('xl/worksheets/sheet1.xml')
  if (!sheetFile) throw new Error('未找到 sheet1.xml，文件格式可能不支持')
  const sheetXml = await sheetFile.async('string')

  // 提取所有 <row> 节点
  const rowRegex = /<row\s[^>]*?r="\d+"[^>]*?>[\s\S]*?<\/row>/g
  const allRows = []
  let rowMatch
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    allRows.push({ xml: rowMatch[0], rowNum: getRowNumber(rowMatch[0]) })
  }

  if (allRows.length === 0) throw new Error('未读取到有效数据行')

  // 分离表头行、数据行、汇总行
  const headerRows = []
  const dataRows = []
  const summaryRows = []

  for (const row of allRows) {
    if (row.rowNum === 1) {
      headerRows.push(row)
    } else {
      const texts = extractRowTexts(row.xml, sharedStrings)
      if (isSummaryRow(texts)) {
        summaryRows.push(row)
      } else {
        dataRows.push(row)
      }
    }
  }

  if (dataRows.length < 2) throw new Error('可打乱的数据行少于 2 行')

  // 记录数据行原始行号顺序
  const originalRowNums = dataRows.map(r => r.rowNum)

  // 打乱数据行
  const shuffledDataRows = shuffleArray(dataRows)

  // 建立行号映射：原行号 → 新行号
  // 打乱后的数据行依次使用原来的行号位置
  const rowMapping = new Map()
  for (let i = 0; i < shuffledDataRows.length; i++) {
    const oldRowNum = shuffledDataRows[i].rowNum
    const newRowNum = originalRowNums[i]
    if (oldRowNum !== newRowNum) {
      rowMapping.set(oldRowNum, newRowNum)
    }
  }

  // 给打乱后的数据行设置新行号
  const newDataRows = shuffledDataRows.map((row, i) => {
    const newRowNum = originalRowNums[i]
    return { xml: setRowNumber(row.xml, newRowNum), rowNum: newRowNum }
  })

  // 重新组装所有行（表头 + 打乱后数据 + 汇总行），按行号排序
  const allNewRows = [...headerRows, ...newDataRows, ...summaryRows]
  allNewRows.sort((a, b) => a.rowNum - b.rowNum)

  // 重新组装 sheet XML
  // 替换 <sheetData> 部分
  const newSheetData = '<sheetData>' + allNewRows.map(r => r.xml).join('') + '</sheetData>'
  const newSheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData)

  zip.file('xl/worksheets/sheet1.xml', newSheetXml)

  // 处理 drawing（图片锚点）
  if (rowMapping.size > 0) {
    // 查找 drawing 文件（通常是 xl/drawings/drawing1.xml）
    const drawingFiles = []
    zip.folder('xl/drawings')?.forEach((relativePath, file) => {
      if (relativePath.endsWith('.xml')) {
        drawingFiles.push(file)
      }
    })

    // 构建完整的行号映射（包含双向映射）
    // 因为是"交换"操作，需要确保映射正确
    // rowMapping 已经是 oldRow → newRow 的映射

    // 也需要映射基于 0-based 的 drawing 行号
    // drawing 中的行号是 0-based（row 0 = Excel第1行）
    const drawingRowMapping = new Map()
    for (const [oldRow, newRow] of rowMapping) {
      // Excel 行号(1-based) → drawing 行号(0-based)
      drawingRowMapping.set(oldRow - 1, newRow - 1)
    }

    for (const drawingFile of drawingFiles) {
      let drawingXml = await drawingFile.async('string')
      const anchors = parseAnchors(drawingXml)

      for (const anchor of anchors) {
        const newAnchorXml = remapAnchorRows(anchor.xml, anchor.type, drawingRowMapping)
        if (newAnchorXml !== anchor.xml) {
          drawingXml = drawingXml.replace(anchor.xml, newAnchorXml)
        }
      }

      zip.file(drawingFile.name, drawingXml)
    }
  }

  // 弹出保存对话框
  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toTimeString().slice(0, 5).replace(':', '')
  const outputHandle = await window.showSaveFilePicker({
    suggestedName: `小红书笔记_打乱_${date}_${time}.xlsx`,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  // 生成输出文件
  const outBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const writable = await outputHandle.createWritable()
  await writable.write(outBlob)
  await writable.close()

  return { rowCount: dataRows.length, fileName: sourceFile.name }
}
