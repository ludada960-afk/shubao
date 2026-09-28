/* ═══ 批 CY-③ 探针：底部 CTA（生成预览 / 生成图片 / 生成视频）**左右没有铺满** ═══════════════════
   用户原话（逐字，7 张批注图第 4 条）：
   「你好好看一下现在你这个**生成预览或者生成图片、生成视频的这个按钮**，它**左右两边实际上好像还是
     还是没有覆盖满**。就是我去**滑动它还是能够看到它背后的那个工作台的内容**。还是会被露出来。
     **这个问题已经有让你去解决啦**，你还是没解决掉呀。」
   ⇒ 批 BM 只修了**下边**那条缝（把左栏下内边距归零）；本轮要查的是**左右**。

   量什么（两侧都量）：
   ① CTA 条（图片侧 `.media-workbench-cta` / 视频侧 `.video-toolbar`）的 rect；
   ② 它所在**滚动区**的 rect 与内边距；
   ③ 祖先链（到 3 层）各自的 rect / padding / margin / background / overflow；
   ④ **两侧条带里到底露出什么**：在 CTA 的 y 带上，取左条带与右条带各 3 个 x 采样点，
      用 `elementsFromPoint` 看最上层是谁（排除滚动容器本身与 CTA 自己的祖先）——
      滚到 0 / 中段 / 底 三个位置各测一次。
   用法：node .qa/cy2-cta-edges.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];

const mock = async page => page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  if (/skills/.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [] });
  return json({ ok: true, items: [], draft: null, templates: [] });
});

/* 一次量完：CTA 条 / 滚动区 / 祖先链 / 两侧条带里露出的东西 */
const ANALYZE = (ctaSel, scrollerSel) => `(() => {
  const R = el => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
             right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
  const desc = el => {
    const cls = (el.className && typeof el.className === 'string') ? el.className.split(/\\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const cta = document.querySelector(${JSON.stringify(ctaSel)});
  if (!cta) return { found: false };
  const scroller = document.querySelector(${JSON.stringify(scrollerSel)}) || cta.parentElement;
  const cs = getComputedStyle(cta), ps = getComputedStyle(scroller);
  const chain = [];
  let node = cta.parentElement, depth = 0;
  while (node && depth < 4) {
    const c = getComputedStyle(node);
    chain.push({ el: desc(node), rect: R(node), pad: c.paddingTop + ' ' + c.paddingRight + ' ' + c.paddingBottom + ' ' + c.paddingLeft,
      bg: c.backgroundColor, overflow: c.overflowX + '/' + c.overflowY, box: c.boxSizing });
    node = node.parentElement; depth++;
  }
  return {
    found: true,
    cta: { rect: R(cta), bg: cs.backgroundColor, pad: cs.paddingLeft + ' ' + cs.paddingRight + ' ' + cs.paddingTop + ' ' + cs.paddingBottom,
           margin: cs.marginLeft + ' ' + cs.marginRight, width: cs.width, box: cs.boxSizing },
    scroller: { el: desc(scroller), rect: R(scroller), pad: ps.paddingLeft + ' ' + ps.paddingRight + ' ' + ps.paddingTop + ' ' + ps.paddingBottom,
                bg: ps.backgroundColor, overflowY: ps.overflowY, clientH: scroller.clientHeight, scrollH: scroller.scrollHeight,
                clientW: scroller.clientWidth, scrollW: scroller.scrollWidth, scrollTop: Math.round(scroller.scrollTop) },
    chain,
  };
})()`;

