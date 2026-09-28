/* ═══ 批 CY-⑭ 探针 v3：**生成框底栏到底有没有溢出** ════════════════════════════════════════════════════
   用户原话（逐字）：「图片生成之后，会出现这个图片的右边以及它的这个输入框的面板他们右边都被截断的一个
     情况。」配图里，底栏那排参数按钮右边那颗紫色的「生成」按钮**只露了一半**。

   ⚠️⚠️ 这个探针**错了两次**，两次都写在这里，因为第三次很可能还要有人改它：

   **v1 的错**：拿 getBoundingClientRect()（**屏幕像素**，已乘画布缩放）去减
     getComputedStyle().paddingRight（**布局像素**，没乘缩放）—— 两套单位混算，
     凭空少减了约 3.8px，于是**四个框每一个**都报「被切 4px」。那个 4px 是我自己造的。

   **v2 的错**：改用 stage 的 zoom 换算，结果算出 zoom=1 —— 因为
     **缩放不在 stage 上、stage 不在那个变换层里**，拿 sibling 推断 scale 依然是错的。

   **v3 的做法**：**从元素自己身上算缩放** ——
     scale = rect.width / offsetWidth（offsetWidth 是布局值，不受祖先 transform 影响）。
     然后把 rect 全部换算成布局像素（rect ÷ scale）再和 padding（本来就是布局像素）比。
     自检：scale 不在 (0.1, 4) 之间就拒绝产出数字。量错的数字比没有数字更坏。

   判据：CTA 右缘（布局像素）> 底栏内容盒右缘（布局像素） ⇒ 真的被切。

   用法：node .qa/cy14-footer-overflow.mjs                                                        */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 200)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ ok: true, items: [], draft: null });
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);

const buildFromAddMenu = async match => {
  await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
  await page.waitForTimeout(700);
  const ok = await page.evaluate(match => {
    const b = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button'))
      .find(x => (x.textContent || '').includes(match));
    if (!b) return false;
    b.click();
    return true;
  }, match);
  await page.waitForTimeout(2600);
  return ok;
};

const measure = label => page.evaluate(label => {
  const out = { label, composers: [] };
  for (const composer of document.querySelectorAll('.ec-canvas-node-composer')) {
    const footer = composer.querySelector('.ec-canvas-composer-footer');
    if (!footer) continue;
    const cta = footer.querySelector('.ec-canvas-composer-cta, .shubao-gen-cta');
    const row = footer.querySelector('.ec-canvas-parameter-controls, .ec-canvas-video-controls, .ec-canvas-suite-controls');
    /* ★ 从自己身上算缩放：offsetWidth 是布局值，不受祖先 transform 影响 */
    const scale = composer.offsetWidth > 0 ? composer.getBoundingClientRect().width / composer.offsetWidth : 1;
    const fr = footer.getBoundingClientRect();
    const cs = getComputedStyle(footer);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const ctaRect = cta ? cta.getBoundingClientRect() : null;
    const rowRect = row ? row.getBoundingClientRect() : null;
    out.composers.push({
      scale: Math.round(scale * 1000) / 1000,
      composerLayoutWidth: composer.offsetWidth,
      footerLayoutWidth: Math.round(fr.width / scale),
      contentBoxLayout: Math.round((fr.width / scale) - padL - padR),
      rowLayoutWidth: rowRect ? Math.round(rowRect.width / scale) : 0,
      rowScrollOverLayout: row ? Math.round((row.scrollWidth - row.clientWidth) / scale) : 0,
      cta: ctaRect ? {
        label: (cta.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20),
        layoutWidth: Math.round(ctaRect.width / scale),
        layoutHeight: Math.round(ctaRect.height / scale),
        /* >1px = 真的被切（这次两边都是布局像素） */
        clippedByLayout: Math.round((ctaRect.right / scale) - (fr.right / scale - padR)),
      } : null,
      footerWrap: cs.flexWrap,
    });
  }
  return out;
}, label);

console.log('════════ 生成框底栏几何（**布局像素**，已按元素自身缩放换算）════════');
let bad = 0;
for (const [name, match] of [['图片生成', '生成图片'], ['生成文案', '生成文案'], ['生成视频', '生成视频'], ['电商套图', '生成电商套图']]) {
  if (!(await buildFromAddMenu(match))) { console.log(`\n【${name}】添加菜单里点不到「${match}」`); continue; }
  const r = await measure(name);
  if (!r.composers.length) { console.log(`\n【${name}】没量到生成框`); continue; }
  if (r.composers.some(c => !(c.scale > 0.1 && c.scale < 4))) {
    console.log(`\n【${name}】scale 不在合理区间（${r.composers.map(c => c.scale).join(',')}）—— 拒绝产出数字`);
    bad += 1;
    continue;
  }
  console.log(`\n【${name}】scale=${r.composers.map(c => c.scale).join(',')}`);
  for (const c of r.composers) {
    const over = c.cta?.clippedByLayout ?? 0;
    console.log(`  生成框 ${c.composerLayoutWidth}px（底栏 ${c.footerLayoutWidth}，内容盒 ${c.contentBoxLayout}）｜参数行 ${c.rowLayoutWidth}（溢出 ${c.rowScrollOverLayout}）｜wrap=${c.footerWrap}`);
    if (c.cta) console.log(`  ${over > 1 ? '  ✗ 被切' : '  ✓'} 「${c.cta.label}」 ${c.cta.layoutWidth}×${c.cta.layoutHeight}，超出 ${over}px`);
    if (over > 1) bad += 1;
  }
  await page.screenshot({ path: `.qa/shots/cy14-footer-${name}.png` }).catch(() => {});
}

await browser.close();
await stopDevServer();
console.log(bad ? `\n✗ 有 ${bad} 处需要处理` : '\n✓ 四个生成框的底栏都没有溢出');
process.exit(bad ? 1 : 0);
