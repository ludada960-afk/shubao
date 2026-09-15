// test/token-root-scope-language.test.mjs
// 门禁（棘轮）：**不许再出现第三套全局 token 语言**。
// ─────────────────────────────────────────────────────────────────────────────
// 起因（D35，真实事故）：仓库里除了 V2（design-tokens.css）与 V3 权威
// （design-tokens-v3.css），还躺着第三个文件 src/styles/semanticTokens.css ——
// 12 行、10 个 token、硬编码 hex、没有暗色变体，且在 main.jsx 里排在 theme.css **之后**
// import，于是它的 :root 值静默压过其它文件的回退值：.theme-switcher 的焦点描边
// 实测渲染 rgb(37, 99, 235)，而不是作者写在同一个文件里的回退值 --sb-info 的 #5275CC。
// 那 10 个 token 里 7 个全仓零引用；文件已删除。
//
// 为什么是**棘轮**而不是「必须为 0」：
//   根/主题作用域里现在还有 177 处非 --sb-* 定义，都属**已登记待迁 / 已判合法**：
//     · 106 处 = V2 权威 design-tokens.css（正在分批迁移）
//     ·  64 处 = theme.css 的暗色覆盖（[data-theme="dark"] + auto 暗色块，跟着 V2 一起迁）
//     ·   7 处 = 组件自有 token 被放在根作用域（--ec-* 等，D26 #2 判为合法家族）
//   所以口径只能锁「不许再涨」，锁的不是「现在必须为 0」。
//
// ⚠️ 本门禁的**第一条自证测试**顺带修出了一条共享库的真 bug（记在 D35）：
//   scripts/lib/token-scope.mjs 的 collectDeclarations 从不认识**嵌套块的选择器**
//   —— 进入块之后字符都收进 buf，它却只读 pending，于是
//       @media (max-width: 640px) { :root { … } }
//   被记成 `@media (max-width: 640px) > ?`（与它自己文档承诺的 `> :root` 不符）。
//   后果：**媒体查询里的全局 token 定义对审计与门禁完全隐形**。
//   修复后基线从 137 处涨到 177 处，多出的 40 处正是此前看不见的：
//     · 32 处 @media (prefers-color-scheme: dark) > [data-theme="auto"]（theme.css 自动暗色）
//     ·  8 处 @media (max-width: 768px) > :root（design-tokens.css 的 V2 响应式覆盖）
//
// 判据（锁的是「全局 token 必须走 V3 语言」这条规则本身，不是某个文件名的拼写）：
//   凡作用域选择器是 :root / html / html[...] / [data-theme=...]（可被 @media 包裹）
//   的自定义属性定义，非 --sb-* 的**条数**与**名字数**都不得超过基线。
//   复现路径「再开一个新文件塞全局 token」会把这两个数顶上去 → 立刻变红。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDeclarations } from '../scripts/lib/token-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 当前基线（2026-09-15 实测，删除第三套 token 语言之后）。只许降，不许升。
/* ── D40（2026-09-15）实测 177/105 → **165/93**：删掉 12 个**三者皆无**的 V2 定义。
     筛选判据（三者皆无才算安全）：
       ① 可达性分析判定为「不可达」；② 文档（含 薯包AI Design System 活样本 HTML）无引用；
       ③ 测试无引用；④ theme.css 无对应暗色覆盖（否则须成对删除）。
     本轮删的 12 个：--font-mono --leading-tight --leading-loose --weight-medium --weight-heavier
                     --space-1 --space-8 --space-10 --space-12 --space-16 --space-20 --duration-xl
     ⚠️ 余下 45 个不可达定义**有意保留**，依据见 D40：40 个被文档引用、34 个被测试引用
        （多为历史叙述）、13 个有暗色覆盖须成对删 —— 删它们会让 40 份文档与活样本 HTML
        描述不存在的东西（铁律③）。**拆语言的收尾动作必须等文档同步迁移之后。** */
