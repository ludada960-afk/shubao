import assert from 'node:assert/strict';
import test from 'node:test';

import { mountWorkRoutes } from '../server/worksRoutes.mjs';

function createApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    routes,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(app, method, path, request = {}) {
  const handler = app.routes.get(`${method} ${path}`);
  assert.ok(handler, `mounted ${method} ${path}`);
  const res = response();
  await handler({
    headers: request.headers || {},
    body: request.body || {},
    query: request.query || {},
  }, res);
  return res;
}

function harness() {
  const calls = [];
  const app = createApp();
  mountWorkRoutes(app, {
    authenticateOwner(req) {
      const owner = req.headers.authorization;
      if (!owner) throw Object.assign(new Error('sign in'), { code: 'AUTH_SESSION_REQUIRED' });
      return owner;
    },
    mapError(error) {
      return { status: error.code === 'AUTH_SESSION_REQUIRED' ? 401 : 500, body: { code: error.code || 'ERROR' } };
    },
    listWorks: ownerEmail => { calls.push(['list', ownerEmail]); return [{ _phone: ownerEmail }]; },
    listTrash: ownerEmail => { calls.push(['trash', ownerEmail]); return []; },
    saveOwnedWork: (work, ownerEmail) => { calls.push(['save', ownerEmail, work]); return work._saveKey || 'server-key'; },
    deleteOwnedWork: (saveKey, ownerEmail) => { calls.push(['delete', ownerEmail, saveKey]); return ownerEmail === 'owner@example.com'; },
    restoreOwnedWork: (saveKey, ownerEmail) => { calls.push(['restore', ownerEmail, saveKey]); return ownerEmail === 'owner@example.com'; },
  });
  return { app, calls };
}

test('works routes reject anonymous access and never trust a phone query or body owner', async () => {
  const { app, calls } = harness();
  const unsigned = await invoke(app, 'GET', '/api/works', { query: { phone: 'victim@example.com' } });
  const listed = await invoke(app, 'GET', '/api/works', {
    headers: { authorization: 'owner@example.com' },
    query: { phone: 'victim@example.com' },
  });
  const saved = await invoke(app, 'POST', '/api/save-work', {
    headers: { authorization: 'owner@example.com' },
    body: { phone: 'victim@example.com', work: { _saveKey: 'work-1', _phone: 'victim@example.com', title: '私有作品' } },
  });

  assert.equal(unsigned.statusCode, 401);
  assert.deepEqual(listed.body, [{ _phone: 'owner@example.com' }]);
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(calls[0], ['list', 'owner@example.com']);
  assert.equal(calls[1][0], 'save');
  assert.equal(calls[1][1], 'owner@example.com');
  assert.equal(calls[1][2]._phone, 'owner@example.com');
});

test('delete and restore return not found when the signed owner does not own the save key', async () => {
  const { app } = harness();
  const deniedDelete = await invoke(app, 'POST', '/api/delete-work', {
    headers: { authorization: 'attacker@example.com' },
    body: { _saveKey: 'victim-work' },
  });
  const deniedRestore = await invoke(app, 'POST', '/api/restore-work', {
    headers: { authorization: 'attacker@example.com' },
    body: { _saveKey: 'victim-work' },
  });
  const ownerDelete = await invoke(app, 'POST', '/api/delete-work', {
    headers: { authorization: 'owner@example.com' },
    body: { _saveKey: 'owner-work' },
  });

  assert.equal(deniedDelete.statusCode, 404);
  assert.equal(deniedRestore.statusCode, 404);
  assert.equal(ownerDelete.statusCode, 200);
});
