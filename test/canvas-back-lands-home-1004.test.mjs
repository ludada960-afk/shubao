// test/canvas-back-lands-home-1004.test.mjs
// 画布「返回」要真的落在首页 —— 2026-10-04
//
// 用户反馈（逐字）：
//   「我在浏览其他页面的时候，比如无限画布，我点击左上角的返回按钮，
//     你会帮我跳回图片生成的总页面去，难道不该是回到首页去吗」
//
// 真正的原因不是"首页就是生图"（那是产品形态，用户明确不接受加非生图入口），
// 而是**首页被残留的启动态顶到了某个技能的子页上**：
//   · NAVIGATE 只改 page，**不清 creationLaunch**（AppContext.jsx:155）
//   · 首页把 creationLaunch.skillId 当 initialSkillId 传给 VisualCreationMode
//   · 那里会**强制切到那个技能**（VisualCreationMode.jsx:457-459）
// 于是从画布返回，首页一打开就落在上次那个技能的工作台上 —— 看着就是"跳到生图总页面"。
//
// 修法是**清残留**而不是加入口：返回 = 回到首页本来的样子。
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { stripComments } from '../scripts/lib/token-scope.mjs';

const canvas = stripComments(readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8'));
const context = stripComments(readFileSync(new URL('../src/store/AppContext.jsx', import.meta.url), 'utf8'));

test('① 画布返回先清启动态，再跳首页', () => {
  const handler = canvas.slice(canvas.indexOf('const handleBack'), canvas.indexOf('const openWork'));
  assert.match(handler, /SET_CREATION_LAUNCH.*launch: null/, '返回时必须清掉 creationLaunch，否则首页被顶进技能子页');
  assert.match(handler, /NAVIGATE.*page: 'home'/);
  /* 顺序要紧：先清再跳。反了的话 NAVIGATE 触发重渲染时首页仍能读到旧 launch。 */
  const clearAt = handler.indexOf('SET_CREATION_LAUNCH');
  const navAt = handler.indexOf('NAVIGATE');
  assert.ok(clearAt > -1 && navAt > -1 && clearAt < navAt, '必须先清残留、后导航');
});

test('② 返回不得动画布内容（用户还要从侧栏回来继续用）', () => {
  const handler = canvas.slice(canvas.indexOf('const handleBack'), canvas.indexOf('const openWork'));
  assert.doesNotMatch(handler, /SET_RESULT|OPEN_CANVAS/, '返回不该清画布结果或重建画布');
});

test('③ 根因在 NAVIGATE 不清启动态 —— 这条要钉住，否则改回来又会复现', () => {
  const navigate = context.slice(context.indexOf("case 'NAVIGATE'"), context.indexOf("case 'OPEN_CANVAS'"));
  assert.match(navigate, /page: action\.page/);
  assert.doesNotMatch(navigate, /creationLaunch: null/,
    'NAVIGATE 仍然不清 creationLaunch —— 这是**有意**的：NAVIGATE 也用于"带素材去子页工作台"'
    + '（remixWorkInWorkbench / openNodeInWorkbench），那里必须保留 launch 才能还原现场。'
    + '所以清理只发生在画布返回这一处，不能往 NAVIGATE 里加。');
});

test('④ 首页确实会用 initialSkillId 强制切技能 —— 这是"被顶走"的执行点', () => {
  const home = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(home, /initialSkillId=\{state\.creationLaunch\?\.skillId \|\| null\}/,
    '首页把残留的 creationLaunch 当 initialSkillId 用');

  const mode = stripComments(readFileSync(new URL('../src/pages/Home/VisualCreationMode.jsx', import.meta.url), 'utf8'));
  assert.match(mode, /if \(!initialSkillId \|\| initialSkillId === skillId\) return;/,
    '有 initialSkillId 就会强制切技能 —— 所以残留必须在上游清掉');
});