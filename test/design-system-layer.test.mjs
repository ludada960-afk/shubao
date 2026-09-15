// test/design-system-layer.test.mjs
// 门禁（棘轮）：设计系统层必须说设计系统的语言 —— 只许变干净，不许变脏。
// ─────────────────────────────────────────────────────────────────────────────
// 判据（原则 §12 + 裁定 D24）：
//   ① DS 层 = src/components/ui/**（既有 13 个文件）+ .sb-* 工具类 + tokens。
//      不新建 src/components/ds/ —— 那是第三套组件语言，与裁定 1「不允许两套并存」冲突。
//   ② DS 层被全站复用，所以它必须自己先守规矩：裸 hex / 裸 rgba / V2 遗留变量都只许减不许增。
//   ③ 可点元素必须键盘可达（DS 层是全站样板；这里漏一次，全站漏一片）。
// 基线（2026-09-20 实测）：hex 13 / rgba 27 / V2 变量 33。迁移一批就把基线改小。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../scripts/lib/token-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DS = path.join(ROOT, 'src/components/ui');
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA = /rgba?\([^)]*\)/g;
const LEGACY = /var\(--(?!sb-|cvl-|max-width)[a-zA-Z0-9-]+\)/g;

/* 棘轮基线（**只许向下收紧**）：
   2026-09-20 初测 hex13/rgba27/legacy33 → Button.jsx 迁完 V2 变量后 legacy 降到 13，基线同步收紧到 13。
   ⚠️ 基线不收紧 = 给回退留出「合法的空间」：实测降到 13 而基线还是 33，就意味着悄悄涨回 33 也没人报警。 */
const BASELINE = { hex: 13, rgba: 27, legacy: 8 };

export function scanDsLayer(dir = DS) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile()) : [];
  const tot = { hex: 0, rgba: 0, legacy: 0 };
  const perFile = [];
  for (const f of files) {
    /* 先剥注释：注释里的 rgba/hex 是**说明文本**，不是用法（真实事故：7 处 rgba 全来自
       “为什么不是 token”的解释，计数器却把它们当违规 → 差点把基线从 27 放宽到 34）。 */
    const s = stripComments(fs.readFileSync(path.join(dir, f), 'utf8'));
    const c = { file: f, hex: (s.match(HEX) || []).length, rgba: (s.match(RGBA) || []).length, legacy: (s.match(LEGACY) || []).length };
    tot.hex += c.hex; tot.rgba += c.rgba; tot.legacy += c.legacy;
    if (c.hex + c.rgba + c.legacy) perFile.push(c);
  }
  return { files, tot, perFile };
}

test('① 设计系统层存在，且不新建 ds/ 第三套', () => {
  const { files } = scanDsLayer();
  assert.ok(files.length >= 8, 'src/components/ui/ 只有 ' + files.length + ' 个文件，样本量异常');
  assert.equal(fs.existsSync(path.join(ROOT, 'src/components/ds')), false,
    '出现了 src/components/ds/ —— 那是第三套组件语言（裁定 1：不允许两套并存）');
});

test('② DS 层的颜色/变量债务只许减不许增（棘轮）', () => {
  const { tot, perFile } = scanDsLayer();
  const detail = perFile.map(c => '    ' + c.file.padEnd(24) + 'hex' + String(c.hex).padStart(3) + '  rgba' + String(c.rgba).padStart(3) + '  V2变量' + String(c.legacy).padStart(3)).join('\n');
  for (const k of ['hex', 'rgba', 'legacy']) {
    assert.ok(tot[k] <= BASELINE[k],
      'DS 层的 ' + k + ' 从基线 ' + BASELINE[k] + ' 涨到 ' + tot[k] + ' —— 设计系统层自己不说设计系统的语言。\n' +
      '  正确做法：颜色走 --sb-* token（D24 迁移）；DS 层是全站样板，它脏一次全站脏一片。\n' + detail);
  }
});

test('③ 检测器自证：三类债务都数得出，V3 token 不误报', () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'ds-scan-'));
  fs.writeFileSync(path.join(tmp, 'a.jsx'), "const s={color:'#abc',background:'rgba(0,0,0,.2)',borderRadius:'var(--radius-md)',padding:'var(--sb-space-2)'};", 'utf8');
  const r = scanDsLayer(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(r.tot.hex, 1, 'hex 必须数得出');
  assert.equal(r.tot.rgba, 1, 'rgba 必须数得出');
  assert.equal(r.tot.legacy, 1, 'V2 变量必须数得出；--sb-* 不得被算成债务');
});

test('④ DS 层不得出现键盘不可达的可点元素', () => {
  const { files } = scanDsLayer();
  const bad = [];
  for (const f of files) {
    if (/\.jsx$/.test(f) === false) continue;
    const s = fs.readFileSync(path.join(DS, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const re = /<(div|span|li|section|article)\b([^>]*?)onClick=/g;
    let m;
    while ((m = re.exec(s))) {
      const attrs = m[2] + s.slice(m.index, m.index + 400);
      if (/role=|tabIndex=|onKeyDown=|as=\{/.test(attrs)) continue;
      bad.push(f + ' → <' + m[1] + ' onClick>');
    }
  }
  assert.equal(bad.length, 0,
    'DS 层出现键盘不可达的可点元素（应改 <button> + .a11y-reset，或 role=button + tabIndex + onKeyDown）：\n  ' + bad.join('\n  '));
});
