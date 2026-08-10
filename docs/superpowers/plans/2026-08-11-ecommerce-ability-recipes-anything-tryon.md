# 电商能力配方与万物上身 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each task must complete its own RED-GREEN-REFACTOR cycle before the next task begins.

**Goal:** 在现有电商生图工作台中交付可扩展的能力配方架构和首个“万物上身”流程，保持商品套图兼容、任务可恢复、账务不重复。

**Architecture:** 用 `shared/ecommerceAbilityRecipes.mjs` 作为前后端共同读取的白名单注册表；前端根据配方渲染动态素材槽和效果说明，后端用 role-aware 合同把槽位映射到现有耐久电商编排器。首期继续使用现有商业图像编辑路由，专用 VTON 只留受许可和 canary 保护的扩展点。

**Tech Stack:** React 现有 Home/EcommerceWorkbench、Vite、Node ESM、SQLite 任务/作品存储、Node test runner、现有 provider adapter / billing / Canvas 链路。

## Global Constraints

- 顶层产品域仍然只有电商生图、视频生成、小红书图文、自由创作四个。
- `anything_tryon` 首期复用现有商业图像编辑路由，不下载或部署未经商业授权的 CatVTON、IDM-VTON、OOTDiffusion 或 FastFit 权重。
- 旧请求没有 `ability_recipe` 时必须归一化为 `product_suite@1`。
- 任何输入校验、asset 所有权校验和费用 hold 必须发生在 provider 调用之前。
- 不能保存临时 URL、原始字节、隐藏系统提示词或 API key。
- 手工编辑使用 `apply_patch`；不暂存用户已有的 package、extension task、`.tmp/` 和诊断脚本变更。
- 测试不得触发真实付费图像/视频生成。

---

### Task 1: 建立配方注册表和纯合同

**Files:**
- Create: `shared/ecommerceAbilityRecipes.mjs`
- Test: `test/ecommerce-ability-recipes.test.mjs`

**Interfaces:**
- `getEcommerceAbilityRecipe(id = 'product_suite', version = null) -> recipe`
- `normalizeEcommerceAbilityRequest(input = {}) -> { recipe, assetRoles, slotAssets }`
- `recipe.inputSlots` uses `{ id, label, min, max, required }`.

- [ ] **Step 1: Write the failing tests**

测试默认回退、注册表顺序、不可变数据和万物上身槽位合同：

```js
test('legacy request normalizes to product_suite without changing product/reference semantics', () => {
  const normalized = normalizeEcommerceAbilityRequest({
    assets: { product: [{ assetId: 'p1' }], reference: [{ assetId: 'r1' }] },
  });
  assert.equal(normalized.recipe.id, 'product_suite');
  assert.deepEqual(normalized.assetRoles, [
    { assetId: 'p1', role: 'product', ordinal: 0 },
    { assetId: 'r1', role: 'reference', ordinal: 0 },
  ]);
});

test('anything_tryon requires one item and keeps person and scene as separate roles', () => {
  const normalized = normalizeEcommerceAbilityRequest({
    ability_recipe: { id: 'anything_tryon', version: 1 },
    asset_roles: [
      { assetId: 'item-1', role: 'items', ordinal: 0 },
      { assetId: 'person-1', role: 'person', ordinal: 0 },
      { assetId: 'scene-1', role: 'scene', ordinal: 0 },
    ],
    assets: {
      product: [{ assetId: 'item-1' }],
      person: [{ assetId: 'person-1' }],
      scene: [{ assetId: 'scene-1' }],
    },
  });
  assert.equal(normalized.recipe.id, 'anything_tryon');
  assert.equal(normalized.slotAssets.items[0].assetId, 'item-1');
  assert.equal(normalized.slotAssets.person[0].assetId, 'person-1');
  assert.equal(normalized.slotAssets.scene[0].assetId, 'scene-1');
});

test('unknown roles, duplicate ids, and slot overflow fail before execution', () => {
  assert.throws(() => normalizeEcommerceAbilityRequest({
    ability_recipe: { id: 'anything_tryon', version: 1 },
    asset_roles: [{ assetId: 'p1', role: 'not-a-slot', ordinal: 0 }],
    assets: { product: [{ assetId: 'p1' }] },
  }), /role/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- --test-name-pattern="ability recipe" test/ecommerce-ability-recipes.test.mjs`. Expected: module-not-found or missing export failures, with no unrelated test errors.

- [ ] **Step 3: Implement the minimal registry and normalizer**

Define frozen `product_suite@1` and `anything_tryon@1`, normalize only allowlisted primitive fields, derive legacy roles from formal arrays, reject unknown IDs/roles/versions and enforce each slot's min/max. Do not include provider prompts or provider model IDs in client-readable recipe data.

- [ ] **Step 4: Run focused tests and then the existing workbench state tests**

