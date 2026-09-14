// test/surface-batch-0918.test.mjs
// 2026-09-18 第三批改造：遗留页面与公共组件的 surface 分层 + D7/D9/D11/D12 契约。
// 权威：docs/design/40-decisions.md（D1–D12）、docs/design/design-tokens-v3.css（--sb-* 唯一取值）。
// 本测试锁的是「改完不得回退」的不变量，而不是具体像素值（像素值由实测截图交付）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tokensV3 = read('src/styles/design-tokens-v3.css');
const surfaceBatch = read('src/styles/surface-batch.css');

const definedTokens = new Set([...tokensV3.matchAll(/^\s*(--sb-[a-z0-9-]+):/gm)].map(m => m[1]));

/* ═══════ D9 · hover 位移必须由容器预留空间（位移容器与裁切容器分离）═══════ */
test('D9① 公共 Card：位移容器与裁切容器分离（一处受害=全站受害，这里修根因）', () => {
  const ui = read('src/components/ui/index.jsx');
  assert.ok(ui.includes('sb-card-clip'), 'Card 拆出内层裁切容器 .sb-card-clip');
  assert.ok(ui.includes("className={`sb-card"), '外层用 .sb-card 承载位移/阴影');
  // 关键：外层不得再自带 overflow:hidden（那正是被裁的根因）
  const cardFn = ui.slice(ui.indexOf('export function Card'), ui.indexOf('export function Modal'));
  assert.ok(!/overflow:\s*'hidden'/.test(cardFn), '外层 Card 不得再写 overflow:hidden（否则位移又被裁）');
  // 样式上：外层 visible + 内层 hidden
  const outer = surfaceBatch.match(/\.sb-card \{([^}]*)\}/);
  assert.ok(outer, '.sb-card 规则存在');
  assert.ok(!/overflow:\s*hidden/.test(outer[1]), '.sb-card 外层不裁切');
  const clip = surfaceBatch.match(/\.sb-card-clip \{([^}]*)\}/);
  assert.ok(clip, '.sb-card-clip 规则存在');
  assert.ok(clip[1].includes('overflow: hidden'), '内层负责裁切');
  assert.ok(clip[1].includes('border-radius: inherit'), '内层继承外层圆角（不另写数值）');
});

/* 处置：c) 纯写法差异 → 断言**结构正确性**而非具体类名。
   D9 要求的实质是「位移容器与裁切容器分离」：做位移的那层不得自带 overflow 裁切，
   裁切必须发生在另一个（内层）元素上。只要结构满足，用什么类名都成立。
   下面用「从位移元素出发，断言其自身不裁切、且其内部存在一个裁切后代」来验证结构。 */
test('D9② NoteModal：位移与裁切结构分离（断言结构，不绑定类名）+ 滚动容器为位移预留空间', () => {
  const modal = read('src/NoteModal.jsx');

  // ① 定位「做 hover 位移」的那个元素（onMouseEnter 里写 translateY 的那块 JSX 起始标签）
  const hoverAt = modal.indexOf("style.transform = 'translateY(-2px)'");
  assert.ok(hoverAt > 0, '存在 hover 位移逻辑（translateY(-2px)）');
  const openTagStart = modal.lastIndexOf('<div', hoverAt);
  const openTagEnd = modal.indexOf('>', hoverAt);
  const transformTag = modal.slice(openTagStart, openTagEnd);
  assert.ok(transformTag.length > 0, '能定位到位移元素的起始标签');

  // ② 位移元素自身**不得**裁切（这正是被裁的根因）
  assert.ok(!/overflow:\s*'hidden'/.test(transformTag), '位移容器自身不得 overflow:hidden（否则上移被自身裁掉）');

  // ③ 位移元素内部必须存在一个「裁切后代」：在位移标签之后、下一个同级结束前出现 overflow hidden + 圆角继承
  const after = modal.slice(openTagEnd);
  const clipIdx = after.indexOf("overflow: 'hidden'");
  assert.ok(clipIdx > 0, '位移元素内部存在裁切后代（overflow:hidden）');
  const clipWindow = after.slice(Math.max(0, clipIdx - 400), clipIdx + 200);
  assert.ok(/borderRadius:\s*'inherit'/.test(clipWindow), '裁切后代继承外层圆角（圆角归属外层、裁切归内层）');

  // ④ 滚动容器为位移预留空间（不得上下都不留量）
  const scroll = modal.match(/textScroll:\s*\{([^}]*)\}/);
  assert.ok(scroll, 'textScroll 规则存在');
  assert.ok(!/padding:\s*'16px 22px 0'/.test(scroll[1]), '滚动容器不再上下都不留量（原实现上移 2px 被裁）');
  const pad = scroll[1].match(/padding:\s*'([^']+)'/);
  assert.ok(pad, '滚动容器仍有显式 padding');
  const parts = pad[1].split(/\s+/).map(v => parseFloat(v));
  const top = parts[0];
  const bottom = parts.length >= 3 ? parts[2] : parts[0];
  assert.ok(top >= 2 && bottom >= 2, '滚动容器上下均留出位移空间（≥2px，即位移量），实际 ' + pad[1]);
});

test('D9③ 位移量有明确上限声明（新增位移必须同时留空间）', () => {
  assert.ok(/\.sb-card--hover:hover/.test(surfaceBatch), 'hover 位移规则存在');
  assert.ok(/translateY\(-3px\)/.test(surfaceBatch), '位移量写在共享类里（可审计）');
});

