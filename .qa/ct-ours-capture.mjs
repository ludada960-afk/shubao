/* 批 CT 第二步（只读）：把我们**视频侧**每一条"有知渔对应页"的技能子页面逐页量一遍，
   量的是与知渔同一批维度（面板/组头/字段标题/控件尺寸/CTA），再用 .qa/ct-diff.mjs 逐页对表。
   另外量一份**图片侧基准**（image.product_suite）—— 用户要的是"两侧同等级"，所以每一行都要能读成
   知渔 / 我们视频 / 我们图片 三个数。
   用法：node .qa/ct-ours-capture.mjs  */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';
import { QUANTV_VIDEO_COUNTERPARTS } from '../src/skills/quantvVideoParity.js';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
console.log('dev server = ' + server.base + '（' + server.source + '）');
mkdirSync('.tmp/ct', { recursive: true });

const browser = await chromium.launch();
const mock = async page => page.route('**/api/**', route => {
  const p = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (p === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (p === '/api/works') return json({ works: [] });
  if (p === '/api/video/capabilities') return json({
    loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus',
    defaultProductId: 'seedance_standard', durations: { min: 5, max: 10 },
    products: [{ id: 'seedance_standard', label: 'Seedance 2.0', default: true, modes: ['script'], resolutions: ['720p'], durationOptions: [5], durations: { min: 5, max: 10 }, quotes: { short: { sku: 's', units: 1, points: 92 }, long: { sku: 'l', units: 1, points: 184 } } }],
  });
  if (p === '/api/video/jobs') return json({ jobs: [] });
  return json({ ok: true });
});

/* 页面里"同一批维度"的取法（两侧共用一份口径，见 docs/design/88 的表头） */
const MEASURE = () => {
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const F = el => { const cs = getComputedStyle(el); return { font: Math.round(parseFloat(cs.fontSize) * 100) / 100 + '/' + cs.fontWeight, color: cs.color, radius: Math.round(parseFloat(cs.borderTopLeftRadius) || 0), pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft, bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor }; };
  const txt = el => (el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const left = document.querySelector('.media-workbench-left') || document.querySelector('.media-workbench-panel');
  const head = document.querySelector('.media-workbench-head h2') || document.querySelector('.media-workbench-head');
  const groupTitle = document.querySelector('.media-workbench-group-title');
  const fields = Array.from(document.querySelectorAll('.video-wb-block, .media-field')).map(block => {
    const label = block.querySelector('.media-field-label, .media-field-label span');
    const chip = block.querySelector('.media-field-segmented button');
    const seg = block.querySelector('.media-field-segmented');
    const upload = block.querySelector('.video-wb-upload, .media-field-upload-box, .media-field-upload');
    const area = block.querySelector('.media-field-textarea, .media-field-control, textarea, .mention-prompt-field');
    const paid = block.querySelector('.media-workbench-paid');
    const pick = chip || upload || area || paid;
    return {
      label: txt(label),
      labelFont: label ? F(label).font : null,
      rect: R(block),
      ctrl: pick ? { kind: pick.className.toString().slice(0, 40), r: R(pick), ...F(pick) } : null,
      chips: seg ? { n: seg.querySelectorAll('button').length, first: R(seg.querySelector('button')), gap: getComputedStyle(seg).gap, cols: getComputedStyle(seg).gridTemplateColumns.split(' ').length } : null,
    };
  });
  const cta = document.querySelector('.video-generate-trigger') || document.querySelector('.media-workbench-submit');
  const ctaWrap = cta ? cta.closest('section, div') : null;
  return {
    url: location.pathname + location.search,
    vw: window.innerWidth,
    left: left ? R(left) : null,
    head: head ? { t: txt(head), r: R(head), ...F(head) } : null,
    groupTitle: groupTitle ? { t: txt(groupTitle), r: R(groupTitle), ...F(groupTitle) } : null,
    fields,
    cta: cta ? { t: txt(cta), r: R(cta), ...F(cta), wrap: ctaWrap ? R(ctaWrap) : null } : null,
    scrollH: document.documentElement.scrollHeight,
  };
};

const out = [];
const one = async (label, url) => {
  const page = await browser.newPage({ viewport: { width: 1932, height: 1080 } });
  await mock(page);
  try {
    await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3400);
    const data = await page.evaluate(MEASURE);
    const errBoundary = await page.evaluate(() => (document.body.innerText || '').match(/出错了|Something went wrong|is not defined/) ? (document.body.innerText || '').slice(0, 160) : null);
    out.push({ label, ok: true, ...data, errBoundary });
    console.log(`ok   ${label}  字段 ${data.fields.length}  CTA ${data.cta ? data.cta.r.w + '×' + data.cta.r.h : '(无)'}${errBoundary ? '  ⚠️错误边界' : ''}`);
  } catch (error) {
    out.push({ label, ok: false, error: String(error?.message || error).slice(0, 160) });
    console.log(`失败 ${label} → ${String(error?.message || error).slice(0, 120)}`);
  }
  await page.close();
};

/* ① 图片侧基准（用户说的"图片生成那边"就是它） */
await one('图片侧 image.product_suite', '/image-creation?id=image.product_suite');
await one('图片侧 image.concept_set', '/image-creation?id=image.concept_set');

/* ② 视频侧：每一条**有知渔对应页**的技能 */
const ids = Object.entries(QUANTV_VIDEO_COUNTERPARTS).filter(([, v]) => v && v.counterpart).map(([id]) => id);
console.log('有对应页的视频技能 = ' + ids.length);
for (const id of ids) await one('视频侧 ' + id, '/video-creation?id=' + encodeURIComponent(id));

writeFileSync('docs/design/data/quantv-parity-ours.json', JSON.stringify({ capturedAt: new Date().toISOString(), viewport: '1932x1080', pages: out }, null, 1));
console.log('已写 docs/design/data/quantv-parity-ours.json：' + out.filter(p => p.ok).length + ' / ' + out.length);
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
