/**
 * Excel 导入工具
 * 读取上传的 xlsx 文件，智能识别列名，提取笔记链接和商品信息
 */
import ExcelJS from 'exceljs'

// 列名映射规则（支持模糊匹配）
const COLUMN_PATTERNS = {
  url: ['链接', '笔记链接', '小红书链接', 'url', 'link', '地址', '网址'],
  productName: ['商品', '商品名称', '商品名', '产品', '产品名称', '产品名'],
  productId: ['商品id', '商品编号', 'id', '编号', 'sku', 'product_id', 'productid', 'itemid', '商品链接'],
  shopName: ['店铺', '店铺名称', '店铺名', 'shop'],
  accountName: ['账号', '账号名称', '账号名', 'account'],
  remark: ['备注', '说明', '提示词', 'remark', 'note'],
}

/**
 * 智能匹配列名
 */
function matchColumn(headerText) {
  if (!headerText) return null
  const text = String(headerText).trim().toLowerCase()

  for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of patterns) {
      if (text === pattern.toLowerCase() || text.includes(pattern.toLowerCase())) {
        return field
      }
    }
  }
  return null
}

/**
 * 从 Excel 行中提取链接（可能在超链接中）
 */
function extractCellUrl(cell) {
  // 先检查超链接
  if (cell?.hyperlink) {
    return cell.hyperlink
  }
  // 文本内容
  const text = cell?.text || cell?.value?.toString?.() || ''
  // 尝试从文本中提取 URL
  const urlMatch = text.match(/https?:\/\/[^\s]+/)
  return urlMatch ? urlMatch[0] : text.trim()
}

/**
 * 解析上传的 Excel 文件
 * @param {File} file 上传的文件
 * @returns {{ columns: object, rows: array, headers: string[] }}
 */
export async function parseExcel(file) {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Excel 文件中没有工作表')
  }

  // 读取表头（第一行）
  const headerRow = worksheet.getRow(1)
  const headers = []
  const columnMapping = {} // { colIndex: fieldName }

  headerRow.eachCell((cell, colNumber) => {
    const headerText = cell.text || cell.value?.toString?.() || ''
    headers.push(headerText.trim())
    const field = matchColumn(headerText)
    if (field) {
      columnMapping[colNumber] = field
    }
  })

  // 如果没有识别到 url 列，尝试把第一列作为 url
  const hasUrlCol = Object.values(columnMapping).includes('url')
  if (!hasUrlCol && headers.length > 0) {
    columnMapping[1] = 'url'
  }

  // 读取数据行
  const rows = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // 跳过表头

    const rowData = {}
    let hasData = false

    for (const [colIndex, field] of Object.entries(columnMapping)) {
      const cell = row.getCell(parseInt(colIndex))
      if (field === 'url') {
        rowData[field] = extractCellUrl(cell)
      } else {
        rowData[field] = cell?.text || cell?.value?.toString?.() || ''
      }
      if (rowData[field]) hasData = true
    }

    if (hasData && rowData.url) {
      rows.push(rowData)
    }
  })

  return {
    headers,
    columnMapping,
    rows,
    totalRows: rows.length,
  }
}

/**
 * 生成导入模板 Excel
 */
export async function generateTemplate() {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('笔记链接')

  // 设置列 — 只需要链接，其他信息在笔记采集页面设置
  ws.columns = [
    { header: '小红书链接', key: 'url', width: 60 },
  ]

  // 表头样式
  const headerRow = ws.getRow(1)
  headerRow.height = 28
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF4757' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    }
  })

  // 添加示例行
  ws.addRow({
    url: 'https://www.xiaohongshu.com/explore/69aec53d0000000016009923',
  })

  // 示例行样式
  const exampleRow = ws.getRow(2)
  exampleRow.eachCell(cell => {
    cell.font = { color: { argb: 'FF999999' }, italic: true }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '小红书笔记采集模板.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
