import { useState } from 'react'
import { exportExcel } from '../utils/exportUtils.js'

export default function ExportPanel({ notes }) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(null)

  const handleExport = async () => {
    if (notes.length === 0) return
    setExporting(true)
    setProgress({ current: 0, total: notes.length })
    try {
      await exportExcel(notes, setProgress)
    } catch (err) {
      alert('导出失败: ' + err.message)
    }
    setExporting(false)
    setProgress(null)
  }

  return (
    <div className="panel">
      <h2>📤 导出</h2>
      <p className="hint">共 {notes.length} 篇笔记可导出</p>
      <div className="btn-row">
        <button
          className="btn-primary"
          onClick={handleExport}
          disabled={notes.length === 0 || exporting}
        >
          {exporting
            ? `导出中 (${progress?.current || 0}/${progress?.total || notes.length})...`
            : '📊 导出 Excel（含封面图）'}
        </button>
      </div>
    </div>
  )
}
