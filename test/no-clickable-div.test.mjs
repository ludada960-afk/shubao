// test/no-clickable-div.test.mjs
// 原则 4.1（八态）可执行化守卫：**可点元素必须是真控件，键盘到得了**。
//
// 判据（不是写法）：`<div onClick>` 用键盘根本到不了 —— 不可 Tab、不可 Enter/Space 触发。
// 用户体验上等价于「这个按钮在某些人手里不存在」，属不可访问的极端形式。
//
// 本测试三件事：
//   ① 检测器自证：fixture 里裸 <div onClick> 必被抓；<button onClick>、
//      带 role="button" + tabIndex + onKeyDown 的 div 不得误报；
//   ② 仓库 src/** 中「非交互元素带 onClick 且未登记」= 0，并断言样本量（防空转通过）；
//   ③ 白名单条目必须带理由（禁止空理由白名单）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/* ═══════════ 检测器（唯一实现，自证后用于仓库扫描）═══════════ */
const INTERACTIVE = new Set(['button','a','input','select','textarea','summary','details','label']);

/**
 * 找出「非交互元素挂 onClick」的位置。返回 [{line, tag, snippet, note}]。
 *
 * 判据（不是写法）：元素**用键盘到不了** —— 不可 Tab、不可 Enter/Space 触发。
 *   · 真控件（button/a/input/select/textarea/summary/details/label）→ 放行；
 *   · 显式 role="button" + tabIndex + onKeyDown 三者齐全 → 视为键盘可达，放行；
 *   · 其余（div/span/li/tr/article/section/form/img…挂 onClick）→ 违规。
 *
 * 自定义组件（大写开头）需解析其**根元素**：<IconButton> 渲染 <button> 不算违规，
 * 而 <GCard> 渲染 <div onClick> 算 —— 只看调用点会同时产生误报与漏报。
 */
export function findClickableNonInteractive(src, rootOf = new Map()) {
  const hits = [];
  const tagRe = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)\/?>/gs;
  let m;
  while ((m = tagRe.exec(src))) {
    const rawTag = m[1];
    const tag = rawTag.toLowerCase();
    const attrs = m[2];
    if (!/\bonClick\b/.test(attrs)) continue;
    if (INTERACTIVE.has(tag)) continue;
    const hasRole = /role\s*=\s*['"]button['"]/.test(attrs);
    const hasTabIndex = /tabIndex\s*=/.test(attrs);
    const hasKeyDown = /onKeyDown\s*=/.test(attrs);
    if (hasRole && hasTabIndex && hasKeyDown) continue;
    // 自定义组件：解析根元素后再判定
    let note = '';
    if (/^[A-Z]/.test(rawTag)) {
      const root = rootOf.get(rawTag);
      if (root && INTERACTIVE.has(root)) continue;      // 渲染真控件 → 放行
      note = root ? ('组件 ' + rawTag + ' 根元素 <' + root + '>') : ('组件 ' + rawTag + ' 根元素未解析');
    }
    hits.push({ line: src.slice(0, m.index).split('\n').length, tag: rawTag, note,
      snippet: m[0].replace(/\s+/g, ' ').slice(0, 110) });
  }
  return hits;
}

