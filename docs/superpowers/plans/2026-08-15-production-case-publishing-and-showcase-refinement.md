# Production Case Publishing and Showcase Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish faithful production-generated ecommerce cases and replace the current under-filled homepage product and try-on showcase assets with frame-matched compositions.

**Architecture:** Introduce a manifest-shaped case contract that preserves exact per-output prompts, source roles, remix inputs, cover policy, and generation provenance. Keep UI transformations in small pure model modules, extend the existing generation/import scripts, and make raster composition deterministic except for the two explicitly production-generated earbud outputs.

**Tech Stack:** React 18, Vite, Node.js ESM, Sharp, `node:test`, existing production generation API, Playwright/browse visual QA.

## Global Constraints

- AI video features, Canvas interaction, and Canvas rendering are out of scope.
- Product final assets use a 4:3 ratio; try-on workflow assets use 16:9.
- Newly published production outputs require an exact per-output prompt.
- Case-modal background preloading has a concurrency limit of two.
- Production request keys are unique and deterministic; timeouts are reconciled before retry.
- Existing successful stage-one earbud outputs may be reused.
- Do not stage unrelated dirty files; every commit uses explicit paths.

---

### Task 1: Production Case Manifest Contract

**Files:**
- Create: `src/pages/Home/productionCaseManifest.js`
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Modify: `src/pages/Home/galleryModel.js`
- Test: `test/production-case-manifest.test.mjs`
- Test: `test/production-case-catalog.test.mjs`

**Interfaces:**
- Produces: `validateProductionCaseManifest(manifest)` returning the frozen manifest or throwing a field-specific error.
- Produces: `manifestOutputsToGalleryImages(manifest)` returning image objects that retain `prompt`, `role`, and provenance.
- Consumes: existing public image paths and production audit metadata.

- [ ] **Step 1: Write failing manifest tests**

```js
test('new production outputs require exact prompts', () => {
  assert.throws(() => validateProductionCaseManifest({
    id: 'earbuds',
    title: 'Earbuds',
    category: 'ecommerce',
    prompt: 'Create the suite',
    sourceAssets: [],
    outputs: [{ id: 'hero', role: 'hero', url: '/hero.png', prompt: '' }],
    cover: { strategy: 'single', outputIds: ['hero'] },
    remix: { mode: 'product_suite', prompt: 'Create the suite', sourceAssetRoles: [] },
  }), /outputs\[0\]\.prompt/)
})

test('gallery images preserve exact prompt and provenance', () => {
  const images = manifestOutputsToGalleryImages(validManifest)
  assert.equal(images[0].prompt, validManifest.outputs[0].prompt)
  assert.equal(images[0].requestKey, 'showcase-earbuds-hero-v3')
})
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test test/production-case-manifest.test.mjs test/production-case-catalog.test.mjs`

Expected: FAIL because `productionCaseManifest.js` and the manifest exports do not exist.

- [ ] **Step 3: Implement the pure manifest model**

```js
const requiredText = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} is required`)
  return value.trim()
}

export function validateProductionCaseManifest(manifest) {
  requiredText(manifest?.id, 'id')
  requiredText(manifest?.prompt, 'prompt')
  if (!Array.isArray(manifest?.outputs) || manifest.outputs.length === 0) {
    throw new Error('outputs must contain at least one image')
  }
  manifest.outputs.forEach((output, index) => {
    requiredText(output?.id, `outputs[${index}].id`)
    requiredText(output?.url, `outputs[${index}].url`)
    requiredText(output?.prompt, `outputs[${index}].prompt`)
  })
  return Object.freeze(manifest)
}

export const manifestOutputsToGalleryImages = (manifest) =>
  validateProductionCaseManifest(manifest).outputs.map((output) => ({ ...output }))