const BASELINE_SITES = 165;
const BASELINE_NAMES = 93;
// 反向保险：扫描面塌了（例如目录改名导致一个文件都没扫到），也必须变红
const MIN_CSS_FILES = 40;

// 主题作用域选择器：根 / html / html[...] / [data-theme=...]
const THEME_SCOPE_RE = /^(:root|html|html\[[^\]]*\]|\[data-theme[^\]]*\])$/;

export function isThemeScope(scope) {
  return THEME_SCOPE_RE.test(String(scope).split(' > ').pop().trim());
}

// 从样式文本里数出「主题作用域内的非 --sb-* 定义」
export function countThemeScopeForeign(text) {
  const seen = [];
  for (const d of collectDeclarations(text)) {
    if (d.name.startsWith('--sb-')) continue;
    // 顶层裸声明（不在任何块里）不是有效定义，浏览器会整条丢弃 —— 不算
    if (d.scope === ':root(top)') continue;
    if (!isThemeScope(d.scope)) continue;
    seen.push(d.name);
  }
  return { sites: seen.length, names: new Set(seen).size, list: seen };
}

function walkCss(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCss(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

test('检测器自证：认得出「新开的全局 token」，且不把合法写法算进去', () => {
  const synthetic = [
    ':root { --sb-brand-500: #7C3AED; --legacy-global: #fff; }',
    '.some-component { --local-only: #000; }',
    '[data-theme="dark"] { --legacy-dark: #000; }',
    '@media (max-width: 640px) { :root { --legacy-bp: 1px; } }',
    '--stray-top-level: 2px;',
  ].join('\n');
  const got = countThemeScopeForeign(synthetic);
  assert.deepEqual(got.list.slice().sort(), ['--legacy-bp', '--legacy-dark', '--legacy-global']);
  assert.equal(got.sites, 3);
  assert.equal(got.names, 3);
  // 逐条反证：每一类「不该算」的都必须真的没被算进去
  assert.ok(!got.list.includes('--sb-brand-500'), '--sb-* 是 V3 语言，不该计入');
  assert.ok(!got.list.includes('--local-only'), '组件作用域的自定义属性是合法的，不该计入');
  assert.ok(!got.list.includes('--stray-top-level'), '顶层裸声明不是有效定义，不该计入');
});

test('主题作用域内的非 --sb-* 定义不得超过基线（棘轮）', () => {
  const files = walkCss(path.join(ROOT, 'src'));
  assert.ok(files.length >= MIN_CSS_FILES, `扫描面塌了：只扫到 ${files.length} 个 css 文件（下限 ${MIN_CSS_FILES}）`);

  let sites = 0;
  const names = new Set();
  const byFile = new Map();
  for (const f of files) {
    const got = countThemeScopeForeign(fs.readFileSync(f, 'utf8'));
    if (!got.sites) continue;
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    byFile.set(rel, got.sites);
    sites += got.sites;
    for (const n of got.list) names.add(n);
  }
  assert.ok(sites > 0, '一个都没扫到 → 判据失效（检测器或路径出错），不允许静默通过');

  const detail = [...byFile.entries()].sort((a, b) => b[1] - a[1]).map(([f, c]) => `${f}=${c}`).join(', ');
  assert.ok(
    sites <= BASELINE_SITES,
    `主题作用域非 --sb-* 定义从基线 ${BASELINE_SITES} 涨到 ${sites} —— 新增全局 token 必须走 V3 语言（--sb-*）。明细：${detail}`,
  );
  assert.ok(
    names.size <= BASELINE_NAMES,
    `主题作用域非 --sb-* 名字数从基线 ${BASELINE_NAMES} 涨到 ${names.size}（新增名字：${[...names].length}）`,
  );
  // 基线不许被随手调高
  assert.equal(BASELINE_SITES, 165);
  assert.equal(BASELINE_NAMES, 93);
});
