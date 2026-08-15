# Homepage Production Showcase Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's cropped multi-card demonstrations with production-backed, ratio-correct product-suite, try-on, and social-cover showcases.

**Architecture:** A dedicated production showcase generator creates and audits the two-stage ecommerce assets without changing server behavior. `productionCaseCatalog.js` becomes the typed display contract for final composites, selector previews, try-on workflow assets, and platform semantics; the homepage components render those roles with three purpose-built responsive layouts instead of one generic card grid.

**Tech Stack:** Node.js 22 test runner, React 18, Vite 6, CSS Grid/Flexbox, Sharp 0.35, existing ShuBao production ecommerce and Canvas APIs.

## Global Constraints

- Preserve the product-suite explanation on the left; replace only the right visual area with one complete 1:1 final composite.
- Generate the ecommerce detail suite first, then generate the final composite from those stable production assets.
- Never rerun stage one because stage two failed; inspect task, assets, and billing before any deliberate retry.
- Do not use white-background or transparent cutout images in the product-suite selector fan.
- Never crop a try-on input, model, garment, or result to fit a fixed display frame.
- Social-cover chapter two order is Xiaohongshu, Bilibili, Douyin, with equal-height symmetric outer cards.
- Do not modify AI-video files, `src/pages/EcCanvas/`, the current `test/deploy-script.test.mjs`, runtime extension-task deletions, `.tmp_patch_responsive.py`, or unrelated `RTK.md` / progress-ledger changes.
- Do not trigger real video generation.
- Deploy only with `scripts/deploy-production.ps1` after the branch is fully reviewed and verified.

## File Map

- Create `scripts/generate-production-ecommerce-showcase.mjs`: resumable two-stage production generation, billing audit, stable-asset download, and image metadata validation.
- Create `test/production-ecommerce-showcase.test.mjs`: pure payload, resume, stable URL, and stage-gating tests for the generator.
- Modify `src/pages/Home/productionCaseCatalog.js`: semantic asset roles, selector previews, final composite, and platform metadata.
- Modify `src/pages/Home/galleryModel.js`: use the final product-suite composite as the gallery cover while keeping detail inputs available for remix.
- Modify `src/pages/Home/ec/EcommerceWorkbench.jsx`: product final-composite view, selector-specific assets, and workflow-level try-on lightbox.
- Modify `src/pages/Home/Home.css`: dedicated product-suite and two try-on workflow layouts.
- Modify `src/pages/Home/VisualCreationMode.jsx`: attach stable platform classes/attributes to social-cover cards.
- Modify `src/pages/Home/VisualCreationMode.css`: three-platform symmetric native-ratio layout.
- Modify `test/production-case-catalog.test.mjs`: catalog roles, platform order, file existence, and pixel-ratio contract.
- Modify `test/ecommerce-ability-ui-contract.test.mjs`: single product composite and complete try-on workflow contract.
- Modify `test/visual-creation-ui.test.mjs`: Xiaohongshu/Bilibili/Douyin semantic layout contract.
- Create production rasters under `public/images/home/ecommerce-showcase/` and corresponding WebP thumbnails under `public/images/.thumbs/home/ecommerce-showcase/`.
- Create only necessary try-on selector rasters under `public/images/home/tryon-showcase/` and matching thumbnails.

---

### Task 1: Two-Stage Production Showcase Generator

**Files:**
- Create: `scripts/generate-production-ecommerce-showcase.mjs`
- Create: `test/production-ecommerce-showcase.test.mjs`

**Interfaces:**
- Produces: `buildDetailDirectionPayload({ product })`, `buildDetailGenerationPayload({ product, direction, quoteId, submissionId })`, `buildCompositePayload({ detailUrls, quoteId, requestKey })`, `assertStableAssets(urls)`, and `generateProductionEcommerceShowcase(options)`.
- Persists audit evidence to ignored `.tmp/production-ecommerce-showcase/earbuds-suite.json` and downloads accepted assets only when `SHUBAO_SHOWCASE_DOWNLOAD=1`.

- [ ] **Step 1: Write failing payload and stage-gating tests**

