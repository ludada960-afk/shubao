# AI Video P2 Clone/Remix Implementation Plan

> This slice extends the owner-gated replay manifest into a safe "做同款" primitive.

## Goal

Let an eligible owner create a new editable video draft from an immutable replay
manifest. The clone must preserve the source project's creative graph and
provenance while never submitting a provider request or mutating billing.

## Contract

- The source project and replay manifest are owner-scoped; foreign or missing
  records return the existing generic not-found response.
- The persisted manifest JSON and its SHA-256 hash are verified before any clone
  row is written. Tampering fails closed with `REPLAY_MANIFEST_INTEGRITY_INVALID`.
- A clone contains a new video project, an initial project version, asset/version
  rows, shot bindings, candidate selections and timeline clips. Stable media
  provenance remains reusable; generation job IDs are intentionally cleared so
  a clone cannot masquerade as a provider delivery.
- The request requires an `Idempotency-Key`. A replay returns the original clone
  with HTTP 200; the first successful clone returns HTTP 201.
- The clone writes no provider job, generation run, usage event, wallet entry,
  quote or billing hold. It remains a draft until the normal generation path is
  explicitly started.
- The route remains behind the existing owner cohort and default-off workbench
  gate. No public UI flag is opened by this change.

## Tasks

### 1. Store and integrity boundary

- [x] Add failing tests for full graph cloning, idempotency and zero billing/provider writes.
- [x] Add failing tests for manifest tampering and foreign-owner isolation.
- [x] Implement an atomic owner-scoped clone with new IDs and source provenance.

### 2. Authenticated API and client

- [x] Add the authenticated clone route with signed owner session and cohort gate.
- [x] Return the hydrated workbench projection for immediate editing.
- [x] Add a client helper with path validation, session signing and an idempotency key.
- [x] Verify first/replayed HTTP status semantics and missing-key failure.

### 3. Release gate

- [x] Run the full repository regression, static check, production build and diff check.
- [x] Run the non-billing workbench verifier and confirm no provider/billing writes.
- [x] Deploy only through `scripts/deploy-production.ps1`, keep the feature default-off,
  and pass the full canary plus independent video/billing checks.

Release evidence (2026-08-16): `816457a` passed the full `1658/1658` regression,
`npm run check`, the production build and `git diff --check`. The non-billing
workbench verifier reported 10 projects, 40/40 successful operations and no
provider/billing mutations. The release is active at
`/var/www/shubao/releases/20260816-184541-816457a` with PM2 PID `2824932`;
the authenticated production video contract and billing verifier passed and the
600-second application canary remained healthy. The deployment wrapper lost its
SSH lock channel after the canary and correctly refused an unfenced rollback;
the active symlink and PM2 process were independently read-only verified after
the wrapper exited, and the remote lock is free. A subsequent standalone gallery
probe reported one existing image-delivery edge case (`jk/01-封面.png`,
`thumb/webp`, HTTP 500); this commit does not touch gallery code or assets and
the local source decodes and renders successfully, so it is tracked separately
from this video release rather than silently attributed to the clone feature.

## Follow-up boundary

The next P2 slice is the declarative SkillRun/project-memory executor. It must
consume this clone graph as an input, record every plan/asset/shot decision in a
versioned project event log, and expose human confirmation points before any
provider submission. Automatic generation, model routing and public "做同款"
UI remain out of this slice.