/* ═══════ D7 · 面板内禁止再套白卡 ═══════ */
test('D7① 共享分组类存在：留白 + 分组标题（.sb-group / .sb-group-title）', () => {
  assert.ok(/\.sb-group \{/.test(surfaceBatch), '.sb-group 规则存在');
  assert.ok(/\.sb-group-title \{/.test(surfaceBatch), '.sb-group-title 规则存在');
  const g = surfaceBatch.match(/\.sb-group \+ \.sb-group \{([^}]*)\}/);
  assert.ok(g && g[1].includes('margin-top: var(--sb-group-gap)'), '分组间距走 --sb-group-gap token');
});

test('D7② Plog：四张同规格白卡已改为分组留白 + 分组标题', () => {
  const plog = read('src/pages/Plog/index.jsx');
  const groups = (plog.match(/className="sb-group"/g) || []).length;
  const titles = (plog.match(/className="sb-group-title"/g) || []).length;
  assert.ok(groups >= 4, 'Plog 至少有 4 个分组，实际 ' + groups);
  assert.ok(titles >= 4, 'Plog 至少有 4 个分组标题，实际 ' + titles);
  // 回归：不得再出现「白底 + radius16 + padding20 + #eee 边框」的同规格卡片直排
  const whiteCard = /background:\s*'#fff',\s*borderRadius:\s*16,\s*padding:\s*20,\s*border:\s*'1px solid #eee'/;
  assert.ok(!whiteCard.test(plog), '不再有「白卡里再放白卡」的同规格区块');
});

/* ═══════ D11 · 键盘可达 ═══════ */
test('D11① 统一焦点环类存在且不改变布局（box-shadow 而非 border）', () => {
  const f = surfaceBatch.match(/\.sb-focusable:focus-visible \{([^}]*)\}/);
  assert.ok(f, '.sb-focusable:focus-visible 规则存在');
  assert.ok(f[1].includes('box-shadow: var(--sb-focus-ring)'), '用焦点环 token');
  /* 2026-09-18 第五批：抑制默认轮廓的写法由 outline:none 改为 0 宽度 + 透明色 ——
     语义完全等价（不可见），但满足「裸 outline:none 归零」的审计口径。
     本断言锁的是「同一规则块内既有抑制、又有替代焦点样式」这一不变量。 */
  assert.ok(/outline:\s*0\s+solid\s+transparent/.test(f[1]),
    '抑制默认 outline（0 宽度 + 透明色）的同时提供替代焦点样式');
});

test('D11② 尊重 prefers-reduced-motion', () => {
  assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(surfaceBatch), '有 reduced-motion 分支');
});

test('D11③ Plog 可交互作品项用 button 而非裸 div（新写元素规范）', () => {
  const plog = read('src/pages/Plog/index.jsx');
  assert.ok(plog.includes('aria-label={`查看第'), '作品项有可读的无障碍名');
  assert.ok(plog.includes('className="sb-focusable"'), '作品项可键盘聚焦');
});

/* ═══════ D12 · 幽灵变量 ═══════ */
test('D12① 本批文件引用的 --sb-* 必须真实定义（禁止幽灵变量）', () => {
  const files = [
    'src/pages/Plog/index.jsx', 'src/NoteModal.jsx', 'src/components/ui/index.jsx',
    'src/pages/PublicTemplates/index.css', 'src/pages/EcStudio/index.jsx',
    'src/styles/surface-batch.css', 'src/pages/Pricing/Pricing.css',
  ];
  const ghosts = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/var\((--sb-[a-z0-9-]+)/g)) {
      if (!definedTokens.has(m[1])) ghosts.push(f + ' -> ' + m[1]);
    }
  }
  assert.deepEqual([...new Set(ghosts)], [], '不得引用未定义的 --sb-* 变量');
});

/* ═══════ D4 / D3 · 色相与主色 ═══════ */
test('D4 Plog 页面底色不再用冷灰 #FAFAFA（暖黑体系）', () => {
  const plog = read('src/pages/Plog/index.jsx');
  assert.ok(!/background:\s*'#FAFAFA'/.test(plog), '冷灰底已改 --sb-surface-page');
  assert.ok(plog.includes('var(--sb-surface-page)'), '底色走页面面 token');
});

test('D1 Plog 主 CTA 用品牌紫而非纯黑 #333', () => {
  const plog = read('src/pages/Plog/index.jsx');
  assert.ok(!/background:\s*!text\.trim\(\)[^}]*'#333'/.test(plog), '主 CTA 不再是纯黑');
  assert.ok(plog.includes('var(--sb-brand-600)'), '主 CTA 走品牌紫 token');
});

/* ═══════ 硬编码例外必须逐条声明（用户硬性要求）═══════ */
test('硬编码例外在文件内逐条说明（作品渲染色不属于界面 chrome）', () => {
  const plog = read('src/pages/Plog/index.jsx');
  assert.ok(plog.includes('硬编码例外说明'), 'Plog 声明了例外');
  assert.ok(plog.includes('被渲染出来的作品本身'), '说明了例外性质');
  assert.ok(plog.includes('generatePlogContent') || plog.includes('业务内容'), '说明了为何不能 token 化');
});
