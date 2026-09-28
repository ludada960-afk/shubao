/* ═══ 「做成动图」：静图 → 上游图生视频（最短 5 秒档）→ 本地裁到 2~3 秒 ═══════════════════════
   用户口径（逐字，本文件每一处判据的依据）：
     ① 「**动图选 A 吧**」—— 形态 = 工作台里对**已生成的那张**给一颗「做成动图」：
        静图 → **2~3 秒循环短片**，可下载、**电脑端直接传小红书**。
     ② 「即便是在服务端做，**你也要收费呀**，用户又不知道你没有成本，而且你确定你的方案没有成本吗，
        **你这个不是用到图生视频吗**」—— 所以这一档**真的走一次上游图生视频**（不是本机微动效），
        独立 SKU 收费、价格写在按钮上。
     ③ 「**真实跑还是我自己去做吧**」「你自己把这些功能都做齐全了，然后确保在**没有真实生产环境里面
        跑出来、不消耗我的上游 token** 的前提之下，把一切都做顺利了」——
        ⇒ 本模块把"上游那一次调用"做成**可注入的桩**（produceClip）：门禁与 e2e 用假上游把整条链跑通，
          一次真调用都不发；真跑留给用户本人。
   成本（已核实，与 docs/design/90 §6.5 同一份数）：我们自己的**最短档** = Seedance Fast **5 秒**
     ≈ **¥0.91/条**（server/videoCatalog.mjs 的 seedance_fast；台账 agv-seedance2.0fast 是 verified）。
   ⇒ 做法：**按最短档（5 秒）生成 → 本地用 ffmpeg 裁到 2.5 秒**（本地活，不额外花钱）。
   ⚠️ 与 motionStillRender.mjs（小红书图文页的「让它动」）**不是同一条路**：那一条是纯本机微动效、
     零上游成本、免费；这一条**真的花钱出片**，所以收费（用户 ② 的原话就是把这条点点出来的）。
     两者并存不冲突：那条是"让静图有一点点动"，这条是"真的图生视频再裁"。 */

import { spawn } from 'node:child_process';
import { FEATURE_SKUS, quoteFeature } from './billing/catalog.mjs';
import { STILL_MOTION_PRODUCT_ID, videoFeatureSku } from './videoCatalog.mjs';

/* 产品 id 与时长口径：
   · 上游**最短档是 5 秒**（seedance_fast 的 durationOptions = [5,10,15]，上游按秒档位校验），
     给 2~3 秒它直接拒收 ⇒ 必须按 5 秒买，再在本地裁。
   · 产出 2~3 秒：用户要的是"实况那种一小段"，2.5 秒是实测观感最好的一档（太短像卡帧）。 */
export const LIVE_PHOTO_UPSTREAM_SECONDS = 5;
export const LIVE_PHOTO_CLIP_SECONDS = 2.5;
export const LIVE_PHOTO_MIN_SECONDS = 2;
export const LIVE_PHOTO_MAX_SECONDS = 3;

/* 发给上游的那句话（我们自己的固定文案，**不是用户在输入框里打的字**）：
   这一档的用户输入只有**一张成品图**，动什么由我们来定 —— 与 motionStillRender 的三档微动效
   同一套观感口径（"轻微到几乎看不出位移、但一眼能感到在动"），并且明确要求保持主体与构图，
   否则模型会把画面重新编一遍，裁出来的 2.5 秒就不是用户那张图了。 */
export const LIVE_PHOTO_PROMPT = '让画面里的人、物与光线自然地轻微动起来：镜头极缓慢地靠近主体，'
  + '保持主体、构图、色调与材质与原图一致，不要新增元素，不要改变画面内容。';

