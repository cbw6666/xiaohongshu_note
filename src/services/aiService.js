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
2. 正文300-500字，必须遵循以下电子资料爆款正文结构：
   - 【开头钩子（前3行）】必须在前3行内抓住读者注意力，可选用以下钩子技巧之一（不要每篇都用同一种）：
     · 焦虑共鸣：抛出目标用户正在经历的焦虑场景，引发"说的就是我"的共鸣
     · 信息差暗示：暗示这份资料包含别人不知道的、需要花大代价才能获得的信息
     · 偷跑心理：营造"提前获取、悄悄变强"的心理暗示
     · 效果冲击：用具体的前后变化制造反差感
     · 成本对比：对比其他获取途径的高成本，凸显性价比
   - 【中间铺垫】围绕电子资料的核心价值展开，至少使用2种以下手法（根据本篇写法要求灵活组合，不要固定搭配）：
     · 内容预览：透露资料中的部分干货亮点，制造"想要完整版"的冲动
     · 效果对比：展示使用前后的具体变化
     · 成本对比：与报班/自学摸索的时间和金钱成本做对比
     · 场景描绘：描述在具体场景下使用的画面感
     · 社会证明：引用他人的使用反馈或数据
     情绪节奏要有起伏，不能平铺直叙
   - 【结尾转化引导】最后1-2行必须有明确的行动引导（引导点击商品链接购买，不要引导私信/加微信），可搭配紧迫感或互动引导
   - 分段清晰，多用emoji，善用换行和短句制造阅读节奏感
   - 融入用户心理抓手（偷跑心理、信息差、从众、稀缺、损失厌恶等，根据本篇写法灵活选用，不要每篇都堆砌所有心理抓手）
3. 必须包含恰好10个相关话题标签（#xxx），不多不少，包括流量大词标签和精准长尾标签的搭配
4. 引导用户通过小红书商品链接购买，不要引导私信/加微信
5. 不要出现具体价格数字

--- 小红书合规要求（必须严格遵守）---
6. 绝对不能使用以下违禁词/敏感词：
   - 绝对化用词：最、第一、唯一、首个、顶级、极致、绝无仅有、史上最强、全网最低、万能、100%
   - 虚假承诺词：保证、一定能、必须、肯定有效、零风险、永久、根治、秒杀一切
   - 医疗/健康类违禁词：治疗、治愈、药效、疗效、防癌、抗病、处方、医学认证（除非商品本身是合规医疗产品）
   - 诱导交易词：免费领、0元购、转发抽奖、点赞必中、关注必回
   - 引流违规词：加微信、加V、VX、私我、私信下单、站外交易
7. 不能出现虚假宣传、夸大功效或误导性表述，所有描述要真实可信
8. 不能使用「刷单」「好评返现」「虚假销量」等暗示造假的词汇
9. 不能涉及政治敏感、低俗、歧视、暴力等违规内容
10. 不能使用未经授权的品牌名称或名人姓名做虚假背书
11. 用替代表达代替违禁词，例如：
   - "最好" → "超赞"/"强烈推荐"/"亲测好用"
   - "第一" → "头部"/"非常靠前"
   - "100%有效" → "亲测有效"/"用下来感觉真的不错"
   - "保证" → "个人体验是"/"身边朋友反馈"
   - "永久" → "长期"/"持续"
12. 话题标签也必须合规，不能包含违禁词或打擦边球的标签
13. 如果用户消息中包含了参考爆文或风格模板，标题必须优先模仿参考素材的标题风格和技巧，以上爆款标题公式仅作为兜底参考

--- 去AI味专项指令（极其重要，必须严格遵守）---
14. 绝对禁止使用以下AI高频连接词和表达：
   - 连接词类：此外、值得注意的是、总而言之、与此同时、不仅如此、综上所述、毫无疑问、事实上、具体来说、换句话说
   - 强调类：至关重要、不容忽视、引人注目、令人惊叹、值得一提、显而易见、毋庸置疑
   - 总结类：总的来说、归根结底、从本质上讲、在某种程度上
   - 过渡类：让我们、接下来、首先...其次...最后、第一...第二...第三
15. 必须使用小红书真实用户的口语化表达习惯：
   - 多用短句和断句，少用长复句
   - 自然地使用语气词：啊、呀、吧、嘛、哇、呜呜、哈哈哈
   - 使用小红书流行表达：绝了、救命、yyds、真的会谢、谁懂啊、家人们、姐妹们、宝子们、蹲一个、冲鸭、爱了爱了、不允许还有人不知道
   - 适当使用不规则标点：！！！、？？？、...、～
   - 可以偶尔出现口语化的不完整句子
