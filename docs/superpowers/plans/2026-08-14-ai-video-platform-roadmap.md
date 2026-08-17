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

Evidence for the local slice: focused template/workbench tests `31/31`, full regression `1685/1685`,
`npm run check`, 6510-module production build, and `git diff --check` all pass. No paid provider call
was made. The slice is not production-complete: the controlled SSH key is unreadable in this
environment, so no release or 600-second canary is claimed. Before enabling it publicly, deploy via
`scripts/deploy-production.ps1`, verify owner isolation and zero billing/provider side effects in
production, and capture a rollback release plus the two real workflow evidence runs.

## 12. Research Basis

- [Flova product model](https://flova.tv/zh-CN/docs/introduction/understanding-flova/): project memory, visible/editable Skills, versioned assets, dependencies, rollback, and timeline composition.
- [Flova quick guide](https://flova.tv/zh-CN/docs/tutorials/quick-guide/?flovatv=1): agent planning and manual local editing coexist; assets move into storyboard and timeline.
- [Flova Agent CLI](https://flova.tv/zh-CN/agent-cli/): programmatic project, storyboard, asset, audio, and export workflow.
- [TapNow](https://app.tapnow.ai/home): public process viewing, project cloning, local reshoot/extension/tracking product direction, and large node-based projects.
- [Director workflow video](https://www.bilibili.com/video/BV1zfg36ZEXi/): staged world/character/scene/prop/shot creation with human confirmation and persistent canvas dependencies.
- [Corrected Feishu workflow resource](https://q52zkkpo8s.feishu.cn/wiki/HUCJwu1euiroyFkeWLHcMwrPnwd): Skill package structure and project-memory workflow context.

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
| P2 Skills, memory, replay | Blocked by P1 evidence | Two real workflows can be replayed from stored inputs and a versioned manifest | Product ad first; reference reconstruction second |
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
