import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { VIDEO_WORKBENCHES } from '../src/skills/videoWorkbenches.js';
import {
  QUANTV_VIDEO_COUNTERPARTS,
  quantvVideoShowsParamGroup,
} from '../src/skills/quantvVideoParity.js';
import { workbenchExtraInstructions } from '../src/pages/VideoStudio/cameraMoves.js';

/* ═══ 批 S（2026-09-21）：视频子页面 ↔ 知渔「路由型页面」逐页对标的第一批差异 ══════════════
   用户铁律（逐字）：
     「我不需要你做太多原创性的东西……所有的逻辑，所有的布局，所有的规范都得是一模一样的，
       然后**不能有任何的 bug 出现**」
     「工作台**该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位**」
     「不能让一些按钮或者配置成为**死的配置**」
   本批修的两件事，各自都有实采证据（不是推断）：
     ① **幻影「换人」指令**（真 bug）：替换对象的初始值是 'model'（照知渔 /content-replace 默认档），
        而追加指令那一步是**无条件**拼进去的 ⇒ 每一个视频页面（包括没有该控件的视频创作 /
        爆款复刻 / 探店视频）下发的提示词末尾都带着「把原片里的人物替换成我上传的人物图片…」，
        界面还照实写着「将追加到提示词：…」。用户从没选过它，那几页也没有"原片"可换。
        同一处的依赖数组还漏了 swapTarget（点了「换产品」提示词仍是「换模特」）。
     ② **多出来的「参数配置」组头**：批 Q-⑥ 按 **app 页**实测加了它，但知渔的**路由型页面**
        左栏没有这一行。32 个子页面**逐条计数**（下面就是那次计数的机检复现）。
   证据：docs/design/data/quantv-video-pages.json（31 个子页面 + 内容替换 app 的 DOM 全文实采）。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const evidence = JSON.parse(read('docs/design/data/quantv-video-pages.json'));
const component = read('src/components/media/VideoWorkbench.jsx');
const studio = stripComments(read('src/pages/VideoStudio/index.jsx'));
const media = stripComments(read('src/pages/MediaCreation/index.jsx'));
const pageByTitle = new Map(evidence.pages.map(page => [page.title, page]));
const textOf = title => String(pageByTitle.get(title)?.panelText || '');

test('① 幻影指令：追加进提示词的指令只允许来自**这一页真的渲染了**的控件', () => {
  /* 声明了「替换对象」这一格的技能清单 —— 它变了就说明有页面新增/删除了这个控件，
     必须有实测依据（知渔 31 个子页面里只有 /content-replace 有这一格） */
  const swapSkills = Object.entries(VIDEO_WORKBENCHES)
    .filter(([, spec]) => (spec.blocks || []).some(block => block.bind === 'swapMode'))
    .map(([id]) => id);
  assert.deepEqual(swapSkills, ['video.content_swap'],
    '声明了「替换对象」的技能清单变了 —— 知渔只有 /content-replace 那一页有它：' + swapSkills.join(' / '));
  assert.match(textOf('内容替换(路由页)'), /换模特/, '那一页原文有换模特（证据）');

  /* 用户的"什么都没碰"状态：替换对象停在它声明的默认档 'model'。
     没有那一格的页面，提示词里**一个字都不许**出现替换指令。 */
  const leaking = [];
  for (const [id, spec] of Object.entries(VIDEO_WORKBENCHES)) {
    const hasSwap = (spec.blocks || []).some(block => block.bind === 'swapMode');
    const auto = workbenchExtraInstructions({ blocks: spec.blocks || [], swapTarget: 'model' });
    if (!hasSwap && auto.length) leaking.push(id + ' → ' + auto.join('；'));
  }
  assert.deepEqual(leaking, [],
    '这些页面没有「替换对象」控件，提示词里却出现了替换指令（幻影指令）：\n  ' + leaking.join('\n  '));

  /* 反向自证（门禁必须证明自己会响）：把那一格加回去，指令立刻出现；换档位，指令跟着换 */
  const withSwap = [{ kind: 'chips', bind: 'swapMode', title: '替换对象' }];
  assert.equal(workbenchExtraInstructions({ blocks: withSwap, swapTarget: 'model' }).length, 1,
    '有那一格、且默认档是「换模特」时，必须真的追加一条指令');
  assert.match(workbenchExtraInstructions({ blocks: withSwap, swapTarget: 'model' })[0], /人物图片/,
    '「换模特」增补的应该是人物那一句');
  assert.match(workbenchExtraInstructions({ blocks: withSwap, swapTarget: 'product' })[0], /商品图片/,
    '切到「换产品」必须换成商品那一句 —— 依赖数组漏项时这里会是「换模特」（原 bug 的第二半）');
  assert.deepEqual(workbenchExtraInstructions({ blocks: [{ bind: 'ratio' }], swapTarget: 'product' }), [],
    '只有比例那一格时不许追加任何替换指令');

  /* 页面侧只允许从这一个组装点取追加指令（不许再回到内联三元） */
  assert.match(studio, /workbenchExtraInstructions\(\{ blocks: workbench\?\.blocks \|\| \[\], cameraMove, sceneEdit, swapTarget \}\)/,
    'VideoStudio 必须走 cameraMoves 的唯一组装点');
  assert.match(studio, /\[workbench, cameraMove, sceneEdit, swapTarget\]/,
    '依赖数组必须含 swapTarget（漏了它 = 用户点了「换产品」而提示词还是「换模特」）');
});

