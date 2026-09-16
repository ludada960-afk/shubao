#!/usr/bin/env node
// scripts/render-smoke.mjs —— 真实渲染冒烟（提交与上线前的最后一道关）
// ═══════════════════════════════════════════════════════════════════════════
// 为什么存在：2026-09-16 线上白屏事故。
//   现象：shuimg.cn 整页落到错误边界，用户看到「页面出了点问题」。
//   根因：SkillLibraryModal 的 useLayoutEffect 依赖数组写成 [open, kind, editing]，
//         而 const editing 声明在**效果之后** —— 依赖数组在渲染期求值，
//         React 抛 ReferenceError: Cannot access 'editing' before initialization（TDZ）。
//   为什么没被拦住：当时的「上线验证」只核对了 HTTP 200、release 符号链接、资源哈希逐字一致，
//         **没有真正用浏览器渲染过页面**。构建绿、单测绿、哈希一致，而页面是白的。
//   本脚本补的就是这一环：把产物真正渲染一遍，看有没有运行时异常与错误边界。
//
// 用法：
//   node scripts/render-smoke.mjs                 # 冒烟 dist/（先 npm run build）
//   node scripts/render-smoke.mjs --dist dist --port 4188
//   node scripts/render-smoke.mjs --path / --path /index.html
// 退出码：0 = 通过；1 = 有运行时异常 / 错误边界 / 首屏空白。
// ═══════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
function argValues(name) {
  const out = [];
  args.forEach((value, index) => { if (value === name && args[index + 1]) out.push(args[index + 1]); });
  return out;
}

const distDir = resolve(argValue('--dist', 'dist'));
const port = Number(argValue('--port', '4188'));
const paths = argValues('--path').length ? argValues('--path') : ['/'];
/* 错误边界在页面上打出来的原话（见 src 里的 ErrorBoundary 文案） */
const ERROR_BOUNDARY_TEXTS = ['页面出了点问题', '发生了一个意外错误'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function fileOrNull(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? path : null;
  } catch { return null; }
}

function startStaticServer(root) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const rawPath = decodeURIComponent(url.pathname);
    const safePath = normalize(rawPath).replace(/^([/\\])+/, '');
    const candidate = join(root, safePath);
    if (!candidate.startsWith(root)) { response.writeHead(403).end('forbidden'); return; }
    let file = await fileOrNull(candidate);
    if (!file && !extname(safePath)) file = await fileOrNull(join(root, 'index.html'));
    if (!file) { response.writeHead(404).end('not found'); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  });
  return new Promise((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolvePromise(server));
  });
}

const failures = [];
let browser = null;
try {
  const indexFile = await fileOrNull(join(distDir, 'index.html'));
  if (!indexFile) {
    console.error(`[render-smoke] 找不到 ${join(distDir, 'index.html')} —— 先跑 npm run build`);
    process.exit(1);
  }
  const { chromium } = await import('playwright');
  const server = await startStaticServer(distDir);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(String(error?.message || error)));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    /* 后端接口在冒烟环境不可用（没有 server 进程），这类网络报错不算前端崩溃 */
    if (/Failed to load resource|ERR_|net::/i.test(text)) return;
    runtimeErrors.push(text);
  });

  for (const path of paths) {
    runtimeErrors.length = 0;
    await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);
    const body = await page.evaluate(() => document.body?.innerText || '');
    const title = await page.title();
    const boundary = ERROR_BOUNDARY_TEXTS.find(text => body.includes(text));
    if (boundary) failures.push(`${path} 落到错误边界：「${boundary}」`);
    if (!body.trim()) failures.push(`${path} 首屏空白（body 无文本）`);
    if (runtimeErrors.length) failures.push(`${path} 运行时异常：${runtimeErrors.slice(0, 3).join(' | ')}`);
    console.log(`[render-smoke] ${failures.length ? '✖' : '✔'} ${path} — 渲染文本 ${body.trim().length} 字，标题「${title}」`);
  }
  await server.close();
} catch (error) {
  failures.push(`冒烟脚本自身失败：${error?.message || error}`);
} finally {
  await browser?.close().catch(() => {});
}

if (failures.length) {
  console.error('[render-smoke] 失败：');
  for (const line of failures) console.error('  - ' + line);
  process.exit(1);
}
console.log('[render-smoke] 通过：产物能真实渲染，无运行时异常、无错误边界、首屏有内容。');
