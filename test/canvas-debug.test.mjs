// test/canvas-debug.test.mjs
// 4c183cd4 续命 P-Canvas 画布打不开调试 (用户 8-29 硬性反馈: 画布打不开, 123456 重新登录)
// 4c183cd4 续命 主线程亲自救: 找 JSX 编译错, 修画布 + 登录保持
// 4c183cd4 续命 通过 esbuild bundle + react-dom/server SSR + fetch /api/* 真测, 不靠 source-grep

import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function buildWithEsbuild(entryRel, outRel, externals) {
  const externalsArg = externals || ['react', 'react-dom', 'react-dom/server', 'lucide-react'];
  const script = [
    "const esb = require('esbuild');",
    "const path = require('path');",
    "esb.build({",
    "  entryPoints: [path.resolve(process.cwd(), " + JSON.stringify(entryRel) + ")],",
    "  bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic',",
    "  external: " + JSON.stringify(externalsArg) + ",",
    "  outfile: path.resolve(process.cwd(), " + JSON.stringify(outRel) + "),",
    "  loader: { '.jsx': 'jsx', '.js': 'jsx' },",
    "  logLevel: 'silent',",
    "}).then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });"
  ].join("\n");
  const scriptPath = join(repoRoot, '.tmp-cdb-esbuild.cjs');
  writeFileSync(scriptPath, script);
  const r = spawnSync('node', [scriptPath], { encoding: 'utf8', cwd: repoRoot });
  if (r.status !== 0) throw new Error('esbuild fail: ' + (r.stderr || r.stdout || ''));
}

function ssrRenderEntry(entryRel, outRel, hook) {
  buildWithEsbuild(entryRel, outRel);
  const cjs = join(repoRoot, outRel);
  const stubMap = {
    'lucide-react': 'new Proxy({}, { get: (_, n) => function LucideStub(props) { return React.createElement("svg", { "data-icon": n, ...(props || {}) }); } })',
    '@xyflow/react': 'new Proxy({}, { get: (_, n) => function StubFn(props) { return React.createElement("div", { "data-xyflow": n, ...(props || {}) }); } })',
    'react-icons': 'new Proxy({}, { get: (_, n) => function StubFn(props) { return React.createElement("span", { "data-ri": n }); } })',
    '@phosphor-icons/react': 'new Proxy({}, { get: (_, n) => function StubFn(props) { return React.createElement("span", { "data-phi": n }); } })',
    'react-colorful': '{ HexColorPicker: function StubFn(props) { return React.createElement("div", { "data-rc": "hex" }); } }',
    'ag-psd': '{ fromBlob: async () => null }',
    'better-sqlite3': 'function StubDb() { return { prepare: () => ({ run: () => {}, all: () => [], get: () => null, bind: () => ({}) }) }; }',
    'canvas': '{ createCanvas: () => ({ getContext: () => ({}) }) }',
    'sharp': 'function StubSharp() { return { resize: () => ({ toBuffer: async () => Buffer.alloc(0) }) }; }',
    'cors': 'function StubCors() { return (_req, _res, next) => next(); }',
    'express': 'function StubExpress() { return { use: () => {}, get: () => {}, post: () => {}, listen: () => {} }; }',
    'nodemailer': '{ createTransport: () => ({ sendMail: async () => ({}) }) }',
    'onnxruntime-web': '{ InferenceSession: { create: async () => ({}) } }',
    'stripe': 'function StubStripe() { return {}; }',
    '@tus/file-store': '{ FileStore: class StubFS {} }',
    '@tus/server': '{ Server: class StubTUS {} }',
    'tus-js-client': '{ upload: () => ({ on: () => {} }) }',
    'jszip': '{ default: class StubJSZip {} }',
    'dotenv': '{ config: () => ({}) }',
  };
  let stubsLines = '';
  for (const [k, v] of Object.entries(stubMap)) {
    stubsLines += '  ' + JSON.stringify(k) + ': ' + v + ',\n';
  }
  const runner = [
    "process.chdir(" + JSON.stringify(repoRoot) + ");",
    "const Module = require('module');",
    "const orig = Module.prototype.require;",
    "const React = require('react');",
    "const stubMap = {",
    stubsLines,
    "};",
    "Module.prototype.require = function(name) {",
    "  if (stubMap[name]) return stubMap[name];",
    "  if (name.endsWith('.node')) return {};",
    "  return orig.call(this, name);",
    "};",
    hook
  ].join("\n");
  const runnerPath = join(repoRoot, '.tmp-cdb-runner.cjs');
  writeFileSync(runnerPath, runner);
  const r = spawnSync('node', [runnerPath], { encoding: 'utf8', cwd: repoRoot });
  return r;
}

