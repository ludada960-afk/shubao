/**
 * 薯包AI 后端服务
 * 复刻 Coze 工作流：内容分析 → 视觉规划 → 图片生成 → 结果组装
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, resolve, join, extname } from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import cluster from 'cluster';
import os from 'os';
import { loadPrompt, loadPromptWithVars, clearPromptCache, listPrompts } from './promptLoader.mjs';

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
const IMG_MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }
      if (res && res.ok) {
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
// 赛道图片生成指令（每个赛道独立设计，释放GPT-image-2上限）
// ============================================================
const CATEGORY_IMG_DIRECTIVES = {
  "旅游攻略": 'Travel destination photography. Natural scenic views, architecture, landscapes, local people. Warm sunlight, rich colors, depth of field. Atmospheric and inviting. Pure visual only.',
  "好物评测": 'Product photography. Clean studio lighting, soft reflections, product on simple surface. Close-up details, macro shots, natural shadows. Professional commercial photography style.',
  "美食探店": 'Real restaurant/cafe interior photography. Food close-ups with steam, natural window light, wooden tables, cozy atmosphere. Barista or diner naturally in frame. Warm golden tones, soft bokeh. Ingredients naturally arranged.',
  "穿搭分享": 'Fashion photography. Model in urban setting, natural light, full-body and half-body shots. Fabric texture close-ups, clean background. Street style aesthetic, natural poses.',
  "美妆护肤": 'Beauty portrait photography. Soft natural lighting on skin, close-up face shots. Product next to skin, ingredient textures. Clean, fresh aesthetic with pastel tones.',
  "数码3C": 'Tech product photography. Product on clean surface, dramatic lighting, metallic reflections. Close-up details of materials and textures. Dark or neutral background. Sleek modern aesthetic.',
  "学习干货": 'Clean desk flat lay photography. Notebooks, pens, glasses, natural window light. Organized study space. Warm neutral tones. Soft shadows and natural materials.',
  "职场干货": 'Modern office photography. Clean workspace, laptop, natural light. Minimalist composition. Plants and personal items for warmth. Professional calm atmosphere.',
  "家居家装": 'Interior design photography. Well-lit room with natural light. Furniture, plants, textiles. Cozy warm atmosphere. Scandinavian or Japanese aesthetic. Clean uncluttered spaces.',
  "健身减肥": 'Active lifestyle photography. Person exercising in bright space. Yoga mat, weights, water bottle. Natural light streaming in. Energetic and fresh atmosphere.',
  "美妆·化妆教程": 'Step-by-step face close-up photography. Model skin at different stages. Soft natural window light. Clean white or neutral background. Beauty editorial aesthetic.',
  "情感共鸣": 'Atmospheric mood photography. Soft focus, warm lamp light, window with rain, cozy corner with plants and books. Gentle warm tones. Peaceful contemplative mood.',
  "影视推荐": 'Cinematic collage style. Dark background with warm accent lighting. Multiple scene compositions arranged artistically. Dramatic shadows, rich colors, film grain texture.',
  "一人食": 'Cozy food photography. Single dish on wooden table, chopsticks, natural window light. Warm homey atmosphere. Ingredients naturally placed around the dish.',
  "美甲": 'Hand model close-up photography. Well-manicured hands in natural light. Clean neutral background. Soft focus background. Elegant and minimal.',
  "书单推荐": 'Books flat lay photography. Books stacked and open on wooden surface. Cozy reading corner with soft lamp light. Warm comfortable atmosphere. Natural textures.',
  "健康养生": 'Natural ingredients photography. Fresh herbs, fruits, tea leaves on wooden surface. Bright natural light. Green and warm tones. Organic clean aesthetic.',
  "通用": 'Clean photography-style image. One main subject centered. Soft natural lighting, warm neutral tones. Professional composition. Portrait vertical 3:4.'
};

// ============================================================
// 参考图视觉描述（用 LLM 的视觉能力识别照片主体）
// 覆盖所有场景：人物（单人/多人/情侣/朋友）、物品、食物、风景、宠物等
// ============================================================
async function describeImages(base64Images) {
  if (!base64Images || base64Images.length === 0) return [];
  const results = [];
  const maxDesc = Math.min(base64Images.length, 2);
  for (let i = 0; i < maxDesc; i++) {
    const imgData = base64Images[i];
    if (!imgData || typeof imgData !== 'string') { results.push(''); continue; }
    // 支持 DeepSeek 视觉的模型列表（按优先级）
    const visionModels = ['deepseek-chat', LLM_MODEL];
    let lastErr = '';
    for (const model of visionModels) {
      try {
        const body = {
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in ONE short Chinese sentence. Focus on: number of people, gender, approximate age, items, scene. Examples:\n- "一个穿白色T恤的年轻男性"\n- "一男一女户外合影"\n- "两个女生在咖啡厅自拍"\n- "一台银色笔记本电脑放在桌上"\n- "一盘红烧肉特写"\n- "海边日落景色"\n- "一只橘猫坐在沙发上"\nOutput ONLY the description, no explanation, no prefix.' },
              { type: 'image_url', image_url: { url: imgData } }
            ]
          }],
          max_tokens: 80,
          temperature: 0.1,
        };
        const res = await fetch(`${LLM_BASE}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json();
          const desc = (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
          if (desc && desc.length > 2) {
            results.push(desc);
            console.log(`[describeImages] ✅ 图${i + 1} (${model}): ${desc}`);
            lastErr = '';
            break;
          }
        }
        const errText = await res.text().catch(() => '');
        lastErr = `${model} ${res.status}: ${errText.slice(0, 100)}`;
        console.warn(`[describeImages] ❌ ${lastErr}`);
      } catch (e) {
        lastErr = `${model} ${e.message}`;
        console.warn(`[describeImages] ❌ ${lastErr}`);
      }
    }
    if (lastErr) {
      console.warn(`[describeImages] ⚠️ 图${i + 1} 所有模型失败: ${lastErr}`);
      results.push('');
    }
  }
  return results;
}

// ============================================================
// 图片生成
// ============================================================
async function generateImage(prompt, category, isCover, jkContext, refImageUrl) {
  const jkKeywords = [/水手服/,/JK/,/制服/,/百褶裙/,/领结/,/sailor/i,/seifuku/i,/校服/i,/校园/i,/学院风/i,/青春/i,/学校/i,/日系/i];
  const isJK = jkContext || (category === '穿搭分享' && jkKeywords.some(k => k.test(prompt)));

  let finalPrompt;
  if (isJK) {
    // GPT-image-2 安全过滤器阻止"school-age character"类图片
    // API建议改用 "adult fashion model" + "Japanese-inspired academy uniform look"
    // 做词汇替换以安全通过，保持人物/模特/价格标注完整
    let safe = prompt
      // 年龄明确化：adult (age 22)
      .replace(/\b(model|girl|woman)\b/gi, 'adult fashion model (age 22)')
      .replace(/\b(person|figure)\b/gi, 'adult model')
      // "sailor uniform" 优先整体替换 → 安全术语
      .replace(/\bsailor\s+uniform\b/gi, 'Japanese-inspired academy style')
      .replace(/\buniform\b/gi, 'fashion style')
      .replace(/\bsailor\b/gi, 'nautical')
      // school → 避免触发
      .replace(/\b(school|schoolgirl|schoolboy|student|teen|teenage|teenager)\b/gi, 'fashion')
      .replace(/校服|校园|学生|高中生|初中生/g, '学院风')
      // "wearing" ← 保留
      .replace(/\s{2,}/g, ' ').trim();
    const prefix = isCover
      ? `Fashion editorial photography. Adult female model portrait. `  // 封面不加价格标注
      : `Fashion editorial photography. Adult female model, Chinese price labels on clothing. `;
    finalPrompt = prefix + safe + ` Soft natural light, vertical 3:4, street style photography.`;
    console.log('[JK safe] len=' + finalPrompt.length);
  } else {
    // 非JK路径：原样
    const promptPrefix = `Xiaohongshu poster, vertical 3:4, photo-realistic, photography style. `;
    const textRule = isCover
      ? ' Cover text must use Chinese characters only. For example, large bold Chinese title at top, price labels in Chinese at bottom. NO English text except brand names.'
      : ' Chinese text annotations REQUIRED on this image. Include Chinese labels, prices, titles, and tags as part of the image design. Text must be Simplified Chinese. Do NOT add English text.';
    const promptSuffix = ` Leave 5% margin from ALL edges. Portrait ONLY. High quality, detailed, professional.${textRule}`;
    finalPrompt = promptPrefix + prompt + promptSuffix;
  }
  return await callImageAPI(finalPrompt, refImageUrl);
}

// 图片API调用（复用）
async function callImageAPI(fullPrompt, refImageUrl) {
  const url = `${IMG_BASE}/v1/images/generations`;
  const body = {
    model: IMG_MODEL,
    prompt: fullPrompt,
    n: 1,
    size: '1024x1366',
    quality: 'standard',
    response_format: 'url',
  };
  // 如果有参考图，传给API作为风格/构图参考
  if (refImageUrl) {
    body.reference_image = refImageUrl;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => { try { controller.abort(); } catch(e) {} }, 300000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + IMG_KEY },
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

## 🚨 最核心规则（违反即不合格，必须100%遵守）
**所有输出内容必须使用简体中文。标题、正文、标签、page story、info_blocks label/value 全部用中文写。禁止出现任何英文单词、英文句子、英文段落。品牌名可以保留英文，但必须附中文翻译/说明。菜品名、产品名、地名都要用中文。如果用户输入中有英文，翻译成中文后再用。例："coffee"→"咖啡"，"restaurant"→"餐厅"，"OOTD"→"今日穿搭"。如果你的输出包含超过3个英文单词（品牌名除外），整个输出不合格。**

# 你必须深度理解红鸦内容体系的核心公式
## 1. 爆款标题公式（必须使用）
- 数字结果式：3天2夜/人均800/5个技巧/7天逆袭
- 身份场景式：打工人/学生党/宝妈/00后 + 场景痛点
- 反差痛点式：谁懂啊/再也不/原来/才/千万别
- 清单总结式：合集/汇总/必看/指南
- 恐惧共鸣式：别等才/再就晚了
标题必须带emoji（🔥/✨/💡/😱/✅）

## 2. 正文结构黄金公式
第一部分：谁懂啊/家人们/再也不开头，用个人经历引发共鸣（1-2句话）
第二部分：正文干货（按品类不同密度）：
  - 干货类（旅游/科普/育儿/学习/职场/书单）：使用✅/⭐/📌做分割，3-5个info_blocks，每块含核心信息+个人体验+价格/数据
  - 好物种草类（好物评测/产品实测/数码/家居家电）：使用🔥/🎧/💡/🎯做分割，每块聚焦1个产品核心卖点
  - 视觉导向类（穿搭/美妆/美食/美甲/护肤）：简短有力，2-3个信息点足矣
第三部分：结尾CTA互动引导

## 3. 情绪价值表达规则
- 每段用emoji做标题分割（🔥/💰/🎧/💡/✅/⭐/📌/😱）
- 用口语化表达，**不同赛道用不同流行语**：
  穿搭/美妆→OOTD/一衣多穿/叠穿大法/谁穿谁好看/显白/氛围感/穿搭公式/甜酷/慵懒风/清冷感
  美食→真的被香迷糊了/大口满足/幸福感爆棚/太上头了/一口就沦陷
  旅游→这辈子一定要去/美哭了/合集码住/不踩雷/被问疯了
  好物→闭眼入/后悔没早买/真香/懒人必备/被夸爆了
  通用→我直接惊了/谁懂啊/真的绝了/绝绝子/建议收藏/码住
- 穿插个人真实体验（我试过了/亲测有效/用了3个月）
- 结尾加互动引导



# 重要：主题保留规则（必须严格遵守）
- 用户输入的文案就是你要写的内容主题，**必须围绕该主题生成内容**，不能换主题、不能自由发挥、不能生成与输入无关的内容
- 例如：如果用户输入「云南旅游」，你生成关于云南旅游的内容；如果用户输入「咖啡机」，你生成咖啡机评测。**不要偏差**
- **禁止**：用户写A内容，你生成B内容。这是严重错误

# 每页内容规则（pages数组，共8个元素，P1-P8全部为内容页，封面独立生成）
每页结构：{"page_id":1-8,"page_type":"content","title":"本页标题（10字以内）","hook":"一句话钩子","story":"核心内容（按赛道控制长度）","info_blocks":[{"label":"标签如价格/时间","value":"值"}],"layout_hint":"画面描述：指定用拼图还是单图、主体什么、文字标注位置"}


## 特别提示：可复用模板概念（参考GPT Image 2已验证有效的模板类型）
以下模板类型是已验证能稳定出图的排版方式，可用于参考生成layout_hint和prompt：
- 食物时间切片：一个食物拆成4-6阶段(未成熟→成熟→过熟→变质)，每段配中文阶段名+外观+内部变化+保存建议
- 手绘标注线：白色手绘线/箭头/圈注叠加在真实照片上，每处写2-6个字
- 路线手账图：暖色纸张背景，城市节点+线条连接+景点+天数+交通图标
- 一周穿搭/清单：7天/多项目网格排列，每格小图+标签
- 九宫格：9张规整排列+中央文字，适合总结页
- 对比分屏：左右Before/After，关键差异处标签标注
- 情绪治愈风：低饱和配色+温柔手绘线条+留白
- 知识流程图：竖排步骤+箭头串联+编号+短说明
- 产品爆炸图：产品配件分散排列+引导线+部件名称
- 斜切拼接：斜线分割画面为2个区域，各放不同场景
## 赛道内容密度分级（**必须严格遵守字数限制**）
### 🏔️ 干货类（旅游/科普/育儿/学习/职场/书单）
- story长度：**80-150字**，3-5个info_blocks
- info_blocks必须含具体数字（价格/时间/数据/评分）
- 信息必须详实：每页只说1-2个重点，但说透
- layout_hint：指定具体拼图版式
- P7: 延伸/额外推荐/深度对比
- P8: 总结推荐+总花费/推荐理由+互动引导（**不能是end**）
- 信息密度：高

### 🛍️ 好物种草类（好物评测/数码3C/家居家装/美妆·产品测评）
- story长度：**60-100字**，3-4个info_blocks
- 聚焦产品核心卖点+使用场景+真实体验
- P7: 横向对比/优缺点
- P8: 总结推荐+价格+购买引导
- 信息密度：中高

### 👗 视觉导向类（穿搭/美妆教程/美食探店/美甲/一人食/养生花茶/健身减肥）
- story长度：**60-100字**（**必须写满，低于60字扣分**），2-3个info_blocks
- body_text总字数：**150-250字（低于150字扣分）**
- 简洁有力，突出视觉描述，但**必须有具体内容**（价格/菜品名/口味/尺寸/颜色等）
- P7: 搭配技巧/延伸推荐
- P8: 总结+互动
- 信息密度：中高（探店类必须有菜品名+价格+口味+环境描述）

# 情感共鸣、影视推荐 特殊处理
- 情感共鸣：story 30-50字，每页1个金句+感悟，P8为总结+互动
- 影视推荐：story 40-60字，每部一页，P8为横向推荐+互动
- 🚨 **影视推荐硬性规则：只推荐 {{current_year}} 年正在热播/新播出的真实国产剧**。所有推荐剧名必须是真实存在、已在 {{current_year}} 年播出的作品。**禁止编造虚构的剧名、电影名**。评分基于真实豆瓣评分（约数）。
- 参考以下 {{current_year}} 年真实国产剧（优先推荐这些）：
   《主角》（张嘉益/刘浩存，豆瓣8.2，年代秦腔）
   《家业》（杨紫/韩东君，古装徽墨）
   《莫离》（白鹿/丞磊，古装权谋）
   《翘楚》（陈都灵/周翊然，古装女性权谋）
   《迷墙》（郭京飞/任素汐，现实悬疑）
   《耀眼》（关晓彤/李昀锐，青春治愈）
   《低智商犯罪》（王骁/田曦薇，悬疑喜剧，豆瓣8.1）
   《爱情没有神话》（唐嫣/赵又廷，都市情感）
   《雨霖铃》（杨洋/章若楠，古装武侠）
   《太平年》（历史正剧，豆瓣8.6）
   《生命树》（生态现实，豆瓣8.4）
   《灵魂摆渡·十年》（于毅/刘智扬，奇幻悬疑）
- **绝对禁止引用往年老剧或虚构不存在的新剧续集（如狂飙2、漫长的季节2等）**
- 宁可少推荐几部（甚至只有1-2部），也不要虚构或推荐老剧

# 严格的输出约束
- 每页必须填写layout_hint字段，明确描述画面布局
- 必须填写category字段：根据内容判断品类
- 禁止在story中堆砌与主题无关的内容
- 禁止生造不存在的品牌或产品规格；影视推荐赛道禁止虚构剧名、禁止编造不存在的新剧续集
- **禁止篡改用户原文中的地点/名称**
- **P8不能是end/结束**：P8必须为总结推荐+总花费/推荐理由+互动引导CTA
- **时效性**：正文中涉及年份统一使用{{current_year}}年，月份使用{{current_month}}月
- 所有内容必须有实质信息（具体价格/数据/步骤），避免空洞的形容词堆砌

# 输出格式
必须返回JSON，包含category, title, body_text, hashtags, tags, pages字段
**pages数组必须包含8个元素（page_id 1-8），一条都不能少**

**重要提醒：不要默认选旅游攻略。只有内容明确是行程、景点、天数时才是旅游攻略。美妆产品、美食、穿搭、家居家装等内容不要误判为旅游攻略。仔细阅读用户输入再决定品类。**

===== 标题公式 =====
格式：[情绪钩子][emoji] + [内容承诺] + [数字/量化]
**各赛道有自己的标题公式偏好，见下方【赛道特有规则】。下面列出通用备选公式，但不允许和赛道规则冲突。**
- 体验分享式：N天/次体验🔥不吹不黑说真话/亲测N天实话实说
- 清单整列式：合集🔥这N个直接抄作业/一篇搞定不用再找了
- 真实测评式：用了N周来交作业✅真实感受/不藏了！我的XXX真实体验
- 省钱必看式：不到XXX拿下🔥性价比之选/月薪XXX也能轻松入
- 小白友好式：新手小白看这一篇就够了/保姆级教程手把手教学
- 后悔没早式：后悔没早点知道🔥/为什么没人早点告诉我
- 谁懂共鸣式：谁懂啊！家人们谁懂啊！/懂自懂！用过的都懂
注意：每次必须换不同的标题切入点，禁止连续使用同一句式。**赛道有特定标题规则时以赛道规则为准。**

===== 正文写作规则（必须遵守） =====
【第1段 开头钩子（3-4句）】（多样化，禁止连续重复使用同一句式）
模式1 共鸣痛点：谁懂啊！/家人们谁懂啊！！/是不是还在纠结/有没有姐妹和我一样
模式2 反常识：不要只顾着/以前总觉得/做了XX年XXX才明白
模式3 实测背书：我帮大家实测了/花了一个月时间亲测/用空瓶了才敢来分享
模式4 焦虑放大：真的太容易了/再不做就来不及了/别等了才后悔
模式5 惊喜发现式：发现了一个宝藏XXX！/终于找到了！/姐妹们快去试试这个！
模式6 对比反差式：用之前vs用之后/以前的我vs现在的我
注意：每次生成的【第1段 开头钩子】不能与之前使用过的重复，禁止连续多次使用谁懂啊

【第2段起 正文干货】
- 使用emoji作为每段标题分割（🔥/💰/🚄/✅/⭐/⚠️/💡/🔸/👉）
- 列表格式：每项编号或emoji开头，2-3句
- 段落之间空行分隔
- **必须包含具体数字/价格/时间/步骤等数据**

【最后一段 结尾CTA】（多样化选择，避免重复使用同一句式）
1. 呼吁行动型：快艾特你的笨蛋闺蜜一起出发吧！/赶紧存下来，周末就去！/码住这篇，下次直接用！
2. 祝福口号型：一起做个气血满满的元气少女吧！💪/愿我们都能在生活里闪闪发光✨/这个夏天，一起美到发光！
3. 鼓励坚持型：坚持28天，皮肤自带打光板！/三天打鱼两天晒网可不行/给自己一个月的时间
4. 金句型：生活不是为了赶路而是为了感受路/取悦自己才是终身浪漫的开始
5. 价值强调型：阅读是回报率超高的投资/这笔钱花得最值的就是XXX/用一杯奶茶的钱换一个好皮肤
6. 互动提问型：评论区交出你的宝藏XXX！/你觉得哪个最值得入手？/有没有和我一样踩过雷的姐妹？
注意：每次生成的结尾CTA不能与之前生成过的重复

===== 🚨 赛道特有规则 — 严格执行，不可跳过 =====
每条规则指定了该赛道 **每页应该讲什么**，以及 **页与页之间的逻辑关系**。

【🏔️ 旅游攻略 — 按天拆分行前中后】
**逻辑**：行程天数→每天独立一页→美食→避坑→总结
**🗺️ 旅游攻略标题公式（必须使用，不能用其他赛道公式）**：
- 朋友圈以为我出国式：朋友圈被问爆了😭其实去了国内XXX/朋友以为我出国了其实只花了XXX
- 打工人极限游式：打工人周末极限N小时玩转XXX🔥/特种兵旅游之XXX N小时吃玩攻略
- 学生穷游式：大学生穷游版！人均XXX玩遍XXX N天N晚🌊/月薪XXX也能去的XX旅行
- 避雷推荐式：去XXX前为什么没人告诉我这些😅避雷+推荐全攻略/听劝！去XXX一定要XXX
- 被问爆攻略式：被问爆了！XXX保姆级攻略一篇看懂/刚从XXX回来‼️最新攻略N天N晚
- 这辈子必去式：这辈子一定要去一次XXX‼️美得不像话🌍/我宣布这是国内最适合XXX的城市
- 人均预算式：跟闺蜜去XXX花了N千🆚跟团只花了N千/人均XXX玩到爽🔥XXX元搞定N天游
- 小众宝藏式：反向旅游🔥这N个小众宝藏地/不想人挤人就去这N个地方/国内居然也有XXX
- 朋友圈文案式：朋友圈以为我在国外其实在XXX📸/被我找到国版小XXX了附攻略
- 请假/辞职式：00后辞职旅居XXX一个月🏡总花费不到XXX/请N天假去XXX太值了
- 合集清单式：坐高铁去XXX🚄周末N天N夜附丝滑攻略/去XXX看这篇就够了‼️全攻略
- 城市特种兵式：特种兵旅游之XXX N小时吃了N顿🍜附美食地图/周末N小时快闪XXX
- 打卡机位式：XXX出片机位合集📸朋友圈被赞爆了/这几个拍照点绝了超出片
- 对比选择式：XXX自由行🆚跟团哪个更划算？/报团N千🆚自由行N千区别太大了
- 本地人推荐式：本地人N刷的宝藏路线🚶‍♂️不踩雷/XXX土著整理的吃喝玩乐清单
- 美食路线式：N天N夜吃遍XXX🔥这N家不踩雷/XXX美食地图🗺️跟着吃就对了
- 踩坑血泪式：去XXX踩过的N个坑⚠️每一个都是血泪教训/XXX避雷这N个坑千万别踩
- 季节限定式：XXX的秋天美哭了🍁最佳观赏期到了/冬天一定要去一次XXX❄️人间值得
- 极限打卡式：N小时极限玩转XXX🏃‍♂️这些景点不能错过/一天刷完XXX N个景点攻略
- 小红书爆款式：XXX这N个地方太出片了📸手机也能拍大片/原相机直出XXX根本不用滤镜
- body_text：行程概览（不要逐日详述）+ 预算 + 2-3个Tips。**禁止逐日写行程**
- pages结构（7页，无P2）：
  P1=总览+亮点推荐（总天数+目的地+预算+核心亮点关键词）
  P3=Day1行程（具体景点+时间安排+门票价格+交通方式）
  P4=Day2行程（同上结构，不同景点）
  P5=Day3行程（如有更短行程则P5=美食推荐）
  P6=出片点位+预算明细（具体拍照点+各项目花费）
  P7=避坑指南（3-5个坑点，每个带小标题）
  P8=总结+CTA（总花费+推荐理由+互动引导）
- 每条行程必须有具体景点名+时间+价格
- info_blocks示例：[{"label":"Day1","value":"鼓浪屿+中山路"},{"label":"门票","value":"约80元"},{"label":"交通","value":"船票约35元"}]

【💄 美妆护肤 — 按使用步骤拆分】
**逻辑**：产品总览→质地实测→成分拆解→使用手法→效果对比→优缺点→横向对比→总结
**💅 美妆护肤标题公式（必须使用，不能用其他赛道公式）**：
- 肤质分类式：干皮/油皮/混油/敏感肌看过来🔥这N款最适合你/XX肤质不要乱买！这篇说清楚
- 空瓶亲测式：用空N瓶了才来说真话🚨/四年来用空十几瓶的精华‼️回购到停产
- 原相机实测式：原相机实测📱兰蔻vs雅诗兰黛到底哪个更适合你？/无滤镜实测XX太狠了
- B&A对比式：坚持N天的变化真的太明显🆘/Before vs After太狠了 皮肤像换了一层
- 成分分析式：成分党狂喜🔥这N个成分太绝了/扒一扒XX的成分到底值不值这个价
- 新手教程式：新手必看！超详细XX教程💡/化妆N年总结的技巧和弯路
- 平价国货式：国货杀疯了🔥完全不输大牌/不到XX元的宝藏国货学生党闭眼入
- 变美逆袭式：黄皮逆袭冷白皮✨内服外养N年经验分享牛奶肌养成/变美思路打开‼️
- 精简护肤式：18-25岁护肤步骤指南🧴别再用错了/敏肌修复屏障烂脸后我用了这N样东西
- 早八快妆式：早八人N分钟出门妆容🔥伪素颜公式来了/上班通勤妆N分钟搞定
- 避雷拔草式：风大的产品别乱跟风❌实测N天告诉你真相/网红护肤红黑榜🟢别再交智商税
- 无限回购式：无限回购🔥这N款一生推/后悔没早入的N款护肤好物/年度爱用盘点👑
- 囤货清单式：双十一/618囤货清单📦这N个不买亏了/换季护肤品合集一篇搞定
- 分年龄段式：20岁/25岁/30岁护肤品怎么选？不同年龄照着买就对了/抗老要趁早‼️
- 特殊护理式：去黑头最有效的方法‼️皮肤科医生教的/痘痘肌自救指南看完就好了
- 美白防晒式：夏天不防晒老得快☀️这N款防晒霜测评/一白遮百丑！美白精华合集
- 彩妆推荐式：年度爱用彩妆💄每一件都是反复回购的真爱/平价彩妆天花板✨不到XX元搞定全妆
- 手法技巧式：化妆N年总结出的省钱技巧💰别再交智商税了/化妆刷别瞎买有这N支够了
- 问题解决式：底妆不服帖❓浮粉卡粉怎么办/化完妆显脏❓这N个技巧一定要看
- pages结构（7页，无P2）：
  P1=产品外观+规格参数+价格（产品全貌+核心功效+适合肤质+价格标签）
  P3=质地实测（产品挤在手背/化妆棉上、颜色/气味/延展性特写+评分）
  P4=成分功效分析（核心成分图解+功效说明+适合肤质标签）
  P5=使用手法教程（分步骤：取量→涂抹→按摩→吸收→注意事项）
  P6=效果对比Before/After（使用前vs使用后皮肤状态对比+时间跨度）
  P7=优缺点分析（左右分栏：优点/缺点各3-4条+综合评分）
  P8=总结推荐（推荐理由+适合肤质+价格回顾+互动引导）
- **每页必须包含产品实物图片**，不能只有文字或图表

【👗 穿搭分享 — 按套系拆分】
**逻辑**：多套搭配→每套一页→面料→场景→技巧→总结
**✨ 穿搭标题公式（必须使用，不能用其他赛道公式）**：
- 身材分类式：微胖/梨形/小个子/苹果型身材看过来🔥这样穿也太显瘦了吧/大腿粗胯宽的姐妹看过来‼️
- 通勤穿搭式：通勤穿搭｜被同事要链接的一周穿搭👗Day1-7不重样/上班穿什么/实习穿搭得体又时髦
- 一衣多穿式：一件单品穿出N种风格🔥衣柜基础款一衣多穿挑战/优衣库基础款N种搭配
- 韩系/风格式：跟韩系博主学穿搭🧥基础款穿出高级感/甜酷/清冷/慵懒风穿搭公式
- 显瘦显白式：黄黑皮到底适合什么颜色？显白穿搭技巧🎨/微胖女生这么穿显瘦N斤/视觉增高穿搭
- 身高专场式：158小个子这样穿👉视觉170+显高公式/小个子穿搭合集照着买就对了
- 季节/主题式：秋冬叠穿公式🔥保暖又好看/春夏穿搭清爽又时髦/衣柜换季这N件必入
- 试衣间测评式：ZARA/优衣库试衣间｜新款测评这几件绝了🌟🌟🌟/快时尚新品哪些值得买
- 鞋包配饰式：年度最爱N双鞋子合集👟百搭又舒服/被问了N遍的包包链接来了👜
- 胶囊衣橱式：衣柜里必备的N件基础款👚一件搭出N套LOOK/挑战一个月不买新衣服旧衣新搭
- 氛围感穿搭式：不用露脸也能拍出氛围感穿搭📷拍照姿势教程/OOTD氛围感拉满回头率200%
- 购物清单式：新衣服分享｜一口气买了N件每一件都好满意🛍️/网购穿搭分享这些没踩雷
- 轻熟/职场式：职场新人穿搭指南💼得体又不老气/轻熟风穿搭30+女生这样穿气质绝了
- 色系搭配式：All Black永不过时🖤高级感拉满/同色系穿搭太高级了棋盘格配色YYDS
- 平价平替式：平价穿出大牌感🔥不到XX元穿出高级感/1688宝藏穿搭分享性价比绝了
- 旧衣改造式：衣柜里的旧衣服这样搭好像换了个新衣柜/不买新衣服的N天穿搭记录
- 情侣/闺蜜装式：情侣穿搭不土味🔥这样穿回头率太高了/闺蜜装Look教科书版
- 旅行穿搭式：去XX旅游带什么衣服📸N套look拍照超出片/旅行穿搭合集行李箱都装不下了
- pages结构（7页，无P2）：
  P1=总览（多套缩略图+风格标签，本期刊容主题标题）
  P3=第一套搭配详情（全身展示+单品标注+价格+风格关键词）
  P4=第二套搭配详情（不同模特/不同风格+全身展示+单品标注+价格）
  P5=第三套搭配详情（不同模特/不同风格+全身展示+单品标注+价格）
  P6=面料/版型细节（局部特写+面料标签+版型对比）或场景穿搭（三格图：校园/通勤/约会）
  P7=搭配技巧（左右分屏对比+技巧说明+颜色/款式建议）
  P8=总结+推荐（总价+最推荐的一套+互动引导）
- **每页模特不同**：禁止连续两页同一人设/场景/姿势
- info_blocks：每页至少3个（价格、面料、版型、颜色数据）

【🍳 美食探店 — 按菜式拆分】
**逻辑**：招牌菜→各道菜逐一展示→拼盘→环境→对比→总结
**🍽️ 美食标题公式（必须使用，不能用其他赛道公式）**：
- 谁懂啊式：谁懂啊！连吃了N天的XXX🔥人均XXX吃到扶墙出/谁懂啊为了这口XXX愿意再来N次
- 藏不住了式：藏在XXX的宝藏小店🏪后悔没早点发现/藏不住了！这N家店真的太好吃了
- 绝望式：XXX！！会一直去吃的店！！/XXX！！巨巨巨下饭😭连干N碗米饭
- 人均价格式：人均不到XXX！在XX吃到了正宗XXX/人均XXX吃到撑🔥性价比天花板
- 城市专属式：北京/上海/广州/成都/重庆！！这N家店不吃等于白来‼️/本地人从小吃到大的老字号
- 排队值得式：排队N小时也值得🔥这口值得！/为了XXX我愿意排队N小时
- 美食地图式：XX旅游吃了N顿‼️这份不踩雷清单请收好📝/XXX美食地图跟着吃就对了
- 被问爆式：被问爆了！！XXX真正好吃的是这几家⭐/经常被问的XXX店终于整理好了
- 再也不说式：再也不说XX是美食荒漠了‼️这条街全是宝藏/谁说XX没有好吃的
- 不想它火式：XX！不想它太火🔥但这家真的藏不住了/私藏小店不想让它火但又怕它倒闭
- 本地人推荐式：本地人N刷的餐厅清单✅不踩雷/XX土著整理必吃清单跟着吃准没错
- 藏在小巷式：藏在胡同/巷子里的神仙馆子🌮太香了/XX路边的老字号本地人从小吃到大
- 碳水快乐式：XXX碳水炸弹快乐加倍🔥/面食脑袋狂喜这N家面馆太绝了
- 火锅/烤肉式：社区火锅/烤肉老店🔥藏得深但真的好吃/终于有人把XX火锅说清楚了
- 甜品/饮品式：为了这口爆浆XXX愿意再来XX100次🥐/吃完幸福感爆棚的N家甜品店
- 夜宵/烧烤式：XX夜宵合集🌙深夜放毒/这N家烧烤店吃完还想再来
- brunch/咖啡式：XX这家brunch真的绝了🍽️吃完原地封神/咖啡星人的N家宝藏咖啡馆☕
- 海鲜/大排档式：这家大排档我终于吃到了🔥啫啫煲绝了/终于有人把这N个海鲜说清楚了🦐
- pages结构（7页，无P2）：
  P1=招牌菜特写（推荐菜品名称+价格+口感描述+推荐程度）
  P3-P5=各道菜逐一展示（每页一道菜：菜品大图+价格+口味+食材+推荐指数⭐）
  P6=拼盘展示（3-4道菜排列+环境氛围+位置信息）
  P7=同类对比（该店vs其他店同类菜品对比+推荐）
  P8=总结+推荐组合（最佳搭配+人均+互动CTA）

【📱 好物评测 — 产品横评】
**逻辑**：产品总览→逐品详测→对比→总结
**🛍️ 好物评测标题公式（必须使用，不能用其他赛道公式）**：
- 总结指南式：花了一万块总结的XX选购指南🧴别再乱买了/不同价位XX怎么选一篇说清楚
- 无限回购式：无限回购的好物们👑每一件都是反复回购的真爱/用空N瓶才敢推荐的好物清单
- 相见恨晚式：相见恨晚！这些冷门好物我居然现在才知道😱/后悔没早买的N件生活好物
- 实测对比式：风大的产品别乱跟风❌实测N天告诉你真相/XX vs XX到底哪个好实话实说
- 年度盘点式：年度爱用好物盘点🔥每一件都不踩雷/2025年度爱用清单来啦直接抄作业
- 红黑榜式：网红好物红黑榜🟢🔴这N个不要再交智商税了/买了不后悔的红榜清单
- 贵价vs平价式：拼多多XX块和专柜XXX块到底差在哪🆚实话实说/平价代替真的能打吗
- 肤质分类式：干皮/油皮/敏感肌照着买就对了⚠️/不同肤质的好物清单一篇搞定
- 平价宝藏式：不到XX元的宝藏好物✨学生党闭眼入/平价天花板不到XX元搞定
- 真实测评式：用了N天了来交作业✅真实感受不吹不黑/不藏了我的XXX测评来了
- 解决痛点式：告别XX困扰！这N个神器真的太香了/懒人福音！这N件好物用了就回不去
- 开箱分享式：开箱📦我买了XXX来交作业了/近期入手的N件好物分享每一件都很满意
- 功课合集式：别急着下单‼️先看完这篇XX功课再决定/做足了功课才买的XX清单
- 横向对比式：XX怎么选？热门款全对比🔥/参数党狂喜一篇看懂XX区别
- 租房/学生党式：租房党必入的好物🏠搬家也能带走/学生党宿舍好物不到XX元提升幸福感
- 回购清单式：回购N次的囤货清单🛒双十一/618照着买/空瓶记用空才推荐的好物
- Before/After式：用了N天后的对比图🆚效果真的惊到了/坚持用了N周的对比变化太大了
- 踩坑拔草式：花过XX万冤枉钱才总结出的好物清单💸/千万别买‼️这些网红产品踩雷了
- pages结构（7页）：
  P1=所有产品总览（网格排列+名称+核心卖点标签+价格区间）
  P3-P5=各产品详测（每页一个产品：产品全景+规格+实测体验+价格）
  P6=横向对比表（多产品参数+价格+评分对比）
  P7=优缺点分栏+综合推荐
  P8=总结+推荐购买的型号+理由+互动

【💻 学习干货 — 方法分步解析】
**逻辑**：总览→方法1→方法2→方法3→资源→避坑→总结
**📚 学习干货标题公式（必须使用，禁止混用通用公式）**：
- 后悔没早式：后悔没早知道的N个XX方法🔥第N个绝了/为什么没人早点告诉我这个方法
- 时间线逆袭式：敢不敢用N天改变自己？自律打卡计划表📝/从XX到XX我用了N个月
- 考研/考公式：考研英语/政治/数学XX分｜保姆级备考攻略✏️/考公过来人血泪教训这些坑别踩
- 方法总结式：学不进去不是你笨是方法错了🥹/终于找到了！最适合XX的学习方式
- 工具推荐式：亲测好用🔥这N个学习工具效率翻倍/收藏！N个免费自学网站够用了
- 清单计划式：N个月学会XX的完整计划表零基础也能懂💻/新手入门看这篇就够了
- 每日打卡式：每天N分钟N天后英语脱胎换骨🎧/坚持N天自律打卡我的改变太大了
- 避坑指南式：为什么你的XX总是记了就忘？90%的人都在犯错❌/踩过N个坑才总结出的方法
- 提分技巧式：终于找到了‼️这N个一定要知道的提分技巧🎯/XX提分攻略看完就能用
- 笔记方法式：手把手教你做笔记✅高效学习的正确方式/做了N年笔记才明白的技巧
- 书单推荐式：读了N本书后我强烈推荐这N本📖附读书笔记模板/好书推荐豆瓣XX分以上的N本
- AI学习式：20+个AI学习工具推荐🔥把效率拉满/用AI学XX也太香了吧效率翻倍
- 逆袭故事式：从学渣到学霸我做对了什么/坚持N个月逆袭成功的方法分享
- 效率提升式：每天多出N小时🔥我的时间管理法/告别拖延这N个方法太实用了
- 自习/专注式：专注力拯救计划🧠总是走神怎么办/学不进去的时候试试这N个方法
- 分学科攻略式：XX科目怎么学？从入门到精通一篇搞定/XX备考最全攻略看这篇就够了
- 学习搭子式：找个学习搭子一起打卡👭互相监督效率翻倍/一个人学不下去的看看这个
- 复盘总结式：每月学习复盘｜这个月我又进步了✨/阶段性学习总结效果比想象的好
**禁止使用**：追剧上头、入坑入迷、评分安利、美食探店等跨赛道标题**
- pages结构（7页）：
  P1=方法总览（核心方法论+适用人群+目标数据+时间规划）
  P3=方法一（具体步骤+实施方式+所需时间+效果数据）
  P4=方法二（同上结构，不同方法）
  P5=方法三（同上结构，不同方法）
  P6=资源推荐（工具/书籍/app清单+价格+使用建议）
  P7=常见误区/避坑（3-5个常见问题+正确做法）
  P8=总结+行动计划+互动

【💼 职场干货 — 技巧逐条拆解】
**逻辑**：总览→逐条技巧→案例→总结
**💼 职场干货标题公式（必须使用，不能用其他赛道公式）**：
- 打工人真相式：打工人必看！上班N年才懂的N个道理🔥/上班N年才明白的职场真相
- 升职加薪式：月薪从XX到XX我做对了什么🔥/升职加薪的N个底层逻辑/如何让老板给你加薪
- 避坑指南式：职场N个坑千万别踩⚠️/工作N年才明白的职场潜规则/领导没说但你要懂的N件事
- 面试通关式：面试中那些让你分分钟掉价的话😱千万别再说了/面试成功率90%的面经分享
- 汇报技巧式：打工人必看！N个让老板刮目相看的汇报技巧💼/年终述职一次通过的秘密附模版
- 同事关系式：同事关系的N个扎心真相💔很多人上班好几年才恍然大悟/职场社交别太当真
- 裸辞/转行式：裸辞N个月我后悔了🧎大厂人转行真实经历/从XX行业转行到XX我做对了什么
- 35岁焦虑式：35岁前一定要学透的职场底层逻辑🧠/30岁以后才明白的职场道理
- 简历/谈薪式：简历这样写薪资翻倍💰HR看了都想约你面试/手把手教你谈薪资同样的岗位为什么别人比你多N千
- 副业搞钱式：副业从0到月入N千💰普通人的搞钱思路总结/打工人必看的N个副业思路
- 新人/实习生式：给职场新人的N条建议早点看到就好了🌟/实习小白生存指南第一份工作怎么做
- 沟通话术式：这个职场沟通公式帮我解决了90%的冲突🔥/高情商话术领导同事都爱和你合作
- 情绪内耗式：最近离职了有些话想说💭打工而已不要内耗自己/上班不内耗的N个心态调整法
- 职场英语式：职场英语学这些就够了🔥/外企必备的N个英语表达高级又地道
- 行业经验式：在XX行业工作N年的真实感受🧊/外企/国企/大厂/创业公司到底怎么选
- 效率工具式：效率翻倍的N个工具推荐💻打工人用了都说好/笔记本/办公效率APP推荐
- 职场穿搭式：面试穿什么/上班穿什么👔得体又加分的职场穿搭/通勤穿搭一周不重样
- 跳槽/offer式：拿了N个offer怎么选？/跳槽涨薪N倍的经验分享/大厂跳槽攻略
- 管理层式：第一次当Leader怎么办？管理小白成长记📈/带团队的N个实用方法
- WLB/摸鱼式：上班N年总结的摸鱼不内耗法则🐟/如何保持工作生活平衡的经验分享
- 年终/绩效式：年终总结怎么写🔥让老板记住你的模板/绩效面谈怎么说才能拿高绩效
- pages结构（7页）：
  P1=总览（核心方法论+适用人群+核心数据）
  P3-P5=逐条技巧（每条技巧独立一页：技巧名+具体做法+案例+效果）
  P6=实际案例（真实场景应用+前后对比）
  P7=常见误区（3-5个坑+正确做法）
  P8=总结+行动清单+互动

【🏠 家居家装 — 区域拆分改造】
**逻辑**：总览→各区域逐一展示→好物→避坑→总结
**🏡 家居家装标题公式（必须使用，不能用其他赛道公式）**：
- 改造前后式：出租屋/旧房改造前后对比🔥这也差太多了/花XX元改造房间太值了变身梦中情房
- 被问爆尺寸式：被问爆的XX尺寸图来了📐附全屋柜子设计/被问爆的装修清单终于整理了🏠
- 预算分享式：硬装XX万软装XX万这个家让我宅到天荒地老/抄作业‼️XX万搞定XX风装修
- 小户型显大式：小户型千万别XX这样显大N平/我家虽然只有XX平但真的很好宅啊
- 听劝避坑式：听劝！小户型别做XX‼️/装修千万别找熟人血泪教训总结附避坑指南/装修不被坑流程表
- 风格展示式：奶油风/原木风/极简风/侘寂风装修案例🛋️每一帧都好绝/一直很火的中古风我家装好了
- 收纳整理式：收纳狂魔上线🧹这N个收纳方法太绝了/小家越住越大的N个秘诀
- 租房改造式：月租XXX的城中村被我改成了ins风小窝🏡/租房改造房东看了都想涨房租
- 省钱DIY式：谁说租房不能改？花XXX让房间大变身/改造花费不到XXX但每一天都想早点回家
- 老破小翻新式：老破小卧室改造✨一边省钱一边提升幸福感/住了N年的老房翻新像换了个家
- 好物种草式：不输宜家🔥这N件平价家居好物/租房党必入的N件居家神器搬家能带走
- 区域专场式：客厅改书房+地台多了间阳光房☀️/厨房这样改N平也能塞进洗碗机+蒸烤箱
- 软装搭配式：几招提升家居氛围感✨奶fufu的家软装清单/全屋软装搭配方案照着买就对了
- 装修流程式：装修不被坑‼️毛坯房装修流程表附预算/装修顺序搞错了后悔都来不及
- 绿植灯光式：绿植+暖灯🌱出租屋瞬间有了家的感觉/氛围感灯光布局秘籍家里瞬间高级了
- 省钱装修式：XX元搞定全屋🔥预算不多也能装出高级感/月薪XX的打工人在XX有了Dream Home
- 独居/女性式：女生独居安全指南🔒独居好物推荐/女孩子一个人住也要把家布置得温暖舒服
- 阳台/角落式：阳台改造计划🌸在家里拥有了一个小花园/家里的N㎡角落我布置成了最喜欢的空间
- 电视墙/背景墙式：别再装传统电视墙了现在流行这样做📺/背景墙设计翻车了😅但结果意外好看
- 衣柜/衣帽间式：主卧不做衣柜改出衣帽间+书房太香了👗/全屋定制衣柜避坑指南
- 合租/公共区域式：合租房的公共区域也可以很温馨✨/合租生活指南每个人都有自己的小空间
- 旧物改造式：房东的丑家具怎么办？遮！效果绝了💡/旧家具翻新记花XX元大变身
- 好物种草式：不输宜家🔥这N件平价家居好物/租房党必入的N件居家神器
- 软装搭配式：几招提升家居氛围感✨/奶油风/原木风N种软装搭配方案
- 省钱装修式：XX元搞定全屋软装🔥/预算不多也能装出高级感的N个技巧
- pages结构（7页）：
  P1=改造前全景（原貌+问题标注+改造目标+预算）
  P3-P5=各区域展示（每页一个区域：改造后全景+核心单品+价格）
  P6=好物推荐清单（推荐单品+价格+购买渠道）
  P7=避坑Tips（3-5个装修/改造注意事项）
  P8=费用明细+总结+互动

【💪 健身减肥 — 阶段/部位/天数拆分】
**逻辑**：总览→各阶段训练→饮食→对比→总结
**💪 健身减肥标题公式（必须使用，不能用其他赛道公式）**：
- 逆袭对比式：从XX斤到XX斤我经历了什么（附食谱）🔥/瘦了XX斤才敢告诉你的减肥真相全是干货
- 小基数/大基数式：小基数减肥太难了❗一个月瘦XX斤我做了这些/大基数减肥别瞎来正确方法在这里
- 不是吧我真瘦了式：不是吧！我真的瘦了？？N天挑战成功🔥/我真的瘦了坚持N天的变化太大了
- 食谱分享式：减脂餐吃这些不饿肚子也能瘦🥗一周食谱分享/上班族减肥的一天吃什么🍱XX大卡食谱
- 居家跟练式：帕梅拉+跳绳N个月练出马甲线跟练计划🔥/每天N分钟在家就能练不跑不跳
- 减肥真相式：减肥最大的谎言：不吃晚饭就能瘦❌/瘦了之后才明白的N个减肥真相
- 梨形/局部式：梨形身材看过来这套瘦腿操真的绝了🔥/告别XX赘肉这N个动作就够了/瘦腿提臀多久见效
- 时间线记录式：从跑XX米都喘到能跑XX公里我用了N个月🏃‍♀️/N天打卡记录变化肉眼可见
- 饮食方法式：别再乱吃了‼️XX饮食法真的让我瘦了XX斤/吃饱了也能瘦的饮食秘诀大公开
- 空腹有氧式：空腹有氧YYDS！坚持一个月变化太大了🔥/早起空腹有氧N天的真实感受
- 产后恢复式：生完孩子胖了XX斤我用半年逆袭回来了💪/产后恢复这样做又快又有效
- 平台期突破式：减肥平台期怎么办？我试了这N个方法突破了/瘦到一定程度不动了别慌
- 心理建设式：瘦下来之后整个世界都变温柔了✨/减肥真的不需要太用力但需要坚持
- 春季/夏季式：夏天就要到了🔥现在开始还来得及/春季减肥攻略夏天美美穿裙子
- 健身房式：健身房新手别慌看这篇就够了🏋️/私教课值不值？上了N节课的真实感受
- 体态矫正式：圆肩驼背怎么办？这N个动作每天N分钟/体态好了气质真的会变提升训练
- 减脂必知式：减脂期最容易踩的N个坑⚠️别再做了/代谢提高的N个方法躺着也能瘦
- 运动穿搭式：健身穿搭分享🩱好看又好穿的运动装备/运动内衣/Lululemon平替推荐
- pages结构（7页）：
  P1=计划总览（训练目标+时长+频率+核心动作概览）
  P3-P5=各训练模块（每页一个模块：训练动作+组数+时间+效果说明）
  P6=饮食方案（每日食谱+热量+营养搭配）
  P7=效果对比（Before/After+周期+数据变化）
  P8=总结+坚持建议+互动

【🧴 美妆·化妆教程 — 上妆步骤拆分】
**逻辑**：底妆→眼妆→唇妆→修容→定妆→产品清单→总结
**💄 化妆教程标题公式（必须使用，不能用其他赛道公式）**：
- 伪素颜/早八式：早八人N分钟出门妆容💄伪素颜公式来了/这才是真正的心机素颜妆‼️直男看不出来
- 新手教程式：新手必看！超详细XX妆教程手把手🎨/新手学化妆顺序别搞错了从零开始
- 风格教程式：清冷感/甜妹/御姐/纯欲/白开水🔥XX妆教程一次学会/换头级妆教这个妆太绝了
- 产品推荐式：无限回购的N款彩妆💄每一件是真爱/黄黑皮/橄榄皮能用的XX色号找到了
- 约会/通勤式：约会妆容🔥回头率200%/上班通勤妆N分钟搞定得体又好看
- 年度爱用式：年度爱用彩妆清单一篇码住👑/2025年最爱用的N件彩妆不踩雷
- 避雷拔草式：跟风买了网红彩妆结果😅实话测评/买了就后悔的N件彩妆别浪费钱了
- 分步骤教学式：底妆不服帖？这N个技巧拯救你🎯/告别卡粉脱妆的N个秘诀
- 化妆技巧式：化妆N年总结的小技巧🔥每一个都超实用/化妆师不会告诉你的N个技巧
- 平价彩妆式：不到XX元搞定全妆💄学生党必入/平价彩妆天花板几十块买到大牌质感
- 国货彩妆式：国货彩妆杀疯了🔥完全不输大牌/宝藏国货彩妆合集又便宜又好用
- 眼妆专题式：单眼皮/内双/肿眼泡眼妆教程👁️放大双眼/眼睑下至+卧蚕画法太绝了
- 唇妆式：黄皮显白口红色号推荐💄素颜也能涂/唇釉/口红试色原相机无滤镜
- 修容/腮红式：塌鼻梁也能变立体的修容教程👃/选对腮红气质提升N个Level
- 底妆式：底妆服帖的秘诀终于找到了✍️/干皮/油皮/混油底妆大法
- 妆容急救式：脱妆急救法🔥夏天出门也不怕/暴汗也不脱妆的定妆大法
- 色彩分析式：你是什么季型？测一测适合你的彩妆色系🎨/橄榄皮/暖黄皮适合什么颜色
- 短时化妆式：挑战N分钟出门妆容⏱️真的很简单/来不及化妆时只做这N步就够了
- pages结构（7页）：
  P1=完妆效果+所需产品清单+难度等级+预计用时
  P3=底妆步骤（妆前→粉底→遮瑕→定妆，每步配图+产品名）
  P4=眼妆步骤（眼影→眼线→睫毛，颜色+手法）
  P5=唇妆+腮红（色号+涂抹手法）
  P6=修容+高光（位置示意+手法）
  P7=定妆+持久技巧（产品+手法）
  P8=全妆展示+产品清单+价格+互动

【📖 书单推荐/影视推荐 — 逐本/逐部介绍】
**逻辑**：总览→逐本/部分享→总结
**🎬 影视推荐标题公式（必须使用，禁止混用通用公式）**：
- 熬夜追完式：熬夜刷完这N部剧太上头了🥹根本停不下来/一口气追完N部🔥后劲太大了
- 口碑推荐式：口碑炸裂🔥这N部我不允许你没看过/零差评！每一部都是良心之作/连刷N遍的好剧
- 评分安利式：豆瓣9.0+！这N部直接封神🎬/高分国产剧盘点🔥每一部都值得N刷
- 入坑入迷式：一集入坑！看完根本走不出来🔥/入坑不亏越看越上头的N部剧
- 剧荒救星式：剧荒进🔥这N部承包你的周末/再也不愁没剧看了！N部宝藏剧拯救假期
- 类型盘点式：这N部悬疑剧反转再反转😱结局意想不到/被名字耽误的宝藏剧每一部都是神作
- 年度总结式：{{current_year}}年必看国产剧合集🔥/上半年口碑最好的N部剧/年度剧单TOP
- 宝藏好剧式：被名字耽误的宝藏好剧✨你可能错过了这些神作/冷门高分好剧推荐建议收藏
- 同类型推荐式：看完了《XXX》不过瘾？这N部同类型剧值得追🔥/原著党狂喜！小说改编天花板
- 治愈/轻松式：周末宅家看什么？N部治愈系剧集推荐🏠/不开心的时候就看它们
- 悬疑/烧脑式：悬疑剧迷请进！这N部烧脑剧反转再反转🧠/国产悬疑太顶了建议直接通宵刷
- 古装/历史式：那些年追过的古装剧TOP👑每一部都是经典/历史剧推荐格局大气制作精良
- 纪录片式：一生推的纪录片🌍每一帧都美到窒息/看完格局变大的N部纪录片
- 爱情/甜剧式：甜到牙疼的N部恋爱剧💕适合一个人偷偷看/情侣一起看的甜剧推荐
- 下饭神剧式：我的下饭神剧🍜没有它们吃饭都不香了/一边吃饭一边追的N部剧
- 演技/共情式：这N个角色演到我心里了😭/演技炸裂被这N个角色狠狠共情
- 短剧式：短剧天花板🔥一集只有N分钟但太上头了/手机就能看的N部精品短剧
- 韩剧/日剧式：韩剧迷请进📺{{current_year}}年必追清单/高分日剧推荐每一部都值得看
- 暑假/春节式：暑假/春节必追剧单🔥宅家不无聊/假期刷剧指南这几部必看
**🚨 影视推荐硬性规则：所有剧名必须是 {{current_year}} 年在播的真实国产剧，禁止虚构剧名、禁编续集。参考以下 {{current_year}} 年真实剧：《主角》《家业》《莫离》《翘楚》《迷墙》《耀眼》《低智商犯罪》《爱情没有神话》《雨霖铃》《太平年》《生命树》《灵魂摆渡·十年》。宁可少推也不要虚构。**
- pages结构（7页）：
  P1=总览（所有推荐汇总+数量+类型标签+全部真实剧名列表）
  P2-P7=逐部介绍（**每页一部的真实剧名必须填在title字段**，禁止填"续""续续"等占位符。每页内容：评分+类型+剧情概要+推荐理由）
  P8=总结+最推荐+互动（推荐语要和P2-P7引用的一致）

【🧘 情感共鸣 — 情境递进】
**逻辑**：引出共鸣→逐层递进→升华→互动
**💗 情感共鸣标题公式（必须使用，不能用其他赛道公式）**：
- 治愈金句式：原来真的有人可以爱你爱得很轻松💕/爱自己是终身浪漫的开始/不必追光你自己就是光
- 写给XX式：写给XX岁的自己：你不用那么懂事的/写给正处于迷茫期的你一切都会好起来的
- 深夜emo式：深夜emo🌙这N句话让我彻底释怀/深夜睡不着的时候我都在想什么/深夜朋友圈
- 独处成长式：越来越喜欢独处了原来这叫成年人的治愈🌃/下班后的N小时才是我真正的人生
- 长大懂事式：长大后慢慢明白的事✨/后来我才明白放下比坚持更需要勇气
- 原生家庭式：原生家庭不好的女生后来都怎么样了/突然理解了一句话幸福的人用童年治愈一生
- 普通女孩式：给所有普通女孩你不用完美你本来就很美好🌸/普通女生也可以闪闪发光
- 恋爱/情感式：谈恋爱之前请先把自己养得丰盈饱满💞/你值得被温柔以待不需要变成别人喜欢的样子
- 年龄焦虑式：XX岁未婚我在过自己曾经羡慕的生活/不要用年龄定义自己每个年纪都是最好的
- 城市/漂泊式：那天我删掉了XXX张照片好像也没那么难/一个人在陌生城市打拼的第N年
- 友情/亲情式：越长大越明白朋友不在多而在真👭/给爸妈打电话的频率越来越高了
- 低谷期式：感谢那段低谷期让我变成了更好的自己🌱/如果你也在经历难熬的时光我想对你说
- 自信/独立式：那个总在自我怀疑的女孩我想抱抱你🫂/从讨好型人格到学会拒绝我用了N年
- 温暖小事式：今天在地铁上哭了但没关系明天又是新的一天🌅/记录让我感到温暖的N件小事
- 生活感悟式：生活不是赶路而是感受路🚶‍♀️/越简单的生活越自由
- 断舍离式：删掉了XX张照片XX个联系人好像也没那么难/学会断舍离后生活变得轻盈了
- 情绪释放式：原来哭出来也没那么丢人😢/允许自己有emo的权利然后继续向前走
- 女性力量式：那些离婚后活得更精彩的女生教会我的事💪/30+女性的清醒活法
- 人生哲思式：出现在你生命里的人都是为了给你上一课🎓/通透的人生不需要太多解释
- 日记体式：最近的一些碎片日常和心情📝/近期的一些感悟想分享给你
- 心灵鸡汤式：慢慢来比较急做三四月的事在八九月自有答案🌸/花会沿路盛开你以后的路也是
- pages结构（7页）：
  P1=开篇引语（核心情感主题+氛围配图）
  P3-P6=层层递进（每页一个情境/感悟+金句+留白排版）
  P7=升华（核心观点+治愈金句）
  P8=回顾+互动引导

【🍳 一人食 — 按食谱拆分】
**逻辑**：总览→各天食谱→备餐技巧→总结
**🍜 一人食标题公式（必须使用，不能用其他赛道公式）**：
- 一个人也要好好吃式：一个人吃饭也要好好对待🍳今天晚餐长这样/一人食的快乐谁懂啊想吃什么就做什么
- 快手晚餐式：打工人下班N分钟快手菜⏱️好吃到舔盘子/懒人食谱N分钟搞定一顿饭太香了
- 独居一周菜单式：独居女孩/男孩的一周菜单🍱简单又营养/一周不重样的一人食食谱合集
- 省钱做饭式：别点外卖了这碗面XX块搞定比店里还好吃💰/做饭比外卖省多了！N道省钱食谱
- 懒人电饭煲式：懒人电饭煲食谱！一锅出饭菜一体的快乐🍚/电饭煲/空气炸锅真的太香了
- 冰箱清空式：冰箱里剩的菜这样做好吃到跺脚🔥/冰箱剩菜拯救计划做出了一顿大餐
- 精致独处式：一人食也要有仪式感✨精致晚餐分享/幸福感爆棚的一人食好物推荐
- 万能酱汁式：学会这个万能酱汁做什么都好吃👩‍🍳/这N种灵魂调料家里常备太香了
- 深夜放毒式：深夜泡面加这些瞬间变米其林🍜/深夜食堂今晚想吃点什么呢
- 上班带饭式：上班族带饭不重样一周备菜攻略🥡/N分钟备好一周便当时间管理大师
- 厨房小白式：不会做饭也能搞定的N道菜🍳厨房小白进/零失败的一人食菜谱有手就会
- 租房小厨房式：租房小厨房只有N平米但我的美食世界很大✨/小空间也能做出大餐厨房收纳分享
- 空气炸锅式：万物皆可空气炸锅🔥N分钟搞定N道菜/空气炸锅懒人食谱太适合独居了
- 火锅/烤肉式：一个人也要吃火锅啊🥘小分量刚好不浪费/独居烤肉在家也能实现烤肉自由
- 甜品/早餐式：今天早餐吃什么🌅N分钟搞定营养早餐/独居甜品下午茶的快乐
- 食材囤货式：一个人食材怎么囤🧊冰箱收纳大法/适合独居囤货的N种食材推荐
- 低卡/减脂式：一人食也要健康低卡🥗减脂期的一人餐/吃不胖的一人食谱好吃又健康
- pages结构（7页）：
  P1=成品展示+标题+制作时长
  P3-P6=各天食谱/各类菜谱（每页一道：食材清单+步骤+时间+价格）
  P7=备餐技巧（批量制作技巧+保存方法+省时技巧）
  P8=总结+推荐搭配+互动

【📱 数码3C — 产品横评/选购指南】
**逻辑**：总览→逐产品评测→参数对比→总结推荐
**📱 数码3C标题公式（必须使用，不能用其他赛道公式）**：
- 选购指南式：N年手机/电脑/耳机选购指南📱参数党一篇教会你看懂配置/不同预算怎么选一篇说清楚
- 真实体验式：苹果/安卓全家桶真实体验🍎这些坑替你们踩过了/安卓转iOS/iOS转安卓N天真实感受
- 预算推荐式：学生党XX怎么选💻XX-XX元价位推荐清单/X价位性价比之王是谁
- 对比横评式：XX vs XX到底选哪个？参数党狂喜🔥热门款全对比一篇看懂/降噪耳机横评谁更强
- 数码小白式：写给数码小白📖买XX前先看懂这几个参数销售骗不了你/别花冤枉钱这些根本没必要买
- 苹果生态式：iPhone/iPad/Mac/AirPods买了就回不去的苹果生态🍎/MacBook用了N个月那些没人说的事
- 安卓旗舰式：安卓旗舰大横评🔥小米/华为/OPPO/vivo怎么选/折叠屏值得买吗用了N个月说实话
- 配件避坑式：充电头/充电宝避坑指南🔋这些协议不兼容别踩雷/这些数码配件根本没必要买
- 桌面搭建式：桌面搭建分享⚡我的电竞/办公桌长这样/桌面改造计划极简/电竞/无线桌面
- 智能家居式：智能家居入坑指南🏠从0到1全屋智能方案/全屋智能花了多少钱实话分享
- 手机拍照式：手机拍照对决📸拍照手机横评原片直出/手机摄影进阶教程一部手机拍大片
- 显示器/外设式：显示器怎么选不踩雷🖥️参数/尺寸/分辨率一篇看懂/机械键盘/鼠标入坑推荐
- 安卓/苹果式：安卓转iOS N个月真实感受🏳️不吹不黑说大实话/为什么我从iPhone换回了安卓
- 游戏装备式：游戏党必看🔥性价比游戏本推荐/游戏主机/掌机怎么选Switch/SteamDeck/PS5
- 耳机/音箱式：真无线降噪耳机横评🎧不同价位推荐/通勤/运动适合什么耳机一篇说清楚
- 充电/续航式：充电宝/充电器避坑⚡快充协议别搞错了/续航最强的N款手机实测结果
- 平板/笔记本式：iPad买前必看！Pro/Air/mini到底怎么选🤔/轻薄本/全能本/游戏本按需选
- 购物节攻略式：等等党输了还是赢了？618/双十一数码价格复盘💰/今年哪些值得买哪些先别买
- 618/双十一式：数码产品什么时间买最划算📅全年价格规律总结/购物节抄作业清单这些值得入
- 黑科技/新奇式：这些黑科技数码好物太酷了🚀/相见恨晚的N个数码好物后悔没早买
**逻辑**：总览→各款展示→对比→总结
- pages结构（7页）：
  P1=成品款展示+标题（本期主题）
  P3-P6=各款式逐一展示（每页一个：手部特写+色号+价格+风格标签）
  P7=各款横向对比（款式+适合场景+推荐）
  P8=总结+最推荐+互动

===== 标签规则 =====
- 5-8个标签，放在body_text末尾（小红书格式：正文后空一行写标签）
- 标签格式：#标签名 用空格分隔，不用换行
- hashtags数组仅用于导出文件，不单独展示在界面上

===== 整体风格约束 =====
- 人称：姐妹们/宝子们（美妆/穿搭/美食/旅游），各位（通用/职场/书单/数码）
- 语气：口语化（谁懂啊/真的绝了/闭眼入/太狠了）
- 每段必须有实质信息（具体价格/数据/步骤），禁止空洞形容词堆砌
- ⚠️ **价格免责声明**：价格用模糊词（约/起/左右），禁止精确到个位数。**不要每个物品都标价**
- 所有文字必须是简体中文，**禁止出现任何英文内容**。标题、正文、标签、page story全部用简体中文。品牌名/产品名如有英文原称也请翻译或加中文注。
- **正文内容必须充实完整，信息密度要高**。干货类300-500字，种草类200-350字，视觉类也要达到150-250字。body_text绝对不能只有几十个字。每段必须有具体价格/数据/步骤。禁止空洞形容词堆砌。
- **小红书各赛道最优字数**：标题≤20字（含emoji），正文因赛道不同
  干货类（旅游/学习/职场/育儿/书单）：300-500字
  种草类（好物/数码/家居）：200-350字
  视觉类（穿搭/美妆/美食/美甲）：150-250字
- 如果正文超过上述限制，必须精简内容，不能截断
- **pages必须生成8个元素（page_id 1-8），全部为内容页，封面图独立生成**
- **禁止篡改用户输入中的地点名**
- **时效性：年份必须使用{{current_year}}年，月份使用{{current_month}}月**
- **P8不能是end/结束**：P8必须为总结推荐+总花费/推荐理由+互动引导CTA
- **内容多样化要求**：每次生成的标题句式、开头钩子、结尾CTA必须各不相同

【再次提醒】⚠️ **所有内容必须简体中文，禁止任何英文**。品牌名可保留但必须附中文。如果输出包含>3个英文单词（品牌名除外），输出不合格。

=== 输入内容 ===
品类：由用户输入的内容自动判断
文案：
{{text_content}}

== 如果品类是旅游攻略，P5必须是美食推荐页 ==
`;

const CONTENT_ANALYSIS_UP = `【强制】你只能基于「文案」字段的内容来写。文案写什么主题，你就生成什么内容。
▶ 文案是旅行内容 → 生成旅游攻略
▶ 文案是产品介绍 → 生成好物评测
▶ 文案是美食体验 → 生成美食探店
▶ 文案是护肤美妆 → 生成美妆护肤
▶ 文案是穿搭描述 → 生成穿搭分享
▶ 文案是学习经验 → 生成学习干货
▶ 文案是职场心得 → 生成职场干货
▶ 文案是影视/书籍 → 生成影视推荐/书单
▶ 文案是健康养生 → 生成健康养生

【强制】所有内容必须使用简体中文，**禁止输出任何英文**。菜品名、品牌名、产品名都必须用中文写。例如"coffee"写"咖啡"，"restaurant"写"餐厅"。
▶ 文案是家居改造 → 生成家居家装
▶ 文案是情感抒发 → 生成情感共鸣
▶ 文案是亲子育儿 → 生成育儿知识
生成的内容主题必须与文案一致，不能偏差。如果文案提到具体地名（如云南、大理），标题和正文必须保留这些地名。

品类：根据文案内容自动判断品类
检测到的品类：{{detected_category}}

严格按照以下JSON结构输出，不要输出任何多余内容。

**body_text字数由赛道决定（干货类300-500字，种草类200-350字，视觉类150-250字），严禁超出上限**。

**重要：category字段必须在JSON开头位置填写**
品类可选值：旅游攻略 | 好物评测 | 美食探店 | 穿搭分享 | 美妆护肤 | 美妆·化妆教程 | 数码3C | 学习干货 | 职场干货 | 家居家装 | 健身减肥 | 情感共鸣 | 影视推荐 | 一人食 | 书单推荐 | 美甲 | 健康养生 | 育儿知识 | 养生花茶

**pages数组必须包含8个元素（page_id 1-8），全部为内容页**

{
  "category": "此处填写品类名，从上方列表选一个",
  "title": "标题（红鸦式，参考【标题公式】）",
  "body_text": "完整正文（干货≤500字，种草≤350字，视觉≤250字）",
  "hashtags": ["#标签1", "#标签2"],
  "tags": [],
  "pages": [
    {"page_id":1,"page_type":"content","title":"页标题","hook":"一句话钩子","story":"核心内容（按赛道字数限制）","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":2,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":3,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":4,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":5,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":6,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":7,"page_type":"content","title":"延伸/对比","hook":"补充钩子","story":"横向对比或深度延伸","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":8,"page_type":"content","title":"总结推荐","hook":"互动引导","story":"总花费+推荐理由+CTA","info_blocks":[{"label":"总计","value":"金额"}],"layout_hint":"总结卡片+互动引导"}
  ]
}


=== 输入内容 ===
文案：
{{text_content}}

必须严格按照以上JSON结构输出，不要输出任何多余内容。`;

// ============================================================
// 工作流：内容分析
// ============================================================
async function contentAnalysis(textContent, refImageDescs = []) {
  // ===== 前置关键词分类：从用户输入提取品类（绕开LLM分类不可靠的问题） =====
  function detectCategory(text) {
    const t = text.toLowerCase();
    if (/旅游|旅行|攻略|景点|民宿|酒店|打卡|机票|高铁|自驾|古镇|县城|小众|反向|周末|度假|海滩|雪山|湖泊|路线|行程/.test(t)) return "旅游攻略";
    if (/护肤|精华|面霜|眼霜|洁面|防晒|面膜|水乳|早c晚a|成分|肤质|敏感肌/.test(t)) return "美妆护肤";
    if (/口红|眼影|腮红|粉底|化妆|教程|妆容|美妆/.test(t)) return "美妆·化妆教程";
    if (/穿搭|ootd|搭配|显瘦|显白|裙子|裤子|外套|鞋|包|配饰|风格/.test(t)) return "穿搭分享";
    if (/美食|探店|咖啡|餐厅|甜品|小吃|火锅|烧烤|外卖|菜单/.test(t)) return "美食探店";
    if (/便当|一人食|快手菜|做饭|食谱|烹饪|厨房/.test(t)) return "一人食";
    if (/评测|实测|测评|开箱|推荐|好物|种草|平价|购物/.test(t)) return "好物评测";
    if (/数码|手机|电脑|耳机|相机|平板|智能|科技|app/.test(t)) return "数码3C";
    if (/学习|考研|英语|考试|读书|笔记|方法|自律|打卡|成长/.test(t)) return "学习干货";
    if (/职场|工作|面试|简历|升职|加薪|打工|裸辞|副业/.test(t)) return "职场干货";
    if (/家居|装修|出租屋|改造|收纳|软装|北欧|极简/.test(t)) return "家居家装";
    if (/健身|减肥|瘦|运动|瑜伽|普拉提|跑步|健身/.test(t)) return "健身减肥";
    if (/情感|共鸣|治愈|心情|感悟|人生|成长|深夜/.test(t)) return "情感共鸣";
    if (/影视|电影|电视剧|综艺|追剧|纪录片/.test(t)) return "影视推荐";
    if (/书单|读书|书籍|阅读|推荐/.test(t)) return "书单推荐";
    if (/美甲|指甲/.test(t)) return "美甲";
    if (/养生|花茶|健康|中医|内调|食疗/.test(t)) return "健康养生";
    if (/育儿|宝宝|孩子|亲子|早教/.test(t)) return "育儿知识";
    if (/花草茶|花茶/.test(t)) return "养生花茶";
    return "";
  }
  const detectedCat = detectCategory(textContent);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  let enrichedText = textContent;
  // 🔑 如果上传了参考照片，把视觉描述注入 prompt，让 LLM 知道照片主体
  // 覆盖所有场景：人物（单人/多人/情侣/朋友/家人）、物品、食物、风景、宠物等
  if (refImageDescs.length > 0) {
    const validDescs = refImageDescs.filter(Boolean);
    if (validDescs.length > 0) {
      const descText = validDescs.map((d, i) => `照片${i + 1}：${d}`).join('；');
      enrichedText += `\n\n【参考照片】用户上传了 ${validDescs.length} 张参考照片，识别内容如下：${descText}。请严格按照照片内容生成匹配的主题——照片中有什么就写什么相关的内容。如果照片中是两个人（而非一个人），必须按两个人的关系来写；如果是产品、食物、风景等，围绕对应的对象来写。不能忽略照片中的主体。`;
      console.log(`[ref] ✅ 视觉描述成功: ${descText}`);
    } else {
      // 视觉识别完全失败时的降级：只告诉 LLM 用户上传了照片
      enrichedText += `\n\n【参考照片】用户上传了 ${refImageDescs.length} 张参考照片（未能识别具体画面内容）。请根据用户输入的文案推断照片中的主体——如果输入提到"我们/两人/合照/一起"等暗示多人的词汇，按多人关系（情侣/朋友/家人）生成；如果提到产品/地点/场景等，围绕该主题生成。务必不要忽略"照片"这一信息。`;
      console.log(`[ref] ⚠️ 视觉描述失败，使用文本推断降级 (${refImageDescs.length}张图)`);
    }
  }
  const sysPrompt = loadPromptWithVars('content-analysis-system.md', {
    current_year: currentYear, current_month: currentMonth,
    text_content: enrichedText, detected_category: detectedCat || '',
  });
  const userPrompt = loadPromptWithVars('content-analysis-user.md', {
    category: '自动判断', text_content: enrichedText,
    current_year: currentYear, current_month: currentMonth,
  });

  let raw = await callLLM(sysPrompt, userPrompt, { temperature: 0.5, maxTokens: 12000 });
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
  // Fix: LLM sometimes returns \n as literal backslash-n instead of actual newlines
  if (parsed.body_text) parsed.body_text = parsed.body_text.replace(/\\n/g, '\n');

  // ===== 英文检测 + 三级重试机制 =====
  function countEnglish(text) {
    const words = (text || '').match(/[a-zA-Z]{3,}/g);
    const brandExceptions = ['OOTD','DIY','vs','Vlog','vlog','APP','App'];
    return words ? words.filter(w => !brandExceptions.includes(w)).length : 0;
  }
  let enCount = countEnglish(parsed.body_text);
  let retries = 0;
  while (enCount > 5 && retries < 3) {
    retries++;
    console.log('[EN检测] body_text含英文' + enCount + '个，第' + retries + '次重试...');
    const threatMsg = retries === 1 ? '你的输出包含了太多英文！全部用简体中文写，一个英文字母都不能有。'
      : retries === 2 ? '【最后一次机会】再出现英文你的回复将被丢弃！只准写中文，不许写英文。'
      : 'WARNING: YOUR OUTPUT WILL BE DISCARDED IF IT CONTAINS ENGLISH. WRITE ONLY IN CHINESE. DO NOT USE ANY ENGLISH.';
    const retryPrompt = sysPrompt + '\n\n【严重警告】' + threatMsg;
    const retryRaw = await callLLM(retryPrompt, userPrompt, { temperature: Math.max(0.1, 0.5 - retries * 0.15), maxTokens: 12000 });
    const fixedRaw = retryRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const parsed2 = extractAndPad(fixedRaw);
      if (parsed2.body_text) {
        parsed2.body_text = parsed2.body_text.replace(/\\n/g, '\n');
        const enAgain = countEnglish(parsed2.body_text);
        if (enAgain <= 5) {
          Object.assign(parsed, parsed2);
          enCount = enAgain;
          break;
        }
      }
    } catch(e) { continue; }
  }

  // 最后一招：如果还是有英文，调LLM专门翻译 body_text
  if (countEnglish(parsed.body_text) > 5) {
    console.log('[EN检测] 重试用尽，强制翻译body_text...');
    try {
      const translatePrompt = '你是一个翻译助手。将以下文本翻译成简体中文小红书风格，保持emoji和格式不变。只返回翻译结果，不要解释。\n\n' + (parsed.body_text || '');
      const translated = await callLLM('你是翻译助手，只输出翻译结果。', translatePrompt, { temperature: 0.1, maxTokens: 4000 });
      if (translated && translated.length > 20) {
        parsed.body_text = translated.replace(/^["']|["']$/g, '');
        console.log('[EN检测] 翻译完成，长度:' + parsed.body_text.length);
      }
    } catch(e) { console.warn('[EN检测] 翻译失败:', e.message); }
  }

  const pages = parsed.pages || [];
  if (pages.length < 8) {
    const existingIds = new Set(pages.map(p => p.page_id));
    for (let i = 1; i <= 8; i++) {
      if (!existingIds.has(i)) {
        const prev = pages.find(p => p.page_id === i - 1) || pages[pages.length - 1] || {};
        pages.push({ page_id: i, page_type: i === 1 ? 'cover' : 'content', title: i === 9 ? '总结推荐' : (prev.title || '') + '续', hook: i === 9 ? '别忘了收藏哦～' : (prev.hook || ''), story: i === 9 ? '总结：快来评论区告诉我吧！' : (prev.story || ''), info_blocks: i === 9 ? [{ label: '总计', value: '待补充' }] : (prev.info_blocks || []), layout_hint: i === 9 ? '总结卡片+互动引导' : (prev.layout_hint || '') });
      }
    }
  }
  // 截断到8页(LLM可能输出多于8页)
  console.log(); if (pages.length > 8) pages.length = 8; console.log();

  // 旅游攻略后处理：P5改为美食推荐页（仅限category明确为旅游攻略且P5内容为空或可替换）
  if (parsed.category === '旅游攻略' && pages.length >= 5) {
    const p5 = pages.find(p => p.page_id === 5);
    if (p5 && (!p5.story || p5.story.length < 20 || p5.story.includes('推荐当地') || p5.story.includes('特色菜'))) {
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
      p5.title = '美食推荐';
      p5.story = `推荐${dest}当地3-4道地道特色美食，每道写明菜名+价格(参考当地人实际消费)+口感详细描述+推荐理由。必须围绕"${dest}"本地的真实招牌菜/小吃，不能写其他城市的菜系。`;
      p5.info_blocks = [{label:'推荐菜1',value:'价格'},{label:'推荐菜2',value:'价格'},{label:'推荐菜3',value:'价格'}];
      p5.layout_hint = '食物特写+拼盘展示(3-4样当地美食排列)，每样标注名称+价格+口感描述';
    }
  }

    // 最终保底：强制截断到8页
  if (pages.length > 8) pages.length = 8;

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
任务：根据内容方案，为【{{category}}】赛道生成8条内容页prompt，以及1条**独立封面prompt**，输出JSON。

## 核心规则
1. ⛔ 禁止横图：必须 portrait vertical 3:4 exact
2. ✅ **图片上必须包含中文文字标注**。用英文在prompt中描述中文文字的内容和位置，例如："top area with bold Chinese title '白衬衫+百褶裙 全身搭配展示'". 中文文字要清晰可读，与背景有足够对比度。
3. ✅ 所有内容留5%边距，不贴边
4. ⛔ 禁止深色/黑色/暗色背景，全部浅色/白色/柔和色
    **背景色根据内容氛围适配**：分析画面主题的情绪和氛围选择配色，避免全部使用相同的米黄/奶油色，让不同内容有视觉区分度
5. ✅ **每页必须不同排版**：连续两页严格禁止相同排版。8页中至少变化4种以上视觉结构。**排版要有创意**：避免死板的网格/行列排列。尝试放射状环绕排列、层叠交错、大小错落、透视角度。让画面有动感和设计感。有些页用上下分层，有些用左右分栏，有些用居中聚焦，有些用网格/拼贴排列，有些用错落叠放，有些用斜切/对角线分割。禁止连续2页相同排版。
6. ✅ 价格用模糊词（约/起/左右），只在总价或首项标价
7. ✅ 允许适度装饰：圆角卡片、柔和渐变、小图标/emoji点缀
8. ✅ 内容必须填满画布：3:4竖图覆盖≥75%画布高度。禁止大面积空白
9. ✅ 每页有明确视觉焦点：主体→陪体→背景层次
10. ✅ 画面要有真实感和质感，光影自然，材质细节丰富

**【关键】图片内容必须与页面内容严格对应**
每页的图片必须反映该页的【title】和【hook】和【layout_hint】中描述的主体内容。赛道模板只提供样式和排版参考，不能替代页面内容。
- 例如：如果P2的title是"甜酷水手服"，图片必须画水手服，不能画白衬衫/通勤装。
- 例如：如果P3是"面料/版型细节"，图片必须展示面料纹理或版型特写。
- 赛道模板的排版建议（如"全身搭配图"）要结合页面具体内容来执行。

## 【关键】JK/制服类专用英文术语（防止被误判为通勤装）
当内容涉及JK制服、水手服、西式制服、校园时尚时，以下英文术语**必须使用**：
- 水手服 sailor 类 → 必须写 "Japanese sailor school uniform, oversized navy collar with triple white stripes, red ribbon bow tie"
- 西式制服 blazer 类 → 必须写 "Japanese school blazer uniform, fitted navy jacket with gold school crest button, striped necktie"
- 百褶裙 → "Japanese school pleated miniskirt, box pleats, above knee length"
- 领结/领带 → "ribbon necktie, striped school tie, bow tie"
- 整体氛围 → "Japanese high school girl, kawaii, youthful street snap"
**禁止使用的词汇（导致通勤风误判）：**
❌ "corporate / office / professional / business casual / workwear"
❌ "white blouse" → 改用 "white dress shirt" 或 "sailor top"
❌ "navy jacket" → 改用 "sailor collar top" 或 "school blazer with crest"
❌ "business suit / office lady / workplace"

## 【关键】通用术语替换规则（所有赛道适用）
即使不属于JK制服类，也禁止在prompt中使用商务/办公室类词汇。上衣+裙子的搭配用 "campus style / preppy look" 而非 "office wear / work outfit"。

## 赛道专属视觉模板
{{category_rules}}

**【关键】赛道规则中提到的文字（标题、标签、标注、价格、品牌名等）必须直接渲染在图片上。在prompt里用英文描述这些中文文字的位置、大小和内容，确保图片上有清晰可读的中文文字。**

## 每页prompt生成规则
- **prompt用结构化字段驱动**：描述场景、主体、光线、构图、配色
- **必须使用三段式区域结构**：TOP x% + MIDDLE y% + BOTTOM z%，精确描述每块区域放什么
  - TOP区域：主视觉主体上部（约占15%）
  - MIDDLE区域：主体内容/场景/人物/物体（约占60%）
  - BOTTOM区域：底部装饰/背景延伸（约占20%）
- 英文prompt描述画面，同时必须描述图片上需要呈现的中文文字（标题、价格、标签、产品名等），例如："bottom 20%: Chinese price tag '约200元'"
- 竖图3:4（1024×1366）
- **背景色根据内容适配**：分析画面主题的氛围和情绪，选择最匹配的配色方案。例如：海滨内容用蓝白色系，美食内容用暖色系，科技内容用冷色系，护肤内容用柔和粉白色系。**避免每张图都用相同的米黄/奶油色**，让不同内容的图片有视觉区分度
- 连续两页不能用同一种排版方式
- 内容覆盖≥75%画布高度

## 封面prompt生成规则
- 封面图单独生成，**不包含在pages的8条prompt中**
- 封面prompt格式：竖图3:4 + 封面标题（**只能用中文写，禁止英文**）+ 视觉冲击力强的画面
- 封面标题必须使用简体中文汉字，不能用英文字母。品牌名/数字可以用英文/数字混排。
- 封面与内容页风格统一
- **封面必须用三段式区域结构**：TOP 20%（标题区，中文大标题）+ MIDDLE 60%（主视觉区）+ BOTTOM 20%

## 内容页prompt生成规则（8条）
- 内容页prompt**必须包含中文文字标注**（标题、价格标签、产品名等），用英文描述文字位置和内容
- 注意文字要与背景有对比度，确保可读
- **⛔ 禁止写 "Showing: 标题" 这种空泛描述**。必须根据该页的layout_hint写出具体的画面内容：人物姿态、场景配置、构图排版、配色方案、标注线/箭头位置。layout_hint里的描述必须100%转化为英文prompt。
- **【关键】模特多样性**：每页的模特必须不同——变脸型、发型、发色、身高体型、拍摄角度（正面/侧面/斜侧/背面）、姿势和站姿。禁止连续两页出现同一张脸。例如：P1齐肩发圆脸正面，P2高马尾长脸斜侧，P3双丸子头方脸背面。让人感觉每套搭配穿在不同真实的人身上。

## 输出格式
{"visual_system":"简短描述≤30字","cover_prompt":"英文prompt(竖图+中文标题+视觉冲击)≤280字符，标题必须简体中文","image_prompts":[{"page_id":1,"prompt":"英文prompt(含中文文字标注描述)≤280字符"},...]}
image_prompts共8条page 1-8。纯JSON。封面和内容页都需要包含中文文字，用英文描述文字位置和内容。
`;

const CATEGORY_RULES = {
  "旅游攻略": `视觉：手绘路线地图+拼贴风景，暖色纸张底纹，信息密度极高
封面：多景拼贴（4宫格地标照）+大字标题+价格数字
P1：行程总览卡（出发地->目的地路线图+总天数+人均预算+核心亮点关键词标签，暖色底纹手绘风格地图）
P2：路线图+节点标注城市/景点/交通方式/时间
P3-P5：每日行程（时间线+景点照+价格+Tips）
P6：美食拼盘（菜名+价格+口感）
P7：预算表格（交通/住宿/门票/餐饮）
P8：总结+CTA
配色：暖米/蓝白/翠绿底，文字用白/深褐
禁止：❌纯风景大片无标注 ❌信息量太少 ❌看不懂路线`,
  "好物评测": `视觉：产品实拍+拆解图+横向对比，白/浅灰底
封面：多品评测则封面必须展示所有产品（网格排列或多个产品环绕），非单品图
P1：产品总览卡（产品全景图+核心卖点标签+价格区间，左上角标题，底部评分星级。冷白/浅灰背景，产品居中高亮展示）
P2：产品平面图+配件+规格标签
P3：拆解爆炸图（零件分散+引导线+部件名）
P4：使用场景+功能标注
P5：Before/After对比图
P6：横向对比表（本品+竞品参数/价格/评分）
P7：优缺点分栏+综合评分
P8：总结+推荐+购买建议
配色：根据产品类型适配（科技=深灰/蓝调、生活=暖白/木色、美妆=柔粉/米色、运动=亮白/绿调）
信息密度：高——每页必须有价格/参数/评分
禁止：❌产品太小 ❌无参数/价格 ❌多品评测却只画一个产品`,
  "美食探店": `视觉：食物微距特写+手绘标注线+价格标签，暖橙/棕色调
封面：招牌菜大图+店名+人均价格
P1：美食总览（3-4道招牌菜缩略图排列+店名+人均价格+营业时间，暖橙色调，菜单风格排版）
P2-P4：各道菜特写（白色描边+价格+口感文字）
P5：拼盘展示（3-4道菜排列+名称）
P6：环境氛围+位置
P7：同类对比或推荐榜
P8：总结+推荐组合
禁止：❌冷色调 ❌无价格 ❌食物太小`,
  "穿搭分享": `视觉：杂志街拍风+单品拆解+干净背景
封面：全身照+风格标签+标题大字
P1：穿搭灵感板（3-4套不同风格缩略图拼贴+风格关键词标签，如"甜系/酷感/文艺"，每套标注核心单品名。左上角大标题显示本期穿搭主题，底部显示'今日穿搭灵感'副标题。整体柔和暖色调，杂志感版面设计）
P2-P4：各套详情页（每页展示一套完整搭配：全身展示+单品标注+价格标签+风格关键词，模特正面全身，标注每一个单品品牌/价格。短外套类突出腰线，连衣裙类展示裙摆，叠穿类展示层次）
P5：面料/版型细节（局部特写，对比展示不同版型差异，含价格标签标注）或配饰特写（袜子/鞋/包/发饰，标注价格和品牌）
P6：场景穿搭（校园/通勤/约会三格图）
P7：搭配技巧/风格对比（左右分屏对比图，标注差异点）
P8：总结+推荐单品（总价标注+推荐理由+互动CTA）
关键：必须包含模特全身展示、单品标注、价格标签、风格对比、OOTD`,
  "美妆护肤": `视觉：美妆杂志风，柔和自然光，面部/产品特写
封面：产品+使用效果+标题
P1：美妆单品总览（产品全貌+核心功效标签+适合肤质+价格，柔粉/米色背景，杂志感排版）
P2：产品参数+质地特写+评分
P3：成分功效分析图
P4：使用步骤教程
P5：Before/After效果对比
P6：优缺点+评分
P7：横向对比
P8：总结推荐
禁止：❌冷硬光线 ❌无成分/功效说明`,
  "数码3C": `视觉：科技产品摄影，冷白/深灰背景
封面：产品场景图+标题+核心卖点
P1：数码产品概览（产品全景+核心参数标签+价格，科技感排版，冷色调背景，参数围绕产品排列）
P2：产品全景+环绕参数标签
P3：拆解爆炸图（内部结构+元件标注）
P4：功能演示+界面
P5：参数对比表（本品+竞品）
P6：细节特写
P7：使用场景
P8：总结+推荐
禁止：❌暖色调 ❌无参数对比`,
  "学习干货": `视觉：知识信息图+卡片风，清爽有层次
封面：学习场景+标题+目标数据
P1：学习目录卡（核心方法/学习目标+时间规划+难度标签，卡片式排版，清爽蓝白配色）
P2-P7：方法步骤/避坑对比/资源推荐
P8：总结+CTA
禁止：❌纯文字无图 ❌排版千篇一律`,
  "职场干货": `视觉：商务知识卡，简洁有力
封面：办公场景+标题+核心数据
P1：职场知识目录（核心方法论+适用人群+核心数据标签，商务蓝/灰配色，简洁卡片式排版）
P2-P7：方法论/清单/案例/对比
P8：总结+行动建议
禁止：❌信息堆砌无层次`,
  "家居家装": `视觉：家居实景杂志风
封面：改造后全景+标题+花费
P1：改造前全景（房间原貌+核心问题标注+改造目标+预算区间，暖米色底，对比前状态展示）
P2：Before/After对比
P3-P5：各分区展示+单品标注
P6：好物推荐清单
P7：避坑Tips
P8：费用明细+总结
禁止：❌无人的空房间`,
  "健身减肥": `视觉：运动健身风，明亮活力
封面：运动场景+标题+成果数据
P1：健身计划总览（训练目标+时长+频率+核心动作概览，明亮活力配色，动感排版）
P2：数据总览+时间线
P3-P6：训练方法+动作图解
P7：饮食+食谱
P8：成果对比+CTA
禁止：❌无数据 ❌排版单一`,
  "美妆·化妆教程": `视觉：步骤式教程，柔和自然光
封面：完妆效果+标题
P1：妆容总览（完妆效果+所需产品清单+难度等级+预计用时，柔粉/浅米背景，优雅排版）
P2-P7：分步教程（底妆/眼妆/唇妆等）
P8：产品清单+总结
禁止：❌步骤不清 ❌无产品标注`,
  "情感共鸣": `视觉：治愈系文字+氛围感+留白
封面：大号金句+小装饰
P1：开篇引语（核心情感主题的大字，配柔和氛围插画或渐变背景，留白多，营造温暖治愈感）
P2-P7：每页一条感悟+留白
P8：回顾+互动
禁止：❌排版拥挤 ❌色彩艳丽`,
  "影视推荐": `视觉：影视推荐信息卡+评分推荐卡
封面：多部拼接+标题。**禁止虚构不存在的剧照/海报**，如果不知道真实海报，用"影视推荐信息卡"风格（文字卡片+评分星级+色块背景代替）。
P1：片单总览（推荐剧集名称+类型标签+豆瓣评分，标题居中或左上。**所有剧名必须真实存在、{{current_year}}年热播**）
P2-P7：每部一页（**文字卡片风格**：真实剧名+评分+推荐语+色块背景，不要虚构剧照海报）
P8：总结+互动
禁止：❌虚构不存在剧名 ❌虚构剧照/海报 ❌为真实剧生成不存在续集海报`,
  "一人食": `视觉：美食食谱卡，暖白/米色调
封面：成品+标题+时长
P2-P6：各天食谱（食材+步骤）
P7：备餐技巧
P8：总结
禁止：❌步骤不清 ❌食物不可口`,
  "美甲": `视觉：精致美甲展示，手部特写
封面：完成款+标题+色号
P2-P7：各款展示/步骤/对比
P8：总结
禁止：❌手部太小 ❌无颜色标注`,
  "书单推荐": `视觉：文艺书本实拍+金句卡
封面：书本堆叠+标题+数量
P2-P7：每本（封面+金句+推荐语+评分）
P8：总结+互动
禁止：❌书太小 ❌无推荐理由`,
  "健康养生": `视觉：自然食材+功效卡片风
封面：食材+标题+功效
P2-P7：食材拆解+功效/做法/注意
P8：总结
禁止：❌食材模糊 ❌无功效说明`,
  "通用": `视觉：小红书信息图，干净明亮浅色底
封面：标题+主视觉
P2-P7：按内容逻辑排列
P8：总结
禁止：❌文字堆砌 ❌无配图`,
};

const VISUAL_PLANNING_UP = `根据以下内容方案和品类，生成8条内容页图片创作提示词，以及1条封面图提示词。

【重要】每张图片的内容必须反映对应页面的title/hook/layout_hint，赛道视觉模板只提供排版和样式参考，具体的画面主体（人物、产品、场景、服饰等）必须来自页面内容本身。
{{ref_image_hint}}
**【影视推荐赛道专用规则】禁止为不存在续集生成海报，禁止编造虚构剧照。每页的prompt必须使用该页 title 字段的真实剧名，禁止自创其他剧名。如果不知道真实海报长什么样，用"文字信息卡片"代替：色块背景+剧名标题+豆瓣评分+推荐语，不要生成虚构海报/人物/场景。**

内容方案：
{{analysis_result}}
品类：{{category}}

输出JSON，包含visual_system、cover_prompt（封面独立）、image_prompts数组（8条，page_id 1-8）。
每条prompt包含：竖图3:4 + 该赛道对应页固定版式 + 赛道配色 + 留5%边距。prompt中必须描述图片里要出现的中文文字内容（标题、价格、标签等），用英文说明文字位置和内容。
`;


// ============================================================
// 工作流：视觉规划
// ============================================================
async function visualPlanning(analysisResult, refImageDescs = []) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // 🔑 如果有参考图，把视觉描述注入 prompt，让视觉规划生成匹配的 prompt
  // 覆盖所有场景：人物（单人/多人）、物品、食物、风景、宠物等
  const validDescs = refImageDescs.filter(Boolean);
  const refImageHint = validDescs.length > 0
    ? `**【参考照片提示】用户上传了参考照片，照片内容：${validDescs.map((d, i) => `照片${i + 1}："${d}"`).join('，')}。每页prompt的画面主体必须参考这些照片内容来写——照片中有什么就画什么。如果照片中是两个人，prompt必须写两个人；如果是一个人和一个产品，每页都要出现该产品和人。禁止虚构与照片不符的人物数量或性别。**\n`
    : refImageDescs.length > 0
    ? `**【参考照片提示】用户上传了 ${refImageDescs.length} 张参考照片（未能识别画面内容）。prompt中的画面主体应根据用户输入文案推断，如果是多人场景就写多人，如果是产品/食物等就围绕该对象。避免出现与用户上传内容矛盾的描述。**\n`
    : '';
  const analysisStr = JSON.stringify({
    category: analysisResult.category,
    title: analysisResult.title,
    pages: (analysisResult.pages || []).map(p => ({
      page_id: p.page_id, title: p.title, hook: p.hook,
      story: p.story, info_blocks: p.info_blocks, layout_hint: p.layout_hint
    }))
  }, null, 2);
  const categoryKey = analysisResult.category;
  const catRules = CATEGORY_RULES[categoryKey] || CATEGORY_RULES["通用"] || CATEGORY_RULES["好物评测"];
  const sysPrompt = loadPromptWithVars('visual-planning-system.md', {
    category: categoryKey, category_rules: catRules,
    current_year: currentYear, current_month: currentMonth,
  });
  const userPrompt = loadPromptWithVars('visual-planning-user.md', {
    analysis_result: analysisStr, category: analysisResult.category,
    ref_image_hint: refImageHint, current_year: currentYear, current_month: currentMonth,
  });

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
    .filter(p => p.page_id && p.page_id >= 1)
    .sort((a, b) => a.page_id - b.page_id);

  const needed = 8;
  if (prompts.length < needed && analysisResult.pages) {
    const existingIds = new Set(prompts.map(p => p.page_id));
    for (let pageId = 1; pageId <= 8; pageId++) {
      if (!existingIds.has(pageId)) {
        const page = analysisResult.pages.find(p => p.page_id === pageId);
        const story = page?.story || '';
        const title = page?.title || '';
        prompts.push({
          page_id: pageId,
          prompt: page
            ? `Xiaohongshu poster, vertical 3:4, photography style. ${title ? 'Title: ' + title + '. ' : ''}${story ? story.slice(0, 100) + '. ' : ''}Chinese text labels visible. Clean professional layout.`
            : `Xiaohongshu poster, vertical 3:4, info-graphic style. Include Chinese text labels, price tags, and titles visible on the image. Showing: ${title || 'scene'}. Clean layout, professional, readable Chinese text.`
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
  const MAX_WORKERS = 5;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (failed.has(task.id)) continue;
      try {
        const url = await generateImage(task.prompt, task.category || '通用');
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
  let uniqueUrls = contentResults
    .map(r => r.url)
    .filter(Boolean)
    .filter(url => {
      const path = extractPath(url);
      if (seenPaths.has(path)) return false;
      seenPaths.add(path);
      return true;
    });

  // ===== 封面二次校验：封面URL不能出现在内容列表中 =====
    if (coverResult?.url) {
      const coverPath = extractPath(coverResult.url);
      uniqueUrls = uniqueUrls.filter(u => extractPath(u) !== coverPath);
    }

  // ===== 🔑 关键修复：按 page_id 对齐图片和内容页 =====
  // 内容分析可能生7页(如无P2)，但图片生8张。跳过没有对应内容页的图片。
  const existingPageIds = new Set((analysis.pages || []).map(p => p.page_id));
  const sortedPrompts = (visual.imagePrompts || []).sort((a,b) => a.page_id - b.page_id);
  const alignedUrls = [];
  for (let i = 0; i < uniqueUrls.length && i < sortedPrompts.length; i++) {
    if (existingPageIds.has(sortedPrompts[i].page_id)) {
      alignedUrls.push(uniqueUrls[i]);
    }
  }

  // 同步过滤 image_prompts，保持与 image_urls 对齐
  const alignedPrompts = (visual.imagePrompts || []).filter(function(p){
    return existingPageIds.has(p.page_id);
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
    image_prompts: alignedPrompts,
    cover_url: coverResult?.url || '',
    image_urls: alignedUrls,
    image_count: alignedUrls.length,
  };
}

// ============================================================
// 单张图片重新生成
// ============================================================
app.post('/api/regenerate-image', async (req, res) => {
  const { prompt, category } = req.body;
  if (!prompt) return res.status(400).json({ error: '缺少prompt' });
  try {
    // 复用 generateImage 以获得JK检测/赛道优化
    const url = await generateImage(prompt, category || '', false);
    if (!url) throw new Error('生成失败');
    res.json({ url });
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
// 电商生图
// ============================================================

const EC_CATEGORIES = ['美妆护肤', '数码3C', '食品饮料', '服饰穿搭', '家居生活', '母婴用品', '宠物用品', '其他'];

const EC_PLATFORMS = ['淘宝', '京东', '拼多多', '小红书电商', '抖音电商', '亚马逊'];

const EC_PLATFORM_DESC = {
  '淘宝': '淘宝/天猫商品展示',
  '京东': '京东商品详情',
  '拼多多': '拼多多商品主图',
  '小红书电商': '小红书商城商品图',
  '抖音电商': '抖音小店商品展示',
  '亚马逊': 'Amazon跨境的商品图',
};

// 电商场景提示词模板（按品类+风格）

// 电商场景提示词模板（按品类+风格）
const EC_PROMPT_TEMPLATES = {
  '白底主图': {
    '美妆护肤': 'E-commerce product photography. {product} centered on pure white background, studio lighting, soft shadows, 360-degree product visibility, clean composition, high-end cosmetic photography style, sharp focus on product details, minimalist aesthetic. NO text overlay. NO people. Shot on 85mm lens.',
    '数码3C': 'E-commerce product photography. {product} centered on pure white background, studio lighting, soft reflections on surface, precise product details visible, tech product photography style, clean edges, sharp focus, 3/4 angle slightly elevated. NO text overlay. NO people. Professional studio shot.',
    '食品饮料': 'E-commerce food photography. {product} centered on clean bright white background, studio lighting, fresh appearance, natural shadows, product packaging clearly visible, appetizing presentation, professional food photography. NO text overlay. NO people. Sharp focus.',
    '服饰穿搭': 'E-commerce fashion product photography. {product} on pure white background, studio lighting, fabric texture visible, clean fold-free presentation, professional mannequin or flat lay, sharp detail on material. NO text overlay. Studio photography.',
    '家居生活': 'E-commerce product photography. {product} centered on white background, soft studio lighting, clean composition, product details sharp, home goods photography style. NO text overlay. NO people.',
    default: 'E-commerce product photography. {product} centered on pure white background, professional studio lighting, soft shadows, sharp focus. NO text overlay. NO people. White background, 1:1 square format.'
  },
  '场景图': {
    '美妆护肤': 'E-commerce lifestyle product photography. {product} displayed in an elegant bathroom vanity setting, premium brand aesthetic, soft natural window light, clean white marble surface, subtle pastel tones, studio lighting, professional e-commerce product scene, vertical 3:4. Chinese product label visible.',
    '数码3C': 'E-commerce lifestyle product photography. {product} on a clean modern desk setup with ambient lighting, organized workspace tech style, professional product showcase, soft shadows, premium lifestyle context, vertical 3:4. Chinese text visible on product.',
    '食品饮料': 'E-commerce lifestyle food photography. {product} displayed on a rustic wooden table with natural ingredients around it, fresh and clean presentation, professional food styling, warm studio lighting, product packaging clearly visible, vertical 3:4. Chinese labels visible.',
    '服饰穿搭': 'E-commerce fashion product photography. {product} professionally displayed, fabric texture clearly visible, clean presentation, studio lighting, fashion e-commerce style, professional product showcase, vertical 3:4. Chinese price tags visible.',
    '家居生活': 'E-commerce lifestyle home decor photography. {product} styled in a clean modern room setting, warm ambient lighting, professional interior showcase, cozy but professional presentation, home goods e-commerce style, vertical 3:4.',
    default: 'E-commerce lifestyle product photography. {product} in a clean professional setting, warm studio lighting, professional product showcase, lifestyle context, vertical 3:4.'
  },
  '详情图': {
    '美妆护肤': 'Professional detail shot of {product}. Macro photography showing product texture, ingredients visible, with elegant Chinese text overlay highlighting key features and benefits. Clean white or gradient background. Premium beauty product detail. Chinese annotations: ingredients, benefits, usage instructions.',
    '数码3C': 'Technical detail shot of {product}. Close-up showing product features, ports, materials with Chinese technical labels and spec highlights. Dark or gradient background. Product feature callouts in Chinese text. Professional tech product detail photography.',
    '食品饮料': 'Product detail of {product}. Ingredients/nutrition information layout, with Chinese text labels showing ingredients list, nutritional values, and product features. Clean bright background. Professional food packaging detail photography.',
    default: 'Product detail photography of {product}. Close-up showing product features and details. Chinese text labels highlighting key selling points. Clean background. Professional macro product photography.'
  },
  '组合图': {
    '美妆护肤': 'Brand display composition for {product}. Split layout showing: 1) product bottle hero shot, 2) texture close-up, 3) lifestyle usage scene. Unified elegant beauty aesthetic, consistent lighting. Chinese brand name and tagline integrated into composition. Premium cosmetic brand visual.',
    '数码3C': 'Product showcase composition for {product}. Multi-panel layout showing: product front view, key features callouts with Chinese text labels, and lifestyle usage scene. Modern tech aesthetic, consistent dark/sleek theme. Chinese product name visible.',
    default: 'Product display composition for {product}. Multi-image layout showcasing product from multiple angles with Chinese text labels highlighting key features and benefits. Professional clean design.'
  }
};

const EC_ASPECT_RATIOS = {
  '淘宝': { '白底主图': '800x800', '场景图': '800x800', '详情图': '750x1000', '组合图': '750x1000' },
  '京东': { '白底主图': '800x800', '场景图': '800x800', '详情图': '790x1000', '组合图': '790x1000' },
  '拼多多': { '白底主图': '800x800', '场景图': '800x800', '详情图': '750x1000', '组合图': '750x1000' },
  '小红书电商': { '白底主图': '1024x1366', '场景图': '1024x1366', '详情图': '1024x1366', '组合图': '1024x1366' },
  '抖音电商': { '白底主图': '1024x1366', '场景图': '1024x1366', '详情图': '1024x1366', '组合图': '1024x1366' },
  '亚马逊': { '白底主图': '1000x1000', '场景图': '1000x1000', '详情图': '1000x1000', '组合图': '1000x1000' },
};

// 电商生成单张图片（含多参考图支持）
async function generateECImage(productName, category, imageType, platform, referenceImages, sellingPoints) {
  const cat = EC_CATEGORIES.includes(category) ? category : '其他';
  const templates = EC_PROMPT_TEMPLATES[imageType] || EC_PROMPT_TEMPLATES['白底主图'];
  const template = templates[cat] || templates.default || EC_PROMPT_TEMPLATES['白底主图'].default;
  let prompt = template.replace(/\{product\}/g, productName);
  if (sellingPoints) prompt += ` Key selling points: ${sellingPoints}.`;

  // 获取尺寸
  const ratios = EC_ASPECT_RATIOS[platform] || EC_ASPECT_RATIOS['淘宝'];
  const size = ratios[imageType] || '800x800';

  const url = `${IMG_BASE}/v1/images/edits`;
  const body = {
    model: IMG_MODEL,
    prompt: prompt,
    n: 1,
    size: '1024x1366',  // edits endpoint 尺寸有限制，实际前端再裁
    quality: 'standard',
    response_format: 'url',
  };

  // 如果有参考图，用 multipart FormData 传多张
  let response;
  let resultUrl;
  if (referenceImages && referenceImages.length > 0) {
    const fd = new FormData();
    fd.append('model', body.model);
    fd.append('prompt', body.prompt);
    for (const imgData of referenceImages.slice(0, 5)) {
      const buf = Buffer.from(imgData.split(',')[1] || imgData, 'base64');
      const mime = imgData.startsWith('data:image/png') ? 'image/png' : 'image/webp';
      fd.append('image', new Blob([buf], { type: mime }), `ref-${Date.now()}.${mime === 'image/png' ? 'png' : 'webp'}`);
    }
    fd.append('n', '1');
    fd.append('size', body.size);

    const controller = new AbortController();
    const timeout = setTimeout(() => { try { controller.abort(); } catch(e) {} }, 120000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${IMG_KEY}` },
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`edits API ${res.status}: ${errText.slice(0, 100)}`);
      }
      const data = await res.json();
      response = data;
    } catch(e) {
      clearTimeout(timeout);
      throw e;
    }
    if (response?.data?.[0]?.url) {
      resultUrl = response.data[0].url;
    }
  } else {
    resultUrl = await callImageAPI(prompt, null);
  }

  if (resultUrl) return resultUrl;
  throw new Error('电商生图失败: 未返回图片URL');
}

// 电商生图入口
app.post('/api/generate-ecommerce', async (req, res) => {
  const { product_name, category, reference_images, styles, platform, selling_points } = req.body;
  if (!product_name?.trim()) return res.status(400).json({ error: '请输入商品名称' });

  const cat = EC_CATEGORIES.includes(category) ? category : '其他';
  const plat = EC_PLATFORMS.includes(platform) ? platform : '淘宝';
  const imgTypes = styles && styles.length > 0 ? styles : ['白底主图', '场景图', '详情图', '组合图'];

  try {
    const results = {};
    const errors = [];

    for (const style of imgTypes) {
      try {
        console.log(`[EC] 生成 ${cat}/${style}/${plat}...`);
        const url = await generateECImage(product_name, cat, style, plat, reference_images || [], selling_points || '');
        if (url) {
          results[style] = url;
          console.log(`[EC] ${style} 成功:`, url.substring(0, 60));
        }
      } catch(e) {
        errors.push({ style, error: e.message });
        console.error(`[EC] ${style} 失败:`, e.message);
      }
    }

    res.json({
      product_name,
      category: cat,
      platform: plat,
      images: results,
      styles_generated: imgTypes.filter(s => results[s]),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API 路由
// ============================================================

// P2（封面后第一张）完全独立生成——基于用户原始输入构造，不走 LLM 视觉规划
function buildP2SafePrompt(analysis, userText) {
  const p2Page = (analysis.pages || []).find(p => p.page_id === 1);
  if (!p2Page) {
    console.log('[P2] WARN: no page data, fallback to topic prompt');
    const t = (userText || '').replace(/\p{Emoji}/gu, '').trim().slice(0, 60);
    const fb = 'Xiaohongshu poster, vertical 3:4. A clean scene with Chinese text "' + t + '" visible. Chinese text annotations required. Professional photography.';
    console.log('[P2] fallback len=' + fb.length);
    return fb;
  }

  const title = p2Page.title || '';
  const story = (p2Page.story || '').slice(0, 80);
  const cat = analysis.category || '';
  // 从用户原始输入提取核心主题（去掉 emoji 和空格）
  const topic = (userText || '').replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '').trim().slice(0, 60);

  // 【全新思路】每个赛道写死一个强绑定的 prompt，把用户原文嵌入其中，
  // 确保图片内容 100% 围绕主题，不给 AI 任何自由发挥空间
  let prompt;
  if (/学习干货|书单推荐/.test(cat)) {
    prompt = `A wooden study desk. ON THE DESK: 1) An open textbook with Chinese title "${topic}" on its cover page. 2) A black ballpoint pen resting on the book. 3) A yellow highlighter. 4) A cup of coffee. Soft natural window light. The textbook shows Chinese text clearly. DO NOT show skincare, beauty products, or fashion items.`;
  } else if (/旅游攻略/.test(cat)) {
    prompt = `A travel planning desk. ON THE DESK: 1) A printed travel map with Chinese labels. 2) A passport. 3) A camera. 4) A coffee cup. 5) A luggage tag with "${topic}" in Chinese. Natural sunlight. Travel mood. Chinese text labels visible.`;
  } else if (/美食探店|一人食/.test(cat)) {
    prompt = `A restaurant dining table. ON THE TABLE: 1) A plate of delicious food. 2) Chopsticks. 3) A Chinese menu showing "${topic}". 4) A small price tag. Warm golden lighting, steam rising from the dish. Chinese text visible.`;
  } else if (/好物评测/.test(cat)) {
    prompt = `A clean white surface. ON THE SURFACE: 1) The product being reviewed with Chinese label "${topic}". 2) A handwritten review card in Chinese. 3) A price tag. Soft studio lighting. Chinese product labels clearly visible.`;
  } else if (/穿搭分享/.test(cat)) {
    prompt = `Studio fashion photography. An adult female model (age 25-28). SHE WEARS: a navy blue blouse with wide sailor-style collar and white trim, a red ribbon necktie, a gray pleated mini skirt, knee-high socks, and black leather shoes. Full body shot facing forward. Clean light gray background. Soft studio lighting. Chinese price labels visible on each clothing item. Fashion editorial style. NO office wear, NO business suit.`;
  } else if (/美妆护肤|美妆·化妆教程/.test(cat)) {
    prompt = `A clean white vanity table. ON THE TABLE: 1) Skincare products with Chinese label "${topic}". 2) A mirror. 3) Small price tags in Chinese. Soft natural light. Clean minimal composition. Chinese labels visible.`;
  } else if (/数码3C/.test(cat)) {
    prompt = `A dark gray surface. ON THE SURFACE: 1) The tech product with Chinese label "${topic}". 2) Product specs card in Chinese. 3) A price tag. Dramatic side lighting, metallic reflections. Chinese text visible.`;
  } else if (/职场干货/.test(cat)) {
    prompt = `A clean office desk. ON THE DESK: 1) An open notebook with Chinese handwriting "${topic}". 2) A laptop. 3) A coffee cup. 4) A pen holder. Natural light streaming in. Clean minimalist workspace. Chinese sticky notes visible.`;
  } else if (/家居家装/.test(cat)) {
    prompt = `A cozy room interior. IN THE ROOM: 1) A comfortable sofa. 2) A coffee table with a Chinese home magazine showing "${topic}". 3) A potted plant. 4) Warm throw pillows. Natural light through curtains. Scandinavian style. Chinese furniture labels visible.`;
  } else if (/健身减肥/.test(cat)) {
    prompt = `A clean workout space. IN THE SPACE: 1) A yoga mat. 2) A pair of dumbbells. 3) A water bottle. 4) A Chinese fitness guide with "${topic}". Bright natural light. Clean workout area. Chinese fitness text visible.`;
  } else if (/情感共鸣/.test(cat)) {
    prompt = `A cozy corner. IN THE SCENE: 1) A warm desk lamp. 2) An open book. 3) A cup of tea. 4) A handwritten Chinese quote about "${topic}". Soft warm lighting. Peaceful mood. Chinese calligraphy text visible.`;
  } else if (/影视推荐/.test(cat)) {
    prompt = `A cinematic display. ON THE DISPLAY: Chinese text "${topic}" in large film-poster style typography. Dark background with warm gold accent lighting. Chinese title and rating visible.`;
  } else {
    prompt = `A clean scene related to "${topic}". ${title}. Chinese text labels visible. Soft natural lighting, professional photography.`;
  }

  // 加上通用前缀和后缀，保证生成质量和中文文字
  const prefix = 'Xiaohongshu poster, vertical 3:4, photo-realistic, photography style. ';
  const suffix = ' Chinese text annotations REQUIRED. Leave 5% margin from ALL edges. Portrait ONLY. High quality, detailed, professional.';
  const full = prefix + prompt + suffix;
  if (full.length > 700) return full.slice(0, 697) + '...';
  return full;
}

app.post('/api/generate', async (req, res) => {
  const { text, images, preview } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  const isPreview = preview === true;
  if (isPreview) console.log('[preview] 预览模式：仅生成文案+封面');

  // ===== 处理上传的参考图片 =====
  const UPLOADS_DIR = resolve(__dirname, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  let uploadedUrls = [];
  if (images && Array.isArray(images) && images.length > 0) {
    const maxImages = 3;
    for (let i = 0; i < Math.min(images.length, maxImages); i++) {
      try {
        const imgData = images[i];
        if (!imgData || typeof imgData !== 'string') continue;
        const matches = imgData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) continue;
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `ref_${Date.now()}_${i}.${ext}`;
        fs.writeFileSync(join(UPLOADS_DIR, filename), buffer);
        uploadedUrls.push(`http://localhost:3099/api/uploads/${filename}`);
      } catch(e) {
        console.error('[upload] 保存参考图失败:', e.message);
      }
    }
    if (uploadedUrls.length > 0) {
      console.log('[upload] 已保存', uploadedUrls.length, '张参考图');
    }
  }
  const refImages = uploadedUrls;

  // SSE 流式输出 - 每完成一张图立刻推送给前端
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (type, data) => {
    try { res.write('data: ' + JSON.stringify({ type, ...data }) + '\n\n'); } catch(e) {}
  };
  console.log('\n=== 开始工作流: "' + text.slice(0, 40) + '..." ===');

  // ===== 用视觉能力描述参考图主体（覆盖所有场景） =====
  let refImageDescs = [];
  if (images && Array.isArray(images) && images.length > 0) {
    send('progress', { step: 'analyzing_ref', msg: '正在分析参考图...' });
    refImageDescs = await describeImages(images);
    if (refImageDescs.length > 0 && refImageDescs.some(Boolean)) {
      console.log('[describeImages] 参考图描述:', refImageDescs.filter(Boolean).join(' | '));
    }
  }

  try {
    send('progress', { step: 'content_analysis', msg: '正在分析内容...' });
    const analysis = await contentAnalysis(text, refImageDescs);

    // ===== 内容分析后立即保存作品（标题和文案先落盘，图片后续更新） =====
    if (analysis && analysis.title) {
      try {
        const works = loadWorks();
        const tmpSave = { title: analysis.title, body_text: analysis.body_text,
          hashtags: analysis.hashtags, category: analysis.category, pages: analysis.pages,
          cover_url: '', image_urls: [], image_count: 0, cover_prompt: '', image_prompts: [],
          _saveKey: 'gen-' + Date.now(), at: new Date().toLocaleDateString('zh-CN'),
          id: Date.now() };
        works.unshift(tmpSave);
        if (works.length > 100) works.length = 100;
        saveWorks(works);
      } catch(e) { console.error('[save-draft] 草稿保存失败:', e.message); }
    }

    send('progress', { step: 'visual_planning', msg: '正在规划视觉...' });
    const visual = await visualPlanning(analysis, refImageDescs);

    // ===== 影视推荐赛道：从正文解析真实剧名，强制替换prompt =====
    if (/影视推荐/.test(analysis.category)) {
      const pages = analysis.pages || [];
      // 从正文提取《》中的真实剧名
      const realShows = (analysis.body_text || '').match(/《([^》]+)》/g) || [];
      const showNames = realShows.map(s => s.replace(/[《》]/g, '')).filter(Boolean);
      // 再从 pages 取 title（LLM可能填了"续"，用showNames覆盖）
      const pageTitles = pages.filter(p => p.page_id >= 2).map(p => {
        const t = (p.title || '').trim();
        if (!t || t === '续' || t === '续续' || t === '续续续' || t.match(/^续+$/)) return '';
        return t;
      }).filter(Boolean);
      const titles = [...new Set([...pageTitles, ...showNames])].filter(Boolean).slice(0, 6);
      const titleList = titles.join('、');

      // 重写封面prompt
      visual.coverPrompt = 'Portrait vertical 3:4. Top area with bold Chinese title text in golden font on dark warm background. Middle area: a collage of six different dramatic scenes arranged artistically - ancient Chinese palace, misty mountains, traditional opera stage, ink wash painting, city nightscape, and bamboo forest. Each scene with its own lighting color. Film poster style, dramatic shadows, rich colors.';

      // 重写内容页prompt
      visual.imagePrompts = pages.filter(p => p.page_id >= 2 && p.page_id <= 8).map((p, i) => {
        const scenes = [
          'Chinese palace hall with warm golden sunlight streaming through carved windows. Epic historical atmosphere. Rich red and gold colors.',
          'Dimly lit police station at night with colorful neon lights reflecting off wet streets. Playful mystery atmosphere.',
          'Warm nostalgic Chinese street scene from the 1980s. Old brick buildings, sunset light, bicycles. Sepia-toned mood.',
          'Elegant traditional Chinese ink painting studio. Brushes, ink stones, rice paper. Soft natural light. Simple zen composition.',
          'Ancient Chinese garden with pavilions, cherry blossoms, moon gate. Soft misty atmosphere, pastel colors. Romantic mood.',
          'Traditional Chinese opera stage with elaborate costumes and masks. Dramatic spotlight, rich crimson and gold colors.',
          'Cozy modern living room with warm lamp light, bookshelf filled with books, tea cup on wooden table. Relaxing thoughtful mood.'
        ];
        return { page_id: p.page_id, prompt: 'Portrait vertical 3:4. ' + scenes[i] + ' Beautiful photography style, professional lighting. Artistic composition.' };
      });
      console.log('[影视推荐] 已覆盖prompt，剧名:', titleList);
    }

    // 并发生图（每完成一张就推送）
    let allPrompts = [
      { id: 'cover', prompt: visual.coverPrompt, category: analysis.category },
      ...visual.imagePrompts.map(p => ({ id: 'p' + p.page_id, prompt: p.prompt, category: analysis.category })),
    ];

    // 🔑 预览模式：只生成封面，跳过8张内容图
    if (isPreview) {
      allPrompts = allPrompts.filter(t => t.id === 'cover');
      console.log('[preview] 仅生成封面图，跳过 ' + visual.imagePrompts.length + ' 张内容图');
    }

    // ===== 产品类赛道（美妆护肤/好物评测/数码3C等）内容页强制显示产品 =====
    const productCats = ['美妆护肤','美妆·化妆教程','好物评测','数码3C'];
    allPrompts.forEach(t => {
      if (t.id !== 'cover' && productCats.some(c => analysis.category?.includes(c))) {
        t.prompt = (t.prompt || '') + ' The product with Chinese price label must be clearly visible.';
      }
    });

    // 【关键】全局检测：如果这组prompts中任何一张涉及JK制服，所有图都追加制服风格描述
    const jkKeywordsGlobal = [/水手服/,/JK/,/制服/,/百褶裙/,/领结/,/sailor/i,/seifuku/i,/校服/,/校园/,/日系/];
    const hasJKContext = allPrompts.some(t => jkKeywordsGlobal.some(k => k.test(t.prompt))) ||
      (analysis.pages || []).some(p => /水手服|JK|制服|校服|校园|日系/.test(JSON.stringify(p)));
    // 给所有任务打上jkContext标记
    allPrompts.forEach(t => t.jkContext = hasJKContext);
    if (hasJKContext) console.log('[JK context] 全部 ' + allPrompts.length + ' 张图启用校园风覆盖模式');

    const results = [];
    const queue = [...allPrompts];
    const MAX_WORKERS = 5;

    send('progress', { step: 'generating_images', msg: '正在生成图片...', total: allPrompts.length });

    async function worker() {
      while (queue.length > 0) {
        const task = queue.shift();
        let lastErr = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) await new Promise(r => setTimeout(r, 2000 * (attempt - 1)));
            const url = await generateImage(task.prompt, task.category, task.id === 'cover', task.jkContext, refImages?.[0]);
            if (url) {
              results.push({ id: task.id, url });
              send('image', { id: task.id, url });
              lastErr = null;
              break;
            }
          } catch(e) {
            lastErr = e.message;
            console.error('[gen]', task.id, 'attempt', attempt, 'failed:', e.message);
          }
        }
        if (lastErr) console.error('[gen]', task.id, 'all attempts failed:', lastErr);
      }
    }
    const workers = Array.from({ length: Math.min(MAX_WORKERS, allPrompts.length) }, () => worker());
    await Promise.all(workers);

    send('progress', { step: 'assembling', msg: '正在组装结果...' });
    const result = assembleResults(analysis, visual, results);

    // ===== 服务器端更新作品（补上图片URL，覆盖草稿） =====
    if (analysis.title) {
      try {
        const works = loadWorks();
        // 查找之前保存的草稿（按标题匹配），更新图片信息
        const idx = works.findIndex(w => w.title === analysis.title && w.cover_url === '');
        const saveWork = { title: analysis.title, body_text: analysis.body_text, hashtags: analysis.hashtags,
          category: analysis.category, pages: analysis.pages, cover_url: result.cover_url || '',
          image_urls: result.image_urls || [], image_count: result.image_count || 0,
          cover_prompt: visual.coverPrompt || '',
          image_prompts: result.image_prompts || [],
          _saveKey: String(Date.now()), id: Date.now(), at: new Date().toLocaleDateString('zh-CN') };
        if (idx >= 0) {
          works.splice(idx, 1, saveWork); // 更新草稿，保留位置
        } else {
          works.unshift(saveWork); // 没找到草稿就新建
        }
        if (works.length > 100) works.length = 100;
        saveWorks(works);
      } catch(e) { console.error('[auto-save] 失败:', e.message); }
    }

    send('complete', {
      title: analysis.title,
      body_text: analysis.body_text,
      hashtags: analysis.hashtags,
      category: analysis.category,
      visual_system: visual.visualSystem,
      pages: analysis.pages,
      cover_url: result.cover_url || '',
      image_urls: result.image_urls || [],
      image_count: result.image_count || 0,
      cover_prompt: visual.coverPrompt || '',
      image_prompts: result.image_prompts || [],
      preview: isPreview,
    });
  } catch(err) {
    console.error('!! 工作流失败:', err.message);
    send('error', { error: err.message });
  } finally { res.end(); }
});app.post('/api/analyze', async (req, res) => {
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
const SNAP_DIR = resolve(__dirname, 'backups');
function loadWorks() {
  try {
    if (fs.existsSync(WORKS_PATH)) {
      const data = JSON.parse(fs.readFileSync(WORKS_PATH, 'utf8'));
      // 主文件正常（非空数组）直接返回
      if (Array.isArray(data) && data.length > 0) return data;
      // 主文件异常（空数组等），尝试从备份恢复
      if (Array.isArray(data) && data.length === 0) {
        console.warn('[loadWorks] 主文件为空，尝试从备份恢复...');
        for (const ext of ['.bak1', '.bak2', '.bak3']) {
          const bakPath = WORKS_PATH + ext;
          if (fs.existsSync(bakPath)) {
            try {
              const bak = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
              if (Array.isArray(bak) && bak.length > 0) {
                fs.writeFileSync(WORKS_PATH, JSON.stringify(bak), 'utf8');
                console.log('[loadWorks] 从 ' + ext + ' 恢复成功，共 ' + bak.length + ' 条');
                return bak;
              }
            } catch(e) { continue; }
          }
        }
        // 从快照目录恢复最新的
        try {
          if (fs.existsSync(SNAP_DIR)) {
            const snaps = fs.readdirSync(SNAP_DIR).filter(f => f.startsWith('works-') && f.endsWith('.json')).sort();
            if (snaps.length > 0) {
              const last = JSON.parse(fs.readFileSync(join(SNAP_DIR, snaps[snaps.length-1]), 'utf8'));
              if (Array.isArray(last) && last.length > 0) {
                fs.writeFileSync(WORKS_PATH, JSON.stringify(last), 'utf8');
                console.log('[loadWorks] 从快照 ' + snaps[snaps.length-1] + ' 恢复成功');
                return last;
              }
            }
          }
        } catch(e) {}
      }
    }
  } catch(e) {
    // JSON 解析失败，尝试从备份恢复
    console.warn('[loadWorks] 主文件损坏，尝试从备份恢复...');
    for (const ext of ['.bak1', '.bak2', '.bak3']) {
      const bakPath = WORKS_PATH + ext;
      if (fs.existsSync(bakPath)) {
        try {
          const bak = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
          if (Array.isArray(bak) && bak.length > 0) {
            fs.writeFileSync(WORKS_PATH, JSON.stringify(bak), 'utf8');
            console.log('[loadWorks] 从 ' + ext + ' 恢复成功');
            return bak;
          }
        } catch(e) { continue; }
      }
    }
  }
  return [];
}
function saveWorks(works) {
  try {
    const now = new Date();
    const ts = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + 'T' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');
    const data = JSON.stringify(works.slice(0, 100));

    // ① 轮转备份：保留最近3份
    try {
      if (fs.existsSync(WORKS_PATH + '.bak2')) fs.renameSync(WORKS_PATH + '.bak2', WORKS_PATH + '.bak3');
      if (fs.existsSync(WORKS_PATH + '.bak1')) fs.renameSync(WORKS_PATH + '.bak1', WORKS_PATH + '.bak2');
      if (fs.existsSync(WORKS_PATH)) fs.copyFileSync(WORKS_PATH, WORKS_PATH + '.bak1');
    } catch(e) {}

    // ② 写入主文件
    fs.writeFileSync(WORKS_PATH, data, 'utf8');

    // ③ 时间戳快照（每天最多保留30份，自动清理旧快照）
    const SNAP_DIR = resolve(__dirname, 'backups');
    try {
      if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
      const snapPath = join(SNAP_DIR, 'works-' + ts + '.json');
      fs.writeFileSync(snapPath, data, 'utf8');
      // 清理超过30份的旧快照
      const snaps = fs.readdirSync(SNAP_DIR).filter(f => f.startsWith('works-') && f.endsWith('.json')).sort();
      while (snaps.length > 30) {
        fs.unlinkSync(join(SNAP_DIR, snaps[0]));
        snaps.shift();
      }
    } catch(e) {}

    // ④ Git 自动备份
    try {
      execSync('git add ' + WORKS_PATH + ' && git commit -m "backup works ' + ts + '" --allow-empty', {
        cwd: resolve(__dirname, '..'), stdio: 'ignore', timeout: 3000
      });
    } catch(e) {}

    // ⑤ 校验：读回来确认一致
    try {
      const verify = fs.readFileSync(WORKS_PATH, 'utf8');
      if (verify === data) {
        console.log('[saveWorks] ✓ ' + works.length + ' 条作品已保存');
        return true;
      } else {
        console.error('[saveWorks] ⚠ 写入校验失败，长度不匹配');
        return false;
      }
    } catch(e) {
      console.error('[saveWorks] ⚠ 校验读取失败:', e.message);
      return false;
    }
  } catch(e) {
    console.error('[saveWorks] 保存失败:', e.message);
    return false;
  }
}
app.post('/api/save-work', (req, res) => {
  const { work } = req.body;
  if (!work) return res.status(400).json({ error: 'no work' });
  var works = loadWorks();
  // 如果 work 有 _saveKey，查找已存在的作品替换（支持重新生成文案后更新）
  if (work._saveKey) {
    // 先清理可能存在的重复条目，保留最新的
    var unique = {}, cleaned = [];
    for (var i = works.length - 1; i >= 0; i--) {
      var k = String(works[i]._saveKey || '');
      if (!unique[k]) { unique[k] = true; cleaned.unshift(works[i]); }
    }
    works = cleaned;

    const idx = works.findIndex(function(w){ return String(w._saveKey) === String(work._saveKey); });
    if (idx >= 0) {
      // 保留原始 id 和 at，只更新内容
      works[idx] = { ...works[idx], ...work, id: works[idx].id, at: works[idx].at };
      if (works.length > 100) works.length = 100;
      var saved = saveWorks(works);
      if (saved) return res.json({ ok: true, count: works.length, updated: true });
      return res.status(500).json({ error: '保存失败', count: works.length });
    }
  }
  // 没找到或没有 _saveKey，新建
  works.unshift({ ...work, id: Date.now(), at: new Date().toLocaleDateString('zh-CN') });
  if (works.length > 100) works.length = 100;
  var saved = saveWorks(works);
  if (saved) {
    res.json({ ok: true, count: works.length });
  } else {
    console.error('[save-work] ⚠ 保存到磁盘失败');
    res.status(500).json({ error: '保存失败', count: works.length });
  }
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

// 薯包出品本地图片服务
const GALLERY_DIR = resolve(__dirname, '../薯包出品');
const GALLERY_FILE_MAP = {
  xm: '熬夜总结🔥厦门3天2夜精华攻略！人均800+玩到爽！',
  ep: '实测5款百元蓝牙耳机🔥闭眼入不踩雷',
  crab: '人均80吃帝王蟹🦀？这家大排档也太狠了',
  jk: '3套JK制服搭配🔥附价格参考！甜酷风',
  skincare: '25岁精简护肤🔥3步养出透亮肌！别再叠',
  pilates: '30天居家普拉提🔥腰围缩了5cm！',
  livingroom: '500元爆改极简客厅😱朋友都以为花了几万',
  rent: '实测300元出租屋改造🆘效果真的绝了',
  aitools: '实测推荐🔥这5款AI工具让我效率翻倍！',
  mealprep: '打工人带饭一周🔥月省800元💰5分钟',
  books: '改变认知的6本好书🔥读完格局直接炸裂',
  tv2026: '格局炸裂🤯2026年必看国产剧清单🔥',
  english: '考研英语85分不是梦🔥学姐3个月提分秘',
  selfmedia: '裸辞做自媒体🔥3个月收入破万，我做了什么'
};
app.get('/api/gallery-image', (req, res) => {
  const { id, file } = req.query;
  if (!id || !file) return res.status(400).end('missing params');
  const folder = GALLERY_FILE_MAP[id];
  if (!folder) return res.status(404).end('unknown id');
  const filePath = join(GALLERY_DIR, folder, file);
  if (!fs.existsSync(filePath)) return res.status(404).end('file not found');
  const ext = extname(file).toLowerCase();
  const CT_MAP = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  res.set('Content-Type', CT_MAP[ext] || 'image/png');
  res.set('Cache-Control', 'max-age=86400');
  res.sendFile(filePath);
});

// ===== 上传参考图访问 =====
const UPLOADS_DIR_2 = resolve(__dirname, 'uploads');
app.get('/api/uploads/:file', (req, res) => {
  const filePath = join(UPLOADS_DIR_2, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).end('not found');
  const ext = extname(filePath).toLowerCase();
  const CT_MAP = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  res.set('Content-Type', CT_MAP[ext] || 'image/png');
  res.set('Cache-Control', 'max-age=86400');
  res.sendFile(filePath);
});

// ============================================================
// 图片文字叠加（用 Sharp 把文字画到图片上，带内存缓存）
// ============================================================
app.get('/api/img-proxy-ping', (req, res) => res.json({ok:true}));

const overlayCache = new Map();
const OVERLAY_CACHE_DIR = resolve(__dirname, 'cache_overlay');
if (!fs.existsSync(OVERLAY_CACHE_DIR)) fs.mkdirSync(OVERLAY_CACHE_DIR, { recursive: true });

app.get('/api/image-proxy', async (req, res) => {
  const { url, title, hook, blocks } = req.query;
  if (!url) return res.status(400).end('missing url');

  // 缓存 key = url + 所有参数
  const cacheRaw = url + '|' + (title || '') + '|' + (hook || '') + '|' + (blocks || '');
  const cacheKey = crypto.createHash('md5').update(cacheRaw).digest('hex');
  const diskPath = join(OVERLAY_CACHE_DIR, cacheKey);

  // 1. 内存缓存
  if (overlayCache.has(cacheKey) && Date.now() - overlayCache.get(cacheKey).t < 1800000) {
    const mem = overlayCache.get(cacheKey);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'max-age=600');
    return res.send(mem.d);
  }

  // 2. 磁盘缓存
  if (fs.existsSync(diskPath)) {
    try {
      const d = fs.readFileSync(diskPath);
      overlayCache.set(cacheKey, { d, t: Date.now() });
      while (overlayCache.size > 100) { const k = overlayCache.keys().next().value; overlayCache.delete(k); }
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'max-age=600');
      return res.send(d);
    } catch(e) {}
  }

  // 3. 远程获取原图（先走本地代理缓存，没有才去外部）
  try {
    let resp;
    try {
      // 先从代理缓存取（避免重复下载源站）
      const proxyUrl = `http://localhost:${PORT}/api/proxy-image?url=${encodeURIComponent(url)}`;
      resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(3000) });
    } catch(e) {
      // 代理没缓存，直接请求源站
      resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    }
    if (!resp.ok) return res.status(502).end('fetch failed');
    const buf = Buffer.from(await resp.arrayBuffer());

    // 获取图片实际尺寸
    const meta = await sharp(buf).metadata();
    const w = meta.width || 1024;
    const h = meta.height || 1366;
    const gradH = Math.round(h * 0.28);
    const gradY = h - gradH;
    const titleY = gradY + Math.round(h * 0.21);
    const hookY = gradY + Math.round(h * 0.26);
    const fontSize1 = Math.round(h * 0.023);
    const fontSize2 = Math.round(h * 0.016);

    // 生成 SVG 文字叠加层
    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><linearGradient id="bg" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="rgba(0,0,0,0.8)"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>`;
    svg += `<rect x="0" y="${gradY}" width="${w}" height="${gradH}" fill="url(#bg)"/>`;

    // 标题（白色大字）
    if (title) {
      const displayTitle = (title || '').slice(0, 40);
      svg += `<text x="${Math.round(w * 0.029)}" y="${titleY}" font-size="${fontSize1}" fill="white" font-weight="bold" font-family="sans-serif">${displayTitle.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`;
    }

    // 钩子（和白字同一 x 坐标）
    if (hook) {
      const displayHook = (hook || '').slice(0, 50);
      svg += `<text x="${Math.round(w * 0.029)}" y="${hookY}" font-size="${fontSize2}" fill="#ffd700" font-family="sans-serif" font-weight="bold" font-style="italic">${displayHook.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`;
    }

    svg += `</svg>`;

    const result = await sharp(buf)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();

    // 缓存
    overlayCache.set(cacheKey, { d: result, t: Date.now() });
    while (overlayCache.size > 100) { const k = overlayCache.keys().next().value; overlayCache.delete(k); }
    fs.writeFile(diskPath, result, () => {});

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'max-age=600');
    return res.send(result);
  } catch (e) {
    console.error('[image-proxy]', e.message);
    // fallback: 返回原图
    try {
      const resp = await fetch(url);
      const fb = Buffer.from(await resp.arrayBuffer());
      res.set('Content-Type', 'image/png');
      res.send(fb);
    } catch(e2) {
      res.status(502).end('proxy error');
    }
  }
});

// ============================================================
// Prompt 管理 API（运行时热更新）
// ============================================================
app.get('/api/prompts/list', (req, res) => {
  res.json({ prompts: listPrompts() });
});

app.post('/api/prompts/reload', (req, res) => {
  clearPromptCache();
  res.json({ ok: true, msg: 'Prompt 缓存已清除，下次请求将使用最新文件' });
});

// ============================================================
// 免费试用 - 手机号绑定 + 预览模式（文案+封面，内容图锁定）
// ============================================================
// 手机号 → 免费次数追踪（生产环境应存数据库）
const phoneTrialMap = new Map(); // phone → { freeUsed: 0 }

// 注册/登录时赠送免费额度
app.post('/api/trial/register', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: '缺少手机号' });
  const record = phoneTrialMap.get(phone);
  if (!record) {
    phoneTrialMap.set(phone, { freeUsed: 0 });
    console.log(`[trial] 新用户注册: ${phone}，赠送1次免费预览`);
    return res.json({ freeRemaining: 1, isNew: true });
  }
  return res.json({ freeRemaining: Math.max(0, 1 - record.freeUsed), isNew: false });
});

// 查询免费额度
app.get('/api/trial/status', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.json({ freeRemaining: 0 });
  const record = phoneTrialMap.get(phone) || { freeUsed: 0 };
  res.json({ freeRemaining: Math.max(0, 1 - record.freeUsed), used: record.freeUsed });
});

// 消耗免费额度（预览模式调用）
app.post('/api/trial/consume', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: '缺少手机号' });
  const record = phoneTrialMap.get(phone) || { freeUsed: 0 };
  if (record.freeUsed >= 1) return res.status(403).json({ error: '免费次数已用完' });
  record.freeUsed++;
  phoneTrialMap.set(phone, record);
  res.json({ ok: true, freeRemaining: 0 });
});

const CLUSTER_ENABLED = !process.env.CLUSTER_DISABLED && !cluster.isWorker;

if (CLUSTER_ENABLED && cluster.isPrimary) {
  const cpuCount = Math.min(os.availableParallelism?.() || os.cpus().length, 4);
  console.log(`\U0001f9a9 薯包AI 主进程 (PID ${process.pid}) 启动 ${cpuCount} 个工作进程`);
  cluster.setupPrimary({ exec: fileURLToPath(import.meta.url) });
  for (let i = 0; i < cpuCount; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.log(`[cluster] 工作进程 ${worker.process.pid} 退出 (${signal || code})，正在重启...`);
    cluster.fork();
  });
} else {
  app.listen(PORT, () => {
    console.log(`\n\U0001f9a9 薯包AI 后端服务运行中${cluster.isWorker ? ` (worker #${cluster.worker.id}, PID ${process.pid})` : ''}`);
    console.log(`   LLM: ${LLM_BASE ? LLM_BASE + '/v1/chat/completions' : '未配置'} (${LLM_MODEL})`);
    console.log(`   Image: ${IMG_BASE}/v1/images/generations`);
    console.log(`   Anthropic 备用: ${process.env.ANTHROPIC_API_KEY ? '已配置' : '未配置'}`);
    console.log(`   API: http://localhost:${PORT}/api/generate`);
    console.log('');
  });
}
