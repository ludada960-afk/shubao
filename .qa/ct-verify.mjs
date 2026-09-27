/* 批 CT 复验（只读）：两侧工作台的「内容列 / 胶囊 / 上传框 / CTA / 组头」现在是否同一档。
   批 CT 只动了两条内边距（视频侧透明壳的 22px、底栏的 2px），这里量"改完到底一样了没有"。
   用法：node .qa/ct-verify.mjs  */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const mock = async page => page.route('**/api/**', route => {
  const p = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (p === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (p === '/api/works') return json({ works: [] });
  if (p === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  if (p === '/api/video/jobs') return json({ jobs: [] });
  return json({ ok: true });
});

const MEASURE = () => {
  const R = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const panel = document.querySelector('.media-workbench-panel') || document.querySelector('.media-workbench-left');
  const field = document.querySelector('.media-workbench-fields > *, .video-wb-block, .media-field');
  const chip = document.querySelector('.media-field-segmented button');
  const chipBox = document.querySelector('.media-field-segmented');
  const upload = document.querySelector('.media-field-upload-box, .video-wb-upload');
  const cta = document.querySelector('.media-workbench-submit, .video-generate-trigger');
  const groupTitle = document.querySelector('.media-workbench-group-title');
  const materials = document.querySelector('.video-materials');
  const prompt = document.querySelector('.video-wb-prompt, .media-field-textarea textarea, .mention-prompt-field');
  return {
    vw: window.innerWidth,
    panel: R(panel), field: R(field), chip: R(chip), chipBox: R(chipBox), upload: R(upload), cta: R(cta),
    groupTitle: R(groupTitle), materials: R(materials), prompt: R(prompt),
    chipGap: chipBox ? getComputedStyle(chipBox).gap : null,
    chipH: chip ? Math.round(chip.getBoundingClientRect().height) : null,
    err: (document.body.innerText || '').match(/is not defined|出错了/) ? (document.body.innerText || '').slice(0, 120) : null,
  };
};

const rows = [];
for (const [label, url] of [
  ['视频侧 video.image_to_video', '/video-creation?id=video.image_to_video'],
  ['视频侧 video.light_shift', '/video-creation?id=video.light_shift'],
  ['图片侧 image.product_suite', '/image-creation?id=image.product_suite'],
  ['图片侧 image.concept_set', '/image-creation?id=image.concept_set'],
]) {
  const page = await browser.newPage({ viewport: { width: 1932, height: 1080 } });
  await mock(page);
  await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3400);
  const m = await page.evaluate(MEASURE);
  rows.push([label, m]);
  console.log('\n===== ' + label + (m.err ? '  ⚠️ ' + m.err : '') + ' =====');
  const show = (k, v) => console.log('  ' + k.padEnd(12) + (v ? `x=${v.x} w=${v.w} h=${v.h}` : '(无)'));
  show('内容列/字段', m.field);
  show('面板', m.panel);
  show('组头', m.groupTitle);
  show('胶囊容器', m.chipBox);
  show('胶囊', m.chip);
  console.log('  胶囊 gap=' + m.chipGap);
  show('上传框', m.upload);
  show('CTA', m.cta);
  show('脚本框', m.prompt);
  show('素材区', m.materials);
  await page.close();
}

/* 两侧对照（同一批项） */
const pick = re => rows.filter(r => re.test(r[0]));
const line = (a, b, key) => {
  const ka = a[1][key], kb = b[1][key];
  const f = v => (v ? v.x + '/' + v.w + '×' + v.h : '(无)');
  const same = ka && kb && ka.x === kb.x && ka.w === kb.w;
  console.log('  ' + key.padEnd(12) + '图片 ' + f(ka).padEnd(18) + '视频 ' + f(kb).padEnd(18) + (same ? '✅ 同' : '❌ 不同'));
};
const img = pick(/image.product_suite/)[0];
const vid = pick(/video.image_to_video/)[0];
console.log('\n===== 两侧对照（image.product_suite ↔ video.image_to_video）=====');
for (const k of ['panel', 'field', 'groupTitle', 'chipBox', 'chip', 'upload', 'cta', 'prompt', 'materials']) line(img, vid, k);

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
