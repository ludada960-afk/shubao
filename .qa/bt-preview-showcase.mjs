/* ═══ 「预览方案」展示环境（零成本 · 不碰线上）· 第二版：**带素材与提示词** ═══════════════════════
   用户口径：「你应该拿一个例子展示给我看**具体用户上传素材或者提示词的样式**呀，现在给我的截图不是空的吗，
   而且你这个**为什么是弹窗**啊，那用户关掉的话会怎么样，**再点一次会一直薅我们的 API 额度吗**。」

   ── 这一版多做三件事 ──────────────────────────────────────────────────────
   ① 真填「补充」提示词，并让打桩的 `/api/plan-preview` 返回**带素材理解**的方案
      （这样步① 不再是空态，看得出"用户上传过素材"的样子）；
   ② 把每次 `/api/plan-preview` 的**请求体原文**写进 `.tmp/preview-showcase/requests.jsonl`
      —— 里面带前端算的稳定幂等键 `billingActionId`，用来回答"再点一次会不会重复消耗"；
   ③ 走**两轮**（打开 → 关掉 → 再打开），好对比两次的 actionId 是不是同一个。

   ── 成本隔离（与 v1 相同，未变）──────────────────────────────────────────
   只服务本地 `dist/`；所有 `/api/*` 在本进程打桩；不连生产、不发真实请求、不扣积分；端口 4199。

   ── 第三版（2026-09-26 批 BW）：接口**按真实声明**打桩 ────────────────────────
   用户的最后一条口径是针对"解析方案"的：「用户输入他的提示词或者图片之后，你会有**解析的方案**吗？
   **为什么我现在看起来就是一些标签而已啊**」「我要的是，**每个工作台 skill 有自己个性化的解析方案**」。
   ⇒ 这一版不再手写那三组通用胶囊，而是**直接调 `planPreviewOptionsFor()`** ——
     展示的就是线上真会返回的东西（这条 skill 的 8 项解析 + 21 条母体 / 11 种手法）。
     ⚠️ 仍要重新 `npm run build` 之后再跑：这里服务的是构建产物，改完前端不 build 看不到。 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, appendFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

import { planPreviewOptionsFor } from '../server/planPreview.mjs';

const PORT = 4199;
const ROOT = resolve('dist');
const OUT = '.tmp/preview-showcase';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
};
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const path = url.pathname;
  if (path.startsWith('/api/')) {
    let raw = '';
    if (req.method === 'POST' || req.method === 'PUT') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      raw = Buffer.concat(chunks).toString('utf8');
      /* 记账：把预览请求的**原文**留下来（含幂等键），供"重复点会不会重复消耗"取证 */
      if (path === '/api/plan-preview') {
        try {
          const body = JSON.parse(raw || '{}');
          await appendFile(join(OUT, 'requests.jsonl'), JSON.stringify({
            at: new Date().toISOString(),
            billingActionId: body.billingActionId || body.actionId || null,
            prompt: body.prompt || '',
            materials: (body.materials || []).map(m => m.name || m.id),
            direction: body.direction || null,
          }) + '\n', 'utf8');
        } catch { /* 记不上不影响展示 */ }
      }
    }
    if (path === '/api/session') return json(res, 200, { ok: true, email: 'preview@local', nickname: '本地预览' });
    if (path === '/api/billing/balance') return json(res, 200, { ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
    if (path === '/api/billing/quote') return json(res, 200, { quote: { quoteId: 'quote-local-1', totalUnits: 500, currency: 'ec_points' } });
    if (path === '/api/plan-preview/options') {
      /* ⚠️ 批 BW：**不手写档位**，直接调线上那条同源函数 —— 截出来的就是真机形状。
         （手写一份的话，界面改了这里不会跟着改，展示就成了假的。） */
      const surface = url.searchParams.get('surface') === 'video' ? 'video' : 'image';
      const skillId = url.searchParams.get('skillId') || '';
      const options = planPreviewOptionsFor(surface, skillId);
      console.log('[options] skillId=' + (skillId || '(空)') + ' source=' + options.source +
        ' items=' + options.items.length + ' 方向组=' + options.directions.map(g => g.key + '×' + g.options.length).join(','));
      return json(res, 200, options);
    }
    if (path === '/api/plan-preview') {
      /* ⚠️ 这里返回**带素材理解 + 带解析条目**的方案：
         形状与 e2e 的桩一致，只是 items / understanding 非空，用来展示"用户上传过素材、模型已解析"的样子。
         下面这几条解析结论是**本机写的示例文本**（不联网、不调模型），版式是真的。 */
      const surface = 'image';
      const asked = JSON.parse(raw || '{}');
      const askedSurface = asked.surface === 'video' ? 'video' : 'image';
      const spec = planPreviewOptionsFor(askedSurface, asked.skillId || 'image.concept_set');
      const demo = {
        /* 概念视觉方案（图片侧） */
        subject: '哑光陶土直筒罐，口沿有一圈手作压痕',
        material: '粗陶哑光，表面有细砂颗粒感，不反光',
        palette: '灰调大地（主色 #94847A，辅 #8F8E93 / #CAB3AE），整体低饱和',
        scene: '米白灰泥墙面 + 浅色木台面，画面右下有干枝投影',
        light: '左侧柔光，投影很淡，右下角略暗',
        avoid: '画面右上有一枚小字水印；没有出现人脸',
        shotIdeas: '适合：概念静物 / 材质静物 / 局部极特写；这套里不要再重复平铺',
        direction: '秋日限定（灰调大地）——留白充足、颗粒统一',
        /* 视频侧（智能成片族：素材内容 / 卖点 / 场景 / 节奏） */
        sellingPoints: '陶土手作、耐热、一口刚好 300ml',
        pace: '前 3 秒钩子 → 中段展示手作痕迹 → 结尾报权益',
      };
      return json(res, 200, {
        plan: {
          surface: askedSurface, degraded: false,
          materials: [
            { id: 'm1', name: '素色陶土罐.jpg', understanding: '哑光陶土罐，正面偏侧 15°，底部有柔和投影，背景米白。' },
            { id: 'm2', name: '干枝与亚麻.jpg', understanding: '枯白干枝与米色亚麻布，冷调自然光，纹理清晰。' },
          ],
          /* ⚠️ label/hint 要**照服务端那样一起给**（真实响应里 label 来自声明源，模型只给 value）——
             第一版这里只给了 key+value，截图里那一列显示的是 `subject`/`palette` 这种英文 key，
             看着像 bug，其实是打桩漏字段。 */
          items: spec.items.map(item => ({ key: item.key, label: item.label, hint: item.hint, value: demo[item.key] || '' })),
          plan: {
            title: '秋日限定 · 一线走完',
            summary: '一套方向走完五张：主图、场景叙事、材质静物、细节微距、空镜。素材已按"陶土 + 干枝"统一材质语言。',
            promptText: '做一张「概念视觉方案」的成套图，一套里每张只换手法、其余全同。概念：秋日限定（主色 灰调大地 #94847A，辅 #8F8E93 / #CAB3AE）。本张手法：概念静物 —— 把主题的实体与产品重构进同一张静物。整套纪律，每一张都遵守：高端编辑级质感、柔光为主；背景干净、留白充足，主体不超过画面 40%；不出现面部；画面内不出现任何品牌标识、包装文字或水印。素材参照：1) 哑光陶土罐（正面偏侧 15°）2) 干枝与米色亚麻。（本机打桩文本，只用于展示版式）',
            steps: [
              { index: 1, title: '主图', detail: '陶土罐居中、大量留白' },
              { index: 2, title: '场景叙事', detail: '手部入画、不露脸' },
            ],
            notes: ['素材理解已并入方案（本机打桩数据，不联网、不扣积分）'],
          },
        },
        billing: { charged: false, units: 0 },
      });
    }
    return json(res, 200, { ok: true });
  }
  const safe = join(ROOT, normalize(path).replace(/^([.]{2}[\\/])+/, ''));
  let file = safe;
  try { if ((await stat(safe)).isDirectory()) file = join(safe, 'index.html'); }
  catch { file = join(ROOT, 'index.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'requests.jsonl'), '', 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const shot = name => page.screenshot({ path: OUT + '/' + name + '.png' });
const CLICKERS = ['.plan-preview-card .plan-preview-btn.is-primary', '[role="dialog"] button.is-primary', '.ui-dialog button.is-primary'];

const runFlow = async (round) => {
  await page.goto(`http://127.0.0.1:${PORT}/image-creation?id=image.concept_set`, { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 25000 });
  await page.waitForTimeout(700);
  /* ① 填一段真提示词（"用户输入"那一半） */
  const notes = '这一篇想强调：陶土的手作痕迹与水珠反光，道具用干枝';
  await page.evaluate(text => {
    const ta = document.querySelector('textarea[id="field-notes"], .media-field textarea');
    if (!ta) return;
    ta.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, notes);
  await page.waitForTimeout(400);
  if (round === 1) await shot('10-填了提示词的工作台');

  await page.click('.media-workbench-submit').catch(() => {});
  await page.waitForTimeout(1200);
  if (round === 1) await shot('11-点生成预览（计费确认）');

  for (let step = 1; step <= 4; step += 1) {
    let ok = false;
    for (const sel of CLICKERS) {
      const el = await page.$(sel);
      if (el && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); ok = true; break; }
    }
    if (!ok) for (const label of ['继续生成', '下一步', '确认方案并应用']) {
      const el = await page.$(`text=${label}`);
      if (el && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); ok = true; break; }
    }
    await page.waitForTimeout(1300);
    if (round === 1) await shot('1' + (step + 1) + '-步' + step);
    if (!ok) break;
  }
  const left = await page.$('.plan-preview-card');
  if (left) { /* 关掉（用户问的"关掉会怎么样"）：点关闭 × */ 
    const close = await page.$('.plan-preview-close');
    if (close) await close.click().catch(() => {});
    await page.waitForTimeout(600);
    if (round === 1) await shot('16-点×关掉之后');
  }
  console.log('第 ' + round + ' 轮：走完（对话框' + (left ? '已关掉' : '已应用到工作台') + '）');
};

await runFlow(1);
await runFlow(2);

/* ═══ 视频侧「代为撰写」（批 BW 补）═══════════════════════════════════════════════════════
   用户问过「我不知道你的**视频生成那边是不是也全部没解决**这种问题」——
   所以这一轮专门把视频子页面的代为撰写也走一遍、截下来（同一份对话框，档位来自这条视频 skill 的声明）。
   ⚠️ **入口在技能子页面上不是 `.video-dawei-entry`**（那是首页/独立创作台的；子页面走工作台形态，
      那个输入框整块不渲染）：入口是工作台的付费动作 `SCRIPT_ACTION`（label「生成脚本」），
      点它走的是同一个 `runDawei()`。e2e 第一次也是红在这一条上（超时 `.video-dawei-entry`）。
   ⚠️ 视频提示词是 contentEditable（工作台里那份带 `.video-wb-prompt`）。 */
const runVideoFlow = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/video-creation?id=video.smart`, { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-paid', { timeout: 25000 });
  await page.waitForTimeout(800);
  await page.locator('.video-wb-prompt').first().fill('给这款陶土杯做一条 15 秒的抖音带货口播，前 3 秒要有钩子').catch(() => {});
  await page.waitForTimeout(400);
  await shot('20-视频工作台（填了脚本需求）');
  await page.locator('.media-workbench-paid', { hasText: '生成脚本' }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot('21-视频代为撰写（计费确认）');
  for (let step = 1; step <= 4; step += 1) {
    let ok = false;
    for (const sel of CLICKERS) {
      const el = await page.$(sel);
      if (el && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); ok = true; break; }
    }
    await page.waitForTimeout(1300);
    await shot('2' + (step + 1) + '-视频步' + step);
    if (!ok) break;
  }
  console.log('视频侧：走完（对话框' + (await page.$('.plan-preview-card') ? '还开着' : '已应用') + '）');
};
await runVideoFlow();

const log = await readFile(join(OUT, 'requests.jsonl'), 'utf8');
console.log('\n=== /api/plan-preview 的请求体记账（每次点击一行）===');
console.log(log.trim() || '(没有记录到请求)');
await browser.close();
server.close();
