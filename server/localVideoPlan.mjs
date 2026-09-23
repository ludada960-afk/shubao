/* ═══ 本地方案的**渲染清单**构造器（视频高清 / 字幕去除共用）══════════════════════════════════
   用户口径（两轮之前那句最关键的纠正）：「难道你没有什么比如 github 上的一些开源项目可以实现吗，
   **为什么一切都要追究模型呢**，你确定这是最佳的路径吗」
   ⇒ 高清与去字幕都不走上游模型，走本地 ffmpeg：
      · 高清   = `output: { resolution, fps }` → buildFilterChain 里的 scale / fps
      · 去字幕 = `replace: [{ type:'delogo', x, y, w, h }]` → buildFilterChain 里的 delogo（先擦后缩）
   这个模块只做**一件事**：把"用户给的一个视频 + 他选的规格/框选区域"翻译成渲染清单。
   它是纯函数（无 IO、无 ffmpeg 调用），所以可以被门禁逐值断言 —— 派发层只管把清单交给
   `renderVideo()`（server/videoExportRender.mjs），两边不互相知道对方的细节。

   为什么要有这一层（而不是在页面里直接拼 manifest）：
     · 页面只能给"用户填的东西"（分辨率 / 区域），**不许**知道 manifest 的形状；
     · 清单形状一变（例如以后加逐帧增强），改这里一处就够，页面与派发层都不用动。
   ⚠️ 与 docs/design/69 的 `plan` 设计一致：技能＝方案，模型/实现细节不进用户字段。 */
const RESOLUTION_LABELS = Object.freeze({ '480p': '480p', '720p': '720p', '1080p': '1080p', '2k': '1440p', '1440p': '1440p', '4k': '2160p', '2160p': '2160p' });
const MAX_DURATION_SECONDS = 300;

function cleanText(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/* 一个视频源：本地方案是"处理已有素材"，不是"生成新片"，所以必须给源 */
export function assertLocalSource(sourceUrl) {
  const url = cleanText(sourceUrl, 2000);
  if (!url) throw Object.assign(new Error('本地方案需要一个视频源'), { code: 'LOCAL_PLAN_SOURCE_REQUIRED' });
  return url;
}

/* 分辨率：只认白名单里的写法；不认识的**降级为不缩放**（宁可原样交付，也不把片子拉变形） */
export function normalizeOutputResolution(value) {
  const key = cleanText(value, 20).toLowerCase();
  return RESOLUTION_LABELS[key] || '';
}

export function normalizeRegion(region) {
  if (!region || typeof region !== 'object') return null;
  const nums = ['x', 'y', 'w', 'h'].map(key => Number(region[key]));
  if (!nums.every(Number.isFinite)) return null;
  const [x, y, w, h] = nums.map(Math.round);
  if (x < 0 || y < 0 || w < 8 || h < 8) return null;
  return { type: 'delogo', x, y, w, h };
}

/**
 * 构造本地方案的渲染清单。
 * @param {object} input
 * @param {string} input.sourceUrl   要处理的视频（站内资产地址或 https 直链）
 * @param {string} [input.resolution] 目标分辨率（视频高清用；去字幕时留空 = 只在原分辨率上擦除）
 * @param {number} [input.fps]        目标帧率（可选）
 * @param {Array}  [input.regions]    要擦除的区域（字幕去除用；手动框选）
 * @param {number} [input.duration]   时长（秒，仅用于记账与渲染上限）
 * @param {string} [input.label]      交付名（进清单，便于历史里辨认）
 */
export function buildLocalRenderManifest({ sourceUrl, resolution = '', fps = null, regions = [], duration = 0, label = '' } = {}) {
  const source = assertLocalSource(sourceUrl);
  const clips = [{ url: source }];
  const manifest = { timeline: { clips }, label: cleanText(label, 120) };

  const outputResolution = normalizeOutputResolution(resolution);
  const cleanFps = Number(fps);
  if (outputResolution || (Number.isFinite(cleanFps) && cleanFps >= 24 && cleanFps <= 60)) {
    manifest.output = {
      ...(outputResolution ? { resolution: outputResolution } : {}),
      ...(Number.isFinite(cleanFps) && cleanFps >= 24 && cleanFps <= 60 ? { fps: Math.round(cleanFps) } : {}),
    };
  }

  const cleanRegions = (Array.isArray(regions) ? regions : []).map(normalizeRegion).filter(Boolean);
  if (cleanRegions.length) manifest.replace = cleanRegions;

  const seconds = Number(duration);
  if (Number.isFinite(seconds) && seconds > 0) manifest.duration = Math.min(Math.round(seconds), MAX_DURATION_SECONDS);

  /* 什么都没要求（既没分辨率也没区域）⇒ 这不是本地方案该干的活，宁可拒绝 */
  if (!manifest.output && !manifest.replace) {
    throw Object.assign(new Error('本地方案至少需要一个规格（分辨率）或一个擦除区域'), { code: 'LOCAL_PLAN_EMPTY' });
  }
  return manifest;
}

/* 按秒计费的档位要用到：本地方案的计费口径是"按视频时长"，所以时长必须可算 */
export function billableSecondsOf(manifest) {
  const seconds = Number(manifest?.duration);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.round(seconds), MAX_DURATION_SECONDS) : 0;
}
