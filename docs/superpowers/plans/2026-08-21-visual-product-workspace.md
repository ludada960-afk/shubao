# Visual Product Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable, owner-scoped product workspace that reuses the existing SKU/ecommerce generation flow while preserving confirmed product facts and canonical image/video/audio references across repeated production jobs.

**Architecture:** A product profile is a reusable business object separate from a generation project. It stores bounded, user-confirmed facts and SKU variants, while `product_profile_assets` stores only `{ projectId, projectAssetId, role, expectedContentHash }` references to canonical `project_assets`. The existing ecommerce project/version/generation and billing paths consume a profile snapshot later; this phase does not create providers, generation jobs, or billing mutations. Retention and reuse checks treat profile references as active business references.

**Tech Stack:** Node.js ESM, better-sqlite3, existing project store/routes/client conventions, React model tests, Node built-in test runner.

## Global Constraints

- All reads and writes are owner-scoped; caller-supplied email, stable URL, and raw provider/video IDs are never authorization inputs.
- Product profiles store no binary payloads, `data:`/`blob:` URLs, private prompts, provider credentials, or external URLs.
- Canonical asset references must be revalidated against `project_assets` by project, owner, content hash, MIME and retention state before profile writes.
- Saving, reading, editing, archiving, or applying a product profile is free and never mutates wallet state or calls a provider.
- Existing ecommerce SKU fields remain supported; the profile model normalizes them into durable variants instead of replacing the current SKU UI.
- Changes to server/project/asset paths require focused tests, `npm test`, build, check, collaboration check and diff check before any production decision; this phase must not deploy or trigger real generation.

---

### Task 1: Define And Test The Product Profile Contract

**Files:**
- Create: `server/projects/productProfileContract.mjs`
- Test: `test/product-profile-contract.test.mjs`

**Interfaces:**
- Consumes: raw profile payloads from the signed API and existing ecommerce `productParams`/`skus` shapes.
- Produces: `normalizeProductProfileInput(value)`, `normalizeProductProfilePatch(value)`, `normalizeProductProfileAssetRef(value)`, and `PRODUCT_PROFILE_STATUSES`.

- [x] **Step 1: Write the failing contract tests**

Cover these exact assertions:

```js
const profile = normalizeProductProfileInput({
  name: '  陶瓷杯  ',
  category: '家居',
  facts: { material: '陶瓷', capacity: '350ml', unsafe: 'x'.repeat(5000) },
  variants: [{ color: '白色', spec: '大号', size: '', capacity: '', dimLabel: '', count: 2 }],
  assets: [{ projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' }],
});
assert.equal(profile.name, '陶瓷杯');
assert.equal(profile.facts.material, '陶瓷');
assert.equal(profile.variants[0].count, 2);
assert.deepEqual(profile.assets[0], { projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' });
assert.equal(Object.hasOwn(profile.facts, 'unsafe'), false);
assert.throws(() => normalizeProductProfileAssetRef({ projectId: '', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' }), /projectId/);
assert.throws(() => normalizeProductProfilePatch({ status: 'deleted' }), /status/);
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/product-profile-contract.test.mjs`

Expected: FAIL because the contract module and normalizers do not exist.

- [x] **Step 3: Implement bounded normalization**

Use explicit allowlists for fact keys (`productName`, `category`, `material`, `dimensions`, `baseColor`, `accentColor`, `craft`, `sellingPoints`, `restrictions`, `usage`, `targetAudience`), trim strings, cap each value at 500 characters, cap facts at 32 keys, cap variants at 100, deduplicate equivalent variants, and accept only `active`/`archived` status. Asset references must require non-empty IDs, a role from `product/reference/person/scene/generated`, and a non-empty expected hash.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `node --test test/product-profile-contract.test.mjs`

Expected: all contract tests pass with no payload fields outside the allowlists.

- [ ] **Step 5: Commit only the contract files**

```powershell
git add server/projects/productProfileContract.mjs test/product-profile-contract.test.mjs
git commit -m "feat: define durable product profile contract"
```

### Task 2: Persist Owner-Scoped Product Profiles And Asset References

**Files:**
- Modify: `server/projects/schema.mjs`
- Modify: `server/projects/projectStore.mjs`
- Modify: `test/project-version-store.test.mjs`
- Create: `test/product-profile-store.test.mjs`

**Interfaces:**
- Consumes: Task 1 normalizers and the existing `project_assets` table.
- Produces: `createProductProfile`, `listProductProfiles`, `getProductProfile`, `updateProductProfile`, and `archiveProductProfile` methods on the project store.

