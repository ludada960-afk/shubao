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

- [ ] Run the full repository regression, static check, production build and diff check.
- [ ] Run the non-billing workbench verifier and confirm no provider/billing writes.
- [ ] Deploy only through `scripts/deploy-production.ps1`, keep the feature default-off,
  and pass the full canary plus independent video/billing/gallery checks.

## Follow-up boundary

The next P2 slice is the declarative SkillRun/project-memory executor. It must
consume this clone graph as an input, record every plan/asset/shot decision in a
versioned project event log, and expose human confirmation points before any
provider submission. Automatic generation, model routing and public "做同款"
UI remain out of this slice.
