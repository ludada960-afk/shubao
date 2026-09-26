/* ═══ parseSpec：**每条 skill 自己的"代为撰写"解析方案**（2026-09-26 批 BV）══════════════════════
   用户口径（逐字）：
   「我要的是，**每个工作台 skill 有自己个性化的解析方案**啊，**不可能概念 skill 还解析什么卖点和
     产品特点吧**？」「不止是概念视觉，我们现在**所有的图片生成和视频生成的代为撰写**是不是都应该这么做呢，
     **个性化做匹配方案**啊。」

   ── 为什么要有这个文件 ─────────────────────────────────────────────────────
   原来"解析"只有一个概念：`parse: { fills: 'productParams' }` —— 把**商品名/卖点/人群/场景/参数**
   回填进一个字段。那是**电商专用**的：套到「概念视觉方案」上就会让它去解析卖点，是错的。
   ⇒ 这里把"解析什么"和"问什么方向"变成**每条 skill 自己的声明**，与 `fields`/`cover`/`sources` 同级。

   ── 108 条不用写 108 套 ────────────────────────────────────────────────────
   **族级默认 + 单条覆盖**：图片侧按 `category`、视频侧按 `pipeline` 给 11 套族级方案，
   特殊的几条再单条覆盖。新增 skill 归到某个族就自动有方案；门禁保证**每条都能取到**（缺一条红）。

   ── 一条 parseSpec 由两部分组成 ─────────────────────────────────────────────
     · `items`：**解析什么** —— 预览步① 按它渲染"可增删条目"（一行一条，可改可删可加），改完进提示词。
     · `directions`：**问什么方向** —— 预览步② 的选项组（每条 skill 一套，不再全站共用那三组）。

   ── 默认档的两条合法路径（门禁第 ③ 条守这个）──────────────────────────────────
   第一档会被界面**默认选中**，所以它必须是下面两种之一，不许随便拿一个取值冒充：
     ① **中性档**：`auto`（智能匹配）/ `keep`（保持原样）—— 意思是"这一项交给系统按素材判断"；
     ② **声明默认**：`pinned: true` + `reason` —— 意思是"这就是这条 skill（或工作台）**已经声明过**的
        默认值"，界面展示它与实际下发一致，不是替用户拍板。
   ⚠️ 这条规则是本批**门禁抓出来的**：第一版我写了 8 个具体取值当第一档，其中 4 处属于"与工作台已声明的
      默认档一致"（合法）、另 4 处是**我替用户选了一个他没有选的值**（不合法，已改回中性档）。 */

import { IMAGE_SKILLS } from './imageSkills.js';
import { VIDEO_SKILLS } from './videoSkills.js';

/* 中性默认档（各族共用，避免各写各的文案） */
const AUTO = { value: 'auto', label: '智能匹配', prompt: '这一项由系统按素材内容自动判断。' };
const KEEP = { value: 'keep', label: '保持原样', prompt: '这一项保持素材原样，不做改动。' };
/* 「声明默认」档：必须写明为什么它可以被默认选中（理由会在门禁里被查长度） */
const pin = (value, label, prompt, reason) => ({ value, label, prompt, pinned: true, reason });

/* ═══ 族级默认 ═══════════════════════════════════════════════════════════════════════════
   `match` 键：图片侧 = skill.category，视频侧 = skill.pipeline。 */
