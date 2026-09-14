// scripts/lib/clickable-div-scan.mjs
// ═══════════════════════════════════════════════════════════════════════════
// 「非交互元素可点」扫描器 —— **全仓唯一实现**（原则 §12：同一判据不得有两个数）。
//
// 消费者：
//   · test/no-clickable-div.test.mjs   —— 门禁（未登记违规必须为 0）
//   · scripts/design-audit.mjs         —— 自查看板（报严格口径 N 与未登记 M 两个数）
//   · scripts/clickable-div-ratchet.mjs（如需）
//
// 判据（不是写法）：**元素用键盘到不到得了** —— 不可 Tab、不可 Enter/Space 触发。
//   真控件（button/a/input/select/textarea/summary/details/label）→ 放行；
//   显式 role="button" + tabIndex + onKeyDown 三者齐全 → 视为键盘可达，放行；
//   其余（div/span/li/tr/article/section/form/img… 挂 onClick）→ 命中。
//
// 自定义组件（大写开头）必须解析其**根元素**：
//   <IconButton> 渲染 <button> 不算命中，<GCard> 渲染 <div onClick> 算 ——
//   只看调用点会**同时产生误报（IConButton）与漏报（GCard）**。
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const INTERACTIVE = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'details', 'label',
]);

/** 递归收集源码文件（排除 node_modules / dist / 点目录）。 */
export function walkSource(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walkSource(p, out);
    else if (/\.(jsx|tsx|js|ts)$/.test(e)) out.push(p);
  }
  return out;
}

/**
 * 建立「自定义组件名 → 根元素标签」映射。
 * 用于区分 <IconButton>（渲染 button，不命中）与 <GCard>（渲染 div，命中）。
 */
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

/**
 * 从 start 处的 '<' 起，按 **括号/引号平衡** 找到 JSX 起始标签的结束位置。
 *
 * 为什么不能简单用 /<tag([^>]*?)>/：
 *   箭头函数 `onKeyDown={event => …}` 里的 `>` 会让 [^>]*? 提前终止，
 *   导致后续属性（尤其 onKeyDown）读不到 —— 会把**已合规**的写法误判为违规。
 *   实测：DirectorWorkbench 的 <article role="button" tabIndex onClick onKeyDown>
 *   因该缺陷被误报（会把好代码"改坏"）。
 * @returns { end: 索引（指向 '>' 之后）, attrs: 属性文本 } | null
 */
export function readStartTag(src, start) {
  let i = start + 1;
  // 标签名
  while (i < src.length && /[a-zA-Z0-9-]/.test(src[i])) i++;
  const attrsFrom = i;
  let depth = 0;          // {} () [] 的综合深度
  let quote = null;       // 当前处于哪种引号内
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; i++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; i++; continue; }
    if (c === '>' && depth <= 0) return { end: i + 1, attrs: src.slice(attrsFrom, i) };
    i++;
  }
  return null;
}

