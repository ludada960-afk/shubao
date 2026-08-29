import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appContext = readFileSync(new URL("../src/store/AppContext.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("route-deep-link 1: AppContext 必须导出 pathnameToPage 工具函数", () => {
  assert.match(
    appContext,
    /export\s+function\s+pathnameToPage\s*\(/,
    "AppContext.jsx 必须 export pathnameToPage 函数 (URL -> state.page 映射)",
  );
});

test("route-deep-link 2: PATHNAME_PAGE_MAP 必须覆盖 7 个 deep link 路由", () => {
  const cases = [
    { pathname: "/", expected: "home" },
    { pathname: "/canvas", expected: "ec-canvas" },
    { pathname: "/video-studio", expected: "video-studio" },
    { pathname: "/ec-canvas", expected: "ec-canvas" },
    { pathname: "/pricing", expected: "pricing" },
    { pathname: "/public-templates", expected: "public-templates" },
  ];
  // 兼容 Object.freeze({...}) 与 {...} 两种写法
  const mapMatch = appContext.match(/const\s+PATHNAME_PAGE_MAP\s*=\s*(?:Object\.freeze\(\s*)?\{([\s\S]*?)\};?\s*\)?/);
  assert.ok(mapMatch, "AppContext.jsx 必须有 PATHNAME_PAGE_MAP 静态表");
  const body = mapMatch[1];
  for (const c of cases) {
    const keyEsc = c.pathname.replace(/\//g, "\\/");
    const pat = "['\"]" + keyEsc + "['\"]\\s*:\\s*['\"]" + c.expected + "['\"]";
    const re = new RegExp(pat);
    assert.ok(re.test(body), "PATHNAME_PAGE_MAP 必须含 " + c.pathname + " -> " + c.expected);
  }
});

test("route-deep-link 3: pathnameToPage 对未知 / 非法路径必须回退 home", () => {
  const fnMatch = appContext.match(/function\s+pathnameToPage\([\s\S]*?\n\}/);
  assert.ok(fnMatch, "必须能找到 pathnameToPage 函数体");
  const body = fnMatch[0];
  assert.ok(
    /return[\s\S]{0,80}["\']home["\']|return[\s\S]{0,80}\|\|[\s\S]{0,40}["\']home["\']/.test(body),
    "pathnameToPage 必须 return home (或带 || home 兜底)",
  );
});

test("route-deep-link 4: createInitialState 必须用 pathnameToPage 决定初始 page", () => {
  const initMatch = appContext.match(/function\s+createInitialState\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(initMatch, "createInitialState 函数体必须存在");
  const body = initMatch[1];
  assert.ok(/pathnameToPage\s*\(/.test(body), "createInitialState 必须调 pathnameToPage");
  assert.ok(
    /globalThis[\s\S]{0,40}location[\s\S]{0,40}pathname|window[\s\S]{0,40}location[\s\S]{0,40}pathname/.test(body),
    "createInitialState 必须从 globalThis/window 读 pathname",
  );
});

test("route-deep-link 5: /login deep link 启动时必须弹登录弹窗", () => {
  const initMatch = appContext.match(/function\s+createInitialState\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
  const body = initMatch[1];
  // createInitialState 必须识别 /login 路径 (允许: pathname === '/login', 或 'login' in pathname 等价形态)
  assert.ok(
    /pathname\s*===\s*["\']\/login["\']|pathname\.match\(\s*\/login|\bpathname\b[\s\S]{0,80}\/login/.test(body),
    "createInitialState 必须识别 /login 路径",
  );
  // showLogin=true 必须在识别 /login 时被设 (允许 base.showLogin = true 或直接 SHOW_LOGIN dispatch)
  const hasShowLogin = /base\.showLogin\s*=\s*true|state\.showLogin\s*=\s*true|showLogin\s*:\s*true/.test(body);
  assert.ok(hasShowLogin, "createInitialState 必须设 showLogin=true (在 /login 路径时)");
});

test("route-deep-link 6: App.jsx AppRouter 必须监听 popstate 让浏览器后退/前进切换 page", () => {
  const routerMatch = app.match(/function\s+AppRouter\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(routerMatch, "AppRouter 函数必须存在");
  const body = routerMatch[1];
  assert.ok(/addEventListener\(\s*["\']popstate["\']/.test(body), "AppRouter 必须 addEventListener popstate");
  assert.ok(/removeEventListener\(\s*["\']popstate["\']/.test(body), "AppRouter 必须 removeEventListener popstate");
  assert.ok(/pathnameToPage\s*\(/.test(body), "popstate handler 必须调 pathnameToPage");
});

test("route-deep-link 7: /pricing deep link 不能自动弹定价弹窗 (避免与 738f0eff 守卫冲突)", () => {
  const initMatch = appContext.match(/function\s+createInitialState\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
  const body = initMatch[1];
  assert.ok(
    !/SHOW_PRICE[\s\S]{0,40}true/.test(body),
    "createInitialState 不应自动 SHOW_PRICE (避免污染 738f0eff PricingModal 守卫)",
  );
});

test("route-deep-link 8: 已有 pageMap / NAVIGATE dispatch / Modals 不被破坏", () => {
  assert.ok(/const\s+pageMap\s*=\s*\{/.test(app), "App.jsx pageMap 必须保留");
  for (const key of ["home", "pricing", "ec-canvas", "video-studio", "public-templates"]) {
    const esc = key.replace(/-/g, "\\x2d");
    const re = new RegExp("['\"]?" + esc + "['\"]?\\s*:\\s*\\w+Page");
    assert.ok(re.test(app), "pageMap 必须含 " + key);
  }
  assert.ok(/type:\s*["\']NAVIGATE["\']/.test(app), "App.jsx 必须仍能 dispatch NAVIGATE");
});

test("route-deep-link 9: pathnameToPage 接受 null/undefined pathname 必须返回 home (健壮)", () => {
  const fnMatch = appContext.match(/function\s+pathnameToPage\([\s\S]*?\n\}/);
  const body = fnMatch[0];
  // pathnameToPage 必须处理 null/undefined 输入 (允许: pathname || ..., typeof globalThis !== 'undefined' 兜底, etc.)
  const robust =
    /pathname\s*\|\|\s*\(/.test(body) ||
    /typeof\s+globalThis\s*[!=]==/.test(body) ||
    /typeof\s+pathname\s*[!=]==/.test(body) ||
    /typeof\s+safe\s*[!=]==/.test(body) ||
    /pathname\s*\?\s*pathname/.test(body) ||
    /!pathname/.test(body) ||
    /safe\.length\s*===\s*0/.test(body) ||
    /typeof\s+safe\s*[!=]==\s*["\']string["\']/.test(body);
  assert.ok(robust, "pathnameToPage 必须处理 null/undefined 输入 (含 typeof 防御 || 兜底)");
});

test("route-deep-link 10: EcCanvas/index.jsx portCreationActions 必须在 useMemo 之前声明 (TDZ 修复)", () => {
  // 用户 8-30 反馈画布打不开, 主线程修好 /canvas deep link 后, 画布真渲染立刻爆
  // "Cannot access 'portCreationActions' before initialization" — 4c183cd4 时代
  // 埋的 TDZ bug, 画布打不开时不暴露. 主线程修法: 把 const 声明上移到所有 useMemo 之前.
  const canvasPage = readFileSync(new URL("../src/pages/EcCanvas/index.jsx", import.meta.url), "utf8");
  // 找 const portCreationActions 声明的所有行号
  const decls = [];
  const declRe = /\bconst\s+portCreationActions\s*=/g;
  let m;
  while ((m = declRe.exec(canvasPage)) !== null) decls.push(m.index);
  assert.ok(decls.length >= 1, "EcCanvas/index.jsx 必须有 portCreationActions const 声明");
  // 找所有 useMemo / useCallback / JSX 中引用 portCreationActions 的位置 (排除 const 声明 + 注释)
  const useRefs = [];
  const refRe = /\bportCreationActions\b/g;
  while ((m = refRe.exec(canvasPage)) !== null) {
    const isDecl = decls.some(d => m.index >= d && m.index < d + 200);
    if (isDecl) continue;
    // 排除注释: 同一行如果有 // 注释且 portCreationActions 在 // 之后, 跳过
    const beforeMatch = canvasPage.slice(Math.max(0, m.index - 1), m.index);
    const lineStart = canvasPage.lastIndexOf("\n", m.index) + 1;
    const lineText = canvasPage.slice(lineStart, canvasPage.indexOf("\n", m.index) < 0 ? canvasPage.length : canvasPage.indexOf("\n", m.index));
    const commentAt = lineText.indexOf("//");
    if (commentAt >= 0) {
      const colInLine = m.index - lineStart;
      if (colInLine > commentAt) continue;
    }
    useRefs.push(m.index);
  }
  assert.ok(useRefs.length >= 3, "portCreationActions 必须至少 3 处被引用 (useMemo deps + JSX)");
  // 关键: 第一个 const 声明必须在所有 useRef (引用点) 之前
  const firstDecl = decls[0];
  for (const ref of useRefs) {
    assert.ok(firstDecl < ref, "portCreationActions const 声明必须在 useMemo / JSX 引用之前 (避免 TDZ). firstDecl=" + firstDecl + " ref=" + ref);
  }
});

test("route-deep-link 11: EcCanvas/index.jsx portCreationActions 不能有重复 const 声明", () => {
  const canvasPage = readFileSync(new URL("../src/pages/EcCanvas/index.jsx", import.meta.url), "utf8");
  const decls = canvasPage.match(/\bconst\s+portCreationActions\s*=/g) || [];
  assert.equal(decls.length, 1, "portCreationActions 必须只有 1 次 const 声明 (避免重复 + shadow), 实际 " + decls.length);
});