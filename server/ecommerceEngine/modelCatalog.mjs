/* 上游真实模型名**不在本文件里写死** —— 它由 provider 适配器单点声明（NANO_UPSTREAM_MODELS）。
   本文件只负责「用户选的档位 → 调哪个上游模型」这一层判断。 */
import { NANO_UPSTREAM_MODELS } from './nanoBananaProviderAdapter.mjs';

/* ═══ 2026-09-19 批 O-⑦：新增 **2:3 / 3:2** 两个比例 ═══════════════════════════════════════
   依据（用户第 19 轮）：「我希望你这个图片生成这边，你也要**全部去把这些子页面 1:1 的去把它们抄过来**。」
   知渔图片侧每个 app 的 ratio 字段（inputConfigs 逐字，见 docs/design/data/quantv-image-key-specs.json）是 **7 档**：
     1:1方图 | 2:3竖版长图 | 3:2横版摄影 | 3:4竖版海报 | 4:3横版主图 | 9:16手机竖屏 | 16:9手机横屏
   我们原来只有 6 个（缺 2:3 / 3:2）—— 而"界面能给的恰好就是这张表的键，一个不多一个不少"
   （src/services/imageSizeCatalog.js 第 9 行），所以必须**先在这张权威表里加**，
   否则界面加了、引擎不认，服务端会把用户选的比例**静默回落成 1:1**（resolveGenerationSize 最后一行）。

   ⚠️ 尺寸不是猜的，是按本文件自己的校验器算的（multiply-of-16 / MAX_EDGE 3840 / MAX_PIXELS 8,294,400）：
     1K  2:3 = 672x1008  (÷16 = 42/63)     3:2 = 1008x672
     2K  2:3 = 1344x2016 (÷16 = 84/126)    3:2 = 2016x1344
     4K  2:3 = 2304x3456 (÷16 = 144/216)   3:2 = 3456x2304   像素 7,962,624 ≤ 8,294,400 ✓
     ⚠️ 4K **不能**写 2560x3840：长边虽等于 3840，但像素 9,830,400 **超过上限**，会被 validateGenerationSize 拦下。
   ⚠️ 计费不需要额外改：ecommerceBilling.mjs 的 SIZE_TO_RESOLUTION 就是**遍历本表**建出来的
      （不再维护第二份清单），加了自动覆盖。 */
/* ═══ 2026-09-19 批 P：新增 **4:5 / 5:4**（知渔「批量出图电商图」的比例是 10 档）══════════
   用户第 20 轮原话：「工作台该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位」。
   知渔那一页的比例逐字：1:1 方图 / 2:3 竖版长图 / 3:2 横版摄影 / 3:4 竖版海报 / 4:3 横版主图 /
   **4:5 小红书封面** / **5:4 产品主图** / 9:16 手机竖屏 / 16:9 手机横屏 / 21:9 超横屏 —— 比常规 7 档多这三档。
   界面多给一档而引擎不认 = 用户选了被**静默回落成 1:1**（本仓铁律不许），所以尺寸表先补齐；
   前端镜像 / skillRun 白名单 / 尺寸门禁三处同改。计费不用动：ecommerceBilling 的 SIZE_TO_RESOLUTION
   就是遍历本表建的。
   尺寸按 validateGenerationSize 的约束算（16 的倍数 / 长边 ≤3840 / 像素 ≤8,294,400），不是估的：
     4:5 要求两边都是 16 的倍数且比值精确 ⇒ (64k, 80k)
       1K k=12 → 768x960 ；2K k=24 → 1536x1920 ；4K k=40 → 2560x3200（像素 8,192,000 ≤ 上限 ✓）
     5:4 就是它横过来。 */
