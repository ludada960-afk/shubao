import { getSkillList, getSkillByKey, buildSkillDescription, STYLE_SKILL_DEFS } from '../ecommerceEngine/styleSkills.mjs';
import { listVideoSkillTemplates } from '../videoSkillTemplates.mjs';

/**
 * 统一的内置 Skill 目录（2026-09-10）
 *
 * 目的：把此前分散在 5 处的"技能类"资产收敛成同一个只读视图，前端一套 UI 展示。
 * 内置 skill 是代码常量（随发布版本走），不入库、用户不可删改，只能选择或"派生"。
 * 2026-09-10（用户反馈）：内置技能必须带完整提示词正文——否则用户点"派生"拿到的是空壳，
 * 不知道这个技能到底会怎么画。正文从内置风格包的真实参数生成，保证"所派生即所得"。
 */
export const SKILL_CATALOG_SCHEMA_VERSION = 2;

const IMAGE_STYLE_SUMMARY = Object.freeze({
  premium_minimal: '克制留白、材质优先，适合高客单与品牌感商品',
  lifestyle_scene: '真实生活场景，自然光与使用关系，适合种草与详情页',
  fashion_editorial: '杂志级时装光影与版式，适合服饰、鞋包与配饰',
  warm_natural: '暖调自然光与柔和色彩，适合家居、食品与母婴',
  tech_precision: '冷色精密光影与结构证据，适合数码、家电与工具',
});

/** 用户可读的中文说明 (9-11 二轮用户批注: 技能正文必须让用户看得懂 —
 *  中文在前、英文原参数在后, 生图模型仍拿到原来的英文令牌, 不改变生成口径)。 */
const IMAGE_STYLE_ZH = Object.freeze({
  premium_minimal: {
    usage: '适合高客单、品牌感强的商品，留白多、质感优先',
    direction: '高级感极简电商摄影，干净通透、克制奢华',
    lighting: '左上方 45° 大面积柔光箱主光，右侧白色反光板补光，商品后缘冷色轮廓光，地面柔和渐隐投影，色温中性偏暖约 5200K',
    color: '纯白 / 米白 / 深灰 / 香槟金，整体去饱和约 20%，中软对比',
    composition: '居中构图，商品占画面约 50%，大面积留白，浅景深，微俯视 3/4 角度突出轮廓与材质',
  },
  lifestyle_scene: {
    usage: '适合种草与详情页，让用户看到真实使用关系',
    direction: '真实生活场景里的自然使用画面，有生活痕迹但不杂乱',
    lighting: '窗边自然光为主光，室内环境光柔和补光，投影自然落地',
    color: '暖木色 / 米色 / 植物绿为主，低饱和暖调，对比自然',
    composition: '三分法构图，商品位于视觉动线上，保留人物手部或使用场景的关联，中景为主',
  },
  fashion_editorial: {
    usage: '适合服饰、鞋包与配饰，杂志级光影与版式',
    direction: '杂志时装大片式的强光影与高级版式',
    lighting: '侧逆硬光塑造轮廓，暗部补光压低，背景压暗形成舞台感',
    color: '深色调背景配金属与暖金点缀，高对比、中等饱和',
    composition: '居中或对角线构图，商品占画面 55%-65%，局部放大质感细节，留出版式空间',
  },
  warm_natural: {
    usage: '适合家居、食品与母婴，柔和治愈',
    direction: '温暖柔和的自然光生活摄影，治愈系氛围',
    lighting: '大面积漫射柔光，投影极浅，边缘光柔和过渡，色温偏暖约 4500K',
    color: '米棕 / 奶油 / 浅木色，低饱和暖调，对比柔和',
    composition: '中心偏下的稳定构图，商品占画面 45%-55%，搭配少量生活道具衬托尺度',
  },
  tech_precision: {
    usage: '适合数码、家电与工具，强调结构与精密感',
    direction: '冷色精密工业摄影，突出结构证据与材质工艺',
    lighting: '顶部条形冷光 + 两侧轮廓光勾边，金属高光锐利，暗部保留细节',
    color: '冷蓝 / 石墨灰 / 银色，高对比、低饱和，金属反射干净',
    composition: '对称或微透视构图，商品占画面 60%，可配爆炸视角与结构线辅助说明',
  },
});

/** 把内置风格包的参数写成用户可读的提示词正文:
 *  英文原参数在前 (生图模型按英文执行), 后面紧跟括号里的中文翻译 —
 *  不出现任何面向开发/内部的说明文字 (9-11 三轮用户批注)。 */
