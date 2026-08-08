# Global Commerce Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable international commerce generation context so platform, content type, language, and delivery policy drive the complete ecommerce workflow.

**Architecture:** Keep the existing provider, billing, durable job, and Canvas engines. Add a small client/server registry with stable IDs, normalize the context at each boundary, and pass the same snapshot through first-step state, design-direction planning, generation payloads, asset planning, and persistence metadata. Treat verified platform constraints as policy data, not UI-only copy.

**Tech Stack:** React, existing ecommerce state/models, Node ESM, SQLite-backed durable jobs, Node test runner, Vite.

## Global Constraints

- Preserve product truth and confirmed SKU facts; model output may not invent dimensions, materials, certifications, or variant differences.
- `targetLanguage=visual` means no generated text; confirmed text is deterministic only.
- Detail output remains `9:16`; platform pixels are deterministic export targets.
- Unknown platforms/languages fail closed to `smart` / `visual` and never receive fabricated hard compliance.
- Keep existing billing, idempotency, retry, Canvas and Works contracts backward compatible.

### Task 1: Registry And Normalization

**Files:**
- Create: `src/pages/Home/ec/internationalCommerceRegistry.js`
- Create: `server/ecommerceEngine/internationalCommerceRegistry.mjs`
- Modify: `server/ecommerceEngine/platformPolicies.mjs`
- Test: `test/international-commerce-registry.test.mjs`

- [ ] Write failing tests for stable platform IDs, grouped domestic/cross-border options, language normalization, content-type defaults, and visual-only safety.
- [ ] Run `node --test test/international-commerce-registry.test.mjs` and observe RED.
- [ ] Implement frozen client/server registries for domestic and cross-border platforms, 20+ languages, and `main/detail/ad`; expose `normalizeCommerceContext()` on the server and matching client helper.
- [ ] Add policy metadata for Amazon/TikTok verified constraints and recommendation-level defaults for other platforms.
- [ ] Run the focused test and commit.

### Task 2: First-Step Configuration

**Files:**
- Modify: `src/pages/Home/ec/workbenchState.js`
- Modify: `src/pages/Home/ec/EcMode.jsx`
- Modify: `src/pages/Home/ec/SizingPanel.jsx`
- Modify: `src/pages/Home/ec/ecommercePlanModel.js`
- Modify: `src/pages/Home/Home.css`
- Test: `test/international-commerce-ui-contract.test.mjs`

- [ ] Add RED contract tests requiring the context to survive smart reset, platform switch, sizing resolution, and manual overrides.
- [ ] Implement the three content-type tabs, grouped platform menu, language menu, market summary, and stable responsive floating panel layout.
- [ ] Make platform presets data-driven and add international defaults without reducing existing domestic presets.
- [ ] Keep custom image counts/ratios when switching platform; only replace untouched smart defaults.
- [ ] Run focused UI/model tests and commit.

### Task 3: Second-Step And Generation Boundary

**Files:**
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Modify: `src/services/api.js`
- Modify: `server/ecommerceEngine/designDirectionService.mjs`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Test: `test/international-commerce-generation.test.mjs`

- [ ] Add RED tests asserting platform, content type, language, locale, and policy version reach direction prompts, pending actions, asset plans, and generation requests.
- [ ] Normalize and persist a context snapshot at the server boundary; include language/market constraints in planner instructions and direction summaries.
- [ ] Make angle planning explicitly require front/side/top/back/detail/use-scale coverage and comparable orientation for comparison scenes.
- [ ] Add language-aware typography/unit instructions without letting the model render unverified factual text.
- [ ] Run focused generation tests and commit.

### Task 4: Canvas, Works And Export Metadata

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `server/ecommerceEngine/workPersistence.mjs`
- Modify: `server/ecommerceEngine/exportService.mjs`
- Modify: `src/pages/Works/index.jsx`
- Test: `test/international-commerce-delivery.test.mjs`

- [ ] Add RED tests for context labels on Canvas nodes, stable export names, Work metadata, and old records without context.
- [ ] Implement context badges and export naming using platform/language/content type while excluding source assets and JSON from user downloads.
- [ ] Add backward-compatible fallback for legacy works to `smart`, `visual`, and `main`.
- [ ] Run focused delivery tests and commit.

### Task 5: Full Verification And Release

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md` only if the release snapshot changes.

- [ ] Run `npm test`, `npm run build`, `npm run check`, `npm run collab:check`, and `git diff --check`.
- [ ] Run desktop/mobile browser checks for the configuration panel, overflow, keyboard navigation, and second-step context summary.
- [ ] Deploy only through `scripts/deploy-production.ps1`, using the main canary account `867550189@qq.com`; never use `240485042@qq.com` for automation.
- [ ] Run public health, billing, authenticated generation canaries, gallery/Works checks, and `npm run audit:production -- --url=https://shuimg.cn`.
- [ ] Record commit, tests, PM2 PID, canary task IDs, audit result, and lock state.
