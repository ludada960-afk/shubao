# AI Video P2 Replay Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development`, `superpowers:executing-plans`, and `superpowers:verification-before-completion` task by task.

**Goal:** Create the first exact-replay primitive for the owner-gated video workbench: an immutable, versioned manifest that records the approved project inputs and resolved execution context without starting generation or changing billing.

**Architecture:** Reuse the existing video workbench store and owner cohort gate. A replay manifest is a server-created snapshot of one project graph, with canonical JSON and a content hash. It contains source asset/version provenance, shot bindings, candidate selections, timeline clips, Skill identity/version, model catalog snapshot, and explicit rights confirmations. The manifest is read-only after creation and is never inferred from browser state.

## Scope and invariants

- Default-off workbench and owner cohort rules remain unchanged.
- Manifest creation requires an eligible owner and an existing video project.
- Creation never submits a provider job, creates a billing quote/hold, or mutates a wallet.
- A manifest is immutable, owner-scoped, schema-versioned, and hash-addressed.
- Missing project graph data or missing rights confirmations fails closed with a repairable error.
- Playback URLs are delivery projections and are not authoritative replay inputs.

## Tasks

### 1. Canonical manifest contract

- [x] Write failing tests for deterministic canonicalization, required graph fields, rights validation, and hash stability.
- [x] Implement manifest normalization, canonical JSON, SHA-256 hash, and safe metadata limits.

### 2. Durable owner-scoped storage

- [x] Write failing store tests for create/read, duplicate hash reuse, owner isolation, and immutable records.
- [x] Add the manifest table and store methods without changing existing workbench rows.

### 3. Authenticated workbench endpoint

- [x] Write failing route/client tests for owner creation/read, tester denial, and no billing/provider writes.
- [x] Add `POST /api/video/projects/:projectId/workbench/replay-manifests` and `GET /api/video/projects/:projectId/workbench/replay-manifests/:manifestId`.
- [x] Add a small client service used by the existing owner workbench; no public UI exposure until the manifest contract is verified.

### 4. Verification and release gate

- [x] Run focused replay tests, full regression, check, build, and the non-billing pilot verifier.
- [x] Verify owner/tester HTTP behavior and assert provider/billing tables are unchanged.
- [x] Deploy only through `scripts/deploy-production.ps1`, run the canary, and record the release before starting clone/remix work. Release `5b80bcd` completed the full 600-second canary with stable PM2 PID `2802100`; public health, 117-image gallery, two-product video contract, authenticated non-billing video canaries, billing verification, and ecommerce stable-asset checks passed. The wrapper's post-restart token capture now uses the bounded SSH helper covered by `test/production-canary-issuer.test.mjs`.

## Exit gate

Two distinct project graphs produce two distinct manifests; repeating a request for the same graph reuses the same hash-addressed record. A later Skill/catalog update does not alter an existing manifest, and a tester cannot read or create one.