/* ═══ 批 X（2026-09-21）：补 9:21 / 2:1 / 1:2 三档（用户：「你不能像图四这样，搞多一点尺寸规格吗」）══
   依据：知渔的图片侧画面尺寸有 14 档，我们只有 10 —— 缺的正是这三档；
   它们原先**只出现在知渔「图片复刻」那一页**（批 R §8.2 的记录），用户本轮明确要补上。
   尺寸按本仓校验器算（16 的倍数 / 长边 ≤3840 / 像素 ≤8,294,400），不是估的：
     9:21 = 3:7 ⇒ 两边都是 16 的倍数时形如 (48k, 112k)：
       1K k=12 → 576x1344 ；2K k=24 → 1152x2688 ；4K k=32 → 1536x3584
       （长边 3584 ≤3840 ✓ 像素 5,505,024 ≤ 上限 ✓）
     2:1 ⇒ (32m, 16m)：1K 1024x512 ；2K 2048x1024 ；4K 3840x1920（像素 7,372,800 ≤ 上限 ✓）
     1:2 就是它竖过来。
   ⚠️ 四处（引擎 / 前端镜像 / skillRun.LEGAL_RATIOS / 尺寸门禁）必须**同时改**，
      少一处就是"界面能选、服务端静默回落成 1:1"（本项目踩过的坑）。
   ⚠️ 2026-10-03 **付费实测已完成**（gemini-3.1-flash-image / api.forkc2p.com，各 1 张 ≈¥0.06/张）：
      上游**只认它自己的一小组枚举比例**，而且落到**它自己的像素池**（128 的倍数），
      不接受我们这张表里的任意值。实测请求 → 实际返回：
        1:1    → 1024x1024  (1.000)  ✅ 精确
        3:4    →  896x1200  (0.747)  近似
        9:16   →  768x1376  (0.558)  近似
        16:9   → 1376x768   (1.792)  近似
        5:4    → 1200x896   (1.339)  ❌ **它不认识 5:4，直接给了最近的 4:3（偏差 7%）**
        1.2414 → 1024x1024  (1.000)  ❌ 非枚举值被**静默丢成 1:1**，不报错
      ⇒ 两条推论：① **「自适应 = 沿用原图真实比例」在 nano 通道上做不到**（上游会无视）；
        ② 本表里 5:4 / 4:5 / 2:3 / 3:2 / 21:9 / 9:21 / 2:1 / 1:2 这几档在 nano 上
        **很可能同样不被采纳**（5:4 已实测被换掉），需要逐档复测才能下结论。
      ⚠️ 这份实测只覆盖 **nano**。image2（65535 / task-api-1-cn.65535.space）走的是
        **像素 size 字段**而非比例字段，是另一条上游、**尚未实测**，结论不可外推。 */
export const LEGAL_IMAGE_SIZES = Object.freeze({
  '1K': { '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768', '9:16': '576x1024', '16:9': '1024x576', '21:9': '1008x432', '2:3': '672x1008', '3:2': '1008x672', '4:5': '768x960', '5:4': '960x768', '9:21': '576x1344', '2:1': '1024x512', '1:2': '512x1024' },
  '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048', '16:9': '2048x1152', '21:9': '2048x864', '2:3': '1344x2016', '3:2': '2016x1344', '4:5': '1536x1920', '5:4': '1920x1536', '9:21': '1152x2688', '2:1': '2048x1024', '1:2': '1024x2048' },
  '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840', '16:9': '3840x2160', '21:9': '3584x1536', '2:3': '2304x3456', '3:2': '3456x2304', '4:5': '2560x3200', '5:4': '3200x2560', '9:21': '1536x3584', '2:1': '3840x1920', '1:2': '1920x3840' },
});

const RESOLUTIONS = new Set(Object.keys(LEGAL_IMAGE_SIZES));
/* 「自适应」这一档的**面板字面量**。它必须由前端翻成具体比例再发过来；发到服务端
   意味着前端漏了解析（2026-10-03 修的那 5 处），属于调用方的 bug，要让它响。 */
const ADAPTIVE_RATIO_MARKER = '自适应';
/* 「看得出来的比例」：3:4 / 16x9 / 16：9。只有这类值才值得硬失败 ——
   纯乱码与原型属性名走旧口径回落 1:1（理由见 resolveGenerationSize 里的注释）。 */
const RATIO_SHAPED = /^\d{1,4}\s*[:：x×]\s*\d{1,4}$/i;
export const IMAGE_MODEL_IDS = Object.freeze({
  SMART: 'smart',
  IMAGE2: 'image2',
  NANO_BANANA_2: 'nano-banana-2',
  NANO_BANANA_PRO: 'nano-banana-pro',
  /* 9-13 新增四族五档（前端目录已有，pending=true 暂不进选择器）。
     后端先把接线做齐：route.model = 族 id，真实上游模型名由 provider 适配器的
     「族:分辨率」modelMap 决定 —— 这样上架/下架只改前端 pending，不动路由。 */
  IMAGE2_5_SUNBURST: 'image2-5-sunburst',
  IMAGE2_5_FLARE: 'image2-5-flare',
  MDKJ_SUPER: 'mdkj-super',
  GEMINI_3_IMAGE: 'gemini-3-image',
  MIDJOURNEY: 'midjourney',
});
const IMAGE_MODELS = new Set(Object.values(IMAGE_MODEL_IDS));
/* 走「新族」通道的模型：同一上游（同步 OpenAI 图片接口）按模型名区分，计费口径见 server/billing/catalog.mjs */
const ADVANCED_IMAGE_MODELS = new Set([
  IMAGE_MODEL_IDS.IMAGE2_5_SUNBURST,
  IMAGE_MODEL_IDS.IMAGE2_5_FLARE,
  IMAGE_MODEL_IDS.MDKJ_SUPER,
  IMAGE_MODEL_IDS.GEMINI_3_IMAGE,
  IMAGE_MODEL_IDS.MIDJOURNEY,
]);

