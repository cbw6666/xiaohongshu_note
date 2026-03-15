/**
 * 流式 Excel 导出工具
 * 使用 File System Access API (showSaveFilePicker) 实现增量写入
 * 每处理完一条笔记就立即写入并保存，即使中途关闭浏览器已写入的数据也不会丢失
 * 支持嵌入笔记封面和内页图片（内页图列数根据实际图片数量动态扩展）
 */
import ExcelJS from 'exceljs'

// 清理商品名称中混入的商品ID、"预览"等多余信息
function cleanProductName(name) {
  if (!name) return ''
  return name
    .replace(/\n?\s*商品\s*ID\s*[:：]\s*[\s\S]*/i, '')
    .replace(/\n?\s*预览\s*$/, '')
    .trim()
}

/**
 * 从 base64 data URL 中提取纯 base64 和扩展名
 * @param {string} dataUrl - data:image/png;base64,xxxxx
 * @returns {{ base64: string, extension: string } | null}
 */
function parseBase64DataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return null
  return {
    extension: match[1] === 'jpg' ? 'jpeg' : match[1], // ExcelJS 需要 jpeg 而非 jpg
    base64: match[2],
  }
}

// 图片列的固定宽度和行高（与 exportUtils.js 对齐）
const IMAGE_COL_WIDTH = 22       // Excel 列宽单位
const IMAGE_ROW_HEIGHT = 140     // 有图片行的行高（187 * 0.75 ≈ 140）
const NORMAL_ROW_HEIGHT = 22

/**
 * 创建流式 Excel 写入器
 * 内页图列数不再固定，而是根据每条笔记的实际图片数量动态扩展
 */