```js
test('stage two consumes stable stage-one outputs without resubmitting stage one', async () => {
  const calls = [];
  const result = await generateProductionEcommerceShowcase({
    sessionToken: 'session',
    request: fakeProductionRequest(calls),
    download: false,
  });
  assert.equal(calls.filter(call => call.path === '/api/generate-ecommerce').length, 1);
  const composite = calls.find(call => call.path === '/api/canvas/regenerate').body;
  assert.equal(composite.image_url, result.detailUrls[0]);
  assert.deepEqual(composite.reference_images, result.detailUrls.slice(1));
  assert.equal(result.detailUrls.length, 5);
});

test('stage-two failure preserves stage-one task and billing evidence', async () => {
  const error = await assert.rejects(() => generateProductionEcommerceShowcase({
    sessionToken: 'session',
    request: fakeProductionRequest([], { failComposite: true }),
    download: false,
  }));
  assert.match(error.message, /stage two/i);
  assert.equal(error.audit.stageOne.status, 'completed');
  assert.equal(error.audit.stageTwo.status, 'failed');
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test test/production-ecommerce-showcase.test.mjs`  
Expected: FAIL because the generator module and exported functions do not exist.

- [ ] **Step 3: Implement the minimal resumable generator**

```js
export function buildCompositePayload({ detailUrls, quoteId, requestKey }) {
  const stable = assertStableAssets(detailUrls);
  return {
    prompt: COMPOSITE_PROMPT,
    image_url: stable[0],
    reference_images: stable.slice(1),
    reference_metadata: stable.map((url, index) => ({
      url,
      mention: `@详情图 ${index + 1}`,
      role: 'reference',
    })),
    ratio: '1:1',
    resolution: '2K',
    image_model: 'image2',
    request_key: requestKey,
    creation_intent: 'visual',
    skill_id: 'free',
    billing_quote_id: quoteId,
    billing_action_id: `showcase-${requestKey}`,
  };
}
```

The implementation must authenticate the owner account, upload the existing earbud source, request exactly five 3:4 deliverables, refresh the five-unit quote immediately before `/api/generate-ecommerce`, poll one task to a terminal state, verify five stable URLs, obtain a fresh one-unit quote, submit one 1:1 Canvas generation, save both task IDs and ledger snapshots, and throw an error carrying the completed stage-one audit when stage two fails. HTTP calls that can create paid work use `maxAttempts: 1`.

- [ ] **Step 4: Run focused tests and existing production verifier tests**

Run: `node --test test/production-ecommerce-showcase.test.mjs test/production-ecommerce-verifier.test.mjs test/production-visual-case-manifest.test.mjs`  
Expected: all tests PASS and no paid network request occurs in tests.

- [ ] **Step 5: Commit only the generator and its test**

```powershell
git add -- scripts/generate-production-ecommerce-showcase.mjs test/production-ecommerce-showcase.test.mjs
git commit -m "feat: add resumable ecommerce showcase generation"
```

### Task 2: Generate, Inspect, and Register Production Assets

**Files:**
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Modify: `src/pages/Home/galleryModel.js`
- Modify: `test/production-case-catalog.test.mjs`
- Create: accepted rasters and thumbnails under the ecommerce and try-on public asset directories listed in the file map.

**Interfaces:**
- Consumes: Task 1's audit `{ stageOne: { taskId, stableUrls }, stageTwo: { taskId, stableUrl }, billing }`.
- Produces: catalog assets with `displayRole: 'finalComposite' | 'detailSource' | 'selectorPreview'`, optional `selectorKind: 'structure' | 'usage' | 'scene'`, and optional `platform: 'xiaohongshu' | 'bilibili' | 'douyin' | 'wechat'`.

- [ ] **Step 1: Update catalog tests to require the approved contract**

```js
test('product suite exposes one square final composite and three rich selector previews', () => {
  const item = productionCaseById('product-suite');
  const finalAssets = item.assets.filter(asset => asset.displayRole === 'finalComposite');
  const previews = item.assets.filter(asset => asset.displayRole === 'selectorPreview');
  assert.equal(finalAssets.length, 1);
  assert.equal(finalAssets[0].ratio, '1:1');
  assert.deepEqual(previews.map(asset => asset.selectorKind), ['structure', 'usage', 'scene']);
  assert.ok(previews.every(asset => asset.isWhiteBackground !== true));
});

test('social formats declare the required platform order', () => {
  const chapter = productionCaseById('social-cover').chapters.find(item => item.id === 'social-formats');
  assert.deepEqual(chapter.assets.map(asset => asset.platform), ['xiaohongshu', 'bilibili', 'douyin']);
});
```

- [ ] **Step 2: Run the catalog test and confirm RED**

Run: `node --test test/production-case-catalog.test.mjs`  
Expected: FAIL because final-composite, selector, and platform metadata are absent.

- [ ] **Step 3: Obtain a temporary production owner session and execute the generator once**

Run the existing production-session issuer through the same SSH/environment path used by `scripts/deploy-production.ps1`, keep the token only in the process environment, then run:

```powershell
$env:SHUBAO_SHOWCASE_DOWNLOAD='1'
node scripts/generate-production-ecommerce-showcase.mjs --base-url https://shuimg.cn
Remove-Item Env:SHUBAO_SHOWCASE_DOWNLOAD
```

Expected: one completed ecommerce task with five stable 3:4 assets, followed by one completed Canvas task with one stable 1:1 asset. The audit records both task IDs, stable URLs, balance snapshots, and ledger entries. Do not retry automatically after any paid stage reports a terminal failure.

- [ ] **Step 4: Inspect every downloaded raster and select assets**

Use image metadata plus visual inspection. Reject the run if the final composite is not square, the earbud/charging-case identity changes materially, an edge panel is cropped, the selector candidates are white-background cutouts, or prominent Chinese copy is unreadable. A rejected stage-two result may be deliberately retried with the same stage-one URLs only after ledger reconciliation.

- [ ] **Step 5: Create 720px WebP thumbnails**

```js
await sharp(sourcePath)
  .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(thumbnailPath);
```

Create thumbnails at paths matching `ResponsiveImage`'s `/images/.thumbs/<relative-source>.webp` convention. Create try-on selector previews from complete, already production-backed try-on images only; use `fit: 'contain'` on an opaque neutral canvas so no garment or person is cut.

- [ ] **Step 6: Register exact provenance and make gallery cover final-composite-first**

```js
asset({
  id: 'earbuds-suite-composite',
  src: '/images/home/ecommerce-showcase/earbuds-suite-composite.png',
  label: '完整商品套图成片',
  role: 'result',
  displayRole: 'finalComposite',
  ratio: '1:1',
  taskId: audit.stageTwo.taskId,
  requestKey: audit.stageTwo.requestKey,
  intent: 'product_suite',
})
```

Update `productSuiteGalleryItem` to choose `displayRole === 'finalComposite'` as `cover_url`; preserve `detailSource` assets in `images` and preserve the product source in remix references.

- [ ] **Step 7: Run catalog and gallery tests**

Run: `node --test test/production-case-catalog.test.mjs test/ecommerce-gallery-cover-selection.test.mjs test/gallery-assets-contract.test.mjs test/generated-assets.test.mjs`  
Expected: all tests PASS; every checked-in asset exists and its declared ratio matches actual pixels.

- [ ] **Step 8: Commit the accepted assets, catalog, gallery model, and tests**

Stage only the exact accepted files and use commit message: `feat: register production homepage showcase assets`.

### Task 3: Product-Suite Final Composite and Selector Fan

**Files:**
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/Home.css`
- Modify: `test/ecommerce-ability-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `displayRole === 'finalComposite'` and `displayRole === 'selectorPreview'` from Task 2.
- Produces: `ProductSuiteShowcase` with one zoom target and `AbilitySelectorFan` driven by selector assets.

- [ ] **Step 1: Replace old UI assertions with failing single-composite assertions**

```js
test('product showcase renders one final composite without source, arrows, or result deck', () => {
  assert.match(workbench, /displayRole === 'finalComposite'/);
  assert.match(workbench, /ec-product-suite-composite/);
  assert.doesNotMatch(workbench, /ec-product-suite-source/);
  assert.doesNotMatch(workbench, /ec-product-suite-results/);
});

test('ability selector consumes explicit rich preview assets', () => {
  assert.match(workbench, /displayRole === 'selectorPreview'/);
  assert.match(workbench, /selectorKind/);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test test/ecommerce-ability-ui-contract.test.mjs`  
Expected: FAIL on the new composite and selector expectations.

- [ ] **Step 3: Implement the single-image product showcase**

```jsx
const composite = suiteCase.assets.find(asset => asset.displayRole === 'finalComposite');
return <>
  <section className="ec-product-suite-showcase" aria-label="商品套图效果预览">
    <div className="ec-product-suite-showcase-copy">...</div>
    <div className="ec-product-suite-showcase-visual">
      <button type="button" className="ec-product-suite-composite" onClick={() => setPreviewOpen(true)} aria-label={`放大查看${composite.label}`}>
        <ResponsiveImage src={composite.src} variant="display" ratio="1:1" alt={composite.label} />
        <Maximize2 size={14} />
      </button>
    </div>
  </section>
  {previewOpen && <SingleImagePreview item={composite} onClose={() => setPreviewOpen(false)} />}
</>;
```

The modal supports Escape and backdrop close. It has no previous/next controls because the showcase contains one image.

- [ ] **Step 4: Replace legacy product-card CSS with a square final-composite layout**

