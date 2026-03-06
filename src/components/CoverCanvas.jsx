import { useRef, useEffect, useState } from 'react'
import { renderCover } from '../utils/coverRenderer.js'
import { ensureFontsLoaded } from '../utils/fontLoader.js'

export default function CoverCanvas({ templateId, data, colorIdx = 0, width = 248 }) {
  const canvasRef = useRef(null)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    ensureFontsLoaded().then(() => setFontsReady(true))
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !fontsReady) return
    const fullCanvas = renderCover(templateId, data, colorIdx)
    const ctx = canvasRef.current.getContext('2d')
    const ratio = width / 1242
    const h = Math.round(1660 * ratio)
    canvasRef.current.width = width * 2
    canvasRef.current.height = h * 2
    canvasRef.current.style.width = width + 'px'
    canvasRef.current.style.height = h + 'px'
    ctx.scale(2, 2)
    ctx.drawImage(fullCanvas, 0, 0, width, h)
  }, [templateId, data, colorIdx, width, fontsReady])

  return <canvas ref={canvasRef} className="cover-preview" />
}
