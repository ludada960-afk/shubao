# AI Video Platform Long-Term Execution Roadmap

> **For agentic workers:** Each stage is an independent product increment. Before changing code for a stage, write and approve a stage-specific design and implementation plan, then use `superpowers:executing-plans` task by task. Checkboxes in this document track program gates, not individual coding steps.

**Goal:** Turn Shubao from a collection of one-shot video model forms into a reliable, reusable AI video production system built around projects, approved assets, shots, versioned generation attempts, a timeline, and replayable workflows.

**Architecture:** Extend the existing project, video queue, billing, generated-asset, and gallery systems instead of creating a second platform. The long-lived domain chain is `Project -> SkillRun -> Plan -> AssetVersion -> StoryboardShot -> GenerationJob/Attempt -> SelectedVersion -> TimelineClip -> Export`; every transition is durable, idempotent, observable, and reversible where billing is involved.

**Tech Stack:** React 18, Vite 6, Node.js ESM, Express 4, better-sqlite3, Sharp, existing provider adapters and billing ledger, object storage/CDN-compatible media URLs, Node test runner, browser QA, and `scripts/deploy-production.ps1`.

## 1. Feasibility Decision

The program is feasible, but only as a staged platform build.

| Capability | Feasibility | Reason | Release condition |
|---|---|---|---|
| Durable jobs, recovery, refunds, media proxies | High | Shubao already has project, queue, billing, and generated-asset primitives | Platform state and billing invariants pass fault-injection tests |
| Asset library, storyboard, per-shot candidates, basic timeline | High | The current Canvas and video workbench provide most interaction primitives | A three-shot project survives refresh/restart and exports |
| Replayable declarative Skills and project memory | Medium-high | The workflow can be represented as a guarded DAG, but requires schema/version governance | Two production templates replay from stored inputs without hidden prompt state |
| Per-second reshoot, tracked replacement, long extension | Medium | Depends on provider capabilities and stable media-coordinate contracts | At least one provider passes a real capability canary and a full-shot fallback exists |
| Fully autonomous long-film director | Low as a near-term promise | Identity continuity, provider variance, cost, moderation, and human taste remain irreducible | Never marketed as deterministic; remains an assisted workflow with approval gates |

### Rejected approaches

1. **Model-wrapper expansion:** adding more model dropdowns and prompt forms is fast, but does not solve result loss, continuity, reuse, or cost control.
2. **Full competitor clone in one release:** it creates too many coupled failure modes and makes billing, task recovery, and media performance impossible to isolate.
3. **Recommended staged platform:** reliability first, then shot-based production, then reusable Skills, then advanced editing. Every stage produces usable customer value and has an explicit stop gate.

## 2. Product Contract

### 2.0 Reference architecture decision

The product skeleton is fixed as follows so later implementation does not drift into another model-selection form:

| Layer | Reference | What Shubao adopts | Boundary |
|---|---|---|---|
| Product and domain skeleton | Flova | Project memory, approved asset versions, shot dependencies, storyboard, timeline, visible workflow history, replayable Skills | Flova is a product reference, not a code dependency |
| Spend and approval UX | Runway Agent | Show and review the plan before paid generation; choose models by capability; keep per-shot candidates and an integrated final cut | Provider/model detail stays behind an advanced disclosure |
| Discovery and growth loop | TapNow/TapTV | Final work -> creation-process preview -> read-only project -> clone/remix | Private inputs are never copied across owners |
| Local/open execution option | LTX Desktop, ComfyUI, Wan | Isolated worker/API candidates for proven workflows, previews, and capability canaries | Never make their node UI the normal-user product; license, weights, security, and operations require separate gates |
| Existing Shubao foundation | VideoStudio, Canvas, projects, billing, gallery | Reuse the existing single-shot generator, project/version store, media delivery, billing ledger, and recipe replay | No second queue, wallet, project store, or gallery publisher |

This choice is deliberately asymmetric: Flova supplies the product model; Runway and TapNow supply selected interaction patterns; open-source projects may supply isolated execution components only after a build-versus-buy review.

### 2.1 What the user sees

- A **project** remembers approved people, products, wardrobe, scenes, props, style, voice, music, prompts, models, and output versions.
- A **plan** turns an intent into reviewable shots and an estimated cost range before paid generation begins.
- A **shot** can have several candidates; selecting one changes downstream work, while rejected candidates remain recoverable until retention expiry.
- A **timeline** contains only selected versions and supports reorder, trim, audio, subtitle, and export without hiding which source created a clip.
- A **Skill** is a reusable workflow with declared inputs, steps, cost ceiling, approval points, output contract, and failure compensation. The interface never tells users that an internal repository was “wrapped.”
- **Do the same** restores the actual reference assets, prompt, parameters, product/model snapshot, shot structure, and selected versions. It does not reconstruct a workflow from a short display title.

### 2.2 What the platform guarantees

- A client retry cannot create a duplicate paid task.
- A provider-accepted task is never silently submitted to another provider.
- A completed upstream result is persisted before points settle.
- A terminal failure releases the full hold; settlement/release is idempotent.
- Refresh, disconnect, process restart, and delayed webhooks do not lose the task state.
- Source media becomes visible from a local object URL after decode; cloud persistence does not block the first preview.
- Provider quality is not guaranteed, but platform state, billing accuracy, recovery, and error visibility are.

## 3. Domain Boundaries

| Unit | Responsibility | Existing foundation | Required extension |
|---|---|---|---|
| Project | Ownership, lifecycle, collaborators, retention | `server/projects/*` | Video project kind, memory snapshot, export references |
| Asset | Original media and approved semantic identity | `server/generatedAssets.mjs` | `Asset` plus immutable `AssetVersion`, proxy and authorization metadata |
| Plan | Reviewable generation strategy and budget | `server/videoPlanning.mjs` | Versioned plan, approval state, cost floor/ceiling |
| Shot | Narrative purpose and bound assets | none as first-class entity | Shot order, duration, camera language, bindings, first/last frame, audio beat |
| Job | Durable provider orchestration | `server/generationJobs.mjs`, `server/videoQueue.mjs` | Attempt log, idempotency key, outbox, lease, recovery classification |
| Provider | Capability validation and normalized transport | `server/videoProviders.mjs`, `server/videoCatalog.mjs` | Capability registry, health score, route policy, fallback-before-acceptance only |
| Billing | Quote, hold, settle, release, unit economics | `server/billing/*` | Per-shot attribution, successful-second cost, compensation reconciliation |
| Timeline | Selected clips and export order | Canvas/video UI primitives | Durable clips, trim, track order, subtitle/audio bindings, export state |
| SkillRun | Declarative workflow execution | `server/visualCreationSkills.mjs` | Versioned DAG, guards, approval gates, budget limit, compensation |
| Gallery recipe | Discovery and exact workflow replay | `server/galleryCatalog.mjs`, gallery remix models | Process preview, complete provenance, clone/remix contract |

