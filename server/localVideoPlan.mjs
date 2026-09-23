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
import { outputFpsOf } from './videoExportRender.mjs';

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
  /* ⚠️ keepAudio: true —— 本地方案是"处理已有素材"，用户要的是**原片 + 那一处改动**：
     高清之后没有声音、去字幕之后变成默片，都是交付事故（上游生成路线没这个问题：片子是新生成的）。
     渲染层见到这个标记才映射音频（见 videoExportRender.renderVideo 的说明）。 */
  const manifest = { timeline: { clips }, keepAudio: true, label: cleanText(label, 120) };

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

/* ═══ 本地方案的**作业输入**校验（2026-09-25 批 AM，建单前跑）══════════════════════════════════
   与上游那条 validateVideoProductInput **分开**，因为两者的前提完全不同：
     · 上游：提示词 + 比例 + 时长白名单 + 参考素材（用户描述"要什么片子"）；
     · 本地：**一条源视频** + 规格（分辨率 / 帧率）或区域（框选字幕）—— 没有提示词、没有比例。
   把这条塞进上游那条校验里，只会让"本地方案"被迫声明它根本不需要的字段
   （那正是用户骂的"模型/清晰度/时长全做进去"）。
   ⚠️ 时长为什么必填：它是**计费数量**（去字幕按秒）与渲染长度（`-t`）的共同来源。
      缺了它，收费只能猜、渲染只能截断 —— 所以宁可拒单（400），也不默认一个值。
   ⚠️ 一条源视频都不给 = 无事可做：调用方在 references 那一层先拒（LOCAL_PLAN_SOURCE_REQUIRED）。 */
export function validateLocalPlanInput({ product, input = {} } = {}) {
  /* ⚠️ 2026-09-26 批 AR：判据从 `localEngine === true` 放宽到「**处理已有视频**这类产品」
     （`localEngine` 本机执行 / `videoProcess` 交上游执行，例如火山字幕擦除）。
     放宽的是"谁来执行"，**没有**放宽输入契约 —— 这类产品的输入都是"一条源视频 + 时长"，
     都不是提示词/比例/拍摄方案那套。判据换个写法而已，校验一条没少。 */
  const processesExistingVideo = product?.localEngine === true || product?.videoProcess === true;
  if (!processesExistingVideo) {
    throw Object.assign(new Error('本地方案校验只能用于"处理已有视频"的产品'), { code: 'LOCAL_PLAN_PRODUCT_MISMATCH' });
  }
  const spec = product.localSpec || {};
  const rawSeconds = Number(input.duration);
  if (!Number.isInteger(rawSeconds) || rawSeconds < 1 || rawSeconds > MAX_DURATION_SECONDS) {
    throw Object.assign(
      new Error(`本地方案需要一个 1~${MAX_DURATION_SECONDS} 秒的源视频时长（当前：${cleanText(input.duration, 20) || '空'}）`),
      { code: 'LOCAL_PLAN_DURATION_INVALID' },
    );
  }

  /* 分辨率：产品声明了才有这一格；给了不认识的档位一律**拒单**（不静默降级成"原样交付"，
     否则用户选了 1080p 却拿到原分辨率，属于"看着是 A、跑的是 B"）。 */
  const requestedResolution = cleanText(input.resolution, 20).toLowerCase();
  let resolution = '';
  if (spec.resolution === true) {
    resolution = normalizeOutputResolution(requestedResolution);
    const allowed = Array.isArray(product.resolutions) ? product.resolutions : [];
    if (!resolution || (allowed.length && !allowed.includes(resolution))) {
      throw Object.assign(
        new Error(`视频高清需要选择输出分辨率（${allowed.join(' / ') || '720p / 1080p / 2k'}）`),
        { code: 'LOCAL_PLAN_RESOLUTION_INVALID' },
      );
    }
  }

  /* 帧率：产品声明了才认；不认识的档位同样拒单（与分辨率同一条纪律） */
  const fps = spec.fps === true ? outputFpsOf(input.fps) : null;
  if (spec.fps === true && input.fps != null && input.fps !== '' && fps === null) {
    throw Object.assign(new Error('帧率只支持 30 / 60'), { code: 'LOCAL_PLAN_FPS_INVALID' });
  }

  /* 区域：只有声明了才收；非法区域**逐条丢弃**（delogo 编不出参数就不该下滤镜），
     一条都没剩下则拒单 —— "去字幕"没有区域等于什么都没做。
     ⚠️ 例外：`spec.auto === true`（自动标记那一档，交火山检测）**本来就没有区域可框** ——
        它的"要做的事"由上游完成，所以这一格不参与"非空"判定。 */
  let regions = [];
  if (spec.regions === true) {
    regions = (Array.isArray(input.regions) ? input.regions : []).map(normalizeRegion).filter(Boolean).slice(0, 8);
    if (!regions.length) {
      throw Object.assign(new Error('请先在视频上框选要擦除的字幕区域'), { code: 'LOCAL_PLAN_REGION_REQUIRED' });
    }
  }

  /* 至少要有一样"要做的事"：分辨率、区域，或"交给上游自动检测"。
     与 buildLocalRenderManifest 的 LOCAL_PLAN_EMPTY 同一条纪律，区别只是这里在建单前就拦住（不收费）。 */
  if (!resolution && !regions.length && spec.auto !== true) {
    throw Object.assign(new Error('本地方案至少需要一个规格（分辨率）或一个擦除区域'), { code: 'LOCAL_PLAN_EMPTY' });
  }

  return { duration: rawSeconds, resolution, fps, regions };
}