16. 禁止三段式/排比式结构：不要把内容工整地分成三个并列点，真人写作是随性的、跳跃的
17. 句子长短必须交替出现：不允许连续3个句子长度相似，要有3-5字的短句穿插在长句之间
18. 开头前3个字禁止使用"在当今""随着""作为"这类AI典型起手式，用更口语化的方式开头
19. 每篇文案至少包含2-3处"不完美"的真人表达痕迹，比如：
   - 口语化的夸张："真的真的超好用"、"我直接哭死"
   - 个人化语气："不是我说"、"就离谱"、"我真的栓Q"
   - 随性的表达："怎么说呢"、"就是那种"、"你们懂的"
20. 禁止在结尾使用公式化的总结句（如"总之这份资料非常值得""相信你一定会有所收获"），用更自然的口语收尾`

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
  '请用"先否定再肯定"的反转手法：先表达对某件事的负面认知或偏见，再用一个转折点引出正面体验，制造认知反转。',
  '请用对话体/问答体来写，像在回答粉丝提问一样，增强互动感。',
  '请用总分总结构来写，开头一句话概括核心观点，中间展开论述，结尾回扣主题。',
  '请以一个让人惊讶的事实或数据开头，制造认知冲突，激发好奇心。',
  '请用"踩坑/避雷"的角度来写，先说自己踩过的坑，再推荐这个商品作为正确选择。',
  '请用「划重点/敲黑板」的老师口吻来写，语气权威但不高冷，像在给学生划考试重点。',
  '请用短句+换行的节奏来写，每句不超过15字，营造快节奏的阅读体验，适合手机竖屏浏览。',
  '请用「闺蜜安利」的语气来写，多用当下流行的小红书口语化表达，语气热情夸张，像真人在兴奋地推荐好东西。',
  '请用「理性分析+感性收尾」的双段式来写，前半段用数据和逻辑分析，后半段用情感打动。',
  '请用「自问自答」的方式来写，先抛出读者可能有的疑问，再逐一给出有说服力的解答。',
  // === 以下为新增的去AI味强化写法风格 ===
  '请用「碎碎念日记体」来写，像在自己的日记本上随手记录，语序可以不那么工整，想到哪说到哪，中间可以穿插"对了""话说""突然想到"这类转折。',
  '请用「吐槽+真香」的风格来写，前半段疯狂吐槽某个痛点或之前的糟糕经历，后半段画风突变表达真香，语气要有戏剧性反差。',
  '请用「学姐/学长过来人」的口吻来写，带点过来人的经验感，语气不要太正式，像在食堂跟学弟学妹随口聊天。',
  '请用「深夜emo+治愈」的风格来写，开头带一点深夜感慨的情绪，中间过渡到发现好东西的惊喜，整体氛围从低沉到温暖。',
  '请用「懒人必看」的角度来写，强调省时省力，用"我这种懒人都能坚持""躺着就能学"这类表达，语气轻松随意。',
  '请用「打工人视角」来写，融入通勤、加班、摸鱼等打工人日常场景，语气接地气，可以适当自嘲，表达方式贴近上班族。',
  '请用「妈妈/过来人口吻」来写，像一个热心的长辈在分享经验，语气温和但坚定，多用"我跟你说""你听我的""千万别走弯路"这类表达。',
  '请用「种草日记」格式来写，按时间线记录发现→入手→使用→感受的过程，像在写产品使用日记，每个阶段的感受要有变化。',
  '请用「朋友圈吐槽体」来写，像在发一条很长的朋友圈，语气随意、断句多、有大量口语词和网络用语，可以加"哈哈哈""笑死""绝了"等语气词。',
  '请用「理工科直男/直女」风格来写，用词朴素直接，少用感叹号和夸张表达，偏好用数据和对比说明问题，但偶尔冒出一句真情实感。',
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
      section += `特别是标题——必须严格复用模板中分析出的「标题公式」（句式结构+钩子类型+情绪强度），围绕目标商品创造全新标题。\n`
      section += `特别是正文——必须严格复用模板中分析出的「正文结构公式」（开头钩子手法+情绪节奏曲线+结尾转化方式+用户心理抓手），围绕目标电子资料商品重新创作正文内容。\n`
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

      // 标题专项仿写指令
      section += `\n--- 标题仿写专项要求 ---\n`
      section += `针对参考爆文的标题，你必须：\n`
      section += `1. 拆解爆文标题使用的句式结构（反问/感叹/对比/数字/悬念/省略号留白等）和钩子类型\n`
      section += `2. 新标题必须复用相同的句式结构和钩子类型，但措辞完全围绕目标商品重新创作\n`
      section += `3. 新标题的情绪强度必须≥参考爆文标题的情绪强度\n`
      section += `4. 如果爆文标题用了数字，新标题也要用数字；如果用了反问，也要用反问\n`
      section += `5. 标题控制在20字以内\n`
      section += `注意：是模仿标题技巧和风格，不是照搬标题用词！\n`

      // 正文仿写专项要求
      section += `\n--- 正文仿写专项要求 ---\n`
      section += `针对参考爆文的正文，你必须：\n`
      section += `1. 拆解爆文正文的结构框架（开头钩子手法、中间铺垫逻辑、结尾转化方式），新正文必须复用相同的结构框架\n`
      section += `2. 分析爆文正文的情绪节奏曲线（在哪里制造焦虑/共鸣、在哪里给出希望、在哪里营造紧迫），新正文必须复刻同样的情绪起伏节奏\n`
      section += `3. 识别爆文正文使用的用户心理抓手（偷跑心理、信息差、从众、稀缺、损失厌恶等），新正文必须使用同类型的心理抓手\n`
      section += `4. 保留爆文正文的段落节奏感（长短句交替、换行频率、emoji密度和位置），不要把节奏改成平铺直叙\n`
      section += `5. 如果爆文正文有内容预览/干货透露的部分，新正文也要有同类型的价值展示设计\n`
      section += `6. 如果爆文正文有互动引导（提问、投票、评论区互动等），新正文也要有同类型的互动设计\n`
      section += `7. 正文字数与参考爆文正文字数相近（±20%以内）\n`
      section += `注意：是模仿正文的结构、节奏和技巧，不是照搬正文的用词和句子！\n`
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

      // 标题专项仿写指令
      section += `\n--- 标题仿写专项要求 ---\n`
      section += `针对参考爆文的标题，你必须：\n`
      section += `1. 拆解爆文标题使用的句式结构（反问/感叹/对比/数字/悬念/省略号留白等）和钩子类型\n`
      section += `2. 新标题必须复用相同的句式结构和钩子类型，但措辞完全围绕目标商品重新创作\n`
      section += `3. 新标题的情绪强度必须≥参考爆文标题的情绪强度\n`
      section += `4. 如果爆文标题用了数字，新标题也要用数字；如果用了反问，也要用反问\n`
      section += `5. 标题控制在20字以内\n`
      section += `注意：是模仿标题技巧和风格，不是照搬标题用词！\n`

      // 正文仿写专项要求
      section += `\n--- 正文仿写专项要求 ---\n`
      section += `针对参考爆文的正文，你必须：\n`
      section += `1. 拆解爆文正文的结构框架（开头钩子手法、中间铺垫逻辑、结尾转化方式），新正文必须复用相同的结构框架\n`
      section += `2. 分析爆文正文的情绪节奏曲线（在哪里制造焦虑/共鸣、在哪里给出希望、在哪里营造紧迫），新正文必须复刻同样的情绪起伏节奏\n`
      section += `3. 识别爆文正文使用的用户心理抓手（偷跑心理、信息差、从众、稀缺、损失厌恶等），新正文必须使用同类型的心理抓手\n`
      section += `4. 保留爆文正文的段落节奏感（长短句交替、换行频率、emoji密度和位置），不要把节奏改成平铺直叙\n`
      section += `5. 如果爆文正文有内容预览/干货透露的部分，新正文也要有同类型的价值展示设计\n`
      section += `6. 如果爆文正文有互动引导（提问、投票、评论区互动等），新正文也要有同类型的互动设计\n`
      section += `7. 正文字数与参考爆文正文字数相近（±20%以内）\n`
      section += `注意：是模仿正文的结构、节奏和技巧，不是照搬正文的用词和句子！\n`
    }

    // 2. 已保存的风格模板
    if (enabledTemplates.length > 0) {
      section += '\n\n以下是已保存的风格模板（已分析过的爆款因子），请严格按照这些风格模板的分析结果来仿写笔记：\n'

      enabledTemplates.forEach((tpl, i) => {
        section += `\n--- 风格模板「${tpl.name}」 ---\n`
        section += tpl.analysis + '\n'
        section += `请严格按照以上风格模板仿写。\n`
      })
      section += `特别是标题——必须严格复用模板中分析出的「标题公式」（句式结构+钩子类型+情绪强度），围绕目标商品创造全新标题。\n`
      section += `特别是正文——必须严格复用模板中分析出的「正文结构公式」（开头钩子手法+情绪节奏曲线+结尾转化方式+用户心理抓手），围绕目标电子资料商品重新创作正文内容。\n`
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

1. **标题技巧**（重点拆解，务必详细）：
   - 句式结构类型（反问句/感叹句/对比句/悬念句/省略号留白/祈使句等）
   - 使用的钩子类型（数字钩子/痛点钩子/悬念钩子/身份钩子/利益钩子/反差钩子/紧迫钩子）
   - 情绪类型和强度等级（1-5分）
   - Power Words / 情绪词列表
   - 目标人群锚定方式（是否用了身份标签开头等）
   - emoji 使用策略
   - 请给出一个「标题公式」总结，如：「身份标签 + 数字 + 悬念留白」
2. **正文结构**（重点拆解，务必详细）：
   - 开头钩子手法（焦虑共鸣/信息差/偷跑心理/效果冲击/痛点直击/反常识事实/悬念提问/场景带入等）
   - 中间铺垫逻辑（请具体描述段落推进逻辑，如：内容预览→使用体验→效果对比，或：痛点→省钱对比→干货展示）
   - 是否有"内容预览/干货透露"的部分？怎么做的？（这是电子资料类爆文的核心技巧）
   - 结尾转化引导方式（委婉引导点击卡片/悬念留白/紧迫感营造等）
   - 段落数量和每段大致功能
   - 请给出一个「正文结构公式」总结，如：「焦虑场景(2行) → 资料引入(1段) → 内容预览+亮点(2段) → 效果对比(1段) → 互动引导(2行)」

3. **情绪节奏**（重点拆解，务必详细）：
   - 情绪起伏曲线描述（哪里低谷、哪里高峰、几个转折点）
   - 共鸣点设计（用了什么让读者产生"说的就是我"的感觉）
   - 焦虑/痛点刺激手法（如何让读者感受到紧迫或不满）
   - 希望/惊喜营造手法（如何让读者产生"想要完整版"的冲动）
   - 情绪词/Power Words 列表
   - 请给出一个「情绪节奏公式」总结，如：「焦虑(开头) → 共鸣(第2段) → 希望(第3段) → 惊喜(第4段) → 紧迫(结尾)」

4. **用户心理抓手**（务必详细）：
   - 具体使用了哪些心理技巧（偷跑心理/信息差/从众/稀缺/损失厌恶/好奇/认同/紧迫等）
   - 每个心理抓手对应的原文语句示例
   - 心理抓手的分布位置（开头/中间/结尾）

5. **话题标签策略**：标签选择逻辑、流量标签与精准标签的搭配

6. **整体文案风格定义**：
   - 用一段话总结写作风格（语气、人称、口语化程度、专业度、句式偏好）
   - emoji 使用策略（密度、位置偏好、类型偏好）
   - 互动设计（是否有提问、投票、评论引导等）
   - 换行和分段节奏（短句为主还是长短交替、段间是否用emoji分隔等）
   - 电子资料的价值展示手法（是否有内容预览、截图描述、目录展示等）

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

// 构建"只重新生成标题"的 prompt（爆款标题版）
export function buildRetitlePrompt(originalTitle, content, productName) {
  return [
    {
      role: 'system',
      content: `你是小红书爆款标题专家。用户给你一个超出字数限制的标题和对应的正文内容，你需要重新写一个爆款标题。