export const PARSE_SPEC_FAMILIES = Object.freeze({
  /* ── 图片 · 创意应用（族级兜底；「概念视觉方案」另有单条覆盖）──────────────────── */
  创意应用: {
    items: [
      { key: 'subject', label: '主体物', hint: '素材里到底拍的是什么（器物/织物/食品…）' },
      { key: 'material', label: '材质与质感', hint: '哑光/透明/丝绒/金属…，决定新图的触感' },
      { key: 'palette', label: '色调归属', hint: '归到哪个色簇 + 主色值，决定整篇的调子' },
      { key: 'scene', label: '场景与背景', hint: '台面/墙面/自然环境' },
      { key: 'light', label: '现有光线', hint: '柔光/硬光/逆光 —— 新图要接得上原素材' },
      { key: 'avoid', label: '要避开的', hint: '画面里已有的文字、标识、人脸' },
    ],
    directions: [
      { key: 'theme', label: '主题意象', options: [AUTO] },
      { key: 'shot', label: '画面手法', options: [AUTO] },
    ],
  },

  /* ── 图片 · 电商套图 / A+ / 详情图（这三条原来就有"一键解析商品信息"，口径保留）──── */
  精品推荐: {
    items: [
      { key: 'productName', label: '产品名', hint: '素材上的商品是什么' },
      { key: 'sellingPoints', label: '核心卖点', hint: '从素材与文案里读出的卖点，一行一条' },
      { key: 'audience', label: '适用人群', hint: '给谁用' },
      { key: 'scenes', label: '期望场景', hint: '用在什么场景里' },
      { key: 'params', label: '尺寸参数', hint: '规格/尺寸/材质参数' },
    ],
    directions: [
      /* 这两档与工作台字段自己的默认档一致（`marketField`/`platformField` 都取 options[0]），
         所以展示它=展示实际会下发的值，不是替用户拍板 */
      { key: 'market', label: '目标市场', options: [pin('cn', '中国大陆', '', '与工作台「目标市场」字段的默认档一致（该字段取第一档当默认）')] },
      { key: 'platform', label: '目标平台', options: [pin('taobao', '淘宝天猫', '', '与工作台「目标平台」字段的默认档一致')] },
    ],
  },

  /* ── 图片 · 电商专区（白底/多角度/爆炸/TVC 九宫格…）────────────────────────── */
  电商专区: {
    items: [
      { key: 'structure', label: '商品结构', hint: '造型/部件/开合方式 —— 出图不许改结构' },
      { key: 'material', label: '材质', hint: '表面材质与工艺' },
      { key: 'currentShots', label: '现有拍法', hint: '素材已有的角度与光位' },
      { key: 'missingAngles', label: '需要补的角度', hint: '还缺哪几个视角' },
    ],
    directions: [
      { key: 'angle', label: '视角', options: [AUTO, { value: 'front', label: '正面', prompt: '' }, { value: 'side', label: '侧面', prompt: '' }, { value: 'top', label: '俯视', prompt: '' }] },
      { key: 'light', label: '光位', options: [AUTO, { value: 'soft', label: '柔光棚拍', prompt: '' }, { value: 'hard', label: '硬光戏剧', prompt: '' }] },
    ],
  },

  /* ── 图片 · 建筑家装（结构真实性是命门，解析与方向都围着它转）────────────────── */
  建筑家装: {
    items: [
      { key: 'spaceType', label: '空间类型', hint: '住宅/商业/办公…' },
      { key: 'structure', label: '结构', hint: '墙体/门窗/层数/房间数 —— 出图必须不变' },
      { key: 'material', label: '材质与做法', hint: '墙面/地面/主要材料' },
      { key: 'light', label: '现有光线', hint: '日照方向与氛围' },
    ],
    directions: [
      { key: 'style', label: '装修风格', options: [AUTO, { value: 'modern', label: '现代简约', prompt: '' }, { value: 'chinese', label: '新中式', prompt: '' }] },
      { key: 'mood', label: '光影氛围', options: [AUTO, { value: 'day', label: '晴朗日光', prompt: '' }, { value: 'dusk', label: '黄昏暖光', prompt: '' }, { value: 'night', label: '夜景灯光', prompt: '' }] },
    ],
  },

  /* ── 图片 · 人像摄影 ────────────────────────────────────────────────────── */
  人像摄影: {
    items: [
      { key: 'person', label: '人物特征', hint: '五官/发型/肤色 —— 换装换背景时要保住' },
      { key: 'pose', label: '姿势', hint: '站姿/坐姿/手部动作' },
      { key: 'light', label: '现有光位', hint: '顺光/侧逆光/影棚光' },
      { key: 'taboo', label: '禁忌', hint: '这条 skill 明确不许出现的东西' },
    ],
    directions: [
      { key: 'style', label: '风格', options: [AUTO, { value: 'clean', label: '干净通勤', prompt: '' }, { value: 'street', label: '街头随性', prompt: '' }] },
      /* 「保什么」这件事交给系统按素材判断更稳（不同素材该保的东西不一样） */
      { key: 'fidelity', label: '重点保真', options: [AUTO, { value: 'face', label: '保住五官', prompt: '五官与肤色保持不变。' }, { value: 'body', label: '保住身材比例', prompt: '身材比例保持不变。' }] },
    ],
  },

  /* ── 图片 · 图片编辑（去背/换背景/换风格/精修）──────────────────────────────── */
  图片编辑: {
    items: [
      { key: 'subject', label: '要保留的主体', hint: '边界在哪里 —— 编辑类最重要的一条' },
      { key: 'defects', label: '原图缺陷', hint: '要修掉的杂物/光斑/噪点' },
      { key: 'refStyle', label: '参考风格特征', hint: '换风格时目标风格的关键特征' },
    ],
    directions: [
      /* 强度交系统判断：同一张图该动多少，取决于它的缺陷有多重 —— 不该由我们预设"轻度" */
      { key: 'strength', label: '处理强度', options: [AUTO, { value: 'light', label: '轻度', prompt: '只做轻微调整。' }, { value: 'medium', label: '中度', prompt: '' }, { value: 'heavy', label: '重度', prompt: '' }] },
      { key: 'fidelity', label: '重点保真', options: [AUTO, { value: 'subject', label: '主体原样', prompt: '主体结构与材质保持不变。' }] },
    ],
  },

  /* ── 视频 · 智能成片 ────────────────────────────────────────────────────── */
  videoSmart: {
    items: [
      { key: 'material', label: '素材内容', hint: '每段素材拍的是什么' },
      { key: 'sellingPoints', label: '卖点', hint: '这条片子要讲清楚的一件事' },
      { key: 'scene', label: '场景', hint: '素材所在的环境' },
      { key: 'pace', label: '节奏', hint: '快剪/慢叙/卡点' },
    ],
    directions: [
      { key: 'contentType', label: '内容类型', options: [AUTO, { value: 'goods', label: '带货', prompt: '' }, { value: 'seed', label: '种草', prompt: '' }, { value: 'story', label: '剧情演绎', prompt: '' }] },
      { key: 'shotStyle', label: '拍摄方式', options: [AUTO, { value: 'table', label: '桌拍开箱', prompt: '' }, { value: 'talking', label: '真人口播', prompt: '' }, { value: 'onetake', label: '一镜到底', prompt: '' }] },
    ],
  },

  /* ── 视频 · 首尾帧 ──────────────────────────────────────────────────────── */
  videoFrame: {
    items: [
      { key: 'first', label: '首帧内容', hint: '起点画面' },
      { key: 'last', label: '尾帧内容', hint: '终点画面' },
      { key: 'path', label: '中间变化', hint: '从首到尾中间要发生什么' },
    ],
    directions: [
      { key: 'motion', label: '运动方式', options: [AUTO, { value: 'transform', label: '形态变化', prompt: '' }, { value: 'camera', label: '镜头运动', prompt: '' }] },
      { key: 'duration', label: '时长', options: [pin('5', '5 秒', '', '与工作台时长字段的默认档一致（取最短档，最省积分）'), { value: '10', label: '10 秒', prompt: '' }] },
    ],
  },

  /* ── 视频 · 爆款复刻 ────────────────────────────────────────────────────── */
  videoRemake: {
    items: [
      { key: 'refShots', label: '参考片镜头语言', hint: '景别/运镜/切换节奏' },
      { key: 'refTone', label: '参考片色调', hint: '调色与氛围' },
      { key: 'replace', label: '要替换的主体', hint: '把参考片里的什么换成我们的' },
      { key: 'keep', label: '要保住的部分', hint: '节奏与钩子位置不变' },
    ],
    directions: [
      /* 复刻到什么程度取决于参考片质量与我们的拍摄能力 —— 交系统判断，不预设"高度复刻" */
      { key: 'fidelity', label: '复刻程度', options: [AUTO, { value: 'high', label: '高度复刻', prompt: '节奏与镜头逐拍照搬。' }, { value: 'medium', label: '借结构', prompt: '借节奏结构，画面另拍。' }] },
      { key: 'duration', label: '时长', options: [AUTO, { value: '10', label: '10 秒', prompt: '' }, { value: '15', label: '15 秒', prompt: '' }] },
    ],
  },

  /* ── 视频 · 图生视频族（最大一族：商品动态/运镜/模特动态/各展示页）────────────── */
  videoReference: {
    items: [
      { key: 'subject', label: '素材主体', hint: '要动起来的是什么' },
      { key: 'action', label: '期望动作', hint: '产品/模特/空间要怎么动' },
      { key: 'camera', label: '镜头运动', hint: '推/拉/摇/移/环绕' },
      { key: 'keep', label: '必须不变', hint: '结构/材质/文字/比例' },
    ],
    directions: [
      { key: 'cameraMove', label: '运镜', options: [AUTO, { value: 'push', label: '推近', prompt: '镜头缓慢推近主体。' }, { value: 'pull', label: '拉远', prompt: '镜头缓慢拉远。' }, { value: 'orbit', label: '环绕', prompt: '镜头绕主体环绕。' }] },
      { key: 'duration', label: '时长', options: [AUTO, { value: '5', label: '5 秒', prompt: '' }, { value: '10', label: '10 秒', prompt: '' }, { value: '15', label: '15 秒', prompt: '' }] },
    ],
  },

  /* ── 视频 · 本地渲染（高清/去字幕/数字人 —— 不走上游模型，解析的是交付规格）──────── */
  videoLocal: {
    items: [
      { key: 'spec', label: '输入规格', hint: '分辨率/时长/音轨情况' },
      { key: 'target', label: '目标规格', hint: '要输出成什么' },
      { key: 'region', label: '要处理的区域', hint: '去字幕那种：字幕位置与时长范围' },
    ],
    directions: [
      { key: 'output', label: '输出', options: [AUTO, { value: '720p', label: '720P', prompt: '' }, { value: '1080p', label: '1080P', prompt: '' }, { value: '2k', label: '2K', prompt: '' }] },
      { key: 'audio', label: '音轨', options: [KEEP, { value: 'mute', label: '静音', prompt: '' }] },
    ],
  },
});

