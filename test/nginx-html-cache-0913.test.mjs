// test/nginx-html-cache-0913.test.mjs
// 2026-09-13 生产事故（用户：站点打不开了）：
//   静态资源 1 年 immutable 缓存，但 index.html 没有任何缓存头 → 浏览器启发式缓存旧 HTML，
//   部署后旧 HTML 指向已被替换的 chunk → 页面直接打不开（白屏/加载失败）。
//   修法：HTML 走 no-cache 协商缓存；hashed 资源保持长缓存。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conf = readFileSync(new URL('../scripts/nginx/shuimg.cn.conf', import.meta.url), 'utf8');

test('index.html 不允许被缓存住（强制协商缓存）', () => {
  const block = conf.match(/location = \/index\.html \{([\s\S]*?)\n    \}/);
  assert.ok(block, '存在 index.html 专属 location');
  assert.match(block[1], /Cache-Control "no-cache, must-revalidate"/, 'HTML 必须协商缓存');
});

test('SPA 回退路径同样不允许启发式缓存', () => {
  const root = conf.match(/location \/ \{([\s\S]*?)\n    \}/);
  assert.ok(root, '存在根 location');
  assert.match(root[1], /Cache-Control "no-cache, must-revalidate"/, '回退也要 no-cache');
  assert.match(root[1], /try_files \$uri \$uri\/ \/index\.html/, 'SPA 回退保留');
});

test('hashed 静态资源仍然长缓存（immutable）', () => {
  const assets = conf.match(/location ~\* \\\.\(js\|css[^{]*\{([\s\S]*?)\n    \}/);
  assert.ok(assets, '资源 location 存在');
  assert.match(assets[1], /expires 1y/, '保持 1 年');
  assert.match(assets[1], /Cache-Control "public, immutable"/, '保持 immutable');
});
