import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/* ═══ 渲染期 TDZ 门禁（2026-09-17）═══════════════════════════════════════════════
   起因：同一个坑在同一个文件里踩了**两次**。
   现象：新加的 `useEffect` / `useMemo` 把某个 const 放进依赖数组，
        而那个 const 声明在**下面** → 依赖数组是在**渲染期**求值的 →
        `Cannot access 'x' before initialization` → **整页落错误边界**（白屏）。
   这不是新坑：2026-09-16 线上白屏事故就是同一类（SkillLibraryModal 的 TDZ）。
   为什么静态可查：`const/let` 有暂时性死区，而**函数声明会提升** ——
   所以规则很干净：**依赖数组里出现的 const/let 绑定，必须在它之前就已声明。**
   为什么用源码断言而不是只靠渲染冒烟：冒烟只跑首页；这个坑最先出现在子页面上。 */

const FILES = [
  'src/pages/MediaCreation/index.jsx',
  'src/pages/Home/SkillWorkbench.jsx',
  'src/pages/Home/MediaHub.jsx',
  'src/components/media/CaseCard.jsx',
  'src/components/media/FieldRenderer.jsx',
  'src/components/media/WorkbenchShell.jsx',
];

/** 收集依赖数组：`}, [a, b, c]);` 形式（只认单行、无嵌套括号，够用且不会误报） */
function dependencyArrays(source) {
  const found = [];
  const re = /\}\s*,\s*\[([^\]]*)\]\s*\)/g;
  let match;
  while ((match = re.exec(source))) {
    const names = match[1].split(',').map(part => part.trim().split(/[\s.:(]/)[0]).filter(Boolean);
    found.push({ at: match.index, names });
  }
  return found;
}

/** 每个 const/let 绑定被声明的位置（函数声明会提升，不在其中） */
function letBindings(source) {
  const map = new Map();
  const re = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = re.exec(source))) {
    if (!map.has(match[1])) map.set(match[1], match.index);   /* 只记最早一次 */
  }
  return map;
}

test('依赖数组里不许出现"下面才声明"的 const/let（渲染期 TDZ = 整页白屏）', () => {
  const offenders = [];
  for (const file of FILES) {
    const source = readFileSync(file, 'utf8');
    const bindings = letBindings(source);
    for (const { at, names } of dependencyArrays(source)) {
      for (const name of names) {
        const declaredAt = bindings.get(name);
        if (declaredAt == null) continue;              /* import / props / 解构，不受此规则管 */
        if (declaredAt > at) offenders.push(file + '：依赖数组用了后面才声明的 ' + name);
      }
    }
  }
  assert.deepEqual(offenders, [], '依赖数组在渲染期求值，引用后面的 const 会直接崩页面：\n' + offenders.join('\n'));
});

test('门禁自证：反例必须被判红、正例必须放行', () => {
  const bad = 'function A(){ const [x] = useState(); useEffect(()=>{}, [later]); const later = 1; return x; }';
  const good = 'function A(){ const later = 1; const [x] = useState(); useEffect(()=>{}, [later]); return x; }';
  const check = source => {
    const bindings = letBindings(source);
    return dependencyArrays(source).some(({ at, names }) => names.some(name => {
      const declaredAt = bindings.get(name);
      return declaredAt != null && declaredAt > at;
    }));
  };
  assert.equal(check(bad), true, '反例必须被判红（否则这条门禁是摆设）');
  assert.equal(check(good), false, '正例必须放行');
});