Run `npm test -- test/ecommerce-ability-recipes.test.mjs test/ecommerce-workbench-state.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit the isolated registry change**

```powershell
git add -- shared/ecommerceAbilityRecipes.mjs test/ecommerce-ability-recipes.test.mjs
git commit -m "feat: add ecommerce ability recipe contract"
```

### Task 2: Make the Home workbench recipe-aware

**Files:**
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/ec/workbenchState.js`
- Modify: `src/pages/Home/Home.css`
- Test: `test/ecommerce-workbench-state.test.mjs`
- Test: `test/ecommerce-ability-ui-contract.test.mjs`

**Interfaces:**
- `EcommerceWorkbench` accepts `abilityRecipe`, `roleImages`, and role-specific upload/remove callbacks while retaining old props as defaults.
- `buildRecipeUploadDeck({ recipe, roleImages })` returns stable slot descriptors with `id`, `label`, `required`, `count`, and `accept`.

- [ ] **Step 1: Add failing state/UI assertions**

Assert that selecting `anything_tryon` produces `items/person/scene` slots, removes the duplicate bottom upload action, exposes `保留/结果/适合`, and preserves product-suite defaults.

- [ ] **Step 2: Run the focused tests and verify RED**

Run `npm test -- test/ecommerce-workbench-state.test.mjs test/ecommerce-ability-ui-contract.test.mjs`. Expected: missing recipe-aware exports/markup failures.

- [ ] **Step 3: Implement recipe rail and dynamic slots**

Render a compact horizontal recipe rail above the existing composer. Use the shared registry, `aria-selected`, visible focus, and a non-modal “看懂结果” disclosure. On recipe switch, map current product images into `items`; keep unmappable references in a review strip instead of deleting them. Give each slot one upload affordance, accepted MIME labels and a count badge. Video/audio are not accepted for this recipe.

- [ ] **Step 4: Implement smart-model/reference-model mode**

For `anything_tryon`, add a segmented control inside the person slot: `智能模特` (no upload required) and `参考模特图` (0-1 image). Keep the prompt field below the slots; its placeholder must explain the relationship, not repeat upload instructions.

- [ ] **Step 5: Run tests and perform a static responsive check**

Run the focused tests and `npm run build`. Inspect that the composer has one action row and no page-level horizontal overflow at 390px.

### Task 3: Extend the client request without breaking old payloads

**Files:**
- Modify: `src/services/api.js`
- Modify: `src/pages/Home/EcMode.jsx`
- Test: `test/api-contract.test.mjs`
- Test: `test/ecommerce-upload-contract.test.mjs`

**Interfaces:**
- `generateEcommerce({ abilityRecipe, assetRoles, roleAssets, ...existing })` sends `ability_recipe`, `asset_roles`, and formal role groups.

- [ ] **Step 1: Write failing request-body tests**

Use the existing mocked fetch harness to assert a try-on request contains `assets.product`, `assets.person`, `assets.scene`, and an ordered role manifest; assert a legacy call contains no fabricated person/scene fields and still uses `product/reference`.

- [ ] **Step 2: Run tests and verify RED**

Run `npm test -- test/api-contract.test.mjs test/ecommerce-upload-contract.test.mjs`. Expected: body assertions fail before implementation.

- [ ] **Step 3: Add explicit role-group serialization**

Serialize only owned uploaded asset records. Normalize the recipe through the shared contract before sending. Preserve the existing legacy URL preparation path and abort checks. If a role upload fails, retain successful assets and report the failed slot locally.

- [ ] **Step 4: Run the focused API suite**

Run `npm test -- test/api-contract.test.mjs test/ecommerce-upload-contract.test.mjs test/ecommerce-route-integration.test.mjs`. Expected: all pass.

### Task 4: Validate and persist role-aware assets on the server

**Files:**
- Create: `server/ecommerceEngine/abilityRecipeContract.mjs`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `server/ecommerceEngine/workPersistence.mjs`
- Modify: `server/ecommerceEngine/projectLifecycle.mjs`
- Test: `test/ecommerce-ability-server-contract.test.mjs`
- Test: `test/task-persistence.test.mjs`
- Test: `test/project-version-store.test.mjs`

**Interfaces:**
- `normalizeServerAbilityRequest(payload, assets) -> { recipe, assetRoles, slotAssets }`.
- `snapshotAbilityRecipe(payload) -> { abilityRecipe, assetRoles }`.

- [ ] **Step 1: Add failing server contract tests**

Cover unknown recipe, missing required item, cross-group ID mismatch, accepted person/scene groups, legacy fallback, sanitized task payload, and Works/Project snapshot recovery.

- [ ] **Step 2: Run tests and verify RED**

Run `npm test -- test/ecommerce-ability-server-contract.test.mjs test/task-persistence.test.mjs test/project-version-store.test.mjs`. Expected: missing module/fields failures.

- [ ] **Step 3: Implement server-side allowlist validation**

