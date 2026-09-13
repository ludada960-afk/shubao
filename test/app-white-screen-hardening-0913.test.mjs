// test/app-white-screen-hardening-0913.test.mjs
// 2026-09-13 用户两次反馈「网站打不开」。线上实测：origin 200、nginx 零 5xx、Cloudflare 200、
// 真实浏览器加载零报错 —— 用户侧看到的「打不开」大概率是**白屏**：
//   ① 浏览器持旧 HTML（启发式缓存），它引用的 chunk 已被新 release 替换；
//   ② 网络抖动导致 chunk 加载失败。
// 修法：chunk 加载失败自动硬刷新一次 + 根错误边界兜底页（不再一片白，用户能自救）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const main = read('src/main.jsx');
const server = read('server/index.mjs');

test('chunk 加载失败会自动重载一次（防白屏），且带防死循环节流', () => {
  assert.match(main, /addEventListener\('vite:preloadError'/, '必须监听 Vite 的 preloadError');
  assert.match(main, /tagName === 'SCRIPT'/, '入口 script 加载失败也要兜底');
  assert.match(main, /recoverFromChunkFailure\(\)/, '统一走恢复函数');
  assert.match(main, /reload\(\)/, '恢复动作 = 重新加载');
  assert.match(main, /CHUNK_RELOAD_KEY/, '需要记录重载时间');
  assert.match(main, /< 15_000/, '15 秒内只自动重载一次，避免死循环');
});

test('根错误边界兜底：渲染崩了给「重新加载」而不是白屏', () => {
  assert.match(main, /class RootErrorBoundary extends React\.Component/);
  assert.match(main, /static getDerivedStateFromError\(\)/);
  assert.match(main, /<RootErrorBoundary>[\s\S]*?<App \/>/, 'App 必须包在错误边界里');
  assert.match(main, /页面没能加载成功/, '面向用户的兜底文案');
  assert.match(main, /重新加载/, '给用户自救按钮');
  /* 技术细节只进控制台，不能出现在用户界面 */
  assert.match(main, /console\.error\('\[app\] 页面渲染失败/);
  assert.doesNotMatch(main, /componentStack[\s\S]{0,80}<div/, '不要把堆栈渲染到页面上');
});

test('启动期 TDZ 修复：白名单服务必须在 retention sweep 之前建好', () => {
  /* 原 bug：isProtectedOwner 闭包在启动 sweep 时立刻被调用，而 worksRetentionService 定义在后面
     → 每次启动都报 "Cannot access 'worksRetentionService' before initialization"（部署日志可见）。 */
  const workspace = server.indexOf('const worksRetentionService');
  const retention = server.indexOf('const retentionService = createRetentionService');
  const sweep = server.indexOf('retentionService.sweep();');
  assert.ok(workspace > 0 && retention > 0 && sweep > 0);
  assert.ok(workspace < retention, 'worksRetentionService 必须先于 retentionService 定义');
  assert.ok(retention < sweep, 'retentionService 必须先于启动 sweep');
});