/* ═══ 单条覆盖（少数"跟同族都不一样"的技能）═══════════════════════════════════════════════
   ⚠️ 只有真的不一样才写在这里 —— 能归族就别覆盖，否则 108 条又变成 108 套要维护（门禁限制条数）。 */
export const PARSE_SPEC_OVERRIDES = Object.freeze({
  /* 概念视觉方案：它**不做带货图**，所以族级的"卖点/人群/参数"一条都不适用。
     解析出来的是做图真正要用的东西；其中"色调归属"直接决定第二步默认选哪个主题意象。 */
  'image.concept_set': {
    items: [
      { key: 'subject', label: '主体物', hint: '素材里拍的是什么（器物/织物/食品…）' },
      { key: 'material', label: '材质与质感', hint: '哑光陶土/透明玻璃/丝绒/金属…' },
      { key: 'palette', label: '色调归属', hint: '归到哪个实测色簇（灰调大地/海蓝灰雾/柔雾浅粉/暖砂裸粉/深棕暗红）+ 主色值' },
      { key: 'scene', label: '场景与背景', hint: '台面/墙面/自然环境' },
      { key: 'light', label: '现有光线', hint: '柔光/硬光/逆光 —— 新图要接得上原素材' },
      { key: 'avoid', label: '要避开的', hint: '画面里已有的文字/标识/人脸（本账号走无品牌线，要跟着避开）' },
      { key: 'shots', label: '可用手法建议', hint: '按素材（有没有可拍细节、有没有空间感）建议勾哪几种手法' },
      { key: 'theme', label: '方向建议', hint: '给一个建议的主题意象，可以改' },
    ],
    directions: [
      { key: 'theme', label: '主题意象', options: [AUTO] },
      { key: 'shot', label: '本张手法', options: [AUTO] },
      /* 3:4 是本账号**写死的签名**（工作台里「比例」字段的 default 就是 3:4），
         所以这里展示它=展示实际会下发的值 */
      { key: 'ratio', label: '比例口径', options: [pin('3:4', '3:4 竖版（本账号签名）', '', '与工作台「比例」字段声明的默认档一致，且是本账号签名的固定口径')] },
    ],
  },
});

