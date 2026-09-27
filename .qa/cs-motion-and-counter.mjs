/* ═══ 批 CS 探针（2026-09-27）═══════════════════════════════════════════════════════════════
   ① 动效对表补完 —— 批 CR 只量到"视频侧 chips 在 video.smart 上没有实例"，
      本批挑**真的声明了 chips 的技能页**再对一次（video.content_swap 的「换模特/换产品」两颗、
      video.light_shift 的「比例」五档），并给出 `video-config-trigger` 0.2s vs 其它件 0.18s 的说法。
   ② 字数上限口径 —— 把"页面上显示的数 / 真正能输入的数"三处一次性量清（含放大弹窗里的分母）。
   ⚠️ 纪律（批 CR 踩过）：每项必须区分「元素不存在」与「值为空」—— 所以每一项都打印命中个数。
   ⚠️ 只读探针：不改任何状态、不触发任何付费动作。
─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
console.log('dev server = ' + server.base + '（' + server.source + '）');
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();

/* 子页面用的 API 替身（与 .qa/cr-narrow-and-motion.mjs 同一份，保证同环境可比） */
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

/* ── ① 动效：逐选择器读 computed transition（命中 0 个 = 元素不存在，必须显式区分）──────── */
const motionOn = async (label, url, sels, { home = false } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await mock(page);
  if (home) {
    await gotoHealthy(page, server.base, '.homepage-mode-card');
  } else {
    await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3200);
  }
  const out = await page.evaluate(list => list.map(sel => {
    const nodes = Array.from(document.querySelectorAll(sel));
    if (!nodes.length) return { sel, count: 0, note: '元素不存在' };
    const s = getComputedStyle(nodes[0]);
    return {
      sel,
      count: nodes.length,
      text: (nodes[0].textContent || '').trim().slice(0, 10),
      dur: s.transitionDuration,
      ease: s.transitionTimingFunction,
      prop: s.transitionProperty,
    };
  }), sels);
  console.log(`\n===== ${label} =====`);
  out.forEach(o => {
    if (!o.count) { console.log(`  ${o.sel} → (${o.note})`); return; }
    console.log(`  ${o.sel} ×${o.count} 「${o.text}」 → dur=${o.dur} ease=${o.ease} prop=${o.prop}`);
  });
  await page.close();
  return out;
};

/* 视频侧：**真的有 chips** 的两条技能（批 CR 缺的就是这一档） */
await motionOn('视频侧 video.content_swap（「换模特/换产品」两颗胶囊 = 知渔 /content-replace 那一档）',
  '/video-creation?id=video.content_swap',
  ['.video-wb-chips', '.video-wb-chips button', '.media-field-segmented button', '.media-field-segmented button.is-active',
    '.media-field-meta-at', '.media-field-meta-expand', '.video-script-trigger', '.video-generate-trigger']);
await motionOn('视频侧 video.light_shift（「比例」五档，知渔 /apps 单图族那一档）',
  '/video-creation?id=video.light_shift',
  ['.video-wb-chips button', '.media-field-segmented button']);

/* 图片侧：同一个共用件（.media-field-segmented / .media-field-meta-*） */
await motionOn('图片侧 image.concept_set（概念静物——图片侧的胶囊档）',
  '/image-creation?id=image.concept_set',
  ['.media-field-segmented button', '.media-field-segmented button.is-active', '.media-field-meta-at',
    '.media-field-meta-expand', '.media-workbench-submit', '.media-workbench-tabs button']);
await motionOn('图片侧 image.product_suite（商品套图）',
  '/image-creation?id=image.product_suite',
  ['.media-field-segmented button', '.media-field-meta-at', '.media-field-meta-expand', '.media-workbench-submit']);

