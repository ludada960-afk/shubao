#!/usr/bin/env node
/**
 * 薯包AI · 构建后检查脚本
 *
 * 构建完成后运行，验证 dist/ 产物完整性：
 * 1. index.html 存在且引用了 bundle
 * 2. 引用的 JS/CSS 文件在 dist 中实际存在
 *
 * 用法: node scripts/check-build.mjs
 * 退出码: 0 = 通过, 1 = 有错误
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '..', 'dist');

let errors = 0;

try {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

  // 提取所有引用的 assets
  const assetRe = /(?:src|href)="\/assets\/([^"]+)"/g;
  let m;
  let found = 0;
  while ((m = assetRe.exec(html)) !== null) {
    found++;
    const assetPath = path.join(dist, 'assets', m[1]);
    if (!fs.existsSync(assetPath)) {
      console.error(`  ❌ dist/assets/${m[1]} 不存在`);
      errors++;
    }
  }

  if (found === 0) {
    console.error('  ❌ index.html 中未找到任何 asset 引用');
    errors++;
  } else {
    console.log(`  ✅ ${found} 个 asset 引用全部存在`);
  }

} catch (e) {
  console.error(`  ❌ dist/index.html 不存在或无法读取: ${e.message}`);
  errors++;
}

const result = errors === 0 ? '✅ 构建后检查通过' : `❌ 发现 ${errors} 个问题`;
console.log(`\n${result}\n`);
process.exit(errors > 0 ? 1 : 0);
