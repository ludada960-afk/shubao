import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import parser from '@babel/parser';
import traverseModule from '@babel/traverse';

/* ═══ 渲染期 TDZ 门禁（2026-09-16 起为硬门禁）══════════════════════════════════
   起因是线上白屏 P0：SkillLibraryModal 里

     useLayoutEffect(() => { … }, [open, kind, editing]);   // 第 61 行
     …
     const editing = Boolean(draft.id);                      // 第 115 行

   依赖数组在**渲染期求值**，而 editing 要到第 115 行才初始化 —— React 抛
   `ReferenceError: Cannot access 'editing' before initialization`，整页落到错误边界。
   构建绿、单测全绿、资源哈希逐字一致，页面却是白的（当时的「上线验证」只核对了
   HTTP 200 / 符号链接 / 哈希，没有真的渲染过页面）。

   判据（只抓真正会炸的一类，不制造噪声）：
   同一个函数作用域内，某个 const/let 的**引用点早于它的声明点**，且该引用点最近的
   外层函数就是声明所在的那个函数 —— 这种引用在该函数执行时求值，必然抛 TDZ。
   嵌套闭包里的「先用后声明」不算（那是晚执行的，属正常写法）。
   ⚠️ 成员访问要同时排除 MemberExpression 与 OptionalMemberExpression（`a?.b`），
   否则 `payload?.message` 会被误报成引用了局部变量 message。 */
const traverse = traverseModule.default || traverseModule;

export function findTdzUses(code, filename = 'inline.jsx') {
  const findings = [];
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  } catch {
    return { findings, parsed: false };
  }
  traverse(ast, {
    Function(fnPath) {
      const body = fnPath.node.body;
      if (!body || body.type !== 'BlockStatement') return;
      const declared = new Map();
      for (const statement of body.body) {
        if (statement.type !== 'VariableDeclaration' || statement.kind === 'var') continue;
        for (const declarator of statement.declarations) {
          if (declarator.id.type === 'Identifier') declared.set(declarator.id.name, declarator.start);
        }
      }
      if (!declared.size) return;
      fnPath.traverse({
        Identifier(idPath) {
          const name = idPath.node.name;
          if (!declared.has(name)) return;
          if (idPath.node.start >= declared.get(name)) return;
          const parent = idPath.parent;
          if (parent.type === 'VariableDeclarator' && parent.id === idPath.node) return;
          if (parent.type === 'ObjectProperty' && parent.key === idPath.node && !parent.computed) return;
          if ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression')
            && parent.property === idPath.node && !parent.computed) return;
          if (idPath.getFunctionParent() !== fnPath) return;
          const binding = idPath.scope.getBinding(name);
          if (!binding || binding.path.node.start !== declared.get(name)) return;
          findings.push({
            file: filename,
            name,
            line: idPath.node.loc?.start.line,
            declareLine: code.slice(0, declared.get(name)).split('\n').length,
          });
        },
      });
    },
  });
  return { findings, parsed: true };
}

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) { if (entry !== 'node_modules') sourceFiles(full, acc); continue; }
    if (/\.(jsx?|mjs)$/.test(entry)) acc.push(full);
  }
  return acc;
}

test('① 检测器自证：白屏那种写法必须被抓到，改好之后必须消失', () => {
  const buggy = [
    'function Widget({ open, kind }) {',
    '  useLayoutEffect(() => { measure(); }, [open, kind, editing]);',
    '  const editing = Boolean(open);',
    '  return editing;',
    '}',
  ].join('\n');
  const buggyResult = findTdzUses(buggy, 'buggy.jsx');
  assert.equal(buggyResult.parsed, true);
  assert.equal(buggyResult.findings.length, 1, '依赖数组引用后面才声明的 const 必须被抓到');
  assert.equal(buggyResult.findings[0].name, 'editing');
  assert.equal(buggyResult.findings[0].line, 2);
  assert.equal(buggyResult.findings[0].declareLine, 3);

  const fixed = [
    'function Widget({ open, kind }) {',
    '  const editing = Boolean(open);',
    '  useLayoutEffect(() => { measure(); }, [open, kind, editing]);',
    '  return editing;',
    '}',
  ].join('\n');
  assert.equal(findTdzUses(fixed, 'fixed.jsx').findings.length, 0);
});

test('② 不误伤：嵌套闭包、成员访问、解构与提升声明都不算违规', () => {
  const safe = [
    'function Panel({ payload, job }) {',
    '  const label = payload?.message || job?.total;',   // 可选成员访问
    '  const later = () => run();',                        // 嵌套闭包里引用后面才声明的 run
    '  const run = () => 1;',
    '  var hoisted = 1;',
    '  function inner() { return hoisted; }',
    '  const { count = 1 } = payload || {};',
    '  return [label, later, run, inner, count];',
    '}',
  ].join('\n');
  const result = findTdzUses(safe, 'safe.jsx');
  assert.equal(result.parsed, true);
  assert.deepEqual(result.findings, []);
});

test('③ 全部源码零违规，且真的扫到了文件（不是空跑通过）', () => {
  const files = sourceFiles('src');
  assert.ok(files.length > 200, '样本量异常：只扫到 ' + files.length + ' 个文件');
  const parsed = [];
  const violations = [];
  for (const file of files) {
    const result = findTdzUses(readFileSync(file, 'utf8'), file);
    if (result.parsed) parsed.push(file);
    for (const finding of result.findings) violations.push(finding);
  }
  assert.ok(parsed.length / files.length > 0.95, '解析成功率异常：' + parsed.length + '/' + files.length);
  assert.deepEqual(
    violations,
    [],
    '发现渲染期「先用后声明」：\n' + violations.map(v => `  ${v.file}:${v.line} ${v.name}（声明在第 ${v.declareLine} 行）`).join('\n'),
  );
});