- [x] **Step 1: Write failing persistence tests**

Test creation, idempotent replay, owner isolation, canonical reference validation, patching variants/facts, archive behavior, and rejection of an expired/marked asset. Assert that profile responses contain no owner email or raw URL.

- [x] **Step 2: Run the focused store tests and verify failure**

Run: `node --test test/product-profile-store.test.mjs test/project-version-store.test.mjs`

Expected: new product profile tests fail because the schema and store methods are absent; existing project tests remain the compatibility baseline.

- [x] **Step 3: Add additive SQLite tables and indexes**

Create `product_profiles` with owner, normalized name/category, `facts_json`, status, timestamps and a unique owner/idempotency key; create `product_profile_variants` with stable row IDs, ordinal and normalized variant fields; create `product_profile_assets` with profile ID, project ID, canonical project asset ID, role, expected hash and timestamps. Do not add foreign keys across project IDs because profiles may reference assets from multiple ecommerce projects; validate them transactionally instead.

- [x] **Step 4: Add transactional store methods**

Every method must normalize the signed owner, load the profile by owner and ID, validate every referenced asset with the existing canonical row checks and `retention_state = 'active'` or pinned/permanent policy, then replace variants/references atomically on patch. Archive only changes profile status and never deletes canonical assets. Replaying the same owner/idempotency key must return the original profile without duplicate variants or references.

- [x] **Step 5: Run focused persistence and existing project tests**

Run: `node --test test/product-profile-contract.test.mjs test/product-profile-store.test.mjs test/project-version-store.test.mjs`

Expected: all new tests and the existing project store suite pass.

- [ ] **Step 6: Commit only schema/store and their tests**

```powershell
git add server/projects/schema.mjs server/projects/projectStore.mjs test/product-profile-contract.test.mjs test/product-profile-store.test.mjs test/project-version-store.test.mjs
git commit -m "feat: persist reusable product profiles"
```

### Task 3: Expose Signed Routes And Client Services

**Files:**
- Modify: `server/projects/projectRoutes.mjs`
- Modify: `src/services/projects.js`
- Create: `test/product-profile-routes.test.mjs`
- Modify: `test/project-routes.test.mjs`
- Modify: `test/project-client.test.mjs`

**Interfaces:**
- Consumes: Task 2 store methods.
- Produces: `POST /api/product-profiles`, `GET /api/product-profiles`, `GET /api/product-profiles/:profileId`, `PATCH /api/product-profiles/:profileId`, `POST /api/product-profiles/:profileId/archive`, plus matching client methods.

- [x] **Step 1: Write failing route/client tests**

Verify signed owner scoping, missing/invalid idempotency keys, foreign asset rejection, archive idempotence, pagination limits, and client serialization. A body/query email must not change the authenticated owner.

- [x] **Step 2: Run focused tests and verify failure**

Run: `node --test test/product-profile-routes.test.mjs test/project-routes.test.mjs test/project-client.test.mjs`

Expected: product profile route/client tests fail because endpoints and service functions do not exist.

- [x] **Step 3: Implement route error mapping and signed clients**

Use the existing `ownerFor`, `requestJson`, `jsonBody`, `signedHeaders`, `pathSegment`, and `createApiError` conventions. Require `Idempotency-Key` for create/update mutations, return `409 IDEMPOTENCY_CONFLICT` for a reused key with a different payload, and return only normalized profile data.

- [x] **Step 4: Run focused route/client tests**

Run: `node --test test/product-profile-routes.test.mjs test/project-routes.test.mjs test/project-client.test.mjs`

Expected: all route and client tests pass with no provider or billing calls.

- [ ] **Step 5: Commit only routes, client and tests**

```powershell
git add server/projects/projectRoutes.mjs src/services/projects.js test/product-profile-routes.test.mjs test/project-routes.test.mjs test/project-client.test.mjs
git commit -m "feat: expose reusable product profile API"
```

### Task 4: Protect Profile-Referenced Assets From Retention Cleanup

**Files:**
- Modify: `server/projects/retentionService.mjs`
- Modify: `test/project-retention.test.mjs`
- Create: `test/product-profile-retention.test.mjs`

**Interfaces:**
- Consumes: `product_profile_assets` references created by Task 2.
- Produces: retention decisions that preserve active profile references and distinguish them from deleted/archived profiles.

- [x] **Step 1: Write failing retention tests**

Create an active profile referencing an otherwise unreferenced asset and assert the asset is preserved through mark/isolate/delete passes. Archive the profile, run the same passes, and assert normal retention cleanup resumes. Also verify a foreign-owner profile cannot protect another owner’s asset.

