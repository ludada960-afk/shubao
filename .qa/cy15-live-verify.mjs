// 批 CY-⑮ 线上复验：① 静态产物不再累积 ② 本批修的标记都在 ③ 站点健康
const fs = require('fs');
const path = require('path');
const ROOT = '/var/www/shubao/current';
const ASSETS = path.join(ROOT, 'assets');
const count = (h, n) => h.split(n).length - 1;
const out = [];

out.push('release: ' + fs.realpathSync(ROOT));
const js = fs.readdirSync(ASSETS).filter(n => n.endsWith('.js'));
const css = fs.readdirSync(ASSETS).filter(n => n.endsWith('.css'));
out.push(`assets: js=${js.length}  css=${css.length}   ← 一次干净构建应该是 30 来个`);

const newest = Math.max(...fs.readdirSync(ASSETS).map(n => fs.statSync(path.join(ASSETS, n)).mtimeMs));
out.push('最新文件写入: ' + Math.round((Date.now() - newest) / 60000) + ' 分钟前');
const oldest = Math.min(...fs.readdirSync(ASSETS).map(n => fs.statSync(path.join(ASSETS, n)).mtimeMs));
out.push('最老文件写入: ' + Math.round((Date.now() - oldest) / 60000) + ' 分钟前' + ((Date.now() - oldest) > 3600e3 ? '  ← 仍有历史残留' : '  ← 只剩本次的，好'));

// release 目录数
const rels = fs.readdirSync('/var/www/shubao/releases').filter(n => fs.statSync(path.join('/var/www/shubao/releases', n)).isDirectory());
out.push('release 目录数: ' + rels.length + ' → ' + rels.join(', '));

// 暂存 dist（部署脚本会重新解包生成）
out.push('暂存 dist: ' + (fs.existsSync('/home/ubuntu/shubao/dist/assets')
  ? fs.readdirSync('/home/ubuntu/shubao/dist/assets').filter(n => n.endsWith('.js')).length + ' 个 js'
  : '（无）'));

out.push('');
out.push('── 本批修的标记（应 ≥1）──');
const entryCss = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/assets\/[^"]+\.css/) || [])[0];
const cssText = fs.readFileSync(path.join(ROOT, entryCss), 'utf8');
const recent = js.filter(n => (Date.now() - fs.statSync(path.join(ASSETS, n)).mtimeMs) < 30 * 60 * 1000);
out.push('本次部署新写的 js: ' + recent.length + ' 个');
const allJs = recent.map(n => fs.readFileSync(path.join(ASSETS, n), 'utf8')).join('\n');
for (const k of ['下载这张图片', '导出这套图片', '没能存进']) {
  out.push('  ' + k.padEnd(20) + ' x' + count(allJs, k));
}
out.push('');
out.push('── 站点 ──');
fs.writeFileSync('/tmp/cy15-live.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
