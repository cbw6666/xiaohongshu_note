/**
 * 笔记正文改写服务
 * 调用 AI 接口改写采集到的笔记正文，支持自定义提示词
 */
import { callAI } from './aiService.js'

const DEFAULT_REWRITE_SYSTEM = `你是一个资深小红书文案改写专家，同时也是电子资料类爆款文案分析专家。你的任务是将给定的笔记正文改写为一篇全新的、原创的小红书笔记，同时保留原文的爆款因子。

改写流程（内部思考，不要输出分析过程）：
第一步：分析原文正文的爆款因子
- 正文结构框架（开头钩子手法、中间铺垫逻辑、结尾转化方式）
- 情绪节奏曲线（哪里制造焦虑/共鸣、哪里给出希望、哪里营造紧迫，几个转折点）
- 用户心理抓手（偷跑心理、信息差、从众、稀缺、损失厌恶、好奇、紧迫等）
- 关键情绪词/Power Words
- 段落节奏（长短句交替、换行频率、emoji密度和位置）
- 电子资料价值展示手法（内容预览、干货透露、效果对比等）

第二步：基于分析结果改写正文
1. 必须保留原文的正文结构框架（开头钩子→中间铺垫→结尾转化的整体逻辑不变）
2. 必须保留同等或更强的情绪节奏起伏，不能把有情绪张力的文案改成平铺直叙
3. 必须保留原文的用户心理抓手类型和分布位置
4. 必须保留核心情绪词/Power Words的使用密度
5. 如果原文有内容预览/干货透露的部分，改写后也必须保留同类型的价值展示
6. 保留原文的核心信息和卖点，但必须完全重写表达方式
7. 使用小红书真实用户的语言风格（口语化、有情感、有互动感）
8. 适当使用 emoji 表情，保持与原文相近的密度和风格
9. 字数与原文相近（±20%以内）
10. 不要使用"首先、其次、最后"等套路化连接词
11. 不要使用"宝子、姐妹、集美"等泛滥的称呼，除非原文有
12. 确保改写后的文案读起来像真人写的，不像AI生成的
13. 改写后的正文中绝对不能出现引导点赞、评论、收藏、关注、转发等互动行为的词汇

--- 小红书合规要求（改写时必须严格遵守）---
9. 绝对不能使用以下违禁词/敏感词：
   - 绝对化用词：最、第一、唯一、首个、顶级、极致、绝无仅有、史上最强、全网最低、万能、100%
   - 虚假承诺词：保证、一定能、必须、肯定有效、零风险、永久、根治、秒杀一切
   - 医疗/健康类违禁词：治疗、治愈、药效、疗效、防癌、抗病、处方、医学认证（除非商品本身是合规医疗产品）
   - 诱导交易词：免费领、0元购、转发抽奖、点赞必中、关注必回
   - 引流违规词：加微信、加V、VX、私我、私信下单、站外交易
10. 不能出现虚假宣传、夸大功效或误导性表述，所有描述要真实可信
11. 不能使用「刷单」「好评返现」「虚假销量」等暗示造假的词汇
12. 不能涉及政治敏感、低俗、歧视、暴力等违规内容
13. 不能使用未经授权的品牌名称或名人姓名做虚假背书
14. 用替代表达代替违禁词，例如：
   - "最好" → "超赞"/"强烈推荐"/"亲测好用"
   - "第一" → "头部"/"非常靠前"
   - "100%有效" → "亲测有效"/"用下来感觉真的不错"
   - "保证" → "个人体验是"/"身边朋友反馈"
   - "永久" → "长期"/"持续"
15. 如果原文包含违禁词，改写时必须主动替换为合规表达

输出格式：直接输出改写后的正文，不需要任何前缀说明。`

/**
 * 改写单条笔记正文
 */
export async function rewriteContent(originalContent, settings, customPrompt = '', { productName = '' } = {}) {
  const systemPrompt = customPrompt
    ? `${DEFAULT_REWRITE_SYSTEM}\n\n用户额外要求：${customPrompt}`
    : DEFAULT_REWRITE_SYSTEM

  let userPrompt = `请改写以下小红书笔记正文：

---
${originalContent}
---`
  if (productName) {
    userPrompt += `\n\n目标商品名称：${productName}\n请确保改写后的正文围绕该商品，保留原文风格和结构。`
  }
  userPrompt += `\n请直接输出改写后的正文：`

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
 * 改写标题（增强版：结合正文和商品信息）
 */
export async function rewriteTitle(originalTitle, settings, { content = '', productName = '' } = {}) {
  const systemPrompt = `你是小红书标题改写专家，同时也是爆款标题分析专家。

改写流程（内部思考，不要输出分析过程）：
第一步：分析原标题的爆款因子
- 句式结构（反问/感叹/对比/数字/悬念/祈使/省略号留白等）
- 情绪类型和强度（好奇/焦虑/惊喜/紧迫/认同/共鸣等）
- 钩子技巧（数字钩子、痛点钩子、悬念钩子、身份钩子、利益钩子等）
- 关键情绪词/Power Words（如"后悔""绝绝子""救命""真香"等）
- 目标人群锚定方式（如"打工人""学生党""宝妈"等身份标签）

第二步：基于分析结果改写标题
1. 必须保留原标题的句式结构类型（如原标题是反问句，改写后也应是反问句或同等吸引力的句式）
2. 必须保留同等或更高的情绪强度，不能把强烈的情绪改成平淡的陈述
3. 必须保留核心钩子技巧（如原标题用了数字钩子，改写后也要有数字钩子）
4. 保留原文标题的主题方向和核心信息，换一种表达方式（改写后的标题必须和原标题说的是同一件事）
5. 标题必须控制在20字以内（汉字、标点符号、字母、数字各占1个位置，每个emoji占2个位置）
6. 可以使用emoji增加吸引力
7. 直接输出新标题，不要输出分析过程，不要任何前缀、引号或解释
8. 不能使用违禁词/敏感词（如：最、第一、唯一、顶级、保证、免费领、加微信等），用合规替代表达
9. 不能出现虚假宣传、夸大功效或误导性表述
10. 如果提供了商品名称，可以围绕商品来改写；如果没有提供商品名称，严格围绕原标题主题改写，不要引入无关内容`

  let userPrompt = `改写这个标题：${originalTitle}`
  if (productName) userPrompt += `\n商品名称：${productName}`
  if (content) userPrompt += `\n正文摘要：${content.slice(0, 200)}`

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
