/* ═══ 静态图 → 2~3 秒微动效短视频（2026-09-24 批 AX）════════════════════════════════════════════
   用户口径（两轮，第二轮纠正了第一轮的方案）：
     · 「小红书现在也是有 live 的，我不知道他是怎么做 AI 的 live 图的，可能是视频模型做个几秒那种吧」
     · 「实况图这里，**图生视频也是免费吗**？你确定你的方案是对的吗，而且**为什么要传手机呢**，
        你没搞明白吗，就是小红书支持实况图没错，但是人家这个账号是**有些内容会模拟实况图的这种
        方式去做**呀，你传回手机是要干嘛呀，**目的只是发到小红书上成为他的笔记内容**」

   ⇒ 结论（也是这一批的实现依据）：
     1. **图生视频不免费**（站内 I2V 是付费上游，几积分一条）。但"让图会动"这件事**不必**走 I2V ——
        本机 ffmpeg 的微动效（缓慢推近/拉远/横移）**零上游成本**，且站内本机渲染链路已跑通。
     2. **不做真·Live Photo、不传手机**：那条路是"个人用户用 App 发实况"，对一个**账号的内容生产**
        是多余的一步；目标是"发到小红书成为笔记内容" —— 直接出一条**短视频**就能发，
        而"多图轮播 + 轻微动感"正是用户说的"模拟实况图的方式"。
     3. 时长取 **2~3 秒**（与实况的观感一致）、竖版、H.264（兼容性最好）。

   ⚠️ 与 videoExportRender 的关系：那个模块处理的是"**已有视频**"（concat + delogo + scale）；
     这里是"**把一张静图变成一小段视频**"，输入契约不同，所以单独成模块，
     **不动**既有链路（避免把已经跑通的去字幕/高清那条带歪）。 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/* 三档动效：都是"轻微到几乎看不出位移、但一眼能感到在动"的那种（用户要的正是这个观感） */
export const MOTION_PRESETS = Object.freeze([
  { id: 'zoom_in', label: '缓慢推近', hint: '镜头极慢地靠近主体，适合静物与产品' },
  { id: 'zoom_out', label: '缓慢拉远', hint: '从局部退到全景，适合场景图' },
  { id: 'pan_right', label: '缓慢横移', hint: '画面极慢向右平移，适合平铺与静物排布' },
]);

const DEFAULT_SECONDS = 3;
const MIN_SECONDS = 2;
const MAX_SECONDS = 6;
const DEFAULT_FPS = 30;
const MAX_EDGE = 2160;

export function motionPresetOf(id) {
  const key = String(id || '').trim();
  return MOTION_PRESETS.find(item => item.id === key) || MOTION_PRESETS[0];
}

/* 时长夹在 2~6 秒：太短像卡帧、太长就失去"动图"的观感，而且用户的用途是"让这张图动一下" */
export function motionSecondsOf(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return DEFAULT_SECONDS;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(seconds)));
}

export function motionFpsOf(value) {
  const fps = Number(value);
  return Number.isFinite(fps) && fps >= 12 && fps <= 60 ? Math.round(fps) : DEFAULT_FPS;
}

/**
 * 拼 zoompan 的表达式。
 * ⚠️ zoompan 的两个坑（实测踩过，写下来免得下次再踩）：
 *   ① 它作用在**每一帧**上：处理静图时必须配合 `-loop 1` 喂同样的帧，并让 `d` = 总帧数，
 *      否则出来的是一串"每帧都从缩放起点开始"的抖动画面；
 *   ② 缩放起点/终点都是表达式，写死数字会让位移在开头/结尾突然停住 —— 用 `on`（当前输出帧号）
 *      做线性插值，位移才是匀速的。
 */
export function buildMotionFilter({ preset, seconds, fps, width, height }) {
  const frames = Math.max(1, Math.round(seconds * fps));
  const chosen = motionPresetOf(preset).id;
  const box = `s=${width}x${height}:fps=${fps}:d=${frames}`;
  if (chosen === 'zoom_out') {
    /* 1.10 → 1.00：从略放大回到原尺寸 */
    return `zoompan=z='1.10-0.10*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':${box}`;
  }
  if (chosen === 'pan_right') {
    /* 轻微横移：保持 1.06 定倍，x 从 0 走到最大可动范围 */
    return `zoompan=z='1.06':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)':${box}`;
  }
  /* 默认 zoom_in：1.00 → 1.10 */
  return `zoompan=z='1+0.10*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':${box}`;
}

