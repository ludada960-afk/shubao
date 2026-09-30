export const IMAGE_MODELS = Object.freeze([
  Object.freeze({
    id: 'image2', label: 'GPT Image 2', badge: '通用主力',
    description: '适合高频电商套图、白底图与常规商品视觉。',
    shortDescription: '高频套图、白底图与常规商品视觉的主力。',
    brand: 'openai',
  }),
  Object.freeze({
    id: 'nano-banana-2', label: 'Nano Banana 2', badge: '多参考一致性',
    description: '适合多参考图、文字排版、商品一致性与局部修改。',
    shortDescription: '多参考图与商品一致性更稳，精于局部修改。',
    brand: 'gemini',
  }),
  Object.freeze({
    id: 'nano-banana-pro', label: 'Nano Banana Pro', badge: '专业精修',
    description: '适合复杂品牌资产、精细本地化与高要求商业成片。',
    shortDescription: '复杂品牌资产与高要求商业成片的精修担当。',
    brand: 'gemini',
  }),
  /* ── 9-13 新增四族五档（与竞品一致：2.5 放两个变体；全部走同一上游 IP233）── */
  Object.freeze({
    /* 9-13 用户决定：先上线上，他自己跑真实生成验收 → 去掉 pending 直接可选。 */
    id: 'image2-5-sunburst', label: 'GPT Image 2.5 Sunburst', badge: '旗舰',
    description: '最新旗舰图片模型，画质与指令理解更强，复杂编辑更精准。',
    shortDescription: '旗舰画质与指令理解，复杂编辑更精准。',
    brand: 'openai',
  }),
  Object.freeze({
    id: 'image2-5-flare', label: 'GPT Image 2.5 Flare', badge: '极速',
    description: '新一代快速图片模型，兼顾速度与画面细节，适合日常批量出图。',
    shortDescription: '新一代快速出图，兼顾速度与画面细节。',
    brand: 'openai',
  }),
  Object.freeze({
    /* 9-14 用户批注：mdkj 的 1K/2K 与 image2 同价（1000 units），自称「极致性价比/成本最低」
       与积分口径矛盾（4K 才真正更低）。改为讲能力差异：高频铺量通用档，不再自称价格最低。 */
    id: 'mdkj-super', label: 'MDKJ Super', badge: '高频铺量',
    description: '高频铺量通用档，适合大批量白底图与常规商品视觉，稳定出图。',
    shortDescription: '高频铺量通用档，大批量白底与常规商品图。',
    brand: 'openai',
  }),
  Object.freeze({
    id: 'gemini-3-image', label: 'Gemini 3 图像', badge: '文字排版',
    description: 'Google 新一代图片模型，擅长画面内文字、多参考一致性与复杂场景。',
    shortDescription: '画面内文字排版与复杂场景理解。',
    brand: 'gemini',
  }),
  Object.freeze({
    id: 'midjourney', label: 'Midjourney', badge: '风格美学',
    description: '以美学风格见长，适合概念图、情绪板与高质感视觉；最高支持 2K。',
    shortDescription: '美学风格见长，适合概念图与高质感视觉。',
    brand: 'midjourney',
    /* 用户 9-13 决定：上游只有 1K/2K → 直接不给 4K 选项，不做静默回落 */
    resolutions: Object.freeze(['1K', '2K']),
  }),
]);

/* ═══ 批 CY-㊲（2026-09-30）：**同厂商的模型排在一起**（用户批注 图3）══════════════════════
   用户原话：「你现在的生图模型也排序排的不对呀。你为什么没有把同类型的模型给排在一起呢？
   你现在把**不同厂商的模型都打混乱了**呀。你应该跟**视频生成那边的模型面板一样**，
   就是尽可能的把同样的模型给排在一起。然后这个问题**肯定不只是首页这边存在**。
   你像现在各个 skill 的子页面以及**画布里面的模型选择器**里面肯定也存在同样的问题的。
   你都要去解决掉。」

   实测（就是他那张截图里的顺序）：改前 brand 序列是
     openai → gemini → gemini → openai → openai → openai → gemini → midjourney
   ⇒ GPT Image 2 与 GPT Image 2.5 两个变体被 Nano Banana 劈开、MDKJ 又插在中间。

   对齐的视频侧实现：`videoModelRows.js` 的 `buildVideoModelRows` 按 `family` 归拢
   （Seedance 一家、MiniMax 一家、通义万相一家…），用户点名的就是它。

   ⚠️ **只排序，不加"家族标题行"**：批 BR-2 已按用户原话把视频侧那种
      「分类完把名字都当标题再各自做一行」删掉了（「都没必要」）。
      这次是**同样的口径**——把同厂商的**挨在一起**，但不凭空多出一行标题。

   ⚠️ 为什么写在**目录这一层**而不是各个面板里：用户明说这个问题遍布
      首页 / skill 子页 / 画布模型选择器。三个地方各自排一次，早晚会再漂回去；
      而它们**全都读这一个数组** ⇒ 在这里排一次，三处一起对。
   （`test/image-model-family-expansion-0913` 等门禁也正是靠"读声明源"来防漂移的。）

   家族顺序用**首次出现顺序**（stable）而不是写死一张表：
   目录里谁排第一，谁的家族就排第一 —— 加新模型时不必记得同步一张顺序表。 */