export function isAdvancedImageModel(value) {
  return ADVANCED_IMAGE_MODELS.has(normalizeImageModel(value));
}
const MAX_EDGE = 3840;
const MAX_PIXELS = 8_294_400;

function parseDimensions(size) {
  if (typeof size === 'string') {
    const match = /^\s*(\d+)x(\d+)\s*$/.exec(size);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  }

  if (size && typeof size === 'object' && !Array.isArray(size)) {
    return { width: size.width, height: size.height };
  }

  throw new TypeError('Generation size must be expressed as WIDTHxHEIGHT');
}

export function validateGenerationSize(size) {
  const { width, height } = parseDimensions(size);
  const validInteger = Number.isInteger(width) && Number.isInteger(height);

  if (!validInteger || width <= 0 || height <= 0) {
    throw new RangeError('Generation dimensions must be positive integers');
  }
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new RangeError('Generation dimensions must be multiples of 16');
  }
  if (width > MAX_EDGE || height > MAX_EDGE) {
    throw new RangeError('Generation dimensions exceed the maximum edge');
  }
  if (width * height > MAX_PIXELS) {
    throw new RangeError('Generation dimensions exceed the maximum pixel count');
  }
  if (Math.max(width, height) / Math.min(width, height) > 3) {
    throw new RangeError('Generation dimensions exceed the maximum aspect ratio');
  }

  return true;
}

function campaignBibleIsConfirmed(input) {
  return input.campaignConfirmed === true
    || input.campaignBibleConfirmed === true
    || input.campaignBible?.confirmed === true;
}

function hasExplicitFourKRequirement(input) {
  return input.resolution === '4K'
    || input.explicit4K === true
    || input.requires4K === true
    || input.fourKRequired === true;
}

export function normalizeImageModel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return IMAGE_MODELS.has(normalized) ? normalized : IMAGE_MODEL_IDS.SMART;
}

export function selectGenerationModel(input = {}) {
  const imageModel = normalizeImageModel(input.imageModel);
  /* ⚠️ 曾在此处写死 'gemini-2.5-flash-image'，供应商下架后就成了「目录说调 A、适配器只认 B」
     （用户看到「模型当前不可用」）。现改为引用适配器的单点声明，两者不可能再分叉。 */
  if (imageModel === IMAGE_MODEL_IDS.NANO_BANANA_2) return NANO_UPSTREAM_MODELS.flash;
  if (imageModel === IMAGE_MODEL_IDS.NANO_BANANA_PRO) return NANO_UPSTREAM_MODELS.pro;
  /* 新族：route.model 用族 id 本身（上游真实模型名在适配器的 modelMap 里按分辨率决定） */
  if (ADVANCED_IMAGE_MODELS.has(imageModel)) return imageModel;
  const assetCount = input.assetCount;
  const eligibleBatch = Number.isInteger(assetCount)
    && assetCount >= 2
    && assetCount <= 4
    && input.batchEligible !== false
    && campaignBibleIsConfirmed(input)
    && input.sameStyle === true
    && input.highRiskFacts === false
    && !hasExplicitFourKRequirement(input);

  return eligibleBatch ? 'gpt-image-2-n' : 'gpt-image-2';
}

