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
   只服务本地 `dist/`；所有 `/api/*` 在本进程打桩；不连生产、不发真实请求、不扣积分；端口 4199。 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, appendFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

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
      const surface = url.searchParams.get('surface') === 'video' ? 'video' : 'image';
      return json(res, 200, {
        surface,
        directions: [
          { key: 'business', label: '业务场景', options: [{ value: 'ecommerce', label: '电商带货', prompt: '侧重商品卖点与下单引导。' }, { value: 'brand', label: '品牌形象', prompt: '侧重气质与调性。' }] },
          { key: 'content', label: '画面用途', options: [{ value: 'main', label: '主图', prompt: '干净利落的主图。' }, { value: 'scene', label: '场景图', prompt: '带环境氛围。' }] },
          { key: 'shot', label: '拍摄方式', options: [{ value: 'studio', label: '白底棚拍', prompt: '纯白底棚拍，柔和主光。' }, { value: 'life', label: '生活实拍', prompt: '自然光、随手拍质感。' }] },
        ],
      });
    }
    if (path === '/api/plan-preview') {
      /* ⚠️ 这里返回**带素材理解**的方案：形状与 e2e 的桩一致，只是 materials / understanding 非空，
         用来展示"用户上传过素材"时那三步长什么样。 */
      return json(res, 200, {
        plan: {
          surface: 'image', degraded: false,
          materials: [
            { id: 'm1', name: '素色陶土罐.jpg', summary: '哑光陶土罐，正面偏侧 15°，底部有柔和投影，背景米白。' },
            { id: 'm2', name: '干枝与亚麻.jpg', summary: '枯白干枝与米色亚麻布，冷调自然光。' },
          ],
          understanding: [
            /* ⚠️ 字段名必须是 `understanding` —— 对话框读的就是它（我第一版写成了 `summary`，
               于是截图里那两个文本框是空的：**打桩的字段名与真机不一致**，不是版式坏了）。 */
            { id: 'm1', name: '素色陶土罐.jpg', understanding: '哑光陶土罐，正面偏侧 15°，底部有柔和投影，背景米白。' },
            { id: 'm2', name: '干枝与亚麻.jpg', understanding: '枯白干枝与米色亚麻布，冷调自然光，纹理清晰。' },
          ],
          plan: {
            title: '秋日限定 · 一线走完',
            summary: '一套方向走完五张：主图、场景叙事、材质静物、细节微距、空镜。素材已按"陶土 + 干枝"统一材质语言。',
            promptText: '做一张「概念视觉方案」的成套图，一套里每张只换手法、其余全同。概念：秋日限定（主色 暖灰大地 #94847A，辅 #8F8E93 / #CAB3AE）。本张手法：概念静物 —— 把主题的实体与产品重构进同一张静物。整套纪律，每一张都遵守：高端编辑级质感、柔光为主；背景干净、留白充足，主体不超过画面 40%；不出现面部；画面内不出现任何品牌标识、包装文字或水印。素材参照：1) 哑光陶土罐（正面偏侧 15°）2) 干枝与米色亚麻。（本机打桩文本，只用于展示版式）',
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
const log = await readFile(join(OUT, 'requests.jsonl'), 'utf8');
console.log('\n=== /api/plan-preview 的请求体记账（每次点击一行）===');
console.log(log.trim() || '(没有记录到请求)');
await browser.close();
server.close();
