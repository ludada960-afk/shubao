# Try-On Showcase Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase the density of the approved 1600x900 try-on showcase while keeping the left flatlay complete and all four right-side model cards fully inside the canvas.

**Architecture:** Keep the existing case ID, source manifest, composite renderer, CDN URL, and centered modal. Adjust only `TRYON_LAYOUT_PLANS['editorial-multi-angle-v4']`, move the decoration arrow/ground shadow to match, regenerate the full and thumbnail WebP, and extend the composite contract tests with explicit safe-bound checks.

**Tech Stack:** Node.js, Sharp, Node test runner, Playwright, PowerShell deployment script.

## Global Constraints

- Do not touch AI-video files, routes, tests, runtime data, or its deployment window.
- Keep `editorial-flatlay-v3.webp` complete with `contain`.
- Keep all four model cards complete with `contain`; no cropped head, hem, shoe, or outer card edge.
- Preserve `editorial-multi-angle-v4`, 1600x900 output, `?v=da45a36`, click-to-preview, and modal centering.

---

### Task 1: Add density and safe-bound regression assertions

**Files:**
- Modify: `test/home-showcase-composites.test.mjs`

- [ ] **Step 1: Add explicit card-size assertions**

After the existing `resultCards` rotation assertion, add:

```js
assert.ok(multiAngle.resultCards.every(card => card.width >= 250));
assert.ok(multiAngle.resultCards.every(card => card.height >= 600));
assert.ok(multiAngle.resultCards.at(-1).left + multiAngle.resultCards.at(-1).width <= 1600);
```

- [ ] **Step 2: Run the focused test and confirm the old layout fails**

```powershell
node --test test/home-showcase-composites.test.mjs
```

Expected: FAIL because the current result cards are 230px wide and two cards are below 600px high.

- [ ] **Step 3: Commit the red test**

```powershell
git add test/home-showcase-composites.test.mjs
git commit -m "test: require denser uncropped try-on cards"
```

### Task 2: Increase card density and regenerate assets

**Files:**
- Modify: `scripts/build-home-showcase-composites.mjs`
- Regenerate: `public/images/home/tryon-showcase/editorial-multi-angle-v4.webp`
- Regenerate: `public/images/.thumbs/home/tryon-showcase/editorial-multi-angle-v4.webp`

- [ ] **Step 1: Update the four card placements**

Use these exact placements:

```js
resultCards: Object.freeze([
  Object.freeze({ left: 600, top: 154, width: 250, height: 600, rotation: -7, fit: 'contain' }),
  Object.freeze({ left: 830, top: 116, width: 250, height: 640, rotation: -2, fit: 'contain' }),
  Object.freeze({ left: 1060, top: 116, width: 250, height: 640, rotation: 2, fit: 'contain' }),
  Object.freeze({ left: 1290, top: 154, width: 250, height: 600, rotation: 7, fit: 'contain' }),
]),
```

- [ ] **Step 2: Reposition decoration elements**

In `multiAngleDecoration()`, use the shorter path `M540 452 C560 416 575 390 590 372`, the arrowhead around `M566 346 L616 364 L588 402 Z`, and move the ground ellipse to `cx=820`, `rx=690` so it supports the enlarged composition without crossing card content.

- [ ] **Step 3: Regenerate and inspect the composite**

```powershell
node scripts/build-home-showcase-composites.mjs
```

Open `public/images/home/tryon-showcase/editorial-multi-angle-v4.webp` and verify the left flatlay is complete, all four cards show head-to-shoe content, and no rotated card reaches the canvas edge.

- [ ] **Step 4: Run focused tests**

```powershell
node --test test/home-showcase-composites.test.mjs test/ecommerce-ability-ui-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit source and generated assets**

```powershell
git add scripts/build-home-showcase-composites.mjs public/images/home/tryon-showcase/editorial-multi-angle-v4.webp public/images/.thumbs/home/tryon-showcase/editorial-multi-angle-v4.webp
git commit -m "fix: densify uncropped try-on showcase cards"
```

### Task 3: Verify and deploy

- [ ] **Step 1: Run full tests, build, and checks**

```powershell
npm test
npm run build
npm run check
```

- [ ] **Step 2: Use Playwright at desktop and 390px mobile**

Verify the public/local banner image is 1600x900, the document has no horizontal overflow, and the clicked preview dialog center delta is under 12px in both axes.

- [ ] **Step 3: Deploy from a clean temporary worktree**

```powershell
.\scripts\deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 180
```

- [ ] **Step 4: Verify production**

Confirm health 200, `npm run audit:production` 27/27, the new image response, and a fresh browser rendering the enlarged complete card fan.