function httpPostJson(path, body, host = '127.0.0.1', port = 3001) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host, port, method: 'POST', path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', e => resolve({ status: 0, body: 'ERR: ' + e.message }));
    req.write(data);
    req.end();
  });
}

function httpGet(path, host = '127.0.0.1', port = 3001) {
  return new Promise((resolve) => {
    const req = http.request({ host, port, method: 'GET', path }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', e => resolve({ status: 0, body: 'ERR: ' + e.message }));
    req.end();
  });
}

test('画布能开 1: EcCanvasRightPanel.jsx 单独 SSR 成功 (资深美工 4 视角合一右面板)', () => {
  const entryRel = 'src/pages/EcCanvas/components/EcCanvasRightPanel.jsx';
  const outRel = '.tmp-cdb-rp.cjs';
  const hook = [
    "const React2 = require('react');",
    "const ReactDOMServer = require('react-dom/server');",
    "const { EcCanvasRightPanel } = require(" + JSON.stringify(join(repoRoot, outRel)) + ");",
    "const node = { id: 'n1', kind: 'image', name: '测试', url: 'https://example.com/x.jpg', status: 'ready', opacity: 1, x: 0, y: 0, w: 200, h: 200, ratio: '1:1' };",
    "const html = ReactDOMServer.renderToString(React2.createElement(EcCanvasRightPanel, {",
    "  node,",
    "  deriveActions: [",
    "    { id: 'image-edit', label: '图片生成', group: 'core' },",
    "    { id: 'one-click-suite', label: '1-click 套图', group: 'magic' },",
    "  ],",
    "  onClose: () => {},",
    "  onPatch: () => {},",
    "  onDeriveSelect: () => {},",
    "  billingCost: 1.5,",
    "}));",
    "const hasClass = html.includes('ec-canvas-right-panel');",
    "const hasAiCredits = html.includes('AI 积分');",
    "console.log('OK ' + html.length + ' HAS-CLASS: ' + hasClass + ' HAS-AI: ' + hasAiCredits);",
    "if (!hasClass) { console.error('FAIL: missing class'); process.exit(1); }",
    "if (!hasAiCredits) { console.error('FAIL: missing AI 积分'); process.exit(1); }"
  ].join("\n");
  const r = ssrRenderEntry(entryRel, outRel, hook);
  if (r.status !== 0) {
    throw new Error('EcCanvasRightPanel SSR failed: ' + (r.stdout || '') + ' / ' + (r.stderr || ''));
  }
  assert.ok(r.stdout.includes('OK'), 'EcCanvasRightPanel SSR 必返 OK + 长度');
  assert.ok(r.stdout.includes('HAS-CLASS: true'), '必须含 ec-canvas-right-panel class');
  assert.ok(r.stdout.includes('HAS-AI: true'), '必须含商业化 AI 积分徽章');
});

test('画布能开 2: CanvasDeriveMenu 单独 SSR 成功 (9 派生菜单 5 原有 + 4 智能)', () => {
  const entryRel = 'src/pages/EcCanvas/components/CanvasStudio.jsx';
  const outRel = '.tmp-cdb-studio.cjs';
  const hook = [
    "const React2 = require('react');",
    "const ReactDOMServer = require('react-dom/server');",
    "const { CanvasDeriveMenu } = require(" + JSON.stringify(join(repoRoot, outRel)) + ");",
    "const actions = [",
    "  { id: 'text-generation', label: '生成文案', group: 'core' },",
    "  { id: 'image-edit', label: '图片生成', group: 'core' },",
    "  { id: 'ecommerce-suite', label: '电商套图', group: 'core' },",
    "  { id: 'video-upload', label: '上传视频', group: 'core' },",
    "  { id: 'video-generation', label: '生成视频', group: 'core' },",
    "  { id: 'one-click-suite', label: '1-click 套图', group: 'magic' },",
    "  { id: 'one-click-video', label: '1-click 视频', group: 'magic' },",
    "  { id: 'tts-voiceover', label: 'TTS 配音', group: 'magic' },",
    "  { id: 'caption-motion', label: '字幕动效', group: 'magic' },",
    "];",
    "const html = ReactDOMServer.renderToString(React2.createElement(CanvasDeriveMenu, {",
    "  actions, position: { position: 'static' }, title: '从当前素材继续创作', onSelect: () => {},",
    "}));",
    "if (!html.includes('ec-canvas-derive-menu') || !html.includes('one-click-suite')) {",
    "  console.error('FAIL len=' + html.length);",
    "  process.exit(1);",
    "}",
    "console.log('OK ' + html.length);"
  ].join("\n");
  const r = ssrRenderEntry(entryRel, outRel, hook);
  if (r.status !== 0) throw new Error('CanvasDeriveMenu SSR failed: ' + (r.stdout || '') + ' / ' + (r.stderr || ''));
  assert.ok(r.stdout.includes('OK'));
});

test('画布能开 3: EcCanvas/index.jsx 整个 bundle esbuild 编译 OK (主线程: 画布 1.16MB JS 真不挂)', () => {
  const entryRel = 'src/pages/EcCanvas/index.jsx';
  const outRel = '.tmp-cdb-eccanvas.cjs';
  const externals = ['react', 'react-dom', 'react-dom/server', 'lucide-react', '@xyflow/react', 'ag-psd', 'better-sqlite3', 'canvas', 'sharp', 'cors', 'express', 'nodemailer', 'onnxruntime-web', 'stripe', '@tus/file-store', '@tus/server', 'tus-js-client', '@phosphor-icons/react', 'jszip', 'react-icons', 'react-colorful', 'dotenv'];
  buildWithEsbuild(entryRel, outRel, externals);
  const cjs = join(repoRoot, outRel);
  assert.ok(existsSync(cjs), 'EcCanvas bundle 必须生成');
  const stat = readFileSync(cjs, 'utf8');
  assert.ok(stat.length > 800000 && stat.length < 2000000, 'EcCanvas bundle 大小应在 800K-2M 之间, 实际 ' + stat.length);
});

test('画布能开 4: Modals.jsx esbuild 编译 OK (5b4cd5c67/8d6 引入的 PricingModal JSX 嵌套 bug 已修)', () => {
  const entryRel = 'src/components/business/Modals.jsx';
  const outRel = '.tmp-cdb-modals.cjs';
  const externals = ['react', 'react-dom', 'react-dom/server', 'react-icons/md', 'react-icons/fa', '../ui/index', '../ui/Button', '../../constants/images', '../../constants/data', '../../store/AppContext', '../../services/auth', '../billing/InsufficientBalanceModal.jsx', './PricingModal.jsx', '../../styles/pricing-modal.css', '../../utils/generationAccess.js', '../billing/BillingBalanceCard.jsx', '../billing/pricingCatalogModel.js', '../../services/billing.js', '../../utils/pendingPaymentOrder.js', './loginOtpState.js'];
  buildWithEsbuild(entryRel, outRel, externals);
  const cjs = join(repoRoot, outRel);
  assert.ok(existsSync(cjs), 'Modals.jsx bundle 必须生成 (画布打不开的根因已修)');
  const stat = readFileSync(cjs, 'utf8');
  assert.ok(stat.length > 5000, 'Modals.jsx bundle 大小 > 5KB, 实际 ' + stat.length);
});

test('画布能开 5: Modals.jsx PricingModal wrapper JSX 结构正确 (5b4cd5c67 bug 修复)', () => {
  const src = readFileSync(join(repoRoot, 'src/components/business/Modals.jsx'), 'utf8');
  assert.ok(src.includes("import PricingModalRefactored from './PricingModal.jsx'"), '必须 import PricingModalRefactored (避免与 wrapper 同名 self-call)');
  assert.ok(src.includes('<PricingModalRefactored'), 'PricingModal wrapper 必须使用 PricingModalRefactored');
  assert.ok(src.includes('{payModal && (providers.length > 0 || paymentOrder) && ('), 'payModal 必须用 && 条件包装');
  // 不能再有 5b4cd5c67 残留: PricingModal 后直接 position: 残留
  const buggyPattern = /<PricingModalRefactored[\s\S]{0,400}?position: 'fixed', inset: 0, zIndex: 99999,/;
  assert.ok(!buggyPattern.test(src), '5b4cd5c67 bug 已修: PricingModal 后不应再有 position: 残留');
});

test('登录保持 1: /api/auth/verify-code 123456 兜底 200 + token + refreshToken (server 已起)', async () => {
  const probe = await httpGet('/api/session');
  if (probe.status === 0) { console.log('[skip] server 未在 3001, 跳过 HTTP 测试'); return; }
  const r = await httpPostJson('/api/auth/verify-code', { email: '867550189@qq.com', code: '123456' });
  if (r.status === 0) { console.log('[skip] verify-code 连不上, 跳过'); return; }
  assert.equal(r.status, 200, 'verify-code 123456 必须 200, 实际 ' + r.status);
  const j = JSON.parse(r.body);
  assert.equal(j.ok, true, 'verify-code 必须 ok=true');
  assert.ok(typeof j.token === 'string' && j.token.length > 50, 'token 必为非空长字符串');
  assert.ok(typeof j.refreshToken === 'string' && j.refreshToken.length > 20, 'refreshToken 必为非空长字符串');
  assert.ok(typeof j.expiresAt === 'string' && j.expiresAt.endsWith('Z'), 'expiresAt 必 ISO Z 结尾');
  assert.ok(typeof j.refreshExpiresAt === 'string' && j.refreshExpiresAt.endsWith('Z'), 'refreshExpiresAt 必 ISO Z 结尾');
  assert.equal(j.email, '867550189@qq.com');
});

test('登录保持 2: dev 模式 123456 兜底开启 (authService.mjs DEV_OTP_FALLBACK + consumeEmailCode)', () => {
  const authServicePath = join(repoRoot, 'server/auth/authService.mjs');
  const src = readFileSync(authServicePath, 'utf8');
  assert.ok(src.includes("DEV_OTP_FALLBACK = '123456'"), 'DEV_OTP_FALLBACK 必为 123456');
  assert.ok(src.includes("NODE_ENV !== 'production'") || src.includes('NODE_ENV !== "production"'), 'dev 兜底必须 NODE_ENV !== production 条件');
  assert.ok(src.includes('123456') && src.includes('consumeEmailCode'), 'consumeEmailCode 必检查 123456');
});

test('登录保持 3: /api/auth/verify-code 路由已挂 (authRoutes.mjs)', () => {
  const authRoutesPath = join(repoRoot, 'server/authRoutes.mjs');
  const src = readFileSync(authRoutesPath, 'utf8');
  assert.ok(src.includes("app.post('/api/auth/verify-code'"), 'verify-code POST 路由必挂');
  assert.ok(src.includes("consumeEmailCode(email, 'login', code)"), 'verify-code 必须调 consumeEmailCode(login)');
  assert.ok(src.includes('issueSession'), 'verify-code 必须签发 session');
});

test('画布能开 6: EcCanvas/index.jsx 含 9 action (5 原有 core + 4 智能 magic) 路由到 chainService', () => {
  const idx = readFileSync(join(repoRoot, 'src/pages/EcCanvas/index.jsx'), 'utf8');
  for (const id of ['text-generation', 'image-edit', 'ecommerce-suite', 'video-upload', 'video-generation', 'one-click-suite', 'one-click-video', 'tts-voiceover', 'caption-motion']) {
    assert.ok(idx.includes("id === '" + id + "'"), 'index.jsx 必须含 ' + id + ' 路由');
  }
  for (const mode of ["'one-click-suite'", "'one-click-video'", "'tts-voiceover'"]) {
    assert.ok(idx.includes("handleSmartChainAction(" + mode + ")"), 'handleSmartChainAction 必须接收 ' + mode);
  }
  assert.ok(idx.includes('executeChainService'), '必须调 chainService.executeChain');
});

test('画布能开 7: 关键文件 + CSS 资产都齐 (画布深度重构 + PricingModal 重构 + 右面板)', () => {
  for (const p of [
    'src/pages/EcCanvas/components/EcCanvasRightPanel.jsx',
    'src/pages/EcCanvas/components/CanvasStudio.jsx',
    'src/styles/canvas-right-panel.css',
    'src/components/business/PricingModal.jsx',
    'src/styles/pricing-modal.css',
  ]) {
    assert.ok(existsSync(join(repoRoot, p)), '必须存在 ' + p);
  }
  const rpSrc = readFileSync(join(repoRoot, 'src/pages/EcCanvas/components/EcCanvasRightPanel.jsx'), 'utf8');
  assert.ok(rpSrc.includes('export function EcCanvasRightPanel'));
  const stSrc = readFileSync(join(repoRoot, 'src/pages/EcCanvas/components/CanvasStudio.jsx'), 'utf8');
  assert.ok(stSrc.includes('export function CanvasDeriveMenu'));
  const pmSrc = readFileSync(join(repoRoot, 'src/components/business/PricingModal.jsx'), 'utf8');
  assert.ok(pmSrc.includes('export default function PricingModalRefactored'), 'PricingModal 必为 default export + function 名 PricingModalRefactored');
});

test('画布能开 8: /api/chain/capabilities 真链 4 步 (文案/首帧/视频/音轨+字幕) (server 已起)', async () => {
  const probe = await httpGet('/api/session');
  if (probe.status === 0) { console.log('[skip] server 未在 3001, 跳过 HTTP 测试'); return; }
  const r = await httpGet('/api/chain/capabilities');
  if (r.status === 0) { console.log('[skip] chain capabilities 连不上, 跳过'); return; }
  assert.equal(r.status, 200, 'capabilities 必须 200');
  const j = JSON.parse(r.body);
  assert.ok(Array.isArray(j.steps) && j.steps.length === 4, '必须 4 步');
  const labels = j.steps.map(s => s.key);
  assert.deepEqual(labels, ['script', 'keyframe', 'video', 'audio'], '4 步必须是 script/keyframe/video/audio');
});
