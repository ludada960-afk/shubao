# 电商精修工坊重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把精修工坊从「6 图片类型 + 6 风格包」复杂配置重构为「智能一键框 + 5 步精细配置」双通道，图片类型精简为 4 类 + 详情切片 + 用户自定义 SKU，平台尺寸统一为 1440。

**Architecture:** 顶部「智能一键」textarea + 「AI 自动识别」按钮调用 Vision 路由，把识别结果回填到下方 5 步表单（实拍图 / 参考图 / 规格SKU / 详情策划 / 保养维护）。生成阶段由精简后的 prompt 引擎按角色出图，详情切片可单独上传，也可用 sharp 拼成长图分享。删除风格包/转化驱动力/美妆报告/智能推荐/档次等旧逻辑。

**Tech Stack:** React (JSX, inline styles, useState), Node.js Express (ESM), SSE 流式生成, sharp 图片处理, GPT-Image-2-n (65535.space), DeepSeek + gpt-5.4-mini Vision。

## Global Constraints

- 平台尺寸：淘宝/京东/拼多多/小红书电商/抖音电商 → `1:1 = 1440×1440`，`3:4 = 1440×1920`；亚马逊保持 `1:1 = 1000×1000`，`3:4 = 1500×2000`。
- 白底图固定 `800×800`；透明图固定 `800×800`；SKU 规格图固定 `800×800`；详情切片宽度 `1440px`，每片高度 `≤ 2880px`。
- 默认套图：主图 1:1 ×5、主图 3:4 ×5、透明图 ×1、SKU 规格图数量由用户定义。
- 删除：`EC_STYLE_PACKS`、`EC_ADV_TYPES`、`STYLE_PACKS`、`CONVERSION_DRIVERS`、`getSmartRecommendations`、`TIER_ROLES`、`TIER_META`、`buildBeautyReportPrompt`、`getTierImages`、美妆报告相关角色与信息项。
- SKU 严格约束："All variants share identical shape, only color differs"；颜色名/数值由用户填，AI 不自创。
- 保留：顶部「一键复刻爆款」插件导入卡片与插件 Modal（不动）；不动小红书图文、Plog、首页电商 tab、EcAuto 一键出图、Remake、EcLegacyForm。
- 保留 `CATEGORY_VISUALS`、`PLATFORM_VISUAL_GUIDE`、`buildCampaignLockText`（给主图用统一默认 lock）。
- 新增 API：`POST /api/ecommerce/auto-recognize`（Vision 填 5 步字段）、`POST /api/ecommerce/stitch-long`（sharp 拼长图）。
- 频繁提交：每个 Task 结束 commit 一次。

---

## File Structure

| 文件 | 责任 | 变更 |
|---|---|---|
| `src/constants/data.js` | 电商常量 | 精简 `EC_MAIN_TYPES` 为 4 类；删 `EC_ADV_TYPES`、`EC_STYLE_PACKS`；更新 `EC_PLATFORM_DIMS` 为 1440；更新 `EC_IMG_RATIOS`；新增 `EC_DETAIL_SLICES`、`EC_SKU_FIELDS` |
| `server/ecommercePromptEngine.mjs` | prompt 引擎 | 删风格包/驱动力/档次/美妆/智能推荐；更新 `IMAGE_ROLES`；更新 `PLATFORM_SIZES`；新增 `buildMain3x4Prompt`/`buildSkuPrompt`/`buildDetailSlicePrompt`；重写 `buildOutline` |
| `server/index.mjs` | 后端路由 | 新增 `/api/ecommerce/auto-recognize`、`/api/ecommerce/stitch-long`；更新 `/api/generate-ecommerce` 支持 SKU/详情切片 |
| `src/services/api.js` | 前端 API | 新增 `autoRecognizeEcommerce`、`stitchLongImage`；更新 `generateEcommerce` 入参 |
| `src/pages/EcStudio/index.jsx` | 精修工坊页面 | 重写：智能一键框 + 5 步表单 + 预览 + 结果 + 长图拼接按钮 |

---

## Task 1: 精简 `src/constants/data.js` 电商常量

**Files:**
- Modify: `src/constants/data.js:112-164`

**Interfaces:**
- Consumes: 无（纯常量）
- Produces: `EC_MAIN_TYPES`（4 类：white_bg/main_text/main_3x4/transparent + sku）、`EC_DETAIL_SLICES`（5 个切片类型 + care）、`EC_SKU_FIELDS`（SKU 行字段）、更新后的 `EC_PLATFORM_DIMS`、`EC_IMG_RATIOS`；删除 `EC_ADV_TYPES`、`EC_STYLE_PACKS`

- [ ] **Step 1: 更新 `EC_PLATFORM_DIMS` 为 1440（除亚马逊）**

替换 `src/constants/data.js:121-129` 整段：

```js
/* ═══════ 电商平台尺寸映射 ═══════ */
export const EC_PLATFORM_DIMS = {
  '淘宝': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '京东': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '拼多多': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '小红书电商': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '抖音电商': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '亚马逊': { '1:1': [1000,1000], '3:4': [1500,2000] },
};
```

- [ ] **Step 2: 更新 `EC_IMG_RATIOS` 映射**

替换 `src/constants/data.js:131-136`：

```js
/* ═══════ 图片类型 → 比例映射 ═══════ */
export const EC_IMG_RATIOS = {
  white_bg:'1:1', main_text:'1:1', main_3x4:'3:4',
  transparent:'1:1', sku:'1:1',
  detail_slice_size:'3:4', detail_slice_scene:'3:4', detail_slice_qc:'3:4',
  detail_slice_compare:'3:4', detail_slice_feature:'3:4', detail_slice_care:'3:4',
};
```

- [ ] **Step 3: 精简 `EC_MAIN_TYPES` 为 4 类 + SKU**

替换 `src/constants/data.js:138-145`：

```js
/* ═══════ 电商核心图片类型（精简后 4 类） ═══════ */
export const EC_MAIN_TYPES = [
  { key:'white_bg',    label:'白底图',     emoji:'⬜', maxCount:5, mandatory:true,  desc:'纯白背景，产品居中，首图规范 800×800' },
  { key:'main_text',   label:'主图 1:1',   emoji:'🖼️', maxCount:5, mandatory:false, desc:'白底1 + 卖点4，1440×1440' },
  { key:'main_3x4',    label:'主图 3:4',   emoji:'📱', maxCount:5, mandatory:false, desc:'多角度/场景，1440×1920' },
  { key:'transparent', label:'PNG透明图',  emoji:'🎯', maxCount:1, mandatory:false, desc:'去底素材 800×800' },
];
```

- [ ] **Step 4: 删除 `EC_ADV_TYPES` 整段**

删除 `src/constants/data.js:147-154`（从 `/* ═══════ 电商高级图片类型 ═══════ */` 到 `];`）。

- [ ] **Step 5: 删除 `EC_STYLE_PACKS` 整段**

删除 `src/constants/data.js:156-164`（从 `/* ═══════ 视觉风格包 ═══════ */` 到 `];`）。

- [ ] **Step 6: 新增 `EC_DETAIL_SLICES` 与 `EC_SKU_FIELDS`**

在 `EC_STYLE_PACKS` 被删除的位置（原 156 行处）插入：

```js
/* ═══════ 详情长图切片类型（用户勾选决定切片内容） ═══════ */
export const EC_DETAIL_SLICES = [
  { key:'detail_slice_size',    label:'尺寸标注图', emoji:'📏', desc:'引线标毫米/厘米' },
  { key:'detail_slice_scene',   label:'场景拍摄图', emoji:'🌄', desc:'产品在真实环境' },
  { key:'detail_slice_qc',      label:'质检报告图', emoji:'✅', desc:'合格证/检测信息' },
  { key:'detail_slice_compare', label:'优势对比图', emoji:'↔️', desc:'vs 同款差异' },
  { key:'detail_slice_feature', label:'细节功能图', emoji:'🔍', desc:'功能点 callout' },
  { key:'detail_slice_care',    label:'保养维护图', emoji:'🧴', desc:'保养说明' },
];

/* ═══════ SKU 变体行字段定义 ═══════ */
export const EC_SKU_FIELDS = [
  { key:'color',    label:'颜色',      placeholder:'月岩白',     maxLen:4 },
  { key:'size',     label:'规格/尺码', placeholder:'M / 100ml',  maxLen:10 },
  { key:'capacity', label:'容量/数量', placeholder:'500ml / 3件装', maxLen:10 },
  { key:'dimLabel', label:'标注尺寸',  placeholder:'20×10×5cm',  maxLen:12 },
];
```

- [ ] **Step 7: 验证 `EC_PLATFORM_SPECS` 不引用已删常量**

读取 `src/constants/data.js:165-180`，确认 `EC_PLATFORM_SPECS` 的 `sizes` 字段是纯字符串展示，不依赖 `EC_ADV_TYPES`/`EC_STYLE_PACKS`。如引用已删常量则删除对应 key。无需改则跳过。

- [ ] **Step 8: 提交**

```bash
git add src/constants/data.js
git commit -m "refactor(ec): 精简电商常量为 4 类图片 + 详情切片 + SKU 字段"
```

---

## Task 2: 重构 `server/ecommercePromptEngine.mjs` prompt 引擎

**Files:**
- Modify: `server/ecommercePromptEngine.mjs` (整体大改)

**Interfaces:**
- Consumes: 无
- Produces: `buildECPrompt`（支持新角色 key：white_bg/main_text/main_3x4/transparent/sku/detail_slice_*）、新增 `buildSkuPrompt({ productName, variants[] })`、`buildDetailSlicePrompt(sliceType, ctx)`、重写 `buildOutline`（支持 sku/detail_slice）、`IMAGE_ROLES`（精简）、`PLATFORM_SIZES`（1440）；删除 `STYLE_PACKS`/`CONVERSION_DRIVERS`/`getSmartRecommendations`/`TIER_*`/`buildBeautyReportPrompt`/`getTierImages`

- [ ] **Step 1: 删除 `STYLE_PACKS` 整段（21-117）**

删除从 `const STYLE_PACKS = {` 到对应 `};`（line 117）的整块。

- [ ] **Step 2: 删除 `CONVERSION_DRIVERS` 整段（原 119-136）**

删除从 `const CONVERSION_DRIVERS = {` 到对应 `};` 的整块（含其上的注释 `/** 转化驱动力类型 ... */`）。

- [ ] **Step 3: 重写 `IMAGE_ROLES`（原 268-367）**

用以下内容替换整个 `IMAGE_ROLES = { ... };` 块：

```js
const IMAGE_ROLES = {
  white_bg:        { label:'白底图',      group:'主图', desc:'纯白底·无文字',        ratio:'1:1', priority:1 },
  main_text:       { label:'主图 1:1',    group:'主图', desc:'白底+促销文案',         ratio:'1:1', priority:2 },
  main_3x4:        { label:'主图 3:4',    group:'主图', desc:'多角度/场景 3:4',       ratio:'3:4', priority:3 },
  transparent:     { label:'透明PNG',     group:'素材', desc:'去底透明素材',          ratio:'1:1', priority:4 },
  sku:             { label:'SKU规格图',   group:'规格', desc:'多色/规格并排',         ratio:'1:1', priority:5 },
  detail_slice_size:    { label:'尺寸标注切片', group:'详情', desc:'引线标尺寸',     ratio:'3:4', priority:6 },
  detail_slice_scene:   { label:'场景拍摄切片', group:'详情', desc:'真实环境',       ratio:'3:4', priority:7 },
  detail_slice_qc:      { label:'质检报告切片', group:'详情', desc:'合格证/检测',     ratio:'3:4', priority:8 },
  detail_slice_compare: { label:'优势对比切片', group:'详情', desc:'vs同款差异',     ratio:'3:4', priority:9 },
  detail_slice_feature: { label:'细节功能切片', group:'详情', desc:'功能点callout',  ratio:'3:4', priority:10 },
  detail_slice_care:    { label:'保养维护切片', group:'详情', desc:'保养说明',       ratio:'3:4', priority:11 },
};
```

