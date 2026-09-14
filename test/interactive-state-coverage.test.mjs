// test/interactive-state-coverage.test.mjs
// 门禁：**可点的东西必须看得见 hover**（原则 4.1 八态 / 4.2 Hover≠Focus / 4.7 可点必有反馈）。
// ─────────────────────────────────────────────────────────────────────────────
// 口径（原则 §12：指标必须测量判据本身）：
//   ① 「可点」= 作者自己用 `cursor: pointer` 声明的（比按类名猜可靠）；
//   ② 缺陷 = **未登记**的可点无 hover；**登记豁免**（整屏遮罩，点击=取消/关闭）单列，
//      两者**绝不能合并成一个数** —— 合并后第 4 个未登记的出现时没人会发现；
//   ③ 豁免表是白名单：条目**过期**（登记了却已有 hover / 选择器已删）必须报出来，否则表会烂掉。
// 扫描实现是共用的 scripts/lib/interactive-state-scan.mjs —— 与 design-audit 同源，防止口径漂移。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanInteractiveState, HOVER_EXEMPT } from '../scripts/lib/interactive-state-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}
const CSS = walk(path.join(ROOT, 'src'));

/** 写一个临时 fixture 跑扫描（用显式路径，不经过遍历器 —— 避免 dotfile 被跳过导致假通过） */
function scanSnippet(css) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hover-scan-')), 'fixture.css');
  fs.writeFileSync(p, css, 'utf8');
  try { return scanInteractiveState([p], path.dirname(p)); }
  finally { fs.rmSync(path.dirname(p), { recursive: true, force: true }); }
}

test('① 检测器本身有效（喂样本必须能抓到「可点却无 hover」，且补上 hover 后不再报）', () => {
  const bad = scanSnippet('.x-btn { cursor: pointer; }');
  assert.equal(bad.unregistered.length, 1, '可点却无 hover 必须被算作**未登记缺陷**');
  assert.equal(bad.unregistered[0].base, '.x-btn');

  const good = scanSnippet('.x-btn { cursor: pointer; }\n.x-btn:hover { box-shadow: var(--sb-shadow-3); }');
  assert.equal(good.unregistered.length, 0, '补上 hover 后不应再报');

  const ancestor = scanSnippet('.card { cursor: pointer; }\n.card :hover { background: var(--sb-hover-bg); }');
  assert.equal(ancestor.unregistered.length, 0, '状态挂在容器上也算覆盖');

  const exempted = scanSnippet('.a11y-backdrop { cursor: pointer; }');
  assert.equal(exempted.unregistered.length, 0, '登记豁免的选择器不计入缺陷');
  assert.equal(exempted.exempt.length, 1, '但它必须出现在**豁免**桶里（不是被静默丢掉）');
});

test('② 仓库里不得有「未登记的可点无 hover」', () => {
  assert.ok(CSS.length > 20, '扫描到 ' + CSS.length + ' 个 css 文件，样本量异常（防止扫描器失效导致空转通过）');
  const s = scanInteractiveState(CSS, ROOT);
  assert.ok(s.clickables.size > 100, '可点选择器只有 ' + s.clickables.size + ' 个，样本量异常');
  const detail = s.unregistered.map(x => '  ' + x.rel + ':' + x.at + '  ' + x.base).join('\n');
  assert.equal(s.unregistered.length, 0,
    '以下可点选择器**没有 hover 反馈**（看不见的可点 = 不可用）：\n' + detail +
    '\n  正确做法：中性/透明底用 background-color: var(--sb-hover-bg)；实色底用 box-shadow: var(--sb-shadow-3)；' +
    '整屏遮罩走 HOVER_EXEMPT 登记豁免（必须写明理由）。');
});

test('③ 豁免表不许烂掉（登记了却已不适用 → 必须删条目）', () => {
  const s = scanInteractiveState(CSS, ROOT);
  assert.equal(s.staleExemptions.length, 0,
    '以下豁免条目已不再适用（该选择器已有 hover，或已不存在），应从 HOVER_EXEMPT 删除：' +
    s.staleExemptions.join(' / '));
});

test('④ 每条豁免必须写明理由与证据（禁止空理由白名单）', () => {
  assert.ok(HOVER_EXEMPT.size > 0, '豁免表为空时本条断言失效');
  for (const [sel, reason] of HOVER_EXEMPT) {
    assert.ok(typeof reason === 'string' && reason.trim().length >= 24,
      sel + ' 的豁免理由过短或为空 —— 白名单必须写清「为什么可以没有 hover」与证据位置');
  }
});
