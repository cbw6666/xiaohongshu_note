/**
 * 笔记正文改写服务
 * 调用 AI 接口改写采集到的笔记正文，支持自定义提示词
 */
import { callAI } from './aiService.js'

const DEFAULT_REWRITE_SYSTEM = `你是一个资深小红书文案改写专家。你的任务是将给定的笔记正文改写为一篇全新的、原创的小红书笔记。

改写要求：
1. 保留原文的核心信息和卖点，但必须完全重写表达方式
2. 使用小红书真实用户的语言风格（口语化、有情感、有互动感）
3. 适当使用 emoji 表情，但不要过度
4. 可以调整段落结构，使阅读体验更好
5. 字数与原文相近（±20%以内）
6. 不要使用"首先、其次、最后"等套路化连接词
7. 不要使用"宝子、姐妹、集美"等泛滥的称呼，除非原文有
8. 确保改写后的文案读起来像真人写的，不像AI生成的

输出格式：直接输出改写后的正文，不需要任何前缀说明。`

/**
 * 改写单条笔记正文
 */
export async function rewriteContent(originalContent, settings, customPrompt = '') {
  const systemPrompt = customPrompt
    ? `${DEFAULT_REWRITE_SYSTEM}\n\n用户额外要求：${customPrompt}`
    : DEFAULT_REWRITE_SYSTEM

  const userPrompt = `请改写以下小红书笔记正文：

---
${originalContent}
---

请直接输出改写后的正文：`

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const result = await callAI(settings, messages)
    return { success: true, content: result.trim() }
  } catch (e) {
    return { success: false, error: e.message, content: originalContent }
  }
}

/**
 * 改写标题
 */
export async function rewriteTitle(originalTitle, settings) {
  const systemPrompt = `你是小红书标题改写专家。改写规则：
1. 保留核心信息，换一种表达方式
2. 标题控制在20字以内
3. 可以使用emoji增加吸引力
4. 制造好奇心或紧迫感
5. 直接输出新标题，不要任何前缀`

  const userPrompt = `改写这个标题：${originalTitle}`

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const result = await callAI(settings, messages)
    return { success: true, title: result.trim() }
  } catch (e) {
    return { success: false, error: e.message, title: originalTitle }
  }
}

/**
 * 批量改写
 */
export async function batchRewrite(notes, settings, { customPrompt = '', onProgress, signal } = {}) {
  const results = []
  for (let i = 0; i < notes.length; i++) {
    if (signal?.aborted) break

    const note = notes[i]
    const contentResult = await rewriteContent(note.content, settings, customPrompt)
    results.push({
      ...note,
      rewrittenContent: contentResult.content,
      rewriteSuccess: contentResult.success,
    })

    onProgress?.({ completed: i + 1, total: notes.length })
  }
  return results
}
