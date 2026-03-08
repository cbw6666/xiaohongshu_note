/**
 * 10大封面模板 — 复刻稿定设计风格
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
      const F = FONTS.QINGKE
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
      const F = FONTS.KUAILE
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
      ctx.font = `400 100px ${F}`
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
        fitFontSize(ctx, data.subtitle, subMaxW, 62, 36, `400 62px ${F}`)
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
      const F = FONTS.MASHAN
      const F2 = FONTS.KUAILE
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
      ctx.font = `400 115px ${F}`
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
        fitFontSize(ctx, data.subtitle, subMaxW, 56, 32, `400 56px ${F2}`)
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
      const F = FONTS.XIAOWEI
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
      ctx.font = `400 105px ${F}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const lines = smartWrap(ctx, data.title, w - 240)
      const lh = 125
      const blockH = lines.length * lh
      const startY = h * 0.34 - blockH / 2
      lines.forEach((line, i) => { ctx.fillText(line, w / 2, startY + i * lh) })

      // 副标题黄色高亮
      if (data.subtitle) {
        const subY = startY + blockH + 40
        fitFontSize(ctx, data.subtitle, w - 260, 95, 50, `400 95px ${F}`)
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
      const F = FONTS.LONGCANG
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
      ctx.font = `400 115px ${F}`
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
        fitFontSize(ctx, data.subtitle, w - 240, 56, 32, `400 56px ${F}`)
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
      const F = FONTS.SONGTI
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
