# AI Video P1 Workbench Domain Design

Status: proposed for user review

Roadmap: `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`

## 1. Goal

Create the additive, owner-scoped domain contract required for a shot-based video workbench without exposing a new UI, changing the current VideoStudio generation route, or triggering paid work.

This slice proves that Shubao can persist:

1. approved project asset versions;
2. ordered storyboard shots;
3. immutable shot-to-asset-version bindings;
4. multiple generated candidates with one explicit selection;
5. a minimal ordered timeline that references only selected candidates.

It is local incubation behind a default-off feature flag. Public release remains blocked by the P0 production observation gate.

## 2. Alternatives Considered

### A. Store the entire workbench as one project-version JSON snapshot

This is simple initially, but it makes owner-scoped queries, stale-dependency detection, candidate selection, billing attribution and concurrent updates fragile. It also encourages silent replacement of references inside a large document.

Decision: reject as the primary store. Project snapshots may contain projections for recovery, but normalized workbench records are authoritative.

### B. Reuse `video_assets` directly as semantic project assets

`video_assets` is a delivery/input file table. It does not represent a semantic identity such as “approved main character” or an immutable business version. Adding workbench semantics there would couple upload retention to project identity and make future non-video sources awkward.

Decision: reject. A workbench asset version may point to an existing `project_assets` record or stable media URL, while semantic state remains separate.

### C. Add normalized P1 records linked to existing projects (recommended)

Use additive tables and a focused store. Every record carries `owner_email` and `project_id`; versions are immutable; shot bindings pin versions; candidate selection is transactional; timeline clips can only reference selected candidates.

Decision: adopt. This follows the current SQLite/store patterns and leaves current production routes untouched.

## 3. Scope and Non-Goals

### In scope

- Add a default-off `VIDEO_PLATFORM_P1_WORKBENCH` flag.
- Add workbench schema and a focused `videoWorkbenchStore`.
- Owner-scoped create/read/update contracts for assets, versions, shots, bindings, candidates and timeline clips.
- Optimistic revision checks for mutable ordered structures.
- Stale-shot projection when an approved asset version changes.
- Transactional candidate selection and timeline eligibility.
- Store-level and route-level tests.

### Explicitly out of scope

- No React page, Canvas node or visible navigation.
- No provider submission, billing hold, settlement or refund.
- No automatic plan generation or director Agent.
- No video export, transcoding, trimming or waveform processing.
- No Skill executor or project memory.
- No gallery/process-preview publishing.
- No production flag enablement or deployment in the active shared release window.

## 4. Existing Foundation Reused

| Concern | Existing source of truth | P1 use |
|---|---|---|
| Project ownership | `projects` and `projectStore` | A workbench must attach to an owner-visible project of kind `video` |
| Media provenance | `project_assets` and `video_assets` | Asset versions store stable project-asset/media references, hashes and MIME metadata |
| Generation reliability | `video_jobs`, attempts, deliveries and outbox | A later slice may register a completed delivery as a candidate; P1 does not submit jobs |
| Billing | Existing wallet/quote/ledger | Candidate metadata may retain future job IDs, but P1 never changes money |
| HTTP ownership | Existing authenticated project routes | New routes use the same `authenticateOwner` pattern and never trust an email body field |
| Feature rollout | `server/config.mjs` flags | Routes are not mounted unless the P1 flag is explicitly enabled |

## 5. Data Model

### 5.1 `video_workbench_assets`

Represents a semantic project asset such as product, person, wardrobe, scene, prop, style, voice or music.

Required fields:

- `id`, `owner_email`, `project_id`
- `kind`: `product|person|wardrobe|scene|prop|style|voice|music`
- `name`
- `status`: `draft|approved|archived`
- `approved_version_id` nullable
- `revision` starting at 1
- timestamps

### 5.2 `video_workbench_asset_versions`

Immutable versions. A new correction creates another row; it never overwrites a version referenced by a shot.

Required fields:

- `id`, `asset_id`, `owner_email`, `project_id`
- `sequence` unique per asset
- `source_project_asset_id` nullable
- `stable_url`, `content_hash`, `mime_type`
- `metadata_json`
- `created_at`

