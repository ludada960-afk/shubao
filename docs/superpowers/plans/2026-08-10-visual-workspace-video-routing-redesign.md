# Visual Workspace and Video Routing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace competitor-derived entry artwork, rebuild the navigation and two creation workbenches, and ship a server-authoritative multi-product video system with durable billing, recovery, and a closed MiniMax H3 release gate.

**Architecture:** The frontend consumes one public video-product contract and never owns raw provider prices or route names. The server maps product IDs to billing SKUs, capability rules, credentials, provider adapters, queue limits, and circuit-breaker state; each accepted job persists the catalog snapshot used for its quote. Original raster assets are generated for Shubao, normalized to transparent PNG, hashed in a manifest, and verified by tests before any competitor-derived file is removed.

**Tech Stack:** React 18, Vite 6, Node.js ESM, Express 4, better-sqlite3, Sharp, Lucide React, Node test runner, Chrome CDP/browser QA, PowerShell production deployment.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability` on `codex/ecommerce-stability`.
- Use the approved Git prefix from `RTK.md`; stage explicit paths only.
- Do not modify or stage the user-owned `package.json`, deleted extension-task JSON files, `.tmp/`, or diagnostic script.
- Keep four top-level creation domains; posters remain a Free Visual Creation recipe.
- Remove every production reference to `reference-card-*.png` and delete those four copied files.
- Keep navigation item geometry fixed; animate icon internals and render labels as independent tooltips.
- Keep the desktop video command bar on one row; remove the duplicate upload plus button.
- Expose `seedance_fast` and `seedance_standard`; keep `minimax_h3_2k` absent from public capabilities until its release gate passes.
- Price from server SKUs and enforce at least 70% contribution margin against the least favorable point package with a 3% payment-cost allowance.
- Settle video points only after a valid video is downloaded and durably persisted; release the full hold on terminal failure.
- Never automatically resubmit a job to another provider after an upstream task ID exists.
- Never write API keys to source, docs, tests, logs, frontend bundles, or Git.
- Use only `scripts/deploy-production.ps1` for production and do not claim release before all rollback, Canary, health, audit, and lock-release gates pass.

---

### Task 1: Original Entry and Recipe Artwork

**Files:**
- Modify: `test/home-mode-cards.test.mjs`
- Modify: `test/visual-creation-model.test.mjs`
- Modify: `src/pages/Home/index.jsx`
- Modify: `src/pages/Home/Home.css`
- Modify: `src/pages/Home/visualCreationModel.js`
- Create: `scripts/normalize-visual-entry-assets.mjs`
- Create: `public/images/home/entry-ecommerce.png`
- Create: `public/images/home/entry-video.png`
- Create: `public/images/home/entry-xhs.png`
- Create: `public/images/home/entry-visual.png`
- Create: `public/images/visual-recipes/free.png`
- Create: `public/images/visual-recipes/poster.png`
- Create: `public/images/visual-recipes/social-cover.png`
- Create: `public/images/visual-recipes/brand-kv.png`
- Create: `public/images/home/entry-assets.manifest.json`
- Delete: `public/images/home/reference-card-product.png`
- Delete: `public/images/home/reference-card-fashion.png`
- Delete: `public/images/home/reference-card-video.png`
- Delete: `public/images/home/reference-card-remix.png`

**Interfaces:**
- Consumes: `modeOptions` in `src/pages/Home/index.jsx` and `VISUAL_CREATION_SKILLS` in `visualCreationModel.js`.
- Produces: eight original transparent PNG assets plus a manifest with `path`, `sha256`, `width`, `height`, `alpha`, and `promptSummary`.

- [ ] **Step 1: Write failing originality and asset-integrity tests**

Replace copied path expectations and add manifest checks:

```js
const entryAssets = [
  '../public/images/home/entry-ecommerce.png',
  '../public/images/home/entry-video.png',
  '../public/images/home/entry-xhs.png',
  '../public/images/home/entry-visual.png',
];

assert.doesNotMatch(source, /reference-card-/);
assert.match(source, /entry-ecommerce\.png/);
assert.match(source, /entry-video\.png/);
assert.match(source, /entry-xhs\.png/);
assert.match(source, /entry-visual\.png/);

