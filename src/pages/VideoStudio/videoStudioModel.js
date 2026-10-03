/* 视频创作台的**默认创作方式**（9-18 提炼成常量）。
   9-17 起技能子页面会用 preset 指定 initialMode（skillVideoMode），没有技能上下文时才回到这个默认值。
   提炼成常量是为了让断言能守「默认是什么」，而不是守「某一行怎么写」——
   test/video-studio-contract 之前写的是字面量 useState('smart')，于是支持 initialMode 之后
   那条断言变成守实现细节，一改就红、却没人发现（它不在 precommit 的 BLOCKING 名单里，只在部署时跑）。 */
export const DEFAULT_VIDEO_MODE = 'smart';

export const VIDEO_CREATION_MODES = [
  { id: 'smart', label: '智能成片', hint: '一句话起步，素材可选' },
  { id: 'frame', label: '首尾帧', hint: '用两张图锁定镜头起点和终点' },
  { id: 'remake', label: '爆款重构', hint: '保留参考节奏，替换为你的内容' },
];

/* 合法秒数：产品带 durationOptions（上游按秒档位校验）时只认白名单，
   否则退回 [min,max] 整数区间。界面能选的秒数必须与上游接受的秒数一致。 */
export function videoDurationOptions(product) {
  const options = product?.durationOptions;
  if (Array.isArray(options) && options.length) return [...options];
  const min = Number(product?.durations?.min);
  const max = Number(product?.durations?.max);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return [];
  return [min, max];
}

/* 滑块/输入框的取值范围：声明了白名单就按白名单的等间距步长走（5/10/15 → step 5），
   否则沿用 [min,max] 的 1 秒步长。 */
export function videoDurationRange(product) {
  const declared = Array.isArray(product?.durationOptions) && product.durationOptions.length > 0;
  const options = videoDurationOptions(product);
  if (!options.length) return { min: 4, max: 15, step: 1, declared: false, options: [] };
  const gaps = options.slice(1).map((value, index) => value - options[index]).filter(gap => gap > 0);
  const step = declared && gaps.length ? Math.min(...gaps) : 1;
  return { min: options[0], max: options[options.length - 1], step, declared, options };
}

/* 完整合法档位列表（给下拉/选择器用）：声明了白名单就给白名单，
   否则把 [min,max] 展开成整数秒。 */
export function videoDurationChoices(product) {
  if (Array.isArray(product?.durationOptions) && product.durationOptions.length) return [...product.durationOptions];
  const min = Number(product?.durations?.min);
  const max = Number(product?.durations?.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) return [5];
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

export function snapVideoDuration(product, seconds) {
  const options = videoDurationOptions(product);
  const value = Number(seconds);
  if (!options.length) return Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(value)) return options[0];
  return options.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best), options[0]);
}

export function isVideoDurationSupported(product, seconds) {
  const options = videoDurationOptions(product);
  const value = Number(seconds);
  if (!Number.isInteger(value) || !options.length) return false;
  const declared = Array.isArray(product?.durationOptions) && product.durationOptions.length;
  return declared ? options.includes(value) : value >= options[0] && value <= options[options.length - 1];
}

/* ═══ 2026-10-03 批 DE：左栏「时长」药丸按**产品契约**逐档夹住 ════════════════════════════════════
   为什么要有它：同一个「视频时长」在页面里有两处入口 —— 底栏生成设置面板是**滑块 + 数字框**
   （min/max 直接来自产品契约，物理上点不出越界的秒数），左栏工作台是**声明源写死的药丸**
   （19 页声明 [10,15]、2 页声明 [5,10,15]，而声明源不知道当前型号只认到几秒）。
   药丸那一路原来直接 setDuration(value) 不夹，于是：产品只认 5/10/15 时点「15 秒」
   ⇒ quoteForVideoProduct 抛异常 ⇒ sku 为空 ⇒ 「开始生成」永久变灰且**一句提示都没有**。
   ⇒ 把当前型号给不了的档**做成不可点**并写明原因（批 AM 的老规矩：不做点了没反应的选项）。
      纯函数、只吃 (blocks, product)，页面只调它一次、门禁可逐条断言。 */
export function durationOptionOverrides(blocks, product) {
  const block = (Array.isArray(blocks) ? blocks : []).find(item => item && item.bind === 'duration');
  if (!block || !Array.isArray(block.options) || !block.options.length) return null;
  const allowed = videoDurationChoices(product);
  const result = {};
  for (const option of block.options) {
    if (allowed.includes(Number(option.value))) continue;
    result[`${block.key}:${option.value}`] = { disabled: true, reason: `当前模型只支持 ${allowed.join('/')} 秒` };
  }
  return Object.keys(result).length ? result : null;
}

