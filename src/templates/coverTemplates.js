/**
 * 20大封面模板 — 复刻稿定设计风格
 * Canvas尺寸：1242 × 1660 (3:4)
 * 每个模板使用不同字体
 */
import { FONTS } from '../utils/fontLoader.js'

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
