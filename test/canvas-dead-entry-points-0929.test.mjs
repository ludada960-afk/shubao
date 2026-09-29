import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { CANVAS_RIGHT_CLICK_ACTIONS } from '../src/pages/EcCanvas/canvasQuantvExtensions.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('src/pages/EcCanvas/index.jsx');
const panel = read('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');

/* ══════════════════════════════════════════════════════════════════════════════
   这批修的是同一类缺陷：**界面上有个真实可点的控件，但点了什么都不会发生**。
   用户不会看到报错、不会看到提示 —— 只会以为「这个功能坏了」或者「是我点错了」。

   用户 2026-09-28 的原话是关于整站逻辑的：
     「这种情况他应该不是一个孤立的情况，可能还有很多其他的情况也是类似的问题。
       所以我只是举了一个例子，你自己要全面的思考这些逻辑。」
   ⇒ 这条门禁的作用是：**菜单里声明的每一项，都必须有真实处理函数**。
   ══════════════════════════════════════════════════════════════════════════════ */

/* 从 index.jsx 里切出「画布空白处右键菜单」那个 switch 的正文 */
function contextMenuSwitchBody() {
  const start = page.indexOf('<CanvasContextMenuPanel');
  assert.ok(start > 0, '必须还能找到画布空白处右键菜单的渲染入口');
  const bodyStart = page.indexOf('switch (actionId)', start);
  const bodyEnd = page.indexOf('}}', bodyStart);
  assert.ok(bodyStart > 0 && bodyEnd > bodyStart, '必须能切出那个 switch');
  return page.slice(bodyStart, bodyEnd);
}

test('① 画布右键菜单里声明的每一项都有真实处理函数（不再有落进 default 就消失的项）', () => {
  const body = contextMenuSwitchBody();
  const unhandled = CANVAS_RIGHT_CLICK_ACTIONS
    .map(action => action.id)
    .filter(id => !body.includes(`case '${id}'`));
  assert.deepEqual(
    unhandled,
    [],
    '这些菜单项会落进 `default: break` ⇒ 用户点了什么都不发生，也没有提示：\n  ' + unhandled.join('\n  '),
  );
});

test('② 「从资产库选择」接的是既有的那一个实现，不是新开一条路', () => {
  const body = contextMenuSwitchBody();
  assert.match(
    body,
    /case 'from-asset-library': setAssetPickerOpen\(true\); break;/,
    '必须复用 setAssetPickerOpen —— 同一动作在别处已有四处实现，不该有第五种',
  );
  // 全仓 setAssetPickerOpen(true) 的调用点应当一致（同一个动作、同一个实现）
  const calls = (page.match(/setAssetPickerOpen\(true\)/g) || []).length;
  assert.ok(calls >= 5, '预期至少 5 个入口（欢迎区/素材库面板/actionId/加号面板/右键菜单），实际 ' + calls);
});

