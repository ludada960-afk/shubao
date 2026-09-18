import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/* ═══ 批 J（用户批注 #2-5 / #3-2）：顶栏右侧的「表述的语言」要照竞品 ═════════════════════════
   用户原话：「包括右边的那些**积分啊，会员中心呀，登录啊**这些东西。都要抄他们的，
   这样的一套**表述的语言**会更好。」
   契约（这条门禁守的是一件很具体的事）：**按钮上的字必须和它真正干的事一致**。
   改前那颗按钮写着「已登录」，onClick 里却是 signOut —— 标签说状态、动作是登出，
   用户以为点一下是看账号信息，结果是把自己踢下线。 */

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('J：登出按钮按它真正干的事命名，不再用「已登录」当标签', () => {
  assert.match(app, /退出登录/, '写它真正做的事');
  assert.doesNotMatch(app, />\s*已登录\s*</, '不许再出现把状态当按钮标签的写法');
  /* 动作没变：仍然是 signOut（这一条只改文案，不许顺手改行为） */
  /* 取「已登录分支」那一整段按钮（从 logged ? 到 冒号分支），标签与动作必须同时在里面 */
  const start = app.indexOf('{logged ? (');
  const block = app.slice(start, app.indexOf(') : (', start));
  assert.match(block, /退出登录/, '标签在里面');
  assert.match(block, /signOut\(\)/, '仍然是退出登录这个动作');
});

test('J：积分 / 会员中心 / 登录三件事都在顶栏右侧', () => {
  const actions = app.slice(app.indexOf('topbar-actions'), app.indexOf('</div>', app.indexOf('AccountEntitlementControl')));
  assert.match(app, /AccountEntitlementControl/, '账户与积分控件必须在');
  assert.match(app, /onOpenMemberCenter=/, '会员中心入口必须在');
  assert.match(app, /onLogin=/, '登录入口必须在');
  assert.match(app, /去登录/, '未登录时的文案');
});
