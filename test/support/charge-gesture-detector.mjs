// 检测器：判定「扣费是否由显式用户手势触发」。
//
// 铁律 ①（用户明令）：**没有用户确认，绝不扣费**。
//
// 判据（不锁写法 —— RTK §3.1-10：契约测试锁判据，不锁写法）：
//   从任一「扣费调用点」出发，沿**调用链向上**追溯，必须能到达一次显式用户手势
//   （JSX onXxx 处理器 / 命名处理器 / dialog.confirm），
//   且沿途**不得**经过 useEffect 这类副作用钩子（那等于「渲染即扣费」）。
//
// 为什么必须传递追溯：`services/api.js` 的 `regenerateImage()` 是**实现层**，
//   它算不算「用户触发」取决于**谁调它** —— 可能是 onClick，也可能是 useEffect。
//   只看最近的词法外层函数会把服务层包装器全部误判（假阳性）。
import { parse } from '@babel/parser';

const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect', 'useMemo']);
const NAMED_HANDLER = /^(handle|do|go|on|submit|confirm|start|run|trigger)[A-Z_]/;

export function parseModule(source) {
  return parse(source, {
    sourceType: 'module', plugins: ['jsx'],
    errorRecovery: true, allowReturnOutsideFunction: true,
  });
}

export function buildParents(ast) {
  const parents = new WeakMap();
  (function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const c of node) walk(c, parent); return; }
    if (node.type) parents.set(node, parent);
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      walk(node[k], node);
    }
  })(ast, null);
  return parents;
}

const isFn = n => Boolean(n) && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression'
  || n.type === 'ArrowFunctionExpression' || n.type === 'ObjectMethod' || n.type === 'ClassMethod');

export function enclosingFunction(node, parents) {
  let cur = node;
  while (cur) {
    const p = parents.get(cur);
    if (isFn(p)) return p;
    cur = p;
  }
  return null;
}

export function fnName(fnNode, parents) {
  if (!fnNode) return '(top-level)';
  if (fnNode.type === 'FunctionDeclaration' && fnNode.id) return fnNode.id.name;
  const p = parents.get(fnNode);
  if (p?.type === 'VariableDeclarator' && p.id?.name) return p.id.name;
  if (p?.type === 'ObjectProperty' && p.key?.name) return p.key.name;
  if (p?.type === 'AssignmentExpression' && p.left?.name) return p.left.name;
  return '(anonymous)';
}

export function effectAncestor(node, parents) {
  let cur = node;
  while (cur) {
    const p = parents.get(cur);
    if (p?.type === 'CallExpression') {
      const c = p.callee;
      const nm = c?.type === 'Identifier' ? c.name : c?.type === 'MemberExpression' ? c.property?.name : '';
      if (EFFECT_HOOKS.has(nm)) return nm;
    }
    cur = p;
  }
  return null;
}

export function hasConfirm(fnNode, source) {
  if (!fnNode) return false;
  return /dialog\.confirm\(|window\.confirm\(|\bconfirm\(/.test(source.slice(fnNode.start, fnNode.end));
}

/** 函数是否被 onXxx 属性引用（JSX 或对象字面量）。 */
export function referencedAsHandler(fnNode, parents, source) {
  const p = parents.get(fnNode);
  let ident = null;
  if (p?.type === 'VariableDeclarator' && p.id?.name) ident = p.id.name;
  else if (fnNode?.type === 'FunctionDeclaration' && fnNode.id) ident = fnNode.id.name;
  if (!ident) return null;
  if (new RegExp('on[A-Z][A-Za-z]*=\\{[^}]*\\b' + ident + '\\b').test(source)) return 'jsx-on';
  if (new RegExp('on[A-Z][A-Za-z]*:\\s*' + ident + '\\b').test(source)) return 'object-on';
  return null;
}

/**
 * 单文件索引：所有调用点 + 每个调用点的「手势证据」。
 * @returns Array<{callee,line,fnName,inEffect,gestureAttr,handlerRef,confirmed,fnStart,fnEnd}>
 */
export function indexCalls(source, filePath) {
  const ast = parseModule(source);
  const parents = buildParents(ast);
  const out = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const c of node) walk(c); return; }
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
      const fnNode = enclosingFunction(node, parents);
      let gestureAttr = null;
      let cur2 = node;
      while (cur2) {
        const p2 = parents.get(cur2);
        if (p2?.type === 'JSXAttribute' && p2.name?.name && /^on[A-Z]/.test(p2.name.name)) { gestureAttr = p2.name.name; break; }
        if (p2?.type === 'ObjectProperty' && p2.key?.name && /^on[A-Z]/.test(p2.key.name)) { gestureAttr = p2.key.name; break; }
        cur2 = p2;
      }
      out.push({
        file: filePath,
        callee: node.callee.name,
        line: node.loc?.start?.line ?? 0,
        fnName: fnName(fnNode, parents),
        inEffect: effectAncestor(node, parents),
        gestureAttr,
        handlerRef: fnNode ? referencedAsHandler(fnNode, parents, source) : null,
        confirmed: hasConfirm(fnNode, source),
        fnStart: fnNode?.start ?? -1,
        fnEnd: fnNode?.end ?? -1,
      });
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      walk(node[k]);
    }
  })(ast);
  return out;
}

