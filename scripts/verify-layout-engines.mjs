/* ═══ 在**真实 Chromium + 真实 canvas** 里跑一遍版式层的四族拼版 ═══════════════════════════════
   依据：M3 那一批留了一条"这条导出链从没在真实浏览器里跑过"；这一批又加了两个引擎。
   做法：起一个 vite（它会把 /src 按 ESM 直接给浏览器），打开 .qa/layout-harness.html，
   台子里 import 的就是线上那份 conceptLayoutSheet.js —— 跑通即线上那份能跑通。
   断言：四族 + 信息图三种排法都要产出一张**能解码、尺寸与计划一致、体积合理**的 JPEG。
   产物落在 .qa/layout-out/*.jpg（人眼复核用；本脚本只做机制校验）。 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.QA_LAYOUT_PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = '.qa/layout-out';
const MIN_BYTES = 40_000;   /* 一张 3000px 级的 JPEG 小于 40KB 基本就是"几乎空白" */

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const viteLog = [];
const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
vite.stdout.on('data', chunk => viteLog.push(String(chunk)));
vite.stderr.on('data', chunk => viteLog.push(String(chunk)));

const waitReady = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(BASE + '/scripts/layout-harness.html');
      if (response.ok) return true;
    } catch { /* 还没起来 */ }
    await new Promise(resolve => { setTimeout(resolve, 500); });
  }
  return false;
};

const failures = [];
const passed = [];
const check = (ok, label, detail = '') => {
  if (ok) passed.push('✔ ' + label);
  else failures.push('✖ ' + label + (detail ? ' —— ' + detail : ''));
};

let browser = null;
try {
  const ready = await waitReady();
  check(ready, 'vite 起来了', viteLog.slice(-3).join(' | '));
  if (!ready) throw new Error('vite 未就绪');

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.message || error)));
  await page.goto(BASE + '/scripts/layout-harness.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('status')?.textContent === 'done'
    || document.getElementById('status')?.textContent?.startsWith('failed'), null, { timeout: 120000 });

  const results = await page.evaluate(() => globalThis.__LAYOUT_RESULTS__ || []);
  check(results.length >= 6, '六个拼版任务都跑完了', '实得 ' + results.length);
  check(pageErrors.length === 0, '全程没有页面异常', pageErrors.slice(0, 3).join(' | '));

  for (const result of results) {
    if (!result.ok) { check(false, '拼版失败：' + (result.label || result.family), String(result.error)); continue; }
    check(result.decodedWidth === result.planWidth && result.decodedHeight === result.planHeight,
      result.label + '：产出图的尺寸与计划一致（' + result.planWidth + '×' + result.planHeight + '）',
      result.decodedWidth + '×' + result.decodedHeight);
    check(result.type === 'image/jpeg', result.label + '：导出的是 JPEG（可直接上传/下载）', result.type);
    check(result.bytes >= MIN_BYTES, result.label + '：不是一张空白图（体积 ≥ ' + MIN_BYTES + 'B）',
      result.bytes + 'B');
    const base64 = String(result.dataUrl).split(',')[1] || '';
    writeFileSync(join(OUT_DIR, result.label + '.jpg'), Buffer.from(base64, 'base64'));
  }
} catch (error) {
  failures.push('✖ 脚本自身失败：' + (error && error.message || error));
} finally {
  if (browser) await browser.close().catch(() => {});
  /* ⚠️ 只 kill 那个壳进程是不够的：Windows 上 `npx.cmd` 会再起一个 node 子进程，
     它握着 stdout ⇒ 事件循环不退出、脚本"跑完了却不返回"（第一次实测就栽在这，
     .qa/layout-out 里六个文件都写好了，进程却一直挂着）。所以过一遍 taskkill 收干净。 */
  vite.kill();
  if (process.platform === 'win32' && vite.pid) {
    try { spawnSync('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 忽略 */ }
  }
}

console.log(passed.join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  console.error('[layout-engines] 失败：' + failures.length + ' 条');
  process.exit(1);
}
console.log('[layout-engines] 通过：' + passed.length + ' 条断言全绿；产物在 ' + OUT_DIR + '/');
/* 显式退出：vite 是外部子进程，哪怕已经 kill 也可能有一瞬间还挂着句柄 */
process.exit(0);
