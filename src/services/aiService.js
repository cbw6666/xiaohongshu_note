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
3. 必须包含恰好10个相关话题标签（#xxx），不多不少，包括流量大词标签和精准长尾标签的搭配
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

// 笔记类型定义（用于差异化轮换）
const NOTE_TYPE_INSTRUCTIONS = [
  { id: 'value', instruction: '本篇请采用「价值塑造型」写法：突出资料的稀缺性、专业性和独家性，让用户觉得"不买就亏了"。' },
  { id: 'proof', instruction: '本篇请采用「效果证明型」写法：用真实使用体验、前后对比、社会证明来增加信任感，让用户看到实际价值。' },
  { id: 'pain', instruction: '本篇请采用「痛点扎心型」写法：直击目标用户的核心痛点和焦虑，先引发强烈共鸣，再引出商品作为解决方案。' },
  { id: 'save', instruction: '本篇请采用「省钱对比型」写法：通过与其他渠道/方案的成本对比，突出性价比优势，用数据说话。' },
  { id: 'preview', instruction: '本篇请采用「内容预览型」写法：适当透露资料中的部分干货内容，展示资料的含金量，让用户产生"想要完整版"的冲动。' },
  { id: 'urgent', instruction: '本篇请采用「紧迫限时型」写法：营造稀缺感和紧迫感（如限时优惠、库存紧张、即将涨价等），催促用户尽快下单。' },
  { id: 'testimony', instruction: '本篇请采用「用户证言型」写法：以第三方视角或收集到的用户真实反馈为主体，用多位用户的评价和体验来背书商品价值。' },
  { id: 'scene', instruction: '本篇请采用「场景代入型」写法：描绘一个具体的使用场景（如通勤路上、考前冲刺、深夜自学等），让读者身临其境感受到商品的实用性。' },
  { id: 'compare', instruction: '本篇请采用「横向测评型」写法：将商品与市面上常见的替代方案进行多维度对比，客观分析优劣，突出商品的核心优势。' },
  { id: 'transform', instruction: '本篇请采用「蜕变故事型」写法：讲述一个从迷茫/焦虑到通过这份资料实现成长/逆袭的完整故事线，强调前后变化的反差感。' },
]

// 差异化写法指令池（每篇笔记随机抽取1条，增加句式和风格差异）
const WRITING_STYLE_POOL = [
  '请用第一人称真实体验口吻来写，像在跟闺蜜分享好物一样自然。',
  '请以一个提问句开头，营造悬念感，吸引用户继续往下看。',
  '请用清单/盘点的形式来写，条理清晰，方便读者快速获取信息。',
  '请用偏理性专业的语气来写，少用感叹号，多用数据和事实说话。',
  '请用讲故事的方式开头，分享一个小场景或经历，再自然过渡到商品推荐。',
  '请用"先否定再肯定"的反转手法，比如"以前我也觉得xxx没用，直到..."的句式。',
  '请用对话体/问答体来写，像在回答粉丝提问一样，增强互动感。',
  '请用总分总结构来写，开头一句话概括核心观点，中间展开论述，结尾回扣主题。',
  '请以一个让人惊讶的事实或数据开头，制造认知冲突，激发好奇心。',
  '请用"踩坑/避雷"的角度来写，先说自己踩过的坑，再推荐这个商品作为正确选择。',
  '请用「划重点/敲黑板」的老师口吻来写，语气权威但不高冷，像在给学生划考试重点。',
  '请用短句+换行的节奏来写，每句不超过15字，营造快节奏的阅读体验，适合手机竖屏浏览。',
  '请用「闺蜜安利」的语气来写，多用口语化表达如"绝了""真的会谢""姐妹们冲"，语气热情夸张。',
  '请用「理性分析+感性收尾」的双段式来写，前半段用数据和逻辑分析，后半段用情感打动。',
  '请用「自问自答」的方式来写，先抛出读者可能有的疑问，再逐一给出有说服力的解答。',
]

