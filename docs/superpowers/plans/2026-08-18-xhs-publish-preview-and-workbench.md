# 小红书图文发布预览与输入工作台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让小红书案例以可放大、可切换 9 张图片、可阅读完整文章的发布成品展示，并让小红书输入工作台复用电商上传与配置组件而不改变电商行为。

**Architecture:** 新增一个纯函数模型统一整理案例图片和切换索引，React 展示层在 `CreationShowcase.jsx` 内负责紧凑案例卡和发布预览模态。`SupplementAssetDeck` 增加默认保持电商倾斜、按调用方选择直角排列的可选参数；`XhsInputTemplate` 改为 keyed option panel，一次只打开一个向上展开的本地化面板。服务端生成接口不变，Plog 继续使用已有 `style/layout` 参数。

**Tech Stack:** React 18, Vite, JSX, CSS, Lucide, existing `ResponsiveImage`, Node `node:test` source-contract tests.

## Global Constraints

- 只修改小红书图文/Plog展示和输入工作台；电商套图与视频生成的页面结构、状态和行为不改。
- `SupplementAssetDeck` 默认倾斜参数必须保持电商现有值；小红书显式关闭倾斜。
- 不虚构 Plog 案例；没有真实数据时只显示空状态。
- 发布预览必须使用真实 `GALLERY.xm` 数据，完整正文和全部标签不能被截断。
- 不显示当前服务端没有契约支持的可变视觉方向参数；种草图文的主题快捷入口必须继续真实填入文本，Plog 风格/排版必须继续映射 `plogStyle`/`plogLayout`。
- 所有提交显式列出文件，不使用 `git add .` 或 `git add -A`。

---

### Task 1: Add the publish-preview data contract

**Files:**
- Create: `src/pages/Home/xhsPublishPreviewModel.js`
- Create: `test/xhs-publish-preview.test.mjs`

**Interfaces:**
- Produces `buildXhsPublishPages(entry)` returning `{ index, src, alt }[]` from `[cover_url, ...image_urls]`, filtered and limited to 9.
- Produces `getNextXhsPublishIndex(index, delta, count)` returning a wrapped index or `-1` when `count` is zero.
- Produces `getXhsPublishBody(entry)` returning the full body as a string without line clipping.

- [ ] **Step 1: Write the failing model tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildXhsPublishPages,
  getNextXhsPublishIndex,
  getXhsPublishBody,
} from '../src/pages/Home/xhsPublishPreviewModel.js';

test('buildXhsPublishPages keeps cover first and caps the publish set at nine', () => {
  const pages = buildXhsPublishPages({
    title: '厦门',
    cover_url: '/cover.webp',
    image_urls: Array.from({ length: 11 }, (_, index) => `/page-${index + 1}.webp`),
  });
  assert.equal(pages.length, 9);
  assert.equal(pages[0].src, '/cover.webp');
  assert.equal(pages[8].index, 9);
});

test('getNextXhsPublishIndex wraps and returns an empty sentinel without pages', () => {
  assert.equal(getNextXhsPublishIndex(8, 1, 9), 0);
  assert.equal(getNextXhsPublishIndex(0, -1, 9), 8);
  assert.equal(getNextXhsPublishIndex(0, 1, 0), -1);
});

