import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { MOTION_PRESETS, buildMotionFilter, motionPresetOf, motionSecondsOf, renderMotionStill } from '../server/motionStillRender.mjs';
import { readFileSync as readSource } from 'node:fs';

/* ═══ 2026-09-24 批 AX：静态图 → 微动效短视频（小红书那条"让图会动"）═══════════════════════════════
   用户口径（两轮，第二轮把我的第一版方案否了）：
     · 「实况图这里，**图生视频也是免费吗**？你确定你的方案是对的吗，而且**为什么要传手机呢**，
        你没搞明白吗，就是小红书支持实况图没错，但是人家这个账号是**有些内容会模拟实况图的这种
        方式去做**呀，你传回手机是要干嘛呀，**目的只是发到小红书上成为他的笔记内容**」
   ⇒ 落点：**本机 ffmpeg 微动效**（零上游成本），出 2~3 秒竖版短视频**直接发**；
     不做真·Live Photo、不传手机（那条路是"个人用 App 发实况"，对账号内容生产是多余的一步）。
   判据：
     ① 三档动效都有，且表达式是**按帧号线性插值**的（写死数字会在首尾"停住"）；
     ② `zoompan` 的 `s=` 必须是**显式偶数宽高** —— 它不接受 `-2`（这条是实测踩出来的坑，
        报错长这样：`option value "-2x1920" as image size` / Invalid argument）；
     ③ 时长夹在 2~6 秒（太短像卡帧、太长就不是"动图"了）；
     ④ **真渲一条**并 ffprobe 复核：编码 h264 / 时长 = 申报时长 / 有宽高 / 有体积。 */

const makeImage = async (dir, width, height) => {
  const path = join(dir, 'src.jpg');
  await sharp({ create: { width, height, channels: 3, background: '#7C3AED' } }).jpeg({ quality: 88 }).toFile(path);
  return path;
};

test('① 三档动效 + 表达式按帧号插值', () => {
  assert.deepEqual(MOTION_PRESETS.map(item => item.id), ['zoom_in', 'zoom_out', 'pan_right'], '三档动效');
  for (const preset of MOTION_PRESETS) assert.ok(preset.label && preset.hint, preset.id + ' 要有中文名与说明');
  assert.equal(motionPresetOf('__nope__').id, 'zoom_in', '未知档位退回默认（不抛错、不静默变成空滤镜）');
  for (const id of ['zoom_in', 'zoom_out', 'pan_right']) {
    const filter = buildMotionFilter({ preset: id, seconds: 3, fps: 30, width: 1080, height: 1920 });
    assert.match(filter, /zoompan=/, id + ' 用 zoompan');
    assert.match(filter, /on\/90/, id + ' 的位移/缩放必须按帧号插值（90 帧 = 3 秒 × 30fps）');
    assert.match(filter, /s=1080x1920:fps=30:d=90/, id + ' 的 s/fps/d 要显式给出');
  }
});

test('② zoompan 的 s 不接受 -2 ⇒ 必须是显式偶数（这条是实测踩的坑）', () => {
  const filter = buildMotionFilter({ preset: 'zoom_in', seconds: 2, fps: 30, width: 1440, height: 1920 });
  assert.doesNotMatch(filter, /s=-2x/, '不许把 -2 交给 zoompan（ffmpeg 会 Invalid argument）');
  assert.match(filter, /s=1440x1920/);
  /* 偶数对齐：奇数宽会直接被 libx264 的 yuv420p 拒掉 */
  assert.match(buildMotionFilter({ preset: 'zoom_in', seconds: 2, fps: 30, width: 1441, height: 1921 }), /s=1441x1921/,
    '（拼接函数只负责照用，偶数对齐在 renderMotionStill 里做 —— 见下一条的真渲）');
});

test('③ 时长夹在 2~6 秒', () => {
  assert.equal(motionSecondsOf(undefined), 3, '默认 3 秒');
  assert.equal(motionSecondsOf(1), 2, '太短 → 2');
  assert.equal(motionSecondsOf(9), 6, '太长 → 6');
  assert.equal(motionSecondsOf('x'), 3, '非法值 → 默认');
});

test('④ 真渲一条 3 秒片子并用 ffprobe 复核（本机 ffmpeg，零上游成本）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'shubao-motion-'));
  try {
    const imagePath = await makeImage(dir, 1200, 1600);   /* 3:4 竖图 */
    const result = await renderMotionStill({ imagePath, preset: 'zoom_in', seconds: 3, height: 1920, outDir: dir });
    assert.equal(result.seconds, 3);
    assert.equal(result.height, 1920);
    assert.equal(result.width, 1440, '宽按源图 3:4 算出来应是 1440（且为偶数）');
    assert.ok(result.bytes > 10_000, '成片要有体积：' + result.bytes);
    const probe = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
      '-of', 'default=nw=1', result.path,
    ], { encoding: 'utf8' });
    assert.match(probe, /codec_name=h264/, '必须是 h264（平台兼容底线）');
    assert.match(probe, /width=1440/);
    assert.match(probe, /height=1920/);
    assert.match(probe, /r_frame_rate=30\/1/);
    assert.match(probe, /duration=3\.0/, '成片时长必须等于申报时长（计费/观感都按它）');
    /* 源图不存在时要报明确的 code，不是拿一个不存在的路径去 spawn */
    await assert.rejects(() => renderMotionStill({ imagePath: join(dir, 'nope.jpg'), outDir: dir }),
      error => error.code === 'MOTION_INPUT_REQUIRED');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('⑤ 接线：路由存在、不扣积分、**两端的预设 id 必须一致**', () => {
  const server = readSource(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const client = readSource(new URL('../src/services/api.js', import.meta.url), 'utf8');
  const page = readSource(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  assert.match(server, /app\.post\('\/api\/motion-still'/, '要有 POST /api/motion-still');
  assert.match(server, /app\.get\('\/api\/motion-still\/:name'/, '要有成片下载口');
  assert.match(server, /\.mp4\$\/i\.test\(name\)/, '下载口要按文件名白名单收口（不许目录穿越）');
  /* 这一条是"它不扣积分"的证据：这条路径里不许出现报价/冻结 */
  const start = server.indexOf("app.post('/api/motion-still'");
  const route = server.slice(start, server.indexOf("app.get('/api/motion-still/:name'"));
  assert.ok(route.length > 400, '路由体要看得到');
  assert.doesNotMatch(route, /billing_quote_id|createHold|quoteCanvasAction/, '本机导出**不许**走报价或冻结（它不是"生成"）');
  assert.match(client, /export async function generateMotionStill/, '客户端要有 generateMotionStill');
  assert.match(page, /让它动/, '小红书子页面要有入口');
  /* 两端预设 id 一致：各写一份就是等着漂移 */
  const clientIds = [...page.matchAll(/\{ id: '([a-z_]+)', label: '[^']+' \}/g)]
    .map(match => match[1])
    .filter(id => ['zoom_in', 'zoom_out', 'pan_right'].includes(id));
  assert.deepEqual(clientIds.sort(), MOTION_PRESETS.map(item => item.id).sort(),
    '页面上的动效档位必须与服务端 MOTION_PRESETS 一一对应');
});
