import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('fresh ecommerce editor does not automatically restore or persist account-level form drafts', async () => {
  const source = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const home = await readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /loadDraftSnapshot\(/);
  assert.doesNotMatch(source, /loadDraftFiles\(/);
  assert.doesNotMatch(source, /saveDraftSnapshot\(/);
  assert.doesNotMatch(source, /saveDraftFiles\(/);
  assert.match(home, /clearLegacyEcommerceDraftState\(\)/);
});

test('direction confirmation keeps the current in-memory editor mounted for back navigation', async () => {
  const home = await readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');

  /* 2026-10-01（批 CY-㊴ 之二十二）：DesignDirection 与 EcMode / XhsContentMode 一样只在
     mode==='ecommerce' 时渲染，所以改成了 lazy —— 外面因此多了一层 <Suspense>。
     这三条判据守的是"**返回时不卸载编辑器**"这个实质（ecStep===2 的条件、返回入口、
     工作台的隐藏样式），所以只把"紧接着就是组件"放宽成"组件在 Suspense 里"。
     ⚠️ 不能直接删掉这条判据 —— 那正是它要防的回归。 */
  assert.match(home, /ecStep === 2\s*&&\s*\(\s*<Suspense[\s\S]{0,200}?<DesignDirection/);
  assert.match(home, /ecStep !== 2\s*&&\s*<div[\s\S]*homepage-mode-showcase/);
  assert.match(home, /isVideo\s*\?\s*<VideoStudioPage[\s\S]{0,900}isXHS\s*\?\s*<Suspense[\s\S]{0,200}?<XhsContentMode[\s\S]{0,900}!isVisual\s*\?\s*\(\s*<Suspense[\s\S]{0,200}?<EcMode/);
  assert.match(home, /display:\s*ecStep === 2\s*\?\s*['"]none['"]\s*:\s*undefined/);
  /* 懒加载必须都有 fallback，否则切过去时没有兜底会报错（之二十一的白屏教训）。
     ⚠️ fallback 里是 `<ModeLoading … />` 这种自闭合写法，所以要匹配到 `}` 而不是 `>`。 */
  for (const name of ['DesignDirection', 'XhsContentMode', 'EcMode']) {
    assert.match(home, new RegExp('<Suspense fallback=\\{<ModeLoading[^}]*\\}>\\s*<' + name),
      name + ' 的 Suspense 必须有 ModeLoading 占位');
  }
});

test('content editors do not automatically restore or continuously persist prior form inputs', async () => {
  const [xhs, plog] = await Promise.all([
    readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Plog/index.jsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(xhs, /loadContentDraft\(/);
  assert.doesNotMatch(xhs, /saveContentDraft\(/);
  assert.doesNotMatch(plog, /loadContentDraft\(/);
  assert.doesNotMatch(plog, /saveContentDraft\(/);
});