```

Define the earbud suite as one validated manifest in `productionCaseCatalog.js`, including all source roles, exact prompt constants imported from the production generation script's shared prompt module, stable output URLs, cover strategy, and remix mapping. Update `galleryModel.js` to consume `manifestOutputsToGalleryImages`.

- [ ] **Step 4: Run manifest and catalog tests**

Run: `node --test test/production-case-manifest.test.mjs test/production-case-catalog.test.mjs`

Expected: PASS, including assertions that no product-suite output prompt equals the generic fallback sentence.

- [ ] **Step 5: Commit the manifest contract**

```powershell
git add -- src/pages/Home/productionCaseManifest.js src/pages/Home/productionCaseCatalog.js src/pages/Home/galleryModel.js test/production-case-manifest.test.mjs test/production-case-catalog.test.mjs
git commit -m "feat: preserve production case provenance"
```

### Task 2: Exact Gallery Prompts and Bounded Preloading

**Files:**
- Create: `src/gallery/ecommerceGalleryModel.js`
- Create: `src/gallery/caseImagePreloader.js`
- Modify: `src/NoteModal.jsx`
- Test: `test/ecommerce-gallery-model.test.mjs`
- Test: `test/case-image-preloader.test.mjs`

**Interfaces:**
- Produces: `ecommerceGallerySlides(item)` returning `{ url, title, prompt, description, role }`.
- Produces: `createCaseImagePreloader({ loadImage, concurrency: 2 })` with `preload(urls, activeIndex)` and `cancel()`.
- Consumes: manifest-derived gallery item images from Task 1.

- [ ] **Step 1: Write failing prompt and scheduler tests**

```js
test('slide uses the exact generation prompt', () => {
  const [slide] = ecommerceGallerySlides({ images: [{
    url: '/hero.png', title: 'Hero', prompt: 'Exact production prompt', description: 'Marketing copy',
  }] })
  assert.equal(slide.prompt, 'Exact production prompt')
  assert.equal(slide.description, 'Marketing copy')
})

test('preloader deduplicates and never exceeds two background loads', async () => {
  let active = 0
  let peak = 0
  const gates = []
  const loadImage = (url) => new Promise((resolve) => {
    active += 1
    peak = Math.max(peak, active)
    gates.push(() => { active -= 1; resolve(url) })
  })
  const loader = createCaseImagePreloader({ loadImage, concurrency: 2 })
  const pending = loader.preload(['/a', '/b', '/b', '/c'], 0)
  await Promise.resolve()
  assert.equal(peak, 2)
  while (gates.length) gates.shift()()
  await pending
})
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test test/ecommerce-gallery-model.test.mjs test/case-image-preloader.test.mjs`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement slide normalization and cached scheduler**

```js
const promiseCache = new Map()

