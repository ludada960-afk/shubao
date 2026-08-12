import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('admin console is owner-scoped and wired to the protected admin api', async () => {
  const [app, context, page, service, styles] = await Promise.all([
    source('../src/App.jsx'),
    source('../src/store/AppContext.jsx'),
    source('../src/pages/AdminConsole/index.jsx'),
    source('../src/services/admin.js'),
    source('../src/pages/AdminConsole/AdminConsole.css'),
  ]);

  assert.match(app, /AdminConsolePage/);
  assert.match(app, /page:\s*'admin'/);
  assert.match(app, /accountAccess\?\.role\s*===\s*'owner'/);
  assert.match(app, /page\s*===\s*'admin'\s*&&\s*!canAdmin/);
  assert.match(context, /fetchAccountAccess/);
  assert.match(context, /accountAccess/);
  assert.match(service, /\/api\/admin\/summary/);
  assert.match(service, /\/api\/admin\/monitoring/);
  assert.match(service, /\/api\/admin\/accounts/);
  assert.match(service, /\/permissions/);
  assert.match(service, /\/credits/);
  assert.match(service, /\/api\/admin\/audit/);
  assert.match(page, /运营总览/);
  assert.match(page, /账号与权限/);
  assert.match(page, /成本与利润/);
  assert.match(page, /操作审计/);
  assert.match(page, /运行监控/);
  assert.match(page, /最近任务/);
  assert.match(page, /电商生图/);
  assert.match(page, /视频生成/);
  assert.match(page, /小红书图文/);
  assert.match(page, /自由创作/);
  assert.match(page, /发放积分/);
  assert.match(page, /回收积分/);
  assert.match(page, /accountAccess\?\.role\s*===\s*'owner'/);
  assert.match(styles, /\.admin-console/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
});

test('admin console converts visible AI points to ledger units exactly once', async () => {
  const service = await source('../src/services/admin.js');
  assert.match(service, /AI_POINT_UNITS\s*=\s*1000/);
  assert.match(service, /Math\.round\(points \* AI_POINT_UNITS\)/);
});
