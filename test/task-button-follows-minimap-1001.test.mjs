// test/task-button-follows-minimap-1001.test.mjs
// 批 CY-㊴（2026-10-01）：「生成进度」那个单独按钮必须**始终**在小地图上方
// 用户原话：「你现在这个按钮还是应该把它放到小地图上面。」
//   （澄清：他指的是 .task-sidebar / aria=打开任务列表，**不是**缩放条、也不是底部居中那排 dock）
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 按钮位置由小地图的实时顶沿算出，并留 12px', () => {
  assert.match(code, /\.ec-canvas-minimap/, '必须按小地图算位置');
  assert.match(code, /getBoundingClientRect\(\)/, '必须读实时矩形（小地图可被拖拽改尺寸）');
  assert.match(
    code,
    /Math\.max\(72,\s*Math\.round\(window\.innerHeight - rect\.top \+ 12\)\)/,
    '底边 = 视口底 - 小地图顶沿 + 12（12px 间距，72px 下限）',
  );
});

test('② 小地图**不在**时必须复位，不能停在上一次的偏移上（用户看到错位的原因）', () => {
  /* 改前：`if (!minimap) return false;` —— 小地图关掉后没有任何机制复位，
     按钮会一直停在上一次**开着**时算出来的偏移，看上去就压住了。 */
  assert.match(code, /if \(!minimap\) \{\s*apply\(FALLBACK\);\s*return false;/,
    '找不到小地图必须复位到兜底值（而不是静默 return）');
});

test('③ 必须监听小地图的**出现与消失**，不能只靠 ResizeObserver', () => {
  /* ResizeObserver 只对**尺寸**变化触发；开/关小地图改的是"在不在"，面板开合改的是**位置** ——
     这两类都不触发它，用户截图里的错位就是这么来的。 */
  assert.match(code, /new MutationObserver\(/, '必须有 childList 观察（小地图挂载/卸载）');
  assert.match(code, /childList:\s*true,\s*subtree:\s*true/, '观察范围要覆盖子树');
  assert.match(code, /presence\.observe\(document\.body/, '必须观察 body');
  assert.match(code, /presence\?\.disconnect\(\)/, '必须能断开（否则每次挂载泄漏一个观察者）');
});