## 4. Program Metrics

These metrics separate platform reliability from provider output quality.

| Metric | Stage 0 exit target | Mature target |
|---|---:|---:|
| Duplicate paid submissions caused by Shubao | 0 | 0 |
| Billing mismatch across hold/settle/release | 0 | 0 |
| Terminal failures automatically released | 100% | 100% |
| Accepted jobs recoverable after process restart | 100% in fault tests | >= 99.9% observed |
| Jobs with an unexplained terminal state | 0 | 0 |
| Local media preview after browser decode | < 300 ms | < 200 ms |
| Gallery first viewport with decoded thumbnails | P75 < 1.5 s on a warm CDN | P75 < 1.0 s |
| Internal orchestration availability | >= 99.5% | >= 99.9% |
| Provider success, by provider/model/input class | Measured, no invented target | Product-specific release gate |
| Cost attribution coverage | 100% of paid attempts | 100% |
| “Do the same” recipe completeness | 100% required fields | 100% plus version compatibility |

Dashboards must break down success, first-frame time, delivery latency, retries, moderation failures, provider failures, persisted-output failures, refund latency, upstream cost, customer points, revenue, and contribution by provider, model, input type, duration, and resolution.

## 5. Stage 0: Reliable Media and Job Foundation

**Estimated effort:** 3-5 engineering weeks for one senior full-stack engineer, plus production observation. This stage is mandatory before new long-video features.

### Deliverables

- [x] **VID-P0-01 Media ingest, local implementation:** content hash, resumable upload session, owner authorization, stable delivery and project linkage are implemented. Browser-observed poster/proxy SLO remains a production gate.
- [x] **VID-P0-02 Job state machine, local implementation:** accepted, processing, persisting, settlement/release and review states have durable handling and compatibility reads.
- [x] **VID-P0-03 Idempotency and outbox, local implementation:** provider attempts and durable delivery events are persisted without duplicating paid side effects.
- [x] **VID-P0-04 Recovery, local implementation:** startup/admin reconciliation covers uncertain submissions, accepted tasks, persisted deliveries, and billing compensation.
- [x] **VID-P0-05 Provider capability registry, local implementation:** server-side validation and routing remain the source of truth.
- [x] **VID-P0-06 Operations, local implementation:** owner/admin reads, attempt history, outbox state, reconciliation operations, and project bridge are feature-gated.
- [x] **VID-P0-07 Fault suite, local evidence:** the P0 test suite and full regression pass locally without paid generation.

**Status note (2026-08-15):** the P0 code slice is complete on the local feature branch. It is not a production-complete claim. Production deployment, flag rollout, browser timing evidence, controlled restart recovery, and observation-window metrics are still pending. P1 must not be exposed publicly until those exit gates pass.

### Stage 0 exit gate

- All fault tests prove no duplicate submission, no lost result, and no billing mismatch.
- A production canary survives a controlled backend restart while processing.
- Every visible failed task states whether points are held, released, or settled and offers only a deliberate valid retry.
- Admin unit economics reports customer revenue, upstream cost, contribution, and contribution margin for every completed video attempt.
- No Stage 1 work ships while any accepted task can end as an unrecoverable unknown.

## 6. Stage 1: Shot-Based Video Workbench MVP

**Estimated effort:** 5-8 engineering weeks after Stage 0.

### Scope

- [ ] **VID-P1-01 Asset library:** people/products, wardrobe, scenes, props, style, voice, and music; each selection pins an immutable version.
- [ ] **VID-P1-02 Storyboard:** ordered shot cards with purpose, duration, camera language, bound assets, first/last frame, audio beat, prompt, model intent, and cost estimate.
- [ ] **VID-P1-03 Three templates only:** product advertisement, image-to-video short, and first/last-frame short. Each uses the same shot/job contracts.
- [ ] **VID-P1-04 Human approval:** plan approval before paid work; per-shot candidate approval before a version enters the timeline.
- [ ] **VID-P1-05 Basic timeline:** reorder, trim, mute, voice/music placement, subtitle track, preview proxy, and export. Complex multi-track effects remain out of scope.
- [ ] **VID-P1-06 Selective recovery:** retry or replace one failed shot without regenerating successful shots.
- [ ] **VID-P1-07 Cost guard:** show estimated range and maximum authorization before generation; stop automatically at the approved ceiling.

**Status note (2026-08-19):** the local cost-guard contract is implemented: a nullable non-negative integer
budget cap is carried through the plan fingerprint, strict preflight, approval, and generation-draft replay;
the server rejects over-cap approval/draft compilation and the UI clears stale plan state when the cap changes.
The estimate remains visible as the real quote, and local acceptance proves zero provider/billing mutation. The
checkbox remains open until the renderer worker enforces the same ceiling at actual settlement and the Stage 1
release evidence exists.

**Status note (2026-08-18):** the first `VID-P1-05` export sub-slice is complete locally: an owner/project-scoped,
content-hashed export manifest can be created idempotently from the current non-stale selected timeline,
approved audio versions, subtitles, and bounded delivery options. It deliberately stops before a renderer,
provider submission, download URL, or billing mutation. The full timeline/export checkbox remains open until a
renderer worker, proxy/asset delivery, restart recovery, and the Stage 1 exit evidence are implemented.

The same local slice now fails closed on read: persisted JSON, schema version, kind, and database hash are recomputed
before an export manifest is returned. A tampered or partially written row is surfaced as a controlled integrity
error instead of being presented as a deliverable. This remains local-only and is not a renderer, provider, or
production deployment.

The next handoff boundary is also implemented locally: an export manifest can be frozen into an owner/project-scoped,
SHA-256 keyed `video_export_job` in `waiting_renderer`, with idempotent creation and guarded transitions through
`rendering`, `failed`, retry, `canceled`, and `completed`. The store re-builds the current manifest before handing a
job to a renderer, so timeline edits make the handoff stale instead of silently exporting an old cut. Persisted job
rows fail closed on hash/state/provider/billing flags, and the API exposes only queue/read operations; there is still
no renderer worker, provider submission, download URL, usage, wallet, or billing mutation. This is a local contract
for the next renderer implementation, not a shipped video export feature.

### Stage 1 exit gate

- A three-shot product advertisement can be created, refreshed, resumed after restart, selectively retried, assembled, and exported.
- Changing an asset version marks dependent shots stale rather than silently mixing identities.
- A selected candidate remains the exact clip used after refresh and export.
- Mobile supports review and approval; dense timeline editing may remain desktop-first.
- At least ten internal projects complete without a platform-state or billing failure before public beta.

## 7. Stage 2: Declarative Skills, Memory, and Replay

**Estimated effort:** 4-7 engineering weeks after Stage 1 usage produces real workflow evidence.

### Skill manifest contract

Every Skill version declares:

```json
{
  "id": "product-ad-v1",
  "version": 1,
  "inputSchema": {},
  "steps": [],
  "guards": [],
  "modelPolicy": {},
  "budgetPolicy": { "currency": "ai_points", "capSource": "locked_server_quote" },
  "approvalGates": [],
  "outputContract": {},
  "compensation": []
}
```

The run record stores the resolved server-quoted cap when it is created; a stored run never inherits a later catalog price silently.

### Deliverables

- [ ] **VID-P2-01 Skill executor:** versioned DAG, validated step inputs/outputs, conditions, guards, approval gates, retry policy, budget ceiling, and compensation.
- [ ] **VID-P2-02 Project memory:** approved facts and asset versions only; raw chat is evidence, not authoritative state. Users can inspect and correct remembered facts.
- [ ] **VID-P2-03 Two proven Skills:** product advertisement and reference-video reconstruction, derived from actual Stage 1 projects rather than invented generic prompts.
- [ ] **VID-P2-04 Exact replay:** “Do the same” restores source assets, prompts, settings, model/catalog snapshot, storyboard, selected versions, and required rights confirmations.
- [ ] **VID-P2-05 Process discovery:** gallery detail supports final output, creation-process preview, read-only project view, and clone/remix; one-image cases do not duplicate the same image as cover and content.
- [ ] **VID-P2-06 Audio continuity:** voice anchor, music/SFX, subtitle, and beat metadata are reusable project assets.

### Stage 2 exit gate

- The same stored Skill version reproduces the same workflow graph from the same inputs without depending on hidden conversation history.
- Old projects remain replayable after a new Skill/catalog version is published.
- Clone/remix rejects missing, unauthorized, or expired source assets with a precise repair path.
- The two Skills reduce median manual setup time without increasing platform failure or billing-error rates.

## 8. Stage 3: Advanced Video Editing and Routing

**Estimated effort:** continuous, capability by capability; no bundled “all advanced features” release.

Release each item behind a provider-specific capability gate:

- [ ] **VID-P3-01 Time-range reshoot:** regenerate a selected interval, preserve untouched ranges, and fall back to whole-shot regeneration.
- [ ] **VID-P3-02 Extension:** extend from an approved boundary frame with explicit duration and cost cap.
- [ ] **VID-P3-03 Tracked replacement:** bind a replacement asset to a tracked region with previewable masks and normalized coordinates.
- [ ] **VID-P3-04 Reference-to-video/action control:** store motion/position references as versioned shot inputs.
- [ ] **VID-P3-05 Data-driven routing:** rank eligible products by capability fit, recent success, delivery latency, and delivered-second cost; keep a user-visible Fast/Stable/High-quality intent.
- [ ] **VID-P3-06 Candidate learning:** learn from explicit candidate selections only; never treat a mere generation as preference.
- [ ] **VID-P3-07 Collaboration/API:** comments, approvals, team roles, export webhooks, and a scoped CLI/API after the browser workflow is stable.

### Capability release gate

- The provider route passes three real canaries covering its advertised input variants.
- Output persists to a stable Shubao URL and survives a process restart.
- Billing, cancellation, moderation, timeout, and fallback behavior are tested.
- The UI exposes a whole-shot fallback when the local operation is unavailable.
- Provider claims such as “50 references” or “30 seconds” are shown only after Shubao verifies the exact route in production.

## 9. Commercial Model

- Charge for successfully delivered shots/video seconds or exported deliverables, not raw button presses.
- Pre-authorize the displayed maximum, settle successful deliverables, and release failures automatically.
- Subscription value comes from concurrency, priority queue, storage, commercial rights, team seats, and longer retention; credit packs cover variable usage.
- Every quote stores provider cost, payment-cost allowance, customer revenue, contribution, and margin under a versioned pricing snapshot.
- Low-resolution candidates are the default exploration path; high-resolution enhancement happens only after selection.
- Long projects enforce a budget ceiling, version retention policy, proxy cleanup, and explicit archive/export rules.

## 10. Delivery Governance

### Stage workflow

1. Approve a stage-specific design with user flows, schemas, failure semantics, and non-goals.
2. Write a TDD implementation plan with exact files, interfaces, commands, and expected failures.
3. Deliver independently reviewable commits; update this roadmap checkboxes only after the stage exit evidence exists.
4. Run focused tests, full regression, build, desktop/mobile browser QA, billing verification, restart recovery, and security review.
5. Deploy only through `scripts/deploy-production.ps1`.
6. Verify the public HTML asset hash matches the candidate release, the Nginx `current` symlink points at that release, PM2 is stable, production health/audit pass, and the deployment lock is released.
7. Observe stage metrics for the stated beta window before expanding availability.

### Review cadence

- Weekly: failure taxonomy, queue state, provider success, delivery time, refund latency, cost and contribution.
- Per release: regression/build/browser evidence plus production asset hash and rollback target.
- Monthly: provider capability and price snapshots; disable products whose verified economics or reliability no longer meet their gate.
- Per stage: continue, narrow, or stop based on exit metrics. Do not preserve a feature merely because engineering time was spent on it.

### Definition of Ready and Done

| Gate | Required evidence |
|---|---|
| Ready for implementation | User problem, current-code reuse map, non-goals, schema and API contract, billing semantics, failure matrix, license/security review, feature flag and rollback owner |
| Ready for internal use | Focused TDD suite, full regression/build, migration/backfill proof, no-paid simulation, owner isolation, restart recovery, operational dashboard and support playbook |
| Ready for production flag | Clean isolated release, desktop/mobile browser QA, canary budget approval, public asset hash, PM2/Nginx health, rollback release, zero unexplained billing state |
| Done | Production observation meets the stage SLO, support can diagnose from job to attempt to ledger, documentation and `RTK.md` reflect reality, and every exposed control changes stored behavior |

Local incubation of the next stage is allowed only behind a default-off flag and an additive schema. It cannot change existing production routes, trigger paid work, or be presented as shipped before the preceding production gate is satisfied.

## 11. Immediate Next Program Slice

### 2026-08-16 P2-02 project memory status

P2-02 is implemented locally on `codex/video-platform-p0` at commit `01eb149`.
The workbench now has an owner/project-scoped, bounded memory fact contract with optimistic
revisions, soft deletion, approved-asset reference validation, replay-manifest sanitization,
clone preservation, and a gated editor that reuses the existing workbench surface. Focused
and repository gates pass (`23/23` focused memory/replay/store checks, `1678/1678` full tests,
`npm run check`, and the 6510-module production build). The slice does not call a provider,
create a generation job, write usage/billing/wallet state, or trigger paid generation.

Production exit evidence is still intentionally open: this commit has not been deployed,
the production SkillRun/memory routes remain unavailable, and the controlled SSH key is not
readable in the current environment. P2-03/P2-04 and the P2 program exit criteria remain
blocked on the existing P1 owner-cohort evidence and must not be presented as shipped.

