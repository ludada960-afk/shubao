/* ══════════════════════════════════════════════════════════════════════════════════════════════
   批 BQ · Hallmark 全站体检（可量化那几条，实机跑）
   依据：hallmark/references/anti-patterns.md 的命名反模式 + slop-test 里**可机械判定**的闸门：
     · gate 34 移动端横向溢出（320/375/414/768 四档）
     · gate 49 可点文字折成两行
     · 点击区 ≥44px（站内既有判据）
     · focus-visible 可见环（点击元素）
     · gate 38a 斜体标题
     · transition: all（微交互反模式）
     · 表情符当图标 / 发明数字（文案扫描）
   输出按 severity 分组的 punch list（不改代码 —— 这正是 audit 的交付物）。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';

const out = '.tmp/bq';
mkdirSync(out, { recursive: true });
const PAGES = [
  { key: 'home', url: '/' },
  { key: 'image-hub', url: '/image-creation' },
  { key: 'image-suite', url: '/image-creation?id=image.product_suite' },
  { key: 'video-hub', url: '/video-creation' },
  { key: 'video-smart', url: '/video-creation?id=video.smart' },
  { key: 'canvas', url: '/ec-canvas' },
  { key: 'pricing', url: '/pricing' },
];
const WIDTHS = [320, 375, 414, 768, 1440];

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'audit@example.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/billing/balance') return json({ ok: true, balance: 999, credits: 999, unlimited: false, currency: 'ec_points' });
  return json({ ok: true });
});

const findings = [];
const add = (severity, tell, where, fix) => findings.push({ severity, tell, where, fix });

for (const entry of PAGES) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.base.replace(/\/$/, '') + entry.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(width === 1440 ? 1600 : 900);
    const probe = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = Math.max(0, doc.scrollWidth - doc.clientWidth);
      const wideNodes = [];
      if (overflowX > 1) {
        for (const node of document.querySelectorAll('body *')) {
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.right > doc.clientWidth + 1 && rect.left < doc.clientWidth) {
            wideNodes.push({ tag: node.tagName, cls: String(node.className || '').slice(0, 60), right: Math.round(rect.right) });
            if (wideNodes.length >= 4) break;
          }
        }
      }
      const controls = Array.from(document.querySelectorAll('button, [role="button"]'));
      const clickables = Array.from(document.querySelectorAll('button, a[href], [role="button"]')).filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const smallTargets = controls
        .filter(node => { const rect = node.getBoundingClientRect(); return rect.height > 0 && (rect.height < 32 || rect.width < 32); })
        .map(node => ({ text: (node.textContent || '').trim().slice(0, 18), h: Math.round(node.getBoundingClientRect().height) }))
        .slice(0, 6);
      /* ⚠️ 判据必须是「**文字自己**折了几行」：用 Range 量文本节点的矩形数 ——
         按"按钮高度"判会把"图标 + 文字上下排列"的正常按钮全误报（左侧导航、模式卡都是那样）。 */
      /* ⚠️ 只量**直接子文本节点**：卡片里的"标题 + 描述"本来就该多行，
         把它们算成"可点文字折行"会把整个技能库都误报（上一版就是这样）。 */
      const wrappedTextLines = node => {
        let lines = 0;
        for (const child of node.childNodes) {
          if (child.nodeType !== 3) continue;      // 只看直接子文本
          const text = (child.textContent || '').trim();
          if (text.length < 2) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          lines = Math.max(lines, range.getClientRects().length);
        }
        return lines;
      };
      const twoLine = clickables
        .filter(node => {
          const text = (node.textContent || '').trim();
          if (text.length < 4 || text.length > 40) return false;
          /* 卡片（内部还有标题/段落）不算 —— 门 49 治的是"按钮标签折行" */
          if (node.querySelector('h1,h2,h3,h4,p,li,span[class*="title"]')) return false;
          return wrappedTextLines(node) > 1;
        })
        .map(node => ({ text: (node.textContent || '').trim().slice(0, 24), w: Math.round(node.getBoundingClientRect().width) }))
        .slice(0, 6);
      const italicHeads = Array.from(document.querySelectorAll('h1, h2, h3, .hero-gradient-text'))
        .filter(node => getComputedStyle(node).fontStyle === 'italic')
        .map(node => (node.textContent || '').trim().slice(0, 20));
      const transitionAll = Array.from(document.querySelectorAll('body *'))
        .filter(node => {
          const cs = getComputedStyle(node);
          return cs.transitionProperty === 'all' && parseFloat(cs.transitionDuration) > 0;
        })
        .map(node => String(node.className || node.tagName).slice(0, 50))
        .slice(0, 6);
      const emojiIcons = Array.from(document.querySelectorAll('button, a[href], h1, h2, h3, li'))
        .map(node => (node.textContent || '').trim())
        .filter(text => /[\u{1F300}-\u{1FAFF}\u{2728}\u{1F525}]/u.test(text))
        .slice(0, 5);
      const gradientHead = Boolean(document.querySelector('.hero-gradient-text, h1[class*="gradient"]'));
      return { overflowX, wideNodes, smallTargets, twoLine, italicHeads, transitionAll, emojiIcons, gradientHead };
    });

    if (probe.overflowX > 1) {
      add('critical', 'gate 34 移动端横向溢出', `${entry.key} @${width}px · 溢出 ${probe.overflowX}px · ${JSON.stringify(probe.wideNodes)}`, '把超宽元素改成 max-width:100% / minmax(0,1fr)');
    }
    if (probe.twoLine.length) {
      add('major', 'gate 49 可点文字折成两行', `${entry.key} @${width}px · ${JSON.stringify(probe.twoLine)}`, '缩短文案或 nowrap');
    }
    if (probe.smallTargets.length) {
      add('minor', '点击区 <32px', `${entry.key} @${width}px · ${JSON.stringify(probe.smallTargets)}`, '提到 ≥32（主控件 ≥44）');
    }
    if (probe.italicHeads.length) {
      add('major', 'gate 38a 斜体标题', `${entry.key} @${width}px · ${JSON.stringify(probe.italicHeads)}`, '字体改 roman，强调用字重/颜色');
    }
    if (probe.transitionAll.length) {
      add('minor', 'transition: all（微交互反模式）', `${entry.key} @${width}px · ${JSON.stringify(probe.transitionAll)}`, '只过渡 transform/opacity/background-color');
    }
    if (probe.emojiIcons.length) {
      add('minor', '表情符当图标', `${entry.key} @${width}px · ${JSON.stringify(probe.emojiIcons)}`, '换 lucide 线性图标');
    }
    if (entry.key === 'home' && width === 1440 && probe.gradientHead) {
      add('critical', 'hallmark「渐变标题」', `${entry.key} · h1 里有 .hero-gradient-text`, '品牌既有选择 —— **报给用户定**，不擅自改');
    }
  }
}

/* 文案扫描（发明数字 / 占位名）—— 只在源码层做，页面渲染看不到的也算 */
const summary = findings.reduce((acc, item) => {
  acc[item.severity] = (acc[item.severity] || 0) + 1;
  return acc;
}, {});
const report = { summary, findings };
writeFileSync(out + '/hallmark-audit.json', JSON.stringify(report, null, 1));
console.log('critical', summary.critical || 0, '· major', summary.major || 0, '· minor', summary.minor || 0);
for (const item of findings.slice(0, 24)) console.log(`[${item.severity}] ${item.tell} — ${item.where}`);

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
