/**
 * 20大封面模板 — 复刻稿定设计风格
 * Canvas尺寸：1242 × 1660 (3:4)
 * 每个模板使用不同字体
 */
import { FONTS, getCachedImage } from '../utils/fontLoader.js'

export const COVER_TEMPLATES = [
  // ===== 1. 格子速报风 — 潮酷黑体 =====
  {
    id: 'grid_breaking',
    name: '格子速报风',
    desc: '黄色格子底+速报标签+放射装饰',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 奶黄格子背景
      ctx.fillStyle = '#FFF8E1'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(210,190,120,0.3)'
      ctx.lineWidth = 1.5
      const gs = 50
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 左上角淡色块
      ctx.fillStyle = 'rgba(255,200,50,0.12)'
      roundRect(ctx, -40, -40, 400, 350, 60)
      ctx.fill()

      // 黄色放射线装饰
      ctx.save()
      ctx.translate(w * 0.58, h * 0.1)
      ctx.fillStyle = '#FFD700'
      for (let i = 0; i < 8; i++) {
        ctx.save()
        ctx.rotate(-0.5 + i * 0.2)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-22, -130); ctx.lineTo(22, -130); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.restore()

      // "速报"椭圆标签
      ctx.save()
      ctx.translate(w * 0.28, h * 0.13)
      ctx.rotate(-0.06)
      ctx.strokeStyle = '#FFB800'
      ctx.lineWidth = 8
      ctx.beginPath(); ctx.ellipse(0, 0, 190, 95, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#E8360E'
      ctx.font = `bold 92px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('速报', 0, 0)
      ctx.restore()

      // 主标题 — 居中
      ctx.font = `bold 112px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 130
      const blockH = lines.length * lh
      const startY = h * 0.5 - blockH / 2 + 40
      ctx.fillStyle = '#1A1A1A'
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 副标题 — 居中
      if (data.subtitle) {
        ctx.fillStyle = '#888'
        const subMaxW = w - 200
        fitFontSize(ctx, data.subtitle, subMaxW, 56, 32, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 40)
      }

      ctx.fillStyle = 'rgba(255,200,50,0.15)'
      ctx.beginPath(); ctx.arc(w - 80, h - 80, 120, 0, Math.PI * 2); ctx.fill()
    },
  },

  // ===== 2. 蓝色便签风 — 圆体/可爱体 =====
  {
    id: 'blue_sticky',
    name: '蓝色便签风',
    desc: '蓝色虚线边框+顶部线圈+彩色关键词',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#F0F7FC'
      ctx.fillRect(0, 0, w, h)

      // 蓝色虚线边框
      const pad = 70
      ctx.strokeStyle = '#7BAFD4'
      ctx.lineWidth = 7
      ctx.setLineDash([20, 14])
      roundRect(ctx, pad, pad + 100, w - pad * 2, h - pad * 2 - 100, 16)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      roundRect(ctx, pad + 15, pad + 115, w - pad * 2 - 30, h - pad * 2 - 130, 12)
      ctx.fill()

      // 线圈
      const ringCount = 10
      const ringStartX = pad + 90
      const ringSpacing = (w - pad * 2 - 180) / (ringCount - 1)
      for (let i = 0; i < ringCount; i++) {
        const cx = ringStartX + i * ringSpacing
        ctx.strokeStyle = 'rgba(150,180,210,0.3)'
        ctx.lineWidth = 6
        ctx.beginPath(); ctx.arc(cx + 2, pad + 102, 24, 0.3, Math.PI * 2 - 0.3); ctx.stroke()
        ctx.strokeStyle = '#8CBBD9'
        ctx.lineWidth = 5
        ctx.beginPath(); ctx.arc(cx, pad + 100, 24, 0.3, Math.PI * 2 - 0.3); ctx.stroke()
      }

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 100px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 280)
      const lh = 120
      const blockH = lines.length * lh
      const startY = h * 0.42 - blockH / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 副标题彩色
      if (data.subtitle) {
        const subY = startY + blockH + 40
        const subMaxW = w - 280
        fitFontSize(ctx, data.subtitle, subMaxW, 62, 36, `900 62px ${F}`)
        // 彩色关键词
        const colors = ['#FF69B4', '#E8A040', '#7CB9E8']
        const chars = data.subtitle.split('')
        const totalW = ctx.measureText(data.subtitle).width
        let drawX = w / 2 - totalW / 2
        chars.forEach((ch, ci) => {
          ctx.fillStyle = colors[Math.floor(ci / 2) % colors.length]
          ctx.textAlign = 'left'
          ctx.fillText(ch, drawX, subY)
          drawX += ctx.measureText(ch).width
        })
        ctx.textAlign = 'center'
        // 爱心
        ctx.fillStyle = '#FF69B4'
        ctx.font = '48px sans-serif'
        ctx.fillText('💕', w / 2 + totalW / 2 + 20, subY)
      }
    },
  },

  // ===== 3. 笔记本横线风 — 超粗黑体 =====
  {
    id: 'notebook_lines',
    name: '笔记本横线风',
    desc: '白底横线+粗体黑字+圆点装饰',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, w, h)

      // 顶部栏
      ctx.fillStyle = '#F2F2F2'
      ctx.fillRect(0, 0, w, 100)
      ctx.strokeStyle = '#E0E0E0'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, 100); ctx.lineTo(w, 100); ctx.stroke()
      ctx.fillStyle = '#CCC'
      ctx.font = `32px ${F}`
      ctx.textAlign = 'left'; ctx.fillText('Date', 80, 62)
      ctx.textAlign = 'right'; ctx.fillText('ⓘ  ☆', w - 80, 62)

      // 横线
      ctx.strokeStyle = '#E8E8E8'
      ctx.lineWidth = 1.5
      for (let y = 140; y < h - 60; y += 56) {
        ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(w - 50, y); ctx.stroke()
      }

      // 左侧红线
      ctx.strokeStyle = 'rgba(220,80,80,0.25)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(110, 100); ctx.lineTo(110, h); ctx.stroke()

      // 主标题 — 超粗黑体
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 120px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 135
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 圆点
      const dotY = startY + blockH + 35
      ctx.fillStyle = '#1A1A1A'
      for (let i = 0; i < 7; i++) {
        ctx.beginPath(); ctx.arc(w / 2 - 216 + i * 72, dotY, 16, 0, Math.PI * 2); ctx.fill()
      }

      if (data.subtitle) {
        ctx.fillStyle = '#666'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 32, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, dotY + 100)
      }

      ctx.fillStyle = '#CCC'
      ctx.font = '52px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('···', w - 70, h - 70)
    },
  },

  // ===== 4. 黄框方格风 — 手写楷体 =====
  {
    id: 'yellow_frame',
    name: '黄框方格风',
    desc: '黄色粗边框+格子底+椭圆标注+蓝色副标题',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      const F2 = FONTS.HEITI
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(200,200,200,0.25)'
      ctx.lineWidth = 1
      const gs = 42
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 双层黄色边框
      ctx.strokeStyle = '#FFB800'
      ctx.lineWidth = 16
      roundRect(ctx, 55, 55, w - 110, h - 110, 20)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,184,0,0.2)'
      ctx.lineWidth = 6
      roundRect(ctx, 38, 38, w - 76, h - 76, 26)
      ctx.stroke()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 115px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 260)
      const lh = 130
      const blockH = lines.length * lh
      const startY = h * 0.35 - blockH / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 最后一行椭圆标注
      if (lines.length > 0) {
        const hlIdx = Math.min(lines.length - 1, 2)
        const hlLine = lines[hlIdx]
        const hlY = startY + hlIdx * lh
        const hlW = ctx.measureText(hlLine).width
        ctx.strokeStyle = '#FFB800'
        ctx.lineWidth = 6
        ctx.beginPath(); ctx.ellipse(w / 2, hlY, hlW / 2 + 35, 68, -0.03, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(w / 2 + hlW / 2 + 20, hlY - 50)
        ctx.quadraticCurveTo(w / 2 + hlW / 2 + 60, hlY - 90, w / 2 + hlW / 2 + 40, hlY - 100)
        ctx.stroke()
      }

      // 蓝色副标题条
      if (data.subtitle) {
        const subY = startY + blockH + 35
        const subMaxW = w - 260
        fitFontSize(ctx, data.subtitle, subMaxW, 56, 32, `900 56px ${F2}`)
        const tw = ctx.measureText(data.subtitle).width
        const barW = Math.min(tw + 70, w - 240)
        ctx.fillStyle = '#7CB9E8'
        roundRect(ctx, w / 2 - barW / 2, subY - 40, barW, 88, 12)
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(data.subtitle, w / 2, subY)
      }

      ctx.fillStyle = 'rgba(255,184,0,0.1)'
      ctx.beginPath(); ctx.arc(w - 140, h - 200, 160, 0, Math.PI * 2); ctx.fill()
    },
  },

  // ===== 5. 圆角卡片红字风 — 超粗黑体+红色 =====
  {
    id: 'card_red_accent',
    name: '圆角卡片红字风',
    desc: '灰底白卡片+红色关键词+蓝色方框高亮',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#ECECEC'
      ctx.fillRect(0, 0, w, h)

      // 白色卡片+阴影
      ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 35; ctx.shadowOffsetY = 12
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, 55, 55, w - 110, h - 110, 52)
      ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      ctx.strokeStyle = '#E0E0E0'
      ctx.lineWidth = 3
      roundRect(ctx, 55, 55, w - 110, h - 110, 52)
      ctx.stroke()

      // 主标题 — 居中
      const maxW = w - 260
      ctx.font = `900 128px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, maxW)
      const lh = 165
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2 + lh / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        if (i === 1 && lines.length >= 3) {
          ctx.fillStyle = '#E8360E'
          ctx.fillText(line, w / 2, y)
          const tw = ctx.measureText(line).width
          ctx.strokeStyle = '#FFB800'; ctx.lineWidth = 7
          drawWavyLine(ctx, w / 2 - tw / 2, y + 72, tw)
        } else if (i === lines.length - 1 && lines.length >= 2) {
          const tw = ctx.measureText(line).width
          ctx.strokeStyle = '#7CB9E8'; ctx.lineWidth = 8
          ctx.strokeRect(w / 2 - tw / 2 - 16, y - 75, tw + 32, 155)
          ctx.fillStyle = '#1A1A1A'
          ctx.fillText(line, w / 2, y)
        } else if (lines.length === 1) {
          ctx.fillStyle = '#E8360E'
          ctx.fillText(line, w / 2, y)
          const tw = ctx.measureText(line).width
          ctx.strokeStyle = '#FFB800'; ctx.lineWidth = 7
          drawWavyLine(ctx, w / 2 - tw / 2, y + 72, tw)
        } else {
          ctx.fillStyle = '#1A1A1A'
          ctx.fillText(line, w / 2, y)
        }
      })

      if (data.subtitle) {
        ctx.fillStyle = '#888'
        fitFontSize(ctx, data.subtitle, maxW, 52, 30, `500 52px ${F}`)
        ctx.textAlign = 'center'
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 30)
      }
    },
  },

  // ===== 6. 漫画集中线风 — 衬线粗体 =====
  {
    id: 'manga_impact',
    name: '漫画集中线风',
    desc: '放射集中线+黑底白字+红色冲击大字',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 3
      roundRect(ctx, 30, 30, w - 60, h - 60, 36)
      ctx.stroke()

      // 放射集中线
      ctx.save()
      ctx.translate(w / 2, h * 0.5)
      for (let i = 0; i < 100; i++) {
        const angle = (Math.PI * 2 * i) / 100
        const innerR = 280 + Math.random() * 250
        const outerR = 800 + Math.random() * 300
        ctx.strokeStyle = `rgba(30,30,30,${0.15 + Math.random() * 0.25})`
        ctx.lineWidth = 0.8 + Math.random() * 2.5
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
        ctx.stroke()
      }
      ctx.restore()

      // 中心白色遮罩
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.42, 450, 360, 0, 0, Math.PI * 2); ctx.fill()

      ctx.font = `900 110px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 280)
      const scale = lines._scale || 1
      const baseSize = Math.round(110 * scale)
      const accentSize = Math.round(130 * scale)

      // 计算整体块高度
      const titleLh = Math.round(180 * scale)
      const titleBlockH = lines.length * titleLh
      const subH = data.subtitle ? 160 : 0
      const gap = 65
      const totalH = titleBlockH + (subH > 0 ? gap + subH : 0)
      const startY = h * 0.42 - totalH / 2

      lines.forEach((line, i) => {
        const y = startY + i * titleLh
        if (i === 0) {
          ctx.font = `900 ${baseSize}px ${F}`
          const tw1 = ctx.measureText(line).width
          ctx.fillStyle = '#1A1A1A'
          roundRect(ctx, w / 2 - tw1 / 2 - 35, y - 68, tw1 + 70, 140, 8)
          ctx.fill()
          ctx.fillStyle = '#FFFFFF'
          ctx.fillText(line, w / 2, y)
        } else {
          ctx.fillStyle = '#E8360E'
          ctx.font = `900 ${accentSize}px ${F}`
          ctx.fillText(line, w / 2, y)
          ctx.font = `900 ${baseSize}px ${F}`
        }
      })

      if (data.subtitle) {
        ctx.fillStyle = '#E8360E'
        const maxSubW = w - 180
        const subFont = `900 ${accentSize}px ${F}`
        fitFontSize(ctx, data.subtitle, maxSubW, accentSize, 60, subFont)
        const subY = startY + titleBlockH + gap
        ctx.fillText(data.subtitle, w / 2, subY)
      }

      ctx.fillStyle = '#CCC'; ctx.font = '38px sans-serif'; ctx.textAlign = 'right'
      ctx.fillText('ⓘ  ☆', w - 70, 80)
      ctx.fillText('···', w - 70, h - 70)
    },
  },

  // ===== 7. 橙色高亮讨论风 — 文艺体 =====
  {
    id: 'orange_highlight',
    name: '橙色高亮讨论风',
    desc: '圆角白卡+顶部图标+黄色高亮+手绘书本',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#F5F5F5'
      ctx.fillRect(0, 0, w, h)

      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, 40, 40, w - 80, h - 80, 44)
      ctx.fill()
      ctx.strokeStyle = '#EEEEEE'; ctx.lineWidth = 2
      roundRect(ctx, 40, 40, w - 80, h - 80, 44)
      ctx.stroke()

      // 顶部导航
      ctx.fillStyle = '#E8A040'
      ctx.font = '48px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('‹', 90, 110)
      ctx.font = '40px sans-serif'; ctx.textAlign = 'right'
      ctx.fillText('↻   ⇧   ···', w - 85, 110)

      ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(70, 155); ctx.lineTo(w - 70, 155); ctx.stroke()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 105px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 240)
      const lh = 125
      const blockH = lines.length * lh
      const startY = h * 0.34 - blockH / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 副标题黄色高亮
      if (data.subtitle) {
        const subY = startY + blockH + 40
        fitFontSize(ctx, data.subtitle, w - 260, 95, 50, `900 95px ${F}`)
        const tw = ctx.measureText(data.subtitle).width
        const y = subY
        ctx.fillStyle = '#FFE44D'
        roundRect(ctx, w / 2 - tw / 2 - 14, y - 52, tw + 28, 108, 6)
        ctx.fill()
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(data.subtitle, w / 2, y)
      }

      drawBookIcon(ctx, w / 2 - 70, h - 350, '#E8A040')
    },
  },

  // ===== 8. 格子圈重点风 — 手写潦草体 =====
  {
    id: 'grid_circle',
    name: '格子圈重点风',
    desc: '浅格子底+黑色大字+绿色椭圆圈重点+橙色箭头',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#FBFBFB'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(200,200,200,0.28)'
      ctx.lineWidth = 1
      const gs = 46
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 右上角橙色虚线圆圈+箭头
      ctx.save()
      ctx.translate(w * 0.72, h * 0.12)
      ctx.strokeStyle = '#E8A040'; ctx.lineWidth = 4.5; ctx.setLineDash([8, 6])
      ctx.beginPath(); ctx.arc(0, 0, 48, 0.4, Math.PI * 1.85); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#E8A040'
      ctx.beginPath(); ctx.moveTo(32, 36); ctx.lineTo(52, 22); ctx.lineTo(36, 12); ctx.closePath(); ctx.fill()
      ctx.restore()

      ctx.fillStyle = 'rgba(76,175,80,0.06)'
      ctx.beginPath(); ctx.arc(100, 100, 120, 0, Math.PI * 2); ctx.fill()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 115px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 240)
      const lh = 130
      const blockH = lines.length * lh
      const startY = h * 0.42 - blockH / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 第二行绿色椭圆
      if (lines.length >= 2) {
        const hlLine = lines[1]
        const hlY = startY + lh
        const hlW = ctx.measureText(hlLine).width
        ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 8
        ctx.beginPath(); ctx.ellipse(w / 2, hlY, hlW / 2 + 45, 78, -0.04, 0, Math.PI * 2); ctx.stroke()
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(w / 2 + hlW / 2 + 55, hlY - 30)
        ctx.quadraticCurveTo(w / 2 + hlW / 2 + 70, hlY - 55, w / 2 + hlW / 2 + 50, hlY - 65)
        ctx.stroke()
      }

      if (data.subtitle) {
        ctx.fillStyle = '#777'
        fitFontSize(ctx, data.subtitle, w - 240, 56, 32, `900 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 40)
      }
    },
  },

  // ===== 9. 浏览器窗口风 — 衬线粗体 =====
  {
    id: 'browser_window',
    name: '浏览器窗口风',
    desc: '格子底+浏览器外框+红绿黄圆点+绿色涂抹高亮',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#F5F5F5'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(200,200,200,0.22)'
      ctx.lineWidth = 1
      const gs = 42
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      const fX = 55, fY = 55, fW = w - 110, fH = h - 110
      ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, fX, fY, fW, fH, 22); ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

      ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 2.5
      roundRect(ctx, fX, fY, fW, fH, 22); ctx.stroke()

      ctx.fillStyle = '#FAFAFA'
      roundRectTop(ctx, fX, fY, fW, 88, 22); ctx.fill()
      ctx.strokeStyle = '#E8E8E8'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(fX, fY + 88); ctx.lineTo(fX + fW, fY + 88); ctx.stroke()

      const dotColors = ['#FF5F57', '#FFBD2E', '#28C840']
      dotColors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.beginPath(); ctx.arc(fX + 52 + i * 44, fY + 44, 14, 0, Math.PI * 2); ctx.fill()
      })

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 105px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, fW - 160)
      const lh = 125
      const blockH = lines.length * lh
      const startY = fY + 88 + (fH - 88 - 120) / 2 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        if (i === 1) {
          const tw = ctx.measureText(line).width
          ctx.fillStyle = 'rgba(180,230,80,0.35)'
          ctx.fillRect(w / 2 - tw / 2 - 10, y - 48, tw + 20, 100)
          ctx.fillStyle = 'rgba(160,215,60,0.2)'
          ctx.fillRect(w / 2 - tw / 2 - 5, y - 42, tw + 10, 88)
        }
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      if (data.subtitle) {
        ctx.fillStyle = '#666'
        fitFontSize(ctx, data.subtitle, fW - 160, 52, 30, `700 52px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 35)
      }

      const bottomY = fY + fH - 50
      ctx.fillStyle = '#BBB'
      ctx.font = `500 36px ${FONTS.HEITI}`
      ctx.textAlign = 'left'; ctx.fillText('BIAOTI', fX + 70, bottomY)
      ctx.textAlign = 'right'; ctx.fillText('⊙  MOBAN', fX + fW - 70, bottomY)
      ctx.strokeStyle = '#EEEEEE'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(fX + 50, bottomY - 30); ctx.lineTo(fX + fW - 50, bottomY - 30); ctx.stroke()
    },
  },

  // ===== 10. 彩色云朵标注风 — 潮酷黑体（左对齐+超粗大字） =====
  {
    id: 'cloud_accent',
    name: '彩色云朵标注风',
    desc: '白底+蓝色/黄色云朵色块高亮+超粗大字+左对齐',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)

      // 顶部蓝色装饰（虚线圆+箭头）
      ctx.strokeStyle = '#A8D8EA'; ctx.lineWidth = 4
      ctx.setLineDash([6, 6])
      ctx.beginPath(); ctx.arc(w / 2, 130, 42, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(w / 2, 85); ctx.lineTo(w / 2, 45); ctx.stroke()
      ctx.fillStyle = '#A8D8EA'
      ctx.beginPath(); ctx.moveTo(w / 2 - 12, 55); ctx.lineTo(w / 2, 35); ctx.lineTo(w / 2 + 12, 55); ctx.closePath(); ctx.fill()

      ctx.fillStyle = 'rgba(168,216,234,0.1)'
      ctx.beginPath(); ctx.arc(80, 200, 140, 0, Math.PI * 2); ctx.fill()

      // 主标题 — 左对齐+超粗大字（参考截图风格）
      const leftX = 100
      const maxTextW = w - 200
      ctx.font = `900 145px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, maxTextW)
      const lh = 180
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2

      // 为每个字符检测是否需要高亮（模拟关键词云朵色块）
      const accentColors = ['#A8D8EA', '#FFE082']
      lines.forEach((line, i) => {
        const y = startY + i * lh
        if (i % 2 === 1) {
          // 奇数行加云朵色块高亮
          const tw = ctx.measureText(line).width
          drawCloudHighlight(ctx, leftX - 18, y - 70, tw + 36, 150, accentColors[(i >> 1) % 2])
        }
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, leftX, y)
      })

      if (data.subtitle) {
        const subY = startY + blockH + 40
        fitFontSize(ctx, data.subtitle, maxTextW, 120, 50, `900 120px ${F}`)
        const tw = ctx.measureText(data.subtitle).width
        drawCloudHighlight(ctx, leftX - 18, subY - 65, tw + 36, 140, '#FFE082')
        ctx.fillStyle = '#E8360E'
        ctx.fillText(data.subtitle, leftX, subY)
      }

      ctx.fillStyle = 'rgba(255,224,130,0.15)'
      ctx.beginPath(); ctx.arc(w - 100, h - 200, 160, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(168,216,234,0.3)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(w * 0.3, h - 120); ctx.lineTo(w * 0.7, h - 120); ctx.stroke()
    },
  },

  // ===== 11. 撕纸便利贴风 — 手写楷体 =====
  {
    id: 'torn_sticky_note',
    name: '撕纸便利贴风',
    desc: '软木板底+粉色便利贴+胶带装饰+手写体',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI

      // 软木板纹理背景
      ctx.fillStyle = '#F5E6CA'
      ctx.fillRect(0, 0, w, h)
      // 小圆点模拟软木纹理
      ctx.fillStyle = 'rgba(180,150,100,0.08)'
      for (let i = 0; i < 300; i++) {
        const rx = Math.random() * w
        const ry = Math.random() * h
        const rr = 2 + Math.random() * 6
        ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill()
      }

      // 便利贴主体（微微旋转+阴影）
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-0.02)

      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12
      ctx.fillStyle = '#FFF0F5'
      roundRect(ctx, -480, -620, 960, 1240, 12)
      ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0

      // 便利贴边框（极淡）
      ctx.strokeStyle = 'rgba(220,180,190,0.4)'
      ctx.lineWidth = 2
      roundRect(ctx, -480, -620, 960, 1240, 12)
      ctx.stroke()

      // 撕纸顶部锯齿效果
      ctx.fillStyle = '#FFF0F5'
      ctx.beginPath()
      ctx.moveTo(-480, -620)
      for (let x = -480; x < 480; x += 24) {
        ctx.lineTo(x + 12, -620 - 8 - Math.random() * 10)
        ctx.lineTo(x + 24, -620)
      }
      ctx.lineTo(480, -620)
      ctx.closePath()
      ctx.fill()

      // 顶部胶带装饰
      ctx.save()
      ctx.rotate(0.05)
      ctx.fillStyle = 'rgba(200,225,180,0.55)'
      ctx.fillRect(-120, -640, 240, 70)
      // 胶带纹理线
      ctx.strokeStyle = 'rgba(180,210,160,0.3)'
      ctx.lineWidth = 1
      for (let ly = -635; ly < -575; ly += 8) {
        ctx.beginPath(); ctx.moveTo(-115, ly); ctx.lineTo(115, ly); ctx.stroke()
      }
      ctx.restore()

      // 主标题
      ctx.fillStyle = '#3A2A2A'
      ctx.font = `900 108px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, 820)
      const lh = 128
      const blockH = lines.length * lh
      const startY = -blockH / 2 - 40

      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lh)
      })

      // 分割线装饰
      const divY = startY + blockH + 20
      ctx.strokeStyle = 'rgba(220,160,170,0.5)'
      ctx.lineWidth = 3
      ctx.setLineDash([12, 8])
      ctx.beginPath(); ctx.moveTo(-300, divY); ctx.lineTo(300, divY); ctx.stroke()
      ctx.setLineDash([])

      // 副标题
      if (data.subtitle) {
        const subY = divY + 70
        ctx.fillStyle = '#C06070'
        fitFontSize(ctx, data.subtitle, 820, 62, 36, `900 62px ${F}`)
        ctx.fillText(data.subtitle, 0, subY)

        // 粉色下划线
        const tw = ctx.measureText(data.subtitle).width
        ctx.strokeStyle = '#E8A0B0'
        ctx.lineWidth = 5
        ctx.beginPath(); ctx.moveTo(-tw / 2, subY + 40); ctx.lineTo(tw / 2, subY + 40); ctx.stroke()
      }

      // 底部装饰小图标
      ctx.font = '44px sans-serif'
      ctx.fillStyle = 'rgba(200,150,160,0.6)'
      ctx.fillText('✦  ♡  ✦', 0, 520)

      ctx.restore()

      // 右下角图钉装饰
      ctx.fillStyle = '#E07070'
      ctx.beginPath(); ctx.arc(w * 0.78, h * 0.15, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#C05050'
      ctx.beginPath(); ctx.arc(w * 0.78, h * 0.15, 8, 0, Math.PI * 2); ctx.fill()

      // 左下角淡色装饰
      ctx.fillStyle = 'rgba(220,180,150,0.12)'
      ctx.beginPath(); ctx.arc(100, h - 120, 140, 0, Math.PI * 2); ctx.fill()
    },
  },

  // ===== 12. 格子笔记圈重点风 — 超粗黑体+绿色椭圆+橙色箭头 =====
  {
    id: 'grid_note_circle',
    name: '格子笔记圈重点风',
    desc: '格子底+横线装饰+超粗黑字+绿色椭圆圈重点+橙色虚线箭头',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 白底
      ctx.fillStyle = '#FBFBFB'
      ctx.fillRect(0, 0, w, h)
      // 浅灰格子
      ctx.strokeStyle = 'rgba(200,200,200,0.22)'
      ctx.lineWidth = 1
      const gs = 46
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 顶部横线装饰（模拟笔记本顶部分割线）
      ctx.strokeStyle = 'rgba(180,180,180,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(50, 120); ctx.lineTo(w - 50, 120); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(50, 145); ctx.lineTo(w - 50, 145); ctx.stroke()

      // 右上角橙色虚线圆圈+箭头
      ctx.save()
      ctx.translate(w * 0.72, h * 0.18)
      ctx.strokeStyle = '#E8A040'; ctx.lineWidth = 5; ctx.setLineDash([10, 7])
      ctx.beginPath(); ctx.arc(0, 0, 55, 0.4, Math.PI * 1.85); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#E8A040'
      ctx.beginPath(); ctx.moveTo(38, 40); ctx.lineTo(58, 24); ctx.lineTo(40, 12); ctx.closePath(); ctx.fill()
      ctx.restore()

      // 主标题 — 居中超粗黑字
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 128px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 160
      const blockH = lines.length * lh
      const startY = h * 0.42 - blockH / 2

      lines.forEach((line, i) => {
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, startY + i * lh)
      })

      // 第二行绿色椭圆圈重点
      if (lines.length >= 2) {
        const hlLine = lines[1]
        const hlY = startY + lh
        const hlW = ctx.measureText(hlLine).width
        ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 7
        ctx.beginPath(); ctx.ellipse(w / 2, hlY, hlW / 2 + 50, 82, -0.03, 0, Math.PI * 2); ctx.stroke()
        // 椭圆尾巴小笔触
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(w / 2 + hlW / 2 + 55, hlY - 30)
        ctx.quadraticCurveTo(w / 2 + hlW / 2 + 75, hlY - 60, w / 2 + hlW / 2 + 55, hlY - 70)
        ctx.stroke()
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#777'
        fitFontSize(ctx, data.subtitle, w - 240, 56, 32, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 40)
      }

      // 底部横线装饰
      ctx.strokeStyle = 'rgba(180,180,180,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(50, h - 120); ctx.lineTo(w - 50, h - 120); ctx.stroke()
    },
  },

  // ===== 13. 粉色画笔涂抹风 — 超粗黑体 =====
  {
    id: 'pink_brush_stroke',
    name: '粉色画笔涂抹风',
    desc: '粉色底+白色画笔涂抹区+超粗黑字+彩色下划线',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 粉色背景
      ctx.fillStyle = '#F5A0B8'
      ctx.fillRect(0, 0, w, h)

      // 白色画笔涂抹区（模拟笔刷横扫效果）
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      const brushY = h * 0.15
      const brushH = h * 0.62
      for (let i = 0; i < 18; i++) {
        const by = brushY + (brushH / 18) * i
        const bxOff = (Math.random() - 0.5) * 80
        const bw = w * 0.72 + Math.random() * w * 0.16
        const bx = (w - bw) / 2 + bxOff
        const bh = brushH / 18 + 12
        ctx.globalAlpha = 0.7 + Math.random() * 0.3
        ctx.fillRect(bx, by, bw, bh)
      }
      ctx.globalAlpha = 1

      // 补充边缘笔触（淡粉色拖尾）
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      for (let i = 0; i < 8; i++) {
        const ex = w * 0.08 + Math.random() * w * 0.12
        const ey = brushY + Math.random() * brushH
        ctx.fillRect(ex, ey, 60 + Math.random() * 40, 15 + Math.random() * 20)
      }
      for (let i = 0; i < 8; i++) {
        const ex = w * 0.78 + Math.random() * w * 0.12
        const ey = brushY + Math.random() * brushH
        ctx.fillRect(ex, ey, 60 + Math.random() * 40, 15 + Math.random() * 20)
      }

      // 右上角装饰图标
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.font = '42px sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText('ⓘ  ☆', w - 80, 80)

      // 主标题 — 居中超粗黑字
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 130px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 300)
      const lh = 165
      const blockH = lines.length * lh
      const startY = h * 0.46 - blockH / 2

      lines.forEach((line, i) => {
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, startY + i * lh)
      })

      // 关键词彩色下划线（第一行蓝色，最后一行红色）
      if (lines.length >= 1) {
        // 第一行尾部蓝色下划线
        const l0 = lines[0]
        const tw0 = ctx.measureText(l0).width
        ctx.strokeStyle = '#5B9BD5'; ctx.lineWidth = 12; ctx.lineCap = 'round'
        const ulY0 = startY + 68
        const ulLen0 = Math.min(tw0 * 0.35, 200)
        ctx.beginPath(); ctx.moveTo(w / 2 + tw0 / 2 - ulLen0, ulY0); ctx.lineTo(w / 2 + tw0 / 2, ulY0); ctx.stroke()
      }
      if (lines.length >= 2) {
        // 最后一行尾部红色下划线
        const lastLine = lines[lines.length - 1]
        const twL = ctx.measureText(lastLine).width
        ctx.strokeStyle = '#E8360E'; ctx.lineWidth = 12; ctx.lineCap = 'round'
        const ulYL = startY + (lines.length - 1) * lh + 68
        const ulLenL = Math.min(twL * 0.35, 200)
        ctx.beginPath(); ctx.moveTo(w / 2 - twL / 2, ulYL); ctx.lineTo(w / 2 - twL / 2 + ulLenL, ulYL); ctx.stroke()
      }
      ctx.lineCap = 'butt'

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#666'
        fitFontSize(ctx, data.subtitle, w - 300, 52, 30, `500 52px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 40)
      }

      // 右下角省略号装饰
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.font = '56px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('···', w - 80, h - 80)
    },
  },

  // ===== 14. 蓝色横线笔记涂抹风 — 超粗黑体 =====
  {
    id: 'blue_lined_note',
    name: '蓝色横线笔记涂抹风',
    desc: '淡蓝底+横线+蓝色涂抹区+超粗黑字+气泡+OK手势',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 淡蓝背景
      ctx.fillStyle = '#E8F0FA'
      ctx.fillRect(0, 0, w, h)

      // 横线
      ctx.strokeStyle = 'rgba(180,200,230,0.5)'
      ctx.lineWidth = 1.5
      for (let y = 100; y < h - 60; y += 64) {
        ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(w - 50, y); ctx.stroke()
      }

      // 蓝灰色涂抹区（笔刷效果）
      ctx.fillStyle = 'rgba(170,190,220,0.3)'
      const brushY = h * 0.28
      const brushH = h * 0.42
      for (let i = 0; i < 14; i++) {
        const by = brushY + (brushH / 14) * i
        const bw = w * 0.65 + Math.random() * w * 0.2
        const bx = (w - bw) / 2 + (Math.random() - 0.5) * 60
        ctx.globalAlpha = 0.4 + Math.random() * 0.35
        ctx.fillRect(bx, by, bw, brushH / 14 + 10)
      }
      ctx.globalAlpha = 1

      // 左上角对话气泡
      ctx.fillStyle = '#1A1A1A'
      ctx.save()
      ctx.translate(110, 140)
      roundRect(ctx, 0, 0, 100, 72, 12); ctx.fill()
      ctx.beginPath(); ctx.moveTo(25, 72); ctx.lineTo(15, 95); ctx.lineTo(45, 72); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '32px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('···', 50, 36)
      ctx.restore()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 120px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 240)
      const lh = 155
      const blockH = lines.length * lh
      const startY = h * 0.48 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 第一行加黄色椭圆高亮
        if (i === 0) {
          const tw = ctx.measureText(line).width
          ctx.strokeStyle = '#E8C840'; ctx.lineWidth = 5
          ctx.beginPath(); ctx.ellipse(w / 2, y, tw / 2 + 40, 70, 0, 0, Math.PI * 2); ctx.stroke()
        }
        // 最后一行加波浪下划线
        if (i === lines.length - 1 && lines.length >= 2) {
          const tw = ctx.measureText(line).width
          ctx.strokeStyle = '#E8C840'; ctx.lineWidth = 5
          drawWavyLine(ctx, w / 2 - tw / 2, y + 65, tw)
        }
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#555'
        fitFontSize(ctx, data.subtitle, w - 240, 52, 30, `500 52px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 40)
      }

      // 右下角OK手势
      ctx.save()
      ctx.translate(w - 200, h - 230)
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      // 手掌
      ctx.beginPath()
      ctx.arc(50, 50, 45, 0, Math.PI * 2); ctx.stroke()
      ctx.font = 'bold 36px sans-serif'; ctx.fillStyle = '#1A1A1A'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('OK!', 50, 50)
      ctx.restore()
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
    },
  },

  // ===== 15. 备忘录风格 — 超粗黑体+橙色副标题+彩色装饰 =====
  {
    id: 'memo_style',
    name: '备忘录风格',
    desc: '白底+备忘录顶栏+超粗黑字+蓝色色块高亮+橙色副标题+彩色涂鸦装饰',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 白底微纹理
      ctx.fillStyle = '#FAFAF8'
      ctx.fillRect(0, 0, w, h)
      // 淡点阵纹理
      ctx.fillStyle = 'rgba(200,200,200,0.06)'
      for (let i = 0; i < 200; i++) {
        const px = Math.random() * w, py = Math.random() * h
        ctx.fillRect(px, py, 3, 3)
      }

      // 顶部备忘录导航栏
      ctx.fillStyle = '#999'
      ctx.font = `400 40px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('< 备忘录', 60, 72)
      ctx.textAlign = 'right'
      ctx.font = '38px sans-serif'
      ctx.fillText('✉  ⇧  ···', w - 60, 72)

      // 分隔线
      ctx.strokeStyle = '#E8E8E8'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(50, 110); ctx.lineTo(w - 50, 110); ctx.stroke()

      // 主标题 — 居中超粗
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 135px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 180
      const blockH = lines.length * lh
      const startY = h * 0.32 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第二行加蓝色色块高亮
      if (lines.length >= 2) {
        const hlLine = lines[1]
        const hlY = startY + lh
        const hlW = ctx.measureText(hlLine).width
        ctx.fillStyle = 'rgba(135,190,230,0.4)'
        roundRect(ctx, w / 2 - hlW / 2 - 20, hlY - 70, hlW + 40, 145, 20)
        ctx.fill()
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(hlLine, w / 2, hlY)
      }

      // 副标题 — 橙色大字
      if (data.subtitle) {
        ctx.fillStyle = '#E8960E'
        fitFontSize(ctx, data.subtitle, w - 200, 135, 60, `900 135px ${F}`)
        const subY = startY + blockH + 20
        ctx.fillText(data.subtitle, w / 2, subY)
      }

      // 左侧粉色旋转箭头装饰
      ctx.save()
      ctx.translate(140, h * 0.68)
      ctx.strokeStyle = '#E8A0C0'; ctx.lineWidth = 5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(0, 0, 40, 0.6, Math.PI * 1.8); ctx.stroke()
      ctx.fillStyle = '#E8A0C0'
      ctx.beginPath(); ctx.moveTo(-30, 28); ctx.lineTo(-45, 8); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fill()
      ctx.restore()

      // 右侧蓝色波浪线装饰
      ctx.strokeStyle = 'rgba(130,190,230,0.5)'; ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(w - 120, h * 0.55)
      ctx.quadraticCurveTo(w - 100, h * 0.55 - 15, w - 80, h * 0.55)
      ctx.quadraticCurveTo(w - 60, h * 0.55 + 15, w - 40, h * 0.55)
      ctx.stroke()

      // 右侧粉色双感叹号
      ctx.fillStyle = '#E8A0C0'
      ctx.font = 'bold 50px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('!!', w - 100, h * 0.78)

      // 底部小图标
      ctx.fillStyle = '#CCC'
      ctx.font = '38px sans-serif'
      ctx.textAlign = 'left'; ctx.fillText('🔒', 70, h - 70)
      ctx.textAlign = 'right'; ctx.fillText('✎', w - 70, h - 70)

      ctx.lineCap = 'butt'
    },
  },

  // ===== 16. 薄荷收藏指南风 — 超粗黑体 =====
  {
    id: 'mint_guide',
    name: '薄荷收藏指南风',
    desc: '白底+左上角标签+薄荷色高亮+超粗黑字+手指图标+底部色条',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 纯白背景
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)

      // 左上角「建议收藏」标签
      ctx.fillStyle = '#1A1A1A'
      roundRect(ctx, 70, 80, 300, 100, 8)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `900 52px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('建议收藏', 220, 130)

      // 主标题 — 居中超粗黑字
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 145px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 190
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第二行加薄荷绿色高亮色块
      if (lines.length >= 2) {
        const hlLine = lines[1]
        const hlY = startY + lh
        const hlW = ctx.measureText(hlLine).width
        ctx.fillStyle = '#A0E8D8'
        ctx.fillRect(w / 2 - hlW / 2 - 15, hlY - 75, hlW + 30, 155)
        // 重绘该行文字
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(hlLine, w / 2, hlY)
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#555'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }

      // 右下角手指点击图标
      ctx.save()
      ctx.translate(w - 260, h - 400)
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      // 手掌轮廓
      ctx.beginPath()
      ctx.moveTo(50, 120); ctx.lineTo(50, 50); ctx.quadraticCurveTo(50, 20, 70, 20)
      ctx.quadraticCurveTo(90, 20, 90, 50); ctx.lineTo(90, 40)
      ctx.quadraticCurveTo(90, 20, 110, 20); ctx.quadraticCurveTo(130, 20, 130, 45)
      ctx.lineTo(130, 35); ctx.quadraticCurveTo(130, 15, 150, 15)
      ctx.quadraticCurveTo(170, 15, 170, 40); ctx.lineTo(170, 120)
      ctx.quadraticCurveTo(170, 155, 140, 155); ctx.lineTo(80, 155)
      ctx.quadraticCurveTo(50, 155, 50, 120)
      ctx.stroke()
      // 食指
      ctx.beginPath(); ctx.moveTo(30, 70); ctx.lineTo(30, 0)
      ctx.quadraticCurveTo(30, -25, 50, -25); ctx.quadraticCurveTo(70, -25, 70, 0)
      ctx.lineTo(70, 50); ctx.stroke()
      ctx.restore()
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'

      // 底部薄荷色条
      ctx.fillStyle = '#A0E8D8'
      ctx.fillRect(0, h - 180, w, 180)

      // 底部左侧竖线+英文标签
      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(80, h - 150, 6, 100)
      ctx.font = `500 32px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText('GUIDELINE', 100, h - 145)
      ctx.font = `400 28px ${F}`
      ctx.fillText('COLLECTION', 100, h - 108)
    },
  },

  // ===== 17. 手写黄色高亮风 — 手写楷体 =====
  {
    id: 'handwrite_yellow_hl',
    name: '手写黄色高亮风',
    desc: '白底+手写体+黄色色块高亮+蓝色关键词',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 纯白背景
      ctx.fillStyle = '#FEFEFE'
      ctx.fillRect(0, 0, w, h)

      // 主标题 — 居中手写体
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 120px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 165
      const blockH = lines.length * lh
      const startY = h * 0.42 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 偶数行（从0开始的第1、3行）加黄色高亮色块
        if (i % 2 === 1) {
          const tw = ctx.measureText(line).width
          ctx.fillStyle = '#FFD860'
          ctx.globalAlpha = 0.5
          ctx.fillRect(w / 2 - tw / 2 - 10, y - 55, tw + 20, 115)
          ctx.globalAlpha = 1
        }
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第一行中的部分蓝色字效果（模拟关键词蓝色）
      // 在标题最后两个字用蓝色覆盖
      if (lines.length >= 1) {
        const firstLine = lines[0]
        if (firstLine.length >= 2) {
          const blueChars = firstLine.slice(-2)
          const fullW = ctx.measureText(firstLine).width
          const blueW = ctx.measureText(blueChars).width
          ctx.fillStyle = '#4A7ABF'
          ctx.fillText(blueChars, w / 2 + fullW / 2 - blueW / 2, startY)
        }
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#888'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `900 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }
    },
  },

  // ===== 18. 红圈重点白纸风 — 超粗黑体+红色 =====
  {
    id: 'red_circle_paper',
    name: '红圈重点白纸风',
    desc: '白纸微噪点+超粗黑字+红色椭圆圈重点+红色关键行+杂志风',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 白色微纹理背景
      ctx.fillStyle = '#F8F6F4'
      ctx.fillRect(0, 0, w, h)
      // 微噪点
      ctx.fillStyle = 'rgba(0,0,0,0.015)'
      for (let i = 0; i < 400; i++) {
        const px = Math.random() * w, py = Math.random() * h
        ctx.fillRect(px, py, 2 + Math.random() * 2, 2 + Math.random() * 2)
      }

      // 主标题 — 居中超粗黑字
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 140px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 185
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第一行加红色椭圆圈
      if (lines.length >= 1) {
        const hlLine = lines[0]
        const hlW = ctx.measureText(hlLine).width
        ctx.strokeStyle = '#D03030'; ctx.lineWidth = 7
        ctx.beginPath()
        ctx.ellipse(w / 2, startY, hlW / 2 + 45, 85, -0.05, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 第三行红色字（关键词强调行）
      if (lines.length >= 3) {
        const redLine = lines[2]
        const redY = startY + 2 * lh
        ctx.fillStyle = '#D03030'
        ctx.fillText(redLine, w / 2, redY)
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#777'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `500 56px ${F}`)
        ctx.textAlign = 'center'
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }
    },
  },
  // ===== 19. 笔记本横线紫圆高亮风 — 超粗黑体+淡紫圆高亮 =====
  {
    id: 'notebook_purple_circle',
    name: '笔记本横线紫圆高亮风',
    desc: '白底蓝色横线+顶部标注+超粗黑字+淡紫圆形色块高亮关键字',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 白色背景
      ctx.fillStyle = '#FEFEFE'
      ctx.fillRect(0, 0, w, h)

      // 全页蓝色细横线
      ctx.strokeStyle = 'rgba(180,200,230,0.35)'
      ctx.lineWidth = 1.2
      for (let y = 120; y < h; y += 48) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // 顶部标注文字
      ctx.fillStyle = '#C0C0C0'
      ctx.font = `400 28px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('Info Doc.', 60, 50)
      ctx.fillText('Recyclable', 260, 50)

      // 主标题 — 居中超粗黑字
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 128px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 175
      const blockH = lines.length * lh
      const startY = h * 0.40 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第一行前两个字加淡紫色圆形高亮
      if (lines.length >= 1 && lines[0].length >= 2) {
        const firstLine = lines[0]
        const char1 = firstLine[0]
        const char2 = firstLine[1]
        const fullW = ctx.measureText(firstLine).width
        const c1W = ctx.measureText(char1).width
        const c2W = ctx.measureText(char2).width

        const lineStartX = w / 2 - fullW / 2

        // 第一个字的圆
        ctx.fillStyle = 'rgba(210,190,230,0.45)'
        ctx.beginPath()
        ctx.arc(lineStartX + c1W / 2, startY, 80, 0, Math.PI * 2)
        ctx.fill()

        // 第二个字的圆
        ctx.fillStyle = 'rgba(210,190,230,0.45)'
        ctx.beginPath()
        ctx.arc(lineStartX + c1W + c2W / 2, startY, 80, 0, Math.PI * 2)
        ctx.fill()

        // 重绘这两个字确保在圆上方
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(firstLine, w / 2, startY)
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#999'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }
    },
  },

  // ===== 20. 绿色马克笔涂抹高亮风 — 超粗黑体+绿色色块 =====
  {
    id: 'green_marker_highlight',
    name: '绿色马克笔涂抹高亮风',
    desc: '白灰纸质底+超粗黑字+绿色马克笔涂抹色块高亮部分行',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 浅灰白纸质背景
      ctx.fillStyle = '#F5F3F0'
      ctx.fillRect(0, 0, w, h)

      // 微纹理
      ctx.fillStyle = 'rgba(0,0,0,0.008)'
      for (let i = 0; i < 200; i++) {
        const px = Math.random() * w, py = Math.random() * h
        ctx.fillRect(px, py, 2 + Math.random() * 3, 2 + Math.random() * 3)
      }

      // 主标题 — 左对齐超粗黑字
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 135px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 185
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2
      const leftX = 100

      lines.forEach((line, i) => {
        const y = startY + i * lh

        // 第2行和第3行（索引1,2）加绿色马克笔涂抹高亮
        if (i >= 1 && i <= 2) {
          const tw = ctx.measureText(line).width
          // 马克笔涂抹效果 — 多层半透明条叠加
          ctx.fillStyle = 'rgba(130,220,170,0.55)'
          const hlH = 100
          const hlY = y - hlH / 2
          // 主色块
          ctx.fillRect(leftX - 12, hlY - 5, tw + 30, hlH + 10)
          // 上下不规则边缘
          ctx.fillStyle = 'rgba(130,220,170,0.3)'
          ctx.fillRect(leftX - 8, hlY - 12, tw + 20, 10)
          ctx.fillRect(leftX - 5, hlY + hlH + 2, tw + 15, 8)
        }

        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, leftX, y)
      })

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#999'
        ctx.textAlign = 'left'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `500 56px ${F}`)
        ctx.fillText(data.subtitle, leftX, startY + blockH + 55)
      }
    },
  },

  // ===== 21. 淡紫引号卡片风 — 超粗黑体+引号装饰+多色高亮 =====
  {
    id: 'lavender_quote_card',
    name: '淡紫引号卡片风',
    desc: '薰衣草淡紫底+左上引号装饰+超粗黑字+黄蓝色块关键词高亮',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 薰衣草淡紫背景
      ctx.fillStyle = '#EDE6F2'
      ctx.fillRect(0, 0, w, h)

      // 左上角大引号装饰
      ctx.fillStyle = 'rgba(180,165,200,0.5)'
      ctx.font = `900 220px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText('\u201C', 60, 50)

      // 主标题 — 左对齐超粗黑字
      ctx.fillStyle = '#2A2A2A'
      ctx.font = `900 125px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 220)
      const lh = 175
      const blockH = lines.length * lh
      const startY = h * 0.36 - blockH / 2
      const leftX = 100

      lines.forEach((line, i) => {
        const y = startY + i * lh

        // 第二行最后2-3个字加黄色高亮色块
        if (i === 1 && line.length >= 2) {
          const hlChars = line.slice(-2)
          const fullW = ctx.measureText(line).width
          const hlW = ctx.measureText(hlChars).width
          ctx.fillStyle = 'rgba(255,220,100,0.55)'
          ctx.fillRect(leftX + fullW - hlW - 8, y - 55, hlW + 16, 110)
        }

        // 第三行前2-3个字加蓝色高亮色块
        if (i === 2 && line.length >= 2) {
          const hlChars = line.slice(0, 3)
          const hlW = ctx.measureText(hlChars).width
          ctx.fillStyle = 'rgba(170,210,235,0.55)'
          ctx.fillRect(leftX - 8, y - 55, hlW + 16, 110)
        }

        ctx.fillStyle = '#2A2A2A'
        ctx.fillText(line, leftX, y)
      })

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#8A7A9A'
        ctx.textAlign = 'left'
        fitFontSize(ctx, data.subtitle, w - 220, 56, 30, `500 56px ${F}`)
        ctx.fillText(data.subtitle, leftX, startY + blockH + 55)
      }

      // 右下角短横线装饰
      ctx.strokeStyle = 'rgba(100,80,120,0.4)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(w - 160, h - 120)
      ctx.lineTo(w - 100, h - 120)
      ctx.stroke()
    },
  },

  // ===== 22. 手持撕纸绿植风 =====
  {
    id: 'torn_paper_green',
    name: '手持撕纸绿植风',
    desc: '实拍手持撕纸绿植背景+白色粗标题+白色副标题（左对齐）',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI

      // === 1. 绘制实拍背景图（放大+上移，纸片占比更大，手裁掉更多） ===
      const bgImg = getCachedImage('torn_paper_green_v2')
      if (bgImg) {
        const imgW = bgImg.width
        const imgH = bgImg.height
        // 额外放大1.3倍，让纸片视觉更大
        const baseScale = Math.max(w / imgW, h / imgH)
        const scale = baseScale * 1.3
        const drawW = imgW * scale
        const drawH = imgH * scale
        // 水平居中，垂直往上偏移（纸片上移，手被裁掉）
        const offsetX = (w - drawW) / 2
        const offsetY = -drawH * 0.12  // 上移12%，适度裁掉底部的手
        ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH)
      } else {
        const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.3, 100, w * 0.5, h * 0.5, w)
        bgGrad.addColorStop(0, '#7CB342')
        bgGrad.addColorStop(0.5, '#4A8528')
        bgGrad.addColorStop(1, '#2E5A18')
        ctx.fillStyle = bgGrad
        ctx.fillRect(0, 0, w, h)
      }

      // === 2. 文字阴影增强可读性（不使用遮罩） ===

      // === 3. 主标题：白色超粗+阴影，左对齐，放在纸片上 ===
      const marginLeft = w * 0.07
      const titleY = h * 0.32
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.fillStyle = '#2D5A27'
      ctx.font = `900 110px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      const maxTitleW = w * 0.86
      const lines = smartWrap(ctx, data.title, maxTitleW)
      const lh = 138
      lines.forEach((line, i) => {
        ctx.fillText(line, marginLeft, titleY + i * lh)
      })

      // === 4. 副标题：白色偏灰，左对齐，也在纸片区域内 ===
      if (data.subtitle) {
        const subY = titleY + lines.length * lh + 20
        ctx.fillStyle = '#3A7233'
        ctx.font = `700 68px ${F}`
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        const subLines = smartWrap(ctx, data.subtitle, maxTitleW)
        const subLh = 90
        subLines.forEach((line, i) => {
          ctx.fillText(line, marginLeft, subY + i * subLh)
        })
      }
      ctx.restore()
    },
  },

  // ===== 23. 深红方格作业本风 =====
  {
    id: 'grid_notebook_red',
    name: '深红方格作业本风',
    desc: '暗红棕边框+白色方格纸+黑色粗体标题+红色副标题+钢笔装饰',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI

      // 暗红棕色底色（露出边框）
      ctx.fillStyle = '#8B4D4D'
      ctx.fillRect(0, 0, w, h)

      // 边框装饰：深红圆点间隔排列
      const dotR = 22
      const dotGap = 100
      ctx.fillStyle = '#6B3030'
      // 上边
      for (let x = dotGap; x < w - dotGap / 2; x += dotGap) {
        ctx.beginPath(); ctx.arc(x, 35, dotR, 0, Math.PI * 2); ctx.fill()
      }
      // 下边
      for (let x = dotGap; x < w - dotGap / 2; x += dotGap) {
        ctx.beginPath(); ctx.arc(x, h - 35, dotR, 0, Math.PI * 2); ctx.fill()
      }
      // 左边
      for (let y = dotGap; y < h - dotGap / 2; y += dotGap) {
        ctx.beginPath(); ctx.arc(35, y, dotR, 0, Math.PI * 2); ctx.fill()
      }
      // 右边
      for (let y = dotGap; y < h - dotGap / 2; y += dotGap) {
        ctx.beginPath(); ctx.arc(w - 35, y, dotR, 0, Math.PI * 2); ctx.fill()
      }

      // 内部白色方格纸
      const pad = 80
      ctx.fillStyle = '#FAFAFA'
      roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 12)
      ctx.fill()

      // 方格线
      const gs = 44
      ctx.strokeStyle = 'rgba(200,200,210,0.4)'
      ctx.lineWidth = 1
      for (let x = pad; x < w - pad; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke()
      }
      for (let y = pad; y < h - pad; y += gs) {
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke()
      }

      // 主标题 — 居中偏上，黑色超粗体
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 108px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - pad * 2 - 120)
      const lh = 135
      const blockH = lines.length * lh
      const startY = h * 0.28 - blockH / 2 + lh / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 红色副标题条
      if (data.subtitle) {
        const subY = startY + blockH + 50
        ctx.fillStyle = '#D44040'
        ctx.font = `900 72px ${F}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const subLines = smartWrap(ctx, data.subtitle, w - pad * 2 - 120)
        const subLh = 95
        subLines.forEach((line, i) => {
          ctx.fillText(line, w / 2, subY + i * subLh)
        })
      }

      // 右下角钢笔手绘装饰
      ctx.save()
      ctx.translate(w - 280, h - 350)
      ctx.rotate(0.6)
      // 笔杆
      ctx.fillStyle = '#F5D76E'
      ctx.beginPath()
      ctx.moveTo(-12, -160); ctx.lineTo(12, -160); ctx.lineTo(14, 80); ctx.lineTo(-14, 80)
      ctx.closePath(); ctx.fill()
      // 笔杆条纹
      ctx.fillStyle = '#E8C84A'
      ctx.fillRect(-12, -100, 24, 8)
      ctx.fillRect(-12, -70, 24, 8)
      // 握笔处
      ctx.fillStyle = '#D4A843'
      ctx.beginPath()
      ctx.moveTo(-14, 80); ctx.lineTo(14, 80); ctx.lineTo(10, 120); ctx.lineTo(-10, 120)
      ctx.closePath(); ctx.fill()
      // 笔尖
      ctx.fillStyle = '#555'
      ctx.beginPath()
      ctx.moveTo(-10, 120); ctx.lineTo(10, 120); ctx.lineTo(0, 160)
      ctx.closePath(); ctx.fill()
      ctx.restore()

      // 手部轮廓（简化版，模拟握笔手势）
      ctx.save()
      ctx.translate(w - 200, h - 220)
      ctx.fillStyle = '#F5C6A0'
      // 手掌
      ctx.beginPath()
      ctx.ellipse(0, 0, 90, 70, 0.2, 0, Math.PI * 2)
      ctx.fill()
      // 手指
      ctx.beginPath()
      ctx.ellipse(-50, -60, 25, 55, -0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(-10, -75, 22, 50, -0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(35, -65, 22, 45, 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // 左下角"电子版资料"标签
      ctx.fillStyle = '#333'
      ctx.font = `500 52px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText('电子版资料', pad + 40, h - pad - 40)
    },
  },

  // ===== 24. 网感标题浏览器风 — 格子底+浏览器框+绿色涂抹+🧐emoji =====
  {
    id: 'browser_emoji_grid',
    name: '网感标题浏览器风',
    desc: '格子底+浏览器外框+红绿黄圆点+绿色涂抹高亮+🧐emoji',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 浅灰格子背景
      ctx.fillStyle = '#F5F5F5'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(200,200,200,0.25)'
      ctx.lineWidth = 1
      const gs = 42
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 浏览器窗口
      const fX = 55, fY = 55, fW = w - 110, fH = h - 110
      ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, fX, fY, fW, fH, 22); ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 2.5
      roundRect(ctx, fX, fY, fW, fH, 22); ctx.stroke()

      // 顶栏
      ctx.fillStyle = '#FAFAFA'
      roundRectTop(ctx, fX, fY, fW, 88, 22); ctx.fill()
      ctx.strokeStyle = '#E8E8E8'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(fX, fY + 88); ctx.lineTo(fX + fW, fY + 88); ctx.stroke()
      const dotColors = ['#FF5F57', '#FFBD2E', '#28C840']
      dotColors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.beginPath(); ctx.arc(fX + 52 + i * 44, fY + 44, 14, 0, Math.PI * 2); ctx.fill()
      })

      // 🧐 emoji 右上角
      ctx.font = '100px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('🧐', fX + fW - 100, fY + 200)

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 115px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, fW - 200)
      const lh = 150
      const blockH = lines.length * lh
      const startY = fY + 88 + (fH - 88) / 2 - blockH / 2 - 20

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 第二行绿色涂抹高亮
        if (i === 1) {
          const tw = ctx.measureText(line).width
          ctx.fillStyle = 'rgba(180,230,80,0.4)'
          ctx.fillRect(w / 2 - tw / 2 - 12, y - 50, tw + 24, 105)
          ctx.fillStyle = 'rgba(160,215,60,0.25)'
          ctx.fillRect(w / 2 - tw / 2 - 6, y - 44, tw + 12, 92)
        }
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#888'
        fitFontSize(ctx, data.subtitle, fW - 200, 52, 30, `700 52px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 30)
      }

      // 底部标签
      const bottomY = fY + fH - 50
      ctx.fillStyle = '#BBB'
      ctx.font = `500 36px ${F}`
      ctx.textAlign = 'left'; ctx.fillText('BIAOTI', fX + 70, bottomY)
      ctx.textAlign = 'right'; ctx.fillText('⊙  MOBAN', fX + fW - 70, bottomY)
      ctx.strokeStyle = '#EEEEEE'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(fX + 50, bottomY - 30); ctx.lineTo(fX + fW - 50, bottomY - 30); ctx.stroke()
    },
  },

  // ===== 25. 橙框撕纸教资风 — 橙色锯齿边框+⚠️标签+红色涂抹+👆手势 =====
  {
    id: 'orange_torn_exam',
    name: '橙框撕纸教资风',
    desc: '橙色锯齿边框+撕纸效果+⚠️标签+红色涂抹高亮+👆点击手势',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 橙色边框背景
      ctx.fillStyle = '#E87A30'
      ctx.fillRect(0, 0, w, h)

      // 顶部锯齿装饰（模拟撕纸）
      const dotR = 16
      const dotGap = 58
      ctx.fillStyle = '#D06828'
      for (let x = dotGap / 2; x < w; x += dotGap) {
        ctx.beginPath(); ctx.arc(x, 30, dotR, 0, Math.PI * 2); ctx.fill()
      }

      // 内部白色纸张
      const pad = 55
      ctx.fillStyle = '#FFF8F0'
      roundRect(ctx, pad, 70, w - pad * 2, h - 70 - pad, 8)
      ctx.fill()

      // 撕纸底部锯齿
      ctx.fillStyle = '#FFF8F0'
      ctx.beginPath()
      ctx.moveTo(pad, h - pad)
      for (let x = pad; x < w - pad; x += 20) {
        ctx.lineTo(x + 10, h - pad + 6 + Math.random() * 8)
        ctx.lineTo(x + 20, h - pad)
      }
      ctx.lineTo(w - pad, h - pad)
      ctx.closePath()
      ctx.fill()

      // ⚠️ 标签（左上角）
      ctx.font = '90px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('⚠️', pad + 40, 170)

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 120px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 155
      const blockH = lines.length * lh
      const startY = h * 0.36 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 第二行加红色涂抹高亮
        if (i === 1) {
          const tw = ctx.measureText(line).width
          ctx.fillStyle = 'rgba(220,60,40,0.75)'
          roundRect(ctx, w / 2 - tw / 2 - 15, y - 60, tw + 30, 120, 8)
          ctx.fill()
          ctx.fillStyle = '#FFFFFF'
          ctx.fillText(line, w / 2, y)
        } else {
          ctx.fillStyle = '#1A1A1A'
          ctx.fillText(line, w / 2, y)
        }
      })

      // 黄色椭圆圈重点（第一行末尾关键词）
      if (lines.length >= 1) {
        const fl = lines[0]
        if (fl.length >= 2) {
          const hlChars = fl.slice(-3)
          const fullW = ctx.measureText(fl).width
          const hlW = ctx.measureText(hlChars).width
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 6
          ctx.beginPath()
          ctx.ellipse(w / 2 + fullW / 2 - hlW / 2, startY, hlW / 2 + 20, 65, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#666'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `700 56px ${F}`)
        ctx.textAlign = 'center'
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }

      // 右下角 👆 点击手势
      ctx.font = '130px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('👆', w - 200, h - 250)
    },
  },

  // ===== 26. 收藏震惊emoji风 — 浅灰纹理+橙色椭圆圈+虚线箭头+😱emoji =====
  {
    id: 'collect_shock_emoji',
    name: '收藏震惊emoji风',
    desc: '浅灰纹理底+橙色椭圆圈重点+虚线箭头+😱震惊emoji+💎装饰',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 浅灰纹理背景
      ctx.fillStyle = '#F2F0ED'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(0,0,0,0.008)'
      for (let i = 0; i < 300; i++) {
        const px = Math.random() * w, py = Math.random() * h
        ctx.fillRect(px, py, 2 + Math.random() * 2, 2 + Math.random() * 2)
      }

      // 左上角虚线箭头装饰
      ctx.save()
      ctx.translate(120, 200)
      ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(40, 60, 80, 40)
      ctx.stroke()
      ctx.setLineDash([])
      // 箭头
      ctx.fillStyle = '#555'
      ctx.beginPath(); ctx.moveTo(75, 30); ctx.lineTo(90, 45); ctx.lineTo(70, 48); ctx.closePath(); ctx.fill()
      ctx.restore()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 130px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 175
      const blockH = lines.length * lh
      const startY = h * 0.35 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第二行加橙色椭圆圈
      if (lines.length >= 2) {
        const hlLine = lines[1]
        const hlY = startY + lh
        const hlW = ctx.measureText(hlLine).width
        ctx.strokeStyle = '#E8890E'; ctx.lineWidth = 7
        ctx.beginPath()
        ctx.ellipse(w / 2, hlY, hlW / 2 + 40, 80, -0.03, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#777'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 45)
      }

      // 💎 装饰
      ctx.font = '52px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('💎', w / 2 - 30, startY + blockH + 140)

      // 底部 😱 震惊emoji
      ctx.font = '160px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('😱', w / 2 + 60, h - 280)
    },
  },

  // ===== 27. 备忘录涂鸦风 — 备忘录+手写涂鸦+波浪线+黄色闪光+红色装饰 =====
  {
    id: 'memo_doodle',
    name: '备忘录涂鸦风',
    desc: '白底+备忘录导航+黄色闪光+红色波浪线+蓝色手写涂鸦装饰',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 白底
      ctx.fillStyle = '#FEFEFE'
      ctx.fillRect(0, 0, w, h)

      // 备忘录顶栏
      ctx.fillStyle = '#888'
      ctx.font = `400 38px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('< 备忘录', 50, 65)
      ctx.textAlign = 'right'
      ctx.font = '36px sans-serif'
      ctx.fillText('✎  ⇧  ···', w - 55, 65)

      // 左上角黄色闪光/星星装饰
      ctx.save()
      ctx.translate(140, 200)
      ctx.fillStyle = '#FFD700'
      // 四角星
      ctx.beginPath()
      ctx.moveTo(0, -30); ctx.lineTo(8, -8); ctx.lineTo(30, 0); ctx.lineTo(8, 8)
      ctx.lineTo(0, 30); ctx.lineTo(-8, 8); ctx.lineTo(-30, 0); ctx.lineTo(-8, -8)
      ctx.closePath(); ctx.fill()
      // 小星星
      ctx.beginPath()
      ctx.moveTo(45, -20); ctx.lineTo(49, -10); ctx.lineTo(60, -8); ctx.lineTo(49, -4)
      ctx.lineTo(45, 8); ctx.lineTo(41, -4); ctx.lineTo(30, -8); ctx.lineTo(41, -10)
      ctx.closePath(); ctx.fill()
      ctx.restore()

      // 主标题 — 居中超粗（模拟手写效果字体偏大）
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 135px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 175
      const blockH = lines.length * lh
      const startY = h * 0.30 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第一行底部红色波浪线
      if (lines.length >= 1) {
        const tw = ctx.measureText(lines[0]).width
        ctx.strokeStyle = '#E03030'; ctx.lineWidth = 8
        drawWavyLine(ctx, w / 2 - tw / 2, startY + 75, tw)
      }

      // 右上角红色三角装饰
      ctx.fillStyle = '#E03030'
      ctx.save()
      ctx.translate(w - 160, 250)
      ctx.beginPath()
      ctx.moveTo(0, 0); ctx.lineTo(35, 30); ctx.lineTo(-5, 30); ctx.closePath()
      ctx.fill()
      ctx.restore()

      // 副标题 — 橙色大字，带黄色椭圆圈
      if (data.subtitle) {
        const subY = startY + blockH + 30
        ctx.fillStyle = '#C88A20'
        fitFontSize(ctx, data.subtitle, w - 200, 120, 55, `900 120px ${F}`)
        const tw = ctx.measureText(data.subtitle).width

        // 黄色椭圆圈关键词
        ctx.strokeStyle = '#E8B830'; ctx.lineWidth = 5
        ctx.beginPath()
        ctx.ellipse(w / 2, subY, tw / 2 + 30, 65, 0, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillText(data.subtitle, w / 2, subY)
      }

      // 底部装饰：红色小星+蓝色旋转箭头
      ctx.fillStyle = '#E03030'
      ctx.font = '28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('✦', 130, h * 0.72)
      ctx.fillText('✦', w - 130, h * 0.85)

      // 底部蓝色旋转箭头
      ctx.save()
      ctx.translate(w - 160, h - 250)
      ctx.strokeStyle = '#E03030'; ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(0, 0, 30, 0.5, Math.PI * 1.7); ctx.stroke()
      ctx.fillStyle = '#E03030'
      ctx.beginPath(); ctx.moveTo(-22, 20); ctx.lineTo(-35, 5); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill()
      ctx.restore()
      ctx.lineCap = 'butt'
    },
  },

  // ===== 28. 蓝色笔记便签风 — 浅蓝底+横线+黄色便签标签+绿波浪线+👍手势 =====
  {
    id: 'blue_note_sticky',
    name: '蓝色笔记便签风',
    desc: '浅蓝底+横线+圆点装饰+黄色便签标签+绿色波浪线+👍手势',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 浅蓝背景
      ctx.fillStyle = '#E4F0FA'
      ctx.fillRect(0, 0, w, h)

      // 顶部圆点装饰行
      const dotStartX = 70
      const dotSpacing = 54
      for (let i = 0; i < Math.floor((w - 140) / dotSpacing); i++) {
        ctx.fillStyle = '#C0D8F0'
        ctx.beginPath(); ctx.arc(dotStartX + i * dotSpacing, 45, 10, 0, Math.PI * 2); ctx.fill()
      }

      // 横线
      ctx.strokeStyle = 'rgba(180,210,240,0.5)'
      ctx.lineWidth = 1.5
      for (let y = 100; y < h - 60; y += 60) {
        ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(w - 50, y); ctx.stroke()
      }

      // 红绿黄圆点（左上）
      const tDotColors = ['#FF5F57', '#FFBD2E', '#28C840']
      tDotColors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.beginPath(); ctx.arc(80 + i * 44, 110, 14, 0, Math.PI * 2); ctx.fill()
      })

      // 右上角图标
      ctx.fillStyle = '#AAA'
      ctx.font = '38px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText('ⓘ  ☆', w - 70, 110)

      // 黄色便签标签（左上方 ❗）
      ctx.fillStyle = '#FFD700'
      roundRect(ctx, 70, 160, 90, 90, 6)
      ctx.fill()
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 60px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('!', 115, 205)

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 115px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 145
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第一行底部绿色波浪线
      if (lines.length >= 1) {
        const tw = ctx.measureText(lines[0]).width
        ctx.strokeStyle = '#60D0A0'; ctx.lineWidth = 8
        drawWavyLine(ctx, w / 2 - tw / 2, startY + 68, tw)
      }

      // 最后一行粉色高亮
      if (lines.length >= 2) {
        const lastLine = lines[lines.length - 1]
        const lastY = startY + (lines.length - 1) * lh
        const tw = ctx.measureText(lastLine).width
        ctx.fillStyle = 'rgba(255,160,200,0.35)'
        ctx.fillRect(w / 2 - tw / 2 - 10, lastY - 50, tw + 20, 105)
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(lastLine, w / 2, lastY)
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#666'
        fitFontSize(ctx, data.subtitle, w - 200, 52, 30, `500 52px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 40)
      }

      // 右下角 👍 手势
      ctx.font = '120px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('👍', w - 180, h - 280)

      // 省略号
      ctx.fillStyle = '#999'
      ctx.font = '52px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('···', w - 70, h - 100)
    },
  },

  // ===== 29. 图钉白纸Good风 — 微倾斜白纸+图钉+黄色圆圈高亮+Good气泡+👍 =====
  {
    id: 'pin_paper_good',
    name: '图钉白纸Good风',
    desc: '灰底微倾斜白纸+红色图钉+黄色圆圈高亮+Good!!气泡+👍手势',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 浅灰背景（模拟格子底）
      ctx.fillStyle = '#F0F0F0'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(200,200,200,0.2)'
      ctx.lineWidth = 1
      const gs = 40
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 微倾斜白纸
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-0.03)
      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 35; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, -520, -680, 1040, 1360, 8)
      ctx.fill()
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
      ctx.restore()

      // 右上角红色图钉
      ctx.fillStyle = '#D03030'
      ctx.beginPath(); ctx.arc(w - 200, 140, 22, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#A02020'
      ctx.beginPath(); ctx.arc(w - 200, 140, 10, 0, Math.PI * 2); ctx.fill()
      // 图钉阴影
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.beginPath(); ctx.ellipse(w - 195, 165, 18, 6, 0.1, 0, Math.PI * 2); ctx.fill()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 135px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 260)
      const lh = 175
      const blockH = lines.length * lh
      const startY = h * 0.34 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第一行某个关键词加黄色圆圈高亮
      if (lines.length >= 1) {
        const fl = lines[0]
        if (fl.length >= 2) {
          const hlChar = fl.slice(-1)
          const fullW = ctx.measureText(fl).width
          const hlW = ctx.measureText(hlChar).width
          const cx = w / 2 + fullW / 2 - hlW / 2
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 10
          ctx.beginPath(); ctx.arc(cx, startY, 80, 0, Math.PI * 2); ctx.stroke()
          ctx.fillStyle = 'rgba(255,215,0,0.2)'
          ctx.beginPath(); ctx.arc(cx, startY, 78, 0, Math.PI * 2); ctx.fill()
          // 重绘
          ctx.fillStyle = '#1A1A1A'
          ctx.font = `900 135px ${F}`
          ctx.fillText(fl, w / 2, startY)
        }
      }

      // 最后一行黄色波浪下划线
      if (lines.length >= 2) {
        const lastLine = lines[lines.length - 1]
        const lastY = startY + (lines.length - 1) * lh
        const tw = ctx.measureText(lastLine).width
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 8
        drawWavyLine(ctx, w / 2 - tw / 2, lastY + 70, tw)
      }

      // Good!! 气泡
      ctx.save()
      ctx.translate(w - 250, startY - 30)
      ctx.fillStyle = '#FFD700'
      roundRect(ctx, 0, 0, 170, 65, 32)
      ctx.fill()
      // 气泡小三角
      ctx.beginPath(); ctx.moveTo(30, 65); ctx.lineTo(10, 90); ctx.lineTo(55, 65); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#E03030'
      ctx.font = `900 36px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('Good!!', 85, 33)
      ctx.restore()

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#555'
        fitFontSize(ctx, data.subtitle, w - 260, 56, 30, `700 56px ${F}`)
        ctx.textAlign = 'center'
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }

      // 右下角 👍 手势
      ctx.font = '120px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('👍', w - 200, h - 280)

      // 左下角红色图钉（小）
      ctx.fillStyle = '#D03030'
      ctx.beginPath(); ctx.arc(170, 180, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#A02020'
      ctx.beginPath(); ctx.arc(170, 180, 8, 0, Math.PI * 2); ctx.fill()
    },
  },

  // ===== 30. 暖黄猫咪秘诀风 — 暖黄底+粉色下划线高亮+🐱猫咪装饰+顶部图标 =====
  {
    id: 'warm_cat_secret',
    name: '暖黄猫咪秘诀风',
    desc: '暖黄底+粉色横条高亮+超粗黑字+🐱猫咪装饰+顶部ⓘ☆图标',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 暖黄背景
      ctx.fillStyle = '#FDF5E6'
      ctx.fillRect(0, 0, w, h)

      // 右上角图标
      ctx.fillStyle = '#CCC'
      ctx.font = '42px sans-serif'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText('ⓘ  ☆', w - 70, 80)

      // 主标题 — 居中超粗
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 135px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 180
      const blockH = lines.length * lh
      const startY = h * 0.30 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 偶数行（第2、4行）加粉色横条高亮
        if (i % 2 === 1) {
          const tw = ctx.measureText(line).width
          ctx.fillStyle = 'rgba(240,180,180,0.4)'
          ctx.fillRect(w / 2 - tw / 2 - 15, y - 55, tw + 30, 115)
        }
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#888'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `500 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }

      // 底部猫咪装饰（简笔画猫）
      ctx.save()
      ctx.translate(w / 2, h - 340)
      ctx.strokeStyle = '#C0A090'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.fillStyle = '#F5EDE5'
      // 猫身（篮子形状）
      ctx.beginPath()
      ctx.ellipse(0, 40, 100, 60, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      // 篮子纹理线
      ctx.strokeStyle = 'rgba(192,160,144,0.4)'; ctx.lineWidth = 2
      for (let i = -80; i <= 80; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 10); ctx.lineTo(i, 70); ctx.stroke()
      }
      ctx.strokeStyle = '#C0A090'; ctx.lineWidth = 5
      // 猫头
      ctx.fillStyle = '#F5EDE5'
      ctx.beginPath(); ctx.arc(0, -20, 55, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      // 猫耳
      ctx.fillStyle = '#F5EDE5'
      ctx.beginPath(); ctx.moveTo(-45, -50); ctx.lineTo(-35, -95); ctx.lineTo(-10, -55); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(45, -50); ctx.lineTo(35, -95); ctx.lineTo(10, -55); ctx.closePath(); ctx.fill(); ctx.stroke()
      // 粉色耳内
      ctx.fillStyle = '#F0C0C0'
      ctx.beginPath(); ctx.moveTo(-40, -55); ctx.lineTo(-33, -85); ctx.lineTo(-15, -58); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(40, -55); ctx.lineTo(33, -85); ctx.lineTo(15, -58); ctx.closePath(); ctx.fill()
      // 闭眼
      ctx.strokeStyle = '#A08070'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(-18, -15, 12, 0.2, Math.PI - 0.2); ctx.stroke()
      ctx.beginPath(); ctx.arc(18, -15, 12, 0.2, Math.PI - 0.2); ctx.stroke()
      // 小嘴
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-6, 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(6, 2); ctx.stroke()
      // 腮红
      ctx.fillStyle = 'rgba(240,170,170,0.35)'
      ctx.beginPath(); ctx.arc(-35, -5, 12, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(35, -5, 12, 0, Math.PI * 2); ctx.fill()
      // 💕
      ctx.font = '32px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('💕', 55, -55)
      ctx.restore()
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
    },
  },

  // ===== 31. 喇叭公告橙色风 — 白底+橙色放射装饰+蓝色椭圆圈+📢喇叭emoji =====
  {
    id: 'megaphone_orange',
    name: '喇叭公告橙色风',
    desc: '白底+橙色放射线装饰+蓝色椭圆圈标题+超粗黑字+📢喇叭emoji',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 白色微纹理背景
      ctx.fillStyle = '#F8F6F4'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(0,0,0,0.01)'
      for (let i = 0; i < 200; i++) {
        const px = Math.random() * w, py = Math.random() * h
        ctx.fillRect(px, py, 2 + Math.random() * 2, 2 + Math.random() * 2)
      }

      // 左上角橙色放射线装饰
      ctx.save()
      ctx.translate(120, 200)
      ctx.fillStyle = '#F08030'
      for (let i = 0; i < 6; i++) {
        ctx.save()
        ctx.rotate(-0.8 + i * 0.32)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -70); ctx.lineTo(12, -70); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.restore()

      // 主标题
      ctx.fillStyle = '#1A1A1A'
      ctx.font = `900 130px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 170
      const blockH = lines.length * lh
      const startY = h * 0.32 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        ctx.fillStyle = '#1A1A1A'
        ctx.fillText(line, w / 2, y)
      })

      // 第二行蓝色椭圆圈高亮
      if (lines.length >= 2) {
        const hlLine = lines[1]
        const hlY = startY + lh
        const hlW = ctx.measureText(hlLine).width
        ctx.strokeStyle = '#5BA0D0'; ctx.lineWidth = 6
        ctx.beginPath()
        ctx.ellipse(w / 2, hlY, hlW / 2 + 35, 75, -0.02, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 副标题
      if (data.subtitle) {
        ctx.fillStyle = '#666'
        fitFontSize(ctx, data.subtitle, w - 200, 56, 30, `700 56px ${F}`)
        ctx.fillText(data.subtitle, w / 2, startY + blockH + 50)
      }

      // 📢 喇叭emoji（右下角）
      ctx.font = '160px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('📢', w - 220, h - 300)
    },
  },

  // ===== 32. 日记本吐槽风 — 日记本框+💢emoji+红色涂抹+😤emoji =====
  {
    id: 'diary_rant',
    name: '日记本吐槽风',
    desc: '日记本窗口框+💢愤怒emoji+红色涂抹高亮+😤吐槽emoji+描边大字',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 暖白背景
      ctx.fillStyle = '#FAF6F0'
      ctx.fillRect(0, 0, w, h)

      // 日记本窗口顶栏
      ctx.fillStyle = '#F0F0F0'
      ctx.fillRect(0, 0, w, 80)
      // 关闭/最小化/全屏圆点
      const dColors = ['#FF5F57', '#FFBD2E', '#28C840']
      dColors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.beginPath(); ctx.arc(50 + i * 38, 40, 12, 0, Math.PI * 2); ctx.fill()
      })
      // 顶栏图标
      ctx.fillStyle = '#999'
      ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('☰  ⊞  ☷  ☐', w / 2, 40)
      ctx.textAlign = 'right'
      ctx.fillText('···  +', w - 50, 40)
      ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(w, 80); ctx.stroke()

      // 顶部导航文字
      ctx.fillStyle = '#999'
      ctx.font = `300 28px ${F}`
      ctx.textAlign = 'left'
      ctx.fillText('That year today...', 60, 120)

      // 💢 emoji（左上角）
      ctx.font = '80px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('💢', 60, 230)

      // 主标题 — 描边风格超粗大字
      ctx.font = `900 130px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 200)
      const lh = 170
      const blockH = lines.length * lh
      const startY = h * 0.38 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 第一行关键词红色涂抹高亮
        if (i === 0 && line.length >= 2) {
          const hlChars = line.slice(2, 4) || line.slice(-2)
          const beforeChars = line.slice(0, 2)
          const beforeW = ctx.measureText(beforeChars).width
          const hlW = ctx.measureText(hlChars).width
          const lineFullW = ctx.measureText(line).width
          const lineStartX = w / 2 - lineFullW / 2
          ctx.fillStyle = 'rgba(230,80,80,0.45)'
          roundRect(ctx, lineStartX + beforeW - 8, y - 58, hlW + 16, 120, 12)
          ctx.fill()
        }
        // 描边效果：先画白色描边再画蓝灰色填充
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 18; ctx.lineJoin = 'round'
        ctx.strokeText(line, w / 2, y)
        ctx.fillStyle = '#5A7A9A'
        ctx.fillText(line, w / 2, y)
      })
      ctx.lineJoin = 'miter'

      // 😤 emoji（右下角）
      ctx.font = '130px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('😤', w / 2 + 60, h - 280)

      // 底部标签
      ctx.fillStyle = '#BBB'
      ctx.font = `400 30px ${F}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText('Diary', 50, h - 40)
      ctx.textAlign = 'right'
      ctx.font = '32px sans-serif'
      ctx.fillText('✎  🔗  Aa', w - 50, h - 40)
    },
  },

  // ===== 33. 可爱文具气泡风 — 格子底+蓝色气泡框+文具贴纸+绘本装饰 =====
  {
    id: 'cute_bubble_stationery',
    name: '可爱文具气泡风',
    desc: '格子底+蓝色气泡对话框+彩色文具贴纸装饰+可爱字体',
    render: (ctx, w, h, data) => {
      const F = FONTS.HEITI
      // 暖黄格子背景
      ctx.fillStyle = '#FDF8ED'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(210,200,170,0.3)'
      ctx.lineWidth = 1
      const gs = 42
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // 蓝色对话气泡框
      ctx.save()
      ctx.fillStyle = '#D4EEFF'
      ctx.strokeStyle = '#6BB8E8'; ctx.lineWidth = 6
      // 主气泡框
      const bx = 80, by = 250, bw = w - 160, bh = h - 480
      roundRect(ctx, bx, by, bw, bh, 50)
      ctx.fill()
      roundRect(ctx, bx, by, bw, bh, 50)
      ctx.stroke()
      ctx.restore()

      // 顶部文具贴纸装饰
      // 绿色三角夹子
      ctx.save()
      ctx.translate(w / 2 - 80, by - 20)
      ctx.fillStyle = '#60C060'
      ctx.beginPath()
      ctx.moveTo(0, 0); ctx.lineTo(40, -50); ctx.lineTo(80, 0)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#40A040'; ctx.lineWidth = 3
      ctx.stroke()
      // 小表情
      ctx.fillStyle = '#3A8A3A'
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('😊', 40, -18)
      ctx.restore()

      // 右上角奶瓶贴纸
      ctx.save()
      ctx.translate(w - 160, by - 10)
      ctx.fillStyle = '#E8D8C8'
      roundRect(ctx, 0, 0, 70, 85, 12)
      ctx.fill()
      ctx.strokeStyle = '#C8B8A8'; ctx.lineWidth = 3
      roundRect(ctx, 0, 0, 70, 85, 12)
      ctx.stroke()
      // 瓶盖
      ctx.fillStyle = '#A8D8F0'
      roundRect(ctx, 15, -20, 40, 25, 6)
      ctx.fill()
      // 标签线
      ctx.strokeStyle = '#CCC'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(15, 40); ctx.lineTo(55, 40); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(15, 55); ctx.lineTo(55, 55); ctx.stroke()
      ctx.restore()

      // 大括号装饰（蓝色）—— 关键词两侧
      // 使用蓝色粗括号标识

      // 主标题 — 居中
      ctx.fillStyle = '#3A5A7A'
      ctx.font = `900 115px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, bw - 120)
      const lh = 155
      const blockH = lines.length * lh
      const startY = by + bh / 2 - blockH / 2

      lines.forEach((line, i) => {
        const y = startY + i * lh
        // 第二行加蓝色大括号 { }
        if (i === 1) {
          const tw = ctx.measureText(line).width
          ctx.fillStyle = '#6BB8E8'
          ctx.font = `900 140px ${F}`
          ctx.fillText('{', w / 2 - tw / 2 - 55, y)
          ctx.fillText('}', w / 2 + tw / 2 + 55, y)
          ctx.font = `900 115px ${F}`
          ctx.fillStyle = '#E06040'
          ctx.fillText(line, w / 2, y)
        } else {
          ctx.fillStyle = '#3A5A7A'
          ctx.fillText(line, w / 2, y)
        }
      })

      // 底部蓝色波浪线装饰
      ctx.strokeStyle = '#6BB8E8'; ctx.lineWidth = 5
      drawWavyLine(ctx, bx + 60, by + bh - 60, bw - 120)

      // 右下角绿色书本贴纸
      ctx.save()
      ctx.translate(w - 180, h - 200)
      ctx.fillStyle = '#A0D860'
      roundRect(ctx, 0, 0, 80, 100, 8)
      ctx.fill()
      ctx.strokeStyle = '#80B840'; ctx.lineWidth = 3
      roundRect(ctx, 0, 0, 80, 100, 8)
      ctx.stroke()
      // 书签
      ctx.fillStyle = '#D03030'
      ctx.beginPath(); ctx.moveTo(55, 0); ctx.lineTo(55, 30); ctx.lineTo(65, 20); ctx.lineTo(75, 30); ctx.lineTo(75, 0); ctx.closePath(); ctx.fill()
      // 笑脸
      ctx.fillStyle = '#5A8A2A'
      ctx.font = '22px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('😄', 40, 60)
      ctx.restore()

      // 左下角小太阳装饰
      ctx.save()
      ctx.translate(120, h - 160)
      ctx.strokeStyle = '#E8C030'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 25)
        ctx.lineTo(Math.cos(angle) * 38, Math.sin(angle) * 38)
        ctx.stroke()
      }
      ctx.restore()

      // 副标题（气泡框外，底部）
      if (data.subtitle) {
        ctx.fillStyle = '#888'
        ctx.font = `500 48px ${F}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        fitFontSize(ctx, data.subtitle, w - 200, 48, 28, `500 48px ${F}`)
        ctx.fillText(data.subtitle, w / 2, by + bh + 70)
      }
    },
  },
]

// === 辅助绘图函数 ===

// 自动缩小字号使文字不超过maxWidth，返回实际使用的字号
function fitFontSize(ctx, text, maxWidth, startSize, minSize, fontStyle) {
  let size = startSize
  ctx.font = fontStyle.replace(/\d+px/, size + 'px')
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4
    ctx.font = fontStyle.replace(/\d+px/, size + 'px')
  }
  return size
}

function smartWrap(ctx, text, maxWidth) {
  if (!text) { const r = ['']; r._scale = 1; return r }

  // 检测是否包含用户手动换行
  const hasManualBreaks = text.includes('\n')

  if (hasManualBreaks) {
    // 严格按用户 \n 分行，绝不自动断行
    const lines = text.split('\n').filter(Boolean)
    if (!lines.length) { const r = ['']; r._scale = 1; return r }

    // 检查是否有行超宽，如果有则缩小字号让所有行都能一行显示
    const currentFont = ctx.font
    const sizeMatch = currentFont.match(/(\d+)px/)
    let scale = 1
    if (sizeMatch) {
      const origSize = parseInt(sizeMatch[1])
      let fontSize = origSize
      const minSize = Math.max(Math.floor(fontSize * 0.45), 36)
      let needShrink = lines.some(line => ctx.measureText(line).width > maxWidth)
      while (needShrink && fontSize > minSize) {
        fontSize -= 2
        ctx.font = currentFont.replace(/\d+px/, fontSize + 'px')
        needShrink = lines.some(line => ctx.measureText(line).width > maxWidth)
      }
      scale = fontSize / origSize
    }
    lines._scale = scale
    return lines
  }

  // 自动换行模式
  const chars = text.split('')
  let line = ''
  const lines = []
  for (const char of chars) {
    const test = line + char
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char }
    else { line = test }
  }
  if (line) lines.push(line)
  if (!lines.length) { const r = ['']; r._scale = 1; return r }

  // 尾行均衡：如果最后一行字数不足最长行的40%，重新均匀分配
  if (lines.length >= 2) {
    const totalChars = lines.reduce((s, l) => s + l.length, 0)
    const lastLen = lines[lines.length - 1].length
    const maxLen = Math.max(...lines.map(l => l.length))
    if (lastLen < maxLen * 0.4) {
      const avgLen = Math.ceil(totalChars / lines.length)
      const fullText = lines.join('')
      const balanced = []
      let pos = 0
      while (pos < fullText.length) {
        let end = Math.min(pos + avgLen, fullText.length)
        while (end > pos + 1 && ctx.measureText(fullText.slice(pos, end)).width > maxWidth) {
          end--
        }
        balanced.push(fullText.slice(pos, end))
        pos = end
      }
      if (balanced.length) { balanced._scale = 1; return balanced }
      const r = ['']; r._scale = 1; return r
    }
  }
  lines._scale = 1
  return lines
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

function roundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h); ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

function drawWavyLine(ctx, x, y, width) {
  ctx.beginPath(); ctx.moveTo(x, y)
  const wH = 8, wW = 20
  for (let i = 0; i < width; i += wW) {
    ctx.quadraticCurveTo(x + i + wW / 4, y - wH, x + i + wW / 2, y)
    ctx.quadraticCurveTo(x + i + wW * 3 / 4, y + wH, x + i + wW, y)
  }
  ctx.stroke()
}

function drawBookIcon(ctx, x, y, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = color; ctx.lineWidth = 5
  roundRect(ctx, 0, 10, 60, 80, 6); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(10, 35); ctx.lineTo(50, 35); ctx.moveTo(10, 55); ctx.lineTo(45, 55); ctx.stroke()
  roundRect(ctx, 55, 0, 70, 90, 6); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(68, 25); ctx.lineTo(112, 25); ctx.moveTo(68, 45); ctx.lineTo(108, 45); ctx.moveTo(68, 65); ctx.lineTo(100, 65)
  ctx.stroke()
  ctx.beginPath(); ctx.moveTo(70, 90); ctx.quadraticCurveTo(50, 110, 30, 90); ctx.stroke()
  ctx.restore()
}

function drawCloudHighlight(ctx, x, y, w, h, color) {
  ctx.fillStyle = color; ctx.globalAlpha = 0.5
  const r = h / 2
  ctx.beginPath()
  ctx.arc(x + r, y + r, r, Math.PI * 0.5, Math.PI * 1.5)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 0.5)
  ctx.lineTo(x + r, y + h)
  ctx.closePath(); ctx.fill()
  ctx.globalAlpha = 1
}