Approving a version updates only `video_workbench_assets.approved_version_id`, increments the asset revision and marks shots bound to an older version as stale.

### 5.3 `video_storyboard_shots`

Ordered mutable shot cards.

Required fields:

- `id`, `owner_email`, `project_id`
- `position` integer, unique per project
- `purpose`, `duration_ms`, `camera_language`, `prompt`
- `status`: `draft|ready|generating|review|approved|stale|failed`
- `selected_candidate_id` nullable
- `revision`
- timestamps

`duration_ms` must be 500-60000. P1 accepts semantic camera language as text/JSON projection but does not translate it into provider fields.

`updateShot.patch` may change only `position`, `purpose`, `durationMs`, `cameraLanguage` and `prompt`. Shot status and selected candidate are system-managed and cannot be set through the generic patch route.

### 5.4 `video_shot_asset_bindings`

Pins a shot to one exact asset version.

Required fields:

- `shot_id`, `asset_id`, `asset_version_id`
- `role`: `subject|product|wardrobe|scene|prop|style|voice|music|first_frame|last_frame|motion_reference`
- `created_at`

Primary key: `(shot_id, role, asset_id)`. The store verifies owner/project consistency across all referenced rows.

### 5.5 `video_shot_candidates`

Records candidate outputs created elsewhere by the reliable P0 job path.

Required fields:

- `id`, `owner_email`, `project_id`, `shot_id`
- `generation_job_id` nullable
- `output_asset_id`, `stable_url`, `content_hash`, `mime_type`
- `status`: `available|selected|rejected|invalid`
- `created_at`

Registering a candidate is idempotent on `(shot_id, output_asset_id)`. Selecting a candidate runs in one transaction: prior selected candidates become `available`, the chosen row becomes `selected`, and the shot stores its ID and moves to `approved` unless the shot is stale.

### 5.6 `video_timeline_clips`

Minimal durable clip ordering, not a professional editor document.

Required fields:

- `id`, `owner_email`, `project_id`
- `shot_id`, `candidate_id`
- `position` integer, unique per project
- `trim_start_ms`, `trim_end_ms`, `muted`
- `status`: `active|stale`
- `revision`, timestamps

At creation time the candidate must be the shot's current selected candidate and the shot must not be stale. `trim_end_ms` cannot exceed the shot duration. If selection changes, existing clips for the previous candidate become `stale` in the same transaction and must be replaced explicitly; the store never silently swaps media. If an approved asset version makes a bound shot stale, its active timeline clips become stale in the same transaction.

## 6. State and Invariants

1. Every workbench row is owner- and project-scoped.
2. The referenced project must exist for that owner and have `kind = video`.
3. Asset versions are immutable.
4. A shot binding always pins an explicit version.
5. Approving a different asset version marks dependent shots stale; it does not rewrite bindings.
6. Only one candidate per shot may be selected.
7. A new active timeline clip may reference only a non-stale shot's current selected candidate.
8. Changing selection never silently rewrites a timeline clip; prior clips become stale transactionally.
9. Ordered writes are transactional and reject duplicate positions.
10. Mutable records require `expectedRevision`; a mismatch returns `VERSION_CONFLICT`.
11. Deleting/archiving a source asset never deletes completed outputs automatically.
12. Feature disabled means no P1 route is mounted; existing routes and schema reads remain unchanged.
13. Generic shot edits cannot forge lifecycle status, candidate selection or ownership.

## 7. Service Interface

`createVideoWorkbenchStore({ db, projectStore, now, idFactory })` produces:

