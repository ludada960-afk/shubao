// W5 ffmpeg v3: 最小可行视频渲染 (P0-A, 4c183cd4 续命)
// 不集成 worker, 只导出函数. 后续 sprint 再接 videoRendererWorker.mjs
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/* ═══ 2026-09-24 批 AH：**输出规格**（分辨率 / 帧率）—— 「视频高清」的本地实现 ═══════════════════
   用户原话（图八方向的那条，也是本轮的路径纠正）：
   「难道你没有什么比如 github 上的一些开源项目可以实现吗，**为什么一切都要追究模型呢**」
   ⇒ 「视频高清」不必是"某个上游超模模型"：**本地 ffmpeg 就能提分辨率**，零上游成本、不排队、
     也不受中转稳定性影响（上游 v2v 那条实测两次都没成功）。

   约定（**不改变既有行为**）：manifest 里给了 output 才加缩放，不给就与从前逐字节一致。
     manifest.output = { resolution: '1080p' | '720p' | '2k' | '1440p', fps: 30 | 60 }
   实现：把 concat 出来的 [outv] 再送进 scale（按目标高度等比放大，宽度取偶）与可选 fps，
   再映射给编码器。用 lanczos 缩放（锐度高、成本低，CPU 上秒级完成）。
   ⚠️ 这是**近似超分**（不是 AI 重建）：画质提升来自更精细的重采样，不会无中生有细节。
      要做到"真的更清晰"可后补 Real-ESRGAN（开源、CPU 可跑），接口形状不变 —— 仍走同一个 output 约定。 */
const RESOLUTION_HEIGHT = Object.freeze({
  '480p': 480, '720p': 720, '1080p': 1080, '2k': 1440, '1440p': 1440, '4k': 2160, '2160p': 2160,
});

export function outputFpsOf(manifest) {
  const fps = Number(manifest?.output?.fps);
  return Number.isFinite(fps) && fps >= 24 && fps <= 60 ? Math.round(fps) : null;
}

/* ═══ 2026-09-25 批 AM：**时长**与**保留原声**（本地方案真出片时必须的两件事）═══════════════════
   两条都是"没声明就与从前逐字节一致"的加法，理由各自不同：
     · duration：原来恒为 `-t 10`。上游那条路（导出工作台）的片段本来就短，10 秒够用；
       但本地方案处理的是**用户自己的整条片子** —— 一条 60 秒的片子被悄悄截成 10 秒，
       那不是"高清 10 秒"，是交付事故。所以清单给了 duration 就用它，没给仍是 10。
     · keepAudio：原来只 `-map [final]`（只有视频轨），高清/去字幕出来的片子会**没有声音**。
       本地方案要的是"原片 + 那一处改动"，所以声明 keepAudio 时才把第一条输入的音轨也带上
       （`-map 0:a?` 可选映射：源片没有声音时不会让 ffmpeg 报错），音轨统一转 aac 以兼容 mp4 容器。 */
export function outputDurationOf(manifest) {
  const seconds = Number(manifest?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, 3600);
}

export function keepsSourceAudio(manifest) {
  return manifest?.keepAudio === true;
}

/* ═══ 2026-09-25 批 AJ：**区域擦除**（字幕去除的本地实现）═══════════════════════════════════════
   用户口径（两轮之前那句最关键的纠正）：「难道你没有什么比如 github 上的一些开源项目可以实现吗，
   为什么一切都要追究模型呢」—— 字幕去除不必是"某条上游去字幕模型"：
   知渔那页本来就有「**手动标记：放大视频并手动框选字幕区域**」，而"框选区域 + 区域擦除"正是
   ffmpeg 的 `delogo` 滤镜（用周边像素插值把矩形区域补掉，纯 CPU、零上游成本）。
   约定：manifest.replace = [{ type: 'delogo', x, y, w, h }, ...]（可多个区域）。
   校验：坐标必须是非负整数、宽高必须 ≥ 8 且落在合理范围内 —— 编不出来的参数宁可**不加滤镜**
        （把片子擦坏比不擦更糟），与 scale 的"不认识的档位不缩放"同一条纪律。 */
const MAX_REGION = 8192;

export function delogoRegionsOf(manifest) {
  const list = Array.isArray(manifest?.replace) ? manifest.replace : [];
  const regions = [];
  for (const item of list) {
    if (!item || String(item.type || '').toLowerCase() !== 'delogo') continue;
    const nums = ['x', 'y', 'w', 'h'].map(key => Number(item[key]));
    if (!nums.every(Number.isFinite)) continue;
    const [x, y, w, h] = nums.map(Math.round);
    if (x < 0 || y < 0 || w < 8 || h < 8 || x > MAX_REGION || y > MAX_REGION || w > MAX_REGION || h > MAX_REGION) continue;
    regions.push({ x, y, w, h });
  }
  return regions;
}

export function buildFilterChain(manifest) {
  const clips = manifest.timeline.clips;
  const concat = clips.map((_, i) => `[${i}:v]`).join('') + `concat=n=${clips.length}:v=1[outv]`;
  const declared = String(manifest?.output?.resolution || '').trim().toLowerCase();
  const height = RESOLUTION_HEIGHT[declared];
  const fps = outputFpsOf(manifest);
  const regions = delogoRegionsOf(manifest);
  /* 顺序有讲究：**先擦除、后缩放** —— delogo 的坐标是按**原片像素**框的，
     先缩放会让框选区域错位（用户框的是他在原片里看到的那块字幕）。 */
  const steps = [];
  for (const region of regions) steps.push(`delogo=x=${region.x}:y=${region.y}:w=${region.w}:h=${region.h}`);
  if (height) steps.push(`scale=-2:${height}:flags=lanczos`);
  if (fps) steps.push(`fps=${fps}`);
  if (!steps.length) return { filterComplex: concat, target: '[outv]' };
  return { filterComplex: `${concat};[outv]${steps.join(',')}[final]`, target: '[final]' };
}

export async function renderVideo(manifest) {
  if (!manifest?.timeline?.clips?.length) {
    return { path: null, duration: 0, error: 'no clips in manifest' };
  }
  const outDir = join(process.cwd(), 'server', 'video-assets', 'output');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `render-${Date.now()}.mp4`);

  // 拼 ffmpeg 命令: 用 input list 模式
  const inputArgs = manifest.timeline.clips.flatMap(clip => ['-i', clip.url || 'testsrc=size=320x240:rate=30:duration=2']);
  // concat（+ 可选的 scale / fps）
  const { filterComplex, target } = buildFilterChain(manifest);
  const duration = outputDurationOf(manifest);
  const withAudio = keepsSourceAudio(manifest);

  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', target,
    /* 保留原声（只在清单声明 keepAudio 时加）：`-map 0:a?` 的 `?` 让"源片没有音轨"不报错 */
    ...(withAudio ? ['-map', '0:a?', '-c:a', 'aac', '-b:a', '160k'] : []),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    /* 清单给了时长就按它（本地方案处理整条片子）；没给仍是 10 秒（既有导出链路逐字节不变） */
    '-t', String(duration ?? 10),
    outPath,
  ];

  return new Promise(resolve => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve({ path: outPath, duration: duration ?? 10, error: null, output: manifest?.output || null });
      else resolve({ path: null, duration: 0, error: `ffmpeg exit ${code}: ${stderr.slice(-500)}` });
    });
    proc.on('error', err => resolve({ path: null, duration: 0, error: err.message }));
  });
}

