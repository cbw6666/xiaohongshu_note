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
 * 从 sheet XML 中提取单元格纯文本值
 */
function extractCellText(cellNode) {
  const vMatch = cellNode.match(/<v[^>]*>([\s\S]*?)<\/v>/)
  if (vMatch) return vMatch[1].trim()
  const tMatch = cellNode.match(/<t[^>]*>([\s\S]*?)<\/t>/)
  if (tMatch) return tMatch[1].trim()
  return ''
}

/**
 * 从 sheet XML 中提取某行所有单元格的文本内容
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
      const idx = parseInt(rawText, 10)
      texts.push(sharedStrings[idx] || '')
    } else {
      texts.push(rawText)
    }
  }
  return texts
}

/**
 * 解析 sharedStrings.xml
 */
function parseSharedStrings(xml) {
  if (!xml) return []
  const strings = []
  const siRegex = /<si>([\s\S]*?)<\/si>/g
  let siMatch
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1]
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
 * 替换 row XML 中的行号及单元格引用
 */
function setRowNumber(rowXml, newRowNum) {
  let result = rowXml.replace(/(<row\s[^>]*?r=")(\d+)(")/,
    (_, before, _oldNum, after) => `${before}${newRowNum}${after}`)

  result = result.replace(/(<c\s[^>]*?r=")([A-Z]+)(\d+)(")/g,
    (_, before, col, _oldNum, after) => `${before}${col}${newRowNum}${after}`)

  return result
}

/**
 * 解析 drawing XML 中的所有 anchor
 */
