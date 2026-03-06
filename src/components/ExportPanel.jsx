import { useState } from 'react'
import { exportAll, downloadCSV } from '../utils/exportUtils.js'

export default function ExportPanel({ notes }) {
  const [exporting, setExporting] = useState(false)

  const handleExportAll = async () => {
    if (notes.length === 0) return
    setExporting(true)
    try {
      await exportAll(notes)
    } catch (err) {
      alert('导出失败: ' + err.message)
    }
    setExporting(false)
  }

  const handleExportCSV = () => {
    if (notes.length === 0) return
    downloadCSV(notes)
  }

  return (
    <div className="panel">
      <h2>📤 导出</h2>
      <p className="hint">共 {notes.length} 篇笔记可导出</p>
      <div className="btn-row">
        <button
          className="btn-primary"
          onClick={handleExportAll}
          disabled={notes.length === 0 || exporting}
        >
          {exporting ? '打包中...' : '📦 导出全部（CSV + 封面图 ZIP）'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleExportCSV}
          disabled={notes.length === 0}
        >
          📄 仅导出CSV文案
        </button>
      </div>
    </div>
  )
}