export function createCaseImagePreloader({ loadImage, concurrency = 2 }) {
  let generation = 0
  const cachedLoad = (url) => {
    if (!promiseCache.has(url)) promiseCache.set(url, Promise.resolve().then(() => loadImage(url)))
    return promiseCache.get(url)
  }
  return {
    async preload(urls, activeIndex = 0) {
      const ownGeneration = ++generation
      const unique = [...new Set(urls.filter(Boolean))]
      const active = urls[activeIndex]
      const next = urls[(activeIndex + 1) % urls.length]
      const queue = [active, next, ...unique].filter((url, index, all) => url && all.indexOf(url) === index)
      let cursor = 0
      const worker = async () => {
        while (ownGeneration === generation && cursor < queue.length) {
          const url = queue[cursor++]
          await cachedLoad(url).catch(() => undefined)
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
    },
    cancel() { generation += 1 },
  }
}
```

Move the ecommerce slide normalization out of `NoteModal.jsx`. Render `slide.prompt` in the metadata panel and instantiate one preloader per opened ecommerce case. The browser loader creates `new Image()`, sets `decoding = 'async'`, waits for `decode()` when supported, and falls back to `onload`.

- [ ] **Step 4: Run model, scheduler, and modal contract tests**

Run: `node --test test/ecommerce-gallery-model.test.mjs test/case-image-preloader.test.mjs test/image-view-policy.test.mjs`

Expected: PASS with exact prompt output and bounded concurrency.

- [ ] **Step 5: Commit gallery fidelity and preload behavior**

```powershell
git add -- src/gallery/ecommerceGalleryModel.js src/gallery/caseImagePreloader.js src/NoteModal.jsx test/ecommerce-gallery-model.test.mjs test/case-image-preloader.test.mjs test/image-view-policy.test.mjs
git commit -m "fix: preload case images with exact prompts"
```

### Task 3: Faithful Remix Hydration

**Files:**
- Modify: `src/pages/Home/galleryRemixModel.js`
- Modify: `src/pages/Home/GallerySection.jsx`
- Test: `test/gallery-remix-model.test.mjs`

**Interfaces:**
- Produces: `buildGalleryRemixPayload(item)` returning `{ mode, prompt, productImages, referenceImages, sceneImages, styleImages }`.
- Consumes: `item.remix.sourceAssets` and exact replay prompt from the production case manifest.

- [ ] **Step 1: Add failing hydration coverage**

```js
test('product suite remix restores prompt and role-specific sources', () => {
  const payload = buildGalleryRemixPayload({
    remix: {
      mode: 'product_suite',
      prompt: 'Create this exact pearl-white earbud suite',
      sourceAssets: [
        { role: 'product', url: '/product.png' },
        { role: 'style', url: '/style.png' },
      ],
    },
  })
  assert.equal(payload.prompt, 'Create this exact pearl-white earbud suite')
  assert.deepEqual(payload.productImages, ['/product.png'])
  assert.deepEqual(payload.styleImages, ['/style.png'])
})
```

- [ ] **Step 2: Run the remix test and confirm failure**

Run: `node --test test/gallery-remix-model.test.mjs`

Expected: FAIL because product-suite sources are not hydrated by role.

- [ ] **Step 3: Implement role mapping and use it from the gallery action**

```js
const roleTarget = {
  product: 'productImages',
  reference_model: 'referenceImages',
  scene: 'sceneImages',
  style: 'styleImages',
}

for (const asset of remix.sourceAssets || []) {
  const target = roleTarget[asset.role]
  if (target && asset.url) payload[target].push(asset.url)
}
```

Update `GallerySection.jsx` so the click action passes the entire payload through the existing homepage mode-selection path instead of reconstructing the prompt or uploads locally.

- [ ] **Step 4: Run remix and gallery tests**

Run: `node --test test/gallery-remix-model.test.mjs test/production-case-catalog.test.mjs`

Expected: PASS for prompt and all declared upload roles.

- [ ] **Step 5: Commit remix hydration**

```powershell
git add -- src/pages/Home/galleryRemixModel.js src/pages/Home/GallerySection.jsx test/gallery-remix-model.test.mjs
git commit -m "fix: restore case inputs for remix"
```

### Task 4: Production 4:3 Earbud Composite and Face-forward Usage Image

**Files:**
- Create: `src/pages/Home/productionCasePromptLibrary.js`
- Modify: `scripts/generate-production-ecommerce-showcase.mjs`
- Modify: `public/images/home/ecommerce-showcase/earbuds-suite-composite.png`
- Create: `public/images/home/ecommerce-showcase/earbuds-suite-panel-model-usage.png`
- Test: `test/production-ecommerce-showcase.test.mjs`

**Interfaces:**
- Produces: `EARBUD_DETAIL_PROMPTS`, `EARBUD_COMPOSITE_PROMPT_V3`, and deterministic request keys shared by catalog and generation script.
- Produces: a 4:3 composite and 3:4 face-forward model usage image.
- Consumes: five previously successful stage-one output URLs from the local audit manifest.

- [ ] **Step 1: Write failing payload contract tests**

```js
test('v3 composite requests a 4:3 tilted-panel composition', () => {
  const payload = buildCompositePayload(stageOneUrls)
  assert.equal(payload.ratio, '4:3')
  assert.match(payload.description, /shallow directional fan/i)
  assert.match(payload.description, /compact icon-and-type lockups/i)
  assert.match(payload.request_key, /earbuds-composite-v3$/)
})

test('usage generation requires a visible face and worn earbud', () => {
  const payload = buildUsagePayload(productUrl)
  assert.equal(payload.ratio, '3:4')
  assert.match(payload.description, /face clearly visible/i)
  assert.match(payload.description, /earbud visibly worn/i)
})
```

- [ ] **Step 2: Run the generation contract test and confirm failure**

Run: `node --test test/production-ecommerce-showcase.test.mjs`

Expected: FAIL because the composite remains 1:1 and no usage payload exists.

- [ ] **Step 3: Share exact prompts and implement resumable v3 payloads**

```js
export const EARBUD_COMPOSITE_REQUEST_KEY_V3 = 'showcase-20260815-earbuds-composite-v3'
export const EARBUD_USAGE_REQUEST_KEY_V3 = 'showcase-20260815-earbuds-model-usage-v3'

export const EARBUD_COMPOSITE_PROMPT_V3 = `Create one premium 4:3 ecommerce result board from the supplied pearl-white earbud detail panels. Arrange four complete panels as a shallow directional fan with restrained clockwise tilt, place the charging case and two loose earbuds large in the lower foreground, connect the composition with champagne-gold light trails, and design two compact lower-right icon-and-type benefit lockups. Fill the canvas densely while preserving all panel content. Do not add large empty margins, upright equal-width columns, illegible text, duplicated panels, or cropped products.`
```

Add a separate face-forward usage request. Reuse successful stage-one outputs by URL and reconcile any existing task for each request key before submitting a new provider request. Persist task IDs, quote IDs, elapsed time, stable URLs, image dimensions, and prompt strings to the local audit JSON.

- [ ] **Step 4: Run contract tests, then execute formal production generation**

Run: `node --test test/production-ecommerce-showcase.test.mjs`

Expected: PASS.

Run: `node scripts/generate-production-ecommerce-showcase.mjs --stage composite-v3,usage-v3 --env production`

Expected: both requests reach a terminal success state, download stable non-placeholder images, and report `4:3` and `3:4` dimensions respectively. On timeout, run the script's status-resume mode for the same request key; do not create another key.

- [ ] **Step 5: Validate output dimensions and commit assets**

Run: `node --test test/production-ecommerce-showcase.test.mjs test/production-case-catalog.test.mjs`

Expected: PASS and image metadata matches the declared ratios.

```powershell
git add -- src/pages/Home/productionCasePromptLibrary.js scripts/generate-production-ecommerce-showcase.mjs public/images/home/ecommerce-showcase/earbuds-suite-composite.png public/images/home/ecommerce-showcase/earbuds-suite-panel-model-usage.png test/production-ecommerce-showcase.test.mjs src/pages/Home/productionCaseCatalog.js
git commit -m "feat: generate wider earbud showcase"
```

### Task 5: Deterministic Frame-matched Try-on Banners

**Files:**
- Modify: `scripts/build-home-showcase-composites.mjs`
- Modify: `public/images/home/ecommerce-showcase/editorial-multi-angle-v3.webp`
- Modify: `public/images/home/ecommerce-showcase/tryon-reference-workflow.png`
- Test: `test/home-showcase-composites.test.mjs`

**Interfaces:**
- Produces: `buildMultiAngleComposite()` and `buildReferenceTryonComposite()` at 1600x900.
- Consumes: existing full flatlay, model-angle, reference-model, and generated-result assets.

- [ ] **Step 1: Add failing composition-plan tests**

```js
test('multi-angle plan has one flatlay and one four-card fan', () => {
  const plan = multiAngleLayoutPlan()
  assert.equal(plan.width / plan.height, 16 / 9)
  assert.equal(plan.flatlays.length, 1)
  assert.deepEqual(plan.cards.map((card) => card.rotate), [-8, -3, 3, 8])
  assert.equal(plan.cards.length, 4)
})

test('reference plan contains exactly three filled stages', () => {
  const plan = referenceTryonLayoutPlan()
  assert.deepEqual(plan.stages.map((stage) => stage.role), ['product', 'reference_model', 'result'])
  assert.ok(plan.stages.every((stage) => stage.fit === 'cover'))
})
```

- [ ] **Step 2: Run the composition test and confirm failure**

Run: `node --test test/home-showcase-composites.test.mjs`

Expected: FAIL because the current plans use upright columns and padded portrait stages.

- [ ] **Step 3: Implement the two 1600x900 Sharp compositions**

Use `sharp(...).resize({ fit: 'cover', position: 'attention' })` for every portrait card. Render fan cards with `rotate(angle, { background: transparent })`, a 12px white frame, 24px radius, and restrained shadow. Create the editorial arrow as a stroked SVG cubic curve with an arrowhead, and keep one arrow only. For the reference workflow, create one product stage, one reference stage, one result stage, a compact plus disc, and one curved arrow.

- [ ] **Step 4: Build assets and verify exact metadata**

Run: `node scripts/build-home-showcase-composites.mjs`

Run: `node --test test/home-showcase-composites.test.mjs`

Expected: PASS; both files are 1600x900, nonblank, and contain the declared unique source roles exactly once except for the four intentional angle results.

- [ ] **Step 5: Commit deterministic banners**

```powershell
git add -- scripts/build-home-showcase-composites.mjs public/images/home/ecommerce-showcase/editorial-multi-angle-v3.webp public/images/home/ecommerce-showcase/tryon-reference-workflow.png test/home-showcase-composites.test.mjs
git commit -m "fix: fit try-on workflows to showcase frames"
```

### Task 6: Homepage Display Geometry and Selector Content

**Files:**
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/Home.css`
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Test: `test/ecommerce-ability-ui-contract.test.mjs`
- Test: `test/image-view-policy.test.mjs`

**Interfaces:**
- Consumes: 4:3 product composite, face-forward selector image, and 16:9 workflow banners.
- Produces: a single zoomable product result, one wide selector fan per mode, and uncropped responsive presentation.

- [ ] **Step 1: Add failing UI contract assertions**

```js
assert.match(workbenchSource, /earbuds-suite-panel-model-usage\.png/)
assert.match(cssSource, /\.ec-product-suite-final[\s\S]*aspect-ratio:\s*4\s*\/\s*3/)
assert.match(cssSource, /\.ec-tryon-workflow-banner[\s\S]*aspect-ratio:\s*16\s*\/\s*9/)
assert.doesNotMatch(workbenchSource, /objectFit:\s*['"]cover['"][\s\S]*ec-product-suite-final/)
```

- [ ] **Step 2: Run UI contract tests and confirm failure**

Run: `node --test test/ecommerce-ability-ui-contract.test.mjs test/image-view-policy.test.mjs`

Expected: FAIL because the product result remains square and the selector still references the hand crop.

- [ ] **Step 3: Update catalog order, component markup, and final CSS contract block**

Set the product final wrapper to `aspect-ratio: 4 / 3`, use `object-fit: contain`, increase its desktop width to fill the visualization column, and retain the existing zoom action. Select the new model usage image for the top preview. Ensure the try-on selector renders only the single wide fan asset group rather than both old and new groups.

- [ ] **Step 4: Run UI tests and build**

Run: `node --test test/ecommerce-ability-ui-contract.test.mjs test/image-view-policy.test.mjs test/production-case-catalog.test.mjs`

Run: `npm run build`

Expected: all tests PASS and Vite completes without warnings introduced by these files.

- [ ] **Step 5: Commit homepage display changes**

```powershell
git add -- src/pages/Home/ec/EcommerceWorkbench.jsx src/pages/Home/Home.css src/pages/Home/productionCaseCatalog.js test/ecommerce-ability-ui-contract.test.mjs test/image-view-policy.test.mjs
git commit -m "fix: align ecommerce showcases to their frames"
```

### Task 7: Reusable Production Case Publisher Skill

**Files:**
- Create: `.agents/skills/production-case-publisher/SKILL.md`
- Create: `.agents/skills/production-case-publisher/evals/evals.json`
- Modify: `scripts/import-ecommerce-gallery-case.mjs`
- Test: `test/ecommerce-gallery-cover-selection.test.mjs`
- Create: `test/production-case-importer.test.mjs`

**Interfaces:**
- Produces: CLI support for `--manifest .tmp/production-ecommerce-showcase/earbuds-suite-v3.json` with validated exact prompts, role-mapped sources, and deterministic cover selection.
- Produces: a project skill that invokes existing scripts rather than duplicating generation/import code.
- Consumes: manifest contract from Task 1.

- [ ] **Step 1: Write failing importer tests**

```js
test('suite manifest selects mosaic and preserves prompts', async () => {
  const result = buildImportedCase({
    ...validManifest,
    cover: { strategy: 'auto', outputIds: [] },
    outputs: Array.from({ length: 5 }, (_, index) => ({
      id: `out-${index}`,
      role: 'detail',
      url: `/out-${index}.png`,
      prompt: `Exact prompt ${index}`,
    })),
  })
  assert.equal(result.cover.strategy, 'mosaic')
  assert.deepEqual(result.images.map((image) => image.prompt), [
    'Exact prompt 0', 'Exact prompt 1', 'Exact prompt 2', 'Exact prompt 3', 'Exact prompt 4',
  ])
})

test('small case uses a single cover', () => {
  assert.equal(resolveCoverStrategy({ strategy: 'auto' }, 2), 'single')
})
```

- [ ] **Step 2: Run importer tests and confirm failure**

Run: `node --test test/ecommerce-gallery-cover-selection.test.mjs test/production-case-importer.test.mjs`

Expected: FAIL because manifest input and exact prompt preservation are unsupported.

- [ ] **Step 3: Implement manifest import and write the skill**

The importer reads JSON with `fs.readFile`, validates every new output prompt, maps outputs directly to catalog images, resolves `auto` to `mosaic` at four or more outputs and `single` below four, and retains explicit `mosaic`/`single`. It keeps the existing Sharp cover compositor.

The skill must instruct the agent to: inspect production status first, use stable request keys, resume timed-out tasks, validate dimensions and nonblank pixels, create the manifest with exact prompts and source roles, invoke the importer, run the focused tests, visually inspect the case, and verify remix hydration. Include three eval prompts covering a five-image suite, a two-image case, and a timed-out production task that must resume without duplication.

- [ ] **Step 4: Run importer tests and skill structural validation**

Run: `node --test test/ecommerce-gallery-cover-selection.test.mjs test/production-case-importer.test.mjs`

Run: `node C:\Users\SHEJI\.codex\skills\.system\skill-creator\scripts\quick_validate.js .agents/skills/production-case-publisher`

Expected: all tests PASS and skill validation exits zero.

- [ ] **Step 5: Commit publisher tooling**

```powershell
git add -- .agents/skills/production-case-publisher/SKILL.md .agents/skills/production-case-publisher/evals/evals.json scripts/import-ecommerce-gallery-case.mjs test/ecommerce-gallery-cover-selection.test.mjs test/production-case-importer.test.mjs
git commit -m "feat: add production case publisher skill"
```

### Task 8: Integrated Verification and Production Deployment

**Files:**
- Modify only if a scoped defect is found: files introduced or listed in Tasks 1-7.
- Do not modify: `src/pages/EcCanvas/**`, AI video files, `RTK.md`, `.superpowers/sdd/progress.md`, or unrelated server task records.

**Interfaces:**
- Consumes: all prior task deliverables.
- Produces: verified local and production behavior at `https://shuimg.cn`.

- [ ] **Step 1: Run the complete relevant automated suite**

Run:

```powershell
node --test test/production-case-manifest.test.mjs test/production-case-catalog.test.mjs test/ecommerce-gallery-model.test.mjs test/case-image-preloader.test.mjs test/gallery-remix-model.test.mjs test/production-ecommerce-showcase.test.mjs test/home-showcase-composites.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/image-view-policy.test.mjs test/ecommerce-gallery-cover-selection.test.mjs test/production-case-importer.test.mjs
npm run build
```

Expected: zero failed tests and a successful production build.

- [ ] **Step 2: Run local desktop and mobile visual acceptance**

Start the existing Vite server or run `npm run dev -- --host 127.0.0.1 --port 4174`. Capture desktop 2560x1440 and mobile 390x844 screenshots. Verify the 4:3 product result fills its visualization area, model face and earbud are visible in the selector, each try-on banner has one coherent workflow, all meaningful content is uncropped, modal prompts differ per slide, late slides are already loaded, and remix restores prompt plus materials.

- [ ] **Step 3: Check pixel and source provenance**

Use Sharp metadata and raw pixel statistics to confirm all four new/updated raster assets are nonblank and have the required ratios. Confirm every product-suite gallery image has a nonempty exact prompt, and every declared source role resolves to an existing URL.

- [ ] **Step 4: Deploy through the isolated production script**

Run: `powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1 -CanarySeconds 600 -OwnerEmail 867550189@qq.com`

Expected: build, upload, health checks, 600-second canary, and release promotion complete successfully. Never print `SHUBAO_CANARY_SESSION_TOKEN`.

- [ ] **Step 5: Repeat production smoke and visual acceptance**

Open `https://shuimg.cn`, repeat desktop/mobile screenshots, open the pearl-white earbud case, traverse every slide, verify exact prompts, and activate `Do the same`. Confirm the console has no new errors and all image requests return successful responses.

- [ ] **Step 6: Commit any verification-only scoped correction**

If verification required a correction, run the affected focused test first, apply only the minimal scoped fix, rerun the full relevant suite, and commit explicit files with:

```powershell
git add -- src/pages/Home/productionCaseManifest.js src/pages/Home/productionCaseCatalog.js src/pages/Home/productionCasePromptLibrary.js src/pages/Home/galleryModel.js src/pages/Home/galleryRemixModel.js src/pages/Home/GallerySection.jsx src/pages/Home/ec/EcommerceWorkbench.jsx src/pages/Home/Home.css src/gallery/ecommerceGalleryModel.js src/gallery/caseImagePreloader.js src/NoteModal.jsx scripts/generate-production-ecommerce-showcase.mjs scripts/build-home-showcase-composites.mjs scripts/import-ecommerce-gallery-case.mjs test/production-case-manifest.test.mjs test/production-case-catalog.test.mjs test/ecommerce-gallery-model.test.mjs test/case-image-preloader.test.mjs test/gallery-remix-model.test.mjs test/production-ecommerce-showcase.test.mjs test/home-showcase-composites.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/image-view-policy.test.mjs test/ecommerce-gallery-cover-selection.test.mjs test/production-case-importer.test.mjs
git commit -m "fix: resolve ecommerce showcase acceptance issue"
```

If no correction was required, do not create an empty commit.