改写流程（内部思考，不要输出分析过程）：
第一步：分析原标题的爆款因子
- 句式结构（反问/感叹/对比/数字/悬念/祈使/省略号留白等）
- 情绪类型和强度（好奇/焦虑/惊喜/紧迫/认同/共鸣等）
- 钩子技巧（数字钩子、痛点钩子、悬念钩子、身份钩子、利益钩子等）
- 关键情绪词/Power Words
- 目标人群锚定方式

第二步：基于分析结果缩写标题
1. 必须保留原标题的句式结构类型（如原标题是反问句，新标题也应是反问句或同等吸引力的句式）
2. 必须保留同等或更高的情绪强度，不能把强烈的情绪改成平淡的陈述
3. 必须保留核心钩子技巧（如原标题用了数字钩子，新标题也要有数字钩子）
4. 标题必须控制在20字以内（汉字、标点符号、字母、数字各占1个位置，每个emoji占2个位置）
5. 可以使用emoji增加吸引力
6. 只输出新标题，不要输出分析过程，不要任何前缀、引号或解释
7. 不能使用违禁词/敏感词（如：最、第一、唯一、顶级、保证、免费领、加微信等）`,
    },
    {
      role: 'user',
      content: `原标题（超出字数限制）：${originalTitle}
商品名称：${productName}
正文摘要：${content.slice(0, 200)}

请重新写一个20字以内的爆款标题，保留原标题的爆款因子，直接输出标题内容：`,
    },
  ]
}
