// test/jsx-undefined-identifiers-0929.test.mjs
// 2026-09-29 批 CY-⑮。守的是**这个仓库里反复出现**的那一类缺陷：
//
//   代码里用了一个**没有 import** 的共享工具函数。
//   vite build 不做未定义标识符检查（esbuild 只转译、不解析作用域），
//   所以它能过构建、过全部单测、过 38 个 BLOCKING 门禁 ——
//   只在**真实渲染到那一行**时才抛 ReferenceError，整棵 React 树塌掉 = 白屏。
//
//   已经因此出过三次生产事故：
//     · CY-⑨  onOpenWorkbench：props 传了三层、组件签名里没接 ⇒ 文案生成框渲染即崩；
//     · CY-⑮ downloadFileName / skillName：首页图片**一生成成功就整页白屏**；
//     · （历史）selectedNode 被误删但下方 20+ 处仍在引用 ⇒ 画布打不开。
//
// ⚠️⚠️ 判据的形态换过两次，**两次都是判据自己先错**，如实记下来：
//
//   第 1 版：全文件解析「哪些标识符声明过」。默认导入（import Foo from '…'）没解析出来
//          ⇒ 把 CanvasNodeActionBar / GenSettingsPanel 全误报成「用了没 import」。
//   第 2 版：换成三条 import 规则。多行 import 块里夹注释时 [^}]* 提前截断
//          ⇒ 又把 CanvasMinimap / CanvasAddNodePanel / SaveStatusIndicator 全误报。
//   两次都是**误报**，而误报的代价是「下一个人不再相信这条门禁」——
//   一条会误报的静态检查，不如没有。
//
//   第 3 版（现在）：**不做全文件解析**。只对一张**显式清单**逐个查
//   「这个文件用了它吗？用了的话它 import 了吗」。
//     · 零误报（查的就是 import 语句本身）；
//     · 抓的正是这三次事故的形态（我们自己写的工具函数被用而没 import）；
//     · 覆盖不到「别人随手拼错的名字」——那属于类型检查该管的范畴，而本仓是 JS。
//       **如实承认这条门禁的边界**，比假装全覆盖要诚实。
//   自证用例仍然保留：判据必须对一段**故意写坏**的样本判红。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** 剥注释（同一个坑第三次：把说明当代码） */
const strip = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 这个文件有没有把 name import 进来（默认 / 具名 / 命名空间都算） */
function importsName(source, name) {
  const n = escapeRe(name);
  return [
    new RegExp('\\bimport\\s+' + n + '\\b[\\s\\S]{0,300}?\\bfrom\\b'),
    new RegExp('\\bimport\\s*\\{[^}]*\\b' + n + '\\b[^}]*\\}\\s*from'),
    new RegExp('\\bimport\\s+\\*\\s+as\\s+' + n + '\\b'),
  ].some(re => re.test(source));
}

/** 我们自己写的、跨文件复用的工具函数 —— 事故就出在这一类上 */
const SHARED_TOOLS = [
  'downloadFileName',
  'layoutSheetFileName',
  'deliveryNameFor',
  'safeDeliveryName',
  'looksLikeContentHash',
  'resolveProtocolRatio',
  'resolveAdaptiveRatio',
  'nearestLegalRatio',
  'toggleCanvasComposerSurface',
  'closeCanvasComposerSurface',
  'exactMediaRatio',
  'mediaRatioFor',
];

const TARGETS = [
  'src/pages/Home/VisualCreationMode.jsx',
  'src/pages/EcStudio/index.jsx',
  'src/pages/EcAuto/index.jsx',
  'src/pages/MediaCreation/index.jsx',
  'src/pages/EcCanvas/index.jsx',
  'src/pages/EcCanvas/components/CanvasStudio.jsx',
  'src/pages/EcCanvas/browserFileDelivery.js',
];

/** 这个文件**自己**声明了这个名字吗（function / const / class） */
function declaresLocally(source, name) {
  const n = escapeRe(name);
  return new RegExp('(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|class)\\s+' + n + '\\b').test(source);
}

/** 这个文件用了哪些共享工具（按调用出现，不看 import 行；本地声明的不算"外部依赖"） */
const usedTools = source => SHARED_TOOLS.filter(
  tool => new RegExp('\\b' + escapeRe(tool) + '\\s*\\(').test(strip(source))
    && !declaresLocally(strip(source), tool),
);

test('被用到的共享工具函数，在用的文件里一定 import 了', () => {
  const bad = [];
  for (const file of TARGETS) {
    const source = strip(read(file));
    for (const tool of usedTools(source)) {
      if (importsName(source, tool)) continue;
      bad.push(file + ': 用了 ' + tool + ' 但没有 import');
    }
  }
  assert.deepEqual(bad, [],
    '这些共享工具被用了但没有 import ⇒ 渲染到那一行就 ReferenceError 白屏：\n  ' + bad.join('\n  '));
});

test('自证：判据能抓到真的漏 import（用一段故意写坏的样本）', () => {
  /* 门禁最危险的失败模式是「永远绿」。这里拿一段故意写坏的样本喂给它，必须判红。
     判据是纯函数，样本直接调它 —— 不依赖磁盘上的任何文件。 */
  const broken = [
    "import React from 'react';",
    "function Demo() {",
    "  return <a download={downloadFileName({ url: 'u' })}>x</a>;",
    "}",
  ].join('\n');
  const withImport = "import { downloadFileName } from './m.js';\n" + broken;

  assert.deepEqual(usedTools(broken), ['downloadFileName'], '样本里的调用必须被认出来');
  assert.equal(importsName(strip(withImport), 'downloadFileName'), true, '有 import 时必须判绿');
  assert.equal(importsName(strip(broken), 'downloadFileName'), false, '没有 import 时必须判红（它能抓事故的原因）');
  /* 注释里出现不算「用」—— 同一个坑第三次 */
  assert.deepEqual(usedTools(strip('// 用 downloadFileName 命名\n/* downloadFileName( */')), [],
    '注释里提到不算用');
});

test('同一批的另一个 P0：「自适应」不许被尺寸过滤器吃掉', () => {
  /* 用户原话：「是不是应该在尺寸的最前面加入一个？自适应的一个选项。」
     上一批把这一档加进了 VISUAL_RATIO_OPTIONS，但下面那行 filter 把它吃了：
       VISUAL_RATIO_OPTIONS.filter(option => IMAGE_RATIOS.includes(option.id))
     「自适应」是**选项不是尺寸**（它不进 IMAGE_RATIOS）⇒ 首页图片面板根本看不到它。 */
  const vcm = strip(read('src/pages/Home/VisualCreationMode.jsx'));
  assert.match(vcm, /option\.adaptive \|\| IMAGE_RATIOS\.includes\(option\.id\)/,
    '带 adaptive 标记的选项必须放行，否则「自适应」在首页是不可见的');
  const model = read('src/pages/Home/visualCreationModel.js');
  assert.match(model, /id:\s*'自适应'[\s\S]{0,60}adaptive:\s*true/,
    '「自适应」这一档必须带 adaptive 标记（它就是靠这个标记绕过尺寸过滤器的）');
});
