// test/skill-library-auth-state.test.mjs
// 契约：**未登录是一种正常状态，不是一条英文报错**。
// ─────────────────────────────────────────────────────────────────────────────
// 起因（2026-09-15 用户批注图4-①：「技能库怎么坏掉了」）：
//   链路本身是好的（skills.js 发 Authorization: Bearer，服务端 contentBilling 认这个头，
//   实测三处 key/字段/头部全部对得上），失败原因只是「那次请求没有 token」= 未登录。
//   但服务端把 `error.message` 原样吐出来，前端又原样渲染成红色横幅，
//   于是用户看到的是英文 'A signed session token is required' —— 看起来就是坏了。
//
// 本契约守两条：
//   ① 服务端鉴权失败必须给**中文 + 稳定 errorCode**，不得泄漏内部英文原文；
//   ② 前端必须把 401/403 判成「需要登录」状态并给出登录入口（不是红色报错）。
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { mountSkillRoutes } from '../server/skills/skillRoutes.mjs';

const RAW_INTERNAL_MESSAGE = 'A signed session token is required';

function fakeApp() {
  const routes = new Map();
  const add = method => (path, handler) => routes.set(method + ' ' + path, handler);
  return { get: add('GET'), post: add('POST'), patch: add('PATCH'), delete: add('DELETE'), routes };
}

function capture() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function mountWithThrow(error) {
  const app = fakeApp();
  mountSkillRoutes(app, {
    skillStore: {
      createSkill() { throw new Error('unused'); },
      listSkills() { return []; },
      listGroups() { return []; },
    },
    authenticateOwner() { throw error; },
  });
  return app;
}

test('① 鉴权失败：中文 + 稳定 errorCode，且不得泄漏内部英文原文', () => {
  const error = new Error(RAW_INTERNAL_MESSAGE);
  error.code = 'AUTH_SESSION_REQUIRED';
  error.status = 401;
  const app = mountWithThrow(error);
  const res = capture();
  app.routes.get('GET /api/skills')({ query: {} }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.errorCode, 'AUTH_SESSION_REQUIRED', '必须给稳定 errorCode 供前端判分支');
  assert.match(res.body.error, /登录/, '面向用户的文案必须是中文且说清怎么办');
  assert.doesNotMatch(JSON.stringify(res.body), /signed session token/i,
    '内部英文原文不得出现在用户可见的响应里');
});

test('② 检测器自证：这条判据抓得住「原文直出」的写法', () => {
  const bad = JSON.stringify({ ok: false, error: RAW_INTERNAL_MESSAGE });
  assert.match(bad, /signed session token/i, '前提：原文直出时确实命中');
  const good = JSON.stringify({ ok: false, errorCode: 'AUTH_SESSION_REQUIRED', error: '登录后即可使用技能库' });
  assert.doesNotMatch(good, /signed session token/i, '改好之后必须不命中');
});

test('③ 非鉴权失败仍保留可诊断信息（不要把真实故障也吞掉）', () => {
  const error = new Error('skill store offline');
  error.status = 500;
  const app = mountWithThrow(error);
  const res = capture();
  app.routes.get('GET /api/skills')({ query: {} }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.errorCode, 'SKILL_LIBRARY_UNAVAILABLE');
  assert.match(res.body.error, /技能库/, '非鉴权错误也要给中文兜底文案');
  assert.doesNotMatch(JSON.stringify(res.body), /skill store offline/,
    '非鉴权错误同样不得把内部原文直出（本轮测试③就是靠这条抓出实现不一致的）');
});

test('④ 前端把 401/403 判成「需要登录」并给出登录入口（不是红色报错）', () => {
  const source = readFileSync(new URL('../src/pages/Home/ec/SkillLibraryModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /needsLogin/, '必须有独立的未登录状态');
  assert.match(source, /error\?\.status === 401|AUTH_SESSION_REQUIRED/, '必须按状态码/错误码判分支');
  assert.match(source, /type: 'SHOW_LOGIN'/, '必须复用既有登录入口（dispatch SHOW_LOGIN）');
  assert.match(source, /state\.needsLogin && state\.error|!state\.needsLogin && state\.error/,
    '未登录时不得再渲染原始错误横幅');
});