# Structured Ecommerce Engine Task 9 Report

## Implementation

- Added `server/ecommerceEngine/assetUpload.mjs` with an injectable upload service and thin Express handler.
- Accepted JSON data URLs or raw Base64, decoded them with strict byte limits, and used Sharp metadata/decode limits to determine the actual JPEG/PNG MIME, dimensions, and safety.
- Preserved original JPEG/PNG buffers byte-for-byte in stable generated-asset storage.
- Created deterministic, separately identified WebP previews capped at 512 pixels without exposing storage names or filesystem paths.
- Persisted owner-scoped upload records and upload idempotency responses in SQLite.
- Added `server/ecommerceEngine/exportService.mjs` with an injectable deterministic export service and thin Express handler.
- Recomputed versioned platform targets from the server policy, fingerprinted the target and transform, and rejected client paths, pricing, facts, unknown fields, tampered dimensions, and arbitrary Sharp options.
- Applied fixed Sharp crop/contain/resize/format settings, flattened white-background roles onto white, and verified final dimensions, format, byte limit, and role metadata before persistence.
- Persisted owner/source/target transform idempotency and public export metadata in SQLite.
- Supported owner-scoped exports from both uploaded originals and stable Task 8 generated job assets, including content-hash collisions across different ownership sources.
- Registered authenticated `POST /api/ecommerce/assets` and `POST /api/ecommerce/exports` routes without changing the frontend.
- Reused `generatedAssets.mjs` unchanged because its existing content-addressed `persistBuffer` and `read` APIs already preserve exact bytes and provide stable public URLs.

## TDD evidence

Initial RED:

```powershell
node --test --test-concurrency=1 test/ecommerce-asset-upload.test.mjs test/ecommerce-export.test.mjs
```

Expected failure: both production modules were absent.

Upload GREEN:

```powershell
node --test --test-concurrency=1 test/ecommerce-asset-upload.test.mjs
```

Result: 8 passed, 0 failed.

Export ownership collision RED/GREEN:

- Added a regression where another owner uploaded the same content hash that the signed owner owned through a generated job.
- The test first failed with `ASSET_OWNER_MISMATCH`.
- After resolving ownership across both persisted sources, `test/ecommerce-export.test.mjs` passed 8/8.

Brief verification:

```powershell
node --test --test-concurrency=1 test/ecommerce-asset-upload.test.mjs test/ecommerce-export.test.mjs test/image-input.test.mjs
```

Result: 19 passed, 0 failed.

Adjacent regression:

```powershell
node --test --test-concurrency=1 test/generated-assets.test.mjs test/platform-policies.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-orchestrator.test.mjs test/api-contract.test.mjs
```

Result: 63 passed, 0 failed.

Full regression:

```powershell
npm test
```

Result: 395 passed, 0 failed.

Completion checks:

```powershell
node --check server/ecommerceEngine/assetUpload.mjs
node --check server/ecommerceEngine/exportService.mjs
node --check server/index.mjs
npm run build
git diff --check
```

Result: syntax checks passed, export verification passed, Vite production build passed, and no whitespace errors were reported.

## Concerns

- Upload transport remains the requested JSON data URL/raw Base64 path. The existing 30 MB Express JSON limit and the service's 15 MB decoded-image limit intentionally leave Base64 overhead headroom.
- White-background role enforcement deterministically flattens transparency onto white and verifies the output contract; semantic subject segmentation remains the responsibility of the existing generation/quality pipeline.
- `RTK.md`, referenced by the supplied `AGENTS.md` instructions, was not present in the repository or hidden file index during this task.

## Review follow-up fixes

### Implementation

- Added deterministic, versioned `targetId`, `targetVersion`, `policyVersion`, and fingerprint metadata to every server Asset Plan export target.
- Changed export execution to accept only `sourceAssetId`, `targetId`, and optional `jobId`; complete client-supplied platform target objects and arbitrary transform fields are rejected.
- Added the minimal Task 9-specific `ecommerce_export_targets` SQLite registry keyed by owner, source asset, optional job, and target ID.
- Resolved job-bound targets from the persisted owner-scoped ecommerce job orchestration snapshot and verified that the stable source belongs to the matching Asset Plan item.
- Preserved idempotency over owner, source asset, target ID/fingerprint, and transform version.
- Decoded the final encoded export and reused aligned quality-gate thresholds to verify whole-image near-white coverage and edge whiteness before persistence.
- Rejected opaque colored backgrounds for `white_background` with `EXPORT_WHITE_BACKGROUND_INVALID`; compliant representative white-background images continue to pass.
- No paid frontend files or generalized workflow abstractions were changed.

### RED evidence

Target binding and white-background regressions were written before the production fixes:

```powershell
node --test --test-concurrency=1 test/ecommerce-export.test.mjs test/ecommerce-asset-planner.test.mjs
```

Result: expected RED with 10 failures because Asset Plan targets had no `targetId` and exports still trusted complete client target objects.

After the target binding implementation, the focused policy/planner/export run isolated the second review gap:

```powershell
node --test --test-concurrency=1 test/ecommerce-export.test.mjs test/ecommerce-asset-planner.test.mjs test/platform-policies.test.mjs
```

Result: 25 passed, 1 failed. The remaining intended RED was `rejects an opaque colored image for white_background without persisting an export`, failing with `Missing expected rejection`.

### GREEN and regression evidence

Focused GREEN:

```powershell
node --test --test-concurrency=1 test/ecommerce-export.test.mjs test/ecommerce-asset-planner.test.mjs test/platform-policies.test.mjs test/ecommerce-quality-gate.test.mjs
```

Result: 40 passed, 0 failed.

Task 9 brief verification:

```powershell
node --test --test-concurrency=1 test/ecommerce-asset-upload.test.mjs test/ecommerce-export.test.mjs test/image-input.test.mjs
```

Result: 21 passed, 0 failed.

Adjacent regression:

```powershell
node --test --test-concurrency=1 test/platform-policies.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-orchestrator.test.mjs test/generated-assets.test.mjs
```

Result: 68 passed, 0 failed.

Full regression:

```powershell
npm test
```

Result: 397 passed, 0 failed.

Completion checks:

```powershell
node --check server/ecommerceEngine/platformPolicies.mjs
node --check server/ecommerceEngine/exportService.mjs
node --check server/ecommerceEngine/qualityGate.mjs
node --check server/index.mjs
npm run build
git diff --check
```

Result: all syntax checks passed, export verification passed, Vite production build passed, and no whitespace errors were reported.

### Follow-up concerns

- The target registry is deliberately Task 9-specific rather than a generic workflow system.
- White-background compliance is a deterministic pixel-contract check aligned with the existing quality gate; it does not attempt semantic foreground segmentation.
- Follow-up recovery confirmed that `RTK.md` is present and was read in full; the earlier absence note above reflects only the first implementation session.
