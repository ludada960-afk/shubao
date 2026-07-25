# Structured Ecommerce Generation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production ecommerce Contact Sheet and synchronous prompt path with Product Truth, Campaign Bible, dynamic Asset Plan, multipart image editing, async provider jobs, real quality gates, and targeted repair.

**Architecture:** Keep `/api/generate-ecommerce` compatible while moving orchestration into focused modules under `server/ecommerceEngine/`. The route creates a durable job, compiles per-asset requests, persists provider job IDs, downloads stable assets, evaluates quality, and settles billing per successful output.

**Tech Stack:** Node.js ESM, Express 4, better-sqlite3, Sharp, native fetch/FormData, Node test runner, GPT Image 2-compatible upstream APIs.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability`.
- Use the approved Git prefix from `F:/da/shubao` exactly.
- Preserve `/api/generate-ecommerce` and `/api/ecommerce/jobs/:id` compatibility.
- Default model is `gpt-image-2`; use `gpt-image-2-n` only for eligible 2–4 image same-style batches after a Campaign Bible is confirmed.
- Never automatically fall back to `gpt-image-2-auto`, `eco`, Gemini, or `native`.
- Default formal output is 2K; 4K is explicit and is not described as new factual detail.
- Dimensions must be multiples of 16, no edge over 3840, total pixels no more than 8,294,400, and ratio no more than 3:1.
- Upstream edits accept at most 10 images in this deployment.
- Product facts, SKU values, dimensions, certification, test reports, and comparison claims cannot be invented.
- System quality repairs are capped at two attempts and do not charge users again.
- Every provider result URL is downloaded into stable generated asset storage before completion.
- Never stage runtime databases, generated assets, uploads, caches, or `dist/`.

---

## File Structure

- Create `server/ecommerceEngine/modelCatalog.mjs`: provider models, legal sizes, routing policy.
- Create `server/ecommerceEngine/productTruth.mjs`: schema normalization and fact confidence rules.
- Create `server/ecommerceEngine/campaignBible.mjs`: selected direction compiler.
- Create `server/ecommerceEngine/platformPolicies.mjs`: versioned platform requirements.
- Create `server/ecommerceEngine/assetPlanner.mjs`: dynamic ecommerce deliverable planning.
- Create `server/ecommerceEngine/promptCompiler.mjs`: indexed multi-image request compiler.
- Create `server/ecommerceEngine/providerAdapter.mjs`: async generations/edits submit and poll.
- Create `server/ecommerceEngine/jobStore.mjs`: durable provider job and per-asset state.
- Create `server/ecommerceEngine/qualityGate.mjs`: deterministic and structured visual checks.
- Create `server/ecommerceEngine/repairPlanner.mjs`: failure-specific repair selection.
- Create `server/ecommerceEngine/orchestrator.mjs`: end-to-end job execution.
- Modify `server/ecommerceEngine/index.mjs`, `server/index.mjs`, `server/generatedAssets.mjs`, `server/imageInput.mjs`, and `server/generationJobs.mjs`.

### Task 1: Legal dimensions and cost-aware model routing

**Files:**
- Create: `server/ecommerceEngine/modelCatalog.mjs`
- Test: `test/ecommerce-model-routing.test.mjs`

**Interfaces:**
- Produces: `LEGAL_IMAGE_SIZES`, `validateGenerationSize`, `selectGenerationModel`, `buildModelRoute`.

- [ ] **Step 1: Write failing routing tests**

```js
test('uses gpt-image-2 and 2K for a standard formal asset', () => {
  assert.deepEqual(buildModelRoute({ resolution: '2K', assetCount: 1, batchEligible: false }), {
    model: 'gpt-image-2', size: '2048x2048', async: true, mode: 'edit',
  });
});

test('uses gpt-image-2-n only for confirmed same-style batches', () => {
  assert.equal(selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: false }), 'gpt-image-2-n');
  assert.equal(selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: true }), 'gpt-image-2');
});

