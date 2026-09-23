// scripts/probe-video-edit-capability.mjs
/* ═══ 付费探针：验证 omni-v2v（视频转视频）能不能干「视频高清」与「去字幕」 ═══════════════════
   为什么要有这个脚本：
   用户原话：「数字人 / 视频高清 / 视频字幕去除 这些是必须上游模型有这些能力吗，他们知渔是因为模型
   才能使用这些能力吗，**难道不是因为 skill 封装的方案吗**？」——他说得对，这三页不必等"专用模型"，
   通用 v2v 路由 + skill 封装就能承载。零成本探针已经证明这条路由**活着、我们凭证能调**
   （400 invalid_reference：要参考素材），但**输入输出契约没验证过**：
     · 视频高清 → 给一段视频 + 要求更高分辨率，输出是不是真的更清晰？
     · 去字幕   → 给一段带字幕的视频 + "去掉画面里的字幕"，字幕是不是真的没了？
   这两件事只能靠**一次真实出片**回答。

   ⚠️ 这是**付费**探针：每次提交约 ¥1.15（文档价 Omni 视频转视频 ¥1.15128/条）。
      所以脚本**默认什么都不做**，必须显式加 --yes 才会真的提交；
      而且会把每次提交的 task id 与预估花费打在屏幕上，便于对账。

   用法：
     node scripts/probe-video-edit-capability.mjs --video <视频URL|本地文件路径> --mode upscale --yes
     node scripts/probe-video-edit-capability.mjs --video <视频URL|本地文件路径> --mode desubtitle --yes
     （--mode both 会连跑两次；--resolution 1080p 可指定目标分辨率，默认 1080p）

   跑完把输出贴给开发：拿到 task 结果 URL 就能判断这两页能不能按知渔的形态上。 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '') : '';
};

const CONFIRMED = flag('--yes');
const MODE = value('--mode') || 'upscale';
const RESOLUTION = value('--resolution') || '1080p';
const VIDEO = value('--video');

const COST_PER_RUN_CNY = 1.15128;   // 文档价：Omni 视频转视频 ¥1.15128/条（无水印档 ¥1.3455）

const readEnv = key => {
  const envPath = path.resolve('server/.env');
  if (!fs.existsSync(envPath)) return '';
  const match = fs.readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
};

const PROMPTS = {
  upscale: `把这段视频画质提升到 ${RESOLUTION}：保持原有构图、动作、光线与主体不变，只提高清晰度与细节，不新增或删减画面内容，不改变镜头运动。`,
  desubtitle: '去掉画面里所有的字幕文字与贴片文字：保留人物、动作、镜头、背景与光线不变，把字幕区域用周围的画面内容自然补全，不留色块与模糊斑。',
};

async function main() {
  const key = readEnv('IP233_VIDEO_API_KEY');
  const base = (readEnv('IP233_VIDEO_BASE_URL') || 'https://api-new.ip233.com/v1').replace(/\/+$/, '');

  console.log('=== omni-v2v 能力探针（付费）===');
  console.log(`模式：${MODE}  目标分辨率：${RESOLUTION}`);
  console.log(`视频：${VIDEO || '（未提供）'}`);
  console.log(`预估花费：每次提交 ≈ ¥${COST_PER_RUN_CNY}（${MODE === 'both' ? '本次要跑 2 次' : '本次跑 1 次'}）`);

  if (!key) { console.log('\n✗ server/.env 里没有 IP233_VIDEO_API_KEY，无法提交。'); process.exitCode = 1; return; }
  if (!VIDEO) { console.log('\n✗ 必须用 --video <视频URL> 指定要处理的视频。\n  提示：可以先用站内上传接口拿一个 https 地址，或直接用一段公网可访问的 mp4。'); process.exitCode = 1; return; }
  if (!/^https?:\/\//.test(VIDEO)) { console.log('\n✗ --video 必须是 http(s) 直链（本脚本不替你做上传）。'); process.exitCode = 1; return; }
  if (!CONFIRMED) {
    console.log('\n（未加 --yes，已停在提交之前 —— 这一步会真的花钱。）');
    console.log('确认要跑就再执行一次并加上 --yes。');
    return;
  }

  const modes = MODE === 'both' ? ['upscale', 'desubtitle'] : [MODE];
  for (const mode of modes) {
    const body = {
      model: 'omni-v2v',
      prompt: PROMPTS[mode] || PROMPTS.upscale,
      duration: 5,
      resolution: RESOLUTION,
      /* 载荷形状按站内 seedance 适配器那一套（server/videoProviders.mjs 的 referenceData）：
         参考视频走 reference_video_urls。⚠️ 这是**推测**，探针的意义之一就是验证它对不对 ——
         若上游回参数错，把它的原文贴在报告里，我据此改适配器。 */
      reference_video_urls: [VIDEO],
    };
    console.log(`\n--- 提交 [${mode}] ---`);
    const res = await fetch(`${base}/videos`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `probe-v2v-${mode}-${Date.now()}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`HTTP ${res.status}  ${text.slice(0, 400)}`);
    let id = '';
    try { const json = JSON.parse(text); id = json.id || json.task_id || json.data?.id || ''; } catch { /* 非 JSON */ }
    if (!id) { console.log('（没有拿到 task id —— 这条要当"契约不对"处理，把上面的报文贴给我）'); continue; }
    console.log(`task id: ${id}（已提交，等它跑完再查结果）`);
    /* 轮询到终态：v2v 出片通常 1-3 分钟 */
    for (let i = 0; i < 40; i += 1) {
      await new Promise(r => setTimeout(r, 15000));
      const poll = await fetch(`${base}/videos/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}` } });
      const pollText = await poll.text();
      let state = '';
      try { const json = JSON.parse(pollText); state = json.status || json.data?.status || ''; } catch { /* 非 JSON */ }
      console.log(`  [${i}] ${poll.status} status=${state || '?'} ${pollText.slice(0, 200)}`);
      if (/completed|succeeded|failed|error/i.test(state)) {
        console.log(`\n[${mode}] 终态：${state}`);
        console.log('  完整报文：' + pollText.slice(0, 1500));
        console.log('  ⇒ 把这段连同上面的 task id 一起贴给开发：它会告诉我们（a）能不能按 ${RESOLUTION} 重绘（b）字幕有没有被去掉。'.replace('${RESOLUTION}', RESOLUTION));
        break;
      }
    }
  }
  console.log('\n对账提示：跑完后确认一下中转余额，本次正常应减少 ≈ ¥' + (COST_PER_RUN_CNY * modes.length).toFixed(5));
}

await main();
