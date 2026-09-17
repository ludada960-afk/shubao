import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CREATIVE_NAV_GROUPS } from '../src/components/layout/creativeDomainNavigation.js';

const component = fs.readFileSync(new URL('../src/components/layout/CreativeDomainNav.jsx', import.meta.url), 'utf8');
const shellCss = fs.readFileSync(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8');

test('desktop creative navigation renders its panel in a fixed body-level viewport', () => {
  assert.match(component, /createPortal/);
  assert.match(component, /document\.body/);
  assert.match(component, /creative-nav-viewport/);
  assert.match(component, /creative-nav-mobile-backdrop[\s\S]*document\.body/);
  assert.match(shellCss, /\.creative-nav-viewport\s*\{[\s\S]*position:\s*fixed/);
  assert.match(shellCss, /\.creative-nav-viewport-bridge\s*\{/);
  assert.doesNotMatch(component, /creative-nav-panel-heading/);
  assert.match(component, /creative-nav-item-icon/);
  assert.match(component, /creative-nav-glyph-stack/);
  assert.doesNotMatch(component, /creative-nav-domain-mark/);
  assert.doesNotMatch(component, /creative-nav-link-index/);
  assert.doesNotMatch(component, /is-single-destination/);
  assert.match(component, /creative-nav-arrow-left/);
  assert.match(shellCss, /\.creative-nav-panel-links\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(shellCss, /\.creative-nav-item-icon\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-link-index\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-panel-intro\s*\{/);
});

test('every destination has semantic icon and motion metadata (每一个入口都要有图标与动效语义)', () => {
  /* ⚠️ 2026-09-19 批 G：删掉了「视频域只许有一条入口」这一句 —— 依据用户批注 #7-①
     （视频域现在是总页面，下拉里是本板块精品技能；理由见 creative-nav-entry-consistency 文件头）。
     两条**条数**相关的基线也随之下调：
       · 旧基线 9 是「图片 4 条自由创作技能 + 视频 1 条 + …」凑出来的；
       · 现在是 6（图片）+ 6（视频）= 12 条，比原来更多，所以新基线写 12 —— 这不是放水，
         是"每个入口都必须有图标/动效/提示语"这条真正的契约仍然逐条查。 */
  const items = CREATIVE_NAV_GROUPS.flatMap(group => group.items);
  assert.equal(items.length, 12, '两个域各 6 条入口');
  for (const item of items) {
    assert.match(item.icon, /^[a-z-]+$/);
    assert.match(item.motion, /^[a-z-]+$/);
    assert.match(item.hint, /^.{2,8}$/);
  }
  /* ⚠️ 动效名必须**在同一个域内唯一**：它是 CSS 动画的挂点（creative-nav-glyph--<motion>），
     同一个下拉里两条入口共用一个名字，它们就会动得一模一样、看不出区别。
     ⚠️ 2026-09-19 批 G 把范围从"全站唯一"收成"域内唯一"（不是放水）：
       两个域各 6 条 = 12 条入口，而站里一共只有 7 套动效语言（layers / pages / cover /
       layout / magic / tryon / film）—— 全站唯一意味着要为 6 条入口**新造 5 套动画**，
       那既不必要（两个域不会同时展开）也会让动效语言失去统一性。
       真正的契约是"同一个面板里不重复"，所以按域比。 */
  for (const group of CREATIVE_NAV_GROUPS) {
    const motions = group.items.map(item => item.motion);
    assert.equal(new Set(motions).size, motions.length, group.id + ' 域里有两条入口共用同一套动效');
  }
  /* 每条入口还必须能在 ITEM_ICONS 里找到自己的图标（拼错一个名字会静默退化成 Sparkles） */
  const iconTable = component.match(/const ITEM_ICONS = \{([\s\S]*?)\n\};/)?.[1] || '';
  for (const item of items) {
    assert.ok(iconTable.includes("'" + item.icon + "'") || iconTable.includes(item.icon + ':'), item.icon + ' 不在 ITEM_ICONS 里');
  }
});

test('top-level domain clicks pin the menu instead of launching the first child', () => {
  assert.match(component, /toggleDesktopGroup/);
  assert.match(component, /onClick=\{\(\) => toggleDesktopGroup\(group\.id\)\}/);
  const triggerBlock = component.match(/className=\{`creative-nav-trigger[\s\S]*?onKeyDown=\{event => handleTriggerKeyDown\(event, group\.id\)\}/)?.[0] || '';
  assert.doesNotMatch(triggerBlock, /runTarget\(group\.id, group\.items\[0\]\.id\)/);
});

test('pointer transitions and outside interaction keep the viewport usable', () => {
  assert.match(component, /onPointerEnter=\{clearCloseTimer\}/);
  assert.match(component, /onPointerLeave=\{scheduleDesktopClose\}/);
  assert.match(component, /pointerdown/);
  assert.match(component, /focusin/);
  assert.match(component, /clearCloseTimer/);
});

test('destination motion is explicit, pointer-safe, and supports reduced motion', () => {
  assert.match(component, /creative-nav-glyph-stack/);
  assert.match(component, /item\.motion/);
  assert.match(shellCss, /creative-nav-stack-assemble/);
  assert.match(shellCss, /creative-nav-orbit-pulse/);
  assert.match(shellCss, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)/);
  assert.match(shellCss, /prefers-reduced-motion/);
});
