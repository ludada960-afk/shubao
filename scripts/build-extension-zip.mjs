// scripts/build-extension-zip.mjs
// 2026-09-21 「上游泄漏」收尾：插件 zip 打包脚本（此前【没有】脚本，zip 是手工产物且已过期）。
//
// 背景（真实缺陷）：
//   extensions/shubao-extractor.zip 与 public/extensions/shubao-extractor.zip 都是【提交进仓库】的产物，
//   且两者的 popup.js / manifest.json 都指向 http://localhost:3099、http://localhost:5173。
//   public/ 那份会被 vite build 原样拷进 dist/，是【线上用户真正下载到的文件】
//   （EcStudio/index.jsx:596 -> href="/extensions/shubao-extractor.zip"）。
//   后果：用户装完插件，host_permissions 只授权 localhost → 连不上 shuimg.cn，插件完全不可用。
//
// 本脚本把「源码目录 → 两个 zip」变成可复现构建，并在打包前后做一致性校验。
//
// 用法：node scripts/build-extension-zip.mjs            # 打包 + 校验
//       node scripts/build-extension-zip.mjs --check    # 只校验，不写盘（CI 用）
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'extensions', 'shubao-extractor');
const TARGETS = [
  join(ROOT, 'extensions', 'shubao-extractor.zip'),
  join(ROOT, 'public', 'extensions', 'shubao-extractor.zip'),
];
/* 生产域名：单一真相。改域名只改这里。 */
const PRODUCTION_ORIGIN = 'https://shuimg.cn';

/* ── 1. 源码一致性校验：源码目录本身不得残留 localhost ── */
function assertSourceClean() {
  const banned = [/localhost/, /127\.0\.0\.1/, /0\.0\.0\.0/];
  const problems = [];
  for (const name of readdirSync(SRC_DIR)) {
    const full = join(SRC_DIR, name);
    if (!statSync(full).isFile()) continue;
    if (!/\.(js|json|html)$/.test(name)) continue;
    const text = readFileSync(full, 'utf8');
    for (const re of banned) {
      if (re.test(text)) problems.push(name + ' 含 ' + re);
    }
    if (/\.json$/.test(name) && !text.includes(PRODUCTION_ORIGIN)) {
      problems.push(name + ' 未指向 ' + PRODUCTION_ORIGIN);
    }
  }
  if (problems.length) {
    console.error('✗ 源码目录不干净，拒绝打包：');
    problems.forEach(p => console.error('   ' + p));
    process.exit(1);
  }
  console.log('✓ 源码目录干净（无 localhost，manifest 指向 ' + PRODUCTION_ORIGIN + '）');
}

/* ── 2. 最小 ZIP 写入（store 模式，不引依赖） ── */
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}
function buildZip(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);          /* store：不压缩（插件体积小，且避免平台差异） */
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

/* 打包顺序固定，保证可复现 */
const ZIP_ORDER = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'icon16.png', 'icon48.png', 'icon128.png'];

function collectFiles() {
  return ZIP_ORDER.map(name => {
    const full = join(SRC_DIR, name);
    if (!existsSync(full)) throw new Error('缺少源文件：' + name);
    return { name, data: readFileSync(full) };
  });
}

/* ── 3. 读回校验：产物内不得有 localhost，且必须指向生产域名 ── */
function verifyZipBuffer(buf, label) {
  const text = buf.toString('latin1');
  const problems = [];
  if (/localhost/.test(text)) problems.push('产物含 localhost');
  if (!text.includes(PRODUCTION_ORIGIN)) problems.push('产物未包含 ' + PRODUCTION_ORIGIN);
  if (problems.length) {
    console.error('✗ ' + label + ' 校验失败：' + problems.join('；'));
    process.exit(1);
  }
  console.log('✓ ' + label + ' 校验通过（' + buf.length + 'B）');
}

const checkOnly = process.argv.includes('--check');
assertSourceClean();
const files = collectFiles();
const zip = buildZip(files);
verifyZipBuffer(zip, '待写入产物');
if (checkOnly) {
  /* --check：与现有产物逐字节比对，不一致即失败（CI 防呆） */
  let stale = false;
  for (const target of TARGETS) {
    if (!existsSync(target)) { console.error('✗ 缺失产物 ' + relative(ROOT, target)); stale = true; continue; }
    if (!readFileSync(target).equals(zip)) { console.error('✗ 产物过期（与源码不一致）' + relative(ROOT, target)); stale = true; }
  }
  if (stale) process.exit(1);
  console.log('✓ 两个产物均与源码一致');
  process.exit(0);
}
for (const target of TARGETS) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, zip);
  console.log('✓ 已写入 ' + relative(ROOT, target));
}