/** 剥掉注释（等长空白替换，保留行号与原文字符偏移）。 */
function stripComments(srcRaw) {
  return srcRaw
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/**
 * 找出「非交互元素挂 onClick」的位置。
 * @returns [{ line, tag, note, snippet, feature }]
 *   feature —— 元素特征串，用于白名单稳定定位（见 matchWhitelist）。
 */
export function findClickableNonInteractive(srcRaw, rootOf = new Map()) {
  const src = stripComments(srcRaw);
  const hits = [];
  const openRe = /<([a-zA-Z][a-zA-Z0-9-]*)\b/g;
  let m;
  while ((m = openRe.exec(src))) {
    const parsed = readStartTag(src, m.index);
    if (!parsed) continue;
    // 跳过闭合标签/注释/字符串里的 '<'（readStartTag 已按平衡解析）
    const rawTag = m[1];
    const tag = rawTag.toLowerCase();
    const attrs = parsed.attrs;
    const tagText = src.slice(m.index, parsed.end);
    if (!/\bonClick\b/.test(attrs)) continue;
    if (INTERACTIVE.has(tag)) continue;
    /* role / tabIndex 有两种写法，都要认：
       ① 直接属性        role="button" / tabIndex={0}
       ② **spread 提供**  {...(interactive ? { role: 'button', tabIndex: 0 } : {})}
       只认 ① 会把 Card 这类"条件展开"的合规实现误判为违规
       （本仓 src/components/ui/index.jsx 的 Card 即此写法）。 */
    /* role 有三种写法：
       ① role="button"                                 —— 直接属性
       ② { role: 'button', tabIndex: 0 }               —— spread 对象字面量
       ③ { role: cond ? 'button' : undefined, … }      —— spread + 三元（本仓 Card 写法）
       ②③ 若只认 ① 会把"条件提供无障碍语义"的合规实现误判为违规。 */
    const hasRole = /role\s*=\s*['"]button['"]/.test(attrs)
      || /role\s*:\s*['"]button['"]/.test(attrs)
      || /role\s*:[^,}]*\?\s*['"]button['"]/.test(attrs);
    const hasTabIndex = /tabIndex\s*=/.test(attrs)
      || /tabIndex\s*:/.test(attrs);                        // spread 对象字面量写法
    const hasKeyDown = /onKeyDown\s*=/.test(attrs);
    if (hasRole && hasTabIndex && hasKeyDown) continue;
    let note = '';
    if (/^[A-Z]/.test(rawTag)) {
      const root = rootOf.get(rawTag);
      if (root && INTERACTIVE.has(root)) continue;
      const dyn = new RegExp('const\\s+' + rawTag + '\\s*=\\s*onClick\\s*\\?\\s*[\'"]button[\'"]').test(src);
      if (dyn) continue;
      note = root ? ('组件 ' + rawTag + ' 根元素 <' + root + '>') : ('组件 ' + rawTag + ' 根元素未解析');
    }
    const line = src.slice(0, m.index).split('\n').length;
    hits.push({
      line, tag: rawTag, note,
      snippet: tagText.replace(/\s+/g, ' ').slice(0, 110),
      feature: featureOf(tagText),
    });
  }
  return hits;
}

/**
 * 从一段起始标签文本里抽取「元素特征串」，用于白名单稳定定位。
 * 优先级：aria-label > id > data-testid > class 片段（前 2 个类）> 无。
 * 行号会随编辑漂移，特征串不会。
 */
export function featureOf(tagText) {
  // 字面量属性优先
  const lit = tagText.match(/aria-label\s*=\s*["']([^"']+)["']/);
  if (lit) return 'aria-label=' + lit[1];
  const id = tagText.match(/\bid\s*=\s*["']([^"']+)["']/);
  if (id) return 'id=' + id[1];
  const tid = tagText.match(/data-testid\s*=\s*["']([^"']+)["']/);
  if (tid) return 'data-testid=' + tid[1];
  // JSX 表达式属性：取属性**名**作为特征（值可能随数据变化，名是稳定的）
  for (const attr of ['data-testid', 'data-gallery-card', 'aria-label', 'data-a11y-id', 'name']) {
    const re = new RegExp('\\b' + attr + '\\s*=\\s*\\{');
    if (re.test(tagText)) return attr + '={…}';
  }
  const cls = tagText.match(/className\s*=\s*["']([^"']+)["']/);
  if (cls && cls[1].trim()) return 'class=' + cls[1].trim().split(/\s+/).slice(0, 2).join(' ');
  // className={...} 表达式形式
  if (/className\s*=\s*\{/.test(tagText)) return 'className={…}';
  return '';
}

/**
 * 白名单匹配：**优先按元素特征串**（aria-label > id > data-testid > class），
 * 特征串缺失时回退到 line（并允许 ±30 行容差，因多行 JSX 属性可跨行）。
 *
 * 为什么不用纯行号：编辑会让行号漂移，白名单会「假悬空」；
 * 为什么不用整文件放行：那等于给整个文件开后门，丧失门禁意义。
 */
export function matchWhitelist(hit, entry) {
  if (entry.feature) {
    if (hit.feature && hit.feature === entry.feature) return true;
    return false;   // 声明了特征串就必须精确匹配到**该元素**
  }
  return typeof entry.line === 'number' && Math.abs(hit.line - entry.line) <= 30;
}

/**
 * 扫描整个仓库，返回分类结果。**这是全仓唯一的可点元素扫描入口**。
 * @returns { strict, violations, scannedFiles, onClickFiles, whitelisted }
 *   strict      —— 严格口径：所有「非交互元素挂 onClick」总数
 *   violations  —— 其中未登记（= 真实缺陷）
 *   whitelisted —— 命中白名单的条目（含理由）
 */
export function scanRepo({ root, srcDir, whitelist }) {
  const files = walkSource(srcDir);
  const rootOf = buildComponentRootMap(files);
  const entries = (whitelist && whitelist.entries) || [];
  const strict = [];
  const violations = [];
  const whitelisted = [];
  let onClickFiles = 0;
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const src = readFileSync(f, 'utf8');
    if (!src.includes('onClick')) continue;
    onClickFiles++;
    for (const h of findClickableNonInteractive(src, rootOf)) {
      const item = { ...h, file: rel };
      strict.push(item);
      const entry = entries.find(e => e.file === rel && matchWhitelist(h, e));
      if (entry) whitelisted.push({ ...item, reason: entry.reason });
      else violations.push(item);
    }
  }
  return { strict, violations, whitelisted, scannedFiles: files.length, onClickFiles };
}