for (const asset of entryAssets) {
  const metadata = await sharp(readFileSync(new URL(asset, import.meta.url))).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.hasAlpha, true);
  assert.ok(metadata.width >= 320);
  assert.ok(metadata.height >= 240);
}
```

Update the visual recipe contract to require one dedicated original diptych per recipe:

```js
for (const skill of VISUAL_CREATION_SKILLS) {
  assert.match(skill.preview, /^\/images\/visual-recipes\/[a-z-]+\.png$/);
}
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
node --test test/home-mode-cards.test.mjs test/visual-creation-model.test.mjs
```

Expected: failure because the new paths and manifest do not exist and source still references `reference-card-*`.

- [ ] **Step 3: Generate original artwork with the image-generation tool**

Generate each asset without reference-image input. Use a flat `#00ff66` chroma background when transparency is not returned. The four entry prompts share this exact art direction:

```text
Original premium AI-creation product UI artwork for Shubao, isolated three-layer
rounded editorial cards fanned in depth, front card fully visible, clean modern
commercial photography, warm neutral paper frame, restrained studio shadow, no logo,
no readable text, no watermark, no copied brand identity, centered with generous
margin on a flat #00ff66 background.
```

Append one domain subject per asset:

```text
Ecommerce: a sculptural coral-red skincare bottle shown as hero packshot, lifestyle
use, and macro material detail.

Video: three spread storyboard frames, opening bottle close-up, hand picking it up,
final sunlit vanity scene, a small generic play symbol only, no centered presenter.

Xiaohongshu: flower-and-sparkling-drink lifestyle story, editorial cover, detail crop,
and social composition with blank controlled title space.

Free creation: three visibly different outputs, typographic abstract poster without
legible words, editorial photo collage, and vivid brand key visual.
```

Generate one `free`, `poster`, `social-cover`, and `brand-kv` diptych using the same no-logo/no-readable-text rules. Each diptych contains two clearly separate final-output frames, not a before/after copy of any supplied image.

- [ ] **Step 4: Normalize transparency and record provenance**

Create `scripts/normalize-visual-entry-assets.mjs`. It reads a generated source through
Sharp as raw RGBA, flood-fills from border pixels whose green channel is at least 40
points above red and blue, sets only that connected region to alpha zero, trims the
result, and places it with `contain` on a transparent canvas. Entry targets are
`420 x 360`; recipe targets are `760 x 300`. The script refuses an output whose alpha
minimum is not zero or whose non-transparent bounding box touches the target edge.
Inspect every normalized output with `view_image` before committing.

Write `entry-assets.manifest.json` from the same script. Compute, never hand-type, every
hash:

```js
const manifestItem = {
  path: '/images/home/entry-video.png',
  sha256: createHash('sha256').update(readFileSync(targetPath)).digest('hex'),
  width: metadata.width,
  height: metadata.height,
  alpha: metadata.hasAlpha === true,
  promptSummary: 'Original three-frame product storyboard',
};
```

- [ ] **Step 5: Wire assets and exact home-card motion**

Use the four `entry-*.png` paths in `modeOptions`, add the four recipe `preview` paths, and keep card geometry stable. The desktop card transition is:

```css
.homepage-mode-card {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}

.homepage-mode-card:hover,
.homepage-mode-card:focus-visible {
  transform: translateY(-16px) rotate(0deg);
}
```

Remove hover image scaling, hover shadow changes, and hover z-index changes. Keep selection treatment independent of `transform`.

- [ ] **Step 6: Delete copied files and prove no source reference remains**

Run:

```powershell
rg -n "reference-card-" src test public
```

