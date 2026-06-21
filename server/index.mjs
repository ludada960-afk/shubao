/**
 * 薯包AI 后端服务
 * 复刻 Coze 工作流：内容分析 → 视觉规划 → 图片生成 → 结果组装
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/["']/g, '');
  });
  console.log('  → 已加载 .env 配置');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// 全局未捕获异常处理
process.on('uncaughtException', err => {
  console.error('‼️ 未捕获异常:', err.message, err.stack?.split('\n').slice(0,5).join('\n'));
});
process.on('unhandledRejection', err => {
  console.error('‼️ 未处理Promise拒绝:', err.message);
});

// ============================================================
// API 配置
// ============================================================
const LLM_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6';
const IMG_KEY = process.env.IMAGE_API_KEY || '';
const IMG_BASE = (process.env.IMAGE_BASE_URL || '').replace(/\/+$/, '');

// ============================================================
// LLM 调用（兼容 OpenAI 格式，自动重试 + 双通道降级）
// ============================================================
async function callLLM(systemPrompt, userContent, options = {}) {
  const { temperature = 0.6, maxTokens = 4000 } = options;
  const errors = [];

  if (LLM_BASE) {
    const url = `${LLM_BASE}/v1/chat/completions`;
    const body = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      const errText = await res.text().catch(() => '');
      console.warn('OpenAI LLM:', res.status, errText.slice(0, 200));
      if (res.status === 503) {
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
          body: JSON.stringify(body),
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          return data.choices?.[0]?.message?.content || '';
        }
      }
      errors.push(`OpenAI ${res.status}: ${errText.slice(0, 100)}`);
    } catch (e) {
      errors.push(`OpenAI error: ${e.message}`);
    }
  } else {
    errors.push('未配置 LLM API（LLM_BASE_URL）');
  }

  throw new Error(`LLM 调用失败: ${errors.join(' | ')}`);
}

// ============================================================
// 图片生成
// ============================================================
async function generateImage(prompt) {
  const promptPrefix = 'REDNOTE (小红书) poster, vertical 3:4 portrait. Content must fill ≥75% of canvas — no large empty lower areas, no blank bands >15% of canvas height. ' +
  'LAYOUT MODES by page role: COVER = large title + 1 strong image (35-55% of page) + 3-5 bottom key points. BODY = one idea per page with clear focal point (checklist/evidence/field-note/split-view). CLOSING = takeaway title + 4-6 summary items. ' +
  'TEXT rules: BIG titles use LIGHTER weight, small text uses heavier weight. Chinese text must be fully visible with correct strokes, 5% margin. ' +
  'PHOTOS are evidence, not decoration — make them large enough to inspect, place text beside rather than over them. ' +
  'NO decorative elements: no random SVG circles, blobs, ornamental stickers, bokeh, decorative gradients, or fake diagrams. ' +
  'NO rounded cards, no glassmorphism. Straight modules, hairline rules, pure color blocks. ' +
  'BACKGROUND: Light/white/pastel — sea=light blue-white, mountain=soft green, skincare=light pink/peach, food=warm cream, book=warm beige, fashion=light grey/white, tech=light grey-white, home=warm white. ' +
  'Multi-item layouts (3+): distribute evenly in grid pattern, NEVER L-shape/U-shape/edge-loop leaving center empty. ' +
  '⚠️ Chinese characters MUST be accurate — especially "州" (广州, 3 vertical dots) not confused with "洲". ';
  const promptSuffix = ' CRITICAL: Leave 5% margin from ALL edges. All content, text, and objects must be fully visible and NOT cut off at the edges. Nothing can extend beyond the image frame. Portrait ONLY.';
  const fullPrompt = promptPrefix + ' ' + prompt + promptSuffix;
  const url = `${IMG_BASE}/v1/images/generations`;
  const body = {
    model: process.env.IMAGE_MODEL || 'gpt-image-2',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1366',
    quality: 'standard',
    response_format: 'url',
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => { try { controller.abort(); } catch(e) {} }, 300000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': IMG_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Image API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data?.[0]?.url || data.data?.[0]?.b64_json || '';
}

// ============================================================
// Coze 工作流 - 内容分析 prompt
// ============================================================
const CONTENT_ANALYSIS_SP = `# 角色定义
你是一位顶级小红书爆款图文内容策划专家，精通红鸦（RedCrow）的爆款内容创作体系。你的核心任务是根据用户提供的原始文本和品类，生成符合红鸦风格的高质量图文内容方案。

# 你必须深度理解红鸦内容体系的核心公式
## 1. 爆款标题公式（必须使用）
- 数字结果式：3天2夜/人均800/5个技巧/7天逆袭
- 身份场景式：打工人/学生党/宝妈/00后 + 场景痛点
- 反差痛点式：谁懂啊/再也不…/原来…才…/千万别…
- 清单总结式：合集/汇总/必看/指南
- 恐惧共鸣式：别等…才…/再…就晚了
标题必须带emoji（🔥/✨/💡/😱/✅）

## 2. 正文结构黄金公式
第一部分：谁懂啊/家人们/再也不…开头，用个人经历引发共鸣（1-2句话）
第二部分：正文干货（按品类不同密度）：
  - 干货类（旅游/科普/育儿/学习/职场/书单）：使用✅/⭐/📌做分割，3-5个info_blocks，每块含核心信息+个人体验+价格/数据
  - 好物种草类（好物评测/产品实测/数码/家居家电）：使用 🔥/🎧/💡/🎯 做分割，每块聚焦1个产品核心卖点
  - 视觉导向类（穿搭/美妆/美食/美甲/护肤）：简短有力，2-3个信息点足矣
第三部分：结尾CTA互动引导

## 3. 情绪价值表达规则
- 每段用emoji做标题分割（🔥/💰/🎧/💡/✅/⭐/📌/😱）
- 用口语化表达，**不同赛道用不同流行语**：
  穿搭/美妆→"OOTD""一衣多穿""叠穿大法""谁穿谁好看""显白""氛围感""穿搭公式""真的被美到了""甜酷""慵懒风""清冷感""姐妹冲"
  美食→"真的被香迷糊了""大口满足""幸福感爆棚""太上头了""一口就沦陷"
  旅游→"这辈子一定要去""美哭了""合集码住""不踩雷""被问疯了"
  好物→"闭眼入""后悔没早买""真香""懒人必备""被夸爆了"
  通用→"我直接惊了""谁懂啊""真的绝了""绝绝子""建议收藏""码住"
- 穿插个人真实体验（"我试过了""亲测有效""用了3个月"）
- 结尾加互动引导

# 每页内容规则（pages数组，共9个元素，P1封面+P2-P9内容）
每页结构：{"page_id": 1-9, "page_type": "content", "title": "本页标题（10字以内）", "hook": "一句话钩子", "story": "核心内容（按赛道控制长度）", "info_blocks": [{"label": "标签如价格/时间", "value": "值"}, {"label": "推荐指数", "value": "⭐⭐⭐⭐"}], "layout_hint": "画面描述：指定用拼图还是单图、主体什么、文字标注位置"}

## 赛道内容密度分级（必须遵守）
### 🏔️ 干货类（旅游/科普/育儿/学习/职场/书单）
- story长度：40-80字，2-3个核心info_blocks（精简！信息密度优先）
- 信息必须精选，每页只说1-2个重点
- layout_hint：指定拼图版式
- P7: 额外推荐/深度延伸
- P8: 总结推荐+花费+互动引导（**不能是end**）
- 排版逻辑：单图+信息标注呈现流程，拼图呈现多景点对比，路线图呈现行程流向
- 信息密度：高——具体到"几点到几点做什么、多少钱、怎么去"，但每页信息要精不要多

### 🛍️ 好物种草类（好物评测/数码3C/家居家装/美妆·产品测评）
- story长度：25-50字，2-3个info_blocks
- P7: 横向对比/优缺点
- P8: 总结推荐+价格+购买引导
- 排版逻辑：产品大图展示外观，细节特写展示质感，对比图展示差异
- 信息密度：中高——保留核心价格/评分/适用人群，删除多余描述

### 👗 视觉导向类（穿搭/美妆教程/美甲/美食探店/养生花茶）
- story长度：15-35字，1-2个info_blocks
- P7: 搭配技巧/延伸推荐
- P8: 总结+互动
- 排版逻辑：全身图展示整体效果，局部特写展示细节，多图拼贴展示不同风格
- 信息密度：中——重视觉轻文字，价格/色号/品牌名即可

# 严格的输出约束
- 每页必须填写layout_hint字段
- 必须填写category字段：根据内容判断品类，从以下列表中选一个填写：
  旅游攻略 | 美妆·产品测评 | 美妆·化妆教程 | 穿搭分享 | 美甲 | 健康养生 |
  书单推荐 | 职场成长 | 技能学习 | 美食推荐/探店 | 育儿知识 |
  好物测评 | 数码3C | 家居家装 | 养生花茶
- 禁止在story中堆砌与主题无关的内容
- 禁止生造不存在的品牌或产品规格
- **禁止篡改用户原文中的地点/名称**：用户输入的具体地点（如"重庆""长沙""成都"等）必须在标题和正文中原样保留，绝对不能换成其他城市。如果用户输入中没有具体地点，也不要用示例城市替代
- **P9不能是"end/结束"**：P9必须为总结推荐+总花费/推荐理由+互动引导CTA（"收藏关注""评论区告诉我"等）
- **时效性**：正文中涉及年份统一使用{{current_year}}年，月份使用{{current_month}}月，不能出现2024等过时年份

# 输出格式
必须返回JSON，包含category, title, body_text, hashtags, tags, pages字段
**pages数组必须包含9个元素（page_id 1-9），一条都不能少**。

**重要提醒：不要默认选"旅游攻略"。只有内容明确是行程、景点、天数时才是旅游攻略。美妆产品、美食、穿搭、家居家装等内容不要误判为旅游攻略。仔细阅读用户输入再决定品类。**`;

const CONTENT_ANALYSIS_UP = `品类：自动判断（根据用户输入的内容判断品类）

严格按照以下JSON结构输出，不要输出任何多余内容。

**body_text字数由赛道决定（见下方赛道最佳字数表），严禁超出上限。干货类≤500字，种草类≤350字，视觉类≤250字，美甲≤200字**。

**重要：category字段必须在JSON开头位置填写，从以下列表中选一个最匹配的品类名（不能写其他值）**：
旅游攻略 | 美妆·产品测评 | 美妆·化妆教程 | 穿搭分享 | 美甲 | 健康养生 | 书单推荐 | 职场成长 | 技能学习 | 美食推荐/探店 | 育儿知识 | 好物测评 | 数码3C | 家居家装 | 养生花茶

**pages数组必须包含9个元素，page_id从1到9**：

{
  "category": "此处填写品类名，从上方列表选一个",
  "title": "标题（红鸦式，参考下文【标题公式】）",
  "body_text": "完整正文（字数按赛道最优字数表限制，严禁超过上限。干货≤500字，种草≤350字，视觉≤250字）",
  "hashtags": ["#标签1", "#标签2"],
  "tags": [],
  "pages": [
    {"page_id":1,"page_type":"cover","title":"封面标题","hook":"封面一句话钩子","story":"","info_blocks":[],"layout_hint":"封面画面描述"},
    {"page_id":2,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":3,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":4,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":5,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":6,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":7,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":8,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":9,"page_type":"content","title":"总结推荐","hook":"互动引导","story":"总花费+推荐理由+CTA","info_blocks":[{"label":"总计","value":"金额"}],"layout_hint":"总结卡片+互动引导"}
  ]
}

===== 标题公式（必须使用，注意多样化，每次不能重复使用同一公式） =====
格式：[情绪钩子][emoji] + [内容承诺] + [数字/量化]
- 数字结果式：3天2夜💨人均800+玩到爽！ / N天N夜攻略🔥人均XXX拿下
- 熬夜付出式：熬夜总结🔥XXX精华攻略 / 花了N天整理出这份XXX / 实测N天才敢来分享
- 闭眼冲式：XXX闭眼冲！N款XXX推荐💅 / 黄黑皮/干皮/油皮闭眼入！
- 实测背书式：实测XXX🆘效果太狠了 / XXX亲测N天，效果真的绝了 / 用空瓶了才来说真话
- 目标达成式：养成XXX✨这N种方法太厉害了 / 从XX到XX，我做对了什么
- 格局炸裂式：格局炸裂🤯建议反复阅读这N本XXX / 看完彻底醒悟了🔥
- 新手友好式：新手必看🔥XXX全攻略 / 保姆级教程💡XXX一篇看懂
- 情绪共鸣式（新增）："真的被XXX惊艳到了！" / "后悔没早点发现！" / "无限回购！"
- 避坑指南式（新增）：XXX避雷指南⚠️这N个坑千万别踩 / 花过XX万冤枉钱才总结出的XXX
- 省钱攻略式（新增）：N元搞定XXX🔥打工人学生党必看 / 不到XX元拿下XXX性价比之王
注意：禁止反复使用"熬夜总结""3天2夜"等固定开头，每次必须换不同的标题切入点

===== 正文写作规则（必须遵守） =====
【第1段 开头钩子（3-4句）】（多样化，禁止连续重复使用同一句式）
模式1 共鸣痛点："谁懂啊！..." / "家人们谁懂啊！！" / "是不是还在纠结..." / "有没有姐妹和我一样..."
模式2 反常识："不要只顾着...，真正的..." / "以前总觉得...直到我..." / "做了XX年XXX才明白..."
模式3 实测背书："我帮大家实测了...，真的是不得不服！" / "花了一个月时间亲测，结论是..." / "用空瓶了才敢来分享..."
模式4 焦虑放大："...真的太容易...了" / "再不做XXX就来不及了！" / "别等XXX了才后悔没早点看到这篇"
模式5 惊喜发现式（新增）："发现了一个宝藏XXX！" / "终于找到了！" / "姐妹们快去试试这个！"
模式6 对比反差式（新增）："用之前：就这？用之后：真香！" / "以前的我：没必要吧；现在的我：怎么没早点买"
注意：每次生成的【第1段 开头钩子】不能与之前使用过的重复，禁止连续多次使用"谁懂啊"

【第2段起 正文干货】
- 使用emoji作为每段标题分割（🔥/💰/🚄/✅/⭐/⚠️/💡/🔸/👉）
- 列表格式：每项编号或emoji开头，2-3句
- 段落之间空行分隔
- **必须包含具体数字/价格/时间/步骤等数据**

【最后一段 结尾CTA】（多样化选择，避免重复使用同一句式）
1. 呼吁行动型："快艾特你的笨蛋闺蜜一起出发吧！" / "赶紧存下来，周末就去！" / "码住这篇，下次直接用！"
2. 祝福口号型："一起做个气血满满的元气少女吧！💪" / "愿我们都能在生活里闪闪发光✨" / "这个夏天，一起美到发光！"
3. 鼓励坚持型："坚持28天，皮肤自带打光板！" / "三天打鱼两天晒网可不行，坚持才是王道" / "给自己一个月的时间，你会回来感谢我的"
4. 金句型（多样化，禁止重复"种一棵树"）："生活不是为了赶路，而是为了感受路" / "取悦自己，才是终身浪漫的开始" / "人生建议：千万不要让任何人打乱你的节奏" / "你的气质里，藏着你走过的路和读过的书" / "爱自己是终身浪漫的开始" / "愿你有勇气改变，有耐心坚持" / "始于颜值，终于才华，忠于人品" / "与其仰望别人，不如提升自己" / "你值得世间所有的美好"
5. 价值强调型："阅读是回报率超高的投资" / "这笔钱花得最值的就是XXX" / "用一杯奶茶的钱换一个好皮肤，不亏" / "早买早享受，晚买哭着求"
6. 互动提问型（新增）："评论区交出你的宝藏XXX！" / "你觉得哪个最值得入手？" / "有没有和我一样踩过雷的姐妹？" / "还有我不知道的隐藏用法吗？"
7. 反转型（新增）："买之前：这也太贵了吧；买之后：怎么没早点买！" / "用了之后才发现，之前的钱都白花了"
注意：每次生成的结尾CTA不能与之前生成过的重复，尤其禁止反复使用"种一棵树"句式

===== 赛道特有规则（严格遵循） =====
【🏔️ 旅游攻略】
- story长度：40-80字，2-3个info_blocks（精简！每页只说1个重点）
- body_text只需包含：行程概览（不需要逐日详述）+ 预算金额 + 2-3个实用Tips。**禁止逐日写行程**
- Day用✅/🚄/💰/⚠️分割，每段2-3句话足矣
- body_text结尾用一句推荐语
- pages：P2=总览+亮点推荐, P3-P5=各日行程极简版（每页2-3个点）, P6=美食推荐（2-3道菜+价格）, P7=出片点位, P8=预算+避坑, P9=总结+CTA
- 每个info_blocks只需1个数字即可
- layout_hint必须指明路线图或拼图版式

【💄 美妆·产品测评】
- story长度：40-80字，2-3个info_blocks（精简！每页只说核心1-2个卖点）
- body_text采用红鸦爆款美妆结构但**大幅精简**：
  ① 开头钩子（1-2句）：共性痛点+情绪共鸣
  ② 质地描述（1-2句）：肤感关键词
  ③ 成分分析（1-2句）：主打成分+功效
  ④ 使用手法（1句）：用量+手法
  ⑤ 效果描述（2-3句）：含时间周期+变化
  ⑥ 优缺点（2句）：优点+缺点+适合人群
  ⑦ 结尾CTA（1句）：互动
- body_text总字数200-350字，信息必须精炼，禁止长篇大论
- pages：P2=开箱+产品外观+规格参数+价格+质地第一印象, P3=质地深度实测（延展性/吸收/油腻度+评分+对比）, P4=成分拆解+功效分析+安全指数+技术解读, P5=使用手法教程（步骤+用量+手法+时序+避坑）, P6=效果对比Before/After（时间线+多维度改善数据+评分）, P7=优缺点深度分析+雷达图+适合人群, P8=横向对比表格（本品+3竞品+价格+功效+评分+推荐标签）, P9=总结推荐信息卡（适合肤质+推荐理由+价格+综合评分+购买渠道+回购意愿+互动）

【💄 美妆·化妆教程】
- story长度：20-40字，1-2个info_blocks
- body_text每步1-2句话即可
- 用⚠️标注关键步
- pages依次展示每个步骤

【👗 穿搭分享】
- story长度：20-40字，1-2个info_blocks
- **正文结构多样化**：每次从以下模板随机选：
  模板A：按风格（"今日OOTD是XX风…"）
  模板B：按场景（"通勤→约会→周末"各一句话）
  模板C：按单品（"上衣/下装/鞋子"各一句话）
  模板D：按色系（一句话推荐）
- **必须使用穿搭圈流行语**：OOTD / 一衣多穿 / 叠穿 / 氛围感 / 清冷感 / 甜酷 / 老钱风 / 美式复古
- 每页标题交替用"OOTD""LOOK""搭配""公式"，禁止重复用"穿搭"
- pages：P2-P6=不同风格展示, P7=搭配技巧, P8=场景推荐, P9=总结

【💅 美甲】
- story长度：15-30字，1-2个info_blocks
- body_text每款1句话：色系+适配场景+显白
- pages：每页1-2款展示

【🥗 健康养生】
- story长度：30-50字，2个info_blocks
- body_text列出3-4种食材/配方，每种1-2句
- 含1个⚠️提示
- pages依次展示食材

【📚 书单推荐】
- story长度：25-45字，2个info_blocks
- body_text每本含书名+1句推荐语
- pages：每页2-3本书

【💼 职场成长】
- story长度：30-50字，2个info_blocks
- body_text列举3-4条法则，每条1-2句
- pages：P2-P7=各条法则, P8=延伸, P9=总结

【📖 技能学习】
- story长度：20-40字，1-2个info_blocks
- body_text每个技巧1句话
- pages：P2-P7=每页2-3个点, P8=资源推荐, P9=总结

【🍳 美食推荐/探店】
- story长度：25-45字，2个info_blocks
- body_text格式：✅ [菜名]+一句话口味（如"✅ 和牛三明治：入口即化"）
- pages：P2=招牌菜特写, P3=美食解剖, P4=制作, P5=拼盘, P6=吃法, P7=环境, P8=对比, P9=总结

【👶 育儿知识】
- story长度：30-50字，2个info_blocks
- body_text按板块列出3-4个点，每个点1-2句
- pages：每页一个板块
- **全部用常用字，禁止生僻字**

【🛋️ 好物测评】
- story长度：30-60字，2-3个info_blocks
- body_text按价格简列3档，每档1-2句
- pages：P2-P7交替产品图+真人体验, P8=对比, P9=总结

【📱 数码3C】
- story长度：25-50字，2个info_blocks
- 每档1-2句（参数+体验+价格）
- pages：P2-P8各档详解, P9=总结

【🛋️ 家居家装】
- story长度：25-50字，2个info_blocks
- body_text按空间分2-3个板块，每板块1-2句
- pages：P2=Before/After, P3-P5=分区, P6=好物, P7=避坑, P8=费用, P9=总结

【🧘 养生花茶】
- story长度：20-40字，2个info_blocks
- body_text每款配方1句话（配料+功效）
- 含1个⚠️禁忌
- pages：P2-P7=每款配方, P8=一周搭配, P9=总结

===== 每页内容规则 =====
- pages数组9个元素(page_id 1-9)
- P1: page_type必须为**cover**（封面页，只有标题+钩子，没有详细内容）
- P2-P8: content类型，每个page内容
- P9: 总结推荐+真实推荐理由+底部互动引导（**不能是end**）
- 每个元素必须包含info_blocks和layout_hint
- **layout_hint必须详细描述该页要展示的具体信息和文字内容**

===== 标签规则 =====
- 5-8个标签，放在body_text末尾（小红书格式：正文后空一行写标签）
- 标签格式：#标签名 用空格分隔，不用换行
- 混合类型：2-3个品类关键词 + 1-2个场景词 + 1-2个身份词 + 1个平台词
- 例如：类别关键词 #旅行攻略, 场景词 #周末出逃计划, 身份词 #学生党, 平台词 #小红书旅行攻略
- **hashtags数组仅用于导出文件，不单独展示在界面上**

===== 整体风格约束 =====
- 人称：姐妹们/宝子们（美妆·产品测评/美妆·化妆教程/穿搭分享/美甲/养生/美食/旅游），各位（通用/职场/书单/数码），宝子们/姐妹们（育儿），各位姐妹（健康养生/技能学习）
- 语气：口语化（"谁懂啊""真的绝了""闭眼入""太狠了"）
- 每段必须有实质信息（具体价格/数据/步骤），禁止空洞形容词堆砌
- ⚠️ **价格免责声明**：价格用模糊词（"约""起""左右"），禁止精确到个位数。**不要每个物品都标价**，只对总价或首项标价即可。如穿搭类写"整套约300-500元"代替每件标价。使用价格区间（如"百元左右""几十块"）
- 所有文字必须是简体中文
- **小红书各赛道最优字数（流量推荐算法敏感指标）**：
  标题≤20字（含emoji），正文因赛道不同（见下方），每条标签≤15字，标签数量5-8个。

  **赛道 - 最佳正文字数（含空格/换行/标签）**：
  - 旅游攻略：300-500字（干货型，多分段+数字，前3行定留存）
  - 美妆·产品测评：200-350字（测评心得为主，多空行排版）
  - 美妆·化妆教程：200-300字（步骤简短，emoji分割）
  - 穿搭分享：150-250字（视觉为主，文字点睛即可）
  - 美甲：100-200字（高度视觉化，图比字重要）
  - 健康养生：300-450字（干货密集，可用列表）
  - 书单推荐：250-400字（每本一段简短推荐）
  - 职场成长：300-450字（心得+方法论）
  - 技能学习：300-450字（步骤清晰）
  - 美食探店：200-350字（菜品+价格简短）
  - 育儿知识：300-450字（干货实用）
  - 好物评测：200-350字（体验感受为主）
  - 数码3C：200-350字（参数+体验简短）
  - 家居家装：200-350字（图片说明为主）
  - 养生花茶：200-300字（配方简短）

  **如果正文超过上述限制，必须精简内容，不能截断。关键字密度高比字数长更重要。**
- **pages必须生成9个元素（page_id 1-9）**
- **禁止篡改用户输入中的地点名**：用户原文的地名必须原样保留，不能替换成其他城市
- **时效性：年份必须使用{{current_year}}年，月份使用{{current_month}}月**，不能使用过时的年份。价格/数据也必须是最新的
- **P9不能是"end/结束"**：P9必须为总结推荐+总花费/推荐理由+互动引导CTA（"收藏关注""评论区告诉我"等）
- **内容多样化要求**：每次生成的标题句式、开头钩子、结尾CTA必须各不相同，禁止重复使用"种一棵树""谁懂啊"等固定套路。同一篇内容的多个page的layout_hint也不能雷同

=== 输入内容 ===
品类：由用户输入的内容自动判断
文案：
{{text_content}}

== 如果品类是旅游攻略，P6必须是美食推荐页 ==
`;

// ============================================================
// 工作流：内容分析
// ============================================================
async function contentAnalysis(textContent) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const sysPrompt = CONTENT_ANALYSIS_SP.replace(/{{current_year}}/g, String(currentYear)).replace(/{{current_month}}/g, String(currentMonth));
  const userPrompt = CONTENT_ANALYSIS_UP
    .replace('{{category}}', '自动判断')
    .replace('{{text_content}}', textContent)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));

  let raw = await callLLM(sysPrompt, userPrompt, { temperature: 0.8, maxTokens: 12000 });
  raw = raw.replace(/20(?:2[0-9]|3[0-9])[年]?/g, `${currentYear}年`).replace(/20(?:2[0-9]|3[0-9])/g, String(currentYear));
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  raw = raw.replace(/\r?\n|\r/g, ' ');

  function extractAndPad(rawText) {
    try { return JSON.parse(rawText); } catch (e) {}
    try {
      const fixed = rawText.replace(/\}\s*\{/g, '},{').replace(/\]\s*\{/g, '],{').replace(/\}\s*\[/g, '},[');
      let s = fixed;
      const start2 = s.indexOf('{');
      if (start2 >= 0) s = s.slice(start2);
      let opens2 = 0, arrays2 = 0, inStr2 = false, esc2 = false;
      for (const ch of s) {
        if (esc2) { esc2 = false; continue; }
        if (ch === '\\' && inStr2) { esc2 = true; continue; }
        if (ch === '"') { inStr2 = !inStr2; continue; }
        if (!inStr2) {
          if (ch === '{') opens2++;
          if (ch === '}') opens2--;
          if (ch === '[') arrays2++;
          if (ch === ']') arrays2--;
        }
      }
      if (inStr2) s += '"';
      while (arrays2 > 0) { s += ']'; arrays2--; }
      while (opens2 > 0) { s += '}'; opens2--; }
      const m = s.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch (e) {}
    try {
      let s = rawText.replace(/[^\x20-\x7E一-鿿　-〿＀-￯{},:\[\]\"\-. ]/g, '');
      const start = s.indexOf('{');
      if (start === -1) throw new Error('no json');
      s = s.slice(start);
      let opens = 0, arrays = 0, inStr = false, esc = false;
      for (const ch of s) {
        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (!inStr) {
          if (ch === '{') opens++;
          if (ch === '}') opens--;
          if (ch === '[') arrays++;
          if (ch === ']') arrays--;
        }
      }
      if (inStr) s += '"';
      while (arrays > 0) { s += ']'; arrays--; }
      while (opens > 0) { s += '}'; opens--; }
      return JSON.parse(s);
    } catch (e) {}
    // 方法4：用正则提取顶层字段（title/body_text/hashtags），放弃pages
    try {
      const titleM = rawText.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const bodyM = rawText.match(/"body_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const tagsM = rawText.match(/"hashtags"\s*:\s*\[([^\]]*)\]/);
      if (titleM) {
        const result = { title: titleM[1], body_text: bodyM ? bodyM[1] : '', hashtags: tagsM ? [tagsM[1]] : [], tags: [] };
        result.pages = [];
        const cats = rawText.match(/"category"\s*:\s*"([^"]*)"/);
        if (cats) result.category = cats[1];
        return result;
      }
    } catch (e) {}
    throw new Error('内容分析JSON解析失败(前): ' + rawText.slice(0, 150) + '...(后): ' + rawText.slice(-80));
  }

  const parsed = extractAndPad(raw);
  const pages = parsed.pages || [];
  if (pages.length < 9) {
    const existingIds = new Set(pages.map(p => p.page_id));
    for (let i = 1; i <= 9; i++) {
      if (!existingIds.has(i)) {
        const prev = pages.find(p => p.page_id === i - 1) || pages[pages.length - 1] || {};
        pages.push({ page_id: i, page_type: i === 1 ? 'cover' : 'content', title: i === 9 ? '总结推荐' : (prev.title || '') + '续', hook: i === 9 ? '别忘了收藏哦～' : (prev.hook || ''), story: i === 9 ? '总结：快来评论区告诉我吧！' : (prev.story || ''), info_blocks: i === 9 ? [{ label: '总计', value: '待补充' }] : (prev.info_blocks || []), layout_hint: i === 9 ? '总结卡片+互动引导' : (prev.layout_hint || '') });
      }
    }
    pages.sort((a, b) => a.page_id - b.page_id);
  }

  // 旅游攻略后处理：P6改为美食推荐页（仅限category明确为旅游攻略且P6内容为空或可替换）
  if (parsed.category === '旅游攻略' && pages.length >= 6) {
    const p6 = pages.find(p => p.page_id === 6);
    if (p6 && (!p6.story || p6.story.length < 20 || p6.story.includes('推荐当地') || p6.story.includes('特色菜'))) {
      // 从title或body_text中提取目的地地名
      const titleOrBody = parsed.title + parsed.body_text;
      let dest = '此';
      // 匹配常见的城市名模式：标题/正文前几个字经常是目的地
      const cityMatch = titleOrBody.match(/^([^\d\s]{2,4})(?:\d|旅游|攻略|之行|之旅|出发|周末)/);
      if (cityMatch) dest = cityMatch[1];
      else {
        // 后备：提取body_text中第一个城市名（查找常见后缀）
        const knownCities = titleOrBody.match(/(重庆|成都|长沙|西安|杭州|苏州|南京|武汉|广州|深圳|北京|上海|厦门|丽江|大理|昆明|贵阳|桂林|青岛|三亚|海口|哈尔滨|乌鲁木齐|拉萨|兰州|西宁|银川|呼和浩特|南宁|福州|南昌|合肥|郑州|济南|太原|石家庄|沈阳|大连|长春|天津)[^\s]{0,2}/);
        if (knownCities) dest = knownCities[1];
      }
      p6.title = '美食推荐';
      p6.story = `推荐${dest}当地3-4道地道特色美食，每道写明菜名+价格(参考当地人实际消费)+口感详细描述+推荐理由。必须围绕"${dest}"本地的真实招牌菜/小吃，不能写其他城市的菜系。`;
      p6.info_blocks = [{label:'推荐菜1',value:'价格'},{label:'推荐菜2',value:'价格'},{label:'推荐菜3',value:'价格'}];
      p6.layout_hint = '食物特写+拼盘展示(3-4样当地美食排列)，每样标注名称+价格+口感描述';
    }
  }

  return {
    category: parsed.category || '未分类',
    title: parsed.title || '',
    body_text: parsed.body_text || '',
    hashtags: parsed.hashtags || [],
    tags: parsed.tags || [],
    pages,
  };
}

// ============================================================
// Coze 工作流 - 视觉规划 prompt
// ============================================================
const VISUAL_PLANNING_SP = `# 角色：小红书视觉编排师
任务：根据内容方案，为【{{category}}】赛道生成9条prompt（1封面+8内容），输出JSON。

## 硬性红线
1. ⛔ 禁止横图：必须 portrait vertical 3:4 exact
2. ✅ 中文在图上：prompt引用该页story的具体中文文本，标明文字位置
3. ⛔ 禁止火星文/乱码：所有文字必须是可读简体中文
4. ⛔ 所有内容留5%边距，不贴边
5. ⛔ 禁止深色/黑色/暗色背景，全部浅色/白色/柔和色
6. ✅ 版式必须变化：连续两页不能用同一种排版，同一篇≥3页同版式
7. ✅ 价格用模糊词（"约/起/左右"），只在总价或首项标价，不要每件都标
8. ⛔ **禁止装饰性元素**：禁止随机装饰圆/花纹/贴纸/光晕/渐变色块。所有元素必须有信息价值
9. ✅ **内容必须填满画布**：3:4竖图内容覆盖≥75%画布高度。禁止大面积空白（留白≤15%画布高度）
10. ✅ **每页有明确视觉焦点**：标题是第一焦点，其次是图片/数据，最后是辅助信息

## 排版模式库（每页必选一种，连续两页不同）
1.封面杂志风：大标题(2-4行)+图片证据(占画布35-55%)+底部3-5个要点
2.实景笔记风：大图+窄说明列+一句话感悟(图片是证据不是装饰)
3.左右分栏：左大标题/引语，右2-3段正文，中间细分割线
4.引语页：大号引用居中(≤60%画布留白允许)+小号出处行+顶部日期/标签
5.清单表：标题+4-6个编号项目(每行:编号+标题+说明)，禁止圆角卡片
6.证据墙：2×2或3列小图+短标题，图片必须清晰可辨识
7.对比分屏：左右Before/After分割+标注
8.时间线/步骤流：箭头串联各步骤
9.总结页：大号结论标题+4-6条汇总+底部签名/CTA
10.极简文字+小图：大号文字/数字+角落小装饰图

## 当前赛道视觉方案
{{category_rules}}

## 输出格式
{"visual_system":"简短描述≤30字","cover_prompt":"英文prompt(竖图+中文标题)≤280字符","image_prompts":["page_id":2,"prompt":"英文(竖图+版式+中文文字)≤280字符","page_id":3,"prompt":"英文"...]}
image_prompts共8条page 2-9，必须生成8条。纯JSON，不包含任何解释文字。
`;

const CATEGORY_RULES = {
  "旅游攻略": `视觉：写实旅行摄影，自然光偏蓝绿
  封面A)多图拼贴+标题  B)单张风景大片+标题居中+价格  C)手绘地图+打卡点
  P2 A)三栏景点拼贴+价格  B)双栏对比  C)网格4宫格
  P3 A)大图+圆形嵌入小图  B)全景+底部横幅  C)时间线水平
  P4 A)斜切上下午+时段  B)上下分屏  C)卡片堆叠
  P5 A)路线地图+标注  B)地铁线路图风  C)距离排序
  P6 A)美食拼盘+价格  B)美食地图  C)排行榜
  P7 A)出片点位  B)取景指南+构图
  P8 A)预算逐项+总额  B)饼图+金额  C)省钱对比
  P9 A)打包清单  B)精华Tip卡片  C)行程总览+互动
  配色：不固定(海滨=蓝白,山地=翠绿,古城=暖褐,雪景=冷白蓝,城市=灰咖)
  所有背景浅色`,
  "美妆·产品测评": `视觉：高端美妆信息图，多元素拼贴布局
  封面A)双栏拼贴(产品+价格+品牌)  B)产品70%+标题+卖点标签  C)极简产品居中+标题底部
  P2 A)各角度+参数卡片  B)全家福+卖点气泡  C)三栏(图/参数/卖点)
  P3 A)质地微距+评分标签  B)质地横评三格  C)质地十字分解
  P4 A)成分+功效箭头  B)成分轮盘图  C)浓度/功效金字塔
  P5 A)步骤图+箭头  B)环形流程  C)正确vs错误对比
  P6 A)Before/After+VS  B)时间线Day1→28  C)三维度改善卡
  P7 A)优点|缺点|评分  B)天平式  C)问答卡
  P8 A)横向对比表  B)雷达图对比  C)阶梯排列
  P9 A)总结卡+肤质+价格  B)推荐决策树  C)精华回顾+CTA
  配色：不固定(按产品类型决定，禁止冷灰底/荧光色)浅色背景`,
  "美妆·化妆教程": `视觉：步骤式美妆教程，自然光
  封面A)完妆面部60%+标题  B)半脸+工具  C)四宫格
  P2 A)三步并列(妆前/粉底/遮瑕)  B)底妆前后对比  C)底妆步骤递进
  P3 眼妆：眼影晕染区域+眼线/睫毛特写  P4 腮红/高光  P5 唇妆
  P6 整体效果+要点  P7 色号参考  P8 配饰搭配  P9 总结互动
  配色：不固定(按妆容风格决定，肤粉/裸色/金棕等)浅色背景`,
  "穿搭分享": `视觉：街拍杂志风，全身照为主
  封面A)全身80%+标题角落  B)半身+全身两段  C)杂志风侧身/背面+大标题
  P2 A)全身+引导线标注单品  B)单品拆解三区  C)全身+单品环绕
  P3 A)上半身细节特写 B)面料的纹理/版型标注 C)叠穿层次分解
  P4 A)风格左右对比 B)同件单品两种穿法 C)Before/After搭配改造
  P5 A)配饰特写（包/鞋/首饰） B)配饰+穿搭融合 C)全身+配饰标注
  P6 A)场景穿搭（咖啡/街拍/办公） B)跨场景一件多穿 C)氛围感场景
  P7 A)一周穿搭7宫格 B)4套LOOK合集 C)色系搭配方案
  P8 A)搭配技巧图解（叠穿/配色/比例） B)避雷穿法对比 C)单品搭配公式
  P9 最佳LOOK展示+一句话推荐+互动
  配色：不固定(浅灰/白/米白/裸粉/浅紫/浅蓝灰)浅色背景
  文字：标题用"OOTD""LOOK""穿搭公式""搭配""氛围感"等交替使用，禁止每页都叫"穿搭"`,
  "美甲": `视觉：精致美甲摄影，手部真实感
  封面A)手部特写+标题  B)双手展示+标题  C)手+道具场景
  P2 甲型+颜色+款式标注  P3 细节特写+工艺
  P4 双手展示不同角度  P5 不同光线效果
  P6 工具产品排列+名称+价格  P7 搭配建议
  P8 持久度+注意事项  P9 总结+互动
  配色：不固定(按款式决定)浅色背景`,
  "健康养生": `视觉：健康生活风，明亮自然光
  封面A)食材居中+标题  B)食材散落+标题  C)饮品特写+标题
  P2 核心食材+功效  P3 科学原理/机制
  P4 做法步骤  P5 真实场景  P6 注意事项
  P7 延伸搭配  P8 周期建议  P9 总结互动
  配色：不固定(食材天然色)浅色背景`,
  "书单推荐": `视觉：文艺阅读风，暖色调
  封面A)书本堆叠+标题  B)书架排列+标题  C)一本书+金句
  P2-P8 每本书一页：封面+作者+金句+推荐理由
  P9 阅读顺序+互动
  配色：暖米/浅咖/奶白 浅色背景`,
  "职场成长": `视觉：简洁商务风，干净线条
  封面A)办公场景+标题  B)知识卡片  C)数据图表+标题
  P2 问题+解决方案  P3 方法步骤
  P4-P8 各方法详解  P9 总结+CTA
  配色：蓝灰/白/浅米 浅色背景`,
  "技能学习": `视觉：学习风，清晰步骤图
  封面A)学习场景+标题  B)工具排列+标题  C)思维导图+标题
  P2 技能总览  P3-P8 各步骤详解
  P9 成果展示+互动
  配色：浅色背景`,
  "美食探店": `视觉：小红书手账风 plog——白色手绘描边轮廓线+手写体文字标注+食物照片叠加手绘注释，像手账本翻拍。每页有白色手绘框/箭头/圈注/小装饰（星星❤️小花朵），文字用手写风格字体手绘效果，整体像旅行手账本的一页
  封面A)招牌菜照片+白色手绘描边轮廓+手写标题+价格手写标签  B)多菜拼图+每道菜白色描边环绕+手写价格标注  C)店内环境照片+白色手绘框+手写人均+手绘小装饰
  P2 A)食物微距+白色手绘圈注标注食材名+手写价格+箭头指引  B)俯拍摆盘+白色描边框出每道菜+手写字  C)食材解构+白色手绘引导线+手写标注各食材
  P3 A)食物剖面+白色手绘虚线标注每层+手写口感  B)爆炸分解图+白色描边+手写标注  C)制作流程+白色手绘箭头串联+手写步骤
  P4 A)原料展示+白色描边环绕原料+手写名字+箭头连接成品  B)步骤递进+白色手绘框+手写步骤+小花装饰
  P5 3-4道菜排列+每道白色描边轮廓+手写菜名+价格小标签+星星标记推荐
  P6 吃法展示+白色手绘箭头/圈注+手写吃法贴士+手绘小表情
  P7 环境氛围+白色手绘框标注位置+手写人均+手绘箭头指引
  P8 同类对比+白色手绘表格框+手写评分+手绘对号叉号
  P9 推荐组合+白色描边框+手写推荐理由+手绘小爱心+互动手写字
  文字所有标注必须用纯白色，手绘感线条(非直线)，整体风格像手账，底色暖白/米色`,
  "育儿知识": `视觉：温馨家庭纪实，柔光温暖
  封面A)亲子互动+标题  B)物品排列+标题  C)温馨合照+标题
  P2 清单排版+图标  P3 场景+标注
  P4 错误vs正确对比  P5 好物推荐
  P6 步骤图  P7 Q&A卡片
  P8 总结+互动
  配色：柔粉/淡蓝/米白/暖色 浅色背景
  特别注意：全部用常用字，不用生僻字`,
  "好物评测": `视觉：生活好物种草，高级产品摄影
  封面A)产品80%+标题底部+价格  B)产品入镜+人物手持+标题  C)多品网格排列  D)产品特写+标题浮层
  P2 A)平铺俯拍(产品+配件)  B)左产品60%+右信息条  C)产品斜放+配件环绕  D)上下分栏
  P3 A)真人场景使用  B)前后对比  C)手持特写  D)场景融入
  P4 A)细节微距+标注  B)2-3细节拼贴  C)产品侧躺+纹理  D)拆分美学排列
  P5 A)2-3小图时间顺序  B)中央产品+环绕场景  C)上下滑屏  D)左中右三栏
  P6 A)Before/After+VS  B)数据+产品图  C)时间线  D)环形对比
  P7 A)优点✓/缺点✗+评分  B)五星评分  C)三格横评  D)天平式
  P8 A)左右对比  B)时间线  C)三选一推荐
  P9 总结卡+购买建议+互动
  配色：不固定(按产品类型)浅色高级背景`,
  "数码3C": `视觉：科技感产品摄影，冷色调
  封面A)产品手持+标题+卖点  B)俯拍产品居中+标题  C)场景氛围+标题+价格
  多品横评封面：A)2×3网格排列6品+标题  B)一字排开+对比参数  C)阶梯排列+价格标签
  禁止L型/U型/边缘环绕；多品必须均匀网格排列
  P2 产品居中+四周参数  P3 拆解爆炸图+标注
  P4 功能演示+界面  P5 参数对比表格  P6 细节特写
  P7 使用场景  P8 总结+购买建议  P9 互动
  配色：不固定(按产品，浅灰/白/银/浅蓝)浅色背景`,
  "家居家装": `视觉：家居生活风，自然光明亮
  封面A)改造后全景+Before小图  B)场景+标题  C)细节+标题
  P2 Before/After左右分屏  P3-P5 分区展示
  P6 好物推荐3-4个  P7 避坑技巧  P8 费用明细
  P9 改造前后对比+互动
  配色：北欧=白+浅木 日式=原木+米白 法式=奶油白+浅金 现代=浅灰+白 浅色背景`,
  "养生花茶": `视觉：自然花草风，明亮通透
  封面A)花茶+原料散落+标题  B)多款排列+标题  C)手持茶杯+蒸汽+标题
  P2 原料+名称+功效  P3 冲泡过程  P4 功效对比
  P5 真实场景  P6 成分详解  P7 一周搭配
  P8 总结+互动
  配色：不固定(花草茶=浅绿/米白,果茶=暖橙/粉,安神=淡紫/淡蓝)浅色背景`
};

const VISUAL_PLANNING_UP = `根据以下内容方案生成9条prompt。按赛道视觉手册匹配风格。
每条prompt包含：竖图3:4 + 该赛道每页版式 + 该页story具体中文文本 + 赛道配色 + 留5%边距
封面prompt：按赛道封面规则 + 中文标题(from title) + 赛道配色

内容方案：
{{analysis_result}}
品类：{{category}}

输出JSON：{"visual_system":"","cover_prompt":"英文","image_prompts":[{"page_id":2-9,"prompt":"英文(竖图+版式+中文文字+赛道配色)"}]}
⚠️ image_prompts共8条page 2-9，必须生成8条。`;

// ============================================================
// 工作流：视觉规划
// ============================================================
async function visualPlanning(analysisResult) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const analysisStr = JSON.stringify({
    category: analysisResult.category,
    title: analysisResult.title,
    pages: (analysisResult.pages || []).map(p => ({
      page_id: p.page_id, title: p.title, hook: p.hook,
      story: p.story, info_blocks: p.info_blocks, layout_hint: p.layout_hint
    }))
  }, null, 2);
  const categoryKey = analysisResult.category;
  const catRules = CATEGORY_RULES[categoryKey] || CATEGORY_RULES["好物评测"];
  const sysPrompt = VISUAL_PLANNING_SP
    .replace(/{{category}}/g, categoryKey)
    .replace(/{{category_rules}}/g, catRules)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));
  const userPrompt = VISUAL_PLANNING_UP
    .replace('{{analysis_result}}', analysisStr)
    .replace('{{category}}', analysisResult.category)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));

  let raw = await callLLM(sysPrompt, userPrompt, { temperature: 0.7, maxTokens: 22000 });
  raw = raw.replace(/20(?:2[0-9]|3[0-9])[年]?/g, `${currentYear}年`).replace(/20(?:2[0-9]|3[0-9])/g, String(currentYear));
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  raw = raw.replace(/\r?\n|\r/g, ' ');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // 智能修复：尝试提取最外层JSON对象
    let fixed = raw.replace(/\}\s*\{/g, '},{').replace(/\]\s*\{/g, '],{').replace(/\}\s*\[/g, '},[');
    // 尝试补全不完整的JSON末尾
    if (raw.indexOf('"cover_prompt"') > 0 && raw.indexOf('"image_prompts"') > 0) {
      const lastBrace = raw.lastIndexOf('}');
      const expectedEnd = raw.lastIndexOf('"}]}');
      if (lastBrace < 0 && expectedEnd < 0) fixed = raw + '}]}}';
      else if (raw.lastIndexOf('}') < raw.length - 1 && raw.lastIndexOf('}') > raw.length - 10) fixed = raw + '}';
    }
    fixed += fixed.endsWith('}') ? '' : '"}]}}';
    try {
      const m = fixed.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error('No JSON object found');
    } catch (e2) {
      try {
        const clean = raw.replace(/[^\x20-\x7E一-鿿　-〿＀-￯{},:\[\]\"\-. ]/g, '') + '"}]}}';
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error('No JSON after clean');
      } catch (e3) {
        throw new Error('视觉规划JSON解析失败: ' + raw.slice(0, 200));
      }
    }
  }

  let prompts = (parsed.image_prompts || [])
    .filter(p => p.page_id && p.page_id > 1)
    .sort((a, b) => a.page_id - b.page_id);

  const needed = 8;
  if (prompts.length < needed && analysisResult.pages) {
    const existingIds = new Set(prompts.map(p => p.page_id));
    for (let pageId = 2; pageId <= 9; pageId++) {
      if (!existingIds.has(pageId)) {
        const page = analysisResult.pages.find(p => p.page_id === pageId);
        const story = page?.story || '';
        const title = page?.title || '';
        prompts.push({
          page_id: pageId,
          prompt: `Xiaohongshu poster, vertical 3:4 portrait, showing: ${title}. Chinese text: "${story}". Retro newspaper style #333333 font.`
        });
      }
    }
    prompts.sort((a, b) => a.page_id - b.page_id);
  }

  return {
    visualSystem: parsed.visual_system || analysisResult.category,
    coverPrompt: parsed.cover_prompt || '',
    imagePrompts: prompts,
  };
}

// ============================================================
// 工作流：图片生成（并发，队列管理）
// ============================================================
async function generateAllImages(coverPrompt, imagePrompts) {
  const allPrompts = [
    { id: 'cover', prompt: coverPrompt },
    ...imagePrompts.map(p => ({ id: `p${p.page_id}`, prompt: p.prompt })),
  ];
  const results = [];
  const queue = [...allPrompts];
  const failed = new Set();
  const MAX_WORKERS = 3;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (failed.has(task.id)) continue;
      try {
        const url = await generateImage(task.prompt);
        results.push({ id: task.id, url });
        console.log(`[gen] ${task.id} ok (${results.filter(r=>r.url).length}/${allPrompts.length})`);
      } catch (err) {
        console.error(`[gen] ${task.id} failed: ${err.message}. Not retrying.`);
        failed.add(task.id);
      }
    }
  }

  const workers = Array.from({ length: Math.min(MAX_WORKERS, allPrompts.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================
// 工作流：结果组装
// ============================================================
function assembleResults(analysis, visual, imageResults) {
  const coverResult = imageResults.find(r => r.id === 'cover');
  const contentResults = imageResults
    .filter(r => r.id !== 'cover')
    .sort((a, b) => {
      const na = parseInt(a.id.replace('p', ''));
      const nb = parseInt(b.id.replace('p', ''));
      return na - nb;
    });

  function extractPath(url) {
    try { return url.replace(/\?.*$/, ''); } catch(e) { return url; }
  }
  const seenPaths = new Set();
  const uniqueUrls = contentResults
    .map(r => r.url)
    .filter(Boolean)
    .filter(url => {
      const path = extractPath(url);
      if (seenPaths.has(path)) return false;
      seenPaths.add(path);
      return true;
    });

  return {
    title: analysis.title,
    body_text: analysis.body_text,
    hashtags: analysis.hashtags,
    tags: analysis.tags,
    category: analysis.category,
    visual_system: visual.visualSystem,
    pages: analysis.pages,
    cover_prompt: visual.coverPrompt,
    image_prompts: visual.imagePrompts,
    cover_url: coverResult?.url || '',
    image_urls: uniqueUrls,
    image_count: uniqueUrls.length,
  };
}

// ============================================================
// 单张图片重新生成
// ============================================================
app.post('/api/regenerate-image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: '缺少prompt' });
  try {
    const url = await generateImage(prompt);
    res.json({ url: url || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/regenerate-text', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  try {
    const analysis = await contentAnalysis(text);
    res.json({
      title: analysis.title || '',
      body_text: analysis.body_text || '',
      hashtags: analysis.hashtags || [],
      category: analysis.category || '',
      pages: analysis.pages || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// API 路由
// ============================================================

app.post('/api/generate', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  console.log(`\n=== 开始工作流: "${text.slice(0, 40)}..." ===`);
  try {
    console.log('[1/4] 内容分析...');
    const t1 = Date.now();
    const analysis = await contentAnalysis(text);
    console.log(`  → 品类: ${analysis.category}, 标题: ${analysis.title?.slice(0, 30)}, 耗时: ${((Date.now()-t1)/1000).toFixed(1)}s`);

    console.log('[2/4] 视觉规划...');
    const t2 = Date.now();
    const visual = await visualPlanning(analysis);
    console.log(`  → 视觉体系: ${visual.visualSystem}, 页面: ${visual.imagePrompts.length}, 耗时: ${((Date.now()-t2)/1000).toFixed(1)}s`);

    console.log('[3/4] 图片生成...');
    const t3 = Date.now();
    const imageResults = await generateAllImages(visual.coverPrompt, visual.imagePrompts);
    console.log(`  → 生成 ${imageResults.filter(r => r.url).length}/${imageResults.length} 张, 耗时 ${((Date.now() - t3) / 1000).toFixed(1)}s`);

    console.log('[4/4] 结果组装...');
    const result = assembleResults(analysis, visual, imageResults);
    console.log(`  → 完成: cover=${!!result.cover_url}, images=${result.image_count}`);

    res.json({
      title: analysis.title,
      body_text: analysis.body_text,
      hashtags: analysis.hashtags,
      tags: analysis.tags,
      category: analysis.category,
      visual_system: visual.visualSystem,
      pages: analysis.pages,
      cover_url: result.cover_url || '',
      image_urls: result.image_urls || [],
      image_count: result.image_count || 0,
      cover_prompt: visual.coverPrompt || '',
      image_prompts: (visual.imagePrompts || []).map(p => ({ page_id: p.page_id, prompt: p.prompt })),
    });

    // 后台预缓存：不等用户点导出，先下载所有图片到代理缓存
    const allUrls = [result.cover_url, ...result.image_urls].filter(Boolean);
    if (allUrls.length) {
      console.log(`  → 后台预缓存 ${allUrls.length} 张图片...`);
      Promise.all(allUrls.map(url =>
        fetch(url, { signal: AbortSignal.timeout(120000) })
          .then(r => r.ok && r.arrayBuffer())
          .then(buf => { if (buf) imgCache2.set(url, { d: Buffer.from(buf), ct: 'image/png', t: Date.now() }); })
          .catch(() => {})
      )).then(() => console.log(`  → 预缓存完成 (${imgCache2.size} 张)`));
    }
  } catch (err) {
    console.error('‼️ 工作流失败:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  try {
    const analysis = await contentAnalysis(text);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 作品存储
// ============================================================
const WORKS_PATH = resolve(__dirname, 'works.json');
function loadWorks() {
  try { if (fs.existsSync(WORKS_PATH)) return JSON.parse(fs.readFileSync(WORKS_PATH, 'utf8')); } catch(e) {}
  return [];
}
function saveWorks(works) {
  try { fs.writeFileSync(WORKS_PATH, JSON.stringify(works.slice(0,100)), 'utf8'); } catch(e) {}
}
app.post('/api/save-work', (req, res) => {
  const { work } = req.body;
  if (!work) return res.status(400).json({ error: 'no work' });
  const works = loadWorks();
  works.unshift({ ...work, id: Date.now(), at: new Date().toLocaleDateString('zh-CN') });
  saveWorks(works);
  res.json({ ok: true, count: works.length });
});
app.get('/api/works', (req, res) => { res.json(loadWorks()); });

// 图片代理：后端下载图片并缓存（内存+磁盘双缓存，持久化避免重启丢失）
const imgCache2 = new Map();
const IMG_CACHE_DIR = resolve(__dirname, 'cache_img');
if (!fs.existsSync(IMG_CACHE_DIR)) fs.mkdirSync(IMG_CACHE_DIR, { recursive: true });
app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).end('missing url');
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const diskPath = join(IMG_CACHE_DIR, hash);

  // 1. 内存缓存
  const mem = imgCache2.get(url);
  if (mem && Date.now() - mem.t < 1800000) {
    res.set('Content-Type', mem.ct); res.set('Cache-Control','max-age=1800');
    return res.send(mem.d);
  }

  // 2. 磁盘缓存（持久化，重启不丢）
  if (fs.existsSync(diskPath)) {
    try {
      const disk = fs.readFileSync(diskPath);
      const meta = JSON.parse(fs.readFileSync(diskPath + '.meta', 'utf8'));
      imgCache2.set(url, { d: disk, ct: meta.ct, t: Date.now() });
      res.set('Content-Type', meta.ct); res.set('Cache-Control', 'max-age=3600');
      return res.send(disk);
    } catch(e) {}
  }

  // 3. 远程获取
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!resp.ok) return res.status(502).end('upstream error');
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') || 'image/png';
    // 写入内存缓存
    imgCache2.set(url, { d: buf, ct, t: Date.now() });
    if (imgCache2.size > 200) { const k = imgCache2.keys().next().value; imgCache2.delete(k); }
    // 写入磁盘缓存（永不删除）
    fs.writeFile(diskPath, buf, () => {});
    fs.writeFile(diskPath + '.meta', JSON.stringify({ ct }), () => {});
    res.set('Content-Type', ct); res.set('Cache-Control', 'max-age=3600');
    res.send(buf);
  } catch (e) { res.status(502).end('proxy error: ' + e.message); }
});

// ============================================================
// 启动
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🧩 薯包AI 后端服务运行中`);
  console.log(`   LLM: ${LLM_BASE ? LLM_BASE + '/v1/chat/completions' : '未配置'} (${LLM_MODEL})`);
  console.log(`   Image: ${IMG_BASE}/v1/images/generations`);
  console.log(`   Anthropic 备用: ${process.env.ANTHROPIC_API_KEY ? '已配置' : '未配置'}`);
  console.log(`   API: http://localhost:${PORT}/api/generate`);
  console.log('');
});
