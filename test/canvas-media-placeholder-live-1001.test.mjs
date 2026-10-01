// test/canvas-media-placeholder-live-1001.test.mjs
// 2026-10-01（批 CY-㊴ 之十五的补做）
//
// 踩坑经过：本地草稿不再存 base64 之后，刷新会让「当时还没传完」的节点没有任何地址，
// 需要一句人话而不是裂图。我把占位加在了 `index.jsx` 的 `ImageNode` 里 ——
// 而那个组件在 index.jsx 里**一次都没被用到**（真正渲染的是
// `CanvasStudio.jsx` 的 `CanvasImageNode`，被 import 成 `StudioImageNode`）。
//
// 结果：构建绿、单测全绿、代码看着都对，但那句文案**连构建产物都没进去**。
// 是靠「在 dist 里 grep 中文却找不到」发现的 —— 静态门禁全都被绕过了。
//
// 所以本文件守的是**「占位必须落在真正渲染的那个组件里」**这件事本身。
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const page = read('src/pages/EcCanvas/index.jsx');

const PLACEHOLDER = '这张素材当时没传完';

test('① 占位文案必须落在真正渲染图片的组件（CanvasImageNode）里', () => {
  assert.ok(studio.includes(PLACEHOLDER),
    '占位文案必须在 CanvasStudio.jsx 的 CanvasImageNode 里 —— 那是真正渲染图片的组件');
  assert.match(studio, /!mediaSrcBase && \(\s*<div className="ec-canvas-media-failed"/,
    '没有地址时必须显示占位，而不是渲染 <img src="">');
  assert.match(studio, /!imgFailed && mediaSrcBase && <ResponsiveImage/,
    '有地址时才渲染图片');
  assert.match(studio, /const mediaSrcBase = node\.localPreviewUrl \|\| node\.url \|\| '';/,
    '必须能区分「有没有地址」，不能只看拼了 retry 参数后的 mediaSrc');
});

test('② 占位文案必须真的进了构建产物（防"代码写了但没上线"）', () => {
  /* ⚠️ dist 不存在时**跳过**（precommit 会先 build）；但**绝不能**因为读不到
     就假装通过 —— 上一版这里误用了 ESM 里没有的 require，抛错被 catch 吞掉，
     于是这条判据一直是"绿的"，等于没有。这正是它要防的那类假绿。 */
  const assetsDir = new URL('../dist/assets/', import.meta.url);
  if (!existsSync(assetsDir)) {
    console.log('    （dist 尚未构建，本条跳过；precommit 会在 build 之后跑）');
    return;
  }
  const bundles = readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  assert.ok(bundles.length > 0, 'dist/assets 里没有 js —— 产物不对');
  /* ⚠️ 这里必须带 '../'：import.meta.url 指向 **test/** 目录，
     直接 new URL('dist/assets/x.js', import.meta.url) 会解析成 test/dist/... → ENOENT。
     而 ENOENT 又会被当成"构建产物不对"，把真正的判据掩盖掉。 */
  const all = bundles
    .map(f => readFileSync(new URL('../dist/assets/' + f, import.meta.url), 'utf8'))
    .join('\n');
  assert.ok(all.includes(PLACEHOLDER),
    '构建产物里找不到占位文案 —— 说明它被写进了**没被渲染的组件**'
    + '（如 index.jsx 那个一次都没用到的 ImageNode），或被 tree-shake 掉了');
});

test('③ index.jsx 里的 ImageNode 确实没被用到（记录这个事实，别再加错地方）', () => {
  /* 如果哪天它真的被用起来了，这条会失败 —— 那时占位需要同时存在于两处，
     或者（更好）把这个死组件删掉。 */
  const uses = (page.match(/<ImageNode[\s/>]/g) || []).length;
  const aliasUses = (page.match(/<StudioImageNode/g) || []).length;
  assert.equal(uses, 0,
    'index.jsx 里的 ImageNode 突然被用起来了 —— 占位需要补到它上面（它没有）');
  assert.ok(aliasUses > 0,
    '真正渲染图片的是 StudioImageNode（= CanvasImageNode），不是 index.jsx 里的 ImageNode');
});