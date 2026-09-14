// test/no-clickable-div.test.mjs
// 原则 4.1（八态）可执行化守卫：**可点元素必须是真控件，键盘到得了**。
//
// 判据（不是写法）：`<div onClick>` 用键盘根本到不了 —— 不可 Tab、不可 Enter/Space 触发。
// 用户体验上等价于「这个按钮在某些人手里不存在」，属不可访问的极端形式。
//
// 检测器**唯一实现**在 scripts/lib/clickable-div-scan.mjs ——
// 本门禁与 scripts/design-audit.mjs 共用它，杜绝「同一判据两个数」（原则 §12）。
//
// 本测试三件事：
//   ① 检测器自证：裸 <div onClick> 必被抓；<button onClick>、
//      带 role="button" + tabIndex + onKeyDown 的 div 不得误报；
//   ② 仓库 src/** 中「非交互元素带 onClick 且未登记」= 0，并断言样本量（防空转通过）；
//   ③ 白名单条目必须带理由（禁止空理由白名单）+ 不得悬空 + 必须精确到元素。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findClickableNonInteractive, featureOf, scanRepo,
} from '../scripts/lib/clickable-div-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const WHITELIST = JSON.parse(readFileSync(path.join(ROOT, 'test/fixtures/clickable-div-whitelist.json'), 'utf8'));

/* ═══════════ ① 检测器自证（变异测试的固定靶）═══════════ */
test('① 检测器自证：裸 <div onClick> 必被抓到', () => {
  const hits = findClickableNonInteractive('<div onClick={() => go()}>点我</div>');
  assert.equal(hits.length, 1, '裸 div onClick 必须被检出');
  assert.equal(hits[0].tag, 'div');
});

test('① 检测器自证：跨行属性 / 其他非交互标签也必被抓到', () => {
  const bad = ['<div', '  className="x"', '  onClick={handle}', '>内容</div>',
    '<span onClick={f}>s</span>', '<li onClick={g}>l</li>', '<tr onClick={h}>r</tr>'].join('\n');
  assert.equal(findClickableNonInteractive(bad).length, 4, '跨行 div + span + li + tr 均应检出');
});

test('① 检测器自证：真控件与合规替代写法不报（禁止误报）', () => {
  const good = [
    '<button type="button" onClick={go}>确定</button>',
    '<button onClick={go}>确定</button>',
    '<a href="/x" onClick={go}>链接</a>',
    '<div role="button" tabIndex={0} onClick={go} onKeyDown={onKey}>合规</div>',
    '<div className="x">无 onClick</div>',
    '<input onClick={go} />',
  ].join('\n');
  assert.deepEqual(findClickableNonInteractive(good), [], '合规写法一律不得报');
});

test('① 检测器自证：role=button 但缺 tabIndex 或 onKeyDown 仍算违规', () => {
  const partial = [
    '<div role="button" onClick={go}>缺 tabIndex/onKeyDown</div>',
    '<div role="button" tabIndex={0} onClick={go}>缺 onKeyDown</div>',
    '<div role="button" tabIndex={0} onKeyDown={k} onClick={go}>合规</div>',
  ].join('\n');
  assert.equal(findClickableNonInteractive(partial).length, 2,
    'role=button 必须三者齐全（role + tabIndex + onKeyDown）才算键盘可达');
});

test('① 检测器自证：自定义组件按根元素判定（<IconButton> 不报 / <GCard> 必报）', () => {
  const rootOf = new Map([['IconButton', 'button'], ['GCard', 'div']]);
  const src = '<IconButton onClick={go}>图标</IconButton>\n<GCard onClick={go}>卡片</GCard>';
  const hits = findClickableNonInteractive(src, rootOf);
  assert.equal(hits.length, 1, '只有根元素非交互的组件才算违规');
  assert.equal(hits[0].tag, 'GCard');
});

test('① 检测器自证：箭头函数属性里的 ">" 不得截断标签解析（回归）', () => {
  /* 真实缺陷：原实现用 /<tag([^>]*?)>/，而 onKeyDown={event => …} 里的 ">" 会让
     属性捕获提前终止，导致**已合规**的元素被误判为违规（会把好代码"改坏"）。
     实测命中：DirectorWorkbench 的 <article role tabIndex onClick onKeyDown>。
     现改为按 {} () [] 与引号平衡解析起始标签。 */
  const compliant = [
    '<div',
    '  role="button"',
    '  tabIndex={0}',
    '  onClick={() => go()}',
    '  onKeyDown={event => { if (event.key === "Enter") go(); }}',
    '>内容</div>',
  ].join('\n');
  assert.deepEqual(findClickableNonInteractive(compliant), [],
    '含箭头函数的合规三件套不得误报');
  // 反向：真违规仍必须被抓（去掉 onKeyDown）
  const missing = compliant.replace(/^\s*onKeyDown=.*$/m, '');
  assert.equal(findClickableNonInteractive(missing).length, 1,
    '去掉 onKeyDown 后必须重新变为违规');
});

