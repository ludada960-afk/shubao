// test/token-no-duplicate-definitions.test.mjs
// 门禁：**同一个作用域内，一个 token 不许被定义两次且解析后取值不同**。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要（三次真实事故，都属于「静默失效」家族 —— 不报错、不告警、构建与测试都不红）：
//   ① `--sb-brand-gradient` 在 `:root` 上定义了两次：
//        §1 权威色阶  = 紫→薰衣草（**文档写的值**）
//        兼容别名层   = 紫→**粉**（实际生效）
//      后果：全站 8 处引用（含**功能按钮**）渲染的都是粉渐变，与文档不符，
//      且违反裁定 2「功能按钮禁止渐变」。
//   ② `--sb-text-2xl` 在两个 ≤640px 的 `:root` 块里各定义一次（20px vs 18px），
//      后者静默胜出 —— 前一块那 6 个 token 是**没人知道的死声明**。
//   ③ §22 a11y hover 段曾**整段出现两次**（同一提交族重复落地）。
//
// 口径（依原则 §12「指标必须测量判据本身」）：
//   比的是**解析后的值**，不是源码文本 —— 所以「别名指向同一个值」是合规的
//   （例如 `--sb-brand-gradient: var(--sb-brand-gradient-soft)`），
//   只有**解析后仍然不同**才算缺陷；不同作用域（主题 / 断点）本来就该有不同值。
//
// 解析实现共用 scripts/lib/token-scope.mjs —— 与 scripts/design-audit.mjs **同一份**，
// 避免两处逻辑漂移（漂移的指标比没有指标更糟）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDeclarations, makeResolver } from '../scripts/lib/token-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = path.join(ROOT, 'src/styles/design-tokens-v3.css');

/** 找出「同作用域 + 同名字 + 解析后取值不同」的重复定义 */
export function findConflictingDuplicates(text) {
  const decls = collectDeclarations(text);
  const resolve = makeResolver(decls);
  const groups = new Map();
  for (const d of decls) {
    const k = d.scope + '||' + d.name;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  const bad = [];
  for (const [k, arr] of groups) {
    if (arr.length < 2) continue;
    const resolved = new Set(arr.map(d => resolve(d.value)));
    if (resolved.size > 1) bad.push({ name: k.split('||')[1], scope: arr[0].scope, sites: arr });
  }
  return bad;
}

test('① 检测器本身有效（喂样本必须能抓到「值不同」、不误报「别名指向同值」）', () => {
  const dup = ':root { --sb-a: 1px; }\n:root { --sb-a: 2px; }';
  assert.equal(findConflictingDuplicates(dup).length, 1, '同作用域值不同必须被抓到');
  const alias = ':root { --sb-a: 1px; --sb-b: 1px; }\n:root { --sb-b: var(--sb-a); }';
  assert.equal(findConflictingDuplicates(alias).length, 0, '别名指向同一个值时**不算冲突**（口径是解析后的值）');
  const scoped = ':root { --sb-a: 1px; }\n[data-theme="dark"] { --sb-a: 9px; }';
  assert.equal(findConflictingDuplicates(scoped).length, 0, '不同作用域（主题）本来就应该有不同值');
  /* 媒体查询里的 :root 与顶层 :root 是**不同作用域**，但同一媒体查询下的两个 :root 是**同一作用域** */
  const mediaSame = '@media (max-width: 640px) { :root { --sb-a: 1px; } :root { --sb-a: 2px; } }';
  assert.equal(findConflictingDuplicates(mediaSame).length, 1, '同一 @media 下的重复 :root 必须被抓到');
  const mediaDiff = ':root { --sb-a: 1px; }\n@media (max-width: 640px) { :root { --sb-a: 99px; } }';
  assert.equal(findConflictingDuplicates(mediaDiff).length, 0, '断点覆盖是设计意图，不是冲突');
});

test('② token 文件里不得有「同作用域、解析后取值不同」的重复定义', () => {
  const text = readFileSync(TOKENS, 'utf8');
  const decls = collectDeclarations(text);
  assert.ok(decls.length > 300, '解析到的声明数异常（' + decls.length + '），防止解析器失效导致空转通过');
  const bad = findConflictingDuplicates(text);
  const detail = bad.map(b => b.name + '  [' + b.scope + ']\n' +
    b.sites.map(s => '      L' + s.line + '  ' + s.value).join('\n')).join('\n');
  assert.equal(bad.length, 0,
    '同一个作用域里一个 token 被定义两次且**解析后取值不同** —— 后者会静默胜出，' +
    '造成「文档写 A、实际是 B」：\n  ' + detail);
});