test('③ 任务日志的「重试」走真实生成链路，不是 console.info', () => {
  assert.doesNotMatch(
    page,
    /onRetry=\{\(task\) => console\.info/,
    '「重试」是面板上真实渲染的按钮（只有 failed 行有），console.info 等于点了没反应',
  );
  assert.match(
    page,
    /onRetry=\{\(task\) => \{[\s\S]*?handleWorkflowGenerate\(node\)/,
    '重试必须调用该节点自己的生成链路 handleWorkflowGenerate',
  );
});

test('④ 重试的两个失败分支必须说人话，而不是静默返回', () => {
  const start = page.indexOf('onRetry={(task) => {');
  assert.ok(start > 0, '必须找到 onRetry 的实现');
  const body = page.slice(start, start + 700);
  // 节点已经不在画布上
  assert.match(body, /if \(!node\) \{ showToast\('这个任务对应的节点已经不在画布上了', 'info'\); return; \}/);
  // 已有任务在跑
  assert.match(body, /if \(promptLoading\) \{ showToast\('有任务正在生成，请稍候', 'info'\); return; \}/);
});

test('⑤ 任务日志面板不再声明一个永远不会被调用的 onRefund', () => {
  /* 只看**代码**、不看注释（下面两条注释里就写着 onRefund 这个词） */
  const panelCode = panel.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  const pageCode = page.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.doesNotMatch(
    panelCode,
    /onRefund/,
    '这个组件从来没渲染过任何退款按钮（每行只有「重试」「清除」），留着 prop 只会误导人以为有退款流程',
  );
  assert.doesNotMatch(pageCode, /onRefund=/, '调用处也不该再传一个空实现进来');
});

test('⑥ 面板行上真实存在的按钮，就是接了真实处理的那几个', () => {
  // 逐个核对：面板渲染的按钮 → 调用处必须真的接了 handler
  const rowBlock = panel.slice(panel.indexOf('ec-canvas-task-log-row-actions'));
  const rendered = [...rowBlock.matchAll(/onClick=\{\(\) => (on\w+)\?\.\(task\)\}/g)].map(m => m[1]);
  assert.deepEqual(
    [...new Set(rendered)].sort(),
    ['onDismiss', 'onRetry'],
    '面板行上只应渲染「重试」和「清除」两个动作',
  );
  for (const prop of rendered) {
    assert.ok(page.includes(`${prop}={`), `${prop} 必须在 index.jsx 里真的接上实现`);
  }
});

test('⑦ 死链 EcExpertPanel / EcPlatformPicker 已删除，且没有任何地方再引用它们', () => {
  assert.equal(existsSync(new URL('../src/pages/Home/EcExpertPanel.jsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/pages/Home/EcPlatformPicker.jsx', import.meta.url)), false);
  /* 键盘可达性门禁的扫描清单也必须同步移除（否则 read() 会直接抛错）。
     同样只看代码不看注释 —— 上面那段解释性注释里就提到了这个文件名。 */
  const keyboardCode = read('test/home-keyboard-accessibility.test.mjs')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  assert.doesNotMatch(keyboardCode, /EcPlatformPicker\.jsx/, '扫描清单里不能留着已删除的路径');
});

test('⑧ 全站权威分辨率只有 1K/2K/4K —— 不许再冒出 1.5K 这种「只有死代码里才有」的档位', () => {
  const catalog = read('src/services/imageModelCatalog.js');
  assert.match(catalog, /return Array\.isArray\(model\?\.resolutions\) && model\.resolutions\.length \? \[\.\.\.model\.resolutions\] : \['1K', '2K', '4K'\];/);
  // 逐个文件扫：任何面向用户的分辨率清单都不得出现 1.5K
  const offenders = [];
  for (const f of ['src/pages/Home', 'src/pages/EcCanvas', 'src/skills', 'src/services']) {
    for (const name of readdirSync(new URL('../' + f, import.meta.url))) {
      if (!/\.(jsx?|mjs)$/.test(name)) continue;
      const src = read(f + '/' + name).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      if (/['"]1\.5K['"]/.test(src)) offenders.push(f + '/' + name);
    }
  }
  assert.deepEqual(offenders, [], '这些文件里还有 1.5K：' + offenders.join(', '));
});

test('⑨ CanvasNodeActionBar 整条死链已删除（组件 / state / 接线 / 样式 / 登记册）', () => {
  /* 这条原本是「确认它是死的，但先不删」；批 CY-㉑ 共享样式表空下来了，已彻底删除。
     现在反过来钉住「别把它又接回来」——
     它那 11 颗按钮里有 8 颗是空动作，接回来等于给用户一排点了没反应的按钮。 */
  const code = page.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.doesNotMatch(code, /nodeActionBar/, 'index.jsx 里不该再有 nodeActionBar 的任何引用');
  assert.equal(
    existsSync(new URL('../src/pages/EcCanvas/components/CanvasNodeActionBar.jsx', import.meta.url)),
    false,
    '组件文件必须已删除',
  );
  const css = read('src/styles/canvas-supervisor.css');
  assert.doesNotMatch(css, /node-action-bar|nodeActionBarEnter/, '那 119 行样式必须一并清掉');
  const registry = read('src/pages/EcCanvas/canvasSurfaceDismiss.js');
  const registryCode = registry.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.doesNotMatch(registryCode, /nodeActionBar/,
    '登记册里也不能留 —— 留着会让「关掉所有浮层」一直以为有个叫它的东西，却没有任何代码会打开它');
  // 画布上真正生效的那条节点操作链必须还在
  assert.match(studio, /export function CanvasGenerationNode/);
  assert.match(page, /CanvasObjectToolbar/, '选中态工具条才是真正生效的那条，不能被误删');
});