export function sortImageModelsByFamily(models = []) {
  const order = new Map();
  for (const model of Array.isArray(models) ? models : []) {
    if (!model) continue;
    const family = model.brand || model.family || 'other';
    if (!order.has(family)) order.set(family, order.size);
  }
  return [...(Array.isArray(models) ? models : [])]
    .filter(Boolean)
    .sort((a, b) => {
      const fa = order.get(a.brand || a.family || 'other') ?? order.size;
      const fb = order.get(b.brand || b.family || 'other') ?? order.size;
      /* 同家族内**保持目录里的原序**（Array#sort 在 V8 是稳定的，
         但显式写出来是为了让"同厂原有顺序不变"这条意图不依赖引擎实现）。 */
      return fa === fb ? 0 : fa - fb;
    });
}

/** 可对用户展示的模型。
 *  9-13：五档新模型已按用户要求直接上线（用户自己在线上跑真实生成验收）。
 *  pending 机制保留：将来要临时下线某档，给它加回 pending 标记即可，前后端都不用改。
 *  批 CY-㊲：这里**按厂商归拢**后再冻结（首页 / skill 子页 / 画布选择器读的都是它）。 */
export const SELECTABLE_IMAGE_MODELS = Object.freeze(
  sortImageModelsByFamily(IMAGE_MODELS.filter(model => model.pending !== true)),
);

const IDS = new Set(['smart', ...IMAGE_MODELS.map(model => model.id)]);

export function normalizeImageModel(value, fallback = 'image2') {
  const normalized = String(value || '').trim().toLowerCase();
  return IDS.has(normalized) ? normalized : fallback;
}

/** 某个模型支持的清晰度列表（缺省 = 全支持）。Midjourney 上游只有 1K/2K。 */
export function imageModelResolutions(value) {
  const model = IMAGE_MODELS.find(entry => entry.id === normalizeImageModel(value));
  return Array.isArray(model?.resolutions) && model.resolutions.length ? [...model.resolutions] : ['1K', '2K', '4K'];
}

export function imageModelLabel(value) {
  const id = normalizeImageModel(value);
  if (id === 'smart') return '智能推荐';
  return IMAGE_MODELS.find(model => model.id === id)?.label || 'GPT Image 2';
}

export function generationBillingSku(imageModel, resolution = '2K') {
  const model = normalizeImageModel(imageModel);
  const size = ['1K', '2K', '4K'].includes(String(resolution).toUpperCase()) ? String(resolution).toLowerCase() : '2k';
  /* 9-13 新增四族五档（Midjourney 无 4K：上游只有 1K/2K，UI 层已不给 4K 选项） */
  if (model === 'image2-5-sunburst') return `ec_image25_sunburst_${size}`;
  if (model === 'image2-5-flare') return `ec_image25_flare_${size}`;
  if (model === 'mdkj-super') return `ec_mdkj_${size}`;
  if (model === 'gemini-3-image') return `ec_gemini3_${size}`;
  if (model === 'midjourney') return `ec_mj_${size === '4k' ? '2k' : size}`;
  if (model === 'nano-banana-2') return `ec_nano_flash_${size}`;
  if (model === 'nano-banana-pro') return `ec_nano_pro_${size}`;
  return size === '4k' ? 'ec_image_4k' : 'ec_image_2k';
}

export function generationUnits(imageModel, resolution = '2K') {
  const sku = generationBillingSku(imageModel, resolution);
  return {
    ec_image_2k: 1000, ec_image_4k: 2000,
    ec_image25_sunburst_1k: 1500, ec_image25_sunburst_2k: 1500, ec_image25_sunburst_4k: 2000,
    ec_image25_flare_1k: 1500, ec_image25_flare_2k: 1500, ec_image25_flare_4k: 2000,
    ec_mdkj_1k: 1000, ec_mdkj_2k: 1000, ec_mdkj_4k: 1500,
    ec_gemini3_1k: 2000, ec_gemini3_2k: 2000, ec_gemini3_4k: 3000,
    ec_mj_1k: 3000, ec_mj_2k: 3500,
    /* 9-14 深度体检发现的口径不一致（P0）：后端 2026-08-26 把 nano 2K 调到 1500 units，
       前端还停在 1000 → 用户看到预估 1 积分、实际扣 1.5 积分。以后端 catalog 为准（单一事实源）。 */
    ec_nano_flash_1k: 1000, ec_nano_flash_2k: 1500, ec_nano_flash_4k: 2000,
    ec_nano_pro_1k: 1000, ec_nano_pro_2k: 1500, ec_nano_pro_4k: 2000,
  }[sku];
}