export function quoteForVideoProduct(product, duration) {
  if (!product || typeof product !== 'object') throw new TypeError('视频产品报价需要产品契约');
  const seconds = Number(duration);
  const min = Number(product.durations?.min);
  const max = Number(product.durations?.max);
  if (!isVideoDurationSupported(product, seconds)) {
    const options = videoDurationOptions(product);
    const declared = Array.isArray(product?.durationOptions) && product.durationOptions.length;
    throw new Error(declared ? `视频产品只支持 ${options.join('/')} 秒` : `视频产品支持 ${min} 到 ${max} 秒`);
  }
  const quote = product.quotes?.[seconds <= 8 ? 'short' : 'long'];
  if (!quote) throw new Error('当前视频产品暂无可用报价');
  return quote;
}

export function resolveVideoApiMode(mode, files = {}) {
  if (mode === 'smart') return files.images?.length || files.videos?.length || files.audios?.length ? 'reference' : 'script';
  return mode;
}

export function hasRequiredVideoInputs(mode, files = {}) {
  if (mode === 'frame') return Boolean(files.first?.length && files.last?.length);
  if (mode === 'remake') return Boolean(files.images?.length && files.videos?.length);
  return true;
}

/* ═══ 本地方案的计费数量与报价（2026-09-25 批 AM；2026-10-04 加平价）══════════════════════
   两条本地方案的计价口径**不一样**（都是用户批准过的价）：
     · 视频高清   0.50 积分/条  —— 数量恒为 1，与时长无关；
     · 视频字幕去除 **1 积分/次**（2026-10-04 从 0.04 积分/秒改来，见下）。
   服务端那份规则在 server/billing/catalog.mjs 的 billableQuantity（唯一事实源：建 hold 用的就是它），
   这里这一份是**报价用**的镜像：数量必须与它逐值相等，否则 quoteService.verify 会 409
   「费用确认不一致」。镜像不许漂移 —— test/video-local-dispatch-0925 用同一批样本
   同时断言两边（含 12.4 秒 → 13 这种边界）。

   ⚠️ 数量规则来自**服务端**（capabilities 里每个本地产品的 billingQuantity / flatMaxSeconds），
      页面不自己判断"哪个产品按秒"、也不自己写死封顶秒数：产品目录改一条，页面不用跟着改。

   ⚠️ 2026-10-04 **平价档**（用户原话：「这里应该固定一个费用呀…都应该是一个固定的费用才对吧」）：
     · 框选擦除（本机 ffmpeg，成本 0）—— 服务端摘掉了 perSecond，`billingQuantity` 变 'clip'，
       数量恒为 1 ⇒ 界面上就是一个固定的「1 积分」，不再随片子长短浮动。
     · 智能擦除（火山，成本随秒数涨）—— 服务端给 `flatUnits` + `flatMaxSeconds`：
       **≤ 封顶**一律平价（一次调用 = 一次上游），超过才落回按秒。
       没有封顶就平价 = 长片子每卖一单亏一单，所以封顶这个数只由目录给，页面只读。 */
export function localBillableQuantity(product, seconds) {
  if (product?.billingQuantity !== 'seconds') return 1;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (Number.isFinite(product?.flatMaxSeconds) && value <= product.flatMaxSeconds) return 1;
  return Math.max(1, Math.ceil(value));
}

/** 这一单要花多少 units（不是积分）。平价档走 `flatUnits`，其余走每单位单价 × 数量。 */
export function localQuoteUnits(product, seconds) {
  const quantity = localBillableQuantity(product, seconds);
  if (!quantity) return 0;
  const tier = Number(seconds) <= 8 ? 'short' : 'long';
  const quote = product?.quotes?.[tier];
  if (!quote) return 0;
  const unit = quantity === 1 && Number.isSafeInteger(quote.flatUnits) && quote.flatUnits > 0
    ? quote.flatUnits
    : quote.units;
  return unit * quantity;
}

/* 本地产品在这一档时长下的报价（sku + units + 积分）：
   quantity = localBillableQuantity(...)，short/long 仍按 ≤8 秒分界（与服务端 videoFeatureSku 同源）。 */
export function localQuoteFor(product, seconds) {
  if (!product || typeof product !== 'object') return null;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  const tier = value <= 8 ? 'short' : 'long';
  const quote = product.quotes?.[tier];
  if (!quote) return null;
  const totalUnits = localQuoteUnits(product, value);
  if (!totalUnits) return null;
  return { ...quote, quantity: localBillableQuantity(product, value), totalUnits };
}

/* 本地产品在这档时长下要花多少积分（按钮上那个数字）：
   按条的档 = 固定值；按秒的档 = 秒数 × 单价 —— 向上取整到整数积分（界面只显示整数积分，
   与既有 estimatedPoints 同一口径：Math.ceil(totalUnits / 1000)）。 */
export function localJobPoints(product, seconds) {
  const quote = localQuoteFor(product, seconds);
  return quote ? Math.ceil(quote.totalUnits / 1000) : 0;
}
