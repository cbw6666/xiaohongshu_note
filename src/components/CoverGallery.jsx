import CoverCanvas from './CoverCanvas.jsx'
import { COVER_TEMPLATES } from '../templates/coverTemplates.js'

export default function CoverGallery() {
  const sampleData = {
    title: '逼自己做自媒体的第一天建议收藏',
    subtitle: '万能模板+高分框架',
  }

  return (
    <div className="panel">
      <h2>🎨 封面模板预览</h2>
      <div className="cover-gallery">
        {COVER_TEMPLATES.map((tpl, i) => (
          <div key={tpl.id} className="cover-item">
            <CoverCanvas
              templateId={tpl.id}
              data={sampleData}
              colorIdx={i}
              width={186}
            />
            <p className="cover-label">{tpl.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