/** 扫描 src/**，建立「自定义组件名 → 根元素标签」映射。 */
export function buildComponentRootMap(files) {
  const rootOf = new Map();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const mm of src.matchAll(/(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(|(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) {
      const name = mm[1] || mm[2];
      if (!name) continue;
      const body = src.slice(mm.index, mm.index + 4000);
      const ret = body.match(/return\s*\(?\s*<([a-zA-Z][\w.-]*)/);
      if (ret) rootOf.set(name, ret[1].toLowerCase());
      }
  }
  return rootOf;
}

/* ═══════════ ① 检测器自证（变异测试的固定靶）═══════════ */
test('① 检测器自证：裸 <div onClick> 必被抓到', () => {
  const bad = `<div onClick={() => go()}>点我</div>`;
  const hits = findClickableNonInteractive(bad);
  assert.equal(hits.length, 1, '裸 div onClick 必须被检出');
  assert.equal(hits[0].tag, 'div');
});

test('① 检测器自证：跨行属性 / 其他非交互标签也必被抓到', () => {
  const bad = [
    '<div',
    '  className="x"',
    '  onClick={handle}',
    '>内容</div>',
    '<span onClick={f}>s</span>',
    '<li onClick={g}>l</li>',
  ].join('\n');
  assert.equal(findClickableNonInteractive(bad).length, 3, '跨行 div + span + li 均应检出');
});

test('① 检测器自证：真控件与合规替代写法不报（禁止误报）', () => {
  const good = [
    `<button type="button" onClick={go}>确定</button>`,
    `<button onClick={go}>确定</button>`,
    `<a href="/x" onClick={go}>链接</a>`,
    `<div role="button" tabIndex={0} onClick={go} onKeyDown={onKey}>合规</div>`,
    `<div className="x">无 onClick</div>`,
    `<input onClick={go} />`,
  ].join('\n');
  assert.deepEqual(findClickableNonInteractive(good), [], '合规写法一律不得报');
});

test('① 检测器自证：role=button 但缺 tabIndex 或 onKeyDown 仍算违规', () => {
  const partial = [
    `<div role="button" onClick={go}>缺 tabIndex/onKeyDown</div>`,
    `<div role="button" tabIndex={0} onClick={go}>缺 onKeyDown</div>`,
    `<div role="button" tabIndex={0} onKeyDown={k} onClick={go}>合规</div>`,
  ].join('\n');
  assert.equal(findClickableNonInteractive(partial).length, 2,
    'role=button 必须三者齐全（role + tabIndex + onKeyDown）才算键盘可达');
});

/* ═══════════ ② 仓库扫描 ═══════════ */
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx|tsx|js|ts)$/.test(e)) out.push(p);
  }
  return out;
}

const WHITELIST = JSON.parse(readFileSync(path.join(ROOT, 'test/fixtures/clickable-div-whitelist.json'), 'utf8'));

test('② 仓库 src/** 无非交互元素 onClick（未登记者）', () => {
  const files = walk(SRC);
  assert.ok(files.length > 200, '样本量不足（防止目录读空导致的空转通过），实际 ' + files.length);

  const rootOf = buildComponentRootMap(files);
  const allowed = new Set(WHITELIST.entries.map(e => e.file + ':' + e.line));
  const violations = [];
  let scanned = 0;
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const src = readFileSync(f, 'utf8');
    if (!src.includes('onClick')) continue;
    scanned++;
    for (const h of findClickableNonInteractive(src, rootOf)) {
      if (allowed.has(rel + ':' + h.line)) continue;
      violations.push(rel + ':' + h.line + '  <' + h.tag + '>' + (h.note ? ' (' + h.note + ')' : '') + '  ' + h.snippet);
    }
  }
  assert.ok(scanned > 40, '含 onClick 的文件数异常（防空转），实际 ' + scanned);
  assert.deepEqual(violations, [],
    '存在键盘不可达的可点元素（应改 <button> 或补 role=button+tabIndex+onKeyDown 并登记白名单）：\n  '
      + violations.join('\n  '));
});

/* ═══════════ ③ 白名单必须带理由 ═══════════ */
test('③ 白名单条目必须带非空理由（禁止空理由白名单）', () => {
  assert.ok(Array.isArray(WHITELIST.entries), '白名单结构应为 { entries: [...] }');
  for (const e of WHITELIST.entries) {
    assert.ok(e.file && typeof e.line === 'number', '条目必须有 file + line');
    assert.ok(typeof e.reason === 'string' && e.reason.trim().length >= 12,
      e.file + ':' + e.line + ' 的理由为空或过短（必须说明为何不能用 <button>）');
  }
});

test('③ 白名单条目不得悬空（文件必须存在且该行确实是可点元素）', () => {
  for (const e of WHITELIST.entries) {
    const p = path.join(ROOT, e.file);
    assert.ok(statSync(p).isFile(), e.file + ' 不存在（悬空白名单，应删除该条目）');
    const src = readFileSync(p, 'utf8');
    const lines = src.split('\n');
    const ctx = lines.slice(Math.max(0, e.line - 3), e.line + 3).join('\n');
    assert.match(ctx, /onClick/, e.file + ':' + e.line + ' 附近找不到 onClick（行号漂移，应更新白名单）');
  }
});