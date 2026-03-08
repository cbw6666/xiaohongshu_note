export async function callAI(settings, messages) {
  const { apiKey, endpointId, baseUrl } = settings
  if (!apiKey || !endpointId) throw new Error('请先配置 API Key 和推理接入点 ID')

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: endpointId,
      messages,
      temperature: 0.85,
      max_tokens: 2000,
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`AI 请求失败 (${resp.status}): ${err}`)
  }

  const data = await resp.json()
  return data.choices?.[0]?.message?.content || ''
}

// 默认的 system prompt 模板
export const DEFAULT_SYSTEM_PROMPT = `你是一个资深小红书带货文案专家，擅长写虚拟资料类的种草笔记。
要求：
1. 标题要有吸引力，控制在20字以内（汉字、标点符号、字母、数字各占1个位置，每个emoji占2个位置），可以适当使用emoji
2. 正文300-500字，分段清晰，多用emoji
3. 必须包含3-5个相关话题标签（#xxx）
4. 引导用户通过小红书商品链接购买，不要引导私信/加微信
5. 不要出现具体价格数字`

// 固定的输出格式指令，不暴露给用户编辑
const OUTPUT_FORMAT_INSTRUCTION = `
输出格式严格按照：
---标题---
(标题内容)
---正文---
(正文内容)
---标签---
(标签内容)
---封面主标题---
(8-18字的封面大字，用于封面图排版)
---封面副标题---
(15字以内的封面补充说明)`

// 默认的 user prompt 模板
export const DEFAULT_USER_PROMPT = `请为以下虚拟资料商品写一篇小红书带货笔记：

商品名称：{name}
商品描述：{description}
目标人群：{audience}
核心卖点：{sellingPoints}

请直接输出文案，不要有多余解释。`

// 构建爆文参考的 prompt 片段（含风格模板）
function buildReferenceSection(references, styleTemplates) {
  const hasRefs = references && references.length > 0
  const hasTemplates = styleTemplates && styleTemplates.length > 0
  if (!hasRefs && !hasTemplates) return ''

  let section = ''

  // 1. 爆文原文 + 分析结果
  if (hasRefs) {
    section += '\n\n以下是参考爆文，请深度分析每篇爆文的爆款因子（标题技巧、文案结构、情绪节奏、话题标签策略、用户心理抓手），并仿写出同样具备这些爆款因子的全新笔记。要求：\n- 文案模板和风格必须与参考爆文一致\n- 爆款因子必须全部体现\n- 但内容必须围绕目标商品，不能照搬原文\n'

    references.forEach((ref, i) => {
      section += `\n--- 参考爆文${i + 1} ---\n`
      if (ref.text) {
        section += ref.text + '\n'
      } else {
        if (ref.title) section += `标题：${ref.title}\n`
        if (ref.content) section += `正文：${ref.content}\n`
        if (ref.tags) section += `标签：${ref.tags}\n`
      }
      if (ref.analysis) {
        section += `\n--- 爆文${i + 1}的爆款因子分析 ---\n`
        section += ref.analysis + '\n'
        section += `请严格按照以上爆款因子仿写。\n`
      }
    })
  }

  // 2. 已保存的风格模板（只使用启用的，直接复用分析结果）
  const enabledTemplates = hasTemplates ? styleTemplates.filter(t => t.enabled !== false) : []
  if (enabledTemplates.length > 0) {
    section += '\n\n以下是已保存的风格模板（已分析过的爆款因子），请严格按照这些风格模板的分析结果来仿写笔记：\n'

    enabledTemplates.forEach((tpl, i) => {
      section += `\n--- 风格模板「${tpl.name}」 ---\n`
      section += tpl.analysis + '\n'
      section += `请严格按照以上风格模板仿写。\n`
    })
  }

  return section
}

// 构建 AI 分析爆文的 prompt
export function buildAnalysisPrompt(sourceText) {
  return [
    {
      role: 'system',
      content: `你是一个小红书爆款内容分析专家，擅长拆解爆文的成功因子。请用专业、结构化的方式输出分析结果，便于后续仿写使用。`,
    },
    {
      role: 'user',
      content: `请深度分析以下小红书爆文的爆款因子：

${sourceText}

请从以下维度逐一分析，每个维度给出具体的技巧总结和可复用的模式：

1. **标题技巧**：句式结构、情绪词使用、数字/emoji运用、悬念设置
2. **文案结构**：开头钩子手法、中间内容铺垫方式、结尾转化引导
3. **情绪节奏**：共鸣点设计、痛点刺激、兴奋点营造、情绪起伏曲线
4. **话题标签策略**：标签选择逻辑、流量标签与精准标签的搭配
5. **用户心理抓手**：利用了哪些用户心理（从众、稀缺、好奇、认同等）
6. **整体文案风格定义**：用一段话总结这篇爆文的写作风格（语气、人称、口语化程度、专业度等）

请直接输出分析结果，不要有多余寒暄。`,
    },
  ]
}

export function buildNotePrompt(product) {
  // 变量替换映射
  const vars = {
    name: product.name || '',
    description: product.description || '无',
    audience: product.audience || '通用',
    sellingPoints: product.sellingPoints || '内容全面，实用性强',
  }

  const replaceVars = (tpl) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

  const systemContent = replaceVars(product.customSystemPrompt || DEFAULT_SYSTEM_PROMPT) + OUTPUT_FORMAT_INSTRUCTION
  let userContent = replaceVars(product.customUserPrompt || DEFAULT_USER_PROMPT)

  // 追加爆文参考 + 风格模板（含 AI 分析结果）
  const refSection = buildReferenceSection(product.references, product.styleTemplates)
  if (refSection) {
    userContent += refSection
  }

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

export function parseNoteResponse(text) {
  const extract = (label) => {
    const reg = new RegExp(`---${label}---\\s*([\\s\\S]*?)(?=---|$)`)
    const m = text.match(reg)
    return m ? m[1].trim() : ''
  }

  return {
    title: extract('标题'),
    content: extract('正文'),
    tags: extract('标签'),
    coverTitle: extract('封面主标题'),
    coverSubtitle: extract('封面副标题'),
  }
}

// 按小红书规则计算标题字数（emoji占2位，其余占1位）
export function calcTitleLen(str) {
  let len = 0
  for (const ch of str) {
    len += ch.codePointAt(0) > 0xFFFF ? 2 : 1
  }
  return len
}

// 构建"只重新生成标题"的 prompt
export function buildRetitlePrompt(originalTitle, content, productName) {
  return [
    {
      role: 'system',
      content: `你是一个小红书标题优化专家。用户给你一个超出字数限制的标题和对应的正文内容，你需要重新写一个标题。
要求：
- 标题必须控制在20字以内（汉字、标点符号、字母、数字各占1个位置，每个emoji占2个位置）
- 保持原标题的核心意思和吸引力
- 可以适当使用emoji
- 只输出新标题，不要有任何多余的解释、引号或前缀`,
    },
    {
      role: 'user',
      content: `原标题（超出字数限制）：${originalTitle}
商品名称：${productName}
正文摘要：${content.slice(0, 200)}

请重新写一个20字以内的标题，直接输出标题内容：`,
    },
  ]
}