Expected: no matches after the four old PNG files are removed.

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
node --test test/home-mode-cards.test.mjs test/visual-creation-model.test.mjs
git diff --check
```

Expected: all focused tests pass and no whitespace errors.

Commit explicit Task 1 paths with message:

```text
feat: replace copied entry artwork with original assets
```

---

### Task 2: Stable Navigation with Internal Icon Motion

**Files:**
- Modify: `test/app-shell-contract.test.mjs`
- Modify: `test/mobile-layout.test.mjs`
- Modify: `src/App.jsx`
- Modify: `src/styles/app-shell.css`

**Interfaces:**
- Consumes: existing SideNav actions and page-state logic.
- Produces: fixed-size `app-side-nav-item` buttons, `data-nav-icon` animation hooks, and independent tooltip labels.

- [ ] **Step 1: Write the failing shell contract**

```js
assert.doesNotMatch(shellCss, /\.app-side-nav-item:hover[\s\S]*?width:\s*118px/);
assert.match(app, /data-nav-icon=\{item\.motion\}/);
assert.match(app, /className="app-side-nav-tooltip"/);
assert.match(shellCss, /420ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
assert.match(shellCss, /\.app-side-nav-item\[data-nav-icon="sparkles"\]:hover[\s\S]*nth-child/);
assert.match(shellCss, /transform-box:\s*fill-box/);
assert.match(shellCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*app-side-nav-icon/);
```

- [ ] **Step 2: Run the shell tests and verify the old expansion fails**

Run:

```powershell
node --test test/app-shell-contract.test.mjs test/mobile-layout.test.mjs
```

Expected: failure on the old `118px` hover width and missing motion hooks.

- [ ] **Step 3: Replace monolithic Material icons with Lucide components**

Use:

```jsx
import { Clapperboard, FolderOpen, PanelsTopLeft, Sparkles } from 'lucide-react';

const items = [
  { icon: <Sparkles />, motion: 'sparkles', label: '生图', ...createAction },
  { icon: <PanelsTopLeft />, motion: 'canvas', label: '画布', ...canvasAction },
  { icon: <Clapperboard />, motion: 'video', label: '视频创作', ...videoAction },
  { icon: <FolderOpen />, motion: 'folder', label: '作品', ...worksAction },
];
```

Render tooltip text outside the icon geometry:

```jsx
<button data-nav-icon={item.motion} className={classes}>
  <span className="app-side-nav-icon" aria-hidden="true">{item.icon}</span>
  <span className="app-side-nav-tooltip" role="tooltip">{item.label}</span>
</button>
```

- [ ] **Step 4: Implement stable geometry and staggered child motion**

Keep every item `44 x 44px`. Animate Lucide child paths/rectangles with
`transform-box:fill-box`, `transform-origin:center`, the approved 420ms spring curve,
and per-child delays of `0ms`, `55ms`, `80ms`, and `110ms`. Tooltips use absolute
position, `opacity`, and `translateX`; mobile suppresses them.

- [ ] **Step 5: Run shell tests, keyboard checks, and commit**

Run:

```powershell
node --test test/app-shell-contract.test.mjs test/mobile-layout.test.mjs
git diff --check
```

Expected: tests pass; Tab focus shows tooltip and current-page state without changing rail width.

Commit explicit Task 2 paths with message:

```text
feat: add stable animated side navigation
```

---

### Task 3: Server-Authoritative Video Products and Pricing

**Files:**
- Create: `server/videoCatalog.mjs`
- Create: `test/video-catalog.test.mjs`
- Modify: `server/billing/catalog.mjs`
- Modify: `server/billing/routes.mjs`
- Modify: `test/billing-catalog.test.mjs`
- Modify: `test/billing-routes.test.mjs`
- Modify: `src/pages/VideoStudio/videoStudioModel.js`
- Modify: `test/video-studio-model.test.mjs`

**Interfaces:**
- Produces: `VIDEO_CATALOG_VERSION`, `DEFAULT_VIDEO_PRODUCT_ID`, `getVideoProduct`, `videoFeatureSku`, `publicVideoProducts`, `validateVideoProductInput`, and frontend `quoteForVideoProduct`.
- Consumes: `quoteFeature`, product-package prices, normalized mode, duration, references, and audio choice.

- [ ] **Step 1: Write failing catalog and pricing tests**

The catalog test asserts:

```js
assert.equal(DEFAULT_VIDEO_PRODUCT_ID, 'seedance_standard');
assert.deepEqual(Object.keys(VIDEO_PRODUCTS), [
  'seedance_fast',
  'seedance_standard',
  'minimax_h3_2k',
]);
assert.equal(getVideoProduct('minimax_h3_2k').public, false);
assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 8 }), 'video_seedance_fast_short');
assert.equal(videoFeatureSku({ productId: 'minimax_h3_2k', duration: 5 }), 'video_minimax_h3_2k_short');
assert.throws(
  () => validateVideoProductInput({ productId: 'minimax_h3_2k', duration: 4, mode: 'script' }),
  /5 到 15 秒/,
);
```

Billing tests assert exact units and provider costs for all six SKUs and loop through them with the least favorable package price to prove the 70% margin gate.

- [ ] **Step 2: Run tests and verify missing catalog failures**

Run:

```powershell
node --test test/video-catalog.test.mjs test/billing-catalog.test.mjs test/billing-routes.test.mjs test/video-studio-model.test.mjs
```

Expected: failure because `server/videoCatalog.mjs` and the six SKUs do not exist.

- [ ] **Step 3: Implement the frozen product registry**

Use this public shape:

```js
export const VIDEO_PRODUCTS = Object.freeze({
  seedance_fast: Object.freeze({
    id: 'seedance_fast',
    label: '快速成片',
    routeId: 'sd5-seedance-2.0-fast',
    credential: 'seedance',
    public: true,
    default: false,
    durations: Object.freeze({ min: 4, max: 15 }),
    resolutions: Object.freeze(['720p']),
    modes: Object.freeze(['script', 'reference', 'frame', 'remake']),
    generatedAudio: true,
    limits: Object.freeze({ images: 9, videos: 3, audios: 3, total: 12 }),
    concurrency: 2,
    pollIntervalMs: 10000,
  }),
  seedance_standard: Object.freeze({
    id: 'seedance_standard',
    label: '稳定成片',
    routeId: 'sd5-seedance-2.0',
    credential: 'seedance',
    public: true,
    default: true,
    durations: Object.freeze({ min: 4, max: 15 }),
    resolutions: Object.freeze(['720p']),
    modes: Object.freeze(['script', 'reference', 'frame', 'remake']),
    generatedAudio: true,
    limits: Object.freeze({ images: 9, videos: 3, audios: 3, total: 12 }),
    concurrency: 2,
    pollIntervalMs: 10000,
  }),
  minimax_h3_2k: Object.freeze({
    id: 'minimax_h3_2k',
    label: '2K 精制',
    routeId: 'minimax-h3-2k',
    credential: 'minimax',
    public: false,
    default: false,
    durations: Object.freeze({ min: 5, max: 15 }),
    resolutions: Object.freeze(['2k']),
    modes: Object.freeze(['script', 'reference', 'frame', 'remake']),
    generatedAudio: true,
    frameAudio: false,
    limits: Object.freeze({ images: 9, videos: 3, audios: 3, total: 12 }),
    concurrency: 1,
    pollIntervalMs: 10000,
  }),
});
```

- [ ] **Step 4: Replace legacy video SKUs and enforce margin**

Add exactly:

```js
video_seedance_fast_short: { units: 40000, providerCostCny: 2.73 },
video_seedance_fast_long: { units: 46000, providerCostCny: 2.73 },
video_seedance_standard_short: { units: 62000, providerCostCny: 4.355 },
video_seedance_standard_long: { units: 72000, providerCostCny: 4.355 },
video_minimax_h3_2k_short: { units: 68000, providerCostCny: 3.25, public: false },
video_minimax_h3_2k_long: { units: 78000, providerCostCny: 3.25, public: false },
```

Make the public billing route filter `feature.public !== false` while keeping hidden SKUs internally quotable for owner-only canaries.

- [ ] **Step 5: Add frontend product quote helpers without raw route names**

`quoteForVideoProduct(product, duration)` returns the server-provided `short` or `long` quote object and throws if duration is outside the product range. No point values are hardcoded in React components.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
node --test test/video-catalog.test.mjs test/billing-catalog.test.mjs test/billing-routes.test.mjs test/video-studio-model.test.mjs
git diff --check
```

