#!/usr/bin/env node
/**
 * 薯包AI · 导出校验脚本
 *
 * 在 vite build 前运行，检查 src/services/api.js 的所有 export 是否完整。
 * 防止「函数被误删 → build 成功 → 运行时白屏」的 bug 类。
 *
 * 用法: node scripts/verify-exports.mjs
 * 退出码: 0 = 通过, 1 = 有错误
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_PATH = path.join(ROOT, 'src', 'services', 'api.js');

// ── 1. 解析 api.js 的所有 export 名 ──
function parseExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const exports = new Set();

  // export async function name
  const funcRe = /export\s+(async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = funcRe.exec(content)) !== null) exports.add(m[2]);

  // export function name
  // export const name = ...
  const constRe = /export\s+(const|let|var)\s+(\w+)/g;
  while ((m = constRe.exec(content)) !== null) exports.add(m[2]);

  // export { name1, name2, name3 }
  const namedRe = /export\s+\{([^}]+)\}/g;
  while ((m = namedRe.exec(content)) !== null) {
    m[1].split(',').forEach(s => {
      const name = s.trim().split(/\s+as\s+/).pop().trim();
      if (name) exports.add(name);
    });
  }

  // export { name as alias } — handled by the above

  // export default name
  const defaultRe = /export\s+default\s+(\w+)/g;
  while ((m = defaultRe.exec(content)) !== null) exports.add(`default:${m[1]}`);

  return exports;
}

// ── 2. 扫描 src/ 下所有从 api.js 的 import ──
function scanImports(rootDir) {
  const imports = new Map(); // name → Set<file>

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(jsx?|mjs)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8');
        // Match: import { X, Y as Z } from '../../services/api'
        const re = /import\s+\{([^}]+)\}\s+from\s+['"].*services\/api['"]/g;
        let m;
        while ((m = re.exec(content)) !== null) {
          m[1].split(',').forEach(s => {
            const parts = s.trim().split(/\s+as\s+/);
            const localName = parts[0].trim();
            if (localName) {
              if (!imports.has(localName)) imports.set(localName, new Set());
              imports.get(localName).add(path.relative(ROOT, full));
            }
          });
        }
      }
    }
  }
  walk(rootDir);
  return imports;
}

// ── 3. 执行校验 ──
console.log('\n🔍 薯包AI 导出校验');
console.log('━'.repeat(50));

const exports = parseExports(API_PATH);
console.log(`📦 api.js 导出了 ${exports.size} 个符号`);

// 跳过 default 导出检查，只检查 named exports
const namedExports = new Set([...exports].filter(x => !x.startsWith('default:')));

const imports = scanImports(path.join(ROOT, 'src'));
console.log(`📥 从 api.js 导入了 ${imports.size} 个不同的符号 (${[...imports.values()].reduce((s, f) => s + f.size, 0)} 处引用)\n`);

let errors = 0;
for (const [name, files] of imports) {
  if (!namedExports.has(name) && !exports.has(`default:${name}`)) {
    console.error(`  ❌ "${name}" 被导入但 api.js 未导出:`);
    for (const file of files) {
      console.error(`       ${file}`);
    }
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n❌ 发现 ${errors} 个缺失的导出！请检查上述符号是否存在或被误删。\n`);
  process.exit(1);
} else {
  console.log(`  ✅ 所有 ${imports.size} 个导入符号均存在于 api.js 中\n`);
  process.exit(0);
}
