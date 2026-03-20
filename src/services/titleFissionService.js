import { callAI, calcTitleLen } from './aiService.js'

// 分析爆款标题的规律和套路
export function buildAnalyzeTitlesPrompt(titles) {
  return [
    {
      role: 'system',
      content: `你是小红书顶级标题分析专家，擅长从大量爆款标题中提炼出可复用的标题公式和规律。
请用极其专业和结构化的方式输出分析结果。`,
    },
    {
      role: 'user',
      content: `以下是${titles.length}个小红书爆款标题，请深度分析它们的共同规律和爆款因子：

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请从以下维度逐一分析，务必详细、具体、可操作：

1. **句式结构类型分布**：
   - 统计各种句式的占比（反问句/感叹句/对比句/悬念句/祈使句/省略号留白/陈述句等）
   - 找出出现频率最高的3种句式

2. **钩子类型分析**：
   - 统计各类钩子的使用频率（数字钩子/痛点钩子/悬念钩子/身份钩子/利益钩子/反差钩子/紧迫钩子）
   - 找出最有效的钩子组合模式

3. **情绪策略**：
   - 主要情绪类型（好奇/焦虑/惊喜/紧迫/认同/共鸣/FOMO等）
   - 情绪强度分布（1-5分）
   - 高频 Power Words / 情绪词列表

4. **结构公式提取**：
   - 从这些标题中提炼出 5-8 个可直接复用的「标题公式」
   - 每个公式格式：公式名称 + 结构模板 + 2个标题示例
   - 例如：「身份标签+数字+利益承诺」→「{身份}必看！{数字}个{利益点}」

5. **Emoji 使用策略**：
   - emoji 的使用频率和位置规律
   - 高频 emoji 列表

6. **目标人群锚定方式**：
   - 是否用身份标签开头
   - 常见的人群定位词

请直接输出分析结果，不要寒暄。`,
    },
  ]
}

// 基于分析结果 + 产品信息裂变生成新标题
export function buildFissionPrompt(analysis, product, count = 10) {
  const productInfo = product.name
    ? `商品名称：${product.name}\n商品描述：${product.description || '无'}\n目标人群：${product.audience || '通用'}\n核心卖点：${product.sellingPoints || '内容全面，实用性强'}`
    : `主题关键词：${product.keyword || '通用'}`

  return [
    {
      role: 'system',
      content: `你是小红书爆款标题生成专家。你已经深度分析了一批爆款标题的规律，现在需要基于这些规律为指定商品/主题批量裂变生成全新的爆款标题。

核心要求：
1. 每个标题必须严格复用分析出的「标题公式」（句式结构+钩子类型+情绪强度）
2. 标题必须控制在20字以内（汉字、标点符号、字母、数字各占1位，每个emoji占2位）
3. 标题之间要有足够差异性，覆盖不同的句式和钩子组合
4. 不能使用违禁词（最、第一、唯一、保证、免费领、加微信等）
5. 可以适当使用emoji增加吸引力
6. 内容必须围绕目标商品/主题，不能照搬原标题`,
    },
    {
      role: 'user',
      content: `以下是从爆款标题中分析出的规律：

${analysis}

---

目标商品/主题信息：
${productInfo}

---

请基于以上分析出的标题公式和规律，为这个商品/主题裂变生成 ${count} 个全新的爆款标题。

要求：
1. 每个标题必须标注使用的「标题公式」名称
2. 尽量覆盖不同的公式，不要重复使用同一个
3. 每个标题都要控制在20字以内
4. 标题之间的句式、钩子、情绪风格要有明显差异

输出格式（严格遵守）：
1. [公式名称] 标题内容
2. [公式名称] 标题内容
...

请直接输出，不要有多余解释。`,
    },
  ]
}

// 解析裂变结果
export function parseFissionResult(text) {
  const lines = text.split('\n').filter(l => l.trim())
  const results = []

  for (const line of lines) {
    // 匹配格式：数字. [公式名称] 标题内容
    const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*(.+)/)
    if (match) {
      const formula = match[1].trim()
      const title = match[2].trim()
      results.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        formula,
        title,
        len: calcTitleLen(title),
        overLimit: calcTitleLen(title) > 20,
      })
    }
  }

  return results
}

// 对超限标题进行缩写优化
export async function fixOverLimitTitle(settings, title, formula) {
  const messages = [
    {
      role: 'system',
      content: `你是小红书标题优化专家。用户给你一个超出20字限制的标题，你需要在保留爆款因子的前提下缩短它。
要求：
1. 保留原标题的句式结构和钩子类型
2. 保留核心情绪词和吸引力
3. 控制在20字以内（汉字、标点、字母、数字各占1位，每个emoji占2位）
4. 只输出新标题，不要任何前缀、编号、引号或解释`,
    },
    {
      role: 'user',
      content: `原标题（使用公式「${formula}」，但超出字数）：${title}\n\n请缩写为20字以内，直接输出：`,
    },
  ]

  const result = await callAI(settings, messages)
  const newTitle = result.trim().replace(/^["「」"'\d+\.\s]+/, '').replace(/["「」"']+$/, '')
  return {
    title: newTitle,
    len: calcTitleLen(newTitle),
    overLimit: calcTitleLen(newTitle) > 20,
  }
}