Commit explicit Task 3 paths with message:

```text
feat: add curated video product catalog
```

---

### Task 4: Provider Registry, Durable Routing, Health Gate, and Runtime Secrets

**Files:**
- Create: `server/videoProviders.mjs`
- Create: `server/videoQueue.mjs`
- Create: `test/video-providers.test.mjs`
- Create: `test/video-queue.test.mjs`
- Modify: `server/videoGeneration.mjs`
- Modify: `server/index.mjs`
- Modify: `test/video-generation.test.mjs`
- Modify: `scripts/configure-runtime-gateways.cjs`
- Modify: `scripts/verify-runtime-config.cjs`
- Modify: `scripts/deploy-production.ps1`
- Create: `scripts/verify-production-video.mjs`
- Modify: `test/runtime-config-updater.test.mjs`
- Modify: `test/runtime-config-verifier.test.mjs`
- Modify: `test/deploy-script.test.mjs`

**Interfaces:**
- Consumes: `VIDEO_PRODUCTS`, server billing quotes, current wallet service, durable asset store, and runtime secrets.
- Produces: `createVideoProviderRegistry`, `buildProviderPayload`, `createOwnerFairVideoQueue`, persisted product/route/catalog snapshots, product health in capabilities, and a production video canary.

- [ ] **Step 1: Write failing provider, queue, migration, and secret tests**