The first implementation spec after this roadmap is **VID-P0 Reliable Media and Job Foundation**. It must cover only:

1. existing-state and schema migration;
2. media preview/upload/proxy behavior;
3. generation job state machine and attempt log;
4. outbox/idempotency/recovery;
5. billing reconciliation;
6. admin observability and fault injection.

Storyboard, timeline, Skill execution, and advanced editing are explicitly excluded from that first slice. This keeps the next body of work reviewable and prevents product expansion from masking reliability defects.

### 2026-08-17 P2-03 proven Skill templates status

P2-03 now has a local, default-off incubation slice on `codex/video-platform-p0`. It registers two
versioned templates derived from the real VideoStudio modes and existing SkillRun DAG validator:
`product-ad-v1` (`smart`) and `reference-video-reconstruction-v1` (`remake`). The bounded builder
accepts only sanitized asset references and text, emits a preview-compatible SkillRun spec, and
does not contain provider names, credentials, prices, hidden prompts, generation calls, or billing
behavior. Owner-gated metadata and template-preview helpers are available for future workbench UI
wiring; the preview route persists only a local plan/checkpoint record.

Evidence for the local slice: focused template/workbench tests `31/31`, full regression `1687/1687`,
`npm run check`, 6510-module production build, and `git diff --check` all pass. No paid provider call
was made. The slice is not production-complete: the controlled SSH key is unreadable in this
environment, so no release or 600-second canary is claimed. Before enabling it publicly, deploy via
`scripts/deploy-production.ps1`, verify owner isolation and zero billing/provider side effects in
production, and capture a rollback release plus the two real workflow evidence runs.

### 2026-08-17 P2-04 exact replay template provenance status

The replay boundary now preserves a registered Skill template's identity without leaking runtime
identity. A normalized template preview stores `templateId` inside the immutable plan; the sanitized
replay snapshot copies it only when present; and owner-scoped clone reads it back from the project
version snapshot. This keeps “do the same” tied to the exact bounded recipe rather than to a transient
run ID, while preserving the existing generic replay shape for older runs.

Evidence for this local fix: combined SkillRun/template/workbench/replay/store tests `54/54`, full
regression `1687/1687`, `npm run check`, 6510-module production build, and `git diff --check` all pass.
The change is non-billing and did not call a provider or generation endpoint. P2-04 remains unchecked
for production until the controlled SSH key is readable, the release is deployed through
`scripts/deploy-production.ps1`, and a production owner-scoped clone is verified with a rollback
release and 600-second canary.

### 2026-08-17 P2-06 audio continuity status

P2-06 now has a local, default-off implementation on `codex/video-platform-p0`. The workbench
stores owner/project-scoped, revisioned voice/music tracks that reference only approved audio
asset versions, with bounded placement, volume, mute, voice-anchor, beat-marker, language, and
subtitle-cue metadata. Replay manifests sanitize that metadata and exclude playback URLs; clone
remaps the approved asset/version IDs into the new draft project. The HTTP/client surface is
authenticated and optimistic-concurrency aware.

The project workbench now exposes the approved-audio list and a minimal continuity panel: add a
confirmed voice/music version after a visual timeline clip exists, then adjust volume or toggle
mute while keeping the server revision contract. It deliberately does not claim waveform
rendering, transcoding, TTS, beat detection, or provider delivery.

The implementation plan is `docs/superpowers/plans/2026-08-17-ai-video-p2-audio-continuity.md`.
This is continuity metadata, not an audio renderer or a provider integration. Focused tests,
full regression, static checks, and production build remain the release gate. No paid provider
call was made, and no production deployment is claimed while the controlled SSH key remains
unreadable.

## 12. Research Basis