```css
.ec-product-suite-composite {
  position: relative;
  width: min(286px, 82%);
  aspect-ratio: 1;
  overflow: hidden;
  padding: 0;
  border: 5px solid #fff;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 16px 34px rgba(50, 42, 38, .16);
  cursor: zoom-in;
}

.ec-product-suite-composite img { object-fit: contain; }
```

Delete obsolete `.ec-product-suite-source`, `.ec-product-suite-results`, and numbered result overrides so later duplicate rules cannot revive the previous composition.

- [ ] **Step 5: Run focused UI and image tests**

Run: `node --test test/ecommerce-ability-ui-contract.test.mjs test/image-url.test.mjs test/image-view-policy.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 6: Commit product showcase UI only**

Stage the three files listed for Task 3 and commit with `fix: show one complete ecommerce showcase result`.

### Task 4: Complete Try-On Workflow Banners

**Files:**
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/Home.css`
- Modify: `test/ecommerce-ability-ui-contract.test.mjs`

**Interfaces:**
- Consumes: semantic `source`, `reference`, `result`, and `selectorPreview` assets.
- Produces: `TryOnAnglesWorkflow`, `TryOnReferenceWorkflow`, and one workflow-level zoom dialog.

- [ ] **Step 1: Write failing structure assertions for the two workflows**