Provider tests cover route-specific payloads and status normalization. Queue tests cover two Seedance slots, one H3 slot, owner round-robin order, and duplicate enqueue suppression. Generation tests assert the persisted job includes:

```js
assert.equal(job.productId, 'seedance_standard');
assert.equal(job.providerRoute, 'sd5-seedance-2.0');
assert.equal(job.catalogVersion, VIDEO_CATALOG_VERSION);
assert.equal(job.providerCostCny, 4.355);
```

Add a test where submission returns an upstream ID and every later poll fails retryably; assert `submit` is called once. Add a separate pre-acceptance 503 test that may select only an equivalent configured route and never changes the locked SKU.

Runtime tests require `MINIMAX_VIDEO_API_KEY` to be accepted as an optional private secret, reject it when malformed and `MINIMAX_VIDEO_PUBLIC_ENABLED=true`, and prove no secret name is logged with its value.

- [ ] **Step 2: Run focused tests and verify failures**

Run:

```powershell
node --test test/video-providers.test.mjs test/video-queue.test.mjs test/video-generation.test.mjs test/runtime-config-updater.test.mjs test/runtime-config-verifier.test.mjs test/deploy-script.test.mjs
```

Expected: failure on missing modules, columns, runtime key support, and canary wiring.

- [ ] **Step 3: Build provider adapters and owner-fair queue**

The provider registry accepts redacted configuration only:

```js
createVideoProviderRegistry({
  baseUrl,
  credentials: { seedance: seedanceKey, minimax: minimaxKey },
  fetchImpl,
  now,
});
```

Every adapter implements:

```ts
{
  enabled: boolean;
  routeId: string;
  submit(payload, idempotencyKey): Promise<{ id: string; progress: number }>;
  get(taskId): Promise<{ status: string; progress: number; downloadUrl?: string }>;
  download(taskId, normalizedStatus): Promise<Response>;
}
```

The queue stores owner buckets per route and rotates owners after each dequeue. It enforces the product concurrency value without changing per-user maximum two.

- [ ] **Step 4: Migrate existing jobs without rewriting history**

After the existing `CREATE TABLE`, inspect `PRAGMA table_info(video_jobs)` and add missing columns with these defaults:

```sql
product_id TEXT NOT NULL DEFAULT 'seedance_standard'
provider_route TEXT NOT NULL DEFAULT 'sd5-seedance-2.0'
catalog_version TEXT NOT NULL DEFAULT 'legacy-seedance-v1'
provider_cost_cny REAL NOT NULL DEFAULT 4.355
failure_class TEXT NOT NULL DEFAULT ''
```

New jobs persist current values. Settlement uses the persisted provider cost snapshot, not the current catalog value.

- [ ] **Step 5: Enforce capability validation and circuit breaking**

Validate product, mode, duration, resolution, references, and audio before quote verification and hold creation. Derive recent provider failures from terminal job rows. Open the circuit after five samples when either three failures are consecutive or at least half of the latest 20 terminal jobs are provider failures; cool down for 15 minutes and admit one half-open probe.

Capabilities omit hidden products and products with missing credentials or open circuits. Accepted jobs continue polling even when their product circuit opens.

- [ ] **Step 6: Extend runtime secret handling safely**

Keep `VIDEO_API_KEY` as the Seedance credential for backward-compatible production migration and add optional `MINIMAX_VIDEO_API_KEY`. Add fixed runtime flag:

```text
MINIMAX_VIDEO_PUBLIC_ENABLED=false
```

