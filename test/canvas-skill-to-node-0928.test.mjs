/* ═══ 2026-09-28 批 CX（CV-1）门禁：**技能声明 → 画布节点**（docs/design/89 §5 第 1 步）═══════════
   用户对画布的定位（原话）：「画布可能最终要走向像知渔AI他们那样。他们的画布其实更多是服务于**工作流**的，
   就是他们把各种各样的工作流集合成**模板**……」；画布方向的结论见 docs/design/89 §9.2。
   本轮把"一份声明三处复用"的第一处落到画布上：左栏「+」菜单新增**「按技能开始」**，
   关菜单 → 开**同一个技能库 modal**（与首页/视频页共用）→ 选中后**建出一个带这条技能的节点**
   （技能正文预填进提示词、`skill`/`skillLabel` 记名）。
   判据（三条，缺一条这个能力就不成立）：
     ① 菜单里必须有这一项（否则用户根本进不去）；
     ② 它必须开**共用**的技能库 modal（不许再写第三套技能选择界面）；
     ③ 选完必须**真的建节点并打上技能** —— 而且**不许在这条路径上扣费**（钱只发生在按报价确认之后）。
   实测（`.qa/cx-skill-node.mjs`，喂 2 条假技能）：点「按技能开始」→ 弹「技能库」→ 点第一张卡的「使用」
   → 画布节点数 **6 → 7**，提示「已按「爆款复刻」新建节点，可以直接改参数生成」。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readCode = rel => stripComments(readFileSync(new URL('../' + rel, import.meta.url), 'utf8'));

test('CV-1① 左栏添加菜单里有「按技能开始」（用户进得去）', () => {
  const studio = readCode('src/pages/ecCanvas/components/CanvasStudio.jsx'.replace('ecCanvas', 'EcCanvas'));
  assert.match(studio, /id: 'by-skill', label: '按技能开始'/, 'ADD_ACTIONS 里必须有这一项');
  assert.match(studio, /icon: ListChecks/, '图标要有（菜单项都有图标，缺一个会显得是半成品）');
});

test('CV-1② 它开的是**共用**的技能库 modal（不许第三套技能选择界面）', () => {
  const idx = readCode('src/pages/EcCanvas/index.jsx');
  assert.match(idx, /actionId === 'by-skill'\)\s*openSkillLibraryForNew\(/, '菜单回调必须接 openSkillLibraryForNew');
  assert.match(idx, /const openSkillLibraryForNew = useCallback/, '必须有这个入口函数');
  assert.match(idx, /create: true/, '要带上 create 标记（与"给已有节点换技能"区分）');
  assert.match(idx, /import SkillLibraryModal from '\.\.\/Home\/ec\/SkillLibraryModal\.jsx'/, '必须是首页那一个共用实现');
});

test('CV-1③ 选完真的建节点 + 打上技能，且这条路径不扣费', () => {
  const idx = readCode('src/pages/EcCanvas/index.jsx');
  assert.match(idx, /if \(target\?\.create\)[\s\S]{0,400}addCanvasComposerRef\.current\?\.\(/, 'create 分支必须真的建生成框');
  assert.match(idx, /const applied = applyCanvasSkill\(/, '必须把技能打在节点上（skill / skillLabel）');
  assert.match(idx, /skillLabel: applied\.skillLabel \|\| skill\.name/, '节点上要记名，用户看得出"这个节点是哪条技能"');
  /* addCanvasComposer 定义在后面 → 只能经 ref 引用（deps 求值期 TDZ 会整页白屏，本仓踩过） */
  assert.match(idx, /useEffect\(\(\) => \{ addCanvasComposerRef\.current = addCanvasComposer; \}, \[addCanvasComposer\]\)/,
    '必须用 ref 挂最新实现（直接进 deps 会 TDZ）');
  /* 钱：这段里不许出现扣费/结算调用 */
  const branch = idx.slice(idx.indexOf('if (target?.create)'), idx.indexOf('if (!target?.nodeId) return;'));
  assert.ok(branch.length > 40, '必须能定位到 create 分支');
  assert.doesNotMatch(branch, /settle|charge|billing|hold|扣费|支付/i, '建节点不收费：扣费只能发生在按报价确认之后');
});