export async function createStreamWriter() {
  // 检测浏览器是否支持 File System Access API
  if (!('showSaveFilePicker' in window)) {
    throw new Error('您的浏览器不支持 showSaveFilePicker API，请使用 Chrome 86+ 或 Edge 86+ 浏览器')
  }

  const date = new Date().toISOString().slice(0, 10)
  const time = new Date().toTimeString().slice(0, 5).replace(':', '')

  // 弹出系统"另存为"对话框
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `小红书笔记_${date}_${time}.xlsx`,
    types: [{
      description: 'Excel 文件',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    }],
  })

  // 创建 ExcelJS 工作簿
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('笔记')

  // 基础列（与 exportUtils.js 对齐，无序号列）
  const baseHeaders = ['店铺', '账号', '商品名称', '商品ID', '笔记标题', '正文', '标签']
  const baseColWidths = [
    { width: 14 },  // 店铺
    { width: 14 },  // 账号
    { width: 20 },  // 商品名称
    { width: 14 },  // 商品ID
    { width: 28 },  // 笔记标题
    { width: 50 },  // 正文
    { width: 24 },  // 标签
  ]
  const baseColCount = baseHeaders.length // 7

  // 初始表头 = 基础列 + 笔记封面（暂不加内页图列，后续动态扩展）
  const headers = [...baseHeaders, '笔记封面']
  const headerRow = sheet.addRow(headers)

  // 表头样式（与 exportUtils.js 对齐：浅灰背景 + 黑色文字）
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    }
  })

  // 设置列宽：基础列 + 笔记封面
  sheet.columns = [...baseColWidths, { width: IMAGE_COL_WIDTH }]

  // 当前已有的内页图列数（动态扩展）
  let currentMaxInnerCols = 0

  let rowIndex = 0

  // 写入并保存到文件
  async function flush() {
    const buffer = await workbook.xlsx.writeBuffer()
    const writable = await fileHandle.createWritable()
    await writable.write(buffer)
    await writable.close()
  }

  /**
   * 动态扩展内页图列：如果当前笔记的内页图数量超过已有列数，追加新列
   */
  function expandInnerImageColumns(needed) {
    if (needed <= currentMaxInnerCols) return

    const headerRowRef = sheet.getRow(1)
    for (let i = currentMaxInnerCols + 1; i <= needed; i++) {
      const colIdx = baseColCount + 1 + i // 基础列 + 笔记封面 + 内页图i
      const cell = headerRowRef.getCell(colIdx)
      cell.value = `内页图${i}`
      cell.font = { bold: true, size: 12 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
      // 设置列宽
      sheet.getColumn(colIdx).width = IMAGE_COL_WIDTH
    }
    currentMaxInnerCols = needed
  }

  // 先写入表头
  await flush()

  return {
    fileHandle,

    /**
     * 追加一行数据并立即保存
     * @param {object} data - 笔记数据
     * @param {string} [data.coverImage] - 封面图 base64 data URL
     * @param {string[]} [data.innerImages] - 内页图 base64 data URL 数组
     */
    async appendRow(data) {
      rowIndex++

      // 有效内页图
      const innerImages = (data.innerImages || []).filter(img => parseBase64DataUrl(img))

      // 如果内页图数量超过当前列数，动态扩展
      expandInnerImageColumns(innerImages.length)

      // 正文去除 #话题标签，提取出的标签合并到标签列
      const rawContent = data.content || ''
      const contentTags = (rawContent.match(/#[^\s#]+/g) || []).map(t => t.replace(/^#/, ''))
      let cleanContent = rawContent.replace(/#[^\s#]+/g, '').trim()
      // 正文为空时 或 原始正文仅含标签(contentFromTitle) 时，强制正文 = 标题
      if (!cleanContent || data.contentFromTitle) {
        cleanContent = data.title || ''
      }

      // 合并原有标签 + 正文提取标签（去重，最多10个）
      const existingTags = (data.tags || []).map(t => t.replace(/^#/, ''))
      const allTags = [...new Set([...existingTags, ...contentTags])].slice(0, 10)

      // 基础数据列（无序号，与 exportUtils.js 对齐）
      const rowData = [
        data.shopName || '',
        data.accountName || '',
        cleanProductName(data.productName || ''),
        data.productItemId || '',
        data.title || '',
        cleanContent,
        allTags.map(t => '#' + t).join(','),
      ]
      // 笔记封面 + 内页图占位
      const totalImageCols = 1 + currentMaxInnerCols
      for (let i = 0; i < totalImageCols; i++) {
        rowData.push('')
      }

      const row = sheet.addRow(rowData)
      const excelRowNumber = row.number // 实际 Excel 行号（1-based，含表头）

      // 判断是否有图片
      const hasCover = data.coverImage && parseBase64DataUrl(data.coverImage)
      const hasAnyImage = hasCover || innerImages.length > 0

      // 行高
      row.height = hasAnyImage ? IMAGE_ROW_HEIGHT : NORMAL_ROW_HEIGHT

      // 基础列样式（与 exportUtils.js 对齐）
      row.eachCell((cell, colNumber) => {
        if (colNumber === 6) {
          // 正文列：自动换行 + 顶部对齐
          cell.alignment = { wrapText: true, vertical: 'top' }
        } else if (colNumber <= baseColCount) {
          cell.alignment = { vertical: 'middle', wrapText: true }
        } else {
          // 图片列居中
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      })

      // 嵌入封面图
      if (hasCover) {
        try {
          const parsed = parseBase64DataUrl(data.coverImage)
          if (parsed) {
            const imageId = workbook.addImage({
              base64: parsed.base64,
              extension: parsed.extension,
            })
            sheet.addImage(imageId, {
              tl: { col: baseColCount, row: excelRowNumber - 1 },
              ext: { width: 140, height: 187 },
              editAs: 'oneCell',
            })
          }
        } catch (e) {
          console.warn('嵌入封面图失败:', e)
        }
      }

      // 嵌入所有内页图（不再截断）
      for (let i = 0; i < innerImages.length; i++) {
        try {
          const parsed = parseBase64DataUrl(innerImages[i])
          if (parsed) {
            const imageId = workbook.addImage({
              base64: parsed.base64,
              extension: parsed.extension,
            })
            sheet.addImage(imageId, {
              tl: { col: baseColCount + 1 + i, row: excelRowNumber - 1 },
              ext: { width: 140, height: 187 },
              editAs: 'oneCell',
            })
          }
        } catch (e) {
          console.warn(`嵌入内页图${i + 1}失败:`, e)
        }
      }

      // 立即写入文件
      await flush()

      return rowIndex
    },

    /**
     * 更新已有行的数据（用于先写入"处理中"再更新为完成）
     */
    async updateRow(index, data) {
      const row = sheet.getRow(index + 1) // +1 因为表头占第一行

      // 去序号后：标题=5, 正文=6, 标签=7
      if (data.title !== undefined) row.getCell(5).value = data.title

      // 正文去标签 + 提取标签合并到标签列
      const rawContent = data.content !== undefined ? (data.content || '') : undefined
      if (rawContent !== undefined) {
        const contentTags = (rawContent.match(/#[^\s#]+/g) || []).map(t => t.replace(/^#/, ''))
        let cleanContent = rawContent.replace(/#[^\s#]+/g, '').trim()
        // 正文为空时用标题兜底
        if (!cleanContent) {
          cleanContent = data.title || ''
        }
        row.getCell(6).value = cleanContent
        row.getCell(6).alignment = { wrapText: true, vertical: 'top' }

        // 合并标签
        const existingTags = (data.tags || []).map(t => t.replace(/^#/, ''))
        const allTags = [...new Set([...existingTags, ...contentTags])].slice(0, 10)
        row.getCell(7).value = allTags.map(t => '#' + t).join(',')
      } else if (data.tags !== undefined) {
        const tags = (data.tags || []).map(t => t.replace(/^#/, ''))
        row.getCell(7).value = [...new Set(tags)].slice(0, 10).map(t => '#' + t).join(',')
      }

      await flush()
    },

    /** 获取当前已写入行数 */
    getRowCount() {
      return rowIndex
    },

    /** 完成写入（写入汇总信息） */
    async finalize(summary) {
      // 空一行写汇总
      sheet.addRow([])
      const summaryRow = sheet.addRow([
        '', '', '', '', '',
        `采集完成 | 总计: ${summary.total} | 成功: ${summary.success} | 失败: ${summary.fail}`,
      ])
      summaryRow.getCell(6).font = { bold: true, size: 11, color: { argb: 'FF1565C0' } }

      await flush()
    },
  }
}