function clean(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function stillMotionError(message, { status = 500, code, ...details } = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

/* ═══ 裁切窗口（**纯函数**，门禁直接测它）══════════════════════════════════════════════════════
   给"原片多长 + 想要多长" → 返回**实际要裁的起止**。两条硬约束：
     · 目标时长必须落在 **2~3 秒**（用户口径：「2~3 秒循环短片」）；
     · **绝不超原片**（上游真出短了的时候，宁可给一段短的，也不许 ffmpeg 去补黑帧/报错）。
   取第 0 秒起裁：动图要看的就是"这张图动起来"的头几秒，从头裁最接近用户看到的静图。 */
export function livePhotoTrimWindow({ sourceSeconds, targetSeconds } = {}) {
  const target = Number.isFinite(Number(targetSeconds)) ? Number(targetSeconds) : LIVE_PHOTO_CLIP_SECONDS;
  const clamped = Math.min(LIVE_PHOTO_MAX_SECONDS, Math.max(LIVE_PHOTO_MIN_SECONDS, target));
  const source = Number(sourceSeconds);
  /* 量不出原片时长（ffprobe 不在/容器异常）：不拦，按目标时长裁 —— ffmpeg 自己的 `-t` 本来就会
     在片尾停住，不会造出一段不存在的画面。 */
  if (!Number.isFinite(source) || source <= 0) {
    return { startSeconds: 0, seconds: round1(clamped), endSeconds: round1(clamped), short: false, sourceSeconds: 0 };
  }
  const seconds = round1(Math.min(round1(clamped), round1(source)));
  return {
    startSeconds: 0,
    seconds,
    endSeconds: seconds,
    /* short = 原片比目标还短（上游异常短的两秒片也照样交付，但调用方要能看到这件事） */
    short: seconds < LIVE_PHOTO_MIN_SECONDS - 0.001,
    sourceSeconds: round1(source),
  };
}

/* ═══ 裁切本体（本机 ffmpeg，零上游成本）════════════════════════════════════════════════════════
   参数与 motionStillRender 同口径（**H.264 + yuv420p + faststart**）：这三个是小红书这类平台的
   兼容底线；`-an` 去掉音轨 —— 循环短片不需要声音（上游本来也没出声音），去掉后体积更小、循环不断音。
   `-crf 20` 是"看得过去且体积可控"的档（2.5 秒 720p 约 1 MB 量级，电脑端直接上传毫无压力）。
   ⚠️ 不用 `-c copy`：流拷贝只能按关键帧切，切出来的时长会漂到下一帧关键帧上，
     "2~3 秒"这条判据就变成碰运气；重编码才是确定性的。 */
export async function trimClipToSeconds({
  inputPath,
  outPath,
  seconds,
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg',
} = {}) {
  const input = clean(inputPath, 1000);
  const output = clean(outPath, 1000);
  if (!input || !output) throw stillMotionError('缺少裁切输入或输出', { status: 500, code: 'STILL_MOTION_TRIM_INPUT_REQUIRED' });
  const window = livePhotoTrimWindow({ targetSeconds: seconds });
  const args = [
    '-y',
    ...(window.startSeconds > 0 ? ['-ss', String(window.startSeconds)] : []),
    '-i', input,
    '-t', String(window.seconds),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    output,
  ];
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', chunk => { stderr += String(chunk); if (stderr.length > 8000) stderr = stderr.slice(-4000); });
    child.on('error', error => rejectPromise(Object.assign(error, {
      status: 500,
      code: 'STILL_MOTION_FFMPEG_MISSING',
      message: '本机渲染组件未就绪，该功能暂时不可用',
    })));
    child.on('close', code => {
      if (code === 0) resolvePromise();
      else rejectPromise(stillMotionError('动图裁切失败，请重试（本次未扣积分）', {
        status: 502,
        code: 'STILL_MOTION_TRIM_FAILED',
        providerDetail: stderr.slice(-300),
      }));
    });
  });
  return { ...window, seconds: window.seconds };
}

/* ═══ 价目描述（**只读**，给界面把价格写在按钮上）════════════════════════════════════════════════
   ⚠️ 价格**不在前端写死**（铁律：定价只有一个来源 = 服务端目录，见 test/pricing-single-source）：
      SKU 名由产品 id 派生（videoFeatureSku），面价由 catalog 的 quoteFeature 算，
      积分 = ⌈units / 1000⌉（与视频侧 publicQuote 同一口径）。
   ⇒ 按钮上的数字与真正冻结的金额**同源**：改了 catalog 的价格，按钮上的数字自己跟着变。 */
export function livePhotoDescriptor() {
  const sku = videoFeatureSku({ productId: STILL_MOTION_PRODUCT_ID, duration: LIVE_PHOTO_UPSTREAM_SECONDS });
  const quote = quoteFeature(sku, 1);
  const feature = FEATURE_SKUS[sku];
  if (!feature) throw stillMotionError('动图档位未登记', { status: 500, code: 'STILL_MOTION_SKU_MISSING' });
  return {
    sku,
    productId: STILL_MOTION_PRODUCT_ID,
    units: quote.units,
    totalUnits: quote.totalUnits,
    points: Math.ceil(quote.totalUnits / 1000),
    providerCostCny: Number(feature.providerCostCny),
    upstreamSeconds: LIVE_PHOTO_UPSTREAM_SECONDS,
    clipSeconds: LIVE_PHOTO_CLIP_SECONDS,
    minSeconds: LIVE_PHOTO_MIN_SECONDS,
    maxSeconds: LIVE_PHOTO_MAX_SECONDS,
  };
}

/* ═══ 一次点击 = **一次建单 = 一次收费 = 一次上游调用** ═════════════════════════════════════════
   钱这一层**不在这里重写**：这一档走的是站内既有的**视频任务链路**（videoGeneration.createJob /
   processJob / 队列 / 计费 hold → 交付才结算 / 失败自动退回），所以：
     · 独立收费 —— SKU 由产品 id 派生（video_live_photo_short），与视频档位同一套；
     · 幂等 —— 建单的 idempotencyKey（同一次点击重复触发 = 同一条任务，不再扣一次）；
     · 失败不扣费 —— 任务失败即 releaseItem（既有链路，门禁 test/video-local-dispatch-0925 已钉住）。
   裁切落在**交付那一步**（processJob 拿到上游成片之后、落库之前，见 videoGeneration 的
   persistDeliveredOutput）：裁不出来就当这一单失败 → 退钱，绝不会出现"扣了钱但拿不到 2~3 秒的动图"。
   本文件只放**两件可单独验证的东西**：价目描述（按钮上的数）与裁切（纯函数 + 本机 ffmpeg）。 */
