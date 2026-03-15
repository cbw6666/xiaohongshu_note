/**
 * 流式 Excel 导出工具
 * 使用 File System Access API (showSaveFilePicker) 实现增量写入
 * 每处理完一条笔记就立即写入并保存，即使中途关闭浏览器已写入的数据也不会丢失
 * 支持嵌入笔记封面和内页图片
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

// 图片列的固定宽度和行高
const IMAGE_COL_WIDTH = 18       // Excel 列宽单位（约 130px）
const IMAGE_ROW_HEIGHT = 140     // 有图片行的行高（px → Excel 约 140 * 0.75 pt）
const NORMAL_ROW_HEIGHT = 22

/**
 * 创建流式 Excel 写入器
 * @param {object} options
 * @param {number} [options.maxInnerImages=5] - 最大内页图列数
 */
export async function createStreamWriter({ maxInnerImages = 5 } = {}) {
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

  // 构建表头：基础列 + 笔记封面 + 内页图1~N
  const baseHeaders = ['序号', '店铺', '账号', '商品名称', '商品ID', '笔记标题', '正文', '标签', '状态', '来源链接']
  const imageHeaders = ['笔记封面']
  for (let i = 1; i <= maxInnerImages; i++) {
    imageHeaders.push(`内页图${i}`)
  }
  const headers = [...baseHeaders, ...imageHeaders]
  const headerRow = sheet.addRow(headers)

  // 表头样式
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF4757' } }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    }
  })

  // 设置列宽：基础列 + 图片列
  const baseColWidths = [
    { width: 6 },   // 序号
    { width: 14 },  // 店铺
    { width: 14 },  // 账号
    { width: 20 },  // 商品名称
    { width: 14 },  // 商品ID
    { width: 28 },  // 笔记标题
    { width: 50 },  // 正文
    { width: 24 },  // 标签
    { width: 10 },  // 状态
    { width: 40 },  // 来源链接
  ]
  const imageColWidths = []
  for (let i = 0; i < 1 + maxInnerImages; i++) {
    imageColWidths.push({ width: IMAGE_COL_WIDTH })
  }
  sheet.columns = [...baseColWidths, ...imageColWidths]

  // 基础列数（图片列从第 baseCount+1 列开始）
  const baseColCount = baseHeaders.length

  let rowIndex = 0

  // 写入并保存到文件
  async function flush() {
    const buffer = await workbook.xlsx.writeBuffer()
    const writable = await fileHandle.createWritable()
    await writable.write(buffer)
    await writable.close()
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

      // 基础数据列（图片列先留空）
      const rowData = [
        rowIndex,
        data.shopName || '',
        data.accountName || '',
        cleanProductName(data.productName || ''),
        data.productItemId || '',
        data.title || '',
        data.content || '',
        (data.tags || []).map(t => t.startsWith('#') ? t : '#' + t).join(' '),
        data.status || '完成',
        data.url || '',
      ]
      // 图片列占位
      for (let i = 0; i < 1 + maxInnerImages; i++) {
        rowData.push('')
      }

      const row = sheet.addRow(rowData)
      const excelRowNumber = row.number // 实际 Excel 行号（1-based，含表头）

      // 判断是否有图片
      const hasCover = data.coverImage && parseBase64DataUrl(data.coverImage)
      const innerImages = (data.innerImages || []).filter(img => parseBase64DataUrl(img))
      const hasAnyImage = hasCover || innerImages.length > 0

      // 行高
      row.height = hasAnyImage ? IMAGE_ROW_HEIGHT : NORMAL_ROW_HEIGHT

      // 基础列样式
      row.eachCell((cell, colNumber) => {
        if (colNumber <= baseColCount) {
          cell.alignment = { vertical: 'middle', wrapText: colNumber === 7 }
          // 状态列颜色
          if (colNumber === 9) {
            if (data.status === '失败') {
              cell.font = { color: { argb: 'FFE53935' } }
            } else if (data.status === '完成') {
              cell.font = { color: { argb: 'FF4CAF50' } }
            }
          }
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
              ext: { width: 120, height: 120 },
              editAs: 'oneCell',
            })
          }
        } catch (e) {
          console.warn('嵌入封面图失败:', e)
        }
      }

      // 嵌入内页图
      for (let i = 0; i < Math.min(innerImages.length, maxInnerImages); i++) {
        try {
          const parsed = parseBase64DataUrl(innerImages[i])
          if (parsed) {
            const imageId = workbook.addImage({
              base64: parsed.base64,
              extension: parsed.extension,
            })
            sheet.addImage(imageId, {
              tl: { col: baseColCount + 1 + i, row: excelRowNumber - 1 },
              ext: { width: 120, height: 120 },
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

      if (data.title !== undefined) row.getCell(6).value = data.title
      if (data.content !== undefined) {
        row.getCell(7).value = data.content
        row.getCell(7).alignment = { vertical: 'middle', wrapText: true }
      }
      if (data.tags !== undefined) {
        row.getCell(8).value = (data.tags || []).map(t => t.startsWith('#') ? t : '#' + t).join(' ')
      }
      if (data.status !== undefined) {
        row.getCell(9).value = data.status
        if (data.status === '失败') {
          row.getCell(9).font = { color: { argb: 'FFE53935' } }
        } else if (data.status === '完成') {
          row.getCell(9).font = { color: { argb: 'FF4CAF50' } }
        }
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
        '', '', '', '', '', '',
        `采集完成 | 总计: ${summary.total} | 成功: ${summary.success} | 失败: ${summary.fail}`,
      ])
      summaryRow.getCell(7).font = { bold: true, size: 11, color: { argb: 'FF1565C0' } }

      await flush()
    },
  }
}