export function resolveGenerationSize(input = {}) {
  let resolution = RESOLUTIONS.has(input.resolution) ? input.resolution : '2K';
  /* Midjourney 上游只有 1K/2K（前端也只在 1K/2K 里给选择）——这里兜底降到 2K，
     不做「静默换成别的模型」那种替换：宁可少一档清晰度，也不偷偷给别的结果。 */
  if (normalizeImageModel(input.imageModel) === IMAGE_MODEL_IDS.MIDJOURNEY && resolution === '4K') resolution = '2K';
  const requestedRatio = input.ratio ?? input.aspectRatio;
  /* ═══ 2026-10-04「自适应 = 不指定比例」═══
     实测（本项目自己花钱跑的，见 docs/design/94 自适应方案）：
       · image2 不传 size  → 一律 2048x2048 方图（两个完全不同的内容都是）
       · nano  不传 aspect → 1376x768 横图（瓶子摆窗台，横构图合理）
     即竞品那条「固定总像素量级 + 模型智能分配宽高」：留空才是"让它自己定"，
     而我们过去把「自适应」翻译成了一个具体档位 —— 那正是用户抱怨"尺寸被篡改"的来源。
     ⇒ 空值 / 「自适应」= 不指定，标记 autoRatio，由请求构造层**真的不传** size。
     ⚠️ 这里仍然返回 1:1 那套值，是为了让计费、布局、promptCompiler 的既有校验
       （compileModelRoute 断言 route.size === generationSize）一行都不用改；
       真正生效的地方是 providerAdapter / nano 适配器读 route.autoRatio。 */
  const autoRatio = !requestedRatio || String(requestedRatio).trim() === ADAPTIVE_RATIO_MARKER;
  if (requestedRatio && !Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio)) {
    const resolutionOrder = Object.keys(LEGAL_IMAGE_SIZES);
    const requestedIndex = resolutionOrder.indexOf(resolution);
    const promoted = resolutionOrder.slice(Math.max(0, requestedIndex + 1)).find(candidate => Object.hasOwn(LEGAL_IMAGE_SIZES[candidate], requestedRatio));
    if (promoted) resolution = promoted;
  }
  /* ⚠️ 2026-10-03：这一行原来是**静默回落成 1:1**。
     线上后果实测得到过：画布上有 5 类调用点（工作流节点、inpaint/transform、
     节点重生成、文本驱动出图、电商套图）没把面板上的「自适应」翻成协议比例就发过来，
     字符串 '自适应' 不在尺寸表里 → 用户选了自适应、拿到的是 1:1，
     **界面上不报错也不提示**（这正是用户抱怨的"明明选了却被套到 1:1 上"）。
     ⇒ 现在对**确实认不出的**比例直接抛错。宁可让调用方看见失败，
     也不要"给它一张别的图还装作成功"—— 计费、交付、界面显示会三方不一致。
     ⚠️ 只在**看得���调用方想要一个比例**时才硬失败（ratio 形状，或就是「自适应」本身）。
       纯乱码 / 原型属性名（'toString' 这种，见 test/ecommerce-model-routing.test.mjs
       「defaults inherited ratio keys to the legal square ratio」——它防的是
       `LEGAL_IMAGE_SIZES[res][ratio]` 捞到 Object.prototype 上的方法）仍按旧口径回落 1:1：
       那类值不存在"用户意图被辜负"，硬失败只会把一条防御性测试逼成事故。
     ⚠️ 上面「换个分辨率档也许合法」的尝试仍保留：那是**合法比例**在当前档缺失，
       与「非法比例」是两回事，不该一起拒。空值也仍然走默认档。
     ⚠️ 2026-10-04 改判：autoRatio（空值或「自适应」）**不再走这条抛错** ——
       「自适应」现在��确表示"不指定比例"，不是"一个认不出的比例"。
       把它继续当非法比例拒掉，等于自适应档一用就 400。 */
  if (!autoRatio && requestedRatio && !Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio)) {
    const raw = String(requestedRatio).trim();
    if (RATIO_SHAPED.test(raw)) {
      const invalid = new Error(`INVALID_IMAGE_RATIO: ${requestedRatio}`);
      /* 挂上 status/code，好让 canvasGenerationService 的 catch 原样透传成 400 ——
         那里只认 `Number.isInteger(error.status)`，不带就是 500。 */
      invalid.status = 400;
      invalid.code = 'INVALID_IMAGE_RATIO';
      invalid.retryable = false;
      throw invalid;
    }
  }
  const ratio = Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio) ? requestedRatio : '1:1';
  const size = LEGAL_IMAGE_SIZES[resolution][ratio];

  validateGenerationSize(size);

  return { resolution, ratio, size, autoRatio };
}

export function buildModelRoute(input = {}) {
  const imageModel = normalizeImageModel(input.imageModel);
  const { resolution, ratio, size, autoRatio } = resolveGenerationSize(input);
  const provider = ADVANCED_IMAGE_MODELS.has(imageModel)
    ? 'advanced-image'
    : imageModel === IMAGE_MODEL_IDS.NANO_BANANA_2 || imageModel === IMAGE_MODEL_IDS.NANO_BANANA_PRO
      ? 'nano-banana'
      : 'image2';

  return {
    imageModel,
    provider,
    model: selectGenerationModel({ ...input, imageModel, resolution }),
    resolution,
    ratio,
    imageSize: resolution,
    size,
    /* 「自适应」= 不指定比例：请求构造层据此**不传** size / aspectRatio，
       让上游按内容自己分配宽高（见 resolveGenerationSize 里 2026-10-04 的实测记录）。 */
    autoRatio,
    async: true,
    mode: 'edit',
  };
}
