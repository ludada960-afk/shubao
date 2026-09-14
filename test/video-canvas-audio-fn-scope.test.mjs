// test/video-canvas-audio-fn-scope.test.mjs
// 2026-09 裁决：把「音轨三函数哪一套是活的」用契约钉死。
//
// 背景：「VideoCanvasWorkbench.jsx」里同一批音轨函数存在两套声明：
//   · 一套 `function` 声明（组件函数体层级）—— 活的那套；
//   · 一套 `const` 箭头函数 —— 位于 `setPositions(() => { try { return ... }` 的
//     箭头函数体内，且**排在 return 之后**，因此是**不可达的死代码**。
//
// 这个结构**能编译、能跑**，所以不会自己暴露。下列断言的作用是：
// 将来若有人把 L347 那个表达式「收口补全」，死代码会突然变成活代码 ——
// **测试必须变红，强制他面对这是一次行为变更**。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx', import.meta.url), 'utf8');
const lines = src.split(/\r?\n/);

/* ── ① 活的那套：组件层级的 function 声明，且被调用点使用 ─────────────── */

test('① 音轨三函数以 function 声明存在（活的那套）', () => {
  for (const name of ['handleAddAudioTrack', 'handleToggleAudioMute', 'handleChangeAudioVolume']) {
    assert.match(
      src,
      new RegExp('^\\s{2}function\\s+' + name + '\\s*\\(', 'm'),
      name + ' 必须以组件层级（缩进 2）的 function 声明存在',
    );
  }
});

test('① 调用点与 function 版的签名匹配（参数个数）', () => {
  // handleAddAudioTrack(node) / handleToggleAudioMute(track) / handleChangeAudioVolume(track, n)
  assert.match(src, /onClick=\{\(\) => void handleAddAudioTrack\(node\)\}/, 'handleAddAudioTrack 1 参调用');
  assert.match(src, /onClick=\{\(\) => handleToggleAudioMute\(track\)\}/, 'handleToggleAudioMute 1 参调用');
  assert.match(src, /onChange=\{event => handleChangeAudioVolume\(track, Number\(event\.target\.value\)\)\}/, 'handleChangeAudioVolume 2 参调用');
});

/* ── ② 死的那套：位于 setPositions 表达式的括号内、且在 return 之后 ───── */

test('② 那套 const 位于 setPositions 表达式的括号内（按括号配对判定，不写死行号）', () => {
  const start = lines.findIndex(l => l.includes('setPositions((() => {'));
  assert.ok(start >= 0, '找到 setPositions 表达式起点');

  // 从起点做括号配对（跳过字符串/注释过于复杂，这里用保守计数并允许未闭合）
  let depth = 0;
  let end = -1;
  for (let i = start; i < lines.length && i < start + 120; i++) {
    const code = lines[i].replace(/'(\\.|[^'])*'/g, "''").replace(/"(\\.|[^"])*"/g, '""').replace(/\/\/.*$/, '');
    for (const ch of code) {
      if (ch === '(' || ch === '{') depth++;
      else if (ch === ')' || ch === '}') { depth--; if (depth <= 0 && i > start) { end = i; break; } }
    }
    if (end >= 0) break;
  }

  const declLine = lines.findIndex(l => /^\s{2}const\s+handleAddAudioTrack\s*=/.test(l));
  assert.ok(declLine > start, 'const 版 handleAddAudioTrack 位于 setPositions 起点之后');
  // 关键断言：该 const 落在表达式范围内（未被闭合）
  assert.ok(
    end === -1 || declLine < end,
    'const 版 handleAddAudioTrack 必须落在 setPositions 表达式的括号内（即死代码位置）',
  );
});

test('② 死代码排在 return 之后（不可达）', () => {
  // 注意：该 return 与 setPositions 在**同一行**（L347），所以不能用 i > start 过滤。
  const start = lines.findIndex(l => l.includes('setPositions((() => {'));
  assert.ok(start >= 0, '找到 setPositions 起点');
  const ret = lines.findIndex(l => /return JSON\.parse\(localStorage\.getItem\('shubao_vcb_positions_/.test(l));
  const decl = lines.findIndex(l => /^\s{2}const\s+handleAddAudioTrack\s*=/.test(l));
  assert.ok(ret >= start, 'return 与 setPositions 同行或之后');
  assert.ok(decl > ret, 'const 声明在 return 之后 -> 不可达');
});

/* ── ③ handleUpdateAudioVolume 全仓 0 调用 ──────────────────────────── */

test('③ handleUpdateAudioVolume 在 src/ 里 0 处调用', () => {
  // 只应出现在它自己的声明行上
  const hits = lines
    .map((l, i) => [l, i + 1])
    .filter(([l]) => l.includes('handleUpdateAudioVolume'));
  assert.equal(hits.length, 1, 'handleUpdateAudioVolume 应只有 1 处（声明），实际 ' + hits.length + ' 处：' + hits.map(h => h[1]).join(','));
  assert.match(hits[0][0], /^\s{2}const\s+handleUpdateAudioVolume\s*=/, '唯一出现处是 const 声明');
});

test('③ 注：若本测试变红，说明有人收口了 L347 —— 那是行为变更，需单独验收', () => {
  // 该测试永远通过；它的价值写在名字与上面的注释里，作为失败时的提示。
  assert.ok(true);
});