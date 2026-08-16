# AI Video P1 Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion` task by task.

**Goal:** Deliver a default-off, owner-scoped P1 project workbench around the existing standalone `VideoStudio` generator.

**Architecture:** Extend the trusted server bridge so immutable asset versions are imported from authoritative video assets. Add signed project/workbench clients, pure projection helpers, and one incremental React workbench. Keep provider submission and billing unchanged.

## Task 1: Authoritative Upload-to-Asset-Version Bridge

- [x] Add failing store tests proving foreign, missing, incomplete, and hashless video assets cannot become versions.
- [x] Add failing route tests proving forged stable URL/hash/MIME fields are ignored.
- [x] Implement `addAssetVersionFromVideoAsset` in `server/videoWorkbenchStore.mjs`.
- [x] Change the version route in `server/videoWorkbenchRoutes.mjs` to accept only `videoAssetId` plus metadata.
- [x] Run `node --test test/video-workbench-store.test.mjs test/video-workbench-routes.test.mjs`.
- [x] Commit only the store, route, tests, and progress ledger.

## Task 2: Capability and Project Clients

- [x] Add a failing cutover test for `workbenchEnabled` in `/api/video/capabilities`.
- [x] Add failing project-client tests for signed list/get and malformed responses.
- [x] Add `listProjects` and `getProject` to `src/services/projects.js`.
- [x] Return `workbenchEnabled` from `server/index.mjs` using the existing flag.
- [x] Run cutover, project-client, and API-contract tests.
- [x] Commit explicit files and progress ledger.

## Task 3: Workbench Client

- [x] Create failing tests for every signed workbench endpoint, encoded IDs, request bodies, response validation, and 401 invalidation.
- [x] Implement `src/services/videoWorkbench.js`.
- [x] Prove asset-version import sends `videoAssetId` only and candidate import sends `generationJobId` only.
- [x] Run `node --test test/video-workbench-client.test.mjs test/project-client.test.mjs`.
- [x] Commit explicit files and progress ledger.

## Task 4: Pure Workbench Projection Model

- [x] Add failing tests for project filtering/sorting, next positions, completed-upload filtering, semantic defaults, approved versions, selected candidates, and timeline summary.
- [x] Implement `src/pages/VideoStudio/videoWorkbenchModel.js` without React or I/O.
- [x] Run `node --test test/video-workbench-model.test.mjs`.
- [x] Commit explicit files and progress ledger.

## Task 5: Workbench React Surface

- [x] Add a failing static UI contract test for real commands, stage order, accessibility labels, no provider/model controls, and no homepage embedding.
- [x] Implement `src/pages/VideoStudio/VideoProjectWorkbench.jsx` and `VideoProjectWorkbench.css`.
- [x] Every mutation reloads the authoritative projection and protects against stale async project responses.
- [x] Implement loading, empty, conflict, unavailable, stale, and retry states.
- [x] Use intrinsic-ratio media and stable control dimensions.
- [x] Run UI contract and workbench model/client tests.
- [x] Commit explicit files and progress ledger.

## Task 6: VideoStudio Integration

- [x] Add a failing integration contract for standalone flag gating and current upload/job/settings inputs.
- [x] Integrate the component into `src/pages/VideoStudio/index.jsx` only for `!embedded && capabilities.workbenchEnabled`.
- [x] Rename the legacy result wrapper class if needed to avoid styling collision.
- [x] Run VideoStudio, upload, generation, cutover, and UI-focused regression.
- [x] Commit explicit files and progress ledger.

## Task 7: Quality Gates and Local Browser Acceptance

- [x] Run focused P1 server/client/model/UI suites.
- [x] Run `npm test`.
- [x] Run `npm run check` and `npm run build`.
- [x] Run `git diff --check` and inspect staged files explicitly.
- [x] Start the local server with the flag enabled and verify desktop plus 390px mobile: no overflow, project creation, asset import/approval, and shot creation/binding. Candidate import/select and timeline addition are covered by automated contract tests because a real provider result would spend credits.
- [x] Confirm browser workbench actions trigger no provider generation and no wallet mutation.

## Task 8: Production-Safe Delivery

- [x] Merge the current production head before deployment and rerun every gate.
- [x] Keep the public workbench flag off unless the owner-cohort gate exists and its acceptance is complete.
- [x] Deploy only with `scripts/deploy-production.ps1`.
- [x] Verify health, PM2/Nginx release, public bundle, existing ecommerce/video contracts, default-off route behavior, and deployment lock release.
- [x] Record exact commit, tests, build, deployment version, public verification, non-paid status, rollback target, and remaining P2 gate in `.superpowers/sdd/progress.md` and `RTK.md`.

## Definition of Done

- The six-step P1 workbench flow persists through refresh using only authoritative server records.
- No new paid generation or billing path exists in the workbench.
- Existing homepage video composition remains unchanged.
- The feature is default-off and independently reversible.
- All focused/full/build/browser/deployment evidence is recorded before any shipped claim.