The deploy script reads optional user environment variable `SHUBAO_MINIMAX_VIDEO_API_KEY`, sends it only through the existing JSON stdin channel, backs up both runtime env files, and restores them on failure. It never places a secret in command arguments or output.

- [ ] **Step 7: Add a billed production video verifier**

`verify-production-video.mjs` uses `SHUBAO_CANARY_SESSION_TOKEN`, fetches public capabilities, chooses `seedance_standard`, creates one short text-to-video quote and job with a unique idempotency key, polls at 10 seconds, verifies a non-empty video response from the durable result URL, and confirms the job billing state is terminal. It prints only product ID, task ID, status, and content length.

Wire it into deployment after billing verification and before the 600-second observation window. H3 is not part of routine deployment while hidden.

- [ ] **Step 8: Run focused tests and commit**

Run:

```powershell
node --test test/video-providers.test.mjs test/video-queue.test.mjs test/video-generation.test.mjs test/runtime-config-updater.test.mjs test/runtime-config-verifier.test.mjs test/deploy-script.test.mjs
git diff --check
```

Commit explicit Task 4 paths with message:

```text
feat: add durable multi-route video generation
```

---

### Task 5: Video Workbench Hierarchy and Product Selection

**Files:**
- Modify: `test/video-studio-contract.test.mjs`
- Modify: `test/video-studio-model.test.mjs`
- Modify: `test/canvas-studio-contract.test.mjs`
- Modify: `src/pages/VideoStudio/index.jsx`
- Modify: `src/pages/VideoStudio/VideoStudio.css`
- Modify: `src/pages/VideoStudio/videoStudioModel.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/canvasStudioModel.js`

**Interfaces:**
- Consumes: public capability products and quotes from Tasks 3-4.
- Produces: one connected mode selector, mode-specific material lanes, no duplicate upload action, one-row desktop command bar, and product-aware Home and Canvas video requests.

- [ ] **Step 1: Write failing UI contracts**

Assert the page contains `video-mode-indicator`, three `video-material-action` controls for Smart mode, product options sourced from `capabilities.products`, and `productId` in job payload. Assert it does not contain the prompt-adjacent upload button:

```js
assert.doesNotMatch(page, /className="video-icon-tool"[^>]*aria-label="添加素材"/);
assert.doesNotMatch(page, /<Plus size=\{18\}/);
assert.match(page, /video-material-action is-image/);
assert.match(page, /video-material-action is-video/);
assert.match(page, /video-material-action is-audio/);
assert.match(page, /productId:\s*selectedProductId/);
assert.match(styles, /\.video-toolbar\s*\{[^}]*grid-template-columns:/);
assert.match(styles, /@media \(max-width:\s*1023px\)[\s\S]*video-compact-settings/);
```

Canvas tests require `productId:'seedance_standard'` on new composer nodes and no legacy `32/40/48/58` point literals.

- [ ] **Step 2: Run focused UI tests and verify failures**

Run:

```powershell
node --test test/video-studio-contract.test.mjs test/video-studio-model.test.mjs test/canvas-studio-contract.test.mjs
```

Expected: failure on the legacy flat tabs, duplicate plus, hardcoded model, and hardcoded Canvas points.

- [ ] **Step 3: Rebuild the connected mode selector**

Add mode icons to `VIDEO_CREATION_MODES` and render one sliding indicator positioned by `data-mode`. Keep all segments stable in height and width. Selected copy shows the exact material contract; inactive hints remain one line with ellipsis only at compact desktop widths.

- [ ] **Step 4: Make material types primary**

Smart mode renders separate image, video, and audio labels bound to type-specific hidden inputs. Viral Remake renders a primary video lane, replacement-image lane, and optional audio lane. First/Last Frame keeps two directional frame slots. Existing previews, removal, total limits, and mention insertion remain functional.

Delete `openMaterialPicker`, the quick-tool upload button, and unused `Plus` import. Hide the mention control until `mentionedAssets.length > 0`.

- [ ] **Step 5: Bind model, capabilities, quote, and compatibility state**

Initialize `selectedProductId` from the capability default. Resolve the selected product and quote from server data. When a product cannot support the current duration/mode/audio combination, disable generation and show a local compatibility message; never silently alter duration or audio.

Submit:

```js
createVideoJob({
  productId: selectedProductId,
  mode: resolveVideoApiMode(mode, files),
  prompt,
  duration,
  aspectRatio: ratio,
  resolution: selectedProduct.resolutions[0],
  generateAudio: sound,
  billingQuoteId: quote.quoteId,
  references,
}, idempotencyKey);
```

- [ ] **Step 6: Implement the one-row desktop command bar**

Use explicit tracks for product, shot, sound, settings, flexible spacer, cost, and submit. At `1023px` and below, replace the three secondary triggers with one `video-compact-settings` trigger. At `640px` and below, use an intentional two-section mobile footer with a full-width generate button above the fixed bottom navigation safe area.

- [ ] **Step 7: Update Canvas to the same product contract**

New Canvas video composers default to `productId:'seedance_standard'`. The model select reads capability products when available or the shared safe default, quotes through `quoteForVideoProduct`, submits `productId`, and displays server points. Remove `videoSku` and local point literals from Canvas.

- [ ] **Step 8: Run focused tests and commit**

Run:

```powershell
node --test test/video-studio-contract.test.mjs test/video-studio-model.test.mjs test/canvas-studio-contract.test.mjs test/video-generation.test.mjs
git diff --check
```

Commit explicit Task 5 paths with message:

```text
feat: rebuild the video creation workbench
```

---

### Task 6: Responsive Free Visual Creation Workbench