function builtinImageBody(key) {
  const skill = getSkillByKey(key);
  if (!skill || !skill.campaignLock) return '';
  const zh = IMAGE_STYLE_ZH[key] || {};
  const description = buildSkillDescription(key);
  const english = Object.fromEntries(description.split('\n').map(line => {
    const index = line.indexOf(': ');
    return index > 0 ? [line.slice(0, index), line.slice(index + 2)] : [line, ''];
  }));
  const pair = (label, enText, zhText) => `- ${label}: ${enText || ''}${zhText ? ` (${zhText})` : ''}`;
  const lines = [
    `- 模块名: ${skill.name}`,
    `- 风格基调: ${skill.desc || ''}`,
    zh.usage ? `- 适用场景: ${zh.usage}` : '',
    '',
    '【画面方向】',
    pair('视觉方向', english['STYLE DIRECTION'], zh.direction || skill.desc || ''),
    pair('光线', english.LIGHTING, zh.lighting),
    pair('色彩', english.COLOR, zh.color),
    pair('构图', english.COMPOSITION, zh.composition),
    '',
    '【通用约束】',
    '- 保持商品结构与材质真实，不改变商品的数量、比例与颜色',
    '- 画面干净克制，不添加与商品无关的装饰元素',
    '- 不得出现拼贴、多图拼接或画中画构图',
  ];
  return lines.filter(line => line !== '').join('\n');
}

/* 9-11 二轮用户批注: 技能库要像竞品那样「拿来就能用」——
   补任务型内置技能 (白底图/模特上身/场景图/细节图 …), 与风格技能互补, 可在首页生成与画布中共用。 */
const TASK_IMAGE_SKILLS = Object.freeze([
  Object.freeze({
    key: 'task_white_bg',
    name: '白底商品图',
    summary: '纯白无缝背景的商品标准图，可直接上架',
    body: [
      '- 模块名: 白底商品图',
      '- 适用场景: 电商上架首图、平台审核用图',
      '【画面方向】',
      '- 视觉方向: Pure white seamless background, standard e-commerce hero shot (纯白无缝背景的标准商品图)',
      '- 光线: Even soft lighting, balanced left-right ratio, soft grounded shadow (均匀柔光，左右光比均衡，商品底部保留轻落地阴影)',
      '- 色彩: Faithful color reproduction, no color cast, no filter (忠实还原商品真实颜色，不偏色、不加滤镜)',
      '- 构图: Centered, product fills 70-80% of frame, safe margins (居中构图，商品占画面 70%-80%，四边留安全边距)',
      '【禁止】',
      '- No text, no promo badges, no watermark, no props (不加文字、促销角标、水印与无关道具)',
    ].join('\n'),
  }),
  Object.freeze({
    key: 'task_model_wear',
    name: '模特上身/试穿',
    summary: '真实模特穿着使用，展示版型与材质',
    body: [
      '- 模块名: 模特上身/试穿',
      '- 适用场景: 服饰、鞋包、配饰的上身效果图',
      '【画面方向】',
      '- 视觉方向: Real model wearing naturally, candid stance or subtle motion (真实模特自然穿着，生活化站姿或走动)',
      '- 光线: Soft natural light, consistent exposure on model and product (柔和自然光，人物与商品受光一致)',
      '- 色彩: True product color, natural skin tone (商品颜色忠实，肤色自然不夸张)',
      '- 构图: Three-quarter or full body, product as focal point, clean background (七分身或全身，商品为视觉重心，背景简洁不抢)',
      '【禁止】',
      '- Do not alter fit, pattern or accessory count; never invent logos (不改变服装版型、图案与配件数量；不虚构品牌标识)',
    ].join('\n'),
  }),
  Object.freeze({
    key: 'task_scene_lifestyle',
    name: '场景种草图',
    summary: '真实使用场景中的氛围画面，适合种草与详情',
    body: [
      '- 模块名: 场景种草图',
      '- 适用场景: 小红书、详情页的氛围场景画面',
      '【画面方向】',
      '- 视觉方向: Product caught in real use, emotional lifestyle narrative (商品被真实使用中的生活瞬间，有情绪与使用关系)',
      '- 光线: Window or outdoor natural light with translucent rim light (窗边或户外自然光，逆光边缘通透)',
      '- 色彩: Warm realistic palette, coherent environment tone (温暖真实，环境色调统一)',
      '- 构图: Rule of thirds, product on hand or table, light foreground occlusion (三分法构图，商品在手边或桌面上，前景可带少量遮挡增加层次)',
      '【禁止】',
      '- No unrelated brands, text or competitor marks (不添加与商品无关的品牌、文字与竞品标识)',
    ].join('\n'),
  }),
  Object.freeze({
    key: 'task_detail_macro',
    name: '材质细节特写',
    summary: '放大材质、工艺与结构证据',
    body: [
      '- 模块名: 材质细节特写',
      '- 适用场景: 详情页细节切片、卖点佐证',
      '【画面方向】',
      '- 视觉方向: Macro close-up emphasising material texture and craftsmanship (微距级特写，突出材质纹理与工艺细节)',
      '- 光线: Raking side light to reveal texture, shadow detail preserved (侧向掠射光强化纹理，暗部保留细节)',
      '- 色彩: True-to-life color, avoid oversaturation (真实还原，避免过饱和)',
      '- 构图: Tight crop, tack-sharp focus, shallow depth of field (局部充满画面，焦点锐利，浅景深分离背景)',
      '【禁止】',
      '- Do not invent structures, ports or materials (不虚构不存在的结构、接口与材质)',
    ].join('\n'),
  }),
  Object.freeze({
    key: 'task_multi_angle',
    name: '多角度套图',
    summary: '同一商品的多角度一致性画面组',
    body: [
      '- 模块名: 多角度套图',
      '- 适用场景: 一次输出正面、侧面、背面、俯视等多角度主图',
      '【画面方向】',
      '- 视觉方向: Same product, same lighting and background, consistent multi-angle set (同一商品、同一光线与背景下的多角度连拍感)',
      '- 光线: Identical lighting setup across angles, no lighting jumps (每个角度保持同一套布光，避免跳光)',
      '- 色彩: Consistent color across the set (全组颜色一致，避免色差)',
      '- 构图: Stable framing and subject scale across angles (同一构图框架下切换角度，主体比例稳定)',
      '【禁止】',
      '- Never change proportions, color or accessory count between angles (不同角度间不得改变商品比例、颜色与配件数量)',
    ].join('\n'),
  }),
]);

