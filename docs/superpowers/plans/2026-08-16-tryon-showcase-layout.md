# Try-On Showcase Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the “万物上身” wide showcase match the approved reference composition with a complete, enlarged clothing flatlay, four complete fanned model views, and a vertically/horizontally centered image preview modal.

**Architecture:** Keep the existing `editorial-multi-angle-v4` case ID, 1600x900 production composite, CDN query parameter, and React gallery behavior. Change only the composite definition/layout and the final CSS override: the composite uses the existing complete `editorial-flatlay-v3.webp` source with `contain`, while the modal restores grid centering and retains viewport-bounded scrolling.

**Tech Stack:** Node.js, Sharp, Node test runner, React, CSS, Vite, Playwright, `scripts/deploy-production.ps1`.

## Global Constraints

- Do not modify the AI-video thread, its files, its deployment state, or its release window.
- Preserve the existing ecommerce case IDs, production catalog contract, CDN cache-busting query, keyboard controls, close behavior, and zoom behavior.
- Do not crop any clothing or model source; all showcase cards must use `contain` and remain inside the 1600x900 canvas.
- Preserve unrelated user changes in the feature worktree; stage only files listed in the task being committed.
- Deploy only through `scripts/deploy-production.ps1` after focused tests, full tests, build, browser verification, and production audit pass.

---

### Task 1: Lock the approved asset and layout contract with regression tests

