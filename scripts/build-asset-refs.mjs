import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const NAME_RE = /[a-f0-9]{64}\.(?:jpg|png|webp)/gi;
const names = new Set();
const walk = dir => {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    let isDir = entry.isDirectory();
    if (!isDir) { try { isDir = statSync(full).isDirectory(); } catch { isDir = false; } }
    if (isDir) { walk(full); continue; }
    if (!/\.(json|js|mjs|cjs|md|html|txt)$/i.test(extname(entry.name))) continue;
    let text = '';
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    const matched = text.match(NAME_RE);
    if (matched) for (const name of matched) names.add(name.toLowerCase());
  }
};

for (const root of ['public', 'src', 'shared']) walk(root);

const header = [
  '# 仓库里**静态引用**到的生成图（案例 JSON / 文档里的示例图等）',
  '# 孤儿清理（scripts/sweep-orphan-assets.mjs --refs-file=…）必须把它们当成"有人用"。',
  '# 为什么要有这份文件：那些案例 JSON 只存在于仓库里，**服务器上没有** ⇒ 服务器侧扫目录看不见它们，',
  '#  而它们在前台是真的会被展示的（灵感发现 / 做同款）。',
  '# 重新生成：node scripts/build-asset-refs.mjs（或删掉本文件后重跑清理脚本的提示）',
  '',
].join('\n');
writeFileSync('scripts/data/gallery-asset-refs.txt', header + [...names].sort().join('\n') + '\n', 'utf8');
console.log('refs=' + names.size);
