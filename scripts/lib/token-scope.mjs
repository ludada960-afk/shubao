// scripts/lib/token-scope.mjs
// ─────────────────────────────────────────────────────────────────────────────
// **按作用域**读取 CSS 自定义属性 —— 口径只有这一份。
// 为什么必须按作用域：同一个 token 在 `:root` 与 `[data-theme="dark"]` 下**本来就该有不同值**；
// 拿「最后一个匹配」去比对比度，会把暗色主题的浅紫 (`--sb-ink-brand: #C4B5FD`) 拿去和**白底**比，
// 报出「1.85:1 严重不达标」——**那不是缺陷，是度量口径错误**（真实事故，已致一次错误裁定）。
//
// 为什么抽成模块：审计脚本（scripts/design-audit.mjs）与门禁测试
// （test/token-no-duplicate-definitions.test.mjs）必须共用同一份解析，否则迟早漂移。
// ─────────────────────────────────────────────────────────────────────────────

/** 剥注释但**保留换行**（否则行号会漂），统一行尾 */
export const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, s => s.replace(/[^\n]/g, ' ')).replace(/\r\n?/g, '\n');

/**
 * 逐字符扫描：花括号配对跟踪作用域，收集每条 `--x: value;` 声明（不要求独占一行）。
 * 返回 { name, value, line, scope }[]；scope 形如 `:root(top)` / `@media (max-width: 640px) > :root`。
 */
export function collectDeclarations(text) {
  const src = stripComments(text);
  const out = [];
  const stack = [];
  let pending = '';
  let buf = '';
  let bufLine = 1;
  let line = 1;
  let parens = 0;
  const flush = () => {
    const m = /^(--[a-zA-Z0-9-]+)\s*:\s*([\s\S]+)$/.exec(buf.trim());
    if (m) {
      out.push({
        name: m[1],
        value: m[2].trim().replace(/\s+/g, ' '),
        line: bufLine,
        scope: stack.length ? stack.join(' > ') : ':root(top)',
      });
    }
    buf = '';
  };
  for (const ch of src) {
    if (ch === '\n') { line++; continue; }
    if (ch === '(') { parens++; if (stack.length) buf += ch; else pending += ch; continue; }
    if (ch === ')') { parens = Math.max(0, parens - 1); if (stack.length) buf += ch; else pending += ch; continue; }
    if (ch === '{') {
      // 嵌套块的选择器在 buf 里（进入块之后字符都被收进 buf），顶层块的选择器在 pending 里。
      // 曾经的实现只看 pending，于是 @media (…) { :root { … } } 一律被记成
      // `@media (…) > ?` —— 与本文档承诺的 `@media (…) > :root` 不符，
      // 让**媒体查询里的全局 token 定义**对审计与门禁隐形（55 条声明受影响）。
      const sel = (buf.trim() || pending.trim()).replace(/\s+/g, ' ').slice(-60);
      stack.push(sel || '?');
      pending = ''; buf = '';
    } else if (ch === '}') {
      flush();
      stack.pop(); pending = '';
    } else if (ch === ';') {
      if (stack.length && parens === 0) flush(); else { buf = ''; pending = ''; }
    } else if (stack.length) {
      if (!buf.trim() && /\S/.test(ch)) bufLine = line;
      buf += ch;
    } else {
      pending += ch;
    }
  }
  return out;
}

/** 取「首个定义」作为权威，解析 var() 链（最多 8 跳防环） */
export function makeResolver(decls) {
  const base = new Map();
  for (const d of decls) if (!base.has(d.name)) base.set(d.name, d.value);
  const resolve = (v, depth = 0) => {
    if (depth > 8) return v;
    const m = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,([\s\S]+))?\)$/.exec(String(v).trim());
    if (!m) return String(v).trim();
    if (base.has(m[1])) return resolve(base.get(m[1]), depth + 1);
    return m[2] ? resolve(m[2], depth + 1) : String(v).trim();
  };
  return resolve;
}

/**
 * 取某个 token 在**指定作用域**下的解析值（只在该作用域内解析 var 链，不会掉进别的主题）。
 * @param {string} text CSS 全文
 * @param {string} name token 名（含 --）
 * @param {(scope: string) => boolean} [scopeOk] 作用域过滤（默认：只接受不含 media 的顶层 :root）
 * @returns {string|null} 形如 `#7C3AED` / `2px`；找不到返回 null
 */
export function scopedValue(text, name, scopeOk = (s) => s === ':root') {
  const decls = collectDeclarations(text);
  const inScope = decls.filter(d => d.name === name && scopeOk(d.scope));
  if (!inScope.length) return null;
  const base = new Map();
  for (const d of decls) if (!base.has(d.name)) base.set(d.name, d.value);
  const resolve = (v, depth = 0) => {
    if (depth > 8) return v;
    const m = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,([\s\S]+))?\)$/.exec(String(v).trim());
    if (!m) return String(v).trim();
    if (base.has(m[1])) return resolve(base.get(m[1]), depth + 1);
    return m[2] ? resolve(m[2], depth + 1) : String(v).trim();
  };
  return resolve(inScope[inScope.length - 1].value);
}

/** 常用作用域判断：顶层 `:root`（不含任何 @media/@supports 包裹） */
export const isTopRoot = (s) => s === ':root';
/** 暗色主题块 */
export const isDarkTheme = (s) => /\[data-theme="dark"\]/.test(s);
