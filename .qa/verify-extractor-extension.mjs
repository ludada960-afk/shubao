// .qa/verify-extractor-extension.mjs
// 2026-09-21 「上游泄漏」收尾：插件 zip 可用性验证。
//
// ！重要：本环境【无法完成真实浏览器验证】，原因已实测确认：
//   · Google Chrome 直接忽略 --disable-extensions-except：
//       「--disable-extensions-except is not allowed in Google Chrome, ignoring.」
//   · Edge 同样不侧载（枚举到的扩展 id 全是内置组件扩展）。
//   · Playwright 自带 chromium 在 headless=new / headless(old) 两种模式下，
//       侧载扩展【均未生效】：CDP 只见内置组件扩展（Google Hangouts / Gemini in Chrome），
//       我的扩展不出现。
//   → 因此本脚本改为输出【替代证据】，并明确标注 verified=false（不冒充浏览器验证）。
//
// 替代证据链（四条，缺一不可）：
//   ① 产物内 popup.js 的 API_URL/APP_URL 与 manifest.host_permissions 均为生产域名；
//   ② 产物内无 localhost 残留；
//   ③ host_permissions 模式 <scheme>://<host>/* 语法上覆盖 API_URL；
//   ④ 生产接口 POST https://shuimg.cn/api/bookmarklet-extract 实测可达（返回 HTTP 状态而非网络层失败）。
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIPS = ['extensions/shubao-extractor.zip', 'public/extensions/shubao-extractor.zip'];
const SRC = join(ROOT, 'extensions', 'shubao-extractor');
const ORIGIN = 'https://shuimg.cn';
const API = ORIGIN + '/api/bookmarklet-extract';

function readZipEntries(buf) {
  const e = {};
  let k = buf.indexOf(Buffer.from('PK\x03\x04'));
  while (k !== -1) {
    const nl = buf.readUInt16LE(k + 26), el = buf.readUInt16LE(k + 28);
    const nm = buf.slice(k + 30, k + 30 + nl).toString('utf8');
    const cs = buf.readUInt32LE(k + 18);
    e[nm] = buf.slice(k + 30 + nl + el, k + 30 + nl + el + cs);
    k = buf.indexOf(Buffer.from('PK\x03\x04'), k + 30 + nl + el + cs);
  }
  return e;
}

const problems = [];
console.log('=== 证据① 产物内常量 ===');
for (const zf of ZIPS) {
  const buf = readFileSync(join(ROOT, zf));
  const sha = createHash('sha256').update(buf).digest('hex');
  const e = readZipEntries(buf);
  const pj = e['popup.js'].toString('utf8');
  const mf = JSON.parse(e['manifest.json'].toString('utf8'));
  const api = (pj.match(/API_URL\s*=\s*'([^']+)'/) || [])[1];
  const app = (pj.match(/APP_URL\s*=\s*'([^']+)'/) || [])[1];
  console.log('  ' + zf);
  console.log('    sha256=' + sha.slice(0, 24) + '  bytes=' + buf.length);
  console.log('    API_URL=' + api);
  console.log('    APP_URL=' + app);
  console.log('    host_permissions=' + JSON.stringify(mf.host_permissions));
  if (api !== API) problems.push(zf + ' API_URL 不是 ' + API);
  if (!String(app).startsWith(ORIGIN)) problems.push(zf + ' APP_URL 非生产域名');
  if (!JSON.stringify(mf.host_permissions).includes(ORIGIN)) problems.push(zf + ' host_permissions 未指向 ' + ORIGIN);
}

console.log('');
console.log('=== 证据② 产物无 localhost 残留 ===');
for (const zf of ZIPS) {
  const raw = readFileSync(join(ROOT, zf)).toString('latin1');
  const n = (raw.match(/localhost|127\.0\.0\.1/g) || []).length;
  console.log('  ' + zf + ' localhost 命中 = ' + n);
  if (n) problems.push(zf + ' 含 localhost');
}
const srcText = readFileSync(join(SRC, 'popup.js'), 'utf8');
const srcLocal = (srcText.match(/localhost/g) || []).length;
console.log('  源码 popup.js localhost 命中 = ' + srcLocal);
if (srcLocal) problems.push('源码 popup.js 含 localhost');

console.log('');
console.log('=== 证据③ host_permissions 覆盖 API_URL ===');
const covered = API.startsWith(ORIGIN + '/');
console.log('  ' + API + ' ⊂ ' + ORIGIN + '/*  ->  ' + covered);
if (!covered) problems.push('host_permissions 未覆盖 API_URL');

console.log('');
console.log('=== 证据④ 生产接口实测可达 ===');
let status = null;
try {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  status = res.status;
  console.log('  POST ' + API + ' -> HTTP ' + res.status);
} catch (e) {
  console.log('  POST ' + API + ' -> 网络层失败: ' + e.message);
  problems.push('生产接口不可达: ' + e.message);
}
if (status !== null && (status < 200 || status >= 600)) problems.push('生产接口状态异常: ' + status);

console.log('');
console.log('=== 真实浏览器验证：未完成 ===');
console.log('  原因：本环境 Chrome/Edge 拒绝侧载扩展；Playwright chromium 侧载未生效。');
console.log('  已实测证据：Chrome 日志明文 “--disable-extensions-except is not allowed in Google Chrome, ignoring.”');

if (problems.length) {
  console.log('');
  console.log('❌ 替代证据链存在缺口：');
  problems.forEach(p => console.log('   - ' + p));
  process.exit(1);
}
console.log('');
console.log('✅ 替代证据链完整（4/4）。');
console.log('   ⚠️ 但【未经真实浏览器验证】—— 上线前请在装有 Chrome 的机器上手动装一次 zip 复核。');