Call the contract after `assetsFromPayload` and before visual analysis/billing. Normalize `person` and `scene` as formal image assets with the same ownership and URL validation already used by product/reference. Reject video/audio in try-on slots and never trust client route fields.

- [ ] **Step 4: Add recipe fields to every durable snapshot**

Include sanitized `abilityRecipe` and `assetRoles` in `visualInputSnapshot`, `deterministicInputs`, current work snapshots, project source versions, and Canvas source metadata. Add migration behavior for snapshots without the fields. Keep existing `productAssets`/`referenceAssets` fields for old consumers.

- [ ] **Step 5: Run persistence and full ecommerce tests**

Run the three focused files plus `npm test -- test/ecommerce-route-integration.test.mjs test/production-ecommerce-verifier.test.mjs`. Expected: no duplicate hold or provider submission changes.

### Task 5: Compile the try-on analysis and prompt strategy

**Files:**
- Modify: `server/ecommerceEngine/designDirectionService.mjs`
- Modify: `server/ecommerceEngine/promptCompiler.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Test: `test/visual-analysis-service.test.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`

**Interfaces:**
- Analysis input includes `abilityRecipe`, `assetRoles`, `productAssets`, `personAssets`, `sceneAssets`.
- `compileAssetRequest` receives the same recipe context and emits role-specific `imageIndexDuties`.

- [ ] **Step 1: Write failing prompt/analysis tests**

Assert that item images are identity authority, person images are identity/pose references, scene images are environment references, and the compiled prompt contains physical fit/occlusion/no-extra-item constraints. Assert the default product prompt remains unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run `npm test -- test/visual-analysis-service.test.mjs test/ecommerce-prompt-compiler.test.mjs`. Expected: role distinction assertions fail.

- [ ] **Step 3: Add recipe-aware analysis inputs**

Keep existing product/style analysis intact for `product_suite`. For try-on, pass person and scene to dedicated bounded analysis lanes and merge only their allowed facts into the campaign context. Do not call a person image a style reference.

- [ ] **Step 4: Add `anything_tryon_v1` prompt compiler branch**

Use the exact constraints in the design spec. Keep input count <=10, preserve deterministic asset ordering, and attach each selected image’s role/responsibility to the provider request snapshot for debugging and recovery.

- [ ] **Step 5: Run prompt, orchestration, billing regression tests**

Run `npm test -- test/ecommerce-prompt-compiler.test.mjs test/visual-analysis-service.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-route-integration.test.mjs`.

### Task 6: Add original examples and polished interaction states

**Files:**
- Create: `public/images/home/ability-tryon-example-input.png`
- Create: `public/images/home/ability-tryon-example-output.png`
- Create: `public/images/home/ability-tryon-swatch.png`
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/Home.css`
- Test: `test/home-mode-cards.test.mjs`
- Test: `test/ecommerce-ability-ui-contract.test.mjs`

- [ ] **Step 1: Generate original bitmap examples**

Use the built-in image generation workflow for new project-bound raster assets. Generate original commercial-fashion examples with no competitor logo, copied text, screenshot, or watermark. Inspect each image and place final assets under `public/images/home/`.

- [ ] **Step 2: Add failing asset/markup assertions**

Assert that the recipe card references the new assets and that alt text/captions describe input/output rather than claiming exact try-on accuracy.

- [ ] **Step 3: Implement visual effect explainer**

Add a small input-to-output scrubber/step switch or before/after animation in the selected recipe detail. It must work with keyboard buttons, respect reduced motion, stay inside the composer width, and never be the sole way to understand the function.

- [ ] **Step 4: Run UI tests and build**

Run focused UI tests and `npm run build`.

### Task 7: Browser QA and migration evidence

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Test: existing ecommerce/browser contract tests and a new `test/ecommerce-ability-browser-state.test.mjs` if the current QA harness needs a pure state fixture.

- [ ] **Step 1: Run the full automated suite**

Run `npm test`, `npm run build`, `npm run check`, `npm run collab:check`, and `git diff --check`. Record exact pass counts and failures.

- [ ] **Step 2: Start a non-production dev server**

Use an unused local port. Verify desktop and 390px states: default recipe, try-on recipe, recipe switching with existing uploads, each slot upload/remove, smart/reference model toggle, effect explainer, error states, and Canvas handoff. Never click a real generation action.

- [ ] **Step 3: Check runtime safety**

Confirm console has no errors, no page-level horizontal scroll, no fixed action overlap, no broken images, and no duplicate upload affordance. Verify `prefers-reduced-motion` and keyboard focus.

- [ ] **Step 4: Close research-only browser tabs and update the progress ledger**

Close only the three tabs opened for this task. Record the research URLs, license decision, test evidence and remaining specialized VTON gate in `.superpowers/sdd/progress.md`.

- [ ] **Step 5: Commit only this feature’s files**

Review `git diff --stat` and `git status --short`; stage only the files listed in this plan. Do not stage the user-owned dirty files listed in Global Constraints.