/* ⚠️ 实测踩到的坑（写下来免得再踩）：`zoompan` 的 `s=` **不接受 -2**（`scale` 接受，`zoompan` 不接受）——
   报错是 `Invalid argument` / `option value "-2x1920" as image size`。
   ⇒ 必须自己算出**偶数宽高**：按源图比例（或调用方指定的比例）算 W，再对齐到偶数。 */
function evenSize(value) {
  const rounded = Math.round(Number(value) || 0);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

async function probeImageSize(imagePath, ffprobePath) {
  return new Promise(resolvePromise => {
    const child = spawn(ffprobePath, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', imagePath,
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout?.on('data', chunk => { out += String(chunk); });
    child.on('error', () => resolvePromise(null));
    child.on('close', () => {
      const [width, height] = String(out).trim().split(',').map(Number);
      resolvePromise(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null);
    });
  });
}

/**
 * 把一张静图渲成一小段微动效视频。
 * @param {object} options
 * @param {string} options.imagePath   源图绝对路径
 * @param {string} [options.preset]    MOTION_PRESETS 里的 id
 * @param {number} [options.seconds]   2~6，默认 3
 * @param {number} [options.fps]       默认 30
 * @param {number} [options.height]    目标高度（宽按源图比例算，取偶数）
 * @param {string} [options.outDir]    默认 server/video-assets/output
 * @returns {Promise<{ path: string, seconds: number, preset: string, bytes: number }>}
 */
export async function renderMotionStill({
  imagePath,
  preset = '',
  seconds = DEFAULT_SECONDS,
  fps = DEFAULT_FPS,
  height = 1920,
  outDir = '',
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobePath = process.env.FFPROBE_PATH || 'ffprobe',
} = {}) {
  if (!imagePath) throw Object.assign(new Error('缺少源图'), { code: 'MOTION_INPUT_REQUIRED' });
  const info = await stat(imagePath).catch(() => null);
  if (!info?.isFile() || info.size <= 0) {
    throw Object.assign(new Error('源图不存在或是空的'), { code: 'MOTION_INPUT_REQUIRED' });
  }
  const chosen = motionPresetOf(preset);
  const duration = motionSecondsOf(seconds);
  const rate = motionFpsOf(fps);
  const targetHeight = evenSize(Math.min(MAX_EDGE, Math.max(240, Math.round(Number(height) || 1920))));
  /* 宽高比：量不出源图尺寸时退到 **3:4**（小红书图文最常见的那一档），不猜一个奇怪的默认 */
  const size = await probeImageSize(imagePath, ffprobePath);
  const ratio = size ? size.width / size.height : 3 / 4;
  const targetWidth = evenSize(targetHeight * ratio);
  const dir = outDir || join(process.cwd(), 'server', 'video-assets', 'output');
  await mkdir(dir, { recursive: true });
  /* 2026-10-03 P6：原来只有 {Date.now()} + preset，**完全可枚举** ——
     /api/motion-still/:name 又没有鉴权，等于谁的动效视频都能被遍历下载。
     加一段 crypto.randomUUID 前缀使其不可猜（uuid 要 import crypto）。 */
  const outPath = resolve(dir, `motion-${Date.now()}-${crypto.randomUUID()}-${chosen.id}.mp4`);

  /* ⚠️ 先放大两倍再交给 zoompan：直接在目标尺寸上做亚像素缩放会"抖"（画面边缘一跳一跳）。
     2 倍是实测够用的档位，再高只是白烧 CPU。 */
  const upscale = targetHeight * 2;
  const scaleStep = `scale=-2:${upscale}:flags=lanczos`;
  const filter = `${scaleStep},${buildMotionFilter({ preset: chosen.id, seconds: duration, fps: rate, width: targetWidth, height: targetHeight })}`;

  const args = [
    '-y',
    '-loop', '1', '-i', imagePath,
    '-vf', filter,
    '-t', String(duration),
    '-r', String(rate),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',                     /* 各家播放器/平台的兼容底线 */
    '-movflags', '+faststart',
    '-an',                                     /* 微动效不出声：实况观感里也没有声 */
    outPath,
  ];

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', chunk => { stderr += String(chunk); if (stderr.length > 8000) stderr = stderr.slice(-4000); });
    child.on('error', error => rejectPromise(Object.assign(error, { code: 'MOTION_FFMPEG_MISSING' })));
    child.on('close', code => {
      if (code === 0) resolvePromise();
      else rejectPromise(Object.assign(new Error('微动效渲染失败：' + stderr.slice(-300)), { code: 'MOTION_RENDER_FAILED' }));
    });
  });

  const out = await stat(outPath);
  return { path: outPath, seconds: duration, preset: chosen.id, bytes: out.size, fps: rate, width: targetWidth, height: targetHeight };
}