- [Flova product model](https://flova.tv/zh-CN/docs/introduction/understanding-flova/): project memory, visible/editable Skills, versioned assets, dependencies, rollback, and timeline composition.
- [Flova quick guide](https://flova.tv/zh-CN/docs/tutorials/quick-guide/?flovatv=1): agent planning and manual local editing coexist; assets move into storyboard and timeline.
- [Flova Agent CLI](https://flova.tv/zh-CN/agent-cli/): programmatic project, storyboard, asset, audio, and export workflow.
- [TapNow](https://app.tapnow.ai/home): public process viewing, project cloning, local reshoot/extension/tracking product direction, and large node-based projects.
- [Director workflow video](https://www.bilibili.com/video/BV1zfg36ZEXi/): staged world/character/scene/prop/shot creation with human confirmation and persistent canvas dependencies.
- [Corrected Feishu workflow resource](https://q52zkkpo8s.feishu.cn/wiki/HUCJwu1euiroyFkeWLHcMwrPnwd): Skill package structure and project-memory workflow context.
- [Xuan AI video corpus research](./2026-08-17-xuan-ai-video-research.md): the second Xuan-jiang film source and 19 AI-video tutorials distilled into normalized cinematography, continuity, cost-funnel, replay, and automation primitives. Access limits and unverified provider claims are recorded explicitly.

## 13. Definition of Program Success

Shubao succeeds when a user can start from an intent or reference, approve reusable assets and a cost-bounded shot plan, generate and repair individual shots without losing successful work, assemble selected versions, export, and later clone the exact process. The success condition is not the number of exposed models; it is reliable delivery, controllable cost, continuity, and repeatable creative leverage.

## 14. Long-Running Execution Ledger

This ledger is the durable program checkpoint. A checkbox changes only when its evidence link, test result, production metric, and rollback boundary are recorded in this document or `RTK.md`.

| Program slice | Status on 2026-08-14 | Evidence required to advance | Next action |
| --- | --- | --- | --- |
| Market and workflow research | Complete | Flova, TapNow, director workflow, corrected Feishu resource, and Xiaohongshu reconstruction flow reviewed without paid generation | Revalidate provider claims and prices monthly |
| P0 design contract | Complete locally | Schema, migration, state machine, billing compensation, outbox, media lifecycle, fault matrix, and explicit non-goals exist in the P0 design/implementation specs | Revalidate the contract during production rollout |
| P0 media foundation | Production foundation live at `5d933c2`; paid generation not exercised | Local preview does not wait for cloud upload; stable originals, thumbnails, posters, proxies, resumable upload, authorization, restart and non-billable production contracts pass | Observe upload/first-preview timing and object-store errors before expanding traffic |
| P0 reliable jobs and billing | Production foundation live; fault suite and non-paid production verification pass | Fault injection proves no duplicate provider submission, lost result, double settlement, or charged terminal failure | Track attempt/outbox/reconciliation SLOs and run provider canaries only under an approved spend budget |
| P1 storyboard workbench | Implemented and deployed dark; `workbenchEnabled=false` | Ten internal projects finish without platform-state or billing failure | Add an owner cohort, complete browser acceptance and ten non-billing projects, then evaluate the flag |
| P1 export manifest boundary | Local green; renderer intentionally absent | Stable manifest hash, owner isolation, selected-candidate/stale checks, audio/subtitle bounds, tamper fail-closed reads, no billing/provider writes | Add a durable renderer worker and proxy/download recovery before treating export as delivered |
| P2 Skills, memory, replay | Blocked by P1 evidence | Two real workflows can be replayed from stored inputs and a versioned manifest | Product ad first; reference reconstruction second |
| P2 audio continuity | Local candidate, not deployed | Approved audio assets, bounded track metadata, replay sanitization, clone remapping, workbench add/mute UI, and production owner-cohort evidence | Run non-billing owner-cohort replay before enabling any audio UI |
| P3 advanced local editing | Research only | Each provider capability passes three real input-variant canaries and has a whole-shot fallback | Release reshoot, extension, tracking, and action control independently |

### 2026-08-16 production evidence

- Exact production commit: `5d933c2`; Nginx release:
  `/var/www/shubao/releases/20260816-105210-5d933c2`; PM2 PID: `2707250`.
- Local quality gate: 1,643/1,643 tests, check, verify, 6,510-module build, and
  zero paid-provider submissions from the video verification harness.
- Production gate: ready health, 117 gallery images, two public video products,
  authenticated non-billable video canaries, two ecommerce tasks with three
  stable assets each, and the complete 600-second observation workflow.
- The P1 surface is present only behind the default-off server capability.
  Existing homepage and standalone video creation remain unchanged.
- A production `ENOSPC` incident during the earlier attempt is now a permanent
  release guard: retain the two newest prior rollback backups, then require at
  least 2 GiB of free space before creating the next backup. No runtime media,
  database or user work is part of this cleanup rule.

### First 90-day sequence

1. **Weeks 1-2 - P0 contract and baseline:** inventory current image/video/media/job/billing paths; freeze reliability metrics; design migrations, state transitions, outbox records, recovery ownership, proxy formats, and fault tests. No new editor feature enters this slice.
2. **Weeks 3-5 - media path:** instant object-URL preview, background durable upload, content hashing, thumbnail/poster/proxy generation, resumable transfer, stable authorized URLs, and cleanup policy. Roll out to Canvas upload first, then homepage video upload.
3. **Weeks 5-7 - job and billing path:** idempotent submission, durable attempts, outbox delivery, startup reconciliation, provider polling recovery, persisted-result handoff, settlement/release compensation, and admin task timelines.
4. **Weeks 7-8 - adversarial acceptance:** run the complete fault matrix, restart recovery, queue saturation, moderation, timeout, deleted-source, object-store failure, and billing failure. Observe a limited internal beta until all Stage 0 exit metrics hold.
5. **Weeks 9-12 - P1 narrow workbench:** only after Stage 0 exits, implement project assets, storyboard shots, candidate selection, a basic timeline, and three templates: product advertisement, image-to-video, and first/last-frame video.

### Operating rules

- Reliability work uses the existing production routes and migrates them; no parallel experimental queue becomes a second source of truth.
- Every stage has one owner, one metric dashboard, one rollback target, and one weekly written checkpoint in `RTK.md`.
- Provider/model choice stays server-configured and capability-gated. The user chooses Fast, Stable, or High quality; advanced model selection remains optional.
- A feature is not complete when a button renders. It is complete only when its stored input changes provider behavior, survives refresh/restart, settles correctly, and has a tested failure path.
- Gallery “view process / do the same” requires full provenance: original assets, prompts, parameters, catalog snapshot, selected versions, project graph, and rights confirmations. A final image alone is never treated as a replayable workflow.

## 15. Current-System Reuse Map

| New video-platform responsibility | Existing Shubao source of truth | Required change |
|---|---|---|
| Project ownership/versioning | `server/projects/*` and `server/videoProjectBridge.mjs` | Add video-workbench entities linked to existing projects; never create another project database |
| Single-shot generation | `server/videoGeneration.mjs`, `server/videoProviders.mjs`, current VideoStudio | Treat each shot candidate as a normal reliable generation job |
| Upload and media delivery | `server/videoUploadService.mjs`, generated assets and authorized delivery | Add poster/proxy variants and background processing without blocking local preview |
| Billing and unit economics | Existing wallet holds, settle/release, usage events and admin reconciliation | Attribute each attempt and successful delivered second to project/shot/template |
| Human approval | Current planning confirmation and Canvas selection patterns | Persist plan approval and candidate selection as auditable transitions |
| Timeline/export | Current Canvas asset placement and export primitives | Introduce a minimal durable clip list before adding professional editing complexity |
| Skill/replay | `server/visualCreationSkills.mjs`, gallery recipe/remix contracts | Replace hidden prompt bundles with versioned manifests and exact provenance |
| Operations | Video attempts, outbox, reconciliation, admin operations | Add project/shot drill-down and stage SLOs; keep one operational truth |

## 16. Reuse and License Gate

| Candidate | License/evidence | Proposed use | Adoption gate |
|---|---|---|---|
| LTX Desktop | Apache-2.0 application code; model weights use separate terms | Architecture/performance-test reference and optional isolated local worker | Pin version; validate model license, GPU floor, cold start, output integrity and commercial terms |
| LTX-2 weights | Community license with commercial conditions | Optional capability canary, never assumed available | Legal review and revenue-threshold check before any production use |
| Wan2.2 / Wan skills | Apache-2.0 repositories | Optional self-hosted T2V/I2V/action experiments | Quality, VRAM, latency, moderation, security and delivered-second cost must beat managed fallback for a defined segment |
| ComfyUI | GPL-3.0 ecosystem with third-party custom nodes | Isolated workflow runner or reference implementation | Process/API boundary, dependency allow-list, sandbox, SBOM, reproducible workflow lock and legal review |
| VideoHelperSuite/custom nodes | Mixed community maintenance and operational risk | Research only until proven | No production dependency without ownership, soak tests, upgrade/rollback plan and license verification |
| LivePortrait | MIT code, but default InsightFace models have non-commercial restrictions | Research for portrait driving | Replace restricted detector/model assets and verify all transitive licenses |
| ConsisID | Apache-2.0 research code | Identity-consistency benchmark | Research benchmark only until quality, performance, moderation and maintenance gates pass |

Mature open source is a way to reduce implementation risk, not a substitute for product and operations ownership. Shubao owns the customer-facing domain model, authorization, billing, state machine, quality gates and support path regardless of the execution worker.

## 17. Practical Creator Methods as Product Primitives

Public creator examples and official product documentation repeatedly validate the following methods. They become testable product primitives rather than opaque “tips”:

| Creator method | Product primitive | Testable output |
|---|---|---|
| Character/product/environment reference sheets | Approved asset versions and named bindings | A shot records exactly which reference versions it used |
| Reference-video breakdown | Shot detection, beat map and editable storyboard proposal | User can accept/reorder/reject the proposed shots before spend |
| First/last frame control | Versioned keyframe bindings | Provider route is allowed only if it supports the required binding |
| Pose/performance transfer | Motion-reference asset plus capability-gated route | Input rights and model capability are validated before submission |
| Low-resolution draft then enhance | Candidate funnel with explicit HD promotion | Only selected candidates incur enhancement cost |
| Per-shot repair | Shot retry, interval reshoot where supported, whole-shot fallback | Successful clips remain untouched and billing is attributed per attempt |
| Music/voice continuity | Voice, music and beat assets with immutable versions | Timeline clips retain audio provenance and synchronization metadata |
| Prompt timing and camera language | Structured shot direction translated by provider adapter | The UI shows intent; adapters produce provider-specific parameters |

The public index confirms the existence and AI-video focus of the creator account “屿帆AI”, but the WeChat article bodies were not reliably accessible in this environment. Article-specific steps are therefore not treated as verified requirements. They should be added only from user-provided article URLs/exports or another lawful stable source.

## 18. Renderer Lease and Recovery Slice (2026-08-18)

The first renderer handoff is now durable locally, but it is intentionally still a pre-provider boundary:

- `video_export_jobs` stores `worker_id`, `lease_token`, and `lease_expires_at`; existing SQLite databases migrate these columns on open.
- A worker can claim one `waiting_renderer` job, renew only its own unexpired lease, and complete/fail/cancel only with the matching lease token.
- An expired rendering lease is recovered exactly once into `failed` with `EXPORT_JOB_LEASE_EXPIRED`; the source timeline and billing state remain unchanged and the job must explicitly return to `waiting_renderer` before retry.
- Job and manifest hashes are recomputed on every read/write, and the current timeline is rebuilt before claim, renew, recovery, or transition. Timeline edits therefore invalidate the old handoff instead of rendering stale work.
- The internal store methods are not exposed as a public “fake render” API. No provider submission, object upload, wallet hold, usage event, or billing mutation is permitted in this slice.

Evidence for this local slice: focused job/store tests `12/12`, full suite `1751/1751`, `npm run check`, 6510-module production build, `git diff --check`, and the 10-project non-billing pilot all pass. This does **not** mark renderer delivery complete or enable the production workbench. The next gate is a provider-neutral renderer adapter plus an outbox/reconciliation worker, with a dry-run implementation first; only after fault tests and cost/rights gates pass can a real provider be enabled.

## 19. Provider-Neutral Renderer Request and Outbox (2026-08-18)

The next reliability boundary is implemented locally without selecting or calling a video provider:

- `videoRendererAdapter.mjs` builds a versioned `video-render-request` from the current rendering job and export manifest. The request carries stable `requestId`/`idempotencyKey`, manifest/job hashes, bounded timeline and audio metadata, and explicit `providerSubmission=false`/`billingMutation=false` guards.
- `videoRendererOutbox.mjs` provides a hashed `renderer.submit.requested` event with pending/processing/failed/completed/canceled states, worker leases, retry scheduling, and terminal-state guards. Provider responses are normalized only when an adapter is explicitly supplied; the default adapter fails closed with `RENDERER_NOT_CONFIGURED`.
- The SQLite workbench creates one outbox event per export attempt inside the same state transition that enters `rendering`, and synchronizes failed/completed/canceled terminal states. Existing databases create the outbox table and indexes on open; duplicate request IDs are idempotent and payload-hash mismatches fail closed.
- No provider credentials, upload, wallet hold, usage event, billing mutation, or public worker route is introduced. The production workbench remains default-off.

Evidence for this local slice: adapter/outbox/job/store focused tests `18/18` pass before the full release gate. The required next gate is an authenticated reconciliation worker in dry-run mode: claim outbox events, renew leases, record normalized provider status, reconcile lost callbacks, and prove retry/timeout/duplicate/fault paths without a provider call. Only after that matrix, cost/rights checks, and a measured provider canary may a real renderer be enabled.

## 20. Authenticated Reconciliation Dry-Run (2026-08-18)

The provider-neutral reconciliation boundary is now implemented and verified locally. It remains deliberately
disconnected from provider credentials, media upload, wallet settlement, usage accounting, and public routes:

- `videoRendererReconciliation.mjs` runs the claim -> submit -> poll -> terminal state machine against an injected
  adapter. A stable request ID and request hash are checked before every transition; a stale event, manifest, job,
  or lease is rejected before the original outbox row is mutated.
- The adapter is fail-closed for explicit callback identity: a supplied `requestId` or `requestHash` must match the
  request that was submitted. Missing callback identity is filled from the stable request only for adapters that do
  not return it. This prevents a malformed or cross-job callback from being normalized into a valid result.
- Queued/running callbacks can be polled, lost submit responses can be retried with the same idempotency key,
  deadlines become retryable `RENDER_TIMEOUT` failures, and duplicate terminal reconciliation is a no-op. Invalid
  submit/poll callbacks are rejected without converting the event into a retryable provider failure.
- `scripts/verify-video-renderer-reconciliation-dry-run.mjs` exercises four deterministic scenarios: normal
  completion, lost-submit retry, timeout, and invalid-submit callback. It asserts event integrity and
  `billingMutated=false` while reporting `providerCalls=0`.

Evidence captured on 2026-08-18: full `npm test` `1765/1765`, `npm run check`, 6510-module production build,
`git diff --check`, the 10-project/40-operation non-billing pilot, and the four-scenario reconciliation dry-run all
pass. `npm run collab:check` remains policy-blocked only because this linked worktree has no collaboration marker;
it is not an application test failure. This closes the local dry-run gate, not renderer delivery: the next gate is
authenticated worker persistence/restart recovery and an explicit cost, rights, moderation, and rollback review.
No provider canary or production deployment is authorized by this slice.

## 21. Authenticated Worker Persistence and Restart Recovery (2026-08-18)

This milestone makes the renderer handoff executable without selecting a provider. A private worker accepts only an
explicit worker identity and lease token, claims the persisted outbox attempt, calls the injected provider-neutral
reconciliation state machine, and atomically writes the resulting event and export job through the existing SQLite
workbench store. The worker cannot be called through a public route and the default adapter still fails closed.

The persistence contract is deliberately strict: the current export manifest and job/request hashes are rebuilt on
every read; the incoming event must match the current attempt, request id, request hash, and attempt count; terminal
completion requires both a non-empty output asset identifier and stable URL; lease mismatch, stale state, forged
callback identity, or missing output produces a controlled failure rather than a false success. A file-backed restart
test closes and reopens SQLite between queued submit and completion, proving the same idempotency key resumes without
duplicating the attempt or changing provider/billing guards.

The local evidence is `12/12` renderer adapter/reconciliation/worker focus, full `1768/1768` tests, `npm run check`,
the 6510-module build, the non-billing pilot, and the deterministic reconciliation dry-run. No real provider,
storage upload, wallet/usage/billing mutation, paid video generation, or production deployment occurred. The next
gate is not UI polish or a blind provider switch: first complete capability, cost, rights, moderation, output-storage,
quality, latency, and rollback review; then run a measured non-default canary and only afterward consider enabling the
existing workbench flag. The existing production job/billing routes remain the sole source of truth.

## 22. Deterministic Generation Preflight Gate (2026-08-18)

The workbench now has a provider-neutral, strict preflight boundary that runs before any future renderer submission.
It is deliberately separate from plan approval: approving a plan stores an auditable snapshot, while preflight decides
whether that snapshot is currently safe to submit.

- `server/videoRendererPreflight.mjs` normalizes the product capability snapshot, checks mode/resolution/duration/audio
  limits, counts unique per-shot references, verifies rights confirmations, moderation status, budget caps, and the
  durable output-storage contract. It returns deterministic `preflightHash`, blockers, warnings, and explicit
  `providerSubmission=false`/`billingMutation=false` guards.
- `POST /api/video/projects/:projectId/workbench/preflight` is owner/cohort scoped and rebuilds the current workbench
  plan from the server catalog. The client renders the result as a submission gate and explains that the check does
  not call a provider or spend credits.
- Advisory mode is available to surface governance warnings during planning; strict mode is required for a future
  renderer handoff. The current UI does not fabricate moderation or storage attestations, so those missing contracts
  remain visible blockers until the governed media pipeline supplies them.
- The preflight hash excludes volatile timestamps and nested plan hashes. Repeated checks of the same immutable inputs
  therefore produce the same fingerprint, making later outbox requests and audit records idempotent.

Evidence for the initial preflight slice was `50/50`; after binding the attestation to export jobs and renderer
requests, the focused contract suite is now `68/68`. No provider credentials, upload, wallet hold, usage event,
billing mutation, paid video generation, or public worker route was used. The workbench remains default-off and this
slice is not deployed. The remaining release gates are the full repository regression, production build, output proxy/
download recovery, real moderation/storage attestations, and a measured non-default canary with quality, latency,
cost, and rollback evidence.

## 23. Strict Preflight Binding (2026-08-18)

The strict preflight is now part of the durable renderer handoff rather than a UI-only check. Export jobs persist the
attestation JSON and its hash inside the immutable job hash; reads recompute the current workbench plan and reject a
stale or forged attestation. Provider-neutral renderer requests carry `preflightHash` and `preflightStatus=ready`, and
the authenticated worker can be run with `requirePreflight=true`, refusing legacy jobs before claiming a lease or
calling an adapter. Idempotent retries cannot silently switch to a different preflight for the same manifest.

The new store, job, adapter, worker, route, client, and UI tests cover the binding, tamper, stale-plan, restart,
lease, and zero-provider-call paths. Focused evidence is `68/68`; the full release gate is intentionally still
pending. This remains a local, provider-neutral implementation with `workbenchEnabled=false` and no production
deployment.

Verification update (2026-08-18): post-binding full repository regression is `1780/1780` with zero failures;
`npm run check`, the 6510-module production build, `git diff --check`, the 10-project/40-operation non-billing pilot,
the four-scenario renderer reconciliation dry-run, and `verify-video-platform.mjs --local --no-paid-generation` all
pass. The dry-run reports `providerCalls=0` and `billingMutated=false`. This closes the local contract gate only;
output proxy/download recovery, real moderation/storage attestations, measured provider quality/latency/cost, rollback,
canary, and explicit feature-flag approval remain required before deployment.

## 24. Integrated Core Release Gate (2026-08-18)

The provider-neutral foundation is integrated into `codex/ecommerce-stability` at `9225816` and deployed through the
single production entry point. The release does not enable the P1 workbench and does not call a paid video provider.

- Local evidence: full repository regression `1821/1821`, `npm run check`, production build (`6520` modules),
  `git diff --check`, collaboration policy check, reconciliation dry-run, and
  `verify-video-platform.mjs --local --no-paid-generation` all passed.
- Production evidence: `https://shuimg.cn/health` returned `200` with `ok=true` and `ready=true`; gallery verification
  covered `117` images; the public video contract exposed `2` products; authenticated production canaries were
  non-billable; the remote video backfill was empty; and the no-paid verifier reported `providerSubmissions=0` with no
  billing mutation.
- The deployment script completed its `600` second canary, saved the PM2 startup snapshot, released the remote lock,
  and reported the deployed revision as `9225816`. A later local XHS-only commit `90c919d` is outside this AI-video
  release and must be treated separately.
- The research gate is closed for the publicly verifiable material: both requested Bilibili director workflows, the
  Feishu AI-video index, Flova/TapNow/流影 patterns, and the open-source/license review are recorded in this roadmap.
  Full hidden Feishu attachments and all 屿帆AI WeChat article bodies were not reliably retrievable; no article-specific
  implementation claim is made from inaccessible material.

This release is a verified reliability foundation, not a finished AI-video studio. `VIDEO_PLATFORM_P1_WORKBENCH=false`
remains intentional. The next release must add the asset/storyboard/timeline UI only after output proxy/download
recovery, governed moderation/storage attestations, provider capability and cost review, and an explicitly approved
non-default provider canary.
## 25. Provider-Neutral Planning Workbench Slice (2026-08-18)

The first product-facing slice of the long-term video plan is now implemented as an owner-only planning mode. It
exposes the project, asset, storyboard, candidate, timeline, project-memory, Skill preview, replay-manifest and
generation-preflight workflows without selecting a provider or spending credits.

- `VIDEO_PLATFORM_P1_PLANNING=true` is an additive default. The live renderer flag
  `VIDEO_PLATFORM_P1_WORKBENCH` remains `false`, so enabling planning cannot accidentally enable a paid provider.
- Capability discovery reports `workbenchMode` and `workbenchPlanningOnly`; the workbench shows a visible planning
  banner and keeps the provider-neutral contract explicit rather than presenting a fake Generate button.
- Export-job creation is rejected only after authentication and owner-cohort authorization. Anonymous callers still
  receive the normal auth response; an eligible owner receives `VIDEO_WORKBENCH_PLANNING_ONLY` and no export job,
  provider submission, wallet mutation or usage event is created.
- The route, rollout, capability, UI and full workbench suites cover the new mode. This is an intentional planning
  release, not a claim that live rendering is ready. Live enablement still requires the provider capability/cost/
  rights/moderation/storage/quality/latency/rollback gate and a measured non-default canary.

This slice is the implementation bridge between the publicly researched product pattern and ShuBao's existing
reliability foundation: users can assemble and review a real project graph, while the system refuses to pretend that
an unconfigured renderer succeeded. The next implementation slice is authenticated asset proxy/download recovery
and a durable project/workbench browser QA pass, followed by a non-provider worker canary.

## 26. Asset Delivery Validators and Candidate Provenance (2026-08-19)

This slice closes two concrete replay and recovery gaps without enabling a provider:

- `sendVideoAsset` now emits a stable content validator (`ETag`), `Last-Modified`, an inline filename, and byte-range
  semantics that honor `If-Range`. Matching `If-None-Match` returns `304`; `HEAD` returns headers without opening a
  response body; invalid ranges remain `416` with `Content-Range`. The existing owner authorization and private
  cache policy are unchanged. This makes browser previews and interrupted downloads resumable without re-reading a
  complete media file.
- `video_shot_candidates` stores an immutable `provenance_status` and canonical `provenance_json`. New planning
  candidates are explicitly `planned`; candidates imported from old jobs without an attempt snapshot are explicitly
  `unverified-legacy`; a completed job is `verified` only when its durable attempt provides provider, model, upstream
  request/task ID, request hash, catalog version, generation time, and source marker. Missing fields fail closed to
  `unverified-legacy` rather than inventing a model or claiming that a historical case used a known provider.
- The provenance snapshot is derived from the existing `video_job_attempts` record and job catalog/cost snapshot. It
  is therefore independent of UI labels and can be carried into process replay/clone and future case-gallery detail.

Release evidence for this slice is now complete locally: focused asset delivery `7/7`, workbench store `25/25`,
workbench UI `2/2`, full repository regression `1840/1840`, production build (`6520` modules), `npm run check`,
collaboration policy, no-paid-generation verifier, renderer reconciliation dry-run, 40-operation planning pilot, and
local production audit `27/27` all passed. The pilot recorded `providerSubmissions=0` and `billingMutated=false`.

The only unfinished gate is the remote release itself. `scripts/deploy-production.ps1 -CanarySeconds 600
-PublicWarmupSeconds 60` was run through every local gate, but stopped before creating the remote helper directory or
deployment lock because `C:\Users\SHEJI\.ssh\shubao_deploy_ed25519` is not readable in this execution environment and
the server rejected public-key authentication. No remote file, process, lock, billing record, or provider task was
changed, so this slice is **not** claimed as deployed or publicly canaried. No provider submission, video generation,
upload, wallet hold, settlement, or usage mutation occurred.

## 27. Continuity Review and Generation Draft Audit Snapshot (2026-08-19)

The planning workbench now carries the director-review result all the way into the generation draft without
submitting a provider job:

- `reviewShotContinuity` sorts shots by position and reports explicit review issues for a missing primary action,
  adjacent axis reversal, or adjacent screen-motion reversal. The result is deliberately non-blocking: creative
  choices remain editable, but the user sees the affected shot IDs before compiling a draft.
- The workbench renders the review beside the existing preflight gate. A clear result is green; a review result is
  amber and explains that it is a generation-before-review hint. Neither state calls a provider or mutates billing.
- Generation drafts are now schema version `2` and persist bounded snapshots of `continuityReview` and `preflight`
  (status, issue codes/details, shot IDs, requirements, blockers/warnings, and a validated preflight hash). Media
  URLs, private prompt payloads, and provider credentials are not copied into this audit metadata.
- The HTTP route and replay path use the same immutable draft contract. Existing schema-version-1 drafts remain
  readable because the client treats absent snapshots as `unknown`/`missing` rather than claiming a pass.

This closes the specific reliability gap identified while studying the second Bilibili director workflow and the
Feishu AI-video index: a human review point must be explicit, persisted, and replayable before shot generation is
ever enabled. It is still a planning-only slice. The next product work remains P1 asset library, storyboard and
timeline interaction, selective per-shot recovery, and a measured non-default provider canary; none of those gates
are implied by this local snapshot change.

## 28. Deterministic Single-Shot Recovery Plans (2026-08-19)

The first selective-recovery slice is now implemented without invoking a provider or changing billing. A failed or
rejected shot can produce a durable, auditable recovery plan that records the exact shot snapshot, affected timeline
clips, candidate replacement mode, preserved neighboring shots, bounded user reason, and a stable plan hash.

- `server/videoShotRecovery.mjs` defines the provider-neutral recovery contract. It supports `replace_candidate` and
  `rebuild_shot`, rejects unknown modes, bounds free-text reasons, and fails closed if the plan is tampered with.
- `video_shot_recovery_plans` persists the plan with owner/project/shot scope, revision, status, canonical hash and
  immutable JSON. Repeating the same request is idempotent: it returns the existing plan and never creates a provider
  job, wallet transaction, usage event, or billing mutation.
- The workbench exposes `建立单镜头重拍计划` beside each shot and shows the saved hash plus the explicit
  `不调用供应商 · 不扣积分` contract. This is a recovery handoff, not a fake Generate button; provider execution is
  still behind the future capability, rights, moderation, storage, cost, quality and canary gates.
- Focused evidence is `60/60` for recovery logic, persistence, route idempotency, unsupported modes and UI wiring.
  The repository regression and local release gates were refreshed after this slice: `1846/1846` tests, production
  build (`6520` modules), `npm run check`, collaboration policy, no-paid verifier, renderer reconciliation dry-run,
  the 40-operation planning pilot, and local production audit `27/27` all pass. No online release is implied by the
  local implementation; the deployment attempt stopped before remote helper/lock creation because the SSH key was
  unreadable in this environment.

## 29. Objective Acceptance Gates (2026-08-19)

The acceptance rule is now risk-based and quota-safe. The external navigation task's review clarified that a
production generation script is not a general smoke test: it creates a real task and therefore cannot be run merely
to prove that a static page or a planning-only video change still renders.

- `auto` is the default deployment classifier and fails closed. Server, shared state, billing, generation routes,
  asset persistence, Canvas, video/ecommerce workbenches, scripts, dependencies, build configuration, or unknown
  scope require the full production gate. Only a demonstrably non-business UI/static/docs/test change may use the
  frontend gate.
- Pure UI, research, and documentation work uses local evidence: `npm test`, `npm run build`, `npm run check`,
  `npm run collab:check`, `git diff --check`, and local browser checks. It does not call real ecommerce or video
  generation.
- AI-video changes use `npm run verify:video-acceptance` as the default L0 contract. The report must be
  `ok=true`, `providerSubmissions=0`, `billingMutated=false`, and `paidGenerationRequested=false`. This gate is
  backed by platform, renderer-reconciliation, and workbench-pilot checks rather than a screenshot-only assertion.
- Online video verification is separated into read-only L3, non-billable TUS L4, and user-approved real-generation
  L5. A failed or lost TUS delete response is retried finitely; a subsequent 404 is treated as already-cleaned,
  while upload creation is never retried automatically.

Evidence for this acceptance slice: full regression `1860/1860`, `npm run verify:video-acceptance` with zero
provider submissions and no billing mutation, focused production-video verifier tests `6/6`, build/check/collab
checks, and `git diff --check`. This records an objective release gate; it does not claim that the provider-backed
AI-video workbench is production-enabled. The remaining product roadmap gates stay open and must be advanced one
bounded, provider-neutral slice at a time.