```js
{
  createAsset({ ownerEmail, projectId, kind, name }),
  addAssetVersion({ ownerEmail, projectId, assetId, sourceProjectAssetId, stableUrl, contentHash, mimeType, metadata }),
  approveAssetVersion({ ownerEmail, projectId, assetId, versionId, expectedRevision }),
  createShot({ ownerEmail, projectId, position, purpose, durationMs, cameraLanguage, prompt }),
  updateShot({ ownerEmail, projectId, shotId, expectedRevision, patch }),
  bindShotAssetVersion({ ownerEmail, projectId, shotId, assetId, assetVersionId, role }),
  registerCandidate({ ownerEmail, projectId, shotId, generationJobId, outputAssetId, stableUrl, contentHash, mimeType }),
  selectCandidate({ ownerEmail, projectId, shotId, candidateId, expectedRevision }),
  addTimelineClip({ ownerEmail, projectId, shotId, candidateId, position, trimStartMs, trimEndMs, muted }),
  listWorkbench({ ownerEmail, projectId })
}
```

Errors use stable codes: `PROJECT_NOT_FOUND`, `WORKBENCH_ASSET_NOT_FOUND`, `ASSET_VERSION_NOT_FOUND`, `SHOT_NOT_FOUND`, `CANDIDATE_NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_BINDING`, `INVALID_TIMELINE_CANDIDATE`, `INVALID_POSITION`, `INVALID_DURATION`.

## 8. HTTP Contract

Routes mount under `/api/video/projects/:projectId/workbench` only when `VIDEO_PLATFORM_P1_WORKBENCH=true`.

- `GET /` returns the full owner-scoped projection.
- `POST /assets`
- `POST /assets/:assetId/versions`
- `POST /assets/:assetId/approve`
- `POST /shots`
- `PATCH /shots/:shotId`
- `POST /shots/:shotId/bindings`
- `POST /shots/:shotId/candidates`
- `POST /shots/:shotId/select`
- `POST /timeline/clips`

All writes reject body/query owner identifiers. Authentication supplies ownership. The route layer maps stable store errors to 400, 404 or 409 and does not expose raw SQL errors.

## 9. UX Projection for the Later UI Slice

The default user flow remains simple:

1. describe the video or choose one of three templates;
2. review approved asset cards;
3. review ordered shot cards and cost range;
4. generate low-resolution candidates through the existing reliable job path;
5. select one candidate per shot;
6. send selected clips to a simple timeline;
7. enhance/export only chosen clips.

Provider/model fields are not part of the default card surface. A later advanced drawer may show them. Mobile supports review, selection and approval; dense timeline editing remains desktop-first.

## 10. Failure Handling

- Owner mismatch is indistinguishable from missing data.
- Revision conflict returns the current record so the client can refresh deliberately.
- Candidate registration does not imply billing success; a later integration must verify the P0 delivery before calling it.
- Asset approval, stale-shot marking and affected timeline-clip invalidation occur in one transaction.
- Candidate selection and prior timeline-clip invalidation occur in one transaction.
- If an input project asset is deleted later, the immutable version and hash remain as provenance; UI repair is a later slice.
- No background callback may mutate a deleted project without checking owner/project state.

## 11. Test Strategy

Store tests use an in-memory SQLite database with the real project schema and store. They prove:

- owner isolation and video-project validation;
- immutable asset version sequences;
- stale-shot behavior after asset approval changes;
- explicit pinned bindings;
- idempotent candidate registration;
- transactional single selection;
- timeline eligibility, durable stale state and no silent candidate replacement;
- optimistic revision conflicts;
- stable ordering validation.

Route tests use a minimal Express-compatible harness consistent with existing route tests. They prove routes are absent when the flag is off, derive owner from authentication, map errors without leaking SQL, and return the expected projection.

No test calls a provider, uploads to production storage, charges points, or requires network access.

## 12. Rollout and Rollback

1. Add the flag with a default of `false` because this is a future-stage incubation surface.
2. Create additive tables the first time the default-off workbench is enabled; no existing table is rewritten.
3. Keep routes unmounted in production until P0 production gates pass.
4. First enable only for an internal account cohort in a later release.
5. Rollback by disabling the flag. Additive records remain for audit and can be migrated forward; no destructive rollback is required.

## 13. Self-Review

- No placeholder requirements remain.
- The scope is one service boundary and does not mix UI, provider routing, billing or export.
- Asset, shot, candidate and timeline identifiers are consistent across schema and service contracts.
- The design preserves existing project, media, billing and video-job sources of truth.
- Public exposure is explicitly blocked until the prior production gate succeeds.