test('rejects illegal historical dimensions', () => {
  for (const size of ['4096x4096', '4096x7280', '2048x2730']) assert.throws(() => validateGenerationSize(size));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test --test-concurrency=1 test/ecommerce-model-routing.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement the exact size catalog**

```js
export const LEGAL_IMAGE_SIZES = Object.freeze({
  '1K': { '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768' },
  '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048' },
  '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840' },
});
```

Implement numeric checks and routing rules without a high-price fallback.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-model-routing.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/modelCatalog.mjs test/ecommerce-model-routing.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add legal ecommerce model routing"
```

### Task 2: Product Truth and risk classification

**Files:**
- Create: `server/ecommerceEngine/productTruth.mjs`
- Modify: `server/ecommerceEngine/vlmSchema.mjs`
- Test: `test/product-truth.test.mjs`

**Interfaces:**
- Produces: `normalizeProductTruth`, `mergeProductFacts`, `classifyFactRisk`, `buildProductTruthPrompt`.

- [ ] **Step 1: Write failing tests**

Test that user facts override OCR, OCR overrides vision, uncertain certifications never enter `confirmedFacts`, and Logo/package/interface details become `forbiddenMutations`.

```js
assert.equal(mergeProductFacts({ vision: { size: '20cm' }, ocr: { size: '22cm' }, user: { size: '24cm' } }).confirmedFacts.size.value, '24cm');
assert.equal(classifyFactRisk('certification'), 'deterministic_only');
```

- [ ] **Step 2: Verify failure**

Run: `node --test --test-concurrency=1 test/product-truth.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement Product Truth**

Use this normalized shape:

```js
{
  category: '', productName: '', silhouette: '', primaryColors: [], materials: [], components: [],
  packageText: [], logos: [], skuFacts: {}, confirmedFacts: {}, uncertainFacts: [],
  forbiddenMutations: [], sourceAssetIds: [], fingerprint: '',
}
```

`buildProductTruthPrompt` must request JSON only and explicitly prohibit inferred dimensions, certification, efficacy, quantity, ingredients, and comparison claims.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/product-truth.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/productTruth.mjs server/ecommerceEngine/vlmSchema.mjs test/product-truth.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add product truth schema"
```

### Task 3: Campaign Bible and platform policy registry

**Files:**
- Create: `server/ecommerceEngine/campaignBible.mjs`
- Create: `server/ecommerceEngine/platformPolicies.mjs`
- Test: `test/campaign-bible.test.mjs`
- Test: `test/platform-policies.test.mjs`

**Interfaces:**
- Produces: `compileCampaignBible(direction, overrides)`, `getPlatformPolicy(platform, role, category)`, `planExportTargets`.

- [ ] **Step 1: Write tests**

Verify the direction title is retained but not editable, `editableBrief` changes the Bible, `customColors` becomes a palette lock, and unknown platform rules return recommendations rather than fabricated hard failures.

- [ ] **Step 2: Implement the compiler and registry**

```js
export function compileCampaignBible(direction, overrides = {}) {
  return {
    directionId: direction.id,
    title: direction.title,
    editableBrief: String(overrides.editableBrief ?? direction.brief ?? ''),
    commercialObjective: direction.objective || 'conversion',
    palette: overrides.customColors?.length ? overrides.customColors : direction.palette || [],
    lighting: direction.lighting || '',
    composition: direction.composition || '',
    copyTone: direction.copyTone || '',
    consistencyLocks: direction.consistencyLocks || [],
    prohibitedStyles: direction.prohibitedStyles || [],
    referenceAssetIds: overrides.referenceAssetIds || [],
  };
}
```

Every policy entry must include `sourceUrl`, `verifiedAt`, and `confidence`.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/campaign-bible.test.mjs test/platform-policies.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/campaignBible.mjs server/ecommerceEngine/platformPolicies.mjs test/campaign-bible.test.mjs test/platform-policies.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: compile campaign and platform policies"
```

### Task 4: Dynamic Asset Planner

**Files:**
- Create: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/categoryKnowledge.mjs`
- Test: `test/ecommerce-asset-planner.test.mjs`

**Interfaces:**
- Produces: `buildAssetPlan({ productTruth, campaignBible, platform, sizing, skus, uploadedProofs })`.

- [ ] **Step 1: Write category and risk tests**

Test that 3C includes deterministic parameter content, food excludes certification without proof, SKU assets use user SKU data, and `detail_slice_qc` is absent without a proof asset.

- [ ] **Step 2: Implement role plans rather than fixed counts**

Each returned item must contain:

```js
{ id, role, purpose, ratio, generationSize, exportTargets, generationMode, productAssetIds, styleReferenceIds, requiredFacts, riskLevel, qualityChecks }
```

User-selected sizing overrides the smart plan per item, never through one global ratio.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-asset-planner.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/assetPlanner.mjs server/ecommerceEngine/categoryKnowledge.mjs test/ecommerce-asset-planner.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: plan ecommerce assets dynamically"
```

### Task 5: Indexed multipart prompt compiler

**Files:**
- Create: `server/ecommerceEngine/promptCompiler.mjs`
- Modify: `server/ecommerceEngine/promptAssembler.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`

**Interfaces:**
- Produces: `compileAssetRequest({ assetPlanItem, productTruth, campaignBible, assets })` returning `{ prompt, inputAssets, modelRoute }`.

- [ ] **Step 1: Write tests**

Verify no request exceeds ten images, product views precede style references, each index has one explicit responsibility, required user facts are included, uncertain facts are excluded, and reference products are forbidden from replacing the real product.

- [ ] **Step 2: Implement selection and prompt sections**

```js
const inputAssets = [
  ...rankProductAssets(assets.product, 5),
  ...rankStyleAssets(assets.reference, assetPlanItem, 3),
  ...rankProtectionAssets(assets.protection, 2),
].slice(0, 10);
```

Compile separate sections for Product Truth, Campaign Bible, image-index duties, role objective, platform policy, deterministic overlays, and forbidden mutations.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-prompt-compiler.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/promptCompiler.mjs server/ecommerceEngine/promptAssembler.mjs test/ecommerce-prompt-compiler.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: compile indexed ecommerce edits"
```

### Task 6: Async provider adapter and durable job state

**Files:**
- Create: `server/ecommerceEngine/providerAdapter.mjs`
- Create: `server/ecommerceEngine/jobStore.mjs`
- Modify: `server/generationJobs.mjs`
- Test: `test/ecommerce-provider-adapter.test.mjs`
- Test: `test/ecommerce-job-store.test.mjs`

**Interfaces:**
- Produces: `createProviderAdapter(config)`, `createEcommerceJobStore(db)`.

- [ ] **Step 1: Write adapter request tests**

Mock fetch and assert edits use `FormData`, `X-Async-Mode: true`, one auth strategy, model route size, and indexed image fields. Verify polling recognizes queued/running/completed/failed and treats a synchronous 504 as still recoverable when a provider job ID exists.

- [ ] **Step 2: Write job recovery tests**

Persist `provider_job_id`, request snapshot, attempt count, output URL, stable URL, and per-asset state. Restart the store and verify `submitted`, `polling`, `downloading`, and `quality_check` assets are recoverable.

- [ ] **Step 3: Implement adapter and state machine**

```js
const ASSET_STATES = ['queued', 'submitted', 'polling', 'downloading', 'quality_check', 'repairing', 'completed', 'needs_review', 'failed', 'cancelled'];
```

Call `recoverInterrupted()` during server startup. Do not reset completed asset items.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-provider-adapter.test.mjs test/ecommerce-job-store.test.mjs test/generation-jobs.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/providerAdapter.mjs server/ecommerceEngine/jobStore.mjs server/generationJobs.mjs test/ecommerce-provider-adapter.test.mjs test/ecommerce-job-store.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: persist async ecommerce provider jobs"
```

### Task 7: Real quality gate and targeted repairs

**Files:**
- Create: `server/ecommerceEngine/qualityGate.mjs`
- Create: `server/ecommerceEngine/repairPlanner.mjs`
- Replace: `server/ecommerceEngine/qualityCheck.mjs`
- Test: `test/ecommerce-quality-gate.test.mjs`

**Interfaces:**
- Produces: `evaluateAsset`, `planRepair`, `canRetry`.

- [ ] **Step 1: Write deterministic quality tests**

Use Sharp-generated fixtures to test dimensions, white background coverage, format, blank images, and blur. Test OCR/visual adapters through injected fakes. Assert random numbers are never used.

- [ ] **Step 2: Implement structured output**

```js
{
  passed,
  checks: { technical, productFidelity, copyAndLogo, platformCompliance, visualQuality },
  repairAction,
  confidence,
}
```

`planRepair` maps technical failures to Sharp, text failures to cleanup plus deterministic overlay, local visual defects to edits, and product drift to regeneration. `canRetry(attempt)` returns true only for attempts 0 and 1.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-quality-gate.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/qualityGate.mjs server/ecommerceEngine/repairPlanner.mjs server/ecommerceEngine/qualityCheck.mjs test/ecommerce-quality-gate.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add real ecommerce quality gates"
```

### Task 8: Orchestrator, stable assets, and billing settlement

**Files:**
- Create: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `server/ecommerceEngine/index.mjs`
- Modify: `server/generatedAssets.mjs`
- Modify: `server/index.mjs`
- Test: `test/ecommerce-orchestrator.test.mjs`
- Test: `test/ecommerce-route-integration.test.mjs`

**Interfaces:**
- Produces: `createEcommerceOrchestrator(deps)` with `createJob`, `runJob`, `resumeJobs`, `getJob`.

- [ ] **Step 1: Write orchestration tests**

Test this sequence with fakes: analyze Product Truth → compile Bible → plan representative asset → provider job → stable download → quality pass → settle one hold item. Test quality failure → two repairs → `needs_review` without settlement. Test partial batch success settles only successful items.

- [ ] **Step 2: Implement orchestration**

```js
async function runAsset(job, item) {
  const request = compileAssetRequest(...);
  const provider = await adapter.submitEdit(request);
  store.markSubmitted(job.id, item.id, provider.jobId);
  const output = await adapter.pollUntilReady(provider.jobId);
  const stable = await persistGeneratedAsset(output.url, { ownerEmail: job.ownerEmail, taskId: job.id });
  const quality = await evaluateAsset({ ...item, stableUrl: stable.url });
  return quality.passed ? completeAndSettle(...) : repairOrReview(...);
}
```

The route returns `202 { taskId, status: 'queued' }` and SSE/legacy compatibility polls the job. Remove production dependence on Contact Sheet generation without deleting its module until compatibility tests pass.

- [ ] **Step 3: Start recovery on boot**

Call `orchestrator.resumeJobs()` after database and billing initialization, before `app.listen`.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/api-contract.test.mjs test/generated-assets.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/orchestrator.mjs server/ecommerceEngine/index.mjs server/generatedAssets.mjs server/index.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: orchestrate durable ecommerce generation"
```

### Task 9: Backend asset upload and deterministic exports

**Files:**
- Create: `server/ecommerceEngine/assetUpload.mjs`
- Create: `server/ecommerceEngine/exportService.mjs`
- Modify: `server/index.mjs`
- Test: `test/ecommerce-asset-upload.test.mjs`
- Test: `test/ecommerce-export.test.mjs`

- [ ] **Step 1: Write upload and export tests**

Verify original JPEG/PNG bytes are stored without the frontend 800px conversion, preview derivatives are separate, traversal is rejected, and platform export performs deterministic crop/resize/format/size checks.

- [ ] **Step 2: Implement endpoints**

Add authenticated `/api/ecommerce/assets` and `/api/ecommerce/exports`. Return stable asset IDs; never return filesystem paths.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-asset-upload.test.mjs test/ecommerce-export.test.mjs test/image-input.test.mjs`

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/ecommerceEngine/assetUpload.mjs server/ecommerceEngine/exportService.mjs server/index.mjs test/ecommerce-asset-upload.test.mjs test/ecommerce-export.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: preserve originals and export platform assets"
```

### Task 10: Full backend verification

- [ ] **Step 1: Run the complete test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run build verification**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Check forbidden production patterns**

Run: `rg -n "Math\.random\(\).*quality|4096x4096|4096x7280|2048x2730|quality:\s*'high'|referenceContactSheet" server/ecommerceEngine server/index.mjs`

Expected: no random QC, illegal dimensions, unsupported quality parameter, or production Contact Sheet dependency.

- [ ] **Step 4: Commit final fixes**

Stage only intentional backend/test files and commit:

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "test: verify structured ecommerce engine"
```