- [x] **Step 2: Run focused retention tests and verify failure**

Run: `node --test test/product-profile-retention.test.mjs test/project-retention.test.mjs`

Expected: the active profile reference is currently invisible to retention and the new test fails.

- [x] **Step 3: Add owner- and status-scoped reference checks**

Add `EXISTS` queries joining `product_profile_assets` to active `product_profiles` in the same owner scope. Preserve assets referenced by active profiles; archived profiles do not protect assets unless the asset is also pinned/permanent or referenced elsewhere.

- [x] **Step 4: Run focused retention tests**

Run: `node --test test/product-profile-retention.test.mjs test/project-retention.test.mjs test/product-profile-store.test.mjs`

Expected: active profile protection and archived-profile cleanup behavior pass.

- [ ] **Step 5: Commit only retention changes and tests**

```powershell
git add server/projects/retentionService.mjs test/product-profile-retention.test.mjs test/project-retention.test.mjs
git commit -m "fix: retain assets referenced by active product profiles"
```

### Task 5: Add A Reusable Product Profile Model Without Duplicating The SKU UI

**Files:**
- Create: `src/pages/Home/ec/productProfileModel.js`
- Create: `test/product-profile-model.test.mjs`
- Modify: `src/pages/Home/ec/projectLifecycleModel.js`
- Modify: `test/project-lifecycle-model.test.mjs`

**Interfaces:**
- Consumes: Task 1 normalized shape and current `EMPTY_ECOMMERCE_EDITOR`/SKU fields.
- Produces: `buildProductProfileDraft(editor)`, `applyProductProfileToEditor(profile, editor)`, `productProfileSummary(profile)`, and `productProfileReferenceSnapshot(profile)`.

- [x] **Step 1: Write failing pure model tests**

Assert that current Ecommerce editor state maps to durable facts and normalized variants, profile application restores the existing SKU fields without losing platform/sizing/copy settings, summaries are concise, and reference snapshots contain only canonical asset refs.

- [x] **Step 2: Run focused model tests and verify failure**

Run: `node --test test/product-profile-model.test.mjs test/project-lifecycle-model.test.mjs`

Expected: new model tests fail because the model module is absent.

- [x] **Step 3: Implement the pure adapter**

Keep current generation payload names and SKU semantics intact. Treat profile facts as confirmed user input, preserve `productParams`, normalize `spec`/`size`/`capacity`/`dimLabel`, and never copy local file/blob/data URLs into the reference snapshot.

- [x] **Step 4: Run focused model tests**

Run: `node --test test/product-profile-model.test.mjs test/project-lifecycle-model.test.mjs`

Expected: all adapter and legacy lifecycle tests pass.

- [x] **Step 5: Add the user-facing product profile shelf**

The ecommerce workbench now exposes a signed, collapsible shelf for listing, saving, applying and archiving profiles. Applying a profile restores only confirmed facts and variants; current local media, platform, sizing and generation settings remain intact.

- [ ] **Step 6: Commit only the model, shelf and tests**

```powershell
git add src/pages/Home/ec/productProfileModel.js test/product-profile-model.test.mjs src/pages/Home/ec/projectLifecycleModel.js test/project-lifecycle-model.test.mjs
git commit -m "feat: adapt ecommerce editor to product profiles"
```

### Task 6: Full Verification And Integration Boundary

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md` only if the current release snapshot or stable architecture rule changes.

- [x] **Step 1: Run focused cross-domain regression**

Run: `node --test test/product-profile-contract.test.mjs test/product-profile-store.test.mjs test/product-profile-routes.test.mjs test/product-profile-retention.test.mjs test/product-profile-model.test.mjs test/project-version-store.test.mjs test/project-routes.test.mjs test/project-client.test.mjs test/video-workbench-store.test.mjs test/video-project-bridge.test.mjs`

- [x] **Step 2: Run complete local gates**

Run: `npm test`, `npm run build -- --outDir dist-codex-build-20260821-product-profile`, `npm run check`, `npm run collab:check`, `node scripts/verify-exports.mjs`, and `git diff --check`.

- [x] **Step 3: Verify the negative boundaries**

Confirm no test or route invokes provider adapters, billing holds, real generation, or production deployment. Confirm the active video thread’s files remain outside the product-profile write set.

- [x] **Step 4: Record evidence and pending release**

Append exact test/build counts, changed files, online commit, and the fact that the feature remains unpublished until a clean full production gate can be run on an intentionally integrated commit. Do not claim the product catalog is complete if only the backend contract is present.