/** 从 api.js 提取所有会发起报价/扣费的导出函数名。 */
export function chargeFunctions(source) {
  const ast = parseModule(source);
  const names = [];
  const looksCharged = text => /quoteCanvasAction\(|quoteBillingAction\(|billing_quote_id|billingQuoteId/.test(text);
  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration' || !node.declaration) continue;
    const decl = node.declaration;
    if (decl.type === 'FunctionDeclaration' && decl.id && looksCharged(source.slice(decl.start, decl.end))) {
      names.push(decl.id.name);
    } else if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id?.name && d.init && looksCharged(source.slice(d.start, d.end))) names.push(d.id.name);
      }
    }
  }
  return names.filter(n => n !== 'quoteCanvasAction');
}

export { NAMED_HANDLER };

/**
 * 传递追溯：给定「某文件里某函数名」，在**全仓调用索引**里向上找手势证据。
 * @param graph  Map<'file#fn', Array<site>>  —— 调用点按「被调用函数名」聚合
 * @param resolveFile 返回该函数名可能的定义文件（服务层用）
 * @returns {{ origin, blockedBy, path }}
 */
export function traceUp(startFile, startFn, graph, maxHops = 12, startSite = null) {
  const visited = new Set();
  const path = [];
  /* 起点自身可能就是手势/确认点（内联 onClick 箭头、命名处理器、带 confirm 的函数）。 */
  if (startSite) {
    if (startSite.inEffect) return { origin: null, blockedBy: startSite.inEffect, path: [startFile + ':' + startSite.line] };
    if (startSite.confirmed) return { origin: 'confirm', blockedBy: null, path: [startFile + ':' + startSite.line] };
    if (startSite.gestureAttr) return { origin: 'event', blockedBy: null, path: [startFile + ':' + startSite.line] };
    if (startSite.handlerRef) return { origin: 'event', blockedBy: null, path: [startFile + ':' + startSite.line] };
    if (NAMED_HANDLER.test(startFn)) return { origin: 'event', blockedBy: null, path: [startFile + '#' + startFn] };
  }
  let cursorFile = startFile;
  let cursorFn = startFn;
  for (let hop = 0; hop < maxHops; hop += 1) {
    const key = cursorFile + '#' + cursorFn;
    if (visited.has(key)) break;
    visited.add(key);
    path.push(key);
    const sites = graph.get(cursorFn) || [];
    /* 只在「定义文件之外」的地方找调用者；同一文件内的定义行不算调用。 */
    const caller = sites.find(s => !(s.file === cursorFile && s.fnStart <= s.line && s.line <= s.fnEnd && s.fnName === cursorFn));
    if (!caller) return { origin: null, blockedBy: null, path };
    if (caller.inEffect) return { origin: null, blockedBy: caller.inEffect, path: path.concat(caller.file + ':' + caller.line) };
    if (caller.confirmed) return { origin: 'confirm', blockedBy: null, path: path.concat(caller.file + ':' + caller.line) };
    if (caller.gestureAttr) return { origin: 'event', blockedBy: null, path: path.concat(caller.file + ':' + caller.line) };
    if (caller.handlerRef) return { origin: 'event', blockedBy: null, path: path.concat(caller.file + ':' + caller.line) };
    if (NAMED_HANDLER.test(caller.fnName)) return { origin: 'event', blockedBy: null, path: path.concat(caller.file + '#' + caller.fnName) };
    cursorFile = caller.file;
    cursorFn = caller.fnName;
    if (cursorFn === '(anonymous)' || cursorFn === '(top-level)') return { origin: null, blockedBy: null, path };
  }
  return { origin: null, blockedBy: null, path };
}