test('getXhsPublishBody preserves every line of the article', () => {
  assert.equal(getXhsPublishBody({ body: '第一段\n\n第二段\n第三段' }), '第一段\n\n第二段\n第三段');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/xhs-publish-preview.test.mjs`

Expected: FAIL because `xhsPublishPreviewModel.js` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

```js
const text = value => String(value || '').trim();

export function buildXhsPublishPages(entry = {}) {
  return [entry.cover_url, ...(Array.isArray(entry.image_urls) ? entry.image_urls : [])]
    .map(text)
    .filter(Boolean)
    .slice(0, 9)
    .map((src, index) => ({ index, src, alt: `${text(entry.title) || '小红书案例'} 第${index + 1}张` }));
}

export function getNextXhsPublishIndex(index, delta, count) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  return (index + delta + count) % count;
}

export function getXhsPublishBody(entry = {}) {
  return String(entry.body || '');
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test test/xhs-publish-preview.test.mjs`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the model and tests**

```bash
git add src/pages/Home/xhsPublishPreviewModel.js test/xhs-publish-preview.test.mjs
git commit -m "test: add xhs publish preview model"
```

### Task 2: Replace the XHS collage with a real publish preview

**Files:**
- Modify: `src/pages/Home/CreationShowcase.jsx`
- Modify: `src/pages/Home/CreationShowcase.css`
- Modify: `test/creation-showcase-model.test.mjs` or create `test/xhs-showcase-ui.test.mjs` if the existing file does not cover JSX contracts.

**Interfaces:**
- `ContentPreview({ entry, plog, onOpen })` renders the compact result and calls `onOpen(index)` from image buttons.
- `XhsPublishPreview({ entry, initialIndex, onClose })` owns selected-page state and keyboard navigation.
- `ContentShowcase` owns `previewIndex`; the Plog empty case never passes an open handler.

- [ ] **Step 1: Add a failing JSX contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/Home/CreationShowcase.jsx', import.meta.url), 'utf8');

test('XHS showcase exposes a full publish preview contract', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /小红书发布预览/);
  assert.match(source, /完整正文/);
  assert.match(source, /上一张/);
  assert.match(source, /下一张/);
  assert.match(source, /Escape/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/xhs-showcase-ui.test.mjs`

Expected: FAIL because the current component has no dialog or page navigation.

- [ ] **Step 3: Implement the compact card and modal**

Use `buildXhsPublishPages` and `getNextXhsPublishIndex`. The compact card may keep a visual 9-page overview, but each page must be a button that calls `onOpen(index)`. The modal must render:

```jsx
<div className="xhs-publish-preview-modal" role="dialog" aria-modal="true" aria-label="小红书发布预览">
  <div className="xhs-publish-preview-dialog">
    <button type="button" aria-label="关闭预览" onClick={onClose}><X /></button>
    <div className="xhs-publish-preview-media">...</div>
    <article className="xhs-publish-preview-article">
      <span>小红书 · {entry.cat || '图文笔记'}</span>
      <h4>{entry.title}</h4>
      <div className="xhs-publish-preview-body">{getXhsPublishBody(entry)}</div>
      <div className="xhs-publish-preview-tags">{entry.tags.map(...)}</div>
    </article>
    <nav aria-label="切换发布配图">{pages.map(...button...)} </nav>
  </div>
</div>
```

Register `keydown` in an effect only while the dialog is open; `Escape` closes, ArrowLeft/ArrowRight wrap through the pages. Do not alter the non-content showcase branches.

- [ ] **Step 4: Add scoped CSS and responsive behavior**

Replace only the XHS content-preview rules in `CreationShowcase.css` with a straight ecommerce-style result card and add `.xhs-publish-preview-*` rules. Use a desktop two-column preview, a `3 / 4` media ratio, an independently scrollable article, a horizontal thumbnail strip, and a mobile single-column layout. Keep ecommerce/video selectors untouched.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test test/xhs-publish-preview.test.mjs test/xhs-showcase-ui.test.mjs`

Expected: PASS with all model and JSX contract tests.

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 6: Commit the showcase**

```bash
git add src/pages/Home/xhsPublishPreviewModel.js src/pages/Home/CreationShowcase.jsx src/pages/Home/CreationShowcase.css test/xhs-publish-preview.test.mjs test/xhs-showcase-ui.test.mjs
git commit -m "feat: add xhs publish preview showcase"
```

### Task 3: Reuse the ecommerce upload deck and localize settings

**Files:**
- Modify: `src/pages/Home/ec/components/SupplementAssetDeck.jsx`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Home/CreationShowcase.css`
- Modify: `test/content-reference-picker-ui.test.mjs` and create `test/xhs-workbench-ui.test.mjs` for the new keyed panel contract.

**Interfaces:**
- `SupplementAssetDeck({ tilted = true, ...props })` preserves `tilted=true` for all current ecommerce callers.
- `XhsSupplementDeck` passes `tilted={false}` and keeps the existing 6 source/3 style limits.
- `XhsInputTemplate({ activeOption, onOptionToggle, optionPanels, ...props })` uses option keys `structure`, `content`, and `references` for content, and `structure`, `style`, and `layout` for Plog.

- [ ] **Step 1: Add failing source-contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const deck = await readFile(new URL('../src/pages/Home/ec/components/SupplementAssetDeck.jsx', import.meta.url), 'utf8');
const xhs = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');

test('shared deck keeps ecommerce default and allows straight XHS rendering', () => {
  assert.match(deck, /tilted\s*=\s*true/);
  assert.match(xhs, /tilted=\{false\}/);
});

test('XHS controls use independent option keys and upward panel class', () => {
  assert.match(xhs, /activeOption/);
  assert.match(xhs, /onOptionToggle/);
  assert.match(xhs, /xhs-template-options--upward/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/xhs-workbench-ui.test.mjs`

Expected: FAIL because the shared deck has hard-coded transforms and the template has one `optionsOpen` switch.

- [ ] **Step 3: Add the non-breaking shared deck parameter**

Change only the two card and two track inline transforms to conditional values:

```jsx
export default function SupplementAssetDeck({ tilted = true, ...props }) {
  // existing props and logic remain unchanged
  const cardTransform = tilted ? 'rotate(1.5deg)' : 'none';
  const productTrackTransform = tilted ? 'rotate(-1.5deg)' : 'none';
  // reference values use the opposite sign
}
```

Pass `tilted={false}` from `XhsSupplementDeck`; do not change `Plog/index.jsx` or ecommerce callers.

- [ ] **Step 4: Refactor the XHS template to keyed panels**

Replace `optionsOpen`/`onOptionsToggle` with `activeOption`/`onOptionToggle`. Each trigger passes its key and gets `aria-expanded={activeOption === key}`. Render `optionPanels[activeOption]` in `.xhs-template-options--upward`.

Content panels:

- `structure`: one selected, read-only `封面 + 8 张内容页` explanation.
- `content`: `QUICK_HINTS` buttons that fill the actual textarea and close the panel.
- `references`: explanation of 6 user-material and 3 style-reference roles.

Plog panels:

- `structure`: one selected `9 张生活碎片 + 标题 · 正文 · 标签` explanation.
- `style`: existing `plogStyle` options.
- `layout`: existing `plogLayout` options.

Keep the real generation calls unchanged except for existing Plog state updates. Do not add an unsupported content visual-direction API field.

- [ ] **Step 5: Position the panel upward and verify mobile layout**

Use a relatively positioned action container and position the panel above the trigger row on desktop. On narrow screens, keep it in normal flow above the generate button so it remains readable and does not overflow the viewport. Preserve `.ec-config-trigger` dimensions and colors.

- [ ] **Step 6: Run focused tests**

Run: `node --test test/xhs-workbench-ui.test.mjs test/content-reference-picker-ui.test.mjs test/content-entitlement-ui.test.mjs`

Expected: PASS with the existing reference-picker and entitlement contracts intact.

- [ ] **Step 7: Commit the input workbench**

```bash
git add src/pages/Home/ec/components/SupplementAssetDeck.jsx src/pages/Home/XhsContentMode.jsx src/pages/Home/CreationShowcase.css test/xhs-workbench-ui.test.mjs test/content-reference-picker-ui.test.mjs test/content-entitlement-ui.test.mjs
git commit -m "feat: align xhs workbench with ecommerce inputs"
```

### Task 4: Regression, browser verification, and release

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- No production source changes unless a verified test exposes a defect in Tasks 1-3.

**Interfaces:**
- Consumes the committed showcase and workbench behavior from Tasks 1-3.
- Produces a tested production build and a release only through `scripts/deploy-production.ps1`.

- [ ] **Step 1: Run the complete automated regression**

Run: `npm test`

Expected: all existing tests plus the new XHS tests pass; any failure in ecommerce/video tests blocks release.

- [ ] **Step 2: Run static checks**

Run: `npm run check`

Expected: collaboration policy is `READY` and repository checks are clean apart from the known user-owned runtime files.

Run: `git diff --check HEAD~3..HEAD`

Expected: no whitespace errors.

- [ ] **Step 3: Verify the live UI in desktop and mobile browsers**

Open the local production build and verify:

1. XHS case tabs switch between Xiamen and empty Plog.
2. Xiamen case opens the dialog, switches all nine thumbnails, shows the full article, closes with Escape, and has no console error.
3. XHS upload deck is straight, accepts/removes images, and shows the same card structure as ecommerce.
4. Each settings trigger opens only its own upward panel; mobile has no horizontal overflow.
5. Ecommerce suite and video routes remain visually and behaviorally unchanged.

- [ ] **Step 4: Deploy only with the approved script**

Run: `scripts/deploy-production.ps1`

Expected: tests, production build, remote health, public audit, and required canary gates pass; otherwise the script must leave production on the previous release.

- [ ] **Step 5: Record evidence**

Append the implementation commits, test counts, build result, production release, health response, public audit and any residual risk to `.superpowers/sdd/progress.md`. Do not include runtime databases, generated assets, temporary screenshots or deleted extension-task JSON files.

