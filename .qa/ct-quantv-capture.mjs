/* 批 CT 第一步（只读）：把知渔视频侧 32 个子页面的**几何与控件**重新实测一遍。
   ⚠️ 只读浏览：绝不点「立即生成」等付费动作（本脚本只读 DOM 文本与 rect）。
   产出：docs/design/data/quantv-video-pages-live.json（与 2026-09-20 那份 panelText 实采同形，
        但额外记录：面板 rect / 每个字段与控件的 rect / 字号 / 行距 / CTA rect / 右侧栏宽）。
   用法：node .qa/ct-quantv-capture.mjs [只跑前 N 页]  */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { QUANTV_VIDEO_PAGES } from '../src/skills/quantvVideoParity.js';

const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 999;
const src = QUANTV_VIDEO_PAGES;
console.log('待采页面 = ' + src.length);

mkdirSync('.tmp/ct', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1932, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const out = [];
let index = 0;
for (const url of src) {
  index += 1;
  if (index > limit) break;
  const rec = { url, ok: false };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4500);
    rec.title = (await page.title()).slice(0, 60);
    rec.bodyText = (await page.evaluate(() => (document.body.innerText || '').trim())).slice(0, 2500);
    rec.rects = await page.evaluate(() => {
      const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      /* 面板 = 页面中间那一列（知渔工作台左栏）。取法：找 x 在 200~900 之间、宽度 > 300 的固定容器，
         与 2026-09-20 版 panelRect 同一口径（那个版本实测 x=250 y=12 w=1786 h=1001 → 1932 视口）。 */
      const all = Array.from(document.querySelectorAll('div,section,form,main,aside'));
      const pick = all.map(el => ({ el, r: R(el) })).filter(o => o.r.w > 300 && o.r.h > 300 && o.r.x < 900);
      pick.sort((a, b) => b.r.w * b.r.h - a.r.w * a.r.h);
      const panel = pick[0] ? pick[0].r : null;
      /* 控件：按钮与输入框（含它们的字号/内边距）—— 这是"尺寸/间距/控件对表"的原料 */
      const controls = Array.from(document.querySelectorAll('button,[role="button"],input,textarea,[contenteditable="true"],label'))
        .map(el => {
          const r = R(el);
          if (r.w < 8 || r.h < 8) return null;
          const cs = getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            t: (el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
            r,
            font: Math.round(parseFloat(cs.fontSize)) + '/' + cs.fontWeight,
            pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
            radius: Math.round(parseFloat(cs.borderTopLeftRadius) || 0),
            bg: cs.backgroundColor,
            border: cs.borderTopWidth + ' ' + cs.borderTopColor,
          };
        }).filter(Boolean);
      /* 文本块（字段标题那一层）：字号/颜色/行高 + rect —— 用来对"标题 14.672/500"这类规格 */
      const texts = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,small,span,p'))
        .map(el => {
          if (el.children.length) return null;
          const t = (el.innerText || '').trim();
          if (!t || t.length > 40) return null;
          const r = R(el);
          if (r.w < 4 || r.h < 4) return null;
          const cs = getComputedStyle(el);
          return { t, r, font: Math.round(parseFloat(cs.fontSize) * 100) / 100 + '/' + cs.fontWeight, color: cs.color, lh: cs.lineHeight };
        }).filter(Boolean).slice(0, 120);
      return { panel, controls, texts, vw: window.innerWidth, vh: window.innerHeight };
    });
    rec.ok = true;
    console.log(`[${index}/${src.length}] ok  ${url}  控件 ${rec.rects.controls.length} / 文本 ${rec.rects.texts.length}`);
  } catch (error) {
    rec.error = String(error?.message || error).slice(0, 200);
    console.log(`[${index}/${src.length}] 失败 ${url} → ${rec.error}`);
  }
  out.push(rec);
  const slug = url.replace(/[^a-z0-9]/gi, '_').slice(-40);
  writeFileSync('.tmp/ct/raw-' + slug + '.json', JSON.stringify(rec, null, 1));
}
writeFileSync('docs/design/data/quantv-video-pages-live.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'laoyu.quantv.com 视频侧逐页几何实采（Playwright，1932×1080，只读）', pages: out }, null, 1));
console.log('已写 docs/design/data/quantv-video-pages-live.json，成功 ' + out.filter(r => r.ok).length + ' / ' + out.length);
await browser.close();
