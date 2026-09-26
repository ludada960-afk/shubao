/* 批 BR 诊断（两件事一起量）：
   ① `/image-creation?id=video.try_on`… 实为 image.try_on（AI换装）——**底部 CTA 到底是哪个组件画的**？
      用户截图上它是"窄的居中紫胶囊 + 右边一句『还差：…』"，与我上一版（通栏 + 提示在下 + 人话）不一样。
   ② 视频模型下拉的行序（用户说"又乱了"）——把分组标题与每一行按 DOM 顺序打出来。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';
import { publicVideoProducts } from '../server/videoCatalog.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'probe@example.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') {
    return json({
      loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false,
      uploadMode: 'tus', defaultProductId: 'seedance_standard', products: publicVideoProducts(),
    });
  }
  if (path === '/api/billing/balance') return json({ ok: true, balance: 999, credits: 999, unlimited: false, currency: 'ec_points' });
  return json({ ok: true });
});

/* ── ① AI换装子页：CTA 是谁画的 ── */
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.try_on', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const cta = await page.evaluate(() => {
  const submit = document.querySelector('.media-workbench-submit');
  const legacyButtons = Array.from(document.querySelectorAll('button'))
    .filter(node => /生成图片|生成预览|立即生成/.test(node.textContent || ''))
    .map(node => ({
      text: (node.textContent || '').trim().slice(0, 24),
      cls: String(node.className || '').slice(0, 60),
      w: Math.round(node.getBoundingClientRect().width),
      h: Math.round(node.getBoundingClientRect().height),
      x: Math.round(node.getBoundingClientRect().x),
    }));
  const hints = Array.from(document.querySelectorAll('p, small, span'))
    .filter(node => /还差|请先上传|请先填写/.test((node.textContent || '').trim()) && (node.textContent || '').trim().length < 60)
    .map(node => ({ text: (node.textContent || '').trim().slice(0, 40), cls: String(node.className || '').slice(0, 50) }))
    .slice(0, 4);
  const left = document.querySelector('.media-workbench-left');
  return {
    hasWorkbenchShell: Boolean(document.querySelector('.media-workbench')),
    submit: submit ? { w: Math.round(submit.getBoundingClientRect().width), h: Math.round(submit.getBoundingClientRect().height), disabled: submit.disabled } : null,
    leftContentWidth: left ? Math.round(left.clientWidth) : null,
    buttons: legacyButtons,
    hints,
    hasMediaCta: Boolean(document.querySelector('.media-workbench-cta')),
  };
});
console.log('【AI换装子页】', JSON.stringify(cta, null, 1));

/* ── ② 视频模型下拉的行序 ── */
await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(1200);
await page.click('.video-config-trigger.is-model');
await page.waitForSelector('.video-inline-menu.is-model button', { timeout: 8000 });
await page.waitForTimeout(400);
const menu = await page.evaluate(() => {
  const panel = document.querySelector('.video-inline-menu.is-model');
  const out = [];
  for (const child of panel.children) {
    if (child.classList.contains('video-model-group-label')) out.push('── ' + child.textContent.trim() + ' ──');
    if (child.tagName === 'BUTTON') {
      const b = child.querySelector('b');
      out.push('   ' + (b?.firstChild?.textContent || '').trim() + ' [' + (b?.querySelector('em')?.textContent || '').trim() + ']');
    }
  }
  return out;
});
console.log('【视频模型下拉】\n' + menu.join('\n'));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