/* ── ② 配置触发按钮这一档：视频侧 .video-config-trigger vs 图片侧 .visual-config-trigger ──
   两侧都在**首页**的创作台里（批 BF 就是照图片侧逐值抄的；BF 的门禁只比了 12 个属性，没比 transition）*/
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await gotoHealthy(page, server.base, '.homepage-mode-card');
  const read = async sel => page.evaluate(sel => {
    const nodes = Array.from(document.querySelectorAll(sel));
    if (!nodes.length) return { sel, count: 0 };
    const s = getComputedStyle(nodes[0]);
    return { sel, count: nodes.length, text: (nodes[0].textContent || '').trim().slice(0, 14), dur: s.transitionDuration, ease: s.transitionTimingFunction, prop: s.transitionProperty };
  }, sel);

  await page.click('.homepage-mode-card.card-1').catch(() => {});
  await page.waitForTimeout(800);
  const vid = await read('.video-config-trigger');
  const vidChevron = await page.evaluate(() => {
    const el = document.querySelector('.video-config-trigger > svg:last-child');
    if (!el) return { count: 0 };
    const s = getComputedStyle(el);
    return { count: 1, dur: s.transitionDuration, ease: s.transitionTimingFunction, prop: s.transitionProperty };
  });

  await page.click('.homepage-mode-card.card-2').catch(() => {});
  await page.waitForTimeout(800);
  const img = await read('.visual-config-trigger');
  const imgChevron = await page.evaluate(() => {
    const el = document.querySelector('.visual-config-trigger-chevron');
    if (!el) return { count: 0 };
    const s = getComputedStyle(el);
    return { count: 1, dur: s.transitionDuration, ease: s.transitionTimingFunction, prop: s.transitionProperty };
  });

  console.log('\n===== ② 配置触发按钮（同一档，两侧都在首页创作台）=====');
  console.log(`  视频侧 .video-config-trigger      ×${vid.count} 「${vid.text}」 → dur=${vid.dur} ease=${vid.ease} prop=${vid.prop}`);
  console.log(`  图片侧 .visual-config-trigger     ×${img.count} 「${img.text}」 → dur=${img.dur} ease=${img.ease} prop=${img.prop}`);
  console.log(`  视频侧 箭头 svg:last-child        ×${vidChevron.count} → dur=${vidChevron.dur} ease=${vidChevron.ease}`);
  console.log(`  图片侧 .visual-config-trigger-chevron ×${imgChevron.count} → dur=${imgChevron.dur} ease=${imgChevron.ease}`);
  await page.close();
}

/* ── ③ 字数上限口径：显示的分母 / 放大弹窗的分母 / 真正能输入的数 ───────────────────────── */
const counterOn = async (label, url, { typeInto = null } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await mock(page);
  await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3200);
  const shown = await page.evaluate(() => {
    const row = document.querySelector('.media-field-meta');
    const count = document.querySelector('.media-field-meta-count');
    const field = document.querySelector('.video-wb-prompt, .mention-prompt-field, textarea.media-field-control');
    const ta = document.querySelector('textarea.media-field-control');
    return {
      metaRow: !!row,
      counterText: count ? (count.textContent || '').trim() : null,
      fieldTag: field ? field.tagName.toLowerCase() : null,
      fieldClass: field ? field.className.slice(0, 60) : null,
      textareaMaxLength: ta ? ta.getAttribute('maxlength') : null,
      fieldLen: field ? (field.value !== undefined ? String(field.value).length : (field.textContent || '').length) : null,
    };
  });
  // 放大弹窗里的分母（同一页第二处上限表达）
  let expanded = null;
  const exp = await page.$('.media-field-meta-expand');
  if (exp) {
    await exp.click().catch(() => {});
    await page.waitForTimeout(400);
    expanded = await page.evaluate(() => {
      const span = document.querySelector('.media-field-expand-body header span');
      return span ? (span.textContent || '').trim() : null;
    });
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('.media-field-expand-close')?.click());
    await page.waitForTimeout(300);
  }
  let capped = null;
  if (typeInto) {
    const sel = '.video-wb-prompt, .mention-prompt-field';
    const ok = await page.evaluate(([sel, n]) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.focus();
      el.textContent = 'x'.repeat(n);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }));
      return true;
    }, [sel, typeInto]);
    await page.waitForTimeout(700);
    capped = await page.evaluate(() => {
      const el = document.querySelector('.video-wb-prompt, .mention-prompt-field');
      const count = document.querySelector('.media-field-meta-count');
      return { typed: el ? (el.textContent || '').length : null, counter: count ? (count.textContent || '').trim() : null };
    });
    if (!ok) capped = { error: '找不到可输入的 contenteditable' };
  }
  console.log(`\n--- ${label} ---`);
  console.log(`  框下方那一行存在？ ${shown.metaRow}；计数显示「${shown.counterText}」`);
  console.log(`  放大弹窗分母：${expanded === null ? '(没有放大按钮/未打开)' : '「' + expanded + '」'}`);
  console.log(`  输入框：${shown.fieldTag}.${shown.fieldClass} textarea[maxlength]=${shown.textareaMaxLength}`);
  if (capped) console.log(`  塞进去 ${typeInto} 个字符 → 框内实际 ${capped.typed}（计数「${capped.counter}」）`);
  await page.close();
};

await counterOn('视频侧 video.smart（脚本块声明 max=10000）', '/video-creation?id=video.smart', { typeInto: 9500 });
await counterOn('视频侧 video.product_motion（补充说明声明 max=2000）', '/video-creation?id=video.product_motion', { typeInto: 3000 });
await counterOn('图片侧 image.product_suite', '/image-creation?id=image.product_suite');

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
