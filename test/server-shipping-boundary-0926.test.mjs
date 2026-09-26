/* ═══ 门禁：**服务端不许 import 只在源码树里存在的东西**（2026-09-26 批 BW）══════════════════════
   这条门禁的由来是一次**真实的生产事故**（本批实测踩到，已回滚，生产未受影响）：

     · 我为了让 `/api/plan-preview` 按"每条 skill 自己的解析方案"组织模型请求，
       在 `server/planPreview.mjs` 里写了 `import ... from '../src/skills/parseSpecs.js'`；
     · 本地 `npm run test` 全绿、`npm run precommit` 全绿 —— 因为**本地有 `src/`**；
     · 一上生产：服务端在 **import 期**就找不到模块（MODULE_NOT_FOUND），进程起不来，
       健康检查 60 次全部 `connection refused`，部署脚本按设计**自动回滚**到上一版。

   根因在**打包清单**里（`scripts/deploy-production.ps1`，第 540 行附近）：
     发布的归档只有 `dist server shared scripts/nginx/... scripts/*.cjs scripts/*.mjs
     package.json package-lock.json ecosystem*.cjs + gallery 目录` —— **不含 `src/`**。
   也就是说：`src/` 是**只在开发机与构建期存在**的目录，服务端运行时读不到它。

   所以判据是：`server/**` 里的相对 import **必须落在会被发布的那几个目录里**
   （`server/` `shared/` `scripts/`，或同目录文件）—— 落在 `src/`（以及 `dist/`）上是红的。
   ⚠️ 与之配套的口径：**服务端与前端共用一段逻辑时，放 `shared/`**（那里真的会被发布）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));

/* 发布归档里**真的有**的目录（与 deploy-production.ps1 的打包清单一一对应；
   改那清单时必须回来改这里 —— 下面 ③ 会核对这条清单本身没写歪）。 */
const SHIPPED = new Set(['server', 'shared', 'scripts']);

function walk(directory) {
  const out = [];
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules') continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(mjs|cjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

/* 一条 import 的路径串 → 它落在哪个顶层目录（拿不到就返回 ''） */
function topLevelOf(specifier, fromFile) {
  if (!specifier.startsWith('.')) return 'external';
  const target = resolve(dirname(fromFile), specifier);
  const rel = relative(ROOT, target);
  if (rel.startsWith('..')) return 'outside';
  return rel.split(/[\\/]/)[0] || '';
}

const IMPORT_RE = /(?:^|[\s;{(])(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function importSpecifiers(source) {
  const out = [];
  for (const re of [IMPORT_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    let match = re.exec(source);
    while (match) { out.push(match[1]); match = re.exec(source); }
  }
  return out;
}

test('① server/** 的相对 import 不许落在 src/（发布归档里没有 src/，线上会起不来）', () => {
  const files = walk(join(ROOT, 'server'));
  assert.ok(files.length > 50, '样本量自证：server 下的模块数应当不少，实际 ' + files.length);
  const bad = [];
  let checked = 0;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      checked += 1;
      const top = topLevelOf(specifier, file);
      if (top === 'src' || top === 'dist') {
        bad.push(relative(ROOT, file).replace(/\\/g, '/') + ' -> ' + specifier);
      }
    }
  }
  assert.deepEqual(bad, [],
    '这些服务端模块 import 了**发布归档里不存在**的目录（线上进程会起不来）：\n' + bad.join('\n'));
  /* 也要真的扫到了 import，否则这条是空转 */
  assert.ok(checked > 100, '样本量自证：扫到的 import 条数太少，可能正则失效，实际 ' + checked);
});

test('② 自证：把 src/ 的引用塞进一段样本，判据必须红', () => {
  const sample = "import { parseSpecOf } from '../src/skills/parseSpecs.js';\nconst x = await import('../src/a.mjs');\n";
  const specifiers = importSpecifiers(sample);
  assert.deepEqual(specifiers, ['../src/skills/parseSpecs.js', '../src/a.mjs'], '两种写法都要能抓出来');
  const sampleFile = join(ROOT, 'server', 'sample.mjs');
  assert.equal(topLevelOf(specifiers[0], sampleFile), 'src', '这一条必须判红 —— 否则① 是空转');
  /* 反过来：落在会发布的目录里（server / shared / 同目录）不算违规 */
  assert.equal(topLevelOf('../shared/workPersistence.mjs', sampleFile), 'shared');
  assert.equal(topLevelOf('./planPreview.mjs', sampleFile), 'server');
  assert.equal(topLevelOf('node:fs', sampleFile), 'external');
});

test('③ 打包清单与这条门禁说的是同一件事（清单改了这里要跟着改）', () => {
  const deploy = readFileSync(join(ROOT, 'scripts', 'deploy-production.ps1'), 'utf8');
  /* 归档那一行：`dist server shared scripts/nginx/... package.json ...` */
  const line = deploy.split(/\r?\n/).find(text => /^\s*dist server shared scripts\/nginx\/shuimg\.cn\.conf/.test(text));
  assert.ok(line, '找不到打包清单那一行 —— 部署脚本改过？这条门禁要跟着改');
  for (const shipped of SHIPPED) {
    assert.match(line, new RegExp('(^|\\s)' + shipped + '(/|\\s|$)'), '打包清单里应当有 ' + shipped + '/');
  }
  assert.doesNotMatch(line, /(^|\s)src(\/|\s|$)/, '打包清单里出现了 src/ —— 那这条门禁的前提变了，要重新核对');
  /* `shared/` 里应当真的存在服务端会用的模块（否则"放 shared"这条口径是空话） */
  const sharedFiles = walk(join(ROOT, 'shared'));
  assert.ok(sharedFiles.length >= 3, 'shared/ 下的模块太少，共用逻辑该放这里，实际 ' + sharedFiles.length);
  /* 而 src/skills/parseSpecs.js 是**前端侧**的（它 import 了 imageSkills/videoSkills，前端才打得到） */
  const specs = readFileSync(join(ROOT, 'src', 'skills', 'parseSpecs.js'), 'utf8');
  assert.match(specs, /from '\.\/imageSkills\.js'/, '解析方案的声明源仍然在前端（被打进 dist）');
});