**Files:**
- Modify: `test/home-showcase-composites.test.mjs`
- Modify: `test/ecommerce-ability-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `HOME_SHOWCASE_COMPOSITES` and `TRYON_LAYOUT_PLANS` from `scripts/build-home-showcase-composites.mjs`; the final CSS text from `src/pages/Home/Home.css`.
- Produces: Failing assertions that require the complete flatlay source, enlarged product placement, and centered modal alignment.

- [ ] **Step 1: Update the composite source assertions**

Replace the multi-angle source assertion with:

```js
assert.deepEqual(multiAngle.sources, [
  'editorial-flatlay-v3.webp',
  'angle-front.png',
  'angle-motion.png',
  'angle-side.png',
  'angle-back.png',
]);
```

Add placement assertions after `assert.equal(multiAngle.product.fit, 'contain');`:

```js
assert.ok(multiAngle.product.width >= 450);
assert.ok(multiAngle.product.height >= 600);
assert.ok(multiAngle.product.left >= 48);
assert.ok(multiAngle.product.left + multiAngle.product.width <= 600);
```

- [ ] **Step 2: Add the modal centering contract**

After the existing workflow-banner CSS assertions, add:

```js
test('try-on preview modal remains centered while respecting viewport bounds', () => {
  const modalRule = styles.match(/\.ec-tryon-preview-modal\s*\{[^}]*\}/g)?.at(-1) || '';
  assert.match(modalRule, /align-items:\s*center/);
  assert.match(modalRule, /justify-items:\s*center/);
  assert.doesNotMatch(modalRule, /align-items:\s*start/);
  assert.match(styles, /\.ec-tryon-preview-dialog\s*\{[^}]*max-height:\s*calc\(100vh/);
});
```

- [ ] **Step 3: Run the focused tests and verify they fail for the old implementation**

Run:

```powershell
node --test test/home-showcase-composites.test.mjs test/ecommerce-ability-ui-contract.test.mjs
```

Expected: FAIL because the old source is `product-flatlay.png` and the final modal rule contains `align-items: start`.

- [ ] **Step 4: Commit the red tests**

```powershell
git add test/home-showcase-composites.test.mjs test/ecommerce-ability-ui-contract.test.mjs
git commit -m "test: lock try-on showcase layout contract"
```

### Task 2: Rebuild the wide product-to-angle composite

**Files:**
- Modify: `scripts/build-home-showcase-composites.mjs`
- Regenerate: `public/images/home/tryon-showcase/editorial-multi-angle-v4.webp`
- Regenerate: `public/images/.thumbs/home/tryon-showcase/editorial-multi-angle-v4.webp`

**Interfaces:**
- Consumes: the existing `editorial-flatlay-v3.webp`, four angle source images, and `TRYON_LAYOUT_PLANS['editorial-multi-angle-v4']`.
- Produces: the same `editorial-multi-angle-v4.webp` contract at 1600x900 with complete source content and no changed case ID.

- [ ] **Step 1: Switch the first source to the complete flatlay**

In `HOME_SHOWCASE_COMPOSITES`, change only the first multi-angle source to:

```js
sources: ['editorial-flatlay-v3.webp', 'angle-front.png', 'angle-motion.png', 'angle-side.png', 'angle-back.png'],
```

- [ ] **Step 2: Enlarge the complete product card without exceeding the canvas**

In the multi-angle layout plan, replace the product placement with:

```js
product: Object.freeze({ left: 76, top: 142, width: 470, height: 610, rotation: -3, fit: 'contain' }),
```

Keep the four result cards at their existing complete-card placements and rotations so their fan remains within `visualBounds`.

- [ ] **Step 3: Regenerate production composites and thumbnails**

Run:

```powershell
node scripts/build-home-showcase-composites.mjs
```

Expected: JSON output contains `editorial-multi-angle-v4` and `tryon-reference-workflow`, and both the full-size WebP and its thumbnail are rewritten.

- [ ] **Step 4: Verify dimensions and focused composite tests**

Run:

```powershell
node --test test/home-showcase-composites.test.mjs
```

Expected: PASS; the generated multi-angle image remains `1600:900`, all five sources are represented by the contract, and all card placements use `contain`.

- [ ] **Step 5: Commit the composite implementation and generated assets**

```powershell
git add scripts/build-home-showcase-composites.mjs public/images/home/tryon-showcase/editorial-multi-angle-v4.webp public/images/.thumbs/home/tryon-showcase/editorial-multi-angle-v4.webp
git commit -m "fix: use complete flatlay in try-on showcase"
```

### Task 3: Restore true preview-modal centering

**Files:**
- Modify: `src/pages/Home/Home.css`

**Interfaces:**
- Consumes: the existing `.ec-tryon-preview-modal` grid and `.ec-tryon-preview-dialog` viewport constraints.
- Produces: a modal whose dialog is centered in the viewport, with internal scrolling still available when the image and copy exceed the viewport.

- [ ] **Step 1: Replace the final alignment override**

In the final `.ec-tryon-preview-modal` rule, replace:

```css
align-items: start;
```

with:

```css
align-items: center;
justify-items: center;
overflow: auto;
```

Leave the existing `padding: clamp(12px, 4vh, 32px) 16px;` and dialog `max-height` rule intact.

- [ ] **Step 2: Run the UI contract tests**

Run:

```powershell
node --test test/ecommerce-ability-ui-contract.test.mjs
```

Expected: PASS, including the centered modal assertion and the existing 16:9 contain contract.

- [ ] **Step 3: Commit the modal implementation**

```powershell
git add src/pages/Home/Home.css
git commit -m "fix: center try-on preview modal"
```

### Task 4: Run visual QA and release verification

**Files:**
- No source changes expected; only QA screenshots/logs outside tracked source if needed.

**Interfaces:**
- Consumes: the two implementation commits and existing Home/ecommerce routes.
- Produces: verified desktop/mobile layout, centered modal, passing repository checks, and a production deployment with independent public verification.

- [ ] **Step 1: Run the focused and full automated checks**

Run:

```powershell
node --test test/home-showcase-composites.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/production-case-catalog.test.mjs
npm test
npm run build
npm run check
```

Expected: all tests pass, production build succeeds, and type/lint checks report no errors.

- [ ] **Step 2: Start the local app and inspect both target states with Playwright**

Open the local Home page at a free Vite port, click the exact `万物上身` ability, and verify:

```js
const banner = page.locator('.ec-tryon-workflow-banner').first();
await expect(banner).toBeVisible();
await expect(banner.locator('img')).toHaveJSProperty('naturalWidth', 1600);
await banner.click();
const dialog = page.locator('.ec-tryon-preview-dialog');
const box = await dialog.boundingBox();
const viewport = page.viewportSize();
expect(Math.abs((box.x + box.width / 2) - viewport.width / 2)).toBeLessThan(12);
expect(Math.abs((box.y + box.height / 2) - viewport.height / 2)).toBeLessThan(12);
```

Repeat at desktop and 390px mobile viewports; confirm no horizontal overflow, complete flatlay edges, complete model cards, close, Escape, and arrow-key navigation.

- [ ] **Step 3: Deploy only from a clean temporary worktree**

Create a temporary worktree from the final feature commit, preserve only the intended commits, and run:

```powershell
.\scripts\deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 180
```

Do not deploy from the dirty feature worktree. Wait for the script to exit successfully and keep the temporary worktree isolated from the AI-video work.

- [ ] **Step 4: Verify the public release independently**

Run:

```powershell
node -e "fetch('https://shuimg.cn/health').then(async r => { console.log(r.status, await r.text()); if (!r.ok) process.exit(1); })"
$env:AUDIT_BASE_URL = 'https://shuimg.cn'; npm run audit:production
```

Then use a fresh browser context against `https://shuimg.cn/` to verify the `万物上身` banner URL, `naturalWidth === 1600`, centered preview dialog, and no console/page errors.

- [ ] **Step 5: Record release evidence and clean temporary deployment worktree**

Capture the deployed commit, health response, audit result, canary result, and browser observations in the existing release evidence flow; remove only the temporary deployment worktree after verification and leave all user-owned dirty files untouched.

## Self-review

- Spec coverage: complete flatlay source, enlarged contained product card, four contained fanned model cards, single arrow, fixed 16:9 output, centered preview modal, desktop/mobile QA, and production verification are covered by Tasks 1–4.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation step is used; every code change includes the exact assertion or CSS/value to apply.
- Type/contract consistency: the plan keeps the existing `editorial-multi-angle-v4` ID, source count, output dimensions, CSS class names, and React modal behavior unchanged.
