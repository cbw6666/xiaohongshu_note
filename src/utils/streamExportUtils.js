/**
 * 流式 Excel 导出工具
 * 使用 File System Access API (showSaveFilePicker) 实现增量写入
 * 每处理完一条笔记就立即写入并保存，即使中途关闭浏览器已写入的数据也不会丢失
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
 * 创建流式 Excel 写入器
 * 用户先通过系统"另存为"对话框选择保存位置，然后返回一个 writer 对象
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

  // 表头
  const headers = ['序号', '店铺', '账号', '商品名称', '商品ID', '笔记标题', '正文', '标签', '状态', '来源链接']
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

  // 设置列宽
  sheet.columns = [
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
     */
    async appendRow(data) {
      rowIndex++

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

      const row = sheet.addRow(rowData)

      // 样式
      row.height = 22
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', wrapText: colNumber === 7 }
        // 状态列颜色
        if (colNumber === 9) {
          if (data.status === '失败') {
            cell.font = { color: { argb: 'FFE53935' } }
          } else if (data.status === '完成') {
            cell.font = { color: { argb: 'FF4CAF50' } }
          }
        }
      })

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
