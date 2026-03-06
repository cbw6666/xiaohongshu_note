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
1. 标题要有吸引力，带emoji，控制在20字以内
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
(8字以内的封面大字)
---封面副标题---
(15字以内的封面补充说明)`

// 默认的 user prompt 模板
export const DEFAULT_USER_PROMPT = `请为以下虚拟资料商品写一篇小红书带货笔记：

商品名称：{name}
商品描述：{description}
目标人群：{audience}
核心卖点：{sellingPoints}

请直接输出文案，不要有多余解释。`

// 构建爆文参考的 prompt 片段
function buildReferenceSection(references) {
  if (!references || references.length === 0) return ''

  let section = '\n\n以下是参考爆文，请深度分析每篇爆文的爆款因子（标题技巧、文案结构、情绪节奏、话题标签策略、用户心理抓手），并仿写出同样具备这些爆款因子的全新笔记。要求：\n- 文案模板和风格必须与参考爆文一致\n- 爆款因子必须全部体现\n- 但内容必须围绕目标商品，不能照搬原文\n'

  references.forEach((ref, i) => {
    section += `\n--- 参考爆文${i + 1} ---\n`
    if (ref.title) section += `标题：${ref.title}\n`
    if (ref.content) section += `正文：${ref.content}\n`
    if (ref.tags) section += `标签：${ref.tags}\n`
  })

  return section
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

  // 追加爆文参考
  const refSection = buildReferenceSection(product.references)
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