- [ ] **Step 4: 删除 `TIER_ROLES` 与 `TIER_META`（原 372-382）**

删除从 `const TIER_ROLES = {` 到 `TIER_META` 的 `};` 的整块（含注释 `// 生成等级 → 包含的图片角色`）。

- [ ] **Step 5: 更新 `PLATFORM_SIZES` 为 1440（原 387-418）**

用以下替换整个 `PLATFORM_SIZES = { ... };` 块：

```js
const PLATFORM_SIZES = {
  '淘宝':       { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'淘宝/天猫，首图1440×1440' },
  '京东':       { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'京东，品质优先' },
  '拼多多':     { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'拼多多，可含促销文字' },
  '小红书电商': { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'小红书商城，3:4竖版' },
  '抖音电商':   { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'抖音小店，移动优先' },
  '亚马逊':     { '1:1':'1000×1000px', '3:4':'1500×2000px', desc:'Amazon，白底图不可含文字' },
};
```

- [ ] **Step 6: 删除 `getTierImages` 函数（原 436-444）**

删除从 `export function getTierImages(` 到对应 `}` 的整块（含其上 JSDoc 注释）。

- [ ] **Step 7: 重写 `buildECPrompt`（原 456-497）**

用以下替换整个 `buildECPrompt` 函数（含 JSDoc）：

```js
/**
 * 构建单张电商图提示词（精修工坊重构版）
 * @param {Object} params
 * @param {string} params.productName
 * @param {string} params.category
 * @param {string} params.roleKey - white_bg/main_text/main_3x4/transparent/sku/detail_slice_*
 * @param {string[]} params.sellingPoints
 * @param {string} params.platform
 * @param {Object} [params.variant] - SKU 变体行 {color,size,capacity,dimLabel}
 * @param {string} [params.sliceNote] - 切片自定义文案
 * @param {Object} [params.campaignLock] - 主图统一 lock（可选）
 * @returns {string}
 */
export function buildECPrompt({ productName, category, roleKey, sellingPoints = [], platform = '淘宝', variant, sliceNote, campaignLock }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  const baseKey = roleKey.replace(/_\d+$/, '');
  const role = IMAGE_ROLES[baseKey];
  if (!role) return buildGenericPrompt(productName, category, cat);

  const platformVisual = PLATFORM_VISUAL_GUIDE[platform] || PLATFORM_VISUAL_GUIDE['淘宝'];
  const platformDesc = PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'];
  const sizeInfo = platformDesc[role.ratio] || '';
  const myPoint = sellingPoints[0] || '';
  const allPoints = sellingPoints.slice(0, 4).filter(Boolean);

  let prompt;
  switch (baseKey) {
    case 'white_bg':    prompt = buildRolePrompt('white_bg',    { productName, category, cat, platformVisual, sizeInfo }); break;
    case 'main_text':   prompt = buildRolePrompt('main_text',   { productName, category, cat, myPoint, allPoints, platformVisual, sizeInfo }); break;
    case 'main_3x4':    prompt = buildMain3x4Prompt({ productName, category, cat, myPoint, allPoints, platformVisual, sizeInfo }); break;
    case 'transparent': prompt = buildRolePrompt('transparent', { productName, category, cat, platformVisual, sizeInfo }); break;
    case 'sku':         prompt = buildSkuPrompt({ productName, category, cat, variant, platformVisual, sizeInfo }); break;
    default:
      if (baseKey.startsWith('detail_slice_')) {
        prompt = buildDetailSlicePrompt(baseKey, { productName, category, cat, myPoint, allPoints, sliceNote, platformVisual, sizeInfo });
      } else {
        prompt = buildGenericPrompt(productName, category, cat);
      }
  }

  // 主图（非白底）套用统一 lock，保证一套主图视觉一致
  if (baseKey !== 'white_bg' && (baseKey === 'main_text' || baseKey === 'main_3x4')) {
    const lock = campaignLock || DEFAULT_CAMPAIGN_LOCK;
    const lockText = buildCampaignLockText(lock);
    if (lockText) prompt = `${lockText}\n\n${prompt}`;
  }
  return prompt;
}

// 统一默认 Campaign Style Lock（替代旧风格包）
const DEFAULT_CAMPAIGN_LOCK = {
  visualDirection: 'Professional e-commerce product photography, clean and consistent',
  palette: ['#FFFFFF', '#333333', '#666666'],
  colorTemp: 'neutral',
  backgroundSystem: 'Pure white or clean light gradient, seamless, no texture',
  lightingSystem: 'Softbox overhead, even diffused studio lighting, soft shadows',
  layoutSystem: 'Centered composition, 60-70% product coverage, generous whitespace',
  productPresentation: '3/4 elevated angle, product as hero, sharp focus on details',
};
```

- [ ] **Step 8: 在 `buildRolePrompt` 的 switch 里新增 `main_3x4` case，删除旧角色**

在 `buildRolePrompt` 函数（原 503-697）里：
1. 删除 `case 'feature_1': case 'feature_2': case 'feature_3':` 整块（原 534-552）
2. 删除 `case 'scene':` 整块（原 554-567）
3. 删除 `case 'detail':` 整块（原 569-588）
4. 删除 `case 'macro':` 整块（原 590-608）
5. 删除 `case 'comparison':` 整块（原 610-627）
6. 删除 `case 'composite':` 整块（原 629-647）
7. 删除 `case 'sku':` 整块（原 649-662）—— 由新的 `buildSkuPrompt` 取代
8. 删除 `case 'package':` 整块（原 664-677）

保留 `case 'white_bg'`、`case 'main_text'`、`case 'transparent'`、`default`。`main_text` case 里把 `ASPECT RATIO: 1:1 square` 保持不变（尺寸走 sizeInfo）。

- [ ] **Step 9: 新增 `buildMain3x4Prompt`、`buildSkuPrompt`、`buildDetailSlicePrompt` 三个函数**

在 `buildRolePrompt` 函数之后、`buildGenericPrompt` 之前插入：

