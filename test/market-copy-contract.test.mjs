import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sources = [
  '../src/components/business/Modals.jsx',
  '../src/pages/Pricing/index.jsx',
  '../src/components/task/TaskSidebar.jsx',
  '../src/pages/EcCanvas/index.jsx',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

test('market copy exposes no rollout or privileged-account language', () => {
  assert.doesNotMatch(sources, /内测|白名单|无限额度|已开通访问权限|本地开发模式/);
});

test('pricing exposes exactly the two product currencies', () => {
  const pricing = readFileSync(new URL('../src/pages/Pricing/index.jsx', import.meta.url), 'utf8');
  assert.match(pricing, /小红书\s*\/\s*Plog\s*[· ]\s*创作套数/);
  assert.match(pricing, /电商图片\s*\/\s*画布\s*AI\s*积分/);
  assert.doesNotMatch(pricing, /永久\s*AI\s*积分包/);
});