```js
test('try-on carousel renders two complete relationship banners', () => {
  assert.match(workbench, /ec-tryon-workflow-banner/);
  assert.match(workbench, /ec-tryon-workflow-source/);
  assert.match(workbench, /ec-tryon-workflow-results/);
  assert.match(workbench, /ec-tryon-workflow-reference/);
  assert.match(workbench, /aria-label={`放大查看完整流程/);
  assert.doesNotMatch(workbench, /openPreview\(item\)/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test test/ecommerce-ability-ui-contract.test.mjs`  
Expected: FAIL because the current implementation zooms independent narrow cards.

- [ ] **Step 3: Implement semantic workflow renderers**

```jsx
function TryOnAnglesWorkflow({ slide }) {
  return <div className="ec-tryon-workflow is-angles">
    <WorkflowAsset item={slide.source} className="ec-tryon-workflow-source" />
    <span className="ec-tryon-workflow-arrow" aria-hidden="true"><ArrowRight /></span>
    <div className="ec-tryon-workflow-results">
      {slide.results.map((item, index) => <WorkflowAsset key={item.id} item={item} className={`result-${index}`} />)}
    </div>
  </div>;
}

function TryOnReferenceWorkflow({ slide }) {
  return <div className="ec-tryon-workflow is-reference">
    <WorkflowAsset item={slide.source} className="ec-tryon-workflow-source" />
    <Plus aria-hidden="true" />
    <WorkflowAsset item={slide.reference} className="ec-tryon-workflow-reference" />
    <ArrowRight aria-hidden="true" />
    <WorkflowAsset item={slide.results[0]} className="ec-tryon-workflow-final" />
  </div>;
}
```

Every `WorkflowAsset` uses its declared ratio and `object-fit: contain`. The outer banner button opens a dialog that preserves the complete relationship. The existing auto/manual dwell timing and reduced-motion behavior remain.

- [ ] **Step 4: Implement stable desktop, tablet, and mobile banner CSS**

Use explicit aspect-ratio tracks rather than fixed image heights. The angle results use one central card and overlapping side cards; reference flow uses `grid-template-columns: minmax(80px,.9fr) auto minmax(72px,.72fr) auto minmax(120px,1.2fr)`. At 640px, scale gaps and widths but retain the left-to-right relationship; do not switch to cropped tiles.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/ecommerce-ability-ui-contract.test.mjs test/production-case-catalog.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 6: Commit the try-on workflow change**

Stage the three Task 4 files and commit with `fix: preserve complete try-on showcase workflows`.

### Task 5: Symmetric Social Platform Showcase

**Files:**
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/VisualCreationMode.css`
- Modify: `test/visual-creation-ui.test.mjs`

**Interfaces:**
- Consumes: `asset.platform` metadata from Task 2.
- Produces: `data-platform` and `platform-<id>` hooks for ratio-native semantic layout.

- [ ] **Step 1: Add failing semantic layout assertions**

```js
assert.match(source, /data-platform=\{item\.platform/);
assert.match(styles, /\.platform-xiaohongshu/);
assert.match(styles, /\.platform-bilibili/);
assert.match(styles, /\.platform-douyin/);
assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*\.82fr\)\s+minmax\(0,\s*1\.2fr\)\s+minmax\(0,\s*\.82fr\)/);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test test/visual-creation-ui.test.mjs`  
Expected: FAIL because platform-specific hooks and three-column layout do not exist.

- [ ] **Step 3: Add platform hooks without changing generic recipe cards**

```jsx
const platformClass = item.platform ? ` platform-${item.platform}` : '';
return <button
  className={`visual-skill-stage-card ${className}${platformClass}`}
  data-platform={item.platform || undefined}
  style={{ '--case-ratio': item.ratio.replace(':', ' / ') }}
>...</button>;
```

- [ ] **Step 4: Replace the two-row platform fan with symmetric three-column CSS**

```css
.visual-layout-platform-fan .visual-skill-stage-outputs.is-chapter {
  display: grid;
  grid-template-columns: minmax(0, .82fr) minmax(0, 1.2fr) minmax(0, .82fr);
  grid-template-rows: 1fr;
  align-items: center;
  gap: 10px;
}

.visual-layout-platform-fan .platform-xiaohongshu { transform: rotate(4deg); }
.visual-layout-platform-fan .platform-bilibili { transform: none; }
.visual-layout-platform-fan .platform-douyin { transform: rotate(-4deg); }
```

Set Xiaohongshu and Douyin to one equal display height with width derived from their declared ratio. Bilibili remains native 16:9 in the center. Add a separate WeChat rule for chapter one rather than inheriting chapter-two widths. Mobile reduces the rotations to two degrees and maintains semantic order.

- [ ] **Step 5: Run visual creation tests**

Run: `node --test test/visual-creation-ui.test.mjs test/visual-creation-model.test.mjs test/production-case-catalog.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 6: Commit the social layout change**

Stage the three Task 5 files and commit with `fix: align social previews by platform ratio`.

### Task 6: Integrated Verification, Review, Deployment, and Online Acceptance

**Files:**
- Modify only if no concurrent owner is active: `.superpowers/sdd/progress.md`, `RTK.md`
- Do not modify `test/deploy-script.test.mjs`; consume the other thread's final version.

**Interfaces:**
- Consumes: all preceding commits and the current AI-video thread's committed state.
- Produces: reviewed release commit, production release, online evidence, and updated recovery record when ownership is clear.

- [ ] **Step 1: Re-run collaboration and ownership checks**

Run: `npm run collab:check` and inspect `git status --short --branch`.  
Expected: READY; no homepage file has an uncommitted owner other than this task. If the AI-video thread is still editing shared build/deploy tests, wait for its commit and rebase/review without overwriting its work.

- [ ] **Step 2: Run focused regression and full verification**

Run:

```powershell
node --test test/production-ecommerce-showcase.test.mjs test/production-case-catalog.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/visual-creation-ui.test.mjs test/gallery-assets-contract.test.mjs test/generated-assets.test.mjs
npm test
npm run build
npm run check
git diff --check
```

Expected: every test passes, Vite production build completes, build check passes, and whitespace check is clean.

- [ ] **Step 3: Start a local server and perform browser QA**

Start the Vite dev server on the first free port. At 1440px, 980px, and 390px capture screenshots and assert:

- Product suite has one complete square composite and no source/arrow/deck remnants.
- Product selector fan shows structure, usage, and scene images without a white-background card.
- Try-on selector images fit their frames.
- Both try-on workflow slides keep all products and people complete and the lightbox shows the whole relationship.
- Social chapter two is Xiaohongshu left, Bilibili center, Douyin right, with symmetric outer cards.
- No horizontal overflow, failed image decode, console error, incoherent overlap, or blank primary image.

- [ ] **Step 4: Review the complete diff against the approved specification**

Inspect every changed homepage file, asset provenance, task ID, request key, and thumbnail. Confirm no AI-video, Canvas, runtime, or unrelated file was staged. Fix any finding and rerun the affected focused test plus the full test command.

- [ ] **Step 5: Commit final QA-only corrections and recovery evidence**

If `RTK.md` and the progress ledger are no longer concurrently owned, append the release-candidate evidence and commit only those exact files plus any verified QA correction. Otherwise leave them untouched and include the evidence in the final report until the concurrent owner releases them.

- [ ] **Step 6: Deploy through the mandated production script**

Run: `powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1`  
Expected: deployment lock acquired, tests/build/contracts pass, two real ecommerce canary tasks deliver stable assets, 600-second Canary passes, public audit passes, PM2 remains stable, and the lock is released. No video generation request is created.

- [ ] **Step 7: Perform public online acceptance**

At `https://shuimg.cn/`, repeat the 1440px and 390px checks, exercise ability switching, both carousel dots, product and try-on lightboxes, Escape/backdrop close, and reduced-motion behavior. Record the active bundle, release commit, public health, audit count, production showcase task IDs, deployment canary task IDs, and any residual risk.