test('① 检测器自证：spread 提供 role/tabIndex 的合规写法不得误报', () => {
  /* 真实缺陷：#ui/index.jsx 的 Card 用「条件展开」提供无障碍语义 ——
       {...(interactive ? { role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined } : {})}
     原检测器只认 role="button" 直接属性写法，把该合规实现误判为违规（会去"修"好代码）。
     现同时识别：① 直接属性 ② spread 对象字面量 ③ spread + 三元。 */
  const spreadStyle = [
    '<div',
    '  onClick={onClick}',
    '  {...(interactive ? { role: onClick ? \'button\' : undefined, tabIndex: onClick ? 0 : undefined } : {})}',
    '  onKeyDown={onClick ? event => { if (event.key === "Enter") onClick(event); } : undefined}',
    '>内容</div>',
  ].join('\n');
  assert.deepEqual(findClickableNonInteractive(spreadStyle), [],
    'spread 形式提供的 role/tabIndex + onKeyDown 属键盘可达，不得误报');
  // 反向：去掉 onKeyDown 后必须重新违规
  const noKey = spreadStyle.replace(/^\s*onKeyDown=.*$/m, '');
  assert.equal(findClickableNonInteractive(noKey).length, 1, '去掉 onKeyDown 后必须重新变为违规');
});

test('① 检测器自证：role=radio/option 等合法可交互角色不得误报', () => {
  /* 判据是「键盘到不到得了」，不是「有没有写 button 这个词」。
     role="radio"/"option"/"menuitem"/"tab"/"switch" 同样是可聚焦 + 可键盘激活的语义角色
     （DirectionOptionCard 用 role="radio" + tabIndex + onKeyDown 的 roving tabindex 模式）。 */
  for (const role of ['radio', 'option', 'menuitem', 'tab', 'switch', 'checkbox', 'link']) {
    const src = '<div role="' + role + '" tabIndex={0} onClick={go} onKeyDown={k}>x</div>';
    assert.deepEqual(findClickableNonInteractive(src), [],
      'role=' + role + ' + tabIndex + onKeyDown 属键盘可达，不得误报');
  }
  // 缺 onKeyDown 仍必须违规（可聚焦但键盘激活不了）
  const noKey = '<div role="radio" tabIndex={0} onClick={go}>x</div>';
  assert.equal(findClickableNonInteractive(noKey).length, 1, '缺 onKeyDown 必须违规');
  // 无 role 的裸 div 仍必须违规
  assert.equal(findClickableNonInteractive('<div tabIndex={0} onClick={go} onKeyDown={k}>x</div>').length, 1,
    '无 role 的裸 div 即便可聚焦也算违规（语义未声明）');
});

test('① 检测器自证：注释里出现的 <div onClick> 字样不得误报', () => {
  const src = ['/* 说明：原为 <div onClick> 已改 <button> */', 'const x = 1;'].join('\n');
  assert.deepEqual(findClickableNonInteractive(src), [], '注释内容不参与检测');
});

/* ═══════════ ② 仓库扫描（与 design-audit 共用同一实现）═══════════ */
test('② 仓库 src/** 无非交互元素 onClick（未登记者）', () => {
  const r = scanRepo({ root: ROOT, srcDir: SRC, whitelist: WHITELIST });
  assert.ok(r.scannedFiles > 200, '样本量不足（防目录读空导致空转通过），实际 ' + r.scannedFiles);
  assert.ok(r.onClickFiles > 40, '含 onClick 的文件数异常（防空转），实际 ' + r.onClickFiles);
  const list = r.violations.map(v =>
    v.file + ':' + v.line + '  <' + v.tag + '>' + (v.note ? ' (' + v.note + ')' : '') + '  ' + v.snippet);
  assert.deepEqual(list, [],
    '存在键盘不可达的可点元素（应改 <button>，或补 role=button+tabIndex+onKeyDown 并登记白名单）：\n  '
      + list.join('\n  '));
});

/* ═══════════ ③ 白名单纪律 ═══════════ */
test('③ 白名单条目必须带理由（禁止空理由白名单）', () => {
  assert.ok(Array.isArray(WHITELIST.entries), '白名单结构应为 { entries: [...] }');
  for (const e of WHITELIST.entries) {
    assert.ok(e.file, '条目必须有 file');
    assert.ok(typeof e.reason === 'string' && e.reason.trim().length >= 12,
      e.file + ' 的理由为空或过短（必须说明为何不能用 <button>）');
  }
});

test('③ 白名单必须精确到元素：每条须有 feature 特征串或显式 line', () => {
  for (const e of WHITELIST.entries) {
    const hasFeature = typeof e.feature === 'string' && e.feature.trim().length > 0;
    const hasLine = typeof e.line === 'number';
    assert.ok(hasFeature || hasLine, e.file + ' 既无 feature 也无 line —— 禁止整文件放行');
  }
});

test('③ 白名单不得悬空（文件存在、且能定位到该可点元素）', () => {
  const r = scanRepo({ root: ROOT, srcDir: SRC, whitelist: WHITELIST });
  for (const e of WHITELIST.entries) {
    const p = path.join(ROOT, e.file);
    assert.ok(statSync(p).isFile(), e.file + ' 不存在（悬空白名单，应删除该条目）');
    const matched = r.whitelisted.some(w => w.file === e.file &&
      (e.feature ? w.feature === e.feature : Math.abs(w.line - e.line) <= 30));
    assert.ok(matched,
      e.file + ' 的白名单条目未命中任何可点元素（' +
      (e.feature ? 'feature=' + e.feature : 'line=' + e.line) + '）—— 悬空或已改造完成，应删除');
  }
});

test('③ 白名单条目对应的违规必须确实被豁免（严格口径 - 未登记 = 白名单数）', () => {
  const r = scanRepo({ root: ROOT, srcDir: SRC, whitelist: WHITELIST });
  assert.equal(r.strict.length, r.violations.length + r.whitelisted.length,
    '严格口径必须等于「未登记 + 已豁免」（否则匹配逻辑有漏）');
});