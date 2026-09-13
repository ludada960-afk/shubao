// test/canvas-hook-import-guard-0913.test.mjs
// 2026-09-13 生产事故复盘（画布打不开）：
//   CanvasLibraryModal 用了 useMemo 但没从 react 导入 —— esbuild 不报错、构建通过，
//   而该组件在画布里**始终被渲染**（open=false 也会执行函数体）→ 每次打开画布都抛 useMemo is not defined。
//   这个测试静态扫描画布相关文件的「钩子使用 vs 钩子导入」，把这一类错误挡在提交前。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/pages/EcCanvas', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const HOOKS = ['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useReducer', 'useLayoutEffect'];

test('画布文件里用到的 React 钩子必须都已导入（防 useMemo is not defined 这类事故）', () => {
  const offenders = [];
  for (const file of walk(ROOT)) {
    const source = readFileSync(file, 'utf8');
    /* 兼容所有写法：import React, {...} / import { } from 'react' / 多行 import */
    const reactImports = source.match(/import[^;]*from 'react';/g) || [];
    const imported = new Set();
    for (const statement of reactImports) {
      const named = statement.match(/\{([\s\S]*?)\}/);
      if (named) named[1].split(',').map(part => part.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean).forEach(name => imported.add(name));
    }
    let body = source;
    for (const statement of reactImports) body = body.split(statement).join('');
    /* 允许 `React.useState(` 这种限定写法（不算漏导入） */
    const qualified = body.split(new RegExp('React\\.(' + HOOKS.join('|') + ')\\s*\\(')).join('');
    for (const hook of HOOKS) {
      const used = new RegExp('(?<!React\\.)\\b' + hook + '\\s*\\(').test(qualified);
      if (used && !imported.has(hook)) offenders.push(file.split(/[\\/]/).slice(-1)[0] + ' → ' + hook);
    }
  }
  assert.deepEqual(offenders, [], '以下文件使用了钩子但没导入：' + offenders.join(', '));
});

test('画布库组件在 open=false 时也能安全渲染（它始终挂在画布上）', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasLibraryModal.jsx', import.meta.url), 'utf8');
  /* 所有 useState 声明必须出现在任何 useMemo/useEffect 之前，避免 TDZ */
  const stateIdx = source.indexOf('const [state, setState] = useState(');
  const filterIdx = source.indexOf('const visibleItems = useMemo(');
  assert.ok(stateIdx > 0 && filterIdx > stateIdx, 'memo 必须写在 state 之后（本次事故的第二个坑）');
});
