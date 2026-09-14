// test/canvas-library-0912.test.mjs
// 2026-09-12 用户批注（多次强调）：必须做出「画布库」——点「新建画布」进入管理页，
// 每个画布可改名/复制/收藏(高亮)/删除，鼠标悬停才显示这些操作。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const exists = p => { try { readFileSync(new URL('../' + p, import.meta.url), 'utf8'); return true; } catch { return false; } };

test('服务端：画布库 CRUD 与列迁移齐备', () => {
  const store = read('server/projects/projectStore.mjs');
  for (const method of ['listCanvasSessions', 'renameCanvasSession', 'setCanvasSessionFavorite', 'duplicateCanvasSession']) {
    assert.match(store, new RegExp(method + '\\('), '缺少 ' + method);
  }
  const routes = read('server/projects/projectRoutes.mjs');
  assert.match(routes, /app\.get\('\/api\/canvas-library'/);
  assert.match(routes, /app\.post\('\/api\/canvas-library\/:sessionId\/duplicate'/);
  assert.match(routes, /app\.post\('\/api\/canvas-library\/:sessionId\/delete'/);
  const schema = read('server/projects/schema.mjs');
  assert.match(schema, /ALTER TABLE canvas_sessions ADD COLUMN title/, '老库要能原地补列');
  assert.match(schema, /ALTER TABLE canvas_sessions ADD COLUMN favorite/);
});

test('前端：画布库弹窗具备四类操作 + 悬停显示', () => {
  const modal = read('src/pages/EcCanvas/components/CanvasLibraryModal.jsx');
  assert.match(modal, /listCanvases\(\)/);
  assert.match(modal, /renameCanvas\(item\.id, title\)/);
  assert.match(modal, /duplicateCanvas\(item\.id\)/);
  assert.match(modal, /setCanvasFavorite\(item\.id, !item\.favorite\)/);
  assert.match(modal, /deleteCanvas\(item\.id\)/);
  assert.match(modal, /aria-label="改名字"/);
  assert.match(modal, /aria-label="复制画布"/);
  assert.match(modal, /aria-label="删除画布"/);
  const css = read('src/pages/EcCanvas/components/canvas-library.css');
  /* 9-13 调整为不依赖 display 切换（曾导致卡片塌陷事故）：按钮常驻 DOM，用 opacity/transform 显隐 */
  assert.match(css, /\.canvas-library-card-actions \{ position: absolute;[^}]*opacity: 0;/, '操作默认隐藏');
  assert.match(css, /\.canvas-library-card:hover \.canvas-library-card-actions/, '悬停才显示');
  assert.match(css, /\.canvas-library-card\.is-favorite/, '收藏要有高亮');
});

test('画布：「新建画布」进入画布库，而不是原地清空', () => {
  /* 画布库要么由 EcCanvas/index.jsx 内联承载，要么已抽成组件文件（本轮 UI 打磨把它抽了出去）。
     两种形态都要求同一条链路：入口把 canvasLibraryOpen 打开，空白画布创建与「打开已有画布」各自独立。 */
  const candidates = ['src/pages/EcCanvas/index.jsx', 'src/pages/EcCanvas/CanvasLibraryPage.jsx'];
  const owner = candidates.find(exists);
  assert.ok(owner, '画布库宿主存在（index.jsx 或 CanvasLibraryPage.jsx）');
  const canvas = read(owner);
  const shell = read('src/pages/EcCanvas/index.jsx');
  assert.match(shell, /setCanvasLibraryOpen\(true\);/, '「新建画布」打开画布库');
  assert.match(canvas, /const createBlankCanvas = useCallback\(async \(\) => \{/, '空白画布创建被拆出来');
  assert.match(canvas, /const openCanvasFromLibrary = useCallback\(async item => \{/);
  assert.match(canvas, /<CanvasLibraryModal/);
});