// 构建爆文参考的 prompt 片段（支持三维轮换）
function buildReferenceSection(references, styleTemplates, noteIndex) {
  const hasRefs = references && references.length > 0
  const hasTemplates = styleTemplates && styleTemplates.length > 0
  const enabledTemplates = hasTemplates ? styleTemplates.filter(t => t.enabled !== false) : []

  // 判断是否启用轮换模式：爆文≥3篇或启用模板≥3个时启用
  const useRotation = (noteIndex !== undefined) && ((hasRefs && references.length >= 3) || enabledTemplates.length >= 3)

  if (!hasRefs && enabledTemplates.length === 0) {
    // 即使没有爆文/模板，批量生成时也注入差异化指令
    if (noteIndex !== undefined) {
      const noteType = NOTE_TYPE_INSTRUCTIONS[noteIndex % NOTE_TYPE_INSTRUCTIONS.length]
      const writingStyle = WRITING_STYLE_POOL[noteIndex % WRITING_STYLE_POOL.length]
      return `\n\n--- 本篇写作要求 ---\n${noteType.instruction}\n${writingStyle}\n重要：本篇的文案结构、开头方式、语气风格必须与其他篇明显不同，避免套路化和模板感。\n`
    }
    return ''
  }

  let section = ''

  if (useRotation) {
    // === 轮换模式 ===

    // 维度①：风格模板轮换 — 每篇只注入1个
    if (enabledTemplates.length > 0) {
      const tplIdx = noteIndex % enabledTemplates.length
      const tpl = enabledTemplates[tplIdx]
      section += `\n\n以下是本篇笔记需要严格参照的风格模板（已分析过的爆款因子），请严格按照该模板的分析结果来仿写笔记：\n`
      section += `\n--- 风格模板「${tpl.name}」 ---\n`
      section += tpl.analysis + '\n'
      section += `请严格按照以上风格模板仿写，确保爆款因子全部体现。\n`
    }

    // 维度②：爆文参考轮换 — 每篇注入1-2篇
    if (hasRefs) {
      const primaryIdx = noteIndex % references.length
      const primaryRef = references[primaryIdx]
      // 爆文≥3篇时注入副参考
      const useSecondary = references.length >= 3
      const secondaryIdx = (noteIndex + Math.floor(references.length / 2)) % references.length
      const secondaryRef = useSecondary && secondaryIdx !== primaryIdx ? references[secondaryIdx] : null

      section += '\n\n以下是本篇的参考爆文，请深度学习其爆款因子（标题技巧、文案结构、情绪节奏、话题标签策略、用户心理抓手），并仿写出同样具备这些爆款因子的全新笔记。要求：\n- 文案模板和风格必须与参考爆文一致\n- 爆款因子必须全部体现\n- 但内容必须围绕目标商品，不能照搬原文\n'

      const refsToUse = [primaryRef]
      if (secondaryRef) refsToUse.push(secondaryRef)

      refsToUse.forEach((ref, i) => {
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
        }
      })
    }

    // 维度③：差异化指令（笔记类型 + 写法风格）
    const noteType = NOTE_TYPE_INSTRUCTIONS[noteIndex % NOTE_TYPE_INSTRUCTIONS.length]
    const writingStyle = WRITING_STYLE_POOL[noteIndex % WRITING_STYLE_POOL.length]
    section += `\n\n--- 本篇写作要求 ---\n`
    section += noteType.instruction + '\n'
    section += writingStyle + '\n'
    section += `重要：本篇的文案结构、开头方式、语气风格必须与其他篇明显不同，避免套路化和模板感。\n`

  } else {
    // === 兜底模式（爆文/模板不足3个，全量注入） ===

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

    // 2. 已保存的风格模板
    if (enabledTemplates.length > 0) {
      section += '\n\n以下是已保存的风格模板（已分析过的爆款因子），请严格按照这些风格模板的分析结果来仿写笔记：\n'

      enabledTemplates.forEach((tpl, i) => {
        section += `\n--- 风格模板「${tpl.name}」 ---\n`
        section += tpl.analysis + '\n'
        section += `请严格按照以上风格模板仿写。\n`
      })
    }

    // 即使在兜底模式下，如果有 noteIndex 也添加差异化指令
    if (noteIndex !== undefined) {
      const noteType = NOTE_TYPE_INSTRUCTIONS[noteIndex % NOTE_TYPE_INSTRUCTIONS.length]
      const writingStyle = WRITING_STYLE_POOL[noteIndex % WRITING_STYLE_POOL.length]
      section += `\n\n--- 本篇写作要求 ---\n`
      section += noteType.instruction + '\n'
      section += writingStyle + '\n'
    }
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

export function buildNotePrompt(product, options = {}) {
  const { noteIndex } = options

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

  // 追加爆文参考 + 风格模板（支持三维轮换）
  const refSection = buildReferenceSection(product.references, product.styleTemplates, noteIndex)
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

  // 标签固定保留10个（小红书上限）
  const rawTags = extract('标签')
  const limitedTags = rawTags
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .join(' ')

  return {
    title: extract('标题'),
    content: extract('正文'),
    tags: limitedTags,
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