**Files:**
- Modify: `test/visual-creation-ui.test.mjs`
- Modify: `test/visual-creation-model.test.mjs`
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/VisualCreationMode.css`
- Modify: `src/pages/Home/visualCreationModel.js`

**Interfaces:**
- Consumes: dedicated recipe diptychs from Task 1 and existing billed image-generation workflow.
- Produces: inspectable recipe selectors, bounded responsive layout, and one-row desktop parameters without changing generation semantics.

- [ ] **Step 1: Write failing responsive and hierarchy tests**

```js
assert.match(styles, /@container visual-workbench \(min-width:\s*1180px\)[\s\S]*repeat\(4/);
assert.match(styles, /@container visual-workbench \(min-width:\s*641px\)[\s\S]*repeat\(2/);
assert.match(styles, /@container visual-workbench \(max-width:\s*640px\)[\s\S]*grid-template-columns:\s*1fr/);
assert.match(styles, /\.visual-creation[^{]*\{[^}]*container-type:\s*inline-size/);
assert.match(styles, /\.visual-skill-option\s*\{[^}]*min-width:\s*0/);
assert.match(source, /保留/);
assert.match(source, /变化/);
assert.match(source, /适合/);
```

Also assert the parameter bar does not set `flex-wrap:wrap` above the mobile breakpoint.

- [ ] **Step 2: Run focused visual tests and verify failure**

Run:

```powershell
node --test test/visual-creation-ui.test.mjs test/visual-creation-model.test.mjs
```

Expected: failure on missing container rules, old preview arrays, and wrapping desktop bar.

- [ ] **Step 3: Render recipe choices as inspectable transformations**

Each recipe uses one original diptych, title, and three labeled facts:

```jsx
<span className="visual-skill-fact"><b>保留</b>{skill.preserves}</span>
<span className="visual-skill-fact"><b>变化</b>{skill.outcome}</span>
<span className="visual-skill-fact"><b>适合</b>{skill.bestFor}</span>
```

Use `aria-pressed`, a fixed check position, explicit preview aspect ratio, and no dimension change on selection.

- [ ] **Step 4: Replace viewport assumptions with workbench container rules**

Set `container-type:inline-size` on `.visual-creation`. Use four columns at 1180px, two from 641-1179px, and one at 640px. Apply `min-width:0`, `overflow-wrap:anywhere`, and explicit aspect ratios to all grid descendants. Remove CSS that allows cards or selects to grow past the workbench.

- [ ] **Step 5: Keep desktop parameters in one row**

Use CSS grid tracks for model, ratio, clarity, count, flexible cost, and submit. At 640px, switch to two compact parameter columns, full-width count, and full-width submit. Preserve all existing quote, retry, result, download, save, and Canvas handoff behavior.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
node --test test/visual-creation-ui.test.mjs test/visual-creation-model.test.mjs test/visual-creation-skills.test.mjs
git diff --check
```

Commit explicit Task 6 paths with message:

```text
feat: refine the free visual creation workbench
```

---

### Task 7: Full QA, Production Release, and Durable Handoff

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md`
- Modify: `docs/superpowers/specs/2026-08-10-visual-workspace-video-routing-redesign.md` only if implementation evidence changes an acceptance statement
- Create: browser screenshots under
  `C:/Users/SHEJI/AppData/Local/Temp/shubao-visual-workspace-qa-20260810/`

**Interfaces:**
- Consumes: all prior task commits.
- Produces: test/build evidence, desktop/mobile visual evidence, production deployment evidence, and a cross-thread recovery snapshot.

- [ ] **Step 1: Review the complete branch diff**

Run the approved status/log commands, inspect each task commit, run `git diff --check`, and confirm user-owned dirty files remain unstaged and unchanged.

- [ ] **Step 2: Run focused regression**

Run:

```powershell
node --test test/home-mode-cards.test.mjs test/app-shell-contract.test.mjs test/mobile-layout.test.mjs test/video-catalog.test.mjs test/video-providers.test.mjs test/video-queue.test.mjs test/video-generation.test.mjs test/video-studio-model.test.mjs test/video-studio-contract.test.mjs test/visual-creation-model.test.mjs test/visual-creation-ui.test.mjs test/visual-creation-skills.test.mjs test/runtime-config-updater.test.mjs test/runtime-config-verifier.test.mjs test/deploy-script.test.mjs
```

Expected: every focused test passes.

- [ ] **Step 3: Run full repository gates**

Run:

```powershell
npm test
npm run build
npm run check
npm run collab:check
```

Expected: zero test failures, successful Vite production build, successful build verification, and collaboration status `READY`.

- [ ] **Step 4: Start the local application and perform browser QA**

Start the server on an unused local port and test authenticated and unauthenticated states at `390x844`, `768x1024`, `1024x768`, `1440x900`, `1600x1000`, and `2048x970`.

Capture and inspect:

- four home cards at rest, hover, keyboard focus, and each active domain;
- side navigation rest/hover/focus and internal SVG motion;
- all three video modes empty, uploaded, menu-open, validation-error, quote-ready, and compact states;
- model menu with only Fast and Stable products;
- Free Visual Creation at four-, two-, and one-column widths;
- mobile fixed navigation and command-area safe spacing.

Use DOM bounds checks to assert no horizontal overflow and no text overlap. Use computed styles to assert nav width stays fixed and desktop video controls share one row.

- [ ] **Step 5: Exercise local API and billing recovery**

Run contract tests for quote tampering, duplicate idempotency keys, per-user concurrency, provider 429/5xx before acceptance, retryable polling after acceptance, terminal release, completed settlement, restart recovery, hidden H3, and circuit-open capabilities.

- [ ] **Step 6: Deploy through the guarded production script**

Run only:

```powershell
scripts/deploy-production.ps1
```

The deployment must complete runtime verification, backup, release lock, production build payload installation, billing verification, one real Stable Video generation, 600-second Canary, public audit, PM2 stability check, and lock release. Any failed gate must trigger the script's rollback and remain reported as not deployed.

- [ ] **Step 7: Verify production visually and functionally**

Open `https://shuimg.cn/` in a fresh browser context. Repeat desktop/mobile bounds checks, verify all eight original assets decode, confirm no `reference-card-*` request occurs, verify public capabilities omit H3, and inspect the durable video Canary URL.

- [ ] **Step 8: Record release state and commit evidence**

Update progress and RTK with exact release commit, test totals, module count, production PID, Canary task ID, audit result, asset hashes, H3 hidden status, unrelated dirty paths, and next safe boundary.

Commit explicit documentation paths with message:

```text
docs: record visual workspace production release
```

## Plan Self-Review

- Spec coverage: every section in the approved design maps to Tasks 1-7.
- Placeholder scan: the plan contains no deferred implementation placeholder; H3 is deliberately implemented behind the approved closed release gate.
- Type consistency: `productId`, `providerRoute`, `catalogVersion`, `providerCostCny`, and the three public product IDs use the same names across server, frontend, tests, and persistence.
- Ownership check: no task modifies the user-owned dirty paths.
- Execution mode: inline execution is required by the current project ownership record; no implementation files are delegated.