function parseAnchors(drawingXml) {
  const anchors = []
  const anchorRegex = /<xdr:(twoCellAnchor|oneCellAnchor)([\s\S]*?)<\/xdr:\1>/g
  let match
  while ((match = anchorRegex.exec(drawingXml)) !== null) {
    const anchorXml = match[0]
    const type = match[1]

    const fromRowMatch = anchorXml.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const fromRow = fromRowMatch ? parseInt(fromRowMatch[1], 10) : 0

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
 */
function remapAnchorRows(anchorXml, anchorType, rowMapping) {
  let result = anchorXml

  result = result.replace(
    /(<xdr:from>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/,
    (full, before, oldRow, after) => {
      const newRow = rowMapping.get(parseInt(oldRow, 10))
      return newRow !== undefined ? `${before}${newRow}${after}` : full
    }
  )

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
 * 偏移 anchor 中的行号（用于合并时追加）
 */
function offsetAnchorRows(anchorXml, anchorType, rowOffset) {
  let result = anchorXml

  result = result.replace(
    /(<xdr:from>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/,
    (_, before, oldRow, after) => `${before}${parseInt(oldRow, 10) + rowOffset}${after}`
  )

  if (anchorType === 'twoCellAnchor') {
    result = result.replace(
      /(<xdr:to>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/,
      (_, before, oldRow, after) => `${before}${parseInt(oldRow, 10) + rowOffset}${after}`
    )
  }

  return result
}

/**
 * 从 [Content_Types].xml 中解析已有的 media 类型
 */
function getMediaExtensions(contentTypesXml) {
  const extensions = new Set()
  const regex = /<Default\s+Extension="([^"]+)"\s+ContentType="image\//g
  let match
  while ((match = regex.exec(contentTypesXml)) !== null) {
    extensions.add(match[1].toLowerCase())
  }
  return extensions
}

/**
 * 从 rels 文件中提取 rId 到 target 的映射
 */
function parseRels(relsXml) {
  const rels = []
  const regex = /<Relationship\s+[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*?\/?>/g
  let match
  while ((match = regex.exec(relsXml)) !== null) {
    rels.push({ id: match[1], target: match[2] })
  }
  return rels
}

/**
 * 获取 rels 中最大的 rId 数字
 */
function getMaxRid(relsXml) {
  let maxId = 0
  const regex = /Id="rId(\d+)"/g
  let match
  while ((match = regex.exec(relsXml)) !== null) {
    const num = parseInt(match[1], 10)
    if (num > maxId) maxId = num
  }
  return maxId
}

/**
 * 合并多个 Excel 文件（使用 JSZip 直接操作底层 XML，图片不解码）
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

  if (!sourceHandles || sourceHandles.length === 0) throw new Error('未选择文件')
  if (sourceHandles.length < 2) throw new Error('请至少选择 2 个 Excel 文件进行合并')

  const sourceFiles = await Promise.all(sourceHandles.map(h => h.getFile()))

  // 以第一个文件为基底
  const baseBuffer = await sourceFiles[0].arrayBuffer()
  const baseZip = await JSZip.loadAsync(baseBuffer)

  // 读取基底的 sharedStrings
  const baseSsFile = baseZip.file('xl/sharedStrings.xml')
  const baseSharedStrings = baseSsFile ? parseSharedStrings(await baseSsFile.async('string')) : []

  // 读取基底的 sheet XML
  const baseSheetFile = baseZip.file('xl/worksheets/sheet1.xml')
  if (!baseSheetFile) throw new Error('第一个文件未找到 sheet1.xml')
  let baseSheetXml = await baseSheetFile.async('string')

  // 提取基底所有行
  const baseRowRegex = /<row\s[^>]*?r="\d+"[^>]*?>[\s\S]*?<\/row>/g
  const baseAllRows = []
  let baseRowMatch
  while ((baseRowMatch = baseRowRegex.exec(baseSheetXml)) !== null) {
    baseAllRows.push({ xml: baseRowMatch[0], rowNum: getRowNumber(baseRowMatch[0]) })
  }

  // 分离基底的表头、数据行、汇总行
  const baseHeaderRows = []
  const baseDataRows = []

  for (const row of baseAllRows) {
    if (row.rowNum === 1) {
      baseHeaderRows.push(row)
    } else {
      const texts = extractRowTexts(row.xml, baseSharedStrings)
      if (!isSummaryRow(texts)) {
        baseDataRows.push(row)
      }
    }
  }

  // 当前最大行号（基底数据行的最后一行）
  let currentMaxRow = baseDataRows.length > 0
    ? Math.max(...baseDataRows.map(r => r.rowNum))
    : 1

  // 读取基底的 drawing XML（如果有）
  let baseDrawingXml = ''
  const baseDrawingFile = baseZip.file('xl/drawings/drawing1.xml')
  if (baseDrawingFile) {
    baseDrawingXml = await baseDrawingFile.async('string')
  }

  // 读取基底的 drawing rels（图片引用关系）
  let baseDrawingRelsXml = ''
  const baseDrawingRelsFile = baseZip.file('xl/drawings/_rels/drawing1.xml.rels')
  if (baseDrawingRelsFile) {
    baseDrawingRelsXml = await baseDrawingRelsFile.async('string')
  }

  // 读取 [Content_Types].xml
  let contentTypesXml = ''
  const contentTypesFile = baseZip.file('[Content_Types].xml')
  if (contentTypesFile) {
    contentTypesXml = await contentTypesFile.async('string')
  }

  // 收集基底中已有的 media 文件列表
  let mediaFileCount = 0
  baseZip.folder('xl/media')?.forEach(() => { mediaFileCount++ })

  // 基底 drawing rels 中最大的 rId
  let maxRid = baseDrawingRelsXml ? getMaxRid(baseDrawingRelsXml) : 0

  // 已注册的图片扩展名
  const registeredExtensions = contentTypesXml ? getMediaExtensions(contentTypesXml) : new Set()

  let mergedRowCount = baseDataRows.length
  const appendedDataRows = []

  // 检测基底是否有 drawing（如果没有，需要在合并时创建）
  let needCreateDrawing = !baseDrawingFile
  // 存储基底 sheet rels 内容
  let baseSheetRelsXml = ''
  const baseSheetRelsFile = baseZip.file('xl/worksheets/_rels/sheet1.xml.rels')
  if (baseSheetRelsFile) {
    baseSheetRelsXml = await baseSheetRelsFile.async('string')
  }

  // 逐个处理后续文件
  for (let fileIdx = 1; fileIdx < sourceFiles.length; fileIdx++) {
    const file = sourceFiles[fileIdx]
    const buffer = await file.arrayBuffer()
    const srcZip = await JSZip.loadAsync(buffer)

    // 读取 sharedStrings
    const srcSsFile = srcZip.file('xl/sharedStrings.xml')
    const srcSharedStrings = srcSsFile ? parseSharedStrings(await srcSsFile.async('string')) : []

    // 读取 sheet XML
    const srcSheetFile = srcZip.file('xl/worksheets/sheet1.xml')
    if (!srcSheetFile) continue
    const srcSheetXml = await srcSheetFile.async('string')

    // 提取数据行（跳过表头和汇总行）
    const srcRowRegex = /<row\s[^>]*?r="\d+"[^>]*?>[\s\S]*?<\/row>/g
    let srcRowMatch
    const srcDataRows = []
    while ((srcRowMatch = srcRowRegex.exec(srcSheetXml)) !== null) {
      const rowXml = srcRowMatch[0]
      const rowNum = getRowNumber(rowXml)
      if (rowNum === 1) continue
      const texts = extractRowTexts(rowXml, srcSharedStrings)
      if (isSummaryRow(texts)) continue
      srcDataRows.push({ xml: rowXml, rowNum })
    }

    if (srcDataRows.length === 0) continue

    // 行号偏移量：源文件的第一个数据行号 → 追加到基底后的行号
    const srcMinRow = Math.min(...srcDataRows.map(r => r.rowNum))
    const rowOffset = currentMaxRow - srcMinRow + 1

    // 给源数据行重新编号并追加
    for (const srcRow of srcDataRows) {
      const newRowNum = srcRow.rowNum + rowOffset
      appendedDataRows.push({
        xml: setRowNumber(srcRow.xml, newRowNum),
        rowNum: newRowNum,
      })
      mergedRowCount++
    }

    // 处理图片：将源文件的 media 文件复制到基底，重映射引用
    const srcDrawingFile = srcZip.file('xl/drawings/drawing1.xml')
    const srcDrawingRelsFile = srcZip.file('xl/drawings/_rels/drawing1.xml.rels')

    if (srcDrawingFile && srcDrawingRelsFile) {
      const srcDrawingXml = await srcDrawingFile.async('string')
      const srcDrawingRelsXml = await srcDrawingRelsFile.async('string')
      const srcRels = parseRels(srcDrawingRelsXml)

      // 建立源文件 rId → 新 rId 的映射
      const ridMapping = new Map()

      for (const rel of srcRels) {
        if (!rel.target.includes('../media/')) continue

        // 获取源文件的图片二进制（不解码，只是从 zip 中提取）
        const srcMediaPath = 'xl/drawings/' + rel.target
        const normalizedPath = srcMediaPath.replace(/\/\.\.\//g, '/').replace('xl/drawings/../media/', 'xl/media/')
        const srcMediaFile = srcZip.file(normalizedPath)
        if (!srcMediaFile) continue

        // 分配新文件名
        mediaFileCount++
        const ext = normalizedPath.split('.').pop() || 'png'
        const newMediaName = `image${mediaFileCount}.${ext}`
        const newMediaPath = `xl/media/${newMediaName}`

        // 复制图片二进制数据（不解压图片内容，只是在 zip 间移动）
        const mediaData = await srcMediaFile.async('uint8array')
        baseZip.file(newMediaPath, mediaData)

        // 注册新的 rId
        maxRid++
        const newRid = `rId${maxRid}`
        ridMapping.set(rel.id, newRid)

        // 如果基底没有 drawing，需要创建
        if (needCreateDrawing) {
          // 创建空的 drawing
          const defaultNs = 'xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
          baseDrawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr ${defaultNs}></xdr:wsDr>`
          baseDrawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`

          // 在 sheet rels 中添加 drawing 引用
          if (!baseSheetRelsXml) {
            baseSheetRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
          }
          const drawingRid = `rId${getMaxRid(baseSheetRelsXml) + 1}`
          baseSheetRelsXml = baseSheetRelsXml.replace(
            '</Relationships>',
            `<Relationship Id="${drawingRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
          )
          baseZip.file('xl/worksheets/_rels/sheet1.xml.rels', baseSheetRelsXml)

          // 在 sheet XML 中添加 drawing 引用（如果没有）
          if (!baseSheetXml.includes('<drawing')) {
            baseSheetXml = baseSheetXml.replace('</worksheet>', `<drawing r:id="${drawingRid}"/></worksheet>`)
          }

          // 在 [Content_Types].xml 中添加 drawing 类型
          if (contentTypesXml && !contentTypesXml.includes('drawing1.xml')) {
            contentTypesXml = contentTypesXml.replace(
              '</Types>',
              `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
            )
          }

          needCreateDrawing = false
        }

        // 添加到 drawing rels
        baseDrawingRelsXml = baseDrawingRelsXml.replace(
          '</Relationships>',
          `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${newMediaName}"/></Relationships>`
        )

        // 注册图片扩展名到 [Content_Types].xml
        if (!registeredExtensions.has(ext.toLowerCase())) {
          registeredExtensions.add(ext.toLowerCase())
          if (contentTypesXml) {
            const mimeType = ext.toLowerCase() === 'png' ? 'image/png'
              : ext.toLowerCase() === 'jpeg' || ext.toLowerCase() === 'jpg' ? 'image/jpeg'
              : ext.toLowerCase() === 'gif' ? 'image/gif'
              : ext.toLowerCase() === 'webp' ? 'image/webp'
              : `image/${ext.toLowerCase()}`
            contentTypesXml = contentTypesXml.replace(
              '</Types>',
              `<Default Extension="${ext}" ContentType="${mimeType}"/></Types>`
            )
          }
        }
      }

      // 处理 drawing anchors：偏移行号 + 重映射 rId
      const srcAnchors = parseAnchors(srcDrawingXml)
      for (const anchor of srcAnchors) {
        // 偏移行号
        let newAnchorXml = offsetAnchorRows(anchor.xml, anchor.type, rowOffset)

        // 替换 rId 引用
        for (const [oldRid, newRid] of ridMapping) {
          newAnchorXml = newAnchorXml.replace(
            new RegExp(`r:embed="${oldRid}"`, 'g'),
            `r:embed="${newRid}"`
          )
          newAnchorXml = newAnchorXml.replace(
            new RegExp(`r:link="${oldRid}"`, 'g'),
            `r:link="${newRid}"`
          )
        }

        // 追加到基底 drawing
        baseDrawingXml = baseDrawingXml.replace('</xdr:wsDr>', `${newAnchorXml}</xdr:wsDr>`)
      }
    }

    // 更新当前最大行号
    const allAppendedNums = appendedDataRows.map(r => r.rowNum)
    if (allAppendedNums.length > 0) {
      currentMaxRow = Math.max(currentMaxRow, ...allAppendedNums)
    }
  }

  // 组装最终的 sheet XML
  // 将追加的行加入到 <sheetData> 的末尾（</sheetData> 之前）
  if (appendedDataRows.length > 0) {
    const appendedRowsXml = appendedDataRows.map(r => r.xml).join('')

    // 移除基底中的汇总行（如果有），追加新数据行后再加回去
    // 先从当前 sheetData 中提取所有行，过滤汇总行
    const currentRowRegex = /<row\s[^>]*?r="\d+"[^>]*?>[\s\S]*?<\/row>/g
    const currentRows = []
    let crMatch
    while ((crMatch = currentRowRegex.exec(baseSheetXml)) !== null) {
      currentRows.push({ xml: crMatch[0], rowNum: getRowNumber(crMatch[0]) })
    }

    // 分离当前行中的汇总行
    const keepRows = []
    const summaryRowsToReappend = []
    for (const row of currentRows) {
      if (row.rowNum === 1) {
        keepRows.push(row)
      } else {
        const texts = extractRowTexts(row.xml, baseSharedStrings)
        if (isSummaryRow(texts)) {
          summaryRowsToReappend.push(row)
        } else {
          keepRows.push(row)
        }
      }
    }

    // 重新组装：保留行 + 追加行 + 汇总行
    const allFinalRows = [...keepRows, ...appendedDataRows]

    // 汇总行放到最后，行号设置为最大行号+1
    let summaryStartRow = currentMaxRow + 1
    for (const sr of summaryRowsToReappend) {
      allFinalRows.push({
        xml: setRowNumber(sr.xml, summaryStartRow),
        rowNum: summaryStartRow,
      })
      summaryStartRow++
    }

    allFinalRows.sort((a, b) => a.rowNum - b.rowNum)
    const newSheetData = '<sheetData>' + allFinalRows.map(r => r.xml).join('') + '</sheetData>'
    baseSheetXml = baseSheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData)
  }

  // 写回修改后的内容
  baseZip.file('xl/worksheets/sheet1.xml', baseSheetXml)
  if (baseDrawingXml && baseDrawingFile) {
    baseZip.file('xl/drawings/drawing1.xml', baseDrawingXml)
  } else if (baseDrawingXml && !needCreateDrawing) {
    baseZip.file('xl/drawings/drawing1.xml', baseDrawingXml)
  }
  if (baseDrawingRelsXml) {
    baseZip.file('xl/drawings/_rels/drawing1.xml.rels', baseDrawingRelsXml)
  }
  if (contentTypesXml) {
    baseZip.file('[Content_Types].xml', contentTypesXml)
  }

  // 弹出保存对话框
  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toTimeString().slice(0, 5).replace(':', '')
  const outputHandle = await window.showSaveFilePicker({
    suggestedName: `小红书笔记_合并_${date}_${time}.xlsx`,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  const outBlob = await baseZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const writable = await outputHandle.createWritable()
  await writable.write(outBlob)
  await writable.close()

  return {
    fileCount: sourceFiles.length,
    rowCount: mergedRowCount,
  }
}
