# AI Video P1 Owner Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion` task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing P1 video workbench eligible for a reversible owner-only production pilot with measurable stage health and a ten-project, non-billing acceptance gate.

**Architecture:** Keep the global `VIDEO_PLATFORM_P1_WORKBENCH` kill switch, then add a second server-side owner-role cohort check for both capability discovery and every workbench route. Record authorized workbench operations in SQLite and expose a compact funnel/SLO snapshot through the existing owner-only monitoring endpoint. Validate ten complete pre-generation projects in an isolated in-memory database so the gate cannot submit provider jobs or mutate wallets.

**Tech Stack:** Node.js ESM, Express, better-sqlite3, React 18, Node test runner.

## Global Constraints

- The global flag remains false by default.
- Anonymous, tester, member, and admin accounts receive `workbenchEnabled: false` and cannot use workbench routes.
- Route denial is indistinguishable from an unavailable workbench and does not disclose rollout membership.
- The pilot verifier creates no provider job, billing quote, reservation, settlement, or wallet mutation.
- Existing homepage video composition and all ecommerce/gallery code remain unchanged.

---

### Task 1: Owner Cohort Gate

**Files:**
- Create: `server/videoWorkbenchRollout.mjs`
- Modify: `server/videoWorkbenchRoutes.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/VideoStudio/index.jsx`
- Test: `test/video-workbench-rollout.test.mjs`
- Test: `test/video-workbench-routes.test.mjs`
- Test: `test/video-workbench-cutover.test.mjs`

- [x] Write failing tests proving the global flag alone is insufficient, only an active owner is eligible, anonymous capability reads remain public and false, and tester route access returns the generic unavailable response.
- [x] Run the focused tests and confirm they fail for missing cohort enforcement.
- [x] Implement a focused rollout policy and wire it into capability discovery and all workbench routes.
- [x] Refetch signed capabilities when login state changes so owner eligibility appears without reloading the page.
- [x] Run the focused tests and commit the gate.

### Task 2: Workbench Operation and Funnel Metrics

**Files:**
- Modify: `server/videoWorkbenchStore.mjs`
- Modify: `server/videoWorkbenchRoutes.mjs`
- Modify: `server/adminOperations.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/AdminConsole/index.jsx`
- Test: `test/video-workbench-store.test.mjs`
- Test: `test/video-workbench-routes.test.mjs`
- Test: `test/admin-routes.test.mjs`

- [x] Write failing tests for successful/failed operation records, 24-hour success rate and p95 latency, project-stage funnel counts, stale-record health, and monitoring projection.
- [x] Run the focused tests and confirm the missing schema/API failures.
- [x] Add append-only operation records and a read-only operational snapshot to the store.
- [x] Record every authorized route mutation and project read without changing route responses.
- [x] Add the snapshot to owner monitoring and render compact pilot health metrics in the existing monitoring band.
- [x] Run the focused tests and commit the observability slice.

### Task 3: Ten-Project Non-Billing Acceptance Gate

**Files:**
- Create: `scripts/verify-video-workbench-pilot.mjs`
- Modify: `package.json`
- Test: `test/video-workbench-pilot-verifier.test.mjs`

- [x] Write a failing verifier contract test requiring ten unique projects to reach approved-asset plus bound-shot readiness with zero provider/billing tables changed.
- [x] Run the contract test and confirm the verifier is absent.
- [x] Implement the isolated verifier using an in-memory database and authoritative uploaded-asset imports.
- [x] Assert funnel/SLO output, no video jobs, and no usage or wallet mutations.
- [x] Run the verifier twice to prove deterministic isolation and commit it.

### Task 4: Verification and Default-Closed Production Delivery

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md`

- [x] Run focused rollout, route, store, admin, client, model, and UI tests.
- [x] Run `npm test`, `npm run check`, `npm run build`, and `git diff --check`.
- [x] Run the ten-project verifier and local owner/tester route acceptance for owner visibility plus tester invisibility. Existing P1 browser acceptance covers the workbench UI; the optional Playwright daemon was unavailable in this environment, so no paid browser generation was attempted.
- [ ] Deploy only through `scripts/deploy-production.ps1` with the global workbench flag still false.
- [ ] Run the full canary and online read-only verification; do not submit a paid video generation.
- [ ] Record commit, release, rollback, test counts, verifier output, and the exact condition required before enabling the owner pilot.

## Definition of Done

- The owner cohort is enforced server-side on discovery and execution.
- Ten isolated projects reach pre-generation storyboard readiness without provider or billing activity.
- Owner monitoring shows workbench funnel, stale data, 24-hour success rate, and p95 latency.
- Production remains default-closed and independently reversible.