```js
function buildMain3x4Prompt({ productName, category, cat, myPoint, allPoints, platformVisual, sizeInfo }) {
  return (
    `E-commerce vertical main image (3:4) for ${productName}. ` +
    `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
    `BACKGROUND: Clean studio or soft gradient from ${cat.base_colors}. ` +
    `LIGHTING: ${cat.lighting}. Studio quality. ` +
    `COMPOSITION: Product as hero, 3:4 portrait, 55-65% of frame. ` +
    `Multi-angle or lifestyle angle preferred (3/4 view, elevated, or in-scene). ` +
    `TEXT: Optional minimal Chinese promotional text in corner (max 1-2 short elements). ` +
    `CRITICAL — NO PEOPLE unless lifestyle scene requires: no faces, no hands focus. Product is hero. ` +
    `STYLE: Professional e-commerce vertical main image. Polished, mobile-first. ` +
    `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
    `PLATFORM: ${platformVisual}`
  );
}

/**
 * 构建 SKU 规格并排图 prompt
 * @param {Object} p
 * @param {string} p.productName
 * @param {string} p.category
 * @param {Object} p.cat - CATEGORY_VISUALS 项
 * @param {Object} [p.variant] - 单行变体 {color,size,capacity,dimLabel}
 * @param {string} p.platformVisual
 * @param {string} p.sizeInfo
 */
function buildSkuPrompt({ productName, category, cat, variant, platformVisual, sizeInfo }) {
  // 单行：展示一个变体；多行并排由调用方循环或一次性多变体（这里按单变体出图，前端一行一张图）
  const colorName = (variant && variant.color) ? variant.color : '';
  const sizeVal = (variant && variant.size) ? variant.size : '';
  const capVal = (variant && variant.capacity) ? variant.capacity : '';
  const dimVal = (variant && variant.dimLabel) ? variant.dimLabel : '';

  const labelParts = [colorName, sizeVal, capVal].filter(Boolean);
  const labelText = labelParts.join(' · ');
  const dimLine = dimVal ? `Dimension annotation "${dimVal}" printed below or beside the product in clean sans-serif Chinese.` : '';

  return (
    `E-commerce single SKU variant showcase for ${productName}. ` +
    `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
    `VARIANT: This image shows ONE variant of the product. ` +
    (colorName ? `Color name: "${colorName}" — render the product in exactly this color. Do NOT invent a different color. ` : '') +
    (sizeVal ? `Size/spec: "${sizeVal}". ` : '') +
    (capVal ? `Capacity/qty: "${capVal}". ` : '') +
    `LAYOUT: Single product centered, 3/4 angle, on clean light background (${cat.background_detail}). ` +
    `LIGHTING: ${cat.lighting}. ` +
    `TEXT: Small Chinese label below product: "${labelText || productName}". Max 8 Chinese chars. Clean pill badge, high contrast. ` +
    dimLine + ' ' +
    `STYLE: Clean catalog SKU photography. Sharp focus. ` +
    `CONSTRAINTS: Product shape MUST match the reference real-shot exactly — only color differs across variants. Color name text must be accurate, no fake characters. ` +
    `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
    `PLATFORM: ${platformVisual}`
  );
}

/**
 * 构建详情长图切片 prompt（1440 宽，≤2880 高）
 * @param {string} sliceType - detail_slice_size/scene/qc/compare/feature/care
 * @param {Object} ctx
 */
function buildDetailSlicePrompt(sliceType, { productName, category, cat, myPoint, allPoints, sliceNote, platformVisual, sizeInfo }) {
  const note = sliceNote ? ` Extra instruction from seller: "${sliceNote}".` : '';
  const base = `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
    `BACKGROUND: ${cat.background_detail}. LIGHTING: ${cat.lighting}. COLOR: ${cat.color_scheme}. `;

  switch (sliceType) {
    case 'detail_slice_size':
      return (
        `E-commerce detail page slice — DIMENSION ANNOTATION for ${productName}. ` +
        base +
        `LAYOUT: Product centered with leader lines (thin red arrows) pointing to edges, ` +
        `each line ends in a dimension callout in Chinese (e.g., "长 20cm", "宽 10cm", "高 5cm"). ` +
        `Use the seller-provided dimensions if given, otherwise show representative measurements. ` +
        `Top header: "${productName} 尺寸标注" in Chinese. ` +
        `STYLE: Technical infographic, clean, readable on mobile. ` +
        `CONSTRAINTS: Chinese numbers/units accurate. No fake characters. ` +
        `SIZE: 1440px wide, height ≤2880px, 3:4-ish vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_scene':
      return (
        `E-commerce detail page slice — LIFESTYLE SCENE for ${productName}. ` +
        base +
        `SCENE: ${cat.scene_desc}. Surface: ${cat.surface}. Props: 2-3 contextual items. ` +
        `COMPOSITION: Product as hero in real environment, natural arrangement. ` +
        `TEXT: NO text overlay — natural scene. ` +
        `STYLE: Professional lifestyle e-commerce photography. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_qc':
      return (
        `E-commerce detail page slice — QUALITY CHECK / INSPECTION REPORT for ${productName}. ` +
        base +
        `LAYOUT: Product on one side, a mock inspection certificate / test report card on the other. ` +
        `Card shows Chinese headers: "质检报告", "检测项目", "检测结果:合格", a mock seal/stamp. ` +
        `Top header: "${productName} 质检报告". ` +
        `STYLE: Trustworthy, official-looking infographic. ` +
        `CONSTRAINTS: Chinese text accurate, report looks credible but is clearly a mock. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_compare':
      return (
        `E-commerce detail page slice — ADVANTAGE COMPARISON for ${productName}. ` +
        base +
        `LAYOUT: Split comparison. Left: "普通款" (generic version, slightly dull). ` +
        `Right: "${productName}" (premium, well-lit). Bottom: Chinese headline highlighting ${myPoint || '优势'}. ` +
        `A checkmark/cross icon column between them. ` +
        `STYLE: Clean comparison infographic, convincing. ` +
        `CONSTRAINTS: Chinese labels accurate. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_feature':
      return (
        `E-commerce detail page slice — FEATURE / FUNCTION CALLOUT for ${productName}. ` +
        base +
        `LAYOUT: Product on left (55%), 3-4 feature callout pills on right with thin connector lines to product parts. ` +
        `Each callout: short Chinese label (max 8 chars) + 1 line description. ` +
        `Features: ${(allPoints && allPoints.length > 0) ? allPoints.join(' / ') : '核心功能点'}. ` +
        `Top header: "${productName} 细节功能". ` +
        `STYLE: Infographic, premium, readable. ` +
        `CONSTRAINTS: Chinese text accurate. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_care':
      return (
        `E-commerce detail page slice — MAINTENANCE / CARE GUIDE for ${productName}. ` +
        base +
        `LAYOUT: Product on top, 3-4 care instruction icons + Chinese text below ` +
        `(e.g., "避免暴晒", "温水手洗", "存放干燥处"). ` +
        `Use the seller-provided care note if given. ` +
        `Top header: "${productName} 保养维护". ` +
        `STYLE: Friendly, clear, icon-driven infographic. ` +
        `CONSTRAINTS: Chinese text accurate. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    default:
      return buildGenericPrompt(productName, category, cat);
  }
}
```

- [ ] **Step 10: 删除 `buildBeautyReportPrompt` 函数（原 714-754）**

删除从 `export function buildBeautyReportPrompt(` 到对应 `}` 的整块（含其上 JSDoc）。

- [ ] **Step 11: 精简 `IMAGE_TYPE_INFO`（原 763-874）**

用以下替换整个 `IMAGE_TYPE_INFO = [ ... ];` 数组：

```js
const IMAGE_TYPE_INFO = [
  { key:'white_bg',    label:'白底图',     emoji:'⬜', mandatory:true,  defaultCount:1, maxCount:5, explainer:'纯白底产品居中，无文字无水印。平台首图硬性要求。', recommendRule:'必选至少1张' },
  { key:'main_text',   label:'主图 1:1',   emoji:'🖼️', mandatory:false, defaultCount:5, maxCount:5, explainer:'白底1张 + 卖点4张，1440×1440。', recommendRule:'默认5张' },
  { key:'main_3x4',    label:'主图 3:4',   emoji:'📱', mandatory:false, defaultCount:5, maxCount:5, explainer:'多角度/场景，1440×1920竖版。', recommendRule:'默认5张' },
  { key:'transparent', label:'PNG透明图',  emoji:'🎯', mandatory:false, defaultCount:1, maxCount:1, explainer:'去底透明素材，可导入PS/Canva。', recommendRule:'默认1张' },
  { key:'sku',         label:'SKU规格图',  emoji:'🎨', mandatory:false, defaultCount:0, maxCount:20, explainer:'按用户填的变体行生成并排图。', recommendRule:'用户定义数量' },
  { key:'detail_slice_size',    label:'尺寸标注切片', emoji:'📏', mandatory:false, defaultCount:0, maxCount:1, explainer:'引线标尺寸的详情切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_scene',   label:'场景拍摄切片', emoji:'🌄', mandatory:false, defaultCount:0, maxCount:1, explainer:'产品在真实环境切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_qc',      label:'质检报告切片', emoji:'✅', mandatory:false, defaultCount:0, maxCount:1, explainer:'合格证/检测信息切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_compare', label:'优势对比切片', emoji:'↔️', mandatory:false, defaultCount:0, maxCount:1, explainer:'vs同款差异切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_feature', label:'细节功能切片', emoji:'🔍', mandatory:false, defaultCount:0, maxCount:1, explainer:'功能点callout切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_care',    label:'保养维护切片', emoji:'🧴', mandatory:false, defaultCount:0, maxCount:1, explainer:'保养说明切片。', recommendRule:'勾选生成' },
];
```

- [ ] **Step 12: 删除 `getSmartRecommendations` 函数（原 885-922）**

删除从 `export function getSmartRecommendations(` 到对应 `}` 的整块（含 JSDoc）。

- [ ] **Step 13: 重写 `buildOutline`（原 929-1012）**

用以下替换整个 `buildOutline` 函数：

```js
/**
 * 根据用户勾选/配置生成大纲列表
 * @param {Object} params
 * @param {string} params.productName
 * @param {string} params.category
 * @param {Array<{key:string,count?:number,variant?:Object,sliceNote?:string}>} params.imageSelections
 * @param {string[]} params.sellingPoints
 * @param {Array<Object} [params.skus] - SKU 变体行 [{color,size,capacity,dimLabel}]
 * @param {Object} [params.detailPlan] - {sizeAnnot,scene,qc,compare,feature,notes}
 * @param {string} [params.maintenance]
 * @returns {Array<{key,instance,label,emoji,sellingPoint,outlineText,variant,sliceNote}>}
 */
export function buildOutline({ productName, category, imageSelections, sellingPoints = [], skus = [], detailPlan, maintenance }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  const points = Array.isArray(sellingPoints) ? sellingPoints.filter(Boolean) : [];
  const outline = [];

  const LABELS = {
    white_bg:'白底图', main_text:'主图 1:1', main_3x4:'主图 3:4',
    transparent:'PNG透明图', sku:'SKU规格图',
    detail_slice_size:'尺寸标注切片', detail_slice_scene:'场景拍摄切片',
    detail_slice_qc:'质检报告切片', detail_slice_compare:'优势对比切片',
    detail_slice_feature:'细节功能切片', detail_slice_care:'保养维护切片',
  };

  const textFor = (key, i, sel) => {
    switch (key) {
      case 'white_bg':    return `${productName} — 纯白底图，产品居中，无文字。`;
      case 'main_text':   return `${productName} — 主图1:1 ${i+1}，白底+卖点${points[i]||''}。`;
      case 'main_3x4':    return `${productName} — 主图3:4 ${i+1}，多角度/场景。`;
      case 'transparent': return `${productName} — 去底透明PNG。`;
      case 'sku': {
        const v = sel.variant || {};
        return `${productName} — SKU：${[v.color,v.size,v.capacity].filter(Boolean).join(' · ')||'变体'}${v.dimLabel?' '+v.dimLabel:''}。`;
      }
      case 'detail_slice_size':    return `${productName} — 尺寸标注切片。${sel.sliceNote||''}`;
      case 'detail_slice_scene':   return `${productName} — 场景拍摄切片。${sel.sliceNote||''}`;
      case 'detail_slice_qc':      return `${productName} — 质检报告切片。${sel.sliceNote||''}`;
      case 'detail_slice_compare': return `${productName} — 优势对比切片。${sel.sliceNote||''}`;
      case 'detail_slice_feature': return `${productName} — 细节功能切片。${sel.sliceNote||''}`;
      case 'detail_slice_care':    return `${productName} — 保养维护切片。${maintenance||''}`;
      default: return `${productName} — 商品图。`;
    }
  };

  for (const sel of imageSelections || []) {
    const key = sel.key;
    const count = sel.count || 1;
    const label = LABELS[key] || key;

    if (key === 'sku' && skus && skus.length > 0) {
      // SKU 按 skus 行展开，忽略 count
      skus.forEach((variant, i) => {
        outline.push({
          key, instance: i + 1, label: `SKU ${i+1}`, variant,
          emoji: IMAGE_TYPE_INFO.find(t => t.key === key)?.emoji || '🎨',
          sellingPoint: '', cat, outlineText: textFor(key, i, { variant }),
        });
      });
      continue;
    }

    for (let i = 0; i < count; i++) {
      outline.push({
        key, instance: i + 1, label: count > 1 ? `${label} ${i+1}` : label,
        emoji: IMAGE_TYPE_INFO.find(t => t.key === key)?.emoji || '🖼️',
        sellingPoint: key === 'main_text' ? (points[i] || '') : '',
        cat, outlineText: textFor(key, i, sel), sliceNote: sel.sliceNote || '',
      });
    }
  }

  return outline;
}
```

- [ ] **Step 14: 更新文件末尾 `export` 语句（原 1014）**

用以下替换最后一行 `export { ... };`：

```js
export {
  CATEGORY_VISUALS, IMAGE_TYPE_INFO, PLATFORM_SIZES, PLATFORM_VISUAL_GUIDE, IMAGE_ROLES,
  buildECPrompt, buildOutline, getCategoryOptions,
};
```

删除已不存在的 `STYLE_PACKS`、`CONVERSION_DRIVERS`、`getSmartRecommendations`、`getTierImages`、`buildBeautyReportPrompt` 的导出。

- [ ] **Step 15: 检查 `buildCampaignLockText` 仍存在**

确认 `buildCampaignLockText` 函数定义在文件中（用于 Step 7 的 lock 文本拼接）。如已被误删则恢复其定义：

```js
function buildCampaignLockText(lock) {
  if (!lock) return '';
  return [
    `CAMPAIGN STYLE LOCK (apply to ALL images in this campaign for visual consistency):`,
    `- Visual direction: ${lock.visualDirection}`,
    `- Palette: ${(lock.palette||[]).join(', ')}`,
    `- Color temperature: ${lock.colorTemp}`,
    `- Background: ${lock.backgroundSystem}`,
    `- Lighting: ${lock.lightingSystem}`,
    `- Layout: ${lock.layoutSystem}`,
    `- Product presentation: ${lock.productPresentation}`,
  ].join('\n');
}
```

- [ ] **Step 16: 启动 server 做语法冒烟测试**

Run: `cd f:/da/shubao && node -e "import('./server/ecommercePromptEngine.mjs').then(m => console.log(Object.keys(m))).catch(e => {console.error(e); process.exit(1);})"`
Expected: 打印导出键数组，无语法错误，包含 `buildECPrompt`、`buildOutline`，不含 `STYLE_PACKS`。

- [ ] **Step 17: 提交**

```bash
git add server/ecommercePromptEngine.mjs
git commit -m "refactor(ec-engine): 删风格包/档次/美妆报告，新增主图3:4/SKU/详情切片prompt"
```

---

## Task 3: 后端新增 `/api/ecommerce/auto-recognize` 与 `/api/ecommerce/stitch-long` 路由

**Files:**
- Modify: `server/index.mjs`（在 `/api/ecommerce-preview` 路由附近新增 2 个路由，约 2422 行后插入）

**Interfaces:**
- Consumes: `analyzeReferenceImages`（server/index.mjs:231，Vision 分析）、`callMiniLLM`、`sharp`（server/index.mjs:15）、`EC_CATS`（前端发来的品类候选）
- Produces: `POST /api/ecommerce/auto-recognize` 返回 `{ product, skus, detailPlan, maintenance, rawVision }`；`POST /api/ecommerce/stitch-long` 返回 `{ url }`（拼接后的长图 URL）

- [ ] **Step 1: 在 `/api/ecommerce-preview` 路由之后新增 `/api/ecommerce/auto-recognize`**

在 `server/index.mjs` 的 `/api/ecommerce-preview` 路由 `});`（约 2422 行）之后插入：

```js
// ============================================================
// 智能识别：Vision 分析参考图 + smartBrief 文字 → 回填 5 步字段
// ============================================================
app.post('/api/ecommerce/auto-recognize', async (req, res) => {
  const { smartBrief, refShots } = req.body || {};
  if (!smartBrief && !refShots?.length) {
    return res.status(400).json({ error: '请填写描述或上传参考图' });
  }
  try {
    // 1) Vision 分析参考图（复用现有函数）
    let vision = null;
    if (refShots?.length) {
      vision = await analyzeReferenceImages(refShots.slice(0, 5));
    }

    // 2) 让 LLM 综合参考图 + smartBrief 推断 5 步字段
    const sys = `你是电商运营专家。根据用户描述和参考图分析，推断商品信息并返回严格 JSON（只返回 JSON，不要其他文字）：
{
  "product": { "name": "商品名", "category": "品类(从候选里选)", "material": "材质/工艺", "dimensions": "长x宽x高 cm" },
  "skus": [ { "color": "颜色名≤4字", "size": "规格/尺码", "capacity": "容量/数量", "dimLabel": "标注尺寸" } ],
  "detailPlan": { "sizeAnnot": true, "scene": true, "qc": false, "compare": false, "feature": true, "notes": { "sizeAnnot":"", "scene":"", "qc":"", "compare":"", "feature":"" } },
  "maintenance": "一句保养建议"
}
规则：
- skus 至少 1 行，最多 6 行；颜色名用常见中文名（月岩白/曜石黑/雾霾蓝），不自创生僻字。
- detailPlan 只勾选对商品有意义的项；notes 简短或空字符串。
- category 必须从候选里选，找不到就填"其他"。`;

    const candidates = ['美妆护肤','数码3C','食品饮料','服饰穿搭','家居生活','母婴用品','宠物用品','其他'];
    const userMsg = `用户描述：${smartBrief || '（未填）'}\n候选品类：${candidates.join('、')}\n参考图分析：${vision ? JSON.stringify(vision) : '（无参考图）'}`;

    const llmRes = await callMiniLLM(sys, refShots?.slice(0,5) || [], userMsg);
    const match = (llmRes || '').match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'AI 识别失败，请重试' });
    const parsed = JSON.parse(match[0]);

    // 兜底：确保字段存在
    parsed.product = parsed.product || { name:'', category:'其他', material:'', dimensions:'' };
    parsed.skus = Array.isArray(parsed.skus) && parsed.skus.length ? parsed.skus : [{ color:'', size:'', capacity:'', dimLabel:'' }];
    parsed.detailPlan = Object.assign({ sizeAnnot:true, scene:true, qc:false, compare:false, feature:true, notes:{} }, parsed.detailPlan || {});
    parsed.detailPlan.notes = Object.assign({ sizeAnnot:'', scene:'', qc:'', compare:'', feature:'' }, parsed.detailPlan.notes || {});
    parsed.maintenance = parsed.maintenance || '';
    parsed.rawVision = vision;

    res.json(parsed);
  } catch (e) {
    console.warn('[auto-recognize] 失败:', e.message);
    res.status(500).json({ error: 'AI 识别失败：' + (e.message || '') });
  }
});
```

> 注意：`callMiniLLM` 与 `analyzeReferenceImages` 均为 server/index.mjs 已有的内部函数，直接复用。

- [ ] **Step 2: 新增 `/api/ecommerce/stitch-long`（sharp 纵向拼长图）**

紧接 `/api/ecommerce/auto-recognize` 路由之后插入：

```js
// ============================================================
// 详情切片 → 纵向拼成长图（用于微信分享）
// ============================================================
app.post('/api/ecommerce/stitch-long', async (req, res) => {
  const { imageUrls } = req.body || {};
  if (!imageUrls?.length) return res.status(400).json({ error: '缺少切片图' });
  if (imageUrls.length > 20) return res.status(400).json({ error: '切片数不能超过 20' });
  try {
    // 下载所有切片为 Buffer
    const bufs = [];
    for (const u of imageUrls) {
      let buf;
      if (typeof u === 'string' && u.startsWith('data:image')) {
        buf = Buffer.from(u.split(',')[1], 'base64');
      } else if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('下载切片失败: ' + u);
        buf = Buffer.from(await r.arrayBuffer());
      } else {
        continue;
      }
      bufs.push(buf);
    }
    if (bufs.length === 0) return res.status(400).json({ error: '没有可拼接的有效图片' });

    // 统一宽度为 1440，纵向拼接
    const TARGET_W = 1440;
    const resized = await Promise.all(bufs.map(b => sharp(b).resize({ width: TARGET_W, withoutEnlargement: false }).toBuffer()));
    const metas = await Promise.all(resized.map(b => sharp(b).metadata()));
    const totalH = metas.reduce((s, m) => s + (m.height || 0), 0);

    if (totalH > 30000) {
      return res.status(400).json({ error: '拼接后长图过高（' + totalH + 'px），请减少切片数' });
    }

    // 用 sharp 的 raw pixel 纵向堆叠：创建空白大图 composite
    const composites = [];
    let yOff = 0;
    for (let i = 0; i < resized.length; i++) {
      composites.push({ input: resized[i], top: yOff, left: 0 });
      yOff += metas[i].height || 0;
    }
    const longBuf = await sharp({
      create: { width: TARGET_W, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).composite(composites).png().toBuffer();

    // 保存到 dist 下的合成图目录，返回 URL
    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.join(process.cwd(), 'dist', 'stitched');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const fileName = `long-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, longBuf);
    const url = `/stitched/${fileName}`;
    console.log(`[stitch-long] 拼接 ${bufs.length} 片 → ${TARGET_W}x${totalH} → ${url}`);
    res.json({ url, width: TARGET_W, height: totalH, count: bufs.length });
  } catch (e) {
    console.warn('[stitch-long] 失败:', e.message);
    res.status(500).json({ error: '拼接失败：' + (e.message || '') });
  }
});
```

- [ ] **Step 3: 验证 `sharp` 在文件顶部已 import**

Run: `cd f:/da/shubao && node -e "import('fs').then(fs=>{const t=fs.readFileSync('server/index.mjs','utf8');console.log(t.includes(\"import sharp from 'sharp'\")?'sharp ok':'sharp MISSING')})"`
Expected: `sharp ok`。若 MISSING，在 `server/index.mjs` 顶部加 `import sharp from 'sharp';`。

- [ ] **Step 4: 启动 server 冒烟测试路由注册**

Run: `cd f:/da/shubao && node -e "import('./server/index.mjs').then(()=>setTimeout(()=>process.exit(0),2000)).catch(e=>{console.error(e);process.exit(1);})"`
Expected: server 正常启动，控制台打印路由加载日志，无 `auto-recognize`/`stitch-long` 重复注册报错。2 秒后自动退出。

- [ ] **Step 5: 提交**

```bash
git add server/index.mjs
git commit -m "feat(ec-api): 新增智能识别与详情拼长图路由"
```

---

## Task 4: 更新 `src/services/api.js` 前端 API 函数

**Files:**
- Modify: `src/services/api.js:63-150`

**Interfaces:**
- Consumes: `API_BASE`（文件顶部已定义）
- Produces: `autoRecognizeEcommerce({ smartBrief, refShots })`、`stitchLongImage(imageUrls)`、更新后的 `generateEcommerce`（新增 `skus`/`detailPlan`/`maintenance`/`realShots`/`variants` 入参，去掉 `beautyReport`/`stylePack`/`campaignLock`/`conversionDriver`/`tier`）

- [ ] **Step 1: 更新 `generateEcommerce` 入参**

替换 `src/services/api.js:64-91`（`export async function generateEcommerce({...})` 到 `if (imageSelections?.length > 0) {` 之前）：

```js
/* ── 电商图生成（精修工坊重构版） ── */
export async function generateEcommerce({ productName, category, refImgs, realShots, platform, points, skus, detailPlan, maintenance, material, restrictions, imageSelections, imageSize, onImage, onProgress }) {
  const body = {
    product_name: productName,
    category,
    reference_images: refImgs || [],
    real_shots: realShots || [],
    platform,
    selling_points: points || '',
    skus: skus || [],
    detail_plan: detailPlan || null,
    maintenance: maintenance || '',
    material: material || '',
    restrictions: restrictions || '',
  };
  if (imageSize?.width && imageSize?.height) {
    body.image_size = imageSize;
  }
  if (imageSelections?.length > 0) {
    body.image_selections = imageSelections;
  }
  const res = await fetch(`${API_BASE}/api/generate-ecommerce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
```

保留原文件 92 行起的 SSE 解析循环（`const reader = res.body.getReader();` 到 `return result;`）不变。

- [ ] **Step 2: 在 `generateEcommerce` 之后新增 `autoRecognizeEcommerce`**

在 `src/services/api.js` 的 `generateEcommerce` 函数 `}`（约 131 行）之后、`generateEcommercePreview` 之前插入：

```js
/* ── 电商智能识别（Vision 回填 5 步字段） ── */
export async function autoRecognizeEcommerce({ smartBrief, refShots }) {
  const res = await fetch(`${API_BASE}/api/ecommerce/auto-recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartBrief: smartBrief || '', refShots: refShots || [] }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
  return res.json();
}
```

- [ ] **Step 3: 新增 `stitchLongImage`**

紧接 `autoRecognizeEcommerce` 之后插入：

```js
/* ── 详情切片拼长图（微信分享用） ── */
export async function stitchLongImage(imageUrls) {
  const res = await fetch(`${API_BASE}/api/ecommerce/stitch-long`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrls }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
  return res.json();
}
```

- [ ] **Step 4: 更新 `generateEcommercePreview` 去掉 `stylePack`**

替换 `src/services/api.js` 的 `generateEcommercePreview` 函数（约 133-150）：

```js
/* ── 电商大纲预览（重构版） ── */
export async function generateEcommercePreview({ productName, category, points, refCount, hasMaterial, imageSelections, skus, detailPlan, maintenance }) {
  const res = await fetch(`${API_BASE}/api/ecommerce-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_name: productName,
      category,
      selling_points: points,
      ref_count: refCount || 0,
      has_material: !!hasMaterial,
      image_selections: imageSelections || null,
      skus: skus || [],
      detail_plan: detailPlan || null,
      maintenance: maintenance || '',
    }),
  });
  if (!res.ok) throw new Error('预览请求失败');
  return res.json();
}
```

- [ ] **Step 5: 提交**

```bash
git add src/services/api.js
git commit -m "feat(ec-api-client): 新增智能识别/拼长图API，更新生成入参"
```

---

## Task 5: 更新 `/api/ecommerce-preview` 与 `/api/generate-ecommerce` 路由适配新入参

**Files:**
- Modify: `server/index.mjs:2387-2585`（两个路由）

**Interfaces:**
- Consumes: 重构后的 `buildOutline`（支持 skus/detailPlan/maintenance）、`buildECPrompt`（支持 variant/sliceNote/campaignLock）、`IMAGE_ROLES`、`IMAGE_TYPE_INFO`
- Produces: `/api/ecommerce-preview` 返回带新切片类型的 `imageTypes`/`outline`；`/api/generate-ecommerce` 支持按 skus 展开 SKU 图、按 detailPlan 展开切片图

- [ ] **Step 1: 重写 `/api/ecommerce-preview` 路由（2387-2422）**

用以下替换整个 `app.post('/api/ecommerce-preview', ...)` 路由：

```js
app.post('/api/ecommerce-preview', (req, res) => {
  const { product_name, category, selling_points, ref_count, has_material, image_selections, skus, detail_plan, maintenance } = req.body || {};
  if (!product_name) return res.status(400).json({ error: '缺少商品名称' });

  const sellingPoints = (typeof selling_points === 'string' ? selling_points : '').split(/[\n,;，；]/).filter(Boolean);

  // 构建图片配置：用户自选优先，否则默认套（主图1:1×5 + 主图3:4×5 + 透明×1 + SKU×用户数 + 勾选切片）
  let selections = [];
  if (Array.isArray(image_selections) && image_selections.length > 0) {
    selections = image_selections.map(t => ({ key: t.key || t.k, count: t.count || t.c || 1, variant: t.variant, sliceNote: t.sliceNote }));
  } else {
    selections = [
      { key: 'white_bg', count: 1 },
      { key: 'main_text', count: 5 },
      { key: 'main_3x4', count: 5 },
      { key: 'transparent', count: 1 },
    ];
    if (Array.isArray(skus) && skus.length) selections.push({ key: 'sku', count: skus.length });
    const dp = detail_plan || {};
    if (dp.sizeAnnot)  selections.push({ key: 'detail_slice_size', count: 1, sliceNote: dp.notes?.sizeAnnot });
    if (dp.scene)      selections.push({ key: 'detail_slice_scene', count: 1, sliceNote: dp.notes?.scene });
    if (dp.qc)         selections.push({ key: 'detail_slice_qc', count: 1, sliceNote: dp.notes?.qc });
    if (dp.compare)    selections.push({ key: 'detail_slice_compare', count: 1, sliceNote: dp.notes?.compare });
    if (dp.feature)    selections.push({ key: 'detail_slice_feature', count: 1, sliceNote: dp.notes?.feature });
    if (maintenance)   selections.push({ key: 'detail_slice_care', count: 1, sliceNote: maintenance });
  }

  const imageTypes = IMAGE_TYPE_INFO.map(t => {
    const r = selections.find(s => s.key === t.key);
    return { ...t, recommended: r?.count || 0, recommendReason: r ? '已配置' : '' };
  });

  const outline = buildOutline({
    productName: product_name,
    category: category || '其他',
    imageSelections: selections,
    sellingPoints,
    skus,
    detailPlan: detail_plan,
    maintenance,
  });

  res.json({ product_name, category: category || '其他', imageTypes, outline });
});
```

- [ ] **Step 2: 重写 `/api/generate-ecommerce` 的 `expandedImages` 构建段（2443-2459）**

用以下替换 `const expandedImages = [];` 到 `expandedImages.push(...)` 的整段（2443-2459）：

```js
  // 构建图片角色列表：image_selections 或默认套
  const expandedImages = [];
  if (image_selections?.length > 0) {
    for (const sel of image_selections) {
      const key = sel.key;
      const roleObj = IMAGE_ROLES[key.replace(/_\d+$/, '')];
      if (key === 'sku' && Array.isArray(skus) && skus.length) {
        // SKU 按 skus 行展开
        skus.forEach((variant, i) => {
          expandedImages.push({ key: `sku_${i+1}`, baseKey: 'sku', label: `SKU ${i+1}`, variant, ratio: '1:1' });
        });
        continue;
      }
      const count = sel.count || 1;
      for (let i = 0; i < count; i++) {
        const roleKey = count > 1 ? `${key}_${i+1}` : key;
        expandedImages.push({
          key: roleKey, baseKey: key, label: roleKey,
          sliceNote: sel.sliceNote, ratio: roleObj?.ratio || '1:1',
        });
      }
    }
  } else {
    // 默认套
    const def = [
      { key:'white_bg', count:1 }, { key:'main_text', count:5 }, { key:'main_3x4', count:5 }, { key:'transparent', count:1 },
    ];
    if (Array.isArray(skus) && skus.length) def.push({ key:'sku', count:skus.length });
    const dp = detail_plan || {};
    if (dp.sizeAnnot)  def.push({ key:'detail_slice_size', count:1, sliceNote: dp.notes?.sizeAnnot });
    if (dp.scene)      def.push({ key:'detail_slice_scene', count:1, sliceNote: dp.notes?.scene });
    if (dp.qc)         def.push({ key:'detail_slice_qc', count:1, sliceNote: dp.notes?.qc });
    if (dp.compare)    def.push({ key:'detail_slice_compare', count:1, sliceNote: dp.notes?.compare });
    if (dp.feature)    def.push({ key:'detail_slice_feature', count:1, sliceNote: dp.notes?.feature });
    if (maintenance)   def.push({ key:'detail_slice_care', count:1, sliceNote: maintenance });
    for (const sel of def) {
      if (sel.key === 'sku' && Array.isArray(skus) && skus.length) {
        skus.forEach((variant, i) => expandedImages.push({ key:`sku_${i+1}`, baseKey:'sku', label:`SKU ${i+1}`, variant, ratio:'1:1' }));
        continue;
      }
      for (let i = 0; i < sel.count; i++) {
        const roleKey = sel.count > 1 ? `${sel.key}_${i+1}` : sel.key;
        expandedImages.push({ key: roleKey, baseKey: sel.key, label: roleKey, sliceNote: sel.sliceNote, ratio: IMAGE_ROLES[sel.key]?.ratio || '1:1' });
      }
    }
  }
