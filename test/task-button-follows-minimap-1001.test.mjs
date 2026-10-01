// test/task-button-follows-minimap-1001.test.mjs
// 批 CY-㊴（2026-10-01）：「生成进度」那个单独按钮**不得**与小地图互相遮挡
// 用户原话（澄清后）：「他现在生成进度的按钮会跟小地图互相遮挡，
//   我要你挪在小地图上面呀，避免遮挡。」
//   （他指的是 .task-sidebar / aria=打开任务列表，**不是**缩放条、也不是底部居中那排 dock）
//
// 实测基线（1920×966）：小地图占距视口底 **70~250px**。
//   旧算法里两个"魔法数字"都落在这个带子里，必然撞车：
//     ① `Math.max(72, …)` —— 下限只会把按钮往小地图身上推；
//     ② 小地图不在时复位到 `86` —— 同样落在带子里。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 按钮底边 = 小地图顶沿**之上** 12px（且不许有任何下限把它推回去）', () => {
  assert.match(code, /\.ec-canvas-minimap/, '必须按小地图算位置');
  assert.match(code, /getBoundingClientRect\(\)/, '必须读实时矩形');
  assert.match(
    code,
    /apply\(Math\.round\(window\.innerHeight - rect\.top \+ 12\)\)/,
    '底边 = 视口底 − 小地图顶沿 + 12（12px 间距）',
  );
  assert.doesNotMatch(
    code,
    /Math\.max\(\s*72\s*,[\s\S]{0,80}rect\.top/,
    '⚠️ 不得再有 `Math.max(72, …)` 这类下限 —— 实测小地图占距底 70~250px，',
  );
  assert.doesNotMatch(
    code,
    /Math\.max\(\s*\d+[\s\S]{0,80}rect\.top/,
    '任何形如 Math.max(N, …rect.top) 的下限都只会把按钮推回小地图身上，',
  );
});

test('② 小地图**不在**时保持上一次的值，不得回落到会撞车的数字', () => {
  assert.match(code, /if \(!minimap\) return false;/,
    '小地图不在时**保持**上一次算好的值（那本来就是"在小地图上方"的位置）；'
    + '回落到 86 同样落在小地图的带子里（实测 70~250），仍会遮挡');
  assert.doesNotMatch(code, /if \(!minimap\) \{ apply\(/, '不许再把小地图不在时的值改成一个魔法数字');
});

test('③ 必须监听小地图的**出现与消失**（ResizeObserver 只管尺寸，管不了开/关）', () => {
  assert.match(code, /new MutationObserver\(/, '必须有 childList 观察');
  assert.match(code, /childList:\s*true,\s*subtree:\s*true/, '观察范围要覆盖子树');
  assert.match(code, /presence\.observe\(document\.body/, '必须观察 body');
  assert.match(code, /presence\?\.disconnect\(\)/, '必须能断开，否则每次挂载泄漏一个观察者');
});
