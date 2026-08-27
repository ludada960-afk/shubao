// W5 ffmpeg v3: 最小可行视频渲染 (P0-A, 4c183cd4 续命)
// 不集成 worker, 只导出函数. 后续 sprint 再接 videoRendererWorker.mjs
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function renderVideo(manifest) {
  if (!manifest?.timeline?.clips?.length) {
    return { path: null, duration: 0, error: 'no clips in manifest' };
  }
  const outDir = join(process.cwd(), 'server', 'video-assets', 'output');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `render-${Date.now()}.mp4`);

  // 拼 ffmpeg 命令: 用 input list 模式
  const inputArgs = manifest.timeline.clips.flatMap(clip => ['-i', clip.url || 'testsrc=size=320x240:rate=30:duration=2']);
  // 简化: 直接 concat
  const filterComplex = manifest.timeline.clips.map((_, i) => `[${i}:v]`).join('') + `concat=n=${manifest.timeline.clips.length}:v=1[outv]`;

  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-t', '10',
    outPath,
  ];

  return new Promise(resolve => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve({ path: outPath, duration: 10, error: null });
      else resolve({ path: null, duration: 0, error: `ffmpeg exit ${code}: ${stderr.slice(-500)}` });
    });
    proc.on('error', err => resolve({ path: null, duration: 0, error: err.message }));
  });
}