/* 覆盖表里的 key 必须是真实存在的 skill id —— 门禁核对。 */
export function parseSpecKeyOf(skill) {
  const id = String(skill?.id || '').trim();
  if (id && PARSE_SPEC_OVERRIDES[id]) return { kind: 'override', key: id };
  const familyKey = skill?.board === 'video' ? String(skill?.pipeline || '') : String(skill?.category || '');
  if (familyKey && PARSE_SPEC_FAMILIES[familyKey]) return { kind: 'family', key: familyKey };
  return { kind: 'none', key: '' };
}

/* 取一条 skill 的解析方案：**先查单条覆盖，再落到族级**；取不到返回 null（门禁保证真实技能取得到，
   界面拿到 null 时按"这条技能还没有解析方案"降级，而不是编一个出来）。 */
export function parseSpecOf(skill) {
  const { kind, key } = parseSpecKeyOf(skill);
  if (kind === 'none') return null;
  const spec = kind === 'override' ? PARSE_SPEC_OVERRIDES[key] : PARSE_SPEC_FAMILIES[key];
  return {
    source: kind,          // 'override' | 'family' —— 界面/日志可据此说明"这套是哪来的"
    key,
    items: Array.isArray(spec?.items) ? spec.items : [],
    directions: Array.isArray(spec?.directions) ? spec.directions : [],
  };
}

/* 自证用的样本（门禁拿它验证"全部覆盖"这件事真的在验东西） */
export const PARSE_SPEC_ALL_SKILLS = Object.freeze([...IMAGE_SKILLS, ...VIDEO_SKILLS]);

export { AUTO as PARSE_SPEC_AUTO, KEEP as PARSE_SPEC_KEEP };