function builtinVideoBody(templateId) {
  const templates = {
    'product-ad-v1': [
      '- 模块名: 商品广告短片',
      '- 画面任务: 从商品素材出发，产出一条 5-15 秒的可投放广告短片',
      '- 镜头结构: 开场 0-2s 建立商品第一印象 → 中段 3-10s 展示核心卖点与使用场景 → 结尾 2s 收束到品牌/购买理由',
      '- 镜头候选: 每个段落先给 2-3 个候选镜头（角度/景别/运动方式），确认后进时间线',
      '- 商品呈现: 商品在画面中的比例、角度、颜色与真实素材一致，不虚构功能与配件',
      '- 交付: 镜头清单 + 时间线 + 每镜头画面描述，确认后再生成',
    ].join('\n'),
    'reference-video-reconstruction-v1': [
      '- 模块名: 参考视频同款重建',
      '- 画面任务: 分析参考视频的镜头结构、节奏与转场方式，用自有素材重建同款',
      '- 分析维度: 镜头数量、每镜头时长、景别与运动、转场类型、情绪节奏',
      '- 重建原则: 只复用"结构与节奏"，画面内容全部来自用户自有素材，不复制原视频的受版权保护元素',
      '- 交付: 参考视频结构表 + 自有素材映射表 + 重建时间线，确认后再生成',
    ].join('\n'),
  };
  return templates[templateId] || '';
}

function builtinImageSkills() {
  const styles = getSkillList().map(skill => ({
    id: `builtin:image:${skill.key}`,
    scope: 'builtin',
    kind: 'image',
    key: skill.key,
    name: skill.name,
    summary: IMAGE_STYLE_SUMMARY[skill.key] || '',
    body: builtinImageBody(skill.key),
    editable: false,
  }));
  /* 9-11 二轮: 任务型技能与风格技能同列 (首页「视觉方向 · 按技能生成」与画布技能入口共用) */
  const tasks = TASK_IMAGE_SKILLS.map(skill => ({
    id: `builtin:image:${skill.key}`,
    scope: 'builtin',
    kind: 'image',
    key: skill.key,
    name: skill.name,
    summary: skill.summary,
    body: skill.body,
    editable: false,
  }));
  return [...styles, ...tasks];
}

const VIDEO_SUMMARY = Object.freeze({
  'product-ad-v1': '从商品素材到成片的广告短片工作流，含镜头候选与时间线确认',
  'reference-video-reconstruction-v1': '分析参考视频的镜头结构，用自有素材重建同款节奏',
});

function builtinVideoSkills() {
  return listVideoSkillTemplates().map(template => ({
    id: `builtin:video:${template.templateId}`,
    scope: 'builtin',
    kind: 'video',
    key: template.templateId,
    name: template.title,
    summary: template.summary || template.description || VIDEO_SUMMARY[template.templateId] || '',
    body: builtinVideoBody(template.templateId),
    editable: false,
  }));
}

/** 内置目录按类型返回；未知类型返回空数组（前端按 Tab 拉取） */
export function listBuiltinSkills(kind = '') {
  const all = [...builtinImageSkills(), ...builtinVideoSkills()];
  const normalized = String(kind || '').trim();
  return normalized ? all.filter(skill => skill.kind === normalized) : all;
}

export function getBuiltinSkill(id) {
  return listBuiltinSkills().find(skill => skill.id === String(id || '')) || null;
}