```

- [ ] **Step 3: 更新路由参数解构（2425）**

把 `app.post('/api/generate-ecommerce', async (req, res) => {` 的解构改为：

```js
  const { product_name, category, image_selections, image_size, platform, selling_points, reference_images, real_shots, skus, detail_plan, maintenance, material, target_audience, restrictions } = req.body || {};
```

（去掉 `tier`、`beauty_report`、`style_pack`、`campaign_lock`、`conversion_driver`，新增 `real_shots`、`skus`、`detail_plan`、`maintenance`）

- [ ] **Step 4: 更新 `genOne` 里 `buildECPrompt` 调用（2537-2547）**

把 `genOne` 函数里的 `buildECPrompt({ ... })` 调用替换为：

```js
        const prompt = buildECPrompt({
          productName: product_name,
          category: category || '其他',
          roleKey: img.baseKey || img.key,
          sellingPoints,
          platform: platform || '淘宝',
          variant: img.variant,
          sliceNote: img.sliceNote,
        }) + contextSuffix;
```

- [ ] **Step 5: 删除 `beauty_report` 分支（2516-2531）**

删除 `if (beauty_report) { ... } else {` 的 `if` 分支与 `} else {`，保留 `else` 内部的并发生成逻辑（去掉外层 if/else 包裹）。即把：

```js
    if (beauty_report) {
      ... (整段美妆生成)
    } else {
      const total = expandedImages.length;
      ... 并发生成 ...
    }
```

改为直接：

```js
    {
      const total = expandedImages.length;
      ... 并发生成 ...
    }
```

（或去掉 `if/else` 直接展开并发块）

- [ ] **Step 6: 更新 `complete` 事件回传（2577-2585）**

把 `send('complete', { ... })` 里的 `image_selections: image_selections || null,` 之后，确保不再引用 `beauty_report`。完整：

```js
    send('complete', {
      product_name,
      category: category || '其他',
      platform: platform || '淘宝',
      image_selections: image_selections || null,
      skus: skus || [],
      detail_plan: detail_plan || null,
      maintenance: maintenance || '',
      images,
      errors,
    });
```

- [ ] **Step 7: 更新日志行（2428）**

把 `console.log(`[ec-gen] 开始生成: ...`)` 改为：

```js
  console.log(`[ec-gen] 开始生成: ${product_name}, selections=${image_selections?.length || 'default'}, skus=${skus?.length||0}, slices=${[detail_plan?.sizeAnnot,detail_plan?.scene,detail_plan?.qc,detail_plan?.compare,detail_plan?.feature].filter(Boolean).length}${maintenance?'+care':''}, platform=${platform||'淘宝'}${image_size?`, size=${image_size.width}x${image_size.height}`:''}`);
```

- [ ] **Step 8: 启动 server 冒烟测试**

Run: `cd f:/da/shubao && node -e "import('./server/index.mjs').then(()=>setTimeout(()=>process.exit(0),2000)).catch(e=>{console.error(e);process.exit(1);})"`
Expected: server 启动无错，2 秒后退出。

- [ ] **Step 9: 提交**

```bash
git add server/index.mjs
git commit -m "refactor(ec-routes): 预览/生成路由适配 SKU/详情切片新入参"
```

---

## Task 6: 重写 `src/pages/EcStudio/index.jsx` 精修工坊页面

**Files:**
- Modify: `src/pages/EcStudio/index.jsx`（整体重写）

**Interfaces:**
- Consumes: `EC_CATS`、`EC_PLATFORM_DIMS`、`EC_IMG_RATIOS`、`EC_MAIN_TYPES`、`EC_DETAIL_SLICES`、`EC_SKU_FIELDS`（Task 1 产出）；`autoRecognizeEcommerce`、`stitchLongImage`、`generateEcommerce`、`generateEcommercePreview`、`regenerateImage`、`proxyImg`、`saveWork`（Task 4 产出）
- Produces: 5 步表单 state（smartBrief/realShots/refShots/product/skus/detailPlan/maintenance）、智能识别回填、生成大纲、生成图片、结果展示、拼长图下载

- [ ] **Step 1: 重写文件顶部 import 与设计 token**

替换 `src/pages/EcStudio/index.jsx:1-42`：

```jsx
/**
 * 薯包AI · 精修工坊 — 重构版
 * 智能一键框 + 5 步精细配置
 */
import React, { useState, useRef } from 'react';
import { Upload, X, Sparkle, Package, Camera, Gear, Download, Wand } from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import { proxyImg, generateEcommerce, generateEcommercePreview, autoRecognizeEcommerce, stitchLongImage, saveWork, regenerateImage } from '../../services/api';
import { EC_CATS, EC_PLATFORM_DIMS, EC_DETAIL_SLICES, EC_SKU_FIELDS } from '../../constants/data';
import { IMAGES } from '../../constants/images';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';

// 平台尺寸 helper
const DIMS = Object.fromEntries(
  Object.entries(EC_PLATFORM_DIMS).map(([p, v]) => [p, { 1: v['1:1'], 3: v['3:4'] }])
);
const dimSize = (p, ratio) => { const r = DIMS[p]?.[ratio === '3:4' ? 3 : 1] || [1440,1440]; return { w: r[0], h: r[1] }; };

const parsePts = (s) => (s || '').split(/[,;，；\n]+/).map(t => t.trim()).filter(Boolean);

const SX = {
  card: { background:'#fff', borderRadius:12, border:'1px solid #E0E0E6', padding:'28px 32px' },
  label: { fontSize:14, fontWeight:600, color:'#2D2D3A', marginBottom:8, display:'block' },
  input: { width:'100%', padding:'11px 14px', border:'1.5px solid #D0D0D8', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box', background:'#fff', transition:'border-color .15s', color:'#2D2D3A' },
  h3: { fontSize:16, fontWeight:600, color:'#2D2D3A', marginBottom:4, display:'flex', alignItems:'center', gap:8 },
  hint: { fontSize:13, color:'#666', lineHeight:1.7 },
  stepNum: { width:26, height:26, borderRadius:'50%', background:'#4338CA', color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
};

const EMPTY_SKU = { color:'', size:'', capacity:'', dimLabel:'' };
const EMPTY_DETAIL_PLAN = { sizeAnnot:true, scene:true, qc:false, compare:false, feature:true, notes:{ sizeAnnot:'', scene:'', qc:'', compare:'', feature:'' } };
```

- [ ] **Step 2: 重写组件 state 与 helper 函数**

替换 `src/pages/EcStudio/index.jsx:44-92`（`export default function EcStudioPage() {` 到 `goRegen` 之前的 `const [plb,setPlb]=useState(null);` 结束 + 各 helper）。完整替换为：

```jsx
export default function EcStudioPage() {
  const { state, dispatch } = useApp();
  const [smartBrief, setSmartBrief] = useState('');
  const [realShots, setRealShots] = useState([]);
  const [refShots, setRefShots] = useState([]);
  const [product, setProduct] = useState({ name:'', category:'', material:'', dimensions:'' });
  const [skus, setSkus] = useState([{ ...EMPTY_SKU }]);
  const [detailPlan, setDetailPlan] = useState({ ...EMPTY_DETAIL_PLAN, notes:{...EMPTY_DETAIL_PLAN.notes} });
  const [maintenance, setMaintenance] = useState('');
  const [platform, setPlatform] = useState('淘宝');

  const [showPlugin, setShowPlugin] = useState(false);
  const [phase, setPhase] = useState('config'); // config | preview | result
  const [ol, setOl] = useState([]);
  const [olLoad, setOlLoad] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [lb, setLb] = useState(null);
  const [stitching, setStitching] = useState(false);
  const [stitchUrl, setStitchUrl] = useState(null);
  const fReal = useRef(null);
  const fRef = useRef(null);

  const setName = (v) => setProduct(p => ({ ...p, name: v }));
  const name = product.name;

  // 上传图片 helper
  const addImg = (files, setter, cur, max) => {
    Array.from(files).slice(0, max - cur.length).forEach(f => {
      const r = new FileReader();
      r.onload = e => setter(p => p.length >= max ? p : [...p, e.target.result]);
      r.readAsDataURL(f);
    });
  };

  // 智能识别：回填 5 步
  const goRecognize = async () => {
    if (!smartBrief.trim() && refShots.length === 0) { setErr('请填写描述或上传参考图'); return; }
    setRecognizing(true); setErr('');
    try {
      const r = await autoRecognizeEcommerce({ smartBrief: smartBrief.trim(), refShots });
      if (r.product) setProduct(p => ({ ...p, ...r.product, name: r.product.name || p.name }));
      if (Array.isArray(r.skus) && r.skus.length) setSkus(r.skus.map(s => ({ ...EMPTY_SKU, ...s })));
      if (r.detailPlan) setDetailPlan({ ...EMPTY_DETAIL_PLAN, ...r.detailPlan, notes:{ ...EMPTY_DETAIL_PLAN.notes, ...(r.detailPlan.notes||{}) } });
      if (r.maintenance) setMaintenance(r.maintenance);
    } catch (e) { setErr('AI 识别失败：' + (e.message || '')); }
    setRecognizing(false);
  };

  // SKU 行增删改
  const addSkuRow = () => setSkus(p => p.length >= 20 ? p : [...p, { ...EMPTY_SKU }]);
  const delSkuRow = (i) => setSkus(p => p.filter((_, j) => j !== i));
  const updSku = (i, field, v) => setSkus(p => p.map((s, j) => j === i ? { ...s, [field]: v } : s));

  // 详情切片勾选 + 备注
  const toggleSlice = (key) => setDetailPlan(p => ({ ...p, [key]: !p[key] }));
  const updSliceNote = (key, v) => setDetailPlan(p => ({ ...p, notes: { ...p.notes, [key]: v } }));

  // 构建默认 selections（提交给后端）
  const buildSelections = () => {
    const sel = [
      { key:'white_bg', count:1 },
      { key:'main_text', count:5 },
      { key:'main_3x4', count:5 },
      { key:'transparent', count:1 },
    ];
    const validSkus = skus.filter(s => s.color || s.size || s.capacity || s.dimLabel);
    if (validSkus.length) sel.push({ key:'sku', count:validSkus.length });
    const sliceMap = { sizeAnnot:'detail_slice_size', scene:'detail_slice_scene', qc:'detail_slice_qc', compare:'detail_slice_compare', feature:'detail_slice_feature' };
    Object.entries(sliceMap).forEach(([planKey, sliceKey]) => {
      if (detailPlan[planKey]) sel.push({ key: sliceKey, count:1, sliceNote: detailPlan.notes[planKey] || '' });
    });
    if (maintenance.trim()) sel.push({ key:'detail_slice_care', count:1, sliceNote: maintenance.trim() });
    return sel;
  };

  const total = buildSelections().reduce((s, i) => s + (i.count || 1), 0);

  // 预览大纲
  const goPreview = async () => {
    if (!name.trim()) return;
    setOlLoad(true); setErr('');
    try {
      const d = await generateEcommercePreview({
        productName: name.trim(), category: product.category, points: (product.material || ''), // 保留兼容
        refCount: refShots.length, hasMaterial: !!product.material,
        imageSelections: buildSelections(), skus, detailPlan, maintenance,
      });
      const o = (d.outline || []).map((i, idx) => ({ ...i, userPrompt: i.outlineText || '', refImageIndex: refShots.length > 0 ? (idx % refShots.length) : -1 }));
      setOl(o); setPhase('preview');
    } catch (e) { setErr('预览失败: ' + (e.message || '')); }
    setOlLoad(false);
  };

  // 生成
  const goGen = async () => {
    if (!name.trim()) return;
    setErr(''); dispatch({ type: 'START_GEN' });
    await new Promise(r => setTimeout(r, 100));
    dispatch({ type: 'SET_STAGE', stage: 1 });
    await new Promise(r => setTimeout(r, 100));
    try {
      const d = await generateEcommerce({
        productName: name, category: product.category, refImgs: refShots, realShots,
        platform, points: product.material || '', skus, detailPlan, maintenance,
        material: product.material, restrictions: '', imageSelections: buildSelections(),
      });
      dispatch({ type: 'SET_STAGE', stage: 2 });
      await new Promise(r => setTimeout(r, 800));
      dispatch({ type: 'SET_STAGE', stage: 3 });
      await new Promise(r => setTimeout(r, 600));
      dispatch({ type: 'CLOSE_RESULT' });
      setPhase('result'); setRes(d); setStitchUrl(null);
      saveWork({ ...d, _ecResult:true, _saveKey:'ec-'+Date.now(), product_name:name, category:product.category, platform, at:new Date().toLocaleDateString('zh-CN'), images:d.images||{} });
    } catch (e) {
      const msg = e.message || '';
      setErr('生成失败: ' + (msg.includes('Image API error') ? '图片API暂时不可用，请稍后重试' : msg.slice(0, 100)));
      setPhase('config'); dispatch({ type: 'CLOSE_RESULT' });
    }
  };

  // 单图重生成
  const [regKey, setRegKey] = useState('');
  const [regEdit, setRegEdit] = useState({ l:null, p:'', v:false });
  const goRegen = async (l, p) => {
    if (regKey) return; setRegKey(l);
    try {
      const url = await regenerateImage(p || '', product.category);
      if (url) setRes(prev => prev ? { ...prev, images: { ...prev.images, [l]: url } } : prev);
    } catch (e) { alert('重生成失败: ' + (e.message || '')); }
    setRegKey(''); setRegEdit({ l:null, p:'', v:false });
  };

  // 拼长图（详情切片）
  const goStitch = async () => {
    const sliceUrls = Object.entries(res?.images || {})
      .filter(([k]) => k.includes('detail_slice'))
      .map(([, u]) => u);
    if (sliceUrls.length < 2) { setErr('至少需要 2 张详情切片才能拼长图'); return; }
    setStitching(true); setErr('');
    try {
      const r = await stitchLongImage(sliceUrls);
      setStitchUrl(r.url);
    } catch (e) { setErr('拼长图失败：' + (e.message || '')); }
    setStitching(false);
  };
```

- [ ] **Step 3: 重写 `return` — Header + 智能一键框 + 5 步表单（config 阶段）**

替换 `src/pages/EcStudio/index.jsx` 的 `return (` 到 `phase==='config'` 块结束（原 94-410）。完整 config 阶段 JSX：

```jsx
  return (
    <div style={{ minHeight:'100vh', background:'#F6F7F9' }}>
      <div style={{ maxWidth:'var(--max-width-narrow)', margin:'0 auto', padding:'32px 24px 80px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => dispatch({type:'NAVIGATE',page:'home'})}>
            <CharImg src={IMAGES.appicon} size={32} float />
            <span style={{ fontSize:18, fontWeight:650, color:'#E53E3E' }}>薯包AI</span>
            <span style={{ fontSize:12, color:'#6366F1', background:'#EEF2FF', padding:'3px 10px', borderRadius:6, fontWeight:500 }}>精修工坊</span>
          </div>
          <button onClick={() => { dispatch({type:'NAVIGATE',page:'home'}); dispatch({type:'SET_MODE',mode:'ecommerce'}); }}
            style={{ fontSize:13, color:'#6366F1', background:'#EEF2FF', border:'1px solid #C7D2FE', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', fontWeight:500 }}>
            <Sparkle weight="fill" size={14}/> 一键出图
          </button>
        </div>

        {err && <div style={{ background:'#FFF5F5', border:'1px solid #FED7D7', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:14, color:'#C53030', lineHeight:1.5 }}>{err}</div>}

        {phase==='config' && <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* ① 插件导入卡片（保留不动） */}
          <div style={SX.card}>
            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              <div style={{ width:52, height:52, borderRadius:12, background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#4338CA' }}><Package weight="fill" size={26}/></div>
              <div style={{ flex:1 }}>
                <h3 style={SX.h3}>🔄 一键复刻爆款商品图</h3>
                <p style={{ ...SX.hint, marginBottom:16 }}>看到别人的商品图好看又卖得好？装插件 → 去爆款商品页点一下 → 自动抓取商品名称、多张商品图、卖点文案。<strong>然后直接用薯包AI生成你自己商品的同款风格图片</strong>。</p>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <button onClick={() => setShowPlugin(true)} style={{ padding:'9px 20px', borderRadius:8, background:'#4338CA', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6, boxShadow:'0 2px 8px rgba(67,56,202,.2)' }}>📥 下载插件</button>
                  <span style={{ fontSize:12, color:'#aaa' }}>470KB · Chrome/Edge · 装一次永久用</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
              {['抓取爆款商品名称','抓取多张商品图','提取卖点与价格','复刻同款视觉风格'].map(t => (
                <span key={t} style={{ fontSize:12, color:'#166534', background:'#F0FDF4', padding:'4px 10px', borderRadius:6, fontWeight:500 }}>✅ {t}</span>
              ))}
            </div>
          </div>

          {/* 插件 Modal（保留不动，复用原 showPlugin） */}
          {showPlugin && (
            <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={() => setShowPlugin(false)}>
              <div style={{ background:'#fff', borderRadius:16, maxWidth:460, width:'100%', padding:24 }} onClick={e => e.stopPropagation()}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <img src={IMAGES.appicon} alt="" style={{ width:36, height:36, borderRadius:8 }} />
                    <div>
                      <div style={{ fontSize:16, fontWeight:600, color:'#1a1a2e' }}>安装薯包AI提取插件</div>
                      <div style={{ fontSize:11, color:'#999' }}>470KB · Chrome / Edge 浏览器</div>
                    </div>
                  </div>
                  <div onClick={() => setShowPlugin(false)} style={{ width:26, height:26, borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#888', fontSize:14, lineHeight:1, flexShrink:0 }}>✕</div>
                </div>
                <a href="/extensions/shubao-extractor.zip" download style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'#F5F3FF', borderRadius:10, textDecoration:'none', marginBottom:18 }}>
                  <div style={{ width:40, height:40, borderRadius:8, background:'#4338CA', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18 }}>⬇</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#333' }}>下载插件 ZIP 包</div>
                    <div style={{ fontSize:11, color:'#888', marginTop:1 }}>470KB · 解压后加载到浏览器即可使用</div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color:'#4338CA', background:'#fff', padding:'6px 14px', borderRadius:6, border:'1px solid #C7D2FE' }}>下载</span>
                </a>
                <div style={{ fontSize:13, fontWeight:600, color:'#333', marginBottom:10 }}>安装步骤</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {['下载 ZIP 包并解压到电脑上的任意文件夹','地址栏输入 chrome://extensions 或 edge://extensions','开启右上角「开发者模式」','点击「加载已解压的扩展程序」→ 选中解压好的文件夹','打开任意商品页 → 点浏览器右上角的薯包图标 → 自动提取商品信息，一键发送到精修工坊 🎉'].map((t, i) => (
                    <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 12px', background: i===4 ? 'linear-gradient(135deg,#F5F3FF,#EDE9FE)' : '#FAFBFC', borderRadius:8, border:`1px solid ${i===4?'#C7D2FE':'#EEEFF2'}` }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', background: i===4?'#7C3AED':'#4338CA', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</div>
                      <div style={{ fontSize:12, color:'#555', lineHeight:1.6 }}>{t}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowPlugin(false)} style={{ width:'100%', padding:'12px 0', border:'none', borderRadius:8, background:'#4338CA', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:16 }}>安装好了，开始使用</button>
              </div>
            </div>
          )}

          {/* 智能一键框 */}
          <div style={{ ...SX.card, background:'linear-gradient(135deg,#EEF2FF,#F5F3FF)', borderColor:'#C7D2FE' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <Wand weight="fill" size={20} style={{ color:'#4338CA' }}/>
              <h3 style={{ ...SX.h3, marginBottom:0 }}>📝 智能一键</h3>
              <span style={{ fontSize:12, color:'#6366F1', fontWeight:400 }}>用一段话描述想要的商品图，AI 自动填下方 5 步</span>
            </div>
            <textarea value={smartBrief} onChange={e => setSmartBrief(e.target.value)} placeholder="例：我要卖一款月岩白的无线蓝牙耳机，材质亲肤硅胶，有3个颜色，主打降噪和长续航，需要尺寸标注和场景图，保养就是避免进水…" rows={3}
              style={{ ...SX.input, minHeight:80, resize:'vertical', fontSize:14, lineHeight:1.6 }} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#D0D0D8'}/>
            <div style={{ display:'flex', gap:10, marginTop:12, flexWrap:'wrap' }}>
              <button onClick={goRecognize} disabled={recognizing} style={{ padding:'10px 20px', borderRadius:8, background:'#4338CA', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:recognizing?'not-allowed':'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6, opacity:recognizing?0.6:1 }}>
                <Sparkle weight="fill" size={14}/> {recognizing ? 'AI 识别中...' : '🤖 AI 自动识别'}
              </button>
              <span style={{ fontSize:12, color:'#888', alignSelf:'center' }}>识别后自动填到下方 5 步，可手动改</span>
            </div>
          </div>

          {/* ① 实拍图 */}
          <div style={SX.card}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={SX.stepNum}>1</div>
              <h3 style={{ ...SX.h3, marginBottom:0 }}>上传产品多角度实拍图</h3>
            </div>
            <p style={{ ...SX.hint, marginBottom:16 }}>推荐角度：正面 / 45°侧面 / 细节 / 包装 / 场景。AI 会以这些实拍为准生成，最多 10 张。</p>
            <ImageUploader imgs={realShots} setImgs={setRealShots} max={10} onPick={() => fReal.current?.click()} onDel={(i) => setRealShots(p => p.filter((_, j) => j !== i))} onPreview={setLb}/>
            <input ref={fReal} type="file" accept="image/*" multiple hidden onChange={e => { addImg(e.target.files, setRealShots, realShots, 10); e.target.value=''; }}/>
          </div>

          {/* ② 参考图 */}
          <div style={SX.card}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={SX.stepNum}>2</div>
              <h3 style={{ ...SX.h3, marginBottom:0 }}>上传目标参考图</h3>
              <span style={{ fontSize:12, color:'#bbb' }}>选填 · 最多 5 张</span>
            </div>
            <p style={{ ...SX.hint, marginBottom:16 }}>想模仿的风格 / 竞品爆款图，AI 会学习它的视觉调性。</p>
            <ImageUploader imgs={refShots} setImgs={setRefShots} max={5} onPick={() => fRef.current?.click()} onDel={(i) => setRefShots(p => p.filter((_, j) => j !== i))} onPreview={setLb}/>
            <input ref={fRef} type="file" accept="image/*" multiple hidden onChange={e => { addImg(e.target.files, setRefShots, refShots, 5); e.target.value=''; }}/>
          </div>

          {/* ③ 规格 + SKU */}
          <div style={SX.card}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={SX.stepNum}>3</div>
              <h3 style={{ ...SX.h3, marginBottom:0 }}>产品尺寸颜色规格</h3>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div>
                <label style={SX.label}>商品名称 <span style={{ color:'#E53E3E' }}>*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="高保湿精华液、无线蓝牙耳机…" style={SX.input} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#D0D0D8'}/>
              </div>
              <div>
                <label style={SX.label}>品类</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {EC_CATS.map(c => (
                    <span key={c} onClick={() => setProduct(p => ({ ...p, category:c }))} style={{ padding:'6px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid', background:product.category===c?'#EEF2FF':'#fff', borderColor:product.category===c?'#6366F1':'#DDDDE3', color:product.category===c?'#4338CA':'#888', fontWeight:product.category===c?600:400 }}>{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <label style={SX.label}>尺寸标注（长×宽×高 cm）</label>
                <input value={product.dimensions} onChange={e => setProduct(p => ({ ...p, dimensions:e.target.value }))} placeholder="20×10×5" style={SX.input} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#D0D0D8'}/>
              </div>
              <div>
                <label style={SX.label}>材质 / 工艺</label>
                <input value={product.material} onChange={e => setProduct(p => ({ ...p, material:e.target.value }))} placeholder="亲肤硅胶、304不锈钢…" style={SX.input} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#D0D0D8'}/>
              </div>
            </div>

            {/* SKU 变体表 */}
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <label style={{ ...SX.label, marginBottom:0 }}>SKU 变体配置（每行 = 一张 SKU 规格图）</label>
                <button onClick={addSkuRow} style={{ padding:'5px 12px', borderRadius:6, background:'#EEF2FF', color:'#4338CA', border:'1px solid #C7D2FE', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ 添加变体</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {skus.map((s, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px', background:'#FAFBFC', borderRadius:8, border:'1px solid #EEEEF2' }}>
                    <span style={{ fontSize:12, color:'#888', minWidth:28 }}>#{i+1}</span>
                    {EC_SKU_FIELDS.map(f => (
                      <input key={f.key} value={s[f.key]} onChange={e => updSku(i, f.key, e.target.value)} placeholder={f.placeholder} maxLength={f.maxLen}
                        style={{ flex:1, padding:'7px 10px', border:'1px solid #DDDDE3', borderRadius:6, fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#DDDDE3'}/>
                    ))}
                    {skus.length > 1 && <button onClick={() => delSkuRow(i)} style={{ width:24, height:24, borderRadius:6, background:'#fff', border:'1px solid #DDDDE3', color:'#FF4757', cursor:'pointer', fontSize:14, flexShrink:0 }}>×</button>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:6 }}>颜色名 ≤4 字，AI 严格按你填的生成，不自创。</div>
            </div>
          </div>

          {/* ④ 详情策划 */}
          <div style={SX.card}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={SX.stepNum}>4</div>
              <h3 style={{ ...SX.h3, marginBottom:0 }}>详情页策划思路</h3>
              <span style={{ fontSize:12, color:'#bbb' }}>勾选 = 生成一张详情切片（1440 宽）</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {EC_DETAIL_SLICES.filter(s => s.key !== 'detail_slice_care').map(s => {
                const planKey = { detail_slice_size:'sizeAnnot', detail_slice_scene:'scene', detail_slice_qc:'qc', detail_slice_compare:'compare', detail_slice_feature:'feature' }[s.key];
                const checked = detailPlan[planKey];
                return (
                  <div key={s.key} style={{ padding:'10px 12px', borderRadius:8, border:`1px solid ${checked?'#C7D2FE':'#EEEEF2'}`, background:checked?'#F5F3FF':'#FAFBFC' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="checkbox" checked={!!checked} onChange={() => toggleSlice(planKey)} style={{ width:16, height:16, cursor:'pointer' }}/>
                      <span style={{ fontSize:14, fontWeight:600, color:checked?'#4338CA':'#555' }}>{s.emoji} {s.label}</span>
                      <span style={{ fontSize:12, color:'#888' }}>{s.desc}</span>
                    </div>
                    {checked && <input value={detailPlan.notes[planKey] || ''} onChange={e => updSliceNote(planKey, e.target.value)} placeholder="补一句自定义文案（选填）"
                      style={{ width:'100%', marginTop:8, padding:'7px 10px', border:'1px solid #DDDDE3', borderRadius:6, fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#DDDDE3'}/>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ⑤ 保养维护 */}
          <div style={SX.card}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={SX.stepNum}>5</div>
              <h3 style={{ ...SX.h3, marginBottom:0 }}>保养维护描述</h3>
            </div>
            <p style={{ ...SX.hint, marginBottom:12 }}>用一句话写保养方式，AI 生成 1 张保养说明切片。</p>
            <textarea value={maintenance} onChange={e => setMaintenance(e.target.value)} placeholder="避免暴晒、温水手洗、存放干燥处…" rows={2}
              style={{ ...SX.input, minHeight:56, resize:'vertical', fontSize:13 }} onFocus={e => e.target.style.borderColor='#6366F1'} onBlur={e => e.target.style.borderColor='#D0D0D8'}/>
          </div>

          {/* 平台选择 + 生成 */}
          <div style={SX.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h3 style={{ ...SX.h3, marginBottom:0 }}><Gear weight="fill" size={18} style={{ color:'#666' }}/> 目标平台</h3>
              <span style={{ fontSize:14, color:'#999' }}>共 {total} 张</span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊'].map(p => {
                const d = dimSize(p, '1:1');
                return (
                  <span key={p} onClick={() => setPlatform(p)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid', background:platform===p?'#EEF2FF':'#fff', borderColor:platform===p?'#6366F1':'#DDDDE3', color:platform===p?'#4338CA':'#888', fontWeight:platform===p?600:400 }}>{p} · {d.w}×{d.h}</span>
                );
              })}
            </div>
            <button onClick={goPreview} disabled={!name.trim() || olLoad} style={{ width:'100%', padding:'16px 0', border:'none', borderRadius:12, fontSize:16, fontWeight:700, fontFamily:'inherit', cursor:(!name.trim()||olLoad)?'not-allowed':'pointer', background:(!name.trim()||olLoad)?'#E0E0E0':'#4338CA', color:'#fff', boxShadow:(!name.trim()||olLoad)?'none':'0 4px 16px rgba(67,56,202,.3)' }}>
              {olLoad ? '生成大纲中...' : `预览并生成（${total} 张）`}
            </button>
          </div>
        </div>}
```

- [ ] **Step 4: 重写 preview 与 result 阶段**

在 Step 3 的 config 阶段 JSX 之后（原 `{/* ═══════ PREVIEW ═══════ */}` 处），用以下替换 preview + result 块：

```jsx
        {/* PREVIEW */}
        {phase==='preview' && <div style={SX.card}>
          <h3 style={{ ...SX.h3, marginBottom:4 }}>📋 生成大纲 — 共 {ol.length} 张图</h3>
          <p style={{ ...SX.hint, marginBottom:20 }}>每张图可自定义生成逻辑，确认后开始生成</p>
          {refShots.length > 0 && <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:'#999', marginBottom:8 }}>参考图（{refShots.length} 张）</div>
            <div style={{ display:'flex', gap:8 }}>{refShots.map((s, i) => <div key={i} style={{ width:44, height:44, borderRadius:6, overflow:'hidden', border:'1px solid #E8E8EC', cursor:'pointer' }} onClick={() => setLb(s)}><img src={s} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/></div>)}</div>
          </div>}
          {ol.map((item, idx) => (
            <div key={idx} style={{ marginBottom:10, padding:'12px 16px', borderRadius:8, background:'#F8F9FA', border:'1px solid #EEEEF2' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ width:24, height:24, borderRadius:6, background:'#4338CA', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{idx+1}</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{item.emoji || ''} {item.label}</span>
              </div>
              <textarea value={item.userPrompt} onChange={e => { const v = e.target.value; setOl(p => p.map((o, i) => i === idx ? { ...o, userPrompt:v } : o)); }} style={{ width:'100%', padding:'8px 12px', border:'1px solid #DDDDE3', borderRadius:6, fontSize:12, fontFamily:'inherit', outline:'none', resize:'vertical', minHeight:40, boxSizing:'border-box', background:'#fff' }} rows={2}/>
            </div>
          ))}
          <div style={{ display:'flex', gap:12, marginTop:16 }}>
            <button onClick={() => setPhase('config')} style={{ flex:1, padding:'13px 0', borderRadius:8, border:'1.5px solid #DDDDE3', background:'#fff', cursor:'pointer', fontSize:14, fontFamily:'inherit', color:'#666', fontWeight:500 }}>← 返回修改</button>
            <button onClick={goGen} style={{ flex:2, padding:'13px 0', borderRadius:8, border:'none', background:'#059669', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit', boxShadow:'0 2px 8px rgba(5,150,105,.2)' }}>✅ 确认生成 {ol.length} 张</button>
          </div>
        </div>}

        {/* RESULT */}
        {phase==='result' && res && <div style={SX.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div><span style={{ fontSize:16, fontWeight:600, color:'#059669' }}>✅ 生成完成</span><span style={{ fontSize:13, color:'#999', marginLeft:8 }}>{Object.keys(res.images || {}).length} 张图</span></div>
            <button onClick={() => { setPhase('config'); setRes(null); setStitchUrl(null); }} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #DDDDE3', background:'#fff', cursor:'pointer', fontSize:13, fontFamily:'inherit', color:'#888' }}>继续生成</button>
          </div>
          {/* 拼长图按钮 */}
          {Object.keys(res.images || {}).some(k => k.includes('detail_slice')) && (
            <div style={{ background:'#F5F3FF', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:'#4338CA', fontWeight:500 }}>📦 详情切片可拼成长图（微信分享用）</span>
              <button onClick={goStitch} disabled={stitching} style={{ padding:'8px 16px', borderRadius:6, background:'#4338CA', color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:stitching?'not-allowed':'pointer', fontFamily:'inherit', opacity:stitching?0.6:1 }}>{stitching ? '拼接中...' : '🔗 拼成长图'}</button>
              {stitchUrl && <a href={proxyImg(stitchUrl)} download target="_blank" rel="noreferrer" style={{ padding:'8px 16px', borderRadius:6, background:'#059669', color:'#fff', textDecoration:'none', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}><Download weight="fill" size={14}/> 下载长图</a>}
              {stitchUrl && <img src={proxyImg(stitchUrl)} alt="长图预览" style={{ width:'100%', marginTop:8, borderRadius:8, border:'1px solid #EEE' }}/>}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12 }}>
            {Object.entries(res.images || {}).map(([l, u]) => (
              <div key={l} style={{ borderRadius:8, overflow:'hidden', border:'1px solid #EEEEF2' }}>
                <div style={{ cursor:'zoom-in' }} onClick={() => setLb(u)}><img src={proxyImg(u)} alt={l} style={{ width:'100%', display:'block', aspectRatio:'1/1', objectFit:'contain', background:'#f8f8f8' }} loading="lazy"/></div>
                <div style={{ padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #EEEEF2' }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#888' }}>{l}</span>
                  {regEdit.v && regEdit.l === l ? <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setRegEdit({ l:null, p:'', v:false })} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #DDDDE3', background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>取消</button>
                    <button onClick={() => goRegen(l, regEdit.p)} disabled={!!regKey} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'none', background:'#4338CA', color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:regKey?0.5:1 }}>{regKey ? '...' : '重新生成'}</button>
                  </div> : <button onClick={() => { const p = ol.find(o => o.key === l.replace(/_\d+$/, '') || o.label === l)?.userPrompt || ''; setRegEdit({ l, p, v:true }); }} style={{ fontSize:11, color:'#4338CA', cursor:'pointer', padding:'4px 10px', borderRadius:6, background:'#EEF2FF', border:'none', fontFamily:'inherit' }}>重新生成</button>}
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* Lightbox */}
        {lb && <div style={{ position:'fixed', inset:0, zIndex:1001, background:'rgba(0,0,0,.92)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} onClick={() => setLb(null)}>
          <img src={lb.startsWith('data:') ? lb : proxyImg(lb)} style={{ maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain', borderRadius:12 }} alt=""/>
        </div>}

        <div style={{ marginTop:48 }}><Footer/></div>
      </div>
    </div>
  );
}

// ── 图片上传小组件（实拍图/参考图共用） ──
function ImageUploader({ imgs, max, onPick, onDel, onPreview }) {
  return (
    <>
      {imgs.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {imgs.map((s, i) => (
            <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:8, overflow:'hidden', border:'1px solid #E8E8EC', cursor:'pointer' }} onClick={() => onPreview(s)}>
              <img src={s} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              <div onClick={e => { e.stopPropagation(); onDel(i); }} style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', background:'#FF4757', color:'#fff', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'none', fontWeight:700 }}>×</div>
            </div>
          ))}
        </div>
      )}
      <div onClick={onPick} style={{ border:'2px dashed #DDDDE3', borderRadius:10, padding:'24px', textAlign:'center', cursor:'pointer', background:'#FAFBFC', transition:'all .15s', color:'#bbb' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor='#6366F1'; e.currentTarget.style.background='#F5F3FF'; e.currentTarget.style.color='#6366F1'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='#DDDDE3'; e.currentTarget.style.background='#FAFBFC'; e.currentTarget.style.color='#bbb'; }}>
        <Upload weight="fill" size={22} style={{ display:'block', margin:'0 auto 6px', color:'inherit' }}/>
        <div style={{ fontSize:13, fontWeight:500, color:'inherit' }}>点击上传（{imgs.length}/{max}）</div>
      </div>
    </>
  );
}
```

- [ ] **Step 5: 删除旧文件末尾的 `}` 多余闭合（如果有）**

确认重写后文件以 `ImageUploader` 组件的 `}` 结尾，没有多余的 `EcStudioPage` 闭合 `}`。原文件 469-470 行的 `</div>` + `}` 闭合属于旧结构，Step 3-4 已包含完整新闭合，确保无残留。

- [ ] **Step 6: 前端构建冒烟测试**

Run: `cd f:/da/shubao && npx vite build 2>&1 | head -30`
Expected: 构建成功无 JSX 语法错误。若有 import 报错（如 `Wand` 不在 phosphor-icons），把 `Wand` 改为 `Sparkle` 或从 `@phosphor-icons/react` 导入正确图标名。

- [ ] **Step 7: 提交**

```bash
git add src/pages/EcStudio/index.jsx
git commit -m "feat(ec-studio): 重写精修工坊为智能一键+5步表单+拼长图"
```

---

## Task 7: 端到端冒烟测试与收尾

**Files:**
- 无文件变更（纯验证 + 修小 bug）

**Interfaces:**
- Consumes: 所有前序 Task 产出

- [ ] **Step 1: 启动 server**

Run: `cd f:/da/shubao && node server/index.mjs &`
Expected: 控制台打印配置与路由加载，server 监听 3001。

- [ ] **Step 2: 构建前端**

Run: `cd f:/da/shubao && npx vite build`
Expected: `dist/` 生成，无错误。

- [ ] **Step 3: 冒烟测试 `auto-recognize` 路由**

Run: `curl -s -X POST http://localhost:3001/api/ecommerce/auto-recognize -H "Content-Type: application/json" -d '{"smartBrief":"我要卖月岩白蓝牙耳机","refShots":[]}' | head -c 500`
Expected: 返回 JSON，含 `product`/`skus`/`detailPlan`/`maintenance` 字段，无 500 错误。

- [ ] **Step 4: 冒烟测试 `ecommerce-preview` 路由**

Run: `curl -s -X POST http://localhost:3001/api/ecommerce-preview -H "Content-Type: application/json" -d '{"product_name":"测试耳机","category":"数码3C","skus":[{"color":"月岩白"}],"detail_plan":{"sizeAnnot":true,"scene":true,"qc":false,"compare":false,"feature":true,"notes":{}},"maintenance":"避免进水"}' | head -c 800`
Expected: 返回 `outline` 数组，包含 white_bg/main_text×5/main_3x4×5/transparent/sku/3 个切片的条目。

- [ ] **Step 5: 冒烟测试 `stitch-long` 路由（需 2 张图）**

用任意 2 张可访问的图片 URL 测试：
Run: `curl -s -X POST http://localhost:3001/api/ecommerce/stitch-long -H "Content-Type: application/json" -d '{"imageUrls":["https://placehold.co/1440x1000","https://placehold.co/1440x1200"]}' | head -c 300`
Expected: 返回 `{ "url":"/stitched/long-...png", "width":1440, "height":2200, "count":2 }`，`dist/stitched/` 下生成文件。

- [ ] **Step 6: 浏览器手动验证页面**

提示用户在浏览器打开精修工坊页面，验证：
1. 顶部「智能一键」框 + AI 自动识别按钮可见
2. 5 步表单依次展示
3. SKU 变体行可增删改
4. 详情切片可勾选并填备注
5. 平台 chip 显示 1440×1440 尺寸
6. 点预览能看到大纲，点生成能出图
7. 结果页有「拼成长图」按钮（有详情切片时）

- [ ] **Step 7: 修任何冒烟测试暴露的小 bug**

根据 Step 3-6 暴露的 bug 修复（如 `callMiniLLM` 签名不匹配、`sharp` composite 参数错误、图标 import 失败等），每修一处 commit 一次。

- [ ] **Step 8: 最终提交**

```bash
git add -A
git commit -m "test(ec): 端到端冒烟测试通过，修复小bug"
```

---

## Self-Review 记录

完成所有 Task 后回看 spec 逐条核对：
- 平台尺寸 1440（除亚马逊）→ Task 1 Step 1 + Task 2 Step 5 ✅
- 白底图 800×800 / 透明图 800×800 / SKU 800×800 / 详情切片 1440 宽 ≤2880 高 → Task 2 prompt 里写死尺寸约束 ✅
- 图片类型精简 4 类 + SKU + 详情切片 → Task 1 Step 3/6 ✅
- 删风格包默认一套 → Task 1 Step 5 + Task 2 Step 1/7 ✅
- SKU 用户自定义（颜色/规格/容量/标注尺寸）→ Task 1 Step 6 + Task 6 Step 2/3 ✅
- 5 步流程 → Task 6 Step 3 ✅
- 智能一键框 → Task 6 Step 3 ✅
- 2 个新 API → Task 3 + Task 4 ✅
- 删除美妆报告/档次/智能推荐/转化驱动力 → Task 2 Step 1/2/4/10/12 ✅
- 保留插件导入卡片 → Task 6 Step 3（showPlugin Modal 完整保留）✅