/* 在 CTA 的 y 带上，看左右两条垂直条带里最上层是谁 */
const BAND = (ctaSel, scrollerSel) => `(() => {
  const cta = document.querySelector(${JSON.stringify(ctaSel)});
  const scroller = document.querySelector(${JSON.stringify(scrollerSel)}) || cta.parentElement;
  const cr = cta.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
  const btn = cta.querySelector('button');
  const y = Math.round(cr.top + Math.min(24, cr.height / 2));
  const ctaAncestors = new Set();
  for (let n = cta; n; n = n.parentElement) ctaAncestors.add(n);
  const probe = (x) => {
    const hit = document.elementsFromPoint(x, y).filter(el => !ctaAncestors.has(el));
    const top = hit[0];
    let box = '';
    if (top) { const r = top.getBoundingClientRect(); box = ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']'; }
    return { x, el: top ? (top.tagName.toLowerCase() + '.' + String(top.className || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.')) : null,
             box, text: top ? (top.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 26) : '' };
  };
  const br = btn ? btn.getBoundingClientRect() : null;
  const row = [];
  for (let x = Math.round(sr.left) + 1; x < Math.round(sr.right) - 1; x += 8) row.push(probe(x));
  return {
    y, ctaRect: { left: Math.round(cr.left), right: Math.round(cr.right), top: Math.round(cr.top), bottom: Math.round(cr.bottom) },
    btnRect: br ? { left: Math.round(br.left), right: Math.round(br.right), w: Math.round(br.width) } : null,
    btnText: btn ? (btn.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24) : '',
    scrollerRect: { left: Math.round(sr.left), right: Math.round(sr.right), top: Math.round(sr.top), bottom: Math.round(sr.bottom) },
    leftGap: Math.round(cr.left - sr.left), rightGap: Math.round(sr.right - cr.right), bottomGap: Math.round(sr.bottom - cr.bottom),
    samples: [sr.left + 1, Math.round((sr.left + cr.left) / 2), cr.left - 1, cr.right + 1, Math.round((cr.right + sr.right) / 2), sr.right - 1]
      .filter(x => x >= sr.left && x <= sr.right - 0)
      .map(probe),
    row,
  };
})()`;

const sides = [
  { name: '图片侧 image.product_suite', url: '/image-creation?id=image.product_suite', cta: '.media-workbench-cta', scroller: '.media-workbench-left' },
  { name: '视频侧 video.image_to_video', url: '/video-creation?id=video.image_to_video', cta: '.video-toolbar', scroller: '.video-content-composer.is-workbench' },
  { name: '图片侧 image.copy', url: '/image-creation?id=image.copy', cta: '.media-workbench-cta', scroller: '.media-workbench-left' },
];

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 140)));
await mock(page);
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

