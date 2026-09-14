// test/video-canvas-audio-fn-scope.test.mjs
// 2026-09 裁决：把「音轨三函数哪一套是活的」用契约钉死。
//
// 背景：`VideoCanvasWorkbench.jsx` 曾同时存在两套音轨函数声明：
//   · 一套 `function` 声明（组件函数体层级）—— 活的那套；
//   · 一套 `const` 箭头函数 —— 被一个**未闭合的 setPositions 表达式**吞进箭头体内、
//     且排在 return 之后，因此是**不可达的死代码**（esbuild 输出里被重命名为 handleAddAudioTrack2）。
//
// 清理分两步（bc4ecbd3 加测试 / 本文件随后更新断言）：
//   1) 契约测试先钉死该结构，使「收口」必须面对行为变更；
//   2) 删除死代码并把 setPositions 收口为等价写法（行为不变）。
//
// 现在本文件断言的是**清理后的不变量**：
// 死套必须不存在、活套必须完好、且不得再出现同名遮蔽。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const URL_ = new URL('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx', import.meta.url);
const src = readFileSync(URL_, 'utf8');
const lines = src.split(/\r?\n/);
const AUDIO_FNS = ['handleAddAudioTrack', 'handleToggleAudioMute', 'handleChangeAudioVolume'];

/* ── ① 活的那套：组件层级的 function 声明，且被调用点使用 ─────────────── */

test('① 音轨三函数以 function 声明存在（活的那套）', () => {
  for (const name of AUDIO_FNS) {
    assert.match(
      src,
      new RegExp('^\\s{2}function\\s+' + name + '\\s*\\(', 'm'),
      name + ' 必须以组件层级（缩进 2）的 function 声明存在',
    );
  }
});

test('① 调用点与 function 版的签名匹配（参数个数）', () => {
  assert.match(src, /onClick=\{\(\) => void handleAddAudioTrack\(node\)\}/, 'handleAddAudioTrack 1 参调用');
  assert.match(src, /onClick=\{\(\) => handleToggleAudioMute\(track\)\}/, 'handleToggleAudioMute 1 参调用');
  assert.match(src, /onChange=\{event => handleChangeAudioVolume\(track, Number\(event\.target\.value\)\)\}/, 'handleChangeAudioVolume 2 参调用');
});

/* ── ② 死的那套必须已不存在（清理后的不变量） ──────────────────────── */

test('② 不得再存在 const 版的音轨函数（死套已删除）', () => {
  for (const name of AUDIO_FNS.concat('handleUpdateAudioVolume')) {
    assert.doesNotMatch(
      src,
      new RegExp('^\\s*const\\s+' + name + '\\s*=', 'm'),
      name + ' 不得再有 const/箭头形式的声明（那是被删除的死套）',
    );
  }
});

test('② setPositions 调用已收口为完整表达式，不再吞掉后续代码', () => {
  const start = lines.findIndex(l => l.includes('setPositions(() => {'));
  assert.ok(start >= 0, 'setPositions 以自闭合箭头形式出现');
  // 收口后的形态：紧随其后就是完整 try/catch + 闭合，而不是拖出几十行
  const window_ = lines.slice(start, start + 8).join('\n');
  assert.match(window_, /setPositions\(\(\) => \{\s*\n\s*try \{/, '箭头体以 try 开头');
  assert.match(window_, /catch \{ return \{\}; \}/, 'catch 返回 {}（与收口前行为一致）');
  assert.match(window_, /\}\);/, '箭头与调用均已闭合');
});

test('② 音轨函数不得落在 setPositions 表达式范围内（不再有遮蔽）', () => {
  const start = lines.findIndex(l => l.includes('setPositions(() => {'));
  const end = lines.findIndex((l, i) => i > start && /^\s{6}\}\);/.test(l));
  assert.ok(start >= 0 && end > start, '找到 setPositions 表达式区间');
  const fnLine = lines.findIndex(l => /^\s{2}function\s+handleAddAudioTrack\s*\(/.test(l));
  assert.ok(fnLine > end, 'function 版位于 setPositions 表达式之后（组件层级，未被吞入）');
});

/* ── ③ handleUpdateAudioVolume 已随死套一并删除 ─────────────────────── */

test('③ handleUpdateAudioVolume 已从源码移除（原先 0 调用）', () => {
  assert.equal(
    src.includes('handleUpdateAudioVolume'),
    false,
    '该函数原先仅存在于死套中且 0 调用，应随死套删除；若重新引入请同时补调用点与测试',
  );
});

test('③ 注：若 ② 变红，说明有人重新引入了被吞入的代码结构 —— 那是行为变更，需单独验收', () => {
  assert.ok(true);
});