test('② 「参数配置」组头：知渔 32 个子页面**逐条计数**（25 有 / 7 没有），判据从对照表派生', () => {
  /* RTK 的纪律（第 16 条）：要证"不存在"就必须打印计数，不许用截断的列表当结论。
     所以这里断言的是**计数**，不是"我抽了几条看了一下"。 */
  const pages = evidence.pages;
  assert.equal(pages.length, 32, '实采条数变了（31 个子页面 + 内容替换 app）');
  const withGroup = pages.filter(page => String(page.panelText || '').includes('参数配置'));
  const withoutGroup = pages.filter(page => !String(page.panelText || '').includes('参数配置'));
  assert.equal(withGroup.length, 25, '有「参数配置」组头的页面数变了');
  assert.equal(withoutGroup.length, 7, '没有「参数配置」组头的页面数变了');
  assert.deepEqual(withoutGroup.map(page => page.title).sort(),
    ['内容替换(路由页)', '视频创作', '爆款复刻', '探店视频', '数字人', '视频高清', '趣味脱口秀'].sort(),
    '没有组头的 7 条名单变了（6 条路由页 + 趣味脱口秀）');
  /* 7 条路由页里只有「视频字幕去除」有组头 —— 所以"路由页一律没有组头"也是错的，逐页看 */
  const routes = pages.filter(page => page.kind === 'route');
  assert.equal(routes.length, 7, '知渔视频侧路由页是 7 条');
  assert.deepEqual(routes.filter(page => String(page.panelText || '').includes('参数配置')).map(page => page.title),
    ['视频字幕去除'], '7 条路由页里只有这一条有组头');

  /* 判据从对照表派生：路由型（/ai-video 这一族）不渲染组头，app 页保持组头 */
  const routeSkills = [];
  for (const [id, record] of Object.entries(QUANTV_VIDEO_COUNTERPARTS)) {
    if (!record.counterpart) continue;
    const isApp = String(record.counterpart).includes('/apps?id=');
    assert.equal(quantvVideoShowsParamGroup(id), isApp,
      id + ' 的组头判据与它对应的页面类型不一致（' + record.counterpart + '）');
    if (!isApp) routeSkills.push(id);
  }
  assert.deepEqual(routeSkills.sort(),
    ['video.book_selling', 'video.content_swap', 'video.food_asmr', 'video.remake', 'video.smart', 'video.store_tour', 'video.tech_tvc'].sort(),
    '对到知渔**路由页**的技能清单变了');
  /* 自有玩法没有对应页可比：沿用现状（渲染组头）—— 这一条是"不改动既有页面"的取舍，写在这里备查 */
  for (const [id, record] of Object.entries(QUANTV_VIDEO_COUNTERPARTS)) {
    if (record.counterpart) continue;
    assert.equal(quantvVideoShowsParamGroup(id), true, id + ' 是自有玩法，组头行为应与从前一致');
  }
});

test('③ 接线：组头由页面按对照表传进来，渲染层只在非空时画那一行', () => {
  assert.match(media, /groupTitle=\{quantvVideoShowsParamGroup\(skill\.id\) \? '参数配置' : ''\}/,
    'MediaCreation 必须按对照表把组头传给视频子页面（名单只有一份）');
  assert.match(studio, /groupTitle=\{groupTitle\}/, 'VideoStudio 必须把它透传给 VideoWorkbench');
  assert.match(studio, /groupTitle = '参数配置'/, 'VideoStudio 的入参要有默认值（独立路由/首页不受影响）');
  assert.match(component, /groupTitle = '参数配置'/, 'VideoWorkbench 的入参要有默认值');
  assert.match(component, /\{groupTitle \? <h3 className="media-workbench-group-title"><span>\{groupTitle\}<\/span><\/h3> : null\}/,
    '组头只在非空串时渲染 —— 空串时**不许**顶出多余的一行');
  /* 两列网格还在（组头不画不代表布局改掉：视频块仍然要 grid-column: 1/-1 才不被压成半宽） */
  assert.match(component, /className="media-workbench-fields"/, '两列网格必须保留');
});

test('④ 「替换对象」两颗粒子：知渔那一页**没有标题**，我们照抄（标题留给读屏）', () => {
  /* 证据：那一页 从资产库选择 → 换模特 → 换产品 之间没有任何文字（CDP 实采全文） */
  assert.match(textOf('内容替换(路由页)'), /\n从资产库选择\n换模特\n换产品\n/,
    '知渔那一页两颗药丸上方没有字段标题（证据变了就要重新判断）');
  const mode = (VIDEO_WORKBENCHES['video.content_swap'].blocks || []).find(block => block.bind === 'swapMode');
  assert.ok(mode, '内容替换页必须有「替换对象」这一格');
  assert.equal(mode.hideLabel, true, '它必须标 hideLabel（照那一页不画标题）');
  assert.equal(mode.title, '替换对象', '标题仍要留着 —— 读屏与机检都要用');
  assert.match(component, /\{!block\.hideLabel && \(/, '渲染层必须尊重 hideLabel（否则声明了也不生效）');
});