for (const side of sides) {
  console.log('\n══════════ ' + side.name + ' ══════════');
  await page.goto(base + side.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(side.cta, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
  const geo = await page.evaluate(ANALYZE(side.cta, side.scroller));
  if (!geo.found) { console.log('  找不到 ' + side.cta); continue; }
  console.log('  CTA   : ' + JSON.stringify(geo.cta));
  console.log('  滚动区: ' + JSON.stringify(geo.scroller));
  geo.chain.forEach((c, i) => console.log('    └' + (i + 1) + ' ' + JSON.stringify(c)));

  /* 滚到 0 / 中段 / 底，各看一次两侧条带 */
  const positions = await page.evaluate((sel) => {
    const s = document.querySelector(sel);
    return s ? [0, Math.round((s.scrollHeight - s.clientHeight) / 2), s.scrollHeight - s.clientHeight] : [0];
  }, side.scroller);
  for (const pos of positions) {
    await page.evaluate(([sel, top]) => { const s = document.querySelector(sel); if (s) s.scrollTop = top; }, [side.scroller, pos]);
    await page.waitForTimeout(250);
    const band = await page.evaluate(BAND(side.cta, side.scroller));
    console.log('  ── scrollTop=' + pos + '  左缝=' + band.leftGap + 'px 右缝=' + band.rightGap + 'px 下缝=' + band.bottomGap + 'px 取样y=' + band.y);
    console.log('     CTA条 x[' + band.ctaRect.left + '..' + band.ctaRect.right + ']  按钮 x[' + (band.btnRect ? band.btnRect.left + '..' + band.btnRect.right : '?') + ']「' + band.btnText + '」');
    for (const s of band.samples) console.log('       x=' + String(s.x).padStart(5) + ' → ' + String(s.el + s.box).padEnd(52) + ' | ' + s.text);
    const distinct = [...new Set(band.row.map(s => s.el + s.box))];
    console.log('     整行取样（每 8px）出现过的元素：' + distinct.slice(0, 12).join(' , '));

    /* ═══ 像素级：把那一条带子截图 → 回灌进浏览器用 canvas 读色 ═══════════════════════════════
       `elementsFromPoint` 只能说明"谁是命中元素"，说不清"**看起来是什么颜色**"。用户说的是
       「左右两边没有覆盖满、滑动时能看到背后工作台的内容」—— 所以直接把 CTA 那条带子截下来，
       沿一条横线逐像素读色，报出**颜色分段**（相邻同色合并），一眼就能看出两侧那两条缝里是白、
       是灰、还是内容。 */
    const shot = await page.screenshot({ clip: { x: band.scrollerRect.left, y: band.ctaRect.top + 6, width: band.scrollerRect.right - band.scrollerRect.left, height: 8 } });
    const runs = await page.evaluate(async (dataUrl) => {
      const img = new Image(); img.src = dataUrl; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 3, img.width, 1).data;
      const out = []; let prev = null;
      for (let x = 0; x < img.width; x++) {
        const key = data[x * 4] + ',' + data[x * 4 + 1] + ',' + data[x * 4 + 2];
        if (key !== prev) { out.push({ from: x, color: key }); prev = key; }
      }
      return out;
    }, 'data:image/png;base64,' + shot.toString('base64'));
    console.log('     像素分段（x 相对左栏左缘）：' + runs.map(r => r.from + ':' + r.color).join('  '));
  }

  /* ═══ 越界扫描：滚动内容里有没有元素**越过内容盒左缘**（图7 那条紫边的成因）═══════════════════
     用户那张图上，被压在底栏下面的「设计风格」行里那颗紫边按钮比按钮本体还往左伸了几个像素 ——
     扫一遍滚动区里所有可见元素的最小左缘，就能把这类"越界元素"点名出来，并核它对 CTA 白底的关系。 */
  await page.evaluate(([sel, top]) => { const s = document.querySelector(sel); if (s) s.scrollTop = top; },
    [side.scroller, await page.evaluate(sel => { const s = document.querySelector(sel); return s ? s.scrollHeight : 0; }, side.scroller)]);
  await page.waitForTimeout(250);
  const overhang = await page.evaluate(([ctaSel, scrollerSel]) => {
    const cta = document.querySelector(ctaSel);
    const scroller = document.querySelector(scrollerSel) || cta.parentElement;
    const sr = scroller.getBoundingClientRect();
    const cs = getComputedStyle(scroller);
    const contentLeft = sr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const out = [];
    scroller.querySelectorAll('*').forEach(el => {
      if (cta.contains(el) || el === cta) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (r.right < sr.top) return;
      if (r.left < contentLeft - 0.5) {
        const c = getComputedStyle(el);
        out.push({ el: el.tagName.toLowerCase() + '.' + String(el.className || '').split(/\s+/).filter(Boolean)[0],
                   left: Math.round(r.left * 10) / 10, over: Math.round((contentLeft - r.left) * 10) / 10,
                   bg: c.backgroundColor, border: c.borderTopColor,
                   text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 14) });
      }
    });
    const cr = cta.getBoundingClientRect();
    return { contentLeft: Math.round(contentLeft), ctaLeft: Math.round(cr.left), ctaRight: Math.round(cr.right),
             culprits: out.slice(0, 6), total: out.length };
  }, [side.cta, side.scroller]);
  console.log('  越界扫描：内容盒左缘 x=' + overhang.contentLeft + '，CTA 白底 x[' + overhang.ctaLeft + '..' + overhang.ctaRight + ']');
  console.log('     越界元素 ' + overhang.total + ' 个' + (overhang.culprits.length ? '（最多列 6 个）' : '') + '：' +
    overhang.culprits.map(c => c.el + ' 左缘' + c.left + '（越 ' + c.over + 'px，底' + c.bg + '，边' + c.border + '）「' + c.text + '」').join('  '));
  console.log('     覆盖判定：' + (overhang.total === 0 ? '无越界元素' :
    (overhang.culprits.every(c => c.left >= overhang.ctaLeft) ? '全部已被 CTA 白底盖住 ✓' : '仍有元素露在白底之外 ✗')));

  /* ═══ A/B 注入实验：证明"越界几像素的彩色元素会被 CTA 白底盖住" ═══════════════════════════════
     图7 那条紫边只有约 4px 宽、50px 高，`getBoundingClientRect` 扫不到它（很可能是描边/阴影一类）。
     所以直接**造一个**：在滚动区里插一根 6px 宽、40px 高的洋红竖条，位置 = 内容盒左缘往外 4px
     （正是他图上那根紫边所在的位置，且不给 z-index —— 与真实元素一样走"普通流"，被 sticky 的 CTA 盖住）。
     然后各取一个像素：**带子内**（被 CTA 盖住的那段）与**带子上方**（露在外面的那段）。
     带内必须是白、带外必须是洋红 —— 这才叫"左右铺满、背后内容盖住了"。 */
  const ab = await page.evaluate(([ctaSel, scrollerSel]) => {
    const cta = document.querySelector(ctaSel);
    const scroller = document.querySelector(scrollerSel) || cta.parentElement;
    /* ⚠️ 坐标系两个坑（第一版就栽在这儿）：
       ① 滚动容器**没有定位** ⇒ 绝对定位的探针会以更远的祖先为参照，插到栏外去了；
          所以临时给它 `position: relative`（用完还原）。
       ② 探针必须插在 CTA **之前**：两者都是"已定位元素"、都没 z-index，层叠顺序按 DOM 先后 ——
          追加到最后会画在 CTA **上面**，那样测的就不是"被盖住"了。 */
    const prevPos = scroller.style.position;
    scroller.style.position = 'relative';
    const sr = scroller.getBoundingClientRect();
    const cs = getComputedStyle(scroller);
    const contentLeft = sr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const cr = cta.getBoundingClientRect();
    const probe = document.createElement('div');
    probe.id = 'cy2-ab-probe';
    /* 竖直：让探针**上沿探出带外 30px**（那一段露在外面，用来证明它真的画出来了），
       下半段压在带子里（那一段必须被 CTA 的白底盖住）。 */
    const topInContent = (cr.top - sr.top) + scroller.scrollTop - 30;
    probe.style.cssText = 'position:absolute;left:' + (contentLeft - sr.left - 4) + 'px;top:' + Math.round(topInContent) +
      'px;width:6px;height:60px;background:rgb(255,0,255)';
    scroller.insertBefore(probe, scroller.firstChild);
    const pr = probe.getBoundingClientRect();
    return { probeLeft: Math.round(pr.left), probeRight: Math.round(pr.right), probeTop: Math.round(pr.top), probeBottom: Math.round(pr.bottom),
             contentLeft: Math.round(contentLeft), prevPos,
             bandTop: Math.round(cr.top), bandBottom: Math.round(cr.bottom),
             inBandY: Math.round(cr.top + 12), aboveY: Math.round(pr.top + 8) };
  }, [side.cta, side.scroller]);
  /* 带子内那一像素：横向裁 12px（含越界竖条与内容盒左缘），纵向取带内 y */
  const inside = await page.screenshot({ clip: { x: ab.probeLeft - 2, y: ab.inBandY, width: 12, height: 1 } });
  const above = await page.screenshot({ clip: { x: ab.probeLeft - 2, y: Math.max(0, ab.aboveY), width: 12, height: 1 } });
  const readRow = async (buf) => page.evaluate(async (dataUrl) => {
    const img = new Image(); img.src = dataUrl; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, 1).data;
    const out = []; for (let x = 0; x < img.width; x++) out.push(d[x * 4] + ',' + d[x * 4 + 1] + ',' + d[x * 4 + 2]);
    return out;
  }, 'data:image/png;base64,' + buf.toString('base64'));
  const inPx = await readRow(inside), abovePx = await readRow(above);
  const hasMagenta = arr => arr.some(v => /^255,0,255$/.test(v));
  console.log('   A/B 注入：洋红竖条 x[' + ab.probeLeft + '..' + ab.probeRight + ']（内容盒左缘 x=' + ab.contentLeft + ' 外 4px）  y[' + ab.probeTop + '..' + ab.probeBottom + ']  带子 y[' + ab.bandTop + '..' + ab.bandBottom + ']');
  console.log('     带内像素 y=' + ab.inBandY + '（应被白底盖住=无洋红）：' + (hasMagenta(inPx) ? '**看到洋红 ✗**' : '看不到洋红 ✓') + '  ' + inPx.join(' '));
  console.log('     带上方像素 y=' + ab.aboveY + '（竖条露在外面=应有洋红）：' + (hasMagenta(abovePx) ? '看到洋红 ✓' : '**没看到洋红 ✗**') + '  ' + abovePx.join(' '));
  await page.evaluate(() => { const el = document.getElementById('cy2-ab-probe'); if (el) el.remove(); });
  await page.evaluate(([sel, pos]) => { const s = document.querySelector(sel); if (s) s.style.position = pos; }, [side.scroller, ab.prevPos || '']);

  /* ═══ 禁用态按钮的**底色均匀性**：用户批注图4 那颗灰按钮左右两半是 245 / 243,242,244 两种灰 ═══
     那是"半透明底色把下层输入框的白底圆角透出来"的证据。修之后（叠一层不透明的卡片底），
     在按钮**贴着上沿的一条横线**上取像素（避开文字），整条必须是**同一个色值**。 */
  const uni = await page.evaluate((ctaSel) => {
    const btn = document.querySelector(ctaSel + ' button');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const c = getComputedStyle(btn);
    return { disabled: btn.disabled, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
             bg: c.backgroundImage.slice(0, 60) + ' | ' + c.backgroundColor, opacity: c.opacity };
  }, side.cta === '.video-toolbar' ? '.video-submit-actions' : side.cta);
  if (uni) {
    const row = await page.screenshot({ clip: { x: uni.x + 2, y: uni.y + 4, width: uni.w - 4, height: 1 } });
    const px = await page.evaluate(async (dataUrl) => {
      const img = new Image(); img.src = dataUrl; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, 1).data;
      const counts = new Map();
      for (let x = 0; x < img.width; x++) { const k = d[x * 4] + ',' + d[x * 4 + 1] + ',' + d[x * 4 + 2]; counts.set(k, (counts.get(k) || 0) + 1); }
      return { tones: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6), total: counts.size, width: img.width };
    }, 'data:image/png;base64,' + row.toString('base64'));
    /* ⚠️ 判据是"**是不是一个平色**"：整条上出现的色值只有相邻的 1~2 档（渲染抖动）就算平色；
       用户批注图4 那种"左右两半 245 与 243,242,244"是**两种明显不同的灰**，那才是内容透出来。
       所以这里报"色值种类数 + 各色占比"，不逐段罗列（381 段没人看）。 */
    console.log('  按钮底色：disabled=' + uni.disabled + '  opacity=' + uni.opacity + '  bg=' + uni.bg);
    console.log('     贴按钮上沿的横线取样（' + px.width + 'px 宽）：色值种类 = ' + px.total +
      '，主色 ' + px.tones.map(t => t[0] + '×' + t[1]).join('  '));
    console.log('     ' + (px.total <= 2 ? '→ 平色 ✓（只有渲染抖动的相邻档）' : '→ **不是平色，检查是否有内容透出 ✗**'));
  }
}

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
