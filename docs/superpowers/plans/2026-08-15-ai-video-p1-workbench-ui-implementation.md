# AI Video P1 Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion` task by task.

**Goal:** Deliver a default-off, owner-scoped P1 project workbench around the existing standalone `VideoStudio` generator.

**Architecture:** Extend the trusted server bridge so immutable asset versions are imported from authoritative video assets. Add signed project/workbench clients, pure projection helpers, and one incremental React workbench. Keep provider submission and billing unchanged.

## Task 1: Authoritative Upload-to-Asset-Version Bridge

- [ ] Add failing store tests proving foreign, missing, incomplete, and hashless video assets cannot become versions.
- [ ] Add failing route tests proving forged stable URL/hash/MIME fields are ignored.
- [ ] Implement `addAssetVersionFromVideoAsset` in `server/videoWorkbenchStore.mjs`.
- [ ] Change the version route in `server/videoWorkbenchRoutes.mjs` to accept only `videoAssetId` plus metadata.
- [ ] Run `node --test test/video-workbench-store.test.mjs test/video-workbench-routes.test.mjs`.
- [ ] Commit only the store, route, tests, and progress ledger.

## Task 2: Capability and Project Clients

- [ ] Add a failing cutover test for `workbenchEnabled` in `/api/video/capabilities`.
- [ ] Add failing project-client tests for signed list/get and malformed responses.
- [ ] Add `listProjects` and `getProject` to `src/services/projects.js`.
- [ ] Return `workbenchEnabled` from `server/index.mjs` using the existing flag.
- [ ] Run cutover, project-client, and API-contract tests.
- [ ] Commit explicit files and progress ledger.

## Task 3: Workbench Client

- [ ] Create failing tests for every signed workbench endpoint, encoded IDs, request bodies, response validation, and 401 invalidation.
- [ ] Implement `src/services/videoWorkbench.js`.
- [ ] Prove asset-version import sends `videoAssetId` only and candidate import sends `generationJobId` only.
- [ ] Run `node --test test/video-workbench-client.test.mjs test/project-client.test.mjs`.
- [ ] Commit explicit files and progress ledger.

## Task 4: Pure Workbench Projection Model

- [ ] Add failing tests for project filtering/sorting, next positions, completed-upload filtering, semantic defaults, approved versions, selected candidates, and timeline summary.
- [ ] Implement `src/pages/VideoStudio/videoWorkbenchModel.js` without React or I/O.
- [ ] Run `node --test test/video-workbench-model.test.mjs`.
- [ ] Commit explicit files and progress ledger.

## Task 5: Workbench React Surface

- [ ] Add a failing static UI contract test for real commands, stage order, accessibility labels, no provider/model controls, and no homepage embedding.
- [ ] Implement `src/pages/VideoStudio/VideoProjectWorkbench.jsx` and `VideoProjectWorkbench.css`.
- [ ] Every mutation reloads the authoritative projection and protects against stale async project responses.
- [ ] Implement loading, empty, conflict, unavailable, stale, and retry states.
- [ ] Use intrinsic-ratio media and stable control dimensions.
- [ ] Run UI contract and workbench model/client tests.
- [ ] Commit explicit files and progress ledger.

## Task 6: VideoStudio Integration

- [ ] Add a failing integration contract for standalone flag gating and current upload/job/settings inputs.
- [ ] Integrate the component into `src/pages/VideoStudio/index.jsx` only for `!embedded && capabilities.workbenchEnabled`.
- [ ] Rename the legacy result wrapper class if needed to avoid styling collision.
- [ ] Run VideoStudio, upload, generation, cutover, and UI-focused regression.
- [ ] Commit explicit files and progress ledger.

## Task 7: Quality Gates and Local Browser Acceptance

- [ ] Run focused P1 server/client/model/UI suites.
- [ ] Run `npm test`.
- [ ] Run `npm run check` and `npm run build`.
- [ ] Run `git diff --check` and inspect staged files explicitly.
- [ ] Start the local server with the flag enabled and verify desktop plus 390px mobile: no overflow, project creation, asset import/approval, shot creation/binding, candidate import/select, and timeline addition.
- [ ] Confirm browser workbench actions trigger no provider generation and no wallet mutation.

## Task 8: Production-Safe Delivery

- [ ] Merge the current production head before deployment and rerun every gate.
- [ ] Keep the public workbench flag off unless the owner-cohort gate exists and its acceptance is complete.
- [ ] Deploy only with `scripts/deploy-production.ps1`.
- [ ] Verify health, PM2/Nginx release, public bundle, existing ecommerce/video contracts, default-off route behavior, and deployment lock release.
- [ ] Record exact commit, tests, build, deployment version, public verification, non-paid status, rollback target, and remaining P2 gate in `.superpowers/sdd/progress.md` and `RTK.md`.

## Definition of Done

- The six-step P1 workbench flow persists through refresh using only authoritative server records.
- No new paid generation or billing path exists in the workbench.
- Existing homepage video composition remains unchanged.
- The feature is default-off and independently reversible.
- All focused/full/build/browser/deployment evidence is recorded before any shipped claim.
