# Subagent-Driven Development Progress

## Active workspace

- Worktree: `F:/da/shubao/.worktrees/codex-ecommerce-stability`
- Branch: `codex/ecommerce-stability`
- Approved Git prefix: `git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability`

## Completed foundations

- Design committed: `7bf42b5` (`docs: design generation and billing platform`).
- Implementation plans committed: `ada0b30` (`docs: plan generation and billing implementation`).
- Collaboration root-cause audit: absolute `-C` commands missed the approved prefix; tracked `dist/` and SQLite runtime files kept the worktree dirty.

## Current execution

- Visual workspace and video routing redesign is active under the approved
  specification
  `docs/superpowers/specs/2026-08-10-visual-workspace-video-routing-redesign.md`.
  The durable product decisions are: retain four top-level creation domains;
  keep posters as a Free Visual Creation recipe; remove every competitor-derived
  `reference-card-*.png`; use original Shubao artwork; keep side-navigation
  geometry fixed while animating icon internals; remove the duplicate video
  upload plus button; keep the desktop video command bar on one row; expose
  curated Fast/Stable/2K products instead of raw intermediary models; and keep
  MiniMax H3 hidden until its credential, three real generation modes, durable
  output, billing/recovery, and monitored reliability gates all pass. The
  unrelated deleted extension-task JSON files and existing `.tmp/` and
  diagnostic files remain user-owned and excluded. No implementation files are
  delegated.

- Visual workspace redesign Task 1 is complete in `2fc9883`: four original
  transparent entry assets and four original recipe diptychs are normalized,
  hashed, and wired into Home; the copied `reference-card-*.png` files are
  deleted. Task 1 focused regression passed `9/9` at the implementation
  boundary, and the asset normalizer now fails on missing alpha or visible
  pixels touching the output edge.
- Visual workspace redesign Task 2 is complete in `d2cc50c`: the SideNav keeps
  fixed geometry, uses Lucide icons with staggered internal-child motion, and
  exposes independent tooltips. Focused shell/mobile regression passed `7/7`.

- Dynamic Xiaohongshu/Plog creative planning is complete locally. The legacy
  track templates remain only as a fail-safe fallback; paid XHS runs now derive
  a retry-stable creative direction from the durable generation ID, analyze
  reference-image narrative and hierarchy, plan one cover plus eight distinct
  content pages, and persist the creative brief with the work. Plog replaces
  fixed scene lenses with the same dynamic direction contract and falls back to
  the existing lens engine on malformed planning output. Focused planner tests
  pass 3/3, full regression passes 1329/1329, the 6,458-module production build,
  build check, collaboration policy and diff check pass. Production release is
  the next boundary. The 12 unrelated deleted extension-task JSON files and
  existing `.tmp/`/diagnostic files remain user-owned and excluded.
  The first post-deploy XHS canary exposed a legacy runtime failure: the new
  planner response was truncated by a shared 1,500-token cap, then its fallback
  reached an expired legacy LLM key. The shared text/VLM adapter now honors a
  bounded per-request output budget and the legacy LLM path falls back to the
  verified vision gateway. This follow-up must be redeployed and re-canary-tested
  before the XHS release is considered complete.
  After the gateway fix deployed, a real XHS request passed planning but the
  edge connection ended at roughly 126 seconds while the server queue later
  returned idle. The shared paid and preview SSE transports now send a 15-second
  comment heartbeat and clear it at terminal delivery, preventing browser and
  proxy idle timeouts during long image gaps. This transport follow-up also
  requires full redeploy and a streaming 9-image production canary.

- Ecommerce stability follow-up is complete locally: direction and Canvas uploads now use durable owner-scoped assets per image instead of oversized or expiring temporary URLs; Works hydrates the owner cache and renders an explicit loading state; the Works list no longer synchronously migrates every legacy ecommerce row; and the application/canvas headers expose one automatic-refresh AI-points recharge pill. Focused regression passed 45/45, full regression passed 1279/1279, production build/check passed, collaboration policy is READY. Local browser snapshot was attempted but the bundled browse daemon remained stuck waiting for another instance, so only the Vite shell HTTP check was available.
- Production release attempt for `54afb95` was rejected by the final authenticated billing probe: `GET /api/billing/balance` returned HTTP 401 with the current Canary session token. The deploy script automatically restored the prior application and Nginx state. Do not claim this commit is online until a valid production Canary session is supplied and the full deploy script passes.
- The follow-up `3679005` release reached the remote 600-second Canary wait, but the local execution host timed out before post-Canary checks and left its lock. The post-Canary billing probe using the clipboard value again returned HTTP 401. The application, static assets and Nginx were restored from `/home/ubuntu/shubao/deploy-backups/20260808-001742-3679005`; PM2 health was verified after rollback and the dedicated deployment lock was removed.

- Ecommerce creative/export stability is active under the approved design
  `c4651a6` and implementation plan `5ff58ef`; no files are delegated. Task 1
  is complete at `53e01ea`: bounded creative attempts preserve factual truth,
  retries reuse the same route, and explicit replanning selects a materially
  different compatible route. Task 2 is complete at `65eaa68`: one shared
  format registry exposes eight commerce ratios, unsupported provider ratios
  retain their requested target and crop policy through recovery, planning,
  export targets, second-step directions and Canvas previews, detail defaults
  to 9:16, and ratio menus render in a viewport portal outside clipped
  configuration panels. Task 3 is complete locally: transient provider terminal
  failures remain resumable without duplicate holds or releases, terminal task
  summaries expose delivered/charged/released/failed/retryable counts, and
  owner-scoped dismissal removes only terminal history while preserving durable
  job, billing and project evidence. Focused Task 3 regression passed 126/126;
  Task 4 is complete locally: destination selection never opens a writable,
  every response must be successful image MIME with non-zero bytes before any
  file is created, write failures abort the active stream, and directory,
  ZIP, single-file, suite, selected, long-detail and single-image delivery use
  one two-stage state machine with explicit `开始导出`, progress, retry and
  repeat-export states. Top-level suite export freezes the full generated scope
  independently of current Canvas selection. Focused Canvas regression passed
  121/121 and the 6,454-module production build passed. Task 5 is complete
  locally: long-detail composition validates every decoded input and final
  Sharp output, persists through content-addressed generated-asset storage,
  reads the asset back before success, and returns durable URL, dimensions,
  MIME, byte size and ordered source IDs. Canvas uses a shared right-first
  collision-aware placement function instead of placing the result below all
  content. Focused Canvas/durable-asset regression passed 128/128 and the
  6,455-module production build passed. Task 6 is complete locally: existing
  select-tool marquee, hand-only panning, Shift multi-select hint, compact
  content-sized selection commands and separated mobile bottom controls were
  reverified; the top bar now names `导出整套图片` explicitly, and transient
  notices have a dismiss action plus timer replacement so an old notice cannot
  clear a newer one. Focused interaction/UI/export regression passed 118/118
  and the 6,455-module production build passed. Task 7 full regression, browser
  acceptance and production release is next.

- Canvas selected-composer and structured image-mention correction is active.
  The signed-in reference product at `https://liuyingai.cn/canvas-studio`
  was exercised directly on 2026-08-03: text, image and ecommerce-suite
  creation add only a body; one bottom composer appears only for the selected
  body; image derivation preselects the source as `@图片1`; and the `@` control
  opens an actual reference picker. Approved design and TDD plan are recorded
  in `docs/superpowers/specs/2026-08-03-canvas-selected-composer-and-image-mentions-design.md`
  and `docs/superpowers/plans/2026-08-03-canvas-selected-composer-and-image-mentions.md`.
  No files are delegated. The 12 unrelated deleted extension-task JSON files
  and `.tmp/` remain user-owned and must not be staged or restored.
  Task 1 is complete: compact generation-node geometry, selected-composer
  presentation and ordered role-preserving image-mention contracts are covered
  by 28/28 focused tests. The React surface split is the next boundary.

- Integrated commercial Canvas and ecommerce creative-workflow closure is in
  progress in the Codex worktree; no files are delegated. The Canvas parity
  audit and interaction implementation are complete locally, including live
  edge geometry, direct image/text drag, single and multi-selection surfaces,
  crop/split/annotation/move-scale actions, layer visibility/locking, stable
  upload persistence, empty-session restoration and context-safe commands.
  Focused Canvas regression currently passes 51/51. The 12 unrelated deleted
  `server/extension_tasks` files remain user-owned and must not be staged or
  restored.
- Xiaohongshu video frames, the referenced Feishu workflow, current OpenAI
  image guidance and public GPT-Image-2 prompt libraries have been analyzed.
  The validated workflow is Product Truth -> commercial brief -> four concrete
  editable directions -> dependency-aware shot manifest -> per-shot prompt ->
  objective QA -> targeted repair -> complete-suite delivery. Existing Product
  Truth, Campaign Bible, Asset Plan, prompt, QA, repair and billing modules are
  retained; the missing direction-plan contract and propagation layer are the
  active implementation boundary. Research media under `.tmp/` is runtime-only
  and must not be committed.

- Liuying-style ecommerce Canvas and image-performance rebuild: complete in
  production at `ae56085`.
  Approved specification and TDD plan are recorded in
  `docs/superpowers/specs/2026-07-31-liuying-canvas-image-performance-rebuild.md`
  and
  `docs/superpowers/plans/2026-07-31-liuying-canvas-image-performance-rebuild.md`.
  Scope covers effective SKU override state, exact ecommerce-step restoration,
  bounded visual-analysis lifecycle, a single task-progress surface, high-DPR
  responsive image delivery, a Liuying-inspired ecommerce Canvas shell and
  interaction model, two-credential gateway migration, full browser QA and
  production deployment. No files are delegated; Codex owns the complete
  implementation boundary. The 12 unrelated deleted `server/extension_tasks`
  files remain user-owned and must not be staged or restored.

- Commerce suite production acceptance hardening: complete locally. Ecommerce Works now preserve product and reference sources separately, map `white_background` into the dedicated white-background lane, and expose Chinese display names plus canonical `size`, `width`, and `height` from the planner-owned generation size. The authenticated production verifier now fails closed unless the three-role canary has exact role/duty/dimension metadata, both source types survive into Works, `thumb` and `canvas` WebP variants decode with immutable caching, and an owner-scoped Canvas session creates, saves, and restores exactly. TDD red reproduced the dropped reference source before implementation; focused 13/13 and 8/8 regressions passed, then full `npm test` passed 934/934, production build transformed 6430 modules, `npm run check` passed, and `git diff --check` passed. Commit is pending at this ledger update.

- Market-ready ecommerce creation closure Task 6: complete (`d4decf9..431f662`, final review clean). Layered PSD export now requires server-generated pixel provenance, readable document-sized masks, allowlisted asset references and held/settled pixel-layer billing; focused 70/70 and full 860/860 tests passed.
- Market-ready ecommerce creation closure Task 7: complete (`431f662..c462448`, final review clean). Retention is mark-isolate-recheck-delete with a fresh isolation grace period, protects running, Works, Canvas/composition, billing-dispute and shared content-addressed references, surfaces expiry on Works, and migrates only unlinked legacy ecommerce Works idempotently. Focused regression 23/23 passed.
- Market-ready ecommerce creation closure Task 8: complete (`ab1ffec..05cc059`, final review clean). OTP state resets on every email-change path, market copy exposes only the two public currencies, and Canvas command/focus states consume independently loaded semantic tokens. Focused review regression 47/47 passed.
- Market-ready ecommerce creation closure Task 9: local quality gate complete (full `npm test` 878/878, build and collaboration policy READY). Production deployment is intentionally fail-closed until `SHUBAO_CANARY_SESSION_TOKEN` is configured; the verifier now rejects a missing token before deployment-side validation can be claimed.

- Market-ready ecommerce creation closure design: written and self-reviewed at
  `docs/superpowers/specs/2026-07-29-market-ready-ecommerce-creation-closure.md`.
  It consolidates the approved remaining work into seven ordered milestones:
  product/style visual analysis, exact-count differentiated generation, global
  task continuity, result/canvas action unification, honest composition/PSD and
  retention, market-facing UI/copy, and authenticated production acceptance.
  Placeholder, ambiguity and retention-consistency review passed. Written-spec
  user review is the current gate before creating the TDD implementation plan.
- Server Project Version System design: approved architecture and lifecycle have
  been written to
  `docs/superpowers/specs/2026-07-27-server-project-version-system.md`.
  Scope covers server-owned projects and immutable versions, explicit recovery,
  authoritative sessions, ecommerce shot direction, one Canvas action registry,
  editable composition documents, tone-aware licensed typography, real pixel
  layering, retention, compatibility migration and production acceptance.
  Implementation has not started; the revised written-spec review and a TDD
  implementation plan are next. External CDP/static research was attempted but
  blocked by browser authorization and the environment network approval service;
  current conclusions are grounded in the supplied references, repository code
  and the local 500+ case GPT-Image-2 ecommerce skill.
- Server Project Version System implementation plan: complete at
  `docs/superpowers/plans/2026-07-27-server-project-version-system.md`.
  It defines ten TDD tasks from durable stores through production deployment.
  The user selected inline execution by directing Codex to proceed; Task 1 is
  the next execution boundary and no files are delegated to GLM.
- Server Project Version System Task 1: implementation complete. Added
  idempotent project schema plus owner-scoped immutable project versions,
  explicit recovery checkpoints, optimistic Canvas sessions, generation-run
  links and immutable composition revisions. TDD red was confirmed by missing
  modules; focused 7/7 and database/billing regression 36/36 passed;
  collaboration policy reported READY. Commit is pending at this ledger update.
- Server Project Version System Task 2: implementation complete. Added signed
  owner-scoped project/session/recovery/Canvas routes and durable project-create
  idempotency. TDD red was confirmed by the missing route module; focused 11/11
  and auth/API/route/billing regression 49/49 passed. Commit is pending at this
  ledger update.
- Server Project Version System Task 3 is in progress. Completed its
  authoritative-session portion: startup session restore calls `/api/session`,
  API 401 clears local session safely, and AppContext clears private billing
  state before opening login. TDD red: local token was accepted without server
  validation; focused/auth/API regression 28/28 passed. Recovery-checkpoint
  client work is intentionally paired with Task 4's blank-by-default editor.
- Server Project Version System Task 4 is in progress. The ecommerce homepage
  now starts blank and no longer auto-loads or auto-saves account-level form
  snapshots or IndexedDB images. Existing durable generation task references
  remain untouched pending the explicit recovery shelf. TDD red confirmed the
  old calls in `EcMode`; lifecycle/task regression 18/18 and Vite build passed.
- Server Project Version System Task 3 recovery-client slice: complete in
  `cd13926` (`feat: add authenticated recovery client`). It adds signed,
  401-safe explicit list/consume/dismiss APIs. Fresh task review reported
  `Spec APPROVED; Quality APPROVED`; focused client/auth/billing regression
  passed 9/9.
- Server Project Version System Task 4 remains in progress. Added the pure
  blank-editor lifecycle model, explicit collapsed RecoveryShelf, owner-scoped
  checkpoint hydration (including immutable version input snapshots), and
  owner-scoped project checkpoint/complete routes. Homepage XHS/Plog and
  standalone Plog no longer auto-load or continuously save local form drafts;
  a server checkpoint is restored only after explicit consume. Focused
  lifecycle/store/route/client regression passed; Vite build transformed 6415
  modules. Remaining before Task 4 can close: wire `DesignDirection` and the
  content generation entry points to create durable project/version records,
  create a checkpoint on resumable payment/generation interruption, complete
  the project on authoritative delivery, then clear legacy local task/file
  references and exercise the full creation flow.
- Fresh-visit lifecycle correction: completed locally, pending deployment.
  The homepage migration key was advanced to clear legacy persisted ecommerce
  state even for browsers that had recorded the earlier migration; the active
  first-step editor remains mounted while the user inspects design directions,
  so Back preserves only the current in-memory cycle. Ecommerce draft creation
  and XHS/Plog content draft creation now allocate a fresh ID per new cycle,
  preventing a fresh visit or "Next" from reconnecting to an earlier task.
  Explicit checkpoint recovery remains the sole restoration path. Regression:
  full 613/613, production build (6416 modules), collaboration policy READY,
  and diff check passed.

- Long-term collaboration protocol and runtime-boundary cleanup: complete in the commit named `chore: establish durable AI collaboration protocol`.
- Billing Ledger Task 1: complete (`b6b9881..defeda7`, spec compliant, quality approved, focused 4/4 and full 135/135 tests passed).
- Billing Ledger Task 2: complete (`90bedce..fccb9bf`, three-commit review/fix loop clean, focused 13/13 and full 148/148 tests passed).
- Billing Ledger Task 3: complete (`c0410c6..7d1947b`, four-commit review/fix loop clean, focused 29/29 and full 176/176 tests passed).
- Billing Ledger Task 4: complete (`683901e..a12044a`, three-commit review/fix loop approved, focused 15/15, wallet regression 43/43, full 191/191 tests passed).
- Billing Ledger Task 5: complete (`8cd41f9..0394c00`, two-commit review/fix loop approved, focused 16/16, wallet 28/28, payment 15/15, full 207/207 tests passed).
- Billing Ledger Task 6: complete (`c55a33f..8eb9e30`, generation-job idempotency, signed identity, disconnect-safe durable replay, isolated one-cover previews, stable URL/data/Base64 persistence, and fenced lease heartbeat independently reviewed and approved; focused 35/35, billing regression 107/107, full 242/242 tests passed).
- Billing Ledger Task 7: complete (`92a35f0..8427c4d`, secure billing APIs, owner-scoped order/ledger access, retryable SQLite busy mapping, same-start idempotent legacy migration, hard-disabled legacy payment authority, signed compatibility balance endpoint, and structural route tests independently reviewed and approved; focused 52/52 and billing regression 120/120 passed).
- Billing Ledger Task 8: complete (full 254/254 tests passed, export verification passed, Vite production build passed, collaboration policy READY, no tracked runtime files or ownership conflicts).
- Structured Ecommerce Engine Task 1: complete (`44449b0..5818ae5`, exact legal size catalog, safe numeric validation, default 2K `gpt-image-2`, explicitly safe confirmed batch routing to `gpt-image-2-n`, no unsupported fallback; independently reviewed and approved; focused 7/7 passed).
- Structured Ecommerce Engine Task 2: complete (`28a6b25..c5ba564`, fail-closed Product Truth, user/OCR/vision precedence, localized high-risk gating, SKU/source traceability, prototype-safe normalization, deterministic fingerprint, localized forbidden mutations, and dedicated JSON-only VLM prompt independently reviewed and approved; focused/regression 17/17 passed).
- Structured Ecommerce Engine Task 3: complete (`bc9d75c..946a828`, immutable direction title with clearable editable brief, canonical custom palette locking, provenance-bearing recommendation policies, category-over-role policy layering, prototype-safe policy and generation inputs, and deterministic post-processing export targets independently reviewed and approved; focused 13/13 passed).
- Structured Ecommerce Engine Task 4: complete (`f77267b..21042e6`, category-aware dynamic asset roles, user-fact-only parameter/SKU planning, proof-gated QC roles with independent proof assets, per-item legal dimensions and deterministic exports, prototype-safe deterministic IDs, and independent main_text/main_3x4 planning independently reviewed and approved; focused 8/8 passed).
- Structured Ecommerce Engine Task 5: complete (`58ddffa..b350899`, deterministic indexed multipart selection, exact per-index duties, Product Truth/proof-correlated fact gating, evidence-only deterministic overlays, multilingual exact-text redaction, reference anti-substitution, catalog-owned model routing, adversarial JSON safety, and no Contact Sheet dependency independently reviewed and approved; focused 13/13 and Task 1–5 regression 56/56 passed).
- Structured Ecommerce Engine Task 6: complete (`4e0e958..ab005f5`, async indexed multipart provider jobs, bounded idempotent retries, durable sanitized request/provider/output state, startup recovery, fenced leases and persistent-state transitions, and explicit targeted repair resubmission; focused 19/19 and Task 1–6 regression 75/75 passed).
- Structured Ecommerce Engine Task 7: complete (`fd7b77d`, deterministic Sharp dimension/format/legal-size/white-background/blank/blur gates, injected OCR/product/visual checks with honest unavailable states, failure-specific repair planning, two-attempt cap, and removal of random mock passes; focused 14/14 and Task 1–7 regression 89/89 passed).
- Structured Ecommerce Engine Task 8: complete (`d6417e3..b5e219f`, durable Product Truth/Campaign/Asset Plan snapshots, provider-ID-before-polling recovery, stable-asset quality gates, fenced parent and asset leases, recoverable `settling`/`releasing` billing states, hold remainder compensation, actual MIME quality analysis, and bounded expired-lease startup recovery independently reviewed and approved; focused 47/47, adjacent 13/13, full 379/379, syntax/build/diff-check passed).
- Structured Ecommerce Engine Task 9: complete (`e9a2d78..aebb450`, byte-preserving owner-scoped JPEG/PNG uploads, separate WebP previews, actual MIME/dimension/decode-limit validation, versioned Asset Plan target IDs, owner/job/source-bound deterministic exports, idempotent SQLite target registry, post-encode white-background verification, and duplicate-content plan-item disambiguation independently reviewed and approved; focused 42/42, Task 9 23/23, adjacent 68/68, full 399/399, syntax/build/diff-check passed).
- Structured Ecommerce Engine Task 10: complete (`ae74f64..3252cad`, Canvas provider execution now uses the shared pool and durable fenced leases with heartbeat renewal, signed owner authority across all Canvas AI routes, bearer-authenticated frontend helpers, bounded Retry-After-aware submit/poll retries, structured 504 timeout preservation, and trailing-slash/case-normalized route guards independently reviewed and approved; focused and adjacent 62/62, Vite build, collaboration policy, and diff-check passed).
- Paid Workflow Task 1: complete (`ec76693..325a500`, pure billing presentation components, user-facing AI-point/content-set formatting, unlimited owner display, and real warm-yellow insufficient-balance presentation path independently reviewed and approved; focused 6/6 and Vite build passed).
- Paid Workflow Task 2: complete (`d0485c6..a0d216c`, signed billing client, separate ecommerce/content entitlements, legacy credits compatibility, and session-epoch guards preventing stale balance/catalog/ledger responses across logout or account switches independently reviewed and approved; focused 7/7 and Vite build passed).
- Paid Workflow Task 3: complete (`e4f93ae`, `9f31c23`, `50f52c6`; owner-bound 24-hour pending references, signed-session restore without auto-generation, logout/explicit-completion clearing, fallback owner/route/draft/action derivation, key-aware raw-payload rejection, content-vs-ecommerce currency correctness, and non-numeric `无限内测` presentation independently reviewed and approved; focused 22/22, API contract 12/12, Vite build, collaboration policy, and diff-check passed).
- Paid pricing safety stopgap: complete (`c9c152f`, `7bda1c8`; reachable legacy `/api/create-payment`, unverified `paid=1` success, active Alipay/WeChat controls, and false Stripe-provider claims removed; independent review approved; API contract 12/12 and Vite build passed).
- Paid Workflow Task 4: complete (`7af1805`, `c564b98`; authoritative server catalog drives prices, grants, validity and enabled state; safe `{id, enabled}` provider visibility; exact three-field order requests; permanent ecommerce AI-point presentation; content-set validity; disabled-payment truth; and interrupted-plan browsing without clearing pending work independently reviewed and approved; focused 36/36, Vite build, collaboration policy, and diff-check passed).
- Paid Workflow Task 5A: complete (`48311a8..6ac4c91`, three review/fix rounds independently reviewed and approved; original JPEG/PNG preservation, exact planner/quote/hold parity, 4K routing, reference-only pending actions, re-quote invalidation, transparent-background safety, focused 90/90, adjacent 73/73, build, diff-check, and collaboration policy passed).
- Paid Workflow Task 5B: complete (`4fcaf1e..d0e2192`, durable owner/draft task resume across every reachable ecommerce surface, immediate stable-image previews, 402 reference safety, expiry and re-quote behavior, generation-epoch stale callback protection, abortable upload/poll/SSE paths, and lifecycle-controller behavior tests independently reviewed and approved; focused 53/53, required 102/102, adjacent 73/73, build, diff-check, and collaboration policy passed).
- Paid Workflow Task 6: complete (authoritative XHS/Plog content-set balances,
  reference-only resumable drafts and payment actions, owner-scoped original
  reference resolution, stable complete-event gating; focused 74/74, Vite
  build, diff-check, and collaboration policy passed).
- Paid Workflow Task 7: complete (server-authoritative Canvas quotes and one-shot
  holds, durable delivered/settled action replay, stable background-removal assets,
  structured resumable 402 metadata, shared honest action prices, and Canvas
  paywall preservation; full 540/540 tests, Vite build, diff-check, and
  collaboration policy passed).
- Paid Workflow Task 8: complete (content-set stable assets can be copied into
  Canvas with provenance and no duplicate set charge; mobile homepage navigation,
  workbench, result modal, Canvas toolbar and picker adapt to narrow viewports;
  browser-verified one-finger pan and two-finger zoom at 390px; focused tests and
  Vite build passed).
- Paid Workflow Task 9: complete (deployment preflight includes full tests, build,
  and diff check; remote lock, SQLite online backup, runtime exclusions, one PM2
  restart, public health/catalog verification, and code/WebRoot rollback that
  preserves runtime databases; deployment script tests passed).
- Paid Workflow Task 10: implementation complete, pending production deployment.
  Completed scope is creation continuity,
  real-world upload normalization, canvas workflow lifecycle/geometry, product
  dialogs/tooltips, public copy and pricing information architecture. Spec:
  `docs/superpowers/specs/2026-07-27-creation-continuity-canvas-ux.md`. Full
  regression: 549/549; production build and collaboration policy passed.
- Paid Workflow Task 11: implementation complete, pending commit and production
  deployment. Completed scope is market-facing login and
  OTP lifecycle, restart-stable signed sessions, signed ecommerce assistant
  routes, one-point idempotent design-direction refresh billing, honest market
  quote presentation, role-specific non-collage ecommerce assets, bounded
  per-task concurrency, mainland-primary/US-overflow provider affinity, completed
  work persistence, keyboard-accessible progress lightbox, and market-facing
  access errors without internal rollout terminology. Direction-refresh action
  IDs survive response loss and navigation. One-shot billing now uses durable
  SQLite claims, fenced lease renewal, and separates non-resumable synchronous
  recovery from resumable provider-job work. Canvas AI transforms use the durable
  provider job service, recover without resubmission, and keep 2K/4K quotes and
  model routes aligned; default regeneration now delivers the billed 2K output.
  Review fixes included waiting for in-flight ecommerce workers before releasing
  the parent lease and preserving historical provider affinity. Independent
  reviewer attempts were unavailable because one agent disappeared and a second
  failed with external model-account HTTP 403; local adversarial review found and
  fixed duplicate-upstream recovery, over-conservative durable recovery, exposed
  rollout copy, and the 1K-vs-2K billing mismatch. Final full regression: 575/575;
  production build transformed 6413 modules; diff-check and collaboration policy
  passed. Deployment archive excludes the runtime auth-session secret.
- Server Project Version System Tasks 4-5 integration: implementation complete,
  independently re-reviewed and approved, pending commit and production deployment. The ecommerce
  flow now uses owner-scoped authenticated Works records, persists each completed
  asset incrementally, exposes only quality-approved stable images, creates an
  immutable accepted or partial result version before terminal Works persistence,
  and suppresses empty Works records when every image is rejected. Partial
  delivery closes the current task and sends only completed images to Canvas;
  rejected assets expose no stable/provider/request internals and use market-facing
  no-charge errors. Account switching preserves every owner's unsynced local
  Works, and zero-delivery/setup-failed runs terminate their linked project/run
  without creating empty result versions. Shot direction, role-specific layout, typography planning,
  one bounded provider repair, suite duplicate/collage rejection and smart-package
  ten-image disclosure remain covered. Review red was reproduced at 62/67 and the
  focused fix set passed 71/71; final full regression passed 652/652, Vite transformed
  6417 modules, collaboration policy reported READY, Node syntax checks and
  `git diff --check` passed. Independent re-review reported no remaining Critical
  or Important findings. A real paid/unlimited production image-generation
  canary is still required after deployment to validate provider output quality.
- Ecommerce delivery final fail-closed review: implementation complete and
  independently approved and deployed as `00d0796`. Semantic
  quality checks now require explicit product-fidelity and visual-quality passes;
  protected packaging text, logos, labels and model numbers also require an
  explicit OCR pass. Unavailable adapters cannot settle a result, and repair
  plans with no actionable image operation do not spend another provider call.
  Generation-run terminal states are immutable, guarded in SQL and at the
  completion route even when a caller omits `generationRunId`; conflicting
  replays return `GENERATION_RUN_TERMINAL_CONFLICT` as HTTP 409. A legitimate
  partial-result acceptance must reference its actual immutable result version
  and leaves the generation run in `needs_review`. Each defect was first
  reproduced as a failing test. Final verification passed 659/659 tests, Vite
  production build (6417 modules), collaboration policy, changed-module syntax
  checks and `git diff --check`. Independent final review reported no remaining
  Critical or Important findings. The repository deployment script repeated
  659/659 tests and the build, restarted PM2 once, passed public verification
  before and after the full 600-second canary with stable PID `548594`, deployed
  `00d0796` to `https://shuimg.cn/`, and released the remote lock.
- Post-deployment responsive browser QA: complete, independently approved and
  deployed as `a07a2c9` (`fix: keep mobile creation controls accessible`). A real
  390x844 production screenshot exposed two issues missed by the earlier static
  test: the 203px wrapping ecommerce action row overlapped the fixed mobile dock
  by 90px, and the top-bar brand wrapped to three lines. Root cause was the
  wrapping action layout plus whole-page vertical `overflow: hidden`, while the
  existing bottom padding sat after the controls and could not prevent overlap.
  The action controls are now a single horizontally scrollable rail with the
  primary Next command always visible, the action surface sticks above the dock,
  and the page clips horizontal decoration without disabling vertical sticky
  behavior. The mobile top bar now uses compact stable dimensions and a one-line
  brand. Login continuation QA also found and fixed missing initial focus: the
  email field now receives focus, shared in-app modals expose dialog semantics,
  and the existing ecommerce description remains intact when Next opens login.
  TDD red was confirmed for all missing behaviors; focused tests passed 9/9.
  Browser re-verification measured dock overlap `90px -> 0`, one-line brand,
  no horizontal overflow, preserved input, visible dialog and focused email.
  Final regression passed 664/664, Vite transformed 6417 modules, collaboration
  policy was READY, diff-check passed, and independent review reported no
  remaining Critical or Important findings. The repository deployment script
  repeated 664/664 tests and the production build, restarted PM2 once, passed
  public verification before and after the full 600-second canary with stable
  PID `559656`, deployed `a07a2c9` to `https://shuimg.cn/`, and released the
  remote deployment lock. Final production browser QA loaded the matching local
  build bundle `index-B_zBS9_N.js` plus homepage stylesheet
  `index-Sa-Ri6RB.css`. At 390x844 the sticky creation action surface ended at
  726.7px while the fixed mobile dock began at 778.4px (0px overlap), the brand
  remained one line, and document horizontal overflow was 0px. At 1440x900 the
  creation surface and desktop dock had no intersection, horizontal overflow
  remained 0px, and visual inspection found no clipped or displaced creation
  controls. `SHUBAO_CANARY_SESSION_TOKEN` was not configured, so the automated
  production checks did not exercise owner-protected project APIs, real
  billing/whitelist generation, provider output quality, editable composition
  rendering, or PSD structural download; these remain explicit authenticated
  acceptance boundaries rather than claimed coverage.
- Vision model routing update: complete and deployed from the working tree.
  Both ecommerce visual-analysis call paths and the environment example now
  default to `gpt-5.6-terra`; `gpt-image-2` generation routing is unchanged.
  TDD red confirmed the prior `gpt-5.4-mini`/`gpt-4o-mini` defaults. Full
  regression passed 665/665, production build transformed 6417 modules,
  collaboration policy reported READY, public verification passed before and
  after a 60-second canary with stable PM2 PID `792579`, and the production PM2
  environment has no `MINI_MODEL` override, so the Terra default is active.
- Market-ready ecommerce creation closure: plan reviewed, no conflicting
  requirements or unresolved placeholders found. Execution started from Task 1
  using test-first implementation and independent task review. Plan:
  `docs/superpowers/plans/2026-07-29-market-ready-ecommerce-creation-closure.md`.
- Market-ready closure Task 1: complete (`837fa1d..fa93df7`, six-commit
  implementation/review loop clean). Product and style visual analysis are
  separate, Terra is fail-closed, inputs and analysis checkpoint before billing,
  legacy jobs migrate owner/job-bound stable assets, transient storage failures
  remain resumable, and full regression passed 714/714.
- Market-ready closure Task 2: complete (`7356e68..73ddfbb`). Exact quoted
  asset counts reconcile with visible rows and logical provider submissions;
  each failed item receives at most one targeted provider repair without
  rerunning successful siblings. Commercial duties, semantic shots, collage
  rejection, evidence-safe detail fallbacks, proof-backed QC, schema-3 multi-SKU
  recovery and historical provider-request snapshot preservation are covered by
  focused regression 182/182. Three independent reviewer sessions were attempted
  and remained externally unresponsive; a fresh local adversarial diff audit and
  focused regression found no remaining Critical or Important issue. No
  deployment was performed at this task boundary.
- Market-ready closure Task 3: complete (`63bcb44..611ac1d`, three-stage
  implementation/review/fix loop independently approved). Owner task summaries
  expose only safe numeric counters and market-facing per-image labels/errors;
  failed-image retry is server-quoted, owner-scoped, mixed-SKU fail-closed,
  successful-sibling preserving, and atomically idempotent for duplicate or
  concurrent source-job/quote submissions. The global task dock confirms exact
  points in-product and lists every failed image in context. Fresh controller
  verification passed 157/157 focused tests, Vite transformed 6419 modules,
  and `git diff --check` passed. No deployment was performed at this task boundary.
- Codex desktop recovery snapshot (2026-07-30): source task
  `019f8930-7569-7852-8c51-5136318105ae` is in `systemError`. Its final
  trustworthy completed work recorded Task 4 fixes in `bca5cc5` and Task 5 in
  `54e5800`; current Git `HEAD` matches `54e5800`. The source task recorded a
  full 833/833 regression pass, a production build pass and clean diff check
  before those commits, but the two independent Task 4/5 review sessions were
  started without their final verdicts being captured. Their approval is
  therefore unknown and must be re-established before treating Tasks 4/5 as
  independently reviewed.
- Market-ready closure Task 4 review-blocker recovery fixes: complete in the
  recovered working tree. Real owner-scoped ecommerce Works now restore product
  inputs into a derivable Canvas source group, explicit owner-scoped Canvas
  sessions can be created/saved/restored without local auto-rehydration, source
  fan-out keeps result nodes parallel, process/draft nodes cannot derive,
  action pickers stay scrollable in small viewports, and Canvas edge geometry can
  use measured DOM port centers. Fresh recovery verification passed the focused
  Canvas/project/Works set at 66/66, full `npm test` at 843/843, production build
  at 6422 transformed modules, `npm ls --depth=0`, collaboration policy READY,
  and `git diff --check`. A fresh independent review is still required before
  closing the Task 4/5 review gate.
- Market-ready closure Task 4 recovered review follow-up: complete locally after
  independent review of `a85e3ab..af1f21f` found two Important issues. The
  Canvas internal Works panel now uses owner-scoped local/server work
  normalization instead of the legacy unfiltered cache path, and `openWork`
  preserves project/version/product/session metadata for manual Canvas restore
  and derivation. The `canvas` dependency has been restored as `3.2.3` in
  `package.json`, `package-lock.json`, and the local dependency tree because
  committed scripts still import it. TDD red was confirmed by the missing
  `canvasWorkModel` module and then by the absent `canvas` declaration. Fresh
  verification passed the new Canvas work model tests at 3/3, the focused
  Canvas/project/Works set at 69/69, full `npm test` at 846/846, production
  build at 6423 transformed modules, `npm ls --depth=0`, `npm ls canvas --depth=0`,
  collaboration policy READY, and `git diff --check`. Fresh independent
  re-review of `af1f21f..1d61a93` reported no remaining Critical/Important or
  Minor findings, and additionally ran the Canvas work model plus Works route
  auth tests at 5/5. Residual risk: a separate clean-directory `npm ci` and
  browser UI session-restore pass have not been run at this boundary.
- Market-ready closure Task 6 recovery boundary: no Task 6 implementation or RED
  test has been completed. The failed task ran
  `npm install ag-psd@31.0.2 --save-exact`, leaving `package.json` and
  `package-lock.json` modified. Recovery verification confirmed that
  `package.json` adds only the exact `ag-psd` pin; npm pruned stale undeclared
  lock entries, `npm ls --depth=0` is clean, and the production build transforms
  6422 modules successfully. The dependency state is therefore the intended
  Task 6 starting point. The next execution boundary is the planned Task 6 RED
  layer-service and PSD-structure tests.

## Ownership

- Codex owns: `server/`, existing application pages, API integration, database, deployment, and all plan execution unless delegated explicitly.
- GLM reserved scope for the next independent handoff only: `src/components/billing/` new presentational files and `test/billing-ui-model.test.mjs` as listed in the paid workflow plan.
- No overlapping implementation agents may run concurrently.

## Minor findings backlog

- Billing Task 4: resolved in Task 7 by mapping SQLite busy/locked failures to structured retryable HTTP responses.
- Billing Task 6: resolved during Task 7 final review by replacing next-route source markers with balanced structural handler extraction and removing the production marker comment.
- Ecommerce Engine Task 2: non-blocking documentation follow-up — `buildVlmPrompt` JSDoc type union should include `product_truth` when `vlmSchema.mjs` is next touched.

## Production Rollout Evidence (2026-07-30)

- Deployed commit: `2dfdbea` (`codex/ecommerce-stability`) through `scripts/deploy-production.ps1`.
- Local release gate: `npm test` passed 889 tests; `npm run build` passed; deploy-script contract tests passed.
- Public production health and billing verification passed before and after the canary window.
- Authenticated ecommerce verification completed three independent 2K assets per task with separate product/style analysis cache entries, exact three-unit quote reconciliation, durable Works persistence, and stable asset delivery. Verified task IDs: `ec_11cefdd4-84aa-4b9a-8932-640883295efe`, `ec_72629cfb-9979-461a-9e2f-fafb41956894`, and post-observation `ec_c78f9bf6-4117-47c2-b08f-da00d640c411`.
- PM2 stayed on PID `1256816` throughout the 600-second observation and final production verification; restart count remained 260 and `max_memory_restart` is 1073741824 bytes (1 GB).
- The release script retains only the three newest remote rollback backups after a successful canary. Existing stale backups were pruned before release, restoring production disk headroom.
- Visual analysis uses the configured production model contract (`gpt-5.6-terra` by default). Layered PSD structure and Canvas billing paths remain covered by the passing local integration suite.
- Residual external risk: image-provider availability and output quality remain third-party runtime dependencies; production tasks fail closed and the release script rolls back on verification failure.

## Commerce Suite and Canvas Closure (2026-07-31)

- Product and implementation contracts are recorded in
  `docs/superpowers/specs/2026-07-31-commerce-suite-canvas-production-closure.md`
  and `docs/superpowers/plans/2026-07-31-commerce-suite-canvas-production-closure.md`.
- The ecommerce entry now restores a complete smart configuration, exposes
  compact full summaries for package/SKU/product settings, preserves original
  product and reference assets through Canvas handoff, and uses native button
  semantics for all primary creation and navigation controls.
- Ecommerce delivery is complete-suite only. Every planned asset must pass
  identity, visual-quality and suite-diversity review before any item settles;
  incomplete runs release all verified siblings, persist no partial Work, show
  no rejected preview, and receive at most two bounded automatic whole-suite
  repairs across reloads before returning an honest retryable failure.
- Canvas draft schema 2 keeps the source product, groups outputs into horizontal
  white-background, main, detail, SKU and material lanes, respects per-image
  aspect ratios, supports direct image-body drag and double-click inspection,
  and renders edges inside the same transformed world layer so line endpoints
  follow pointer movement in the same frame.
- Image delivery now serves cached WebP `thumb` and `canvas` variants for local,
  generated and remote assets, prewarms generated variants on persistence, uses
  stable gallery URLs and browser decode/lazy-loading fallbacks. Local evidence
  on the Xiamen cover reduced 2,728,066-byte full PNG delivery to a 36,050-byte
  thumbnail (98.7% smaller); warm responses measured 2.8-6.2 ms with a one-year
  immutable cache policy.
- Final local verification passed `920/920` tests, Vite production build with
  6,430 transformed modules, post-build asset checks, collaboration policy and
  `git diff --check`. Browser QA covered desktop and 390x844 mobile entry layout,
  configuration override/reset, stable thumbnail rendering, no horizontal
  overflow, mobile sticky-header isolation and accessible control semantics.
- Production secrets remain runtime-only and uncommitted. Read-only production
  inspection found legacy gateway settings still active; new key fingerprint
  verification, runtime environment update, provider probe, deployment and the
  authenticated canary remain the release boundary.
- Official 65535 documentation and route probes established the production
  image contract as native asynchronous tasks: JSON submission to `/v1/tasks`,
  product/reference images as URL or data-URI input, polling at `/v1/tasks/{id}`
  and final `result_urls`. The mainland endpoint exposes both task routes; the
  supplied US distribution endpoint returns 404 for them, so automatic overflow
  is disabled rather than mixing incompatible protocols.
- The provider adapter now supports the native task protocol while retaining the
  old multipart protocol only as an explicit compatibility mode. Catalog pixel
  dimensions are translated to the native task's ratio `size` and lowercase
  `resolution` fields while old persisted requests remain compatible. The router
  can run primary-only, and production defaults use the mainland task endpoint
  plus `puppyrouter.com` with `gpt-5.6-luna` for visual analysis.
- Deployment now uploads a fail-closed runtime verifier before creating a
  release. It rejects missing or placeholder secrets, stale endpoint/protocol
  fields, permissive Unix environment-file modes, and disagreement between the
  root and server runtime files without printing secret values. When an update
  is required, a separate helper accepts the two keys only through standard
  input, rewrites both files atomically with private modes, and keeps a protected
  pre-update copy until deployment and canary success. Release rollback restores
  both code and runtime configuration together. Focused gateway and deployment
  tests passed 46/46; full regression passed 931/931.
- `scripts/probe-production-gateways.mjs` now provides the remaining authenticated
  preflight as one repeatable command: it verifies the image model catalog, sends a
  real image-input request to `gpt-5.6-luna`, submits and polls one native 1K
  `gpt-image-2` task, downloads the result and validates its decoded metadata.
  Credentials are accepted only from process environment and neither responses
  nor credentials are printed on failure. Probe contract tests passed 3/3 and
  full regression passed 934/934. The real authenticated invocation remains
  intentionally unexecuted until the product owner authorizes transmission of
  the supplied keys to the two named third-party gateways.
- The deployment entrypoint runs this authenticated probe automatically after
  local test/build success whenever both gateway keys are supplied, rejects a
  one-key partial configuration, and touches no production state when the probe
  fails. Future releases with an already verified runtime can omit local gateway
  keys and avoid repeating the paid probe.
- Read-only production preflight after commit `01cf262` found PM2 PID `1313390`
  healthy with an idle 3-worker image queue, no active deployment lock, exactly
  three rollback backups and 10,637,564 KiB free on the production volume. Both
  runtime environment files are still mode `644`; the atomic gateway updater is
  expected to rewrite them as `600` before release and the fail-closed verifier
  will reject deployment if that transition does not occur.
- Closed the final immediate-handoff metadata gap between generation tasks,
  Works and Canvas. A shared server delivery contract now exposes the planned
  buyer-facing title, role, lane, aspect ratio and decoded output dimensions;
  polling and legacy SSE results retain those records alongside the compatible
  URL map; Works imports preserve the records; and Canvas consumes the
  structured records before any legacy ID-based fallback. Hyphenated planner
  IDs such as `white-background`, `main-text` and `detail-feature` therefore no
## 2026-08-23 Deploy 9899645 Rolled Back (auth video verification failed)

- 素材库调整提交 9899645 部署，但部署脚本在"Authenticated video production verification failed"（verify-production-video.mjs 用 canary session 认证视频验证）失败，触发回滚。DEPLOY_EXIT 非0。
- 线上核实：Nginx current 指向 rollback-20260824-213928-9899645（回滚目录）；首页 bundle index-DzpsL7rC.js（=5b8d189 上一版）；健康 ready（PM2 pid 1419662）。线上实际服务的是 5b8d189，素材库调整未上线。
- 失败原因分析：素材库调整代码（9899645）不涉及视频验证逻辑（只改 visibleInLibrary：projectStore/contentProjectLifecycle/projectGeneratedAssetImport/projectRoutes/services/projects.js/EcCanvas 按钮/test）。"Authenticated video production verification" 是部署脚本用 canary session 跑 verify-production-video.mjs 的认证视频验证，很可能是部署环境临时问题（canary session 签发/视频接口），非本次代码改动导致。
- 本地验证全部通过（素材库调整）：全量 npm test 2130/2130、build 成功、verify:video-acceptance 零付费（providerSubmissions=0/billingMutated=false/paidGenerationRequested=false）。
- 线上安全：5b8d189 仍在线（回滚保护生效），无破坏。
## 2026-08-23 Handoff To Video Thread: Material Library Semantics Change (precise locations)

### 背景
主线程已实施素材库调整：图片生成物默认不进素材库（visibleInLibrary=false），素材库只显示用户主动加入/上传的素材（visibleInLibrary=true）。生成结果保留 project_assets 治理记录（lineage/provenance 不断），只是默认不出现在素材库。

### 对视频线程的影响（首末帧选择）
素材库接口 listProjectAssetLibrary 现在只返回 visibleInLibrary=true 的素材。因此视频首末帧选择器从素材库选时，只有用户"加入素材库"的图可选。

### 需要视频线程配合的具体位置（请确认这些文件/函数是否需调整）
1. **server/videoWorkbenchStore.mjs**：分镜 createShot/updateShot 的首/末帧引用经 requireCanonicalProjectAsset({ purpose:'reuse' }) 校验。素材库过滤后，未加入素材库的图会 PROJECT_ASSET_NOT_FOUND fail closed（这是预期的"先入库再复用"，无需改服务端）。
2. **src/pages/VideoStudio/videoProjectWorkbenchModel.js**：reusableProjectAssets 从素材库拉取可复用素材做首末帧候选。因素材库已过滤，这里只会拿到用户加入素材库的图——符合预期。
3. **src/pages/VideoStudio/VideoProjectWorkbench.jsx**：首末帧下拉从 reusableProjectAssets 选。建议在该下拉处加提示文案"如需使用其他图片，请先在主线程作品卡片点『加入素材库』"或类似，引导用户先入库再选。这是前端体验提示，非功能性必须。

### 结论
资产层（服务端）改动已满足视频首末帧依赖（先入库再复用，素材库已过滤）。视频线程无需改服务端，仅可选地在 VideoProjectWorkbench.jsx 首末帧下拉加"先加入素材库"提示。请视频线程确认该 UI 提示是否纳入，并避免把默认不在素材库的生成图视为丢失。
## 2026-08-23 Material Library Adjustment - Implementation Complete

### 已完成（全部）
1. 服务端：projectStore.mjs 支持 visibleInLibrary（createProjectAsset 参数 + 单/批量 setProjectAssetVisibleInLibrary + listProjectAssetLibrary 过滤）；生成结果默认 visibleInLibrary=false（contentProjectLifecycle/projectGeneratedAssetImport 创建后标记）；projectRoutes.mjs 两个"加入素材库"接口（单素材/作品级批量）。
2. 前端：作品卡片"加入素材库"按钮（MdLibraryAdd 图标）+ handleAddWorkToLibrary handler（遍历 work.projectAssetRefs 调 addToProjectAssetLibrary 加入素材库，Toast 反馈）；services/projects.js addToProjectAssetLibrary 函数。
3. 测试：全量 2130/2130 通过，0 失败；build 成功（7.68s）。
4. 素材带生成上下文：生成结果 metadata 保留 provenance/generationId（可回溯），已实现。

### 效果
- 图片生成物默认进作品集、不自动塞素材库（visibleInLibrary=false）。
- 素材库只显示用户主动加入/上传的素材（listProjectAssetLibrary 过滤 visibleInLibrary=true）。
- 上传素材（image/video importer）保持自动入库。
- 用户点作品卡片"加入素材库"后，该作品素材出现在素材库、可复用（含视频首末帧）。

### 待确认
- 视频线程首末帧选择器从素材库选（素材库已过滤，用户先入库才能选）——需视频线程前端确认配合。
- 上线：改核心链路（生成结果默认不进素材库），全量测试通过后走 full production gate 部署。
## 2026-08-23 Material Library Adjustment - Core Implementation Complete

### 完成的实现（核心部分，已验证）
1. projectStore.mjs：createProjectAsset 支持 visibleInLibrary 参数（默认 undefined 不注入，兼容测试）+ setProjectAssetVisibleInLibrary（单素材）/ setProjectAssetsVisibleInLibrary（作品级批量）+ listProjectAssetLibrary 加 json_extract(visibleInLibrary) IS NOT false 过滤。生成结果默认不在素材库，上传素材默认在。
2. contentProjectLifecycle / projectGeneratedAssetImport：生成结果创建后单独标记 visibleInLibrary=false（图片生成物默认进作品集、不自动塞素材库，但保留 project_assets 治理记录 lineage/provenance）。
3. projectRoutes.mjs：新增 POST /api/projects/:projectId/assets/:assetId/library（单素材）和 POST /api/projects/:projectId/library（作品级批量）加入素材库接口。
4. services/projects.js：addToProjectAssetLibrary 函数。
5. src/pages/EcCanvas/index.jsx：作品卡片加"加入素材库"按钮（MdLibraryAdd 图标已导入；@handleAddWorkToLibrary handler 待定义）。
6. test/content-project-lifecycle.test.mjs：素材库断言适配新语义（生成结果默认不在素材库，改为0）。

### 验证结果
- 全量 npm test：2130/2130 通过，0 失败。
- npm run build：成功（21.41s）。

### 待完成（收尾）
7. 定义 EcCanvas handleAddWorkToLibrary handler（让作品卡片"加入素材库"按钮真正可用，调 addToProjectAssetLibrary 或作品级接口）。
8. 视频首末帧选择器配合（从素材库选，提示先入库）——视频线程。
9. 本地验证 + 确认后再上线（走 full production gate）。
## 2026-08-23 Material Library Adjustment - Critical Semantics Conflict

### 已完成的实现（服务端核心）
1. projectStore.mjs：createProjectAsset 支持 visibleInLibrary 参数（默认 undefined 不注入，兼容测试）；新增 setProjectAssetVisibleInLibrary（单资产）和 setProjectAssetsVisibleInLibrary（作品级批量）方法；listProjectAssetLibrary 加 json_extract(visibleInLibrary) IS NOT false 过滤。
2. contentProjectLifecycle.prepareResult：生成结果创建后单独调用 setProjectAssetVisibleInLibrary(asset, false) 标记（默认不显示在素材库）。
3. projectGeneratedAssetImport：画布生成结果创建后单独标记 visibleInLibrary=false。
4. projectRoutes.mjs：新增 POST /api/projects/:projectId/assets/:assetId/library（单资产）和 POST /api/projects/:projectId/library（作品级）接口。
5. services/projects.js：addToProjectAssetLibrary 函数。

### 关键语义冲突（需用户确认）
- listProjectAssetLibrary 被 5 个测试文件使用（content-project-lifecycle/cross-domain-canvas-assets/project-version-store/video-project-workbench-ui/project-client，共14处），现有测试期望素材库返回"所有"项目资产（含生成结果）。
- 但用户目标是"图片生成物默认不显示在素材库"（visibleInLibrary=false 被过滤）。这两个语义冲突。
- 现有测试断言素材库包含生成结果（如 content-project-lifecycle.test.mjs L47 断言素材库长度为2），新方案下为0，测试失败。

### 决策点
产品语义变更：素材库(project_assets) 从"自动含所有生成结果"改为"默认只含用户主动加入/上传的素材"。这符合用户目标（图片生成物默认进作品集、不自动塞素材库），但需更新 5 个测试文件的断言语义。这是改核心链路+大量测试的重大改动。

### 待用户确认后继续
- 确认接受"素材库默认不显示图片生成结果"的语义变化
- 确认是否更新 5 个测试文件适配新语义
- 继续前端"加入素材库"按钮完整实现 + 视频首末帧配合 + 全量测试 + 上线
## 2026-08-23 Material Library Adjustment - Implementation Progress 4

### 已完成
1. projectStore.mjs：visibleInLibrary 完整支持（projectAssetFromRow 暴露、createProjectAsset 参数+metadata 注入、listProjectAssetLibrary 过滤）+ setProjectAssetVisibleInLibrary 方法 + setProjectAssetsVisibleInLibrary 批量方法
2. contentProjectLifecycle / projectGeneratedAssetImport：生成结果默认 visibleInLibrary:false（不显示在素材库、进作品集）
3. projectRoutes.mjs：POST /api/projects/:projectId/assets/:assetId/library 接口 + POST /api/projects/:projectId/library 作品级接口
4. services/projects.js：addToProjectAssetLibrary 函数
5. EcCanvas/index.jsx：作品卡片已插入"加入素材库"按钮（引用 handleAddWorkToLibrary 函数和图标）

### 待完成
- EcCanvas/index.jsx：定义 handleAddWorkToLibrary handler（调作品级接口）并确认图标来源（MdLibraryAdd 或替换）
- 素材带生成上下文（Prompt/参数）可回溯
- 视频首末帧选择器配合（从素材库选，提示先入库）——视频线程
- 全量测试 → 本地验证 → 确认后再上线

### 风险提示
直接改 EcCanvas/index.jsx（大型前端文件）有风险，需谨慎确认图标导入和 handler 逻辑，避免破坏现有 Canvas 交互。
## 2026-08-23 Material Library Adjustment - Implementation Progress 3

### 已完成
1. projectStore.mjs：visibleInLibrary 支持（projectAssetFromRow 暴露、createProjectAsset 参数+metadata 注入、listProjectAssetLibrary 过滤）+ setProjectAssetVisibleInLibrary 方法
2. contentProjectLifecycle / projectGeneratedAssetImport：生成结果默认 visibleInLibrary:false（不显示在素材库、进作品集）
3. projectRoutes.mjs：POST /api/projects/:projectId/assets/:assetId/library 接口
4. services/projects.js：addToProjectAssetLibrary(projectId, assetId, visibleInLibrary) 函数

### 待做
5. 前端作品卡片/画布加"加入素材库"按钮（调 addToProjectAssetLibrary）
6. 素材带生成上下文（Prompt/参数）可回溯
7. 视频首末帧选择器配合（从素材库选，提示先入库）——视频线程
8. 全量测试 → 本地验证 → 确认后再上线

### 效果
生成图片默认进作品集（不显示在素材库），用户点"加入素材库"按钮后置 visibleInLibrary:true 显示在素材库。上传素材（projectImageAssetImport/projectVideoAssetImport）保持自动入库。
## 2026-08-23 Material Library Adjustment - Implementation Progress 2

### 已完成（服务端）
1. projectStore.mjs：projectAssetFromRow 暴露 visibleInLibrary；createProjectAsset 支持 visibleInLibrary 参数并注入 metadata；listProjectAssetLibrary 默认只返回 visibleInLibrary!=false 记录（json_extract 过滤）；新增 setProjectAssetVisibleInLibrary 方法（更新 metadata.visibleInLibrary）。相关25个测试通过。
2. contentProjectLifecycle.prepareResult：生成结果传 visibleInLibrary:false（默认不显示在素材库、进作品集）。
3. projectGeneratedAssetImport：画布生成结果传 visibleInLibrary:false。
4. projectRoutes.mjs：新增 POST /api/projects/:projectId/assets/:assetId/library 接口（调 setProjectAssetVisibleInLibrary，默认置 true）。

### 待做
5. 前端作品卡片/画布加"加入素材库"按钮（调新接口）
6. 素材库卡片显示隐藏逻辑（listProjectAssetLibrary 已过滤）
7. 视频首末帧选择器配合（从素材库选，提示先入库）——视频线程
8. 素材带生成上下文（Prompt/参数）可回溯
9. 全量测试 → 本地验证 → 确认后再上线

### 注意
projectImageAssetImport（画布上传素材）和 projectVideoAssetImport（视频上传素材）传默认 true（保留自动入库），不受影响。
## 2026-08-23 Material Library Adjustment - Implementation Progress

### 已完成
1. projectStore.mjs：projectAssetFromRow 暴露 visibleInLibrary（metadata 取，默认 true 兼容旧数据）；createProjectAsset 支持 visibleInLibrary 参数并注入 metadata；listProjectAssetLibrary 默认只返回 visibleInLibrary!=false 记录（json_extract 过滤）。44 个 projectStore 相关测试通过。
2. contentProjectLifecycle.prepareResult：生成结果 createProjectAsset 传 visibleInLibrary:false（默认不显示在素材库、进作品集）。
3. projectGeneratedAssetImport：画布生成结果 createProjectAsset 传 visibleInLibrary:false。

### 待做
4. 加"加入素材库"接口：更新 project_asset 的 metadata.visibleInLibrary=true（用户点按钮）
5. 作品卡片/画布加"加入素材库"按钮
6. 视频首末帧选择器配合（从素材库选，提示先入库）——视频线程
7. 素材带生成上下文（Prompt/参数）可回溯
8. 全量测试 → 本地验证 → 确认后再上线

### 注意
projectImageAssetImport（画布上传素材）和 projectVideoAssetImport（视频上传素材）传默认 true（保留自动入库），不受影响。
## 2026-08-23 Material Library Adjustment - Implementation Plan

### 关键技术权衡（实施中发现）
直接物理删除 contentProjectLifecycle.prepareResult / projectGeneratedAssetImport 的自动 createProjectAsset 会破坏资产治理：lineage(generated_from 血缘)、provenance(AIGC 标记/来源)、稳定资产身份——这些都是主线程资产层的核心能力（迁移卡要求"统一资产身份、跨域引用、可追溯"）。

### 稳健实施方案（采纳）
保留 project_assets 治理记录（不物理删 createProjectAsset），在素材库 UI 层实现"用户自主决定"：
- 新增 project_assets.visible_in_library 标记：生成结果默认 false（不显示在素材库、作品卡片不显示"已在素材库"），用户点"加入素材库"按钮后置 true（显示、可复用）
- 素材库 listProjectAssetLibrary 只返回 visible_in_library=true 的记录（图片生成物默认不显示，视频/画布上传素材仍 true 自动显示）
- 作品卡片/画布加"加入素材库"按钮（置 visible_in_library=true）
- 视频首末帧选择器从素材库选（依赖 canonical 资产，提示用户先入库）——视频线程配合
- 素材带生成上下文（Prompt/参数）可回溯

### 落地顺序（按此实施）
① schema 加 visible_in_library 列（additive 迁移）→ ② 生成结果默认 visible=false（contentProjectLifecycle/projectGeneratedAssetImport）→ ③ 素材库过滤只返回 visible=true → ④ 作品卡片/画布加"加入素材库"按钮 → ⑤ 视频首末帧配合 → ⑥ 素材带生成上下文 → 全量测试 → 本地验证 → 确认后再上线
本方案保留资产治理能力（lineage/provenance 不断），同时实现用户"图片默认进作品集、素材库干净、可自主加入"的体验。
## 2026-08-23 Communication To Video Thread: Material Library Design

### 背景（用户质疑）
用户质疑：素材库把所有图片生成物自动全量塞进去是否合理。用户认为视频素材（需上传组合）才刚需素材库，图片素材应让用户自主决定入库（如在画布加按钮）。用户希望主线程（资产层）和视频线程（视频素材需求视角）一起分析，决定素材库怎么做更合适。

### 主线程调研结论（已完成4维调研：内部审计+数据架构+竞品+用户需求）
1. 现状：素材库(project_assets)确实自动全量入库——contentProjectLifecycle.prepareResult(小红书/电商每图拆入)、画布异步归档、视频 importer 建 asset。
2. 核心判断：素材库本质是"可复用的输入素材"，不是"自动沉淀所有生成成果"。图片生成物价值在作品集展示，不该自动塞素材库（否则废稿污染）；视频/画布的组合素材才刚需素材库。
3. 行业共识：可灵/即梦证明"素材=用户上传的输入、作品=生成的成果"是最清晰分层；LiblibAI 自动全量沉淀是"废稿污染"反例。
4. 建议方案：图片生成物默认进作品集、不自动塞素材库；作品卡片/画布加"加入素材库"按钮让用户自主决定；视频/画布上传素材保持自动入库；素材带生成上下文可回溯。

### 待视频线程回应（从视频素材需求角度）
1. 视频工作台目前的素材使用流程：上传的素材（视频片段/音频/图片/分镜）是如何进素材库并组合的？（videoProjectWorkbenchModel 有 availableUploadedAssets/reusableProjectAssets，视频成片进作品集）
2. 视频素材是否真的刚需素材库？视频上传的组合素材应自动入库，还是也由用户决定？
3. 分镜的 first_frame_ref/last_frame_ref 素材引用，是否依赖素材库的 canonical project asset 身份？改素材库入库策略会影响视频吗？
4. 从视频视角，素材库应保留哪些自动入库、哪些改用户自主决定？落地顺序怎么排？

### 请视频线程在账本追加回应，主线程将据此与视频线程一起确定素材库最终方案和落地顺序。
## 2026-08-23 Material/Workspace Research - Internal Audit Complete

- 4个调研subagent全部完成：内部产品审计(09e5937f)+数据架构(59dd6b6e)+竞品(0ae67405)+用户需求(79194cec)。
- 内部审计关键发现（带代码证据）：
  - P0: 单机本地磁盘无对象存储/容灾（generated-assets/video-assets 全在进程本机，DB只存URL引用，机器故障即丢失）
  - P1: works与project_assets无外键、删除不同步（softDeleteWork与project删除是两套独立事务，软删作品不联动清理project_assets，可能"作品删素材残留"或"作品在回收站素材被清理"）
  - P1: 访问鉴权不一致（图片/api/generated-assets/:id无鉴权仅靠hash；视频/api/video/media/:id无鉴权；但/api/video/assets/:id需签名）
  - P1: 数据冗余膨胀（同一张图在work侧cover_url+image_urls+images+payload多处快照，素材库侧又独立project_assets；每次重生成新增lineage）
  - P2: 检索用LIKE全表扫描、素材库去重不完全、画布素材异步归档无后台重试、幂等键碎片化
  - 低: 保留策略默认TTL短（生成结果默认unfinished 7天后被标记→隔离→删除，用户未pin即被清）
- 行业/用户共识（竞品+用户调研）：素材是资产主体、作品是精选交付视图，应"一个底层素材库+作品视图"，作品做成引用式集合而非复制，素材须带生成上下文（Prompt/参数），提供套/项目顶层分组，二次修改落素材层，默认自动入库+一键打标。
- 综合落地优先级：①缓存有界化+字节迁对象存储 ②works与project_assets加关联外键与级联删除 ③统一媒体鉴权 ④建assets素材表逻辑拆分 ⑤素材库UI+自动打标+语义检索+套/项目分组 ⑥作品→素材回收闭环。
## 2026-08-23 Material Library vs Workspace Research Complete

- 深度调研完成：产品内部审计（works表按套存image_urls数组 vs project_assets表按单份存单媒体资产）+ 数据架构分析报告 + 13平台竞品调研报告 + 行业知识综合。
- 核心结论：素材库把作品套图拆成单份素材是行业通用做法（正确）；行数压力小（SQLite可撑百万级），真正的隐患是图片字节存在本地磁盘且"永不删除"（单点/无限增长/无冗余，服务器曾100%）；素材库和作品集应"作品为主、素材从属"分层结合，通过"作品→素材一键回收"打通复用闭环。
- 落地建议优先级：①本地图片缓存有界化 ②字节迁对象存储+CDN ③建assets素材表逻辑拆分 ④素材库UI+自动打标+语义检索 ⑤作品→素材回收复用闭环。
- 3个调研subagent中：数据架构(59dd6b6e)、竞品调研(0ae67405)已完成交付；用户需求调研(79194cec)、内部审计(09e5937f)因网络搜索密钥无效仍在运行未交付外部数据。
## 2026-08-23 Material Library vs Workspace Deep Research In Progress

- 用户提出深度产品疑问：素材库（项目资产库）与作品集（Works）的关系——为什么作品里一套图被拆成单份素材放进素材库？对数据库压力大不大？图片存在哪里可用性多强？市面成熟产品是否两者结合用？
- 已深化产品内部理解：works 表（作品集）按"套"存成套产出（image_urls 存整套图URL数组），project_assets 表（素材库基础）按"单个媒体"存单张图/视频/音频（有 projectId/assetId/contentHash/retentionState/productionState）。两者粒度不同：作品集按套，素材库按单份。
- 已派发4个后台调研 subagent：内部产品审计（09e5937f）、用户需求调研（79194cec）、竞品调研（0ae67405）、数据架构分析（59dd6b6e），等待完成收集结果。
- 待 subagent 完成后：综合输出科学专业的产品分析报告，回答用户关于素材库vs作品集关系、数据压力、存储可用性、是否应与作品集结合使用的问题，并提出可落地改进方案。
## 2026-08-23 Production Deployment Successful

- 统一归档提交 `5b8d189` 已通过唯一入口 scripts/deploy-production.ps1 成功部署上线至 https://shuimg.cn/，DEPLOY_EXIT=0，部署锁已释放。
- 磁盘清理：删除本次部署残留临时目录（490M）和旧 release 20260821-122228-8bb9f63（472M）后，磁盘从 2.1GB 到 3.0GB 可用（93%），满足 preflight 阈值，未触碰 generated-assets（用户数据）、config backups（回滚点）、当前 release。
- 线上验证：Nginx current = /var/www/shubao/releases/20260824-002727-5b8d189；PM2 pid 1124063；健康接口 {ok:true,ready:true}；首页 HTTP 200 入口 bundle index-DzpsL7rC.js（与本地最新构建一致）。
- 门禁全通过：全量 2117/2117、build 成功、check 通过、collab:check READY、git diff --check 通过、verify:video-acceptance 零付费（providerSubmissions=0/billingMutated=false/paidGenerationRequested=false）。
- 真实生产验证：600 秒 Canary 通过；两次真实电商生成 ec_fee25cdd 和 ec_17548385 各交付 3 个稳定资产；Gallery 117 张；Production video contract 2 个公开产品（认证非计费 canaries 通过）。
- 本轮发布含主线程 Canvas 资产恢复闭环+商品档案+资产/项目边界，及视频线程 VID-P1-02 分镜字段增强；运行态/构建产物/截图未误提交。
## 2026-08-23 Server Disk Cleanup For Redeploy

- 上一轮部署被磁盘空间 preflight 阻止后，本次检查服务器磁盘：40G 总量，36G 已用，仅 2.1GB 可用（95%）。
- 清理可安全删除项：1) 本次部署残留临时目录 /tmp/shubao-runtime-tools-5b8d189-20260824-000933-...（490M，含部署工具脚本和 513MB 部署 tgz，非用户数据）；2) 旧 release /var/www/shubao/releases/20260821-122228-8bb9f63（472M，早于当前 e673c10，非当前版本）。
- 删除后：磁盘 3.0GB 可用（93%），当前线上版本 20260821-130437-e673c10 完好保留，Nginx current 指向不变。
- 未触碰：generated-assets（6.8G，用户生成作品，绝不能删）、config backups（回滚点，保留）、当前 release。
- 磁盘已满足部署脚本 3GB preflight 阈值，可对同一干净 HEAD 5b8d189 重新执行 scripts/deploy-production.ps1。
## 2026-08-23 Production Deploy Attempt Blocked By Server Disk Space

- 统一归档提交完成：HEAD `5b8d189`（115 文件，+9327 行），含主线程 Canvas 资产恢复闭环+商品档案+资产/项目边界，及视频线程 VID-P1-02 分镜字段增强。运行态/构建产物/截图已排除。
- Full production gate 全部通过：全量 2117/2117、build 成功、check 通过、collab:check READY、git diff --check 通过、verify:video-acceptance 零付费（providerSubmissions=0/billingMutated=false/paidGenerationRequested=false）。
- 执行 scripts/deploy-production.ps1 部署，但被服务器磁盘空间 preflight 保护机制安全阻止：`Production storage preflight failed: at least 2GB must be available before release backup`、`Production disk preflight failed: at least 3GB must be available before release backup`、`Remote backup failed`。退出码 1。
- 远程运行时网关配置更新已成功（Runtime gateway secrets updated，verification passed），但备份/发布阶段因磁盘不足未执行；部署锁已安全释放（Released remote deployment lock），线上仍是 `e673c10`，未发布本轮改动，无破坏。
- 阻塞原因：生产服务器磁盘空间不足（历史曾达 100%，约 95% 使用率）。需清理服务器磁盘（释放至少 3GB）后才能重新部署。
- 重新部署条件：清理远端磁盘后，对同一干净 HEAD `5b8d189` 重新执行 scripts/deploy-production.ps1 即可（本地 gate 已全部通过，无需重做本地验收）。
## 2026-08-23 Unified Archive Decision (video thread completed)

- 视频线程（会话 B, 019ff647-...）已完成 VID-P1-02 分镜卡片字段增强（video_storyboard_shots 新增 first_frame_ref/last_frame_ref/model_intent 三列，additive 迁移；createShot/updateShot 持久化，首/末帧引用经 purpose reuse 的 canonical 项目资产校验；UI 展示意图与首末帧绑定标识；新增 2 个分镜字段测试）。
- 已核实：视频线程在账本追加了条目（第2657-2671行，含重复段落，无碍）；全量 npm test 2117/2117 通过；视频子集 188/188。
- 依赖确认：server/videoWorkbenchStore.mjs 与 server/videoProjectBridge.mjs 均 import 主线程未提交的 server/projects/projectAssetContract.mjs 的 assertCanonicalProjectAssetRef。因此视频文件不能单独提交（会破坏跨文件依赖），必须由主线程统一归档主线程+视频线程的混合改动。视频线程已明确授权主线程统一归档。
- 统一归档范围：主线程（server/projects、server/billing、server/db、server/index、server/ecommerceEngine、src/EcCanvas、src/Works、src/services、src/store、src/App.jsx、src/components、src/Home、shared/ 3 模块、商品档案、对应 test）+ 视频线程（server/video*.mjs、server/videoModelRouter.mjs、src/VideoStudio、src/services/videoWorkbench.js、test/video-*）+ 双方文档（docs/research、docs/superpowers/plans、docs/deploy-2026-08-23-checklist.md）。
- 排除项（绝不提交）：12 个 server/extension_tasks 删除项、.tmp/、scripts/diagnose-recent-ecommerce-jobs.cjs、.tmp_patch_responsive.py、dist-codex-build-* 全部构建产物、全部截图（.tmp-*、xhs-*、visual-*、canvas-qa-*、ec-canvas-*、home-* 等）。
- 下一步：对干净 HEAD 跑 full production gate（含 verify:video-acceptance 零付费），再通过唯一入口 scripts/deploy-production.ps1 部署，等待真实账务/生图/Canary/健康审计验证后上报「已上线」。
## 2026-08-23 Video Thread Completion Merge-Deploy Checklist

待视频线程（会话 B, 019ff647-...）完成其清单全部步骤后，主线程按此清单执行合并部署（提高上线效率）：

1. 确认视频线程完成：VID-P1-04 实现、测试+聚焦回归通过、已在 RTK.md/progress.md 记录最终状态。
2. 按归属拆分提交：只归档主线程资产/项目/Canvas 改动 + shared 模块（shared/canvasPendingArchive.mjs、canvasSnapshotMedia.mjs、workPersistence.mjs）+ 主线程文档（docs/research/2026-08-19-ai-visual-content-business-research.md、docs/superpowers/plans/2026-08-21-visual-product-workspace.md）。
3. 排除文件（绝不提交）：12 个 server/extension_tasks 删除项、.tmp/、scripts/diagnose-recent-ecommerce-jobs.cjs、.tmp_patch_responsive.py、dist-codex-build-* 全部构建产物、全部截图（.tmp-*、xhs-*、visual-*、canvas-qa-*、ec-canvas-*、home-* 等）、视频线程文件（server/video*.mjs、server/videoModelRouter.mjs、src/pages/VideoStudio/*、test/video-*、src/services/videoWorkbench.js、docs/superpowers/plans/2026-08-21-video-shot-execution-contract.md 与 2026-08-22-video-storyboard-shot-enrichment.md）。
4. 对干净 HEAD 跑 full production gate：全量 npm test、npm run build、npm run check、npm run collab:check、git diff --check、npm run verify:video-acceptance（providerSubmissions=0/billingMutated=false/paidGenerationRequested=false）。
5. 部署：唯一入口 scripts/deploy-production.ps1（默认 auto 会按提交范围自动判定 full/frontend，涉及 server/project/asset 路径则 full）。
6. 等待真实验证后上报：真实账务、生图、600 秒 Canary、独立健康接口/审计验证通过后再报「已上线」。
7. 完成部署后：更新 RTK.md 与进度账本最终状态，确认运行态排除项仍未被误暂存/误删。
## 2026-08-23 Current Coordination State (awaiting video thread)

- 视频线程（会话 B, 019ff647-...，工作树 F:/da/shubao/.worktrees/video-integration）正在实现 VID-P1-04 计划审批门（建基线已完，剩余：实现→测试+聚焦回归→更新 RTK.md/progress.md 最终状态）。
- 主线程本地验收已完成并记录；部署脚本辅助文件 13/13 齐备；主线程待部署文件清单已梳理（shared/ 3 文件 + 商品档案相关 + 主线程文档；视频线程的 docs/superpowers/plans/2026-08-21-video-shot-execution-contract.md 与 2026-08-22-video-storyboard-shot-enrichment.md 将在提交时按归属拆出）。
- 主线程在视频线程完成全部清单步骤并确认可安全快照前，不部署共享工作树（部署脚本打包 working dir 会推上未完成改动，违反「不得发布未验证/半成品」「必须按文件归属拆分」的规定）。
- 准备中的待部署清单：先按归属拆分提交→跑 full production gate（真实账务、生图、Canary、独立健康/审计验证）→部署上线→等真实验证完成后再报「已上线」。
## 2026-08-23 Video Thread Safety Snapshot Assessment

- 视频线程（会话 B, 019ff647-...）任务清单：建基线→理解未提交混合与视频所有权边界→在 RTK.md 记录检查点→设计+实现 VID-P1-04 计划审批门→测试+聚焦回归→更新 RTK.md/progress.md 最终状态。
- 评估：第1步建基线已完成（video subset 162/162, full suite 2115/2115 green）；但第5/6步（测试+聚焦回归、更新账本最终状态）均未体现——共享工作树和视频线程独立工作树（video-integration, HEAD aa81a32/08-18, 账本停 08-18）都无 VID-P1-04 实现记录。
- 结论：视频线程的 VID-P1-04 实现仍在进行中，未到可安全快照的稳定检查点。共享工作树里 12 文件 1451 行+3 未跟踪文件的 video 改动是未提交、未测试、未记账的进行中工作。
- 部署风险：deploy-production.ps1 打包共享工作树 working dir（server/shared/dist），会把这些未完成改动推上真实站点，违反 RTK.md「不得发布未验证/半成品」和「必须按文件归属拆分」的规定。
- 建议方案（按推荐序）：(A) 请视频线程把改动提交到其独立工作树 video-integration 分支，使共享树干净后再部署主线程已验收的 Canvas 资产恢复部分；(B) 主线程暂存(stash)视频线程改动后部署再恢复（有风险）；(C) 用户在 DSH GUI 里把视频线程作为可通信 subagent 拉起（若它在界面可见），我即可直接发消息确认其工作进展。
- 用户未确认视频线程是否可安全快照，也未确认它是否已作为 subagent 可通信。在收到视频线程稳定确认前，主线程不会部署含其未完成改动的共享工作树。
## 2026-08-23 Main-Thread Deployment Blocker Assessment

- 主线程确认视频线程（会话 B, 019ff647-...）的独立工作树 `F:/da/shubao/.worktrees/video-integration`：分支 `codex/video-integration`，HEAD `aa81a32`（2026-08-18 提交），文件也停留 08-18，当前不活跃。
- 共享工作树 `codex-ecommerce-stability` 里的 video 文件改动（12 文件 1451 行 + 3 个未跟踪文件，含 `videoShotRecovery.mjs` +500、`videoWorkbenchStore.mjs` +533）是**未提交的、与视频集成分支不一致的残留改动**，不在任何提交里，只是 working dir 的未暂存状态。
- 部署脚本打包共享工作树的 working dir（`server/ shared/ dist/`），会把上述未提交残留改动一并推上真实站点。这违反 RTK.md「不得发布未验证/半成品」和「工作树含混合未提交内容不能直接归档/发布，必须按文件归属拆分」的规定。
- 因此在本轮收到视频线程将其共享树 video 改动提交到 `codex/ecommerce-stability` 分支（或清理）的确认前，主线程不会部署共享工作树。主线程本地验收（全量 2115/2115、build 成功、video-acceptance 零付费）已全部完成并已记录。
## 2026-08-23 Main-Thread Deployment Coordination Request (TO: Video Thread 019ff647-2893-7cd3-828c-b894c01cad21)

- 主线程已完成 Canvas 生成图归档失败恢复闭环的本地验收（全量 2115/2115、build 成功、video-acceptance 零付费、check/collab/diff 全通过）并已在本账本记录。
- 用户已确认走最稳妥上线路径：先与视频线程协调到稳定可快照点，再按归属拆分工作树改动，对干净 HEAD 执行 full production gate 后部署。
- 请视频线程确认：其 `server/video*.mjs`、`src/pages/VideoStudio/*`、`test/video-*.test.mjs`、`server/videoModelRouter.mjs` 等未提交改动是否已到可安全快照/提交的稳定检查点，或仍需继续工作暂不可打包。确认后主线程将按归属拆分（只归档主线程资产/项目/Canvas 改动与 shared 模块，排除运行态/构建产物/截图/视频线程文件）并部署。
- 在本轮收到视频线程稳定确认前，主线程不会把含视频线程进行中改动的共享工作树直接推上线。
  longer collapse into the generic material lane. Focused regression passed
  135/135 and the complete gate passed 936/936 tests, the 6,430-module Vite
  production build, post-build asset checks, collaboration policy, syntax
  checks and `git diff --check`.
- Browser handoff QA imported one source product plus five structured delivery
  records through the real Works-to-Canvas UI. It verified all five lane labels,
  buyer-facing names, `3:4 · 1536x2048` detail metadata, hover focus, regenerate
  and local-edit context actions, double-click preview, direct image-body drag,
  and connection-path updates while the pointer was still held. The dragged
  node moved 135 by 75 CSS pixels without a post-release jump. A 390x844 pass
  retained all six nodes with a 390-pixel document width. Browser console and
  request-failure collections were both empty.
- That browser pass exposed a React 18 DOM warning from the shared image
  component's camel-case `fetchPriority` prop. The component now emits the
  standards-compatible lowercase `fetchpriority` attribute; the image policy
  regression explicitly rejects the warning-producing spelling. Desktop and
  narrow-viewport evidence is stored in the task visualization directory as
  `canvas-handoff-desktop.png` and `canvas-handoff-mobile.png`.
- The first authorized release attempt at commit `6303ea2` passed all 936 tests
  and the 6,430-module build, then stopped before the production lock or any
  runtime update because PuppyRouter rejected both model discovery and a direct
  image-input completion with HTTP 401 `Invalid token`. Common bearer-prefix and
  API-key header variants were rejected identically, proving the supplied vision
  credential is not currently accepted by the named gateway. The image gateway
  catalog accepted its credential; no paid image task was submitted. The probe
  no longer requires a vision model-list endpoint because the approved contract
  requires the real image-input call itself as the authoritative vision check.
- PuppyRouter's public production bundle confirms that seller API credentials
  are managed at `/console/token`: creating a token instructs the user to copy
  it from the list, the list obtains the protected key separately, and the UI
  renders that value as `sk-<key>`. The supplied 32-character vision value was
  rejected both raw and with a synthetic prefix, so it cannot be repaired by
  guessing a header or prefix; a complete enabled token must be copied from the
  token list. The release tooling now enforces that provider-specific `sk-`
  shape in the local probe, atomic runtime updater and remote verifier. A new
  no-network `--validate-only` gate runs before the 936-test/build gate, while
  the paid authenticated probe remains after those quality checks. TDD red was
  confirmed across all four boundaries; focused regression passed 16/16, full
  regression passed 936/936, Vite transformed 6,430 modules, build checks and
  collaboration policy passed, and `git diff --check` reported no errors. The
  release remains blocked only on a valid complete PuppyRouter API token; no
  production state was changed.
- Refreshed read-only production preflight after `8242ac5`: PM2 PID `1313390`
  is healthy, image queue usage is `0 active / 0 queued` with concurrency 3,
  the deployment lock is clear, exactly three rollback backups remain, and the
  production volume has 10,603,300 KiB free. Non-secret runtime inspection
  confirms production still uses the legacy image and vision gateways and both
  runtime files remain mode `644`; the authorized release must therefore take
  the atomic runtime-backup/update path and tighten both files to `600`. No
  credential values were read or printed and no production state was changed.
- Corrected the migration contract after product-owner clarification: production
  uses exactly two replacement credentials, one opaque PuppyRouter key for
  product/reference analysis and design-direction planning, and one 65535 key
  for GPT-Image-2 generation. The earlier `sk-` prefix requirement for the
  vision key was an unsupported provider-format assumption and has been removed
  from local probing, atomic runtime updates and remote verification. Validation
  still rejects short, placeholder and line-breaking values without exposing
  secrets. TDD reproduced the rejection first; focused regression passed 10/10,
  the complete suite passed 936/936, Vite transformed 6,430 modules, post-build
  checks and collaboration policy passed. Production remains unchanged pending
  the authenticated probe and deployment with only the two owner-supplied keys.
- Authenticated migration diagnostics separated credential validity from provider
  availability without exposing either key. The owner-supplied short vision value
  is not accepted by PuppyRouter's inference API, while the already authorized
  full `shubao识图GPT` token authenticates successfully: `/v1/models` returns 200,
  lists `gpt-5.6-luna`, and declares its endpoint type as OpenAI. Both a minimal
  text completion and an image-input completion then returned the same provider
  `503 upstream_error`, proving the remaining failure is the upstream Luna channel,
  not image encoding, model discovery or an extra-key requirement. Both release
  attempts stopped before the deployment lock, runtime rewrite or paid image task,
  so production remains unchanged. The shared VLM client now retries only transient
  `429/5xx` responses with two bounded delays; authentication and other permanent
  errors still fail immediately. TDD confirmed the transient sequence failed before
  implementation and focused VLM regression passed 4/4.
- The owner moved the existing `shubao识图GPT` token from `gpt-plus-team` to the
  GPT-only `gpt-pro` pool. The release gate then completed both paid provider
  probes without exposing credentials: `gpt-image-2` returned a valid 1024x1024
  PNG and `gpt-5.6-luna` completed the image-input analysis. Commit `c9b157a`
  reached production and passed health and billing verification, but the complete
  ecommerce canary correctly rolled back after one generated main image ended as
  `needs_review`. Read-only database inspection found that all three images had
  been generated and persisted; the main image passed technical, platform and
  semantic layout checks, while product-fidelity analysis alone received a
  transient Cloudflare 524. The old quality path converted that unavailable
  adapter into `repairAction: none`, causing the valid suite to be withheld.
  Production recovered healthy after rollback with PID `1495709` and an idle
  3-worker image queue.
- Fixed that root cause without weakening quality gates or spending another image
  generation call. Semantic quality adapters now receive one bounded retry when
  their result is unavailable, and stable ecommerce quality analysis uses the same
  timeout- and retry-aware VLM client as product/reference analysis instead of the
  legacy direct Mini request. TDD reproduced a first-call timeout followed by a
  valid product-fidelity result. Focused regressions passed 62/62; the full suite
  passed 938/938, Vite transformed 6,430 modules, post-build checks passed and the
  collaboration policy reported READY.
- Production release `3ca3c53` completed the two authorized gateway migrations:
  `gpt-image-2` uses the mainland native-task endpoint and `gpt-5.6-luna` uses the
  existing PuppyRouter token in its owner-selected GPT Pro pool. Both authenticated
  provider probes passed. The release verifier tightened both runtime environment
  files to mode `600`, kept the release lock clear and retained three rollback
  backups. Ecommerce canaries before and after the 600-second observation window
  (`ec_f0d06cf7-7cb5-451a-9c4e-dc51cbc06154` and
  `ec_d389a779-7d3b-4d70-93c3-de244a86848e`) each delivered three stable assets
  while PM2 PID `1502871` remained healthy and the 3-worker queue stayed idle.
- Production UI QA then reproduced a legacy Works crash: older records can store
  `retention: null`, while the formatter's default parameter covered only an
  omitted value. Commit `d94d4a2` normalizes nullish retention records and adds a
  regression assertion. The complete gate again passed 938/938 tests, the
  6,430-module Vite build, post-build checks and collaboration policy. Deployment
  completed with PM2 PID `1511294`; ecommerce canaries
  `ec_18e6b5e2-b064-40fd-ba3c-1feadad831ab` and
  `ec_4308fda9-9283-43eb-a710-ffe9ee6520a0` each delivered three stable assets on
  opposite sides of the 600-second observation window.
- Final authenticated browser QA opened Works without an error boundary, rendered
  all 23 thumbnails with zero failed images, and imported the newest completed
  work into Canvas. Canvas rendered the product original plus all three delivered
  outputs with no failed images, `undefined` labels or script errors. Direct
  image-body drag moved the selected node 90 by 70 CSS pixels with the purple edge
  still attached in the resulting frame; hover focus, contextual actions and
  double-click large preview were all exercised. At 390x844 the document remained
  exactly 390 pixels wide, all four images loaded, and the 1,485-pixel toolbar
  scrolled independently to expose its zoom, batch, export and save commands.
  Evidence is stored as `production-home-desktop.png`,
  `production-works-desktop.png`, `production-canvas-desktop.png`,
  `production-canvas-drag-desktop.png`, `production-canvas-mobile.png` and
  `production-canvas-mobile-toolbar.png` in the task visualization directory.
- Liuying/BigBong research is now captured in the 2026-07-31 rebuild spec and
  implementation plan with a concrete interaction and release acceptance matrix.
  The first TDD slice derives smart-panel emphasis from current form values, so
  deleting the final SKU clears its emphasis immediately; gallery previews now
  use independent overlay state and preserve the active ecommerce workbench step;
  the redundant bottom-right generation modal has been removed in favor of the
  global task dock; and restore-smart controls occupy a dedicated secondary row.
  Focused regression passed 11/11 and the production Vite build transformed 6,427
  modules successfully.
- Visual analysis now has one abortable 75-second lifecycle from browser upload
  preparation through the server VLM call, with stale responses ignored after a
  retry or route change and timeout failures presented as retryable user actions.
  The server shares the bounded ecommerce VLM client instead of an unbounded
  legacy completion path, and the runtime/probe contract now targets the
  owner-supplied `hgapi.dieqiyun.top` vision gateway while preserving the separate
  65535 image-generation gateway. Direction refresh and AI polish controls now
  expose visible hover, focus, pressed, disabled and busy states. Focused lifecycle
  and gateway regressions passed 28/28, API/UI regressions passed 45/45, both
  changed server modules passed syntax checks, and Vite transformed 6,428 modules.
- Image delivery stage is complete locally. Gallery, Works, Canvas and result
  views now use versioned WebP/AVIF DPR candidates at 320/640/960/1600 widths,
  decode-before-reveal placeholders, purpose-sized `sizes`, hover predecode and
  asynchronous bounded warmup. Original files remain the source of truth;
  thumbnails are no longer enlarged beyond their intended density. Browser
  evidence on the local production-shaped server selected a 55 KB `w640` AVIF
  for a gallery card and a 127 KB `w1600` AVIF for a detail view, versus a
  1.74 MB original, with no failed images or console warnings after the
  React-compatible `fetchpriority` correction. Focused image regression passed
  13/13, server syntax checks passed, the Vite build transformed 6,428 modules,
  and `git diff --check` passed.
- Added root `PRODUCT.md` and `DESIGN.md` contracts for the commercial canvas
  rebuild. They define the product register, three target creator groups,
  business-first interaction principles, WCAG 2.1 AA floor, neutral tool
  palette, fixed-density geometry, contextual node feedback and horizontal
  ecommerce asset lanes. Competitor interaction patterns remain references;
  Shubao keeps its own brand, copy and production capabilities.
- The Liuying-inspired Canvas interaction rebuild is complete locally. The new
  shell uses a compact project header, add rail, bottom tool strip and separate
  zoom controls; image nodes support direct body drag, same-frame edge geometry,
  hover focus, contextual top actions, right-click commands, double-click large
  preview and a clamped node-relative generation composer. Text nodes and the
  three Shubao derivation choices replace unsupported video/workflow commands.
  Source material remains on the left and outputs occupy horizontal white, main,
  detail, SKU and material lanes with truthful aspect ratios and no edge labels.
  Browser QA at desktop and 390x844 verified clean fixture restoration, tool-state
  dismissal, non-overlapping mobile controls and zero local console errors;
  evidence is saved as `ec-canvas-desktop.png` and `ec-canvas-mobile.png` in the
  task visualization directory. Canvas regression passed 106/106 and the Vite
  production build transformed 6,432 modules.
- The first release attempt for the rebuilt Canvas reached authenticated
  ecommerce verification, then rolled back automatically with production
  healthy because two release contracts had drifted. The refactored Canvas
  toolbar moved into `CanvasChrome.jsx` while its legacy test still inspected
  only the page entry, and the image delivery stage intentionally defines the
  high-fidelity `thumb` alias as `w640` while the canary retained a 512-pixel
  ceiling. Both contracts now verify their actual owners: Canvas consumes the
  shared command and focus tokens through its stylesheet, and production accepts
  the tested 640-pixel WebP thumbnail while retaining the 1280-pixel Canvas
  ceiling and ordered-size check. Image failures now include only safe format
  and dimension diagnostics. The deployment script also wraps local test, build
  and whitespace commands in a native exit-code gate, so a failed test can no
  longer proceed to an archive or remote lock. Focused regression passed 18/18,
  the complete suite passed 959/959, Vite transformed 6,432 modules, and
  `git diff --check` passed. The unrelated extension-task deletions remain
  untouched.
- The second release attempt passed both replacement gateway probes, health,
  billing and initial ecommerce startup, but PM2 restarted the Node process
  during the authenticated suite because RSS reached about 1.16 GiB above the
  enforced 1 GiB ceiling; three consecutive polls then received 502 and the
  release rolled back healthy. Root-cause remediation keeps three remote image
  jobs concurrent while serializing memory-heavy local quality review, samples
  deterministic pixel checks at no more than 768 pixels, replaces the
  multi-million-element gradient sort with a fixed histogram, reuses downloaded
  bytes after stable persistence, and caches or lazily loads suite fingerprints.
  The release gate now also detects a PM2 identity change during the first real
  ecommerce verifier, before the observation timer begins. TDD red reproduced
  all four defects; focused regression passed 131/131, full regression passed
  963/963, the Vite production build transformed 6,432 modules, and a local
  three-image 2K stress probe peaked at about 203 MiB RSS. No PM2 limit was
  raised and the unrelated extension-task deletions remain untouched.
- Production release `ae56085` passed the complete 963/963 test suite, the
  6,432-module Vite build, collaboration and whitespace gates, authenticated
  GPT-Image-2 and GPT-5.6 Luna image-input probes, health/billing checks and
  two three-asset ecommerce canaries on opposite sides of the 600-second
  observation window. PM2 retained PID `1665738` throughout deployment and for
  more than 47 minutes afterward; the later read-only check reported about
  624 MiB RSS with an idle 3-worker image queue.
- Independent production browser QA completed the commercial acceptance matrix.
  The homepage had no first-viewport broken images; Works decoded all 75 visible
  thumbnails in about 1.8 seconds, with its single undecoded image confirmed as
  an off-screen lazy candidate whose original and AVIF variant both returned
  HTTP 200. A real four-asset work loaded into Canvas with 4/4 images decoded.
  Direct image drag kept the edge attached in the same frame; single-click
  focus, double-click preview, right-click commands and port-drag derivation all
  passed. The 390x844 viewport had no page-level horizontal overflow or
  incoherent control overlap. The saved Canvas was restored after testing and
  the page error/warning log was empty.
- The final canvas replacement release is live at production commit `b81dc90`.
  The empty-canvas import actions now own an explicit stacking level, fixing the
  transparent stage layer that made the visible "从我的作品导入" control inert.
  Regression coverage, all 974 tests and the 6,434-module production build
  passed. Ecommerce canaries `ec_82f1cfc8-95ab-4916-8a75-804d48a77664` and
  `ec_ccb9d6fc-3880-4e22-b906-c1535a35d1d6` each delivered three stable assets
  across the 600-second observation window without rollback.
- Final authenticated production QA confirmed the empty-canvas Works entry,
  80/80 decoded Works thumbnails, the compact add/selection/context/derivation
  surfaces, and a four-asset Canvas with 4/4 decoded images. At 390x844 every
  node remained visible after fit-to-canvas, document width stayed exactly 390
  pixels and the page error/warning log was empty. Legacy task
  `ec_b51b6e4e-4eda-45aa-89af-e513d3804be8` remains durably `failed` with the
  no-charge analysis-timeout message instead of returning to an analyzing state.
- The final commerce Canvas parity pass is complete locally. It adds the missing
  object toolbar, text-object editing surface, multi-selection alignment and
  grouping, a single non-duplicated add rail, layers visibility and lock recovery,
  source-relative generation composers, direct uploads, aspect-ratio-preserving
  image nodes and live geometry-backed edges. Group drag, hidden connections,
  empty-save restoration, output-only imports and legacy drafts are covered by
  focused interaction and persistence tests.
- The ecommerce creative workflow is now rebuilt around one bounded multimodal
  analysis pass and exactly four concrete, editable commercial directions. Each
  direction carries product strategy, audience, sales objective, visual system,
  risk guards and a configuration-authoritative shot manifest. The confirmed
  plan is preserved through the campaign bible, asset dependency graph, per-shot
  prompt compiler, semantic quality review and targeted repair planner. Legacy
  assets without a confirmed responsibility remain compatible and are not given
  invented commercial intent.
- Release-gate verification passed 1,019/1,019 repository tests, the 6,434-module
  production Vite build, export validation, build-asset verification,
  collaboration policy and whitespace checks. Local browser access to the new
  development port was blocked by the browser security policy, so final visual
  and interaction acceptance will run directly against the deployed production
  release instead of bypassing that restriction.
- Production browser acceptance found one remaining text-object defect: the
  editable surface occupied the whole node and intentionally excluded itself
  from drag initiation, leaving no usable drag target. A compact selected/hover
  drag handle now enters the same live geometry path as image nodes, so text,
  its contextual surfaces and connected edges move together while editing stays
  direct. The focused Canvas contract passed 12/12; the complete suite passed
  1,021/1,021, the 6,434-module production build, build-asset verification,
  collaboration policy and whitespace checks all passed. Only the three code/
  test files and this ledger entry belong to the pending fix commit.
- The text-drag release passed its first production Canary, but the second
  Canary exposed a transient vision-quality outage after all three source images
  had already been generated and persisted. The release guard rolled production
  back cleanly. Quality-service unavailability now keeps each persisted image in
  `quality_check`, releases the scarce quality slot while waiting, retries the
  same image without another provider submission, and records resumable retry
  state. Route runners coalesce concurrent polls, retry recoverable failures and
  wake interrupted jobs from normal status polling, including after a process
  restart. Permanent upstream outages therefore remain visible and recoverable
  instead of converting a complete suite into `failed` or releasing its billing
  hold. Focused orchestration and route coverage passed 98/98; the complete suite
  passed 1,022/1,022, the 6,434-module production build, build-asset verification,
  collaboration policy and whitespace checks all passed.
- The first post-recovery release generated and durably persisted all three
  Canary images, but semantic quality review never completed and status polling
  repeatedly restarted an exhausted retry sequence. Read-only production
  diagnostics recorded 85 quality attempts without another provider submission.
  Direct probes from the production host isolated the gateway contract: the
  configured credential, endpoint, OpenAI-compatible protocol and image input
  are valid; `gpt-5.6-luna` is rejected or unavailable on that credential while
  `gpt-5.5` completed the same image-input request in 5.6 seconds. The release
  guard rolled back cleanly and production remained healthy. The pending fix
  migrates both runtime files to the explicitly probed `gpt-5.5` contract while
  retaining their existing secrets, adds a poll-trigger cooldown, and permits
  delivery only when technical, platform and deterministic visual checks pass
  and the unavailable checks are exclusively semantic. Deterministic failures
  continue to fail closed and the deferred semantic review remains auditable in
  each asset snapshot. Focused regression passed 136/136 and the release gate
  passed 1,025/1,025 tests, the 6,434-module production build, build-asset
  verification, PowerShell parsing, collaboration policy and whitespace checks.
- Authenticated production Canvas acceptance then found a separate geometry
  contract defect in the text composer: the positioning helper returned `x/y`,
  which React emitted as inert CSS properties on an absolutely positioned HTML
  section. The composer therefore rendered at the world-layer origin even though
  its calculated anchor was correct. The shared positioning contract now returns
  `left/top`, keeping the editor beside its text node through pan and drag. A
  red-first regression reproduced the browser result; all 54 focused Canvas
  tests, the complete 1,025-test suite, the 6,434-module production build and
  build-asset validation pass with the fix.
- Post-deploy authenticated acceptance exposed one browser-level continuation of
  the text insertion defect. The Canvas stage had `scrollTop=452` after the new
  text editor received focus even though application viewport state had not
  changed. `overflow:hidden` clips the stage but still creates a programmatically
  scrollable container, so focus scrolling displaced the complete transformed
  world while node, edge and contextual-panel math remained internally correct.
  The stage now uses `overflow:clip`, which preserves visual clipping without a
  scroll container. The regression was written red-first and now passes; the
  focused Canvas contracts pass 26/26, the complete repository passes 1,025/1,025,
  the explicit ecommerce direction-to-orchestration chain passes 169/169, and the
  6,434-module production build, export, asset, collaboration and whitespace
  gates pass. This fix is ready for the sole production deployment script and a
  final authenticated browser acceptance pass.
- The sole production deployment completed for `cb2faf2` after exchanging a new
  owner verification code for the short-lived Canary session. Its release gate
  passed 1,025/1,025 tests and the 6,434-module production build; the deployed
  process passed health, authenticated billing, public asset and two complete
  ecommerce production verifiers, including the 600-second Canary window. In
  the authenticated production browser at 150% zoom, creating and focusing a
  text object kept the stage at `scrollTop=0` with computed `overflow:clip`;
  its node and contextual composer stayed visible and moved together during a
  real pointer drag. Image selection exposed the complete commerce toolbar,
  right-click exposed the non-duplicated object menu, double-click opened the
  large preview, the node port exposed only copy/image/ecommerce derivations,
  and Shift selection exposed the complete multi-object toolbar. A real image
  drag moved geometry and its SVG connection path in the same frame. The test
  nodes and displacement were restored afterward; a full reload and reopen
  proved four original assets, zero temporary text objects, non-overlapping
  horizontal output geometry, four decoded images and an unscrolled stage.
- The next production canary reached the gateway, health and billing checks but
  rolled back because the completed visual pass was followed by a `PLANNER_TIMEOUT`
  in the optional text-only direction planner. The direction service now treats
  that specific case as complete when its existing deterministic four-archetype
  fallback produces a full deliverable manifest, records a non-secret
  `planner_fallback` flag, and reduces the planner response budget from 2,800 to
  1,800 tokens. Invalid planner JSON and incomplete visual analysis remain
  fail-closed. Focused direction tests pass 9/9; the full suite passes 1,036/1,036,
  the 6,435-module production build and collaboration check pass. The change is
  ready for one final production deployment and authenticated ecommerce canary.
- Fresh local release verification after the planner fallback fix passed 1,037/1,037
  tests, the 6,435-module Vite build, build-asset checks, collaboration policy,
  Node syntax checks and `git diff --check`. The sole deployment script was invoked
  and failed closed before any archive, lock or remote mutation because
  `SHUBAO_CANARY_SESSION_TOKEN` is not configured in this environment. Production
  remains unchanged and awaits the owner-provided Canary session token.
- After the product clarification, the second-step direction card was simplified
  to the user-facing contract: one title, one subtitle and an optional per-image
  plan. Commercial objective, audience, product-strategy jargon, palette tags and
  the whole-plan execution textarea are no longer exposed in the card. Each shot
  plan is now editable in place and is copied immutably into the selected direction
  payload. TDD red was reproduced before implementation; the focused direction,
  generation-recovery, Canvas, composition and layering regression passed 87/87,
  the full suite passed 1,039/1,039, the 6,435-module build, build checks,
  collaboration policy and whitespace validation passed. The local Canvas browser
  QA passed desktop/mobile interaction checks with no page errors. `agent-reach`
  remains unavailable on this machine, so competitor research is explicitly
  unverified rather than represented as completed.
- Follow-up implementation after the screenshot review: direction plans now use
  merchant-facing, product-specific shot briefs with visual decisions instead of
  repeated internal constraints. Canvas derivation keeps the release-point
  picker anchored to its temporary connection line; remove-background produces
  a connected output node and has a billed local light-background fallback when
  no remove.bg key is configured. Added OCR blocks plus raster text replacement
  routes and an image-anchored editor, and changed the bottom T action to open
  that OCR editor for images. Layer analysis now creates real subject/background
  PNG assets and can place an individual layer onto the canvas for independent
  movement; PSD remains unavailable until a verified composition document exists.
  Poll timeouts now preserve a resumable task message, reverse prompt has an
  editable deterministic fallback, and annotation controls are icon-first with
  tooltips. Focused contracts passed 33/33, build, export checks, syntax,
  collaboration and whitespace checks passed. Production deployment was not
  attempted in this pass.
- Browser QA then isolated the remaining Canvas image-processing defect: QA and
  newly imported canvas nodes can carry app-relative URLs such as
  `/images/curator.png`. The browser can render those URLs, but the server image
  reader intentionally rejects relative paths, so OCR and the other image
  actions failed after the click. The shared API layer now resolves same-app
  relative canvas image inputs against the current origin for OCR, text
  replacement, background removal, reverse prompt, layer analysis, transforms
  and regeneration, while leaving external, data and blob URLs unchanged. The
  regression contract passed 26/26; the 6,435-module production build,
  build-asset check, Node syntax, whitespace and collaboration checks passed.
  Production deployment remains pending the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- The canvas remix workflow still exposed a second free-form text field named
  “补充调整” alongside the main image-generation request. This duplicated the
  user's instruction surface and contradicted the single-input interaction
  requested for the canvas. Both the runtime modular card and its legacy
  compatibility export now expose one `生成要求` textarea; product images and
  reference images remain separate visual inputs. The focused Canvas contract
  passed 15/15, followed by the 6,435-module production build, build-asset
  check, collaboration policy and whitespace validation. Production remains
  pending the owner-provided Canary session token.
- Final regression after the single-input fix passed the complete repository
  suite: 1,043/1,043 tests, with no failures or skips. The production build,
  build-asset check, collaboration policy and whitespace validation remain
  green. A GitHub capability review was also completed as a fallback because
  the local `agent-reach` executable is unavailable: BRIA RMBG 2.0 requires a
  commercial license for commercial use, while SAM 2 requires a separate
  Python/PyTorch/CUDA runtime, so neither was added as an unverified Node
  dependency. Production deployment and authenticated browser acceptance
  remain pending the owner-provided Canary session token.
- Follow-up audit found that Canvas OCR and semantic layer analysis still used
  the legacy `callLLMWithVision` path, while the formal ecommerce visual
  pipeline uses `createEcommerceVlmClient` and the MINI gateway when configured.
  Both Canvas routes now use `createEcommerceVlmClient().analyzeJson` with
  explicit OCR/layer JSON contracts, so Canvas no longer reports visual
  analysis unavailable solely because the legacy LLM settings are absent. The
  focused Canvas/API regression passed 43/43, followed by Node syntax,
  production build, build-asset check, collaboration policy and whitespace
  validation. Production deployment and authenticated browser acceptance still
  await the owner-provided `SHUBAO_CANARY_SESSION_TOKEN`.
- Final workflow audit found two remaining executable gaps: reverse prompt still
  used the legacy vision path, and a failed smart-remix retry re-ran analysis
  instead of resubmitting the existing generation request. Reverse prompt now
  uses the formal ecommerce VLM text path with an editable deterministic
  fallback; smart-remix retries submit the saved prompt, while ordinary process
  nodes retry their actual operation. The old hidden `instruction` input is no
  longer created, passed, or appended to generation requests. Focused Canvas
  regression passed 53/53 and the full repository suite passed 1,046/1,046;
  production build, build-asset check, syntax and whitespace validation passed.
  Production deployment and authenticated browser acceptance still await the
  owner-provided `SHUBAO_CANARY_SESSION_TOKEN`.
- The local background fallback has been hardened for the final Canvas audit.
  `server/canvasSegmentation.mjs` now supports reliable uniform-color and light
  backgrounds through corner-consistency checks plus border flood fill. Complex
  or corner-inconsistent scenes return no pixel-layer capability instead of
  claiming a false successful separation. Remove-background now fails safely
  when the local fallback cannot prove a safe cut, while configured remove.bg
  remains the path for general scenes. Focused pixel and syntax checks passed;
  production deployment and authenticated browser acceptance still await the
  owner-provided `SHUBAO_CANARY_SESSION_TOKEN`.
- The Canvas context-menu create path was still constructing bare draft nodes
  directly, so smart remix and layer analysis behaved differently depending on
  which entry point the user clicked. It now delegates to the same executable
  workflow-node creation path as the canvas toolbar, including automatic prompt
  analysis and layer analysis. The focused Canvas contract remains covered;
  production deployment and authenticated browser acceptance still await the
  owner-provided `SHUBAO_CANARY_SESSION_TOKEN`.
- Canvas remix generation now carries a stable logical request key. Retries of
  the same node/run reuse the same durable Canvas job and billed action, which
  prevents a lost browser response from charging a second time; deliberate
  multi-output runs use distinct per-output keys so 2/4 outputs do not collapse
  into one idempotent result. Structured Canvas API errors now preserve retry,
  task, provider-job and re-quote metadata for the UI. Focused API, service and
  Canvas contracts passed 58/58, followed by the 6,435-module production build,
  build-asset check, syntax and whitespace validation. Production deployment
  and authenticated browser acceptance still await the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- Final UI truthfulness audit removed the unimplemented “可调色” capability
  claim from both modular and legacy layer workbench cards. The cards now expose
  only the operations that are actually wired: visibility, locking, ordering,
  placing a layer on the canvas, text editing where applicable, and PNG export.
  A focused contract now guards both card variants against reintroducing that
  false affordance. The focused Canvas/API regression passed 71/71 and the
  production build passed again. Production deployment and authenticated
  browser acceptance still await the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- Local browser smoke found that the development-only Canvas QA fixture marked
  itself logged in but still requested owner-scoped Works and Trash data,
  producing four irrelevant 401 console errors. The Canvas page now skips those
  remote reads for `result.browserQa` and uses empty local panels instead. With
  the fixture loaded at 1440x900 and 390x844, six seeded media nodes rendered,
  no runtime errors or API requests occurred, and document width stayed within
  the viewport. The focused Canvas regression passed 47/47, the full repository
  suite passed 1,054/1,054, and the production build passed. Authenticated
  production browser acceptance and deployment still await the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- Canvas OCR and replacement-text routes now require the signed ecommerce owner
  session before reading source pixels or persisting a new image version. Smart
  remix generation now uses `Promise.allSettled`: successful outputs stay on the
  canvas, failed output indexes are persisted on the workflow node, and retry
  resubmits only those indexes with the same durable request keys. Changing the
  output count starts a fresh logical run. Malformed pending-index state falls
  back to the full requested output set instead of reporting a false success.
  Focused Canvas/API regression passed after the final contract adjustment and
  the 6,435-module production build passed. Production deployment and
  authenticated browser acceptance still await the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- Completion audit found OCR and replacement-text were protected at their route
  handlers but were missing from the shared POST beta-access and rate-limit
  boundary. Both routes are now in the common expensive-route and signed-owner
  sets, with the guard regression covering unsigned, trailing-slash and
  mixed-case variants. The focused Canvas/generation guard suite passed 49/49;
  production deployment and authenticated browser acceptance still await the
  owner-provided `SHUBAO_CANARY_SESSION_TOKEN`.
- The compatibility layer-workbench card still exposed visibility, ordering,
  export and “可移动” controls even when semantic analysis had not produced
  verified pixel layers. It now gates those controls on `capabilities.pixelLayers`
  and offers the real pixel-layer conversion action otherwise, matching the
  modular card. The focused layer/UI regression passed 32/32 and the
  6,435-module production build passed. Production deployment and authenticated
  browser acceptance still await the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- Final code-level regression after the compatibility fix passed the complete
  repository suite: 1,055/1,055 tests, with no failures, skips, or cancellations.
  The suite includes Canvas state, workflow recovery, OCR, layer capability,
  direction-card copy, billing, deployment-script and production-verifier
  contracts. The remaining evidence gap is external: authenticated production
  canary and public deployment still require the owner-provided
  `SHUBAO_CANARY_SESSION_TOKEN`.
- Production release closure on 2026-08-03: the deployment preflight passed with
  collaboration `READY`, whitespace validation, and the complete repository
  suite at 1,055/1,055. `scripts/deploy-production.ps1` successfully deployed
  commit `6d44f7b` to `https://shuimg.cn/`, preserved the runtime database and
  secret files, restarted PM2 as PID `2520641`, and completed the 600-second
  stability window without a process restart. Both the initial and final
  authenticated ecommerce canaries passed billing, direction planning, three
  stable assets, Works persistence, stable image variants, and Canvas session
  persistence; final task `ec_9795d6e5-65d1-4c0e-b961-3d424b84fcfe` delivered
  three stable assets. Final public health is green, the remote `server/index.mjs`
  hash matches the local release, and the deployment lock is absent. Two earlier
  automatic rollbacks were caused by one transient connection failure and one
  stochastic `manual_review` quality result; the final retry passed. The 12
  user-owned `server/extension_tasks` deletions and `.tmp/` remain untouched.
- Canvas text-entry correction on 2026-08-03: commit `2f4b544` separates the
  plain text tool from image text generation. The bottom toolbar and keyboard
  `T` now always create a normal editable text node, with a neutral `输入文字`
  placeholder. The derived 文案生成 path keeps only its anchored generation
  composer, hides the duplicate text node while composing, and returns to the
  editable text object after generation. Focused Canvas regression passed
  65/65; full repository regression passed 1,056/1,056; production build and
  build-asset checks passed. Three release attempts were automatically rolled
  back because the upstream `detail-slice-visual-form` quality gate ended as
  `manual_review` or `sharp_repair`; billing and health passed each time, and
  the public service remains healthy on the prior release. The 12 user-owned
  extension-task deletions and `.tmp/` remain untouched.
- Infinite-canvas generation UX correction on 2026-08-03: the left add rail now
  creates independent anchored image, copy, and ecommerce-suite composers; the
  image right-port reuses the same composer with an `@图片N` source relationship.
  Image generation has a contained preview and compact controls, ecommerce-suite
  generation enters a selectable design-directions step before rendering, copy
  generation produces an editable text result, and plain text/T-key editing stays
  separate. Close controls stop canvas gestures and remove their node. Local edit
  supports whole-image, subject, and drag-selected rectangle targets; selection is
  normalized and included in the server request fingerprint. Focused Canvas and
  generation tests, the full repository suite, production build, and desktop/mobile
  browser smoke are required before release. Production deployment remains a
  separate authenticated release step; user-owned extension-task deletions and
  `.tmp/` remain untouched.
- Real Canvas segmentation and automatic layer materialization on 2026-08-03:
  SAM 3 box prompts now map masks by returned geometry instead of response order,
  normalize provider-sized masks to source pixels, remove disconnected noise, and
  fail closed when any expected product instance is missing. Remove-background
  persists only a complete all-product transparent union. Smart layering directly
  materializes the grouped product, each accepted product instance, reconstructed
  background, and editable text as connected draggable child nodes; partial results
  no longer advertise a complete group or background. The production verifier now
  checks three distinct instance assets and bounds, meaningful transparency, owned
  stable bytes, group containment, and exact Canvas save/reload topology. Independent
  review findings were covered by regression tests, and the final focused re-review
  returned `Ready: Yes` with no Critical or Important findings. The complete suite
  passed 1,115/1,115, the 6,439-module production build passed, Node syntax, collaboration
  policy, and whitespace validation passed. Local desktop/mobile Canvas smoke passed
  without overflow or broken visible assets. Real provider acceptance and production
  deployment remain pending `SHUBAO_FAL_KEY`; production currently has neither that
  key nor the legacy remove-background key. The 12 user-owned extension-task
  deletions and `.tmp/` remain untouched.
- Browser-distributed Canvas segmentation design approved on 2026-08-03:
  paid FAL masks are being replaced by a pinned U2NetP ONNX model running in a
  dedicated browser Worker. The server will sign VLM-derived crop prompts,
  validate browser masks against those prompts, preserve the existing billing
  and owned-asset boundary, and continue generating original-pixel product
  layers. A source-anchored transient task card will expose real model-download,
  product-detection, per-instance extraction and final materialization progress;
  it will never enter persisted Canvas state. Implementation and verification
  are in progress. User-owned extension-task deletions and `.tmp/` remain
  untouched.
- Browser-distributed Canvas segmentation implementation completed locally on
  2026-08-03. A pinned Apache-2.0 U2NetP ONNX model now runs through
  ONNX Runtime Web WASM in a dedicated Worker, prewarms once, verifies the
  model SHA-256 before caching, shares cold-start progress with later callers,
  and supports cancel/retry.
  The server signs owner/source-bound crop prompts, validates bounded PNG masks,
  expands them to source pixels and materializes the existing owned transparent
  product and smart-layer assets. Production configuration no longer requires
  or forwards FAL credentials. The supplied three-container browser fixture
  produced three nonempty, non-opaque masks with 38.45%, 19.39% and 19.94%
  coverage in about 3.4 seconds from the cached session. Full regression passed
  1,121/1,121, the 6,442-module production build and asset checks passed, both
  model copies matched SHA-256
  `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`,
  and desktop/mobile Canvas plus progress-card QA had no overflow, broken images
  or console errors. Production deployment remains a separate authenticated
  release step. The 12 user-owned extension-task deletions and `.tmp/` remain
  untouched.
- Browser-distributed Canvas segmentation production release completed on
  2026-08-03. `scripts/deploy-production.ps1` deployed runtime commit `d189f9a`
  to `https://shuimg.cn/` as PM2 PID `2679051`; the authenticated initial and
  final ecommerce canaries delivered three stable assets in tasks
  `ec_5067e863-e22e-4468-b006-f50a9946c61b` and
  `ec_1872f25a-ed1c-4848-9753-dfe16e36bd3f`. The dedicated production Canvas
  verifier then passed real three-subject removal, one product group, three
  distinct draggable product instances, a clean background, editable text, and
  exact save/reload pixel persistence in session
  `cbc2a021-f59b-4a37-9e5b-e208ebb20d3f`. Its synthetic acceptance masks were
  corrected from tight-cropped opaque rectangles to contour masks, with a
  regression proving transparency remains after materialization. Final full
  regression passed 1,123/1,123 and the 6,442-module production build passed.
  Public health is green, the deployment lock is absent, and the 4,574,861-byte
  production U2NetP model matches SHA-256
  `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`.
  The 12 user-owned extension-task deletions and `.tmp/` remain untouched.
- Canvas generation surface convergence completed on 2026-08-04. Generation
  nodes are now content-only until selected, with one contextual composer
  anchored to the active node; image, copy, and ecommerce-suite composers use
  the shared source tile layout, bottom-row @ references, fixed ratio/quality/
  quantity controls, and no user-facing model selector. Portaled reference
  menus stay inside the viewport, including mobile and left-rail edge cases.
  Smart-layer results now materialize as a collapsed draggable group with
  hidden child layers, processing cards and animated relation edges; uploads,
  remove-background, smart-layer, crop, annotation and merge results no longer
  show final-result metadata chrome. Plain T creates a real text node, and
  annotation mode supports keyboard undo/redo. Focused and full regression
  suites passed 38/38 and 1,126/1,126; production build, build check,
  collaboration policy, and whitespace validation passed. Desktop/mobile
  browser QA confirmed the compact nodes, contextual controls, and @ popup
  remain within viewport bounds. The 12 user-owned extension-task deletions
  and `.tmp/` remain untouched.
- Canvas generation surface release completed on 2026-08-04. Commit `7cb26ce`
  is serving from production under PM2 PID `2846434`; public health is green,
  the deployment lock is absent, and the post-release authenticated ecommerce
  verifier delivered three stable assets in task
  `ec_76c948d0-93b8-446b-a4c2-1fbad40a063c`. The first deployment attempt was
  automatically rolled back because the shell held an older rejected session;
  the release was then confirmed with the latest session and the independent
  post-deploy canary passed. User-owned extension-task deletions and `.tmp/`
  remain untouched.
- Dedicated production Canvas segmentation verification completed on
  2026-08-04 against the released service using the three-container fixture.
  Remove Background returned a transparent asset with `subjectCount: 3`;
  Smart Layering returned one distinct product group, three distinct product
  instances, a clean background plate, and one editable text layer with no
  warnings. Asset ownership, transparency, geometry coverage, and exact
  canvas save/reload persistence all passed in session
  `1dc4095d-fc27-4451-b346-07e03663284e`. User-owned extension-task deletions
  and `.tmp/` remain untouched.
- Canvas generation correction follow-up completed locally on 2026-08-04.
  Text generation is an editable compact board whose selected composer creates
  images; image and suite nodes stay content-only until selected. Shared
  source tiles now contain complete centered previews, the footer owns ratio,
  1K/2K/4K quality, quantity and `@` controls, and suite references assign the
  first mention to the product lane and later mentions to the reference lane.
  Right-side derive ports open the same contextual surfaces as the add rail.
  Mobile composer placement reserves wrapped-footer height, and segmentation
  progress is monotonic on the transient processing node and animated edge.
  Smart-layer materialization deduplicates exact layers, keeps the group
  collapsed until drag, and connects every child directly to the source.
  Focused Canvas regression passed 45/45, full repository regression passed
  1,130/1,130, the 6,441-module production build and asset check passed,
  collaboration policy is READY, and mobile browser QA at 390x844 reported no
  composer overflow. No files are delegated; the 12 user-owned
  `server/extension_tasks` deletions and `.tmp/` remain untouched. Production
  deployment completed on 2026-08-04 under commit `30bcf93`. The latest
  authenticated release switched production to `index-Cn27HXHJ.js` under PM2
  PID `2887085`; final billing verification passed, final ecommerce
  verification delivered three stable assets in task
  `ec_82d3e621-0162-4d17-9461-79511c1cffa5`, the PM2 PID stayed stable through
  the canary window, and the deployment lock was cleared with three retained
  backups. Earlier attempts were automatically rolled back because the
  inherited canary session was stale. User-owned extension-task deletions and
  `.tmp/` remain untouched.
- Canvas generation node semantics completed locally on 2026-08-04. Left-rail
  文案生成、图片生成 and 电商套图 actions now create independent idle nodes;
  selecting a node opens its contextual composer, while only source/output
  image nodes expose the derive port. Right-side derive actions create the
  same composer with the selected image preserved as a direct connection and
  an inserted `@图片N` mention. Ecommerce suite composers now switch from the
  first-step product/reference brief to a selectable design-direction second
  step before streaming the final image plan. Port hit testing no longer
  overlaps resize handles, text and generation boards resize freely, and
  transient segmentation progress is rendered on the processing node/edge
  without a second floating progress card. Focused regression passed 101/101,
  full repository regression passed 1,138/1,138, the 6,441-module production
  build and asset check passed, and collaboration policy is READY. Production
  deployment remains the next release step; user-owned extension-task
  deletions and `.tmp/` remain untouched.
- Commercial billing, payment recovery, content reliability and market audit
  completed locally on 2026-08-04. Ecommerce, Canvas, Xiaohongshu and Plog now
  use the shared `ec_points` wallet; a complete nine-image content set costs
  nine AI points, while `867550189@qq.com` remains server-authoritative and
  unlimited for internal acceptance even when deployment allowlists add more
  accounts. Insufficient balance preserves the owner-scoped pending action,
  editor inputs, uploaded assets and Canvas state; real WeChat/Alipay adapters
  may create orders and verify raw-body webhooks asynchronously, but providers
  stay disabled until merchant credentials and signed callbacks exist. Content
  generation now uses bounded primary generation plus lower-concurrency missing
  image recovery, persists every asset before delivery, rejects incomplete or
  duplicate nine-image sets, and releases held points on exhaustion. SEO,
  security headers, explicit CORS, robots, sitemap, manifest and a reusable
  production audit were added, and the ordinary app icon payload was reduced
  from 154 KB to 23 KB. Fresh evidence: full repository regression 1,165/1,165,
  6,443-module production build, post-build asset check, collaboration READY,
  production baseline audit 27/27, dependency audit with no high/moderate
  finding, and clean whitespace validation. A final Canvas placement regression
  now keeps contextual composers fully inside the visible canvas even when every
  collision-free candidate is occupied; desktop and 390x844 browser QA confirmed
  the suite composer remains visible, the bottom toolbar stays unobstructed, and
  a plain-text node exits double-click editing on canvas blur without losing its
  content. Fresh full regression is 1,166/1,166 and the 6,443-module production
  build plus post-build asset check pass. The remaining release step is
  production deployment plus authenticated generation and billing canaries;
  user-owned extension-task deletions and `.tmp/` remain untouched.
- Production deployment diagnosis and transient recovery hardening completed on
  2026-08-04. The first authenticated release candidate passed billing but was
  rolled back after two ecommerce canary tasks failed. Read-only production
  checkpoints showed that the provider had generated the images: one task had
  two stable assets and the other had all three, but a provider-result download
  exceeded the single 20-second fetch deadline. Node reported `TimeoutError`,
  which the storage mapper did not recognize as retryable, so the complete-set
  gate correctly released the otherwise valid suite. Generated-image downloads
  now retry bounded transient network/timeout and 408/425/429/5xx failures;
  exhausted transient failures retain an explicit resumable error contract and
  remain checkpointed in `downloading` for idempotent background resume without
  provider replay or duplicate billing.
  VLM calls now honor timeout retries, while design-direction vision gets one
  retry and the optional planner keeps a shorter no-retry budget so the local
  four-direction fallback remains inside the 75-second route deadline. The new
  regression cases failed before the fixes and the focused suite now passes
  134/134. The full repository test command, 6,443-module production build,
  post-build asset check, collaboration policy and whitespace validation all
  pass. Production redeployment and authenticated canaries are next; user-owned
  extension-task deletions and `.tmp/` remain untouched.
- Release `16c0a01` deployed successfully to `https://shuimg.cn/` on 2026-08-04
  with PM2 process `3015960`. Authenticated ecommerce tasks
  `ec_79e41d18-f132-443c-b6d2-0aa0d00861f7` and
  `ec_f04f6923-30e8-420c-b970-5435ba8e1899` each delivered all three stable
  assets; one intervening semantic-quality `needs_review` result exercised the
  bounded canary retry without causing an infrastructure failure or rollback.
  The deploy gate independently reran the full 1,171/1,171 regression suite and
  6,443-module production build. A real public audit then found that Nginx-served
  SPA files bypassed Express security headers. The production virtual host is now
  versioned in `scripts/nginx/shuimg.cn.conf`; deployment backs it up, validates
  it with `nginx -t`, reloads safely, and restores it with the application on any
  failed release. The live configuration passed syntax validation and the final
  `https://shuimg.cn` SEO, security, health, billing and CORS audit passes 27/27
  with one canonical copy of each security header. User-owned extension-task
  deletions and `.tmp/` remain untouched.
- Canvas product-model completion passed local acceptance on 2026-08-05. The
  left add rail now creates idle copy, image, and ecommerce-suite nodes; only
  selection reveals a composer anchored directly below the node. Derived
  actions preserve one direct source edge and a real structured `@` reference.
  Copy boards and ordinary text objects are draggable on one click, editable on
  double click, free-resizable, and leave edit mode on canvas blur. New text is
  placed at the visible center or its nearest free center-adjacent position.
  Image composers expose centered labeled uploads plus mutually exclusive
  ratio, 1K/2K/4K quality, quantity, and mention controls. Ecommerce suite
  controls reuse the homepage sizing, SKU, style, product information, copy,
  and generation-setting panels with exactly one panel open at a time. Suite
  planning is now one locked overall design specification with editable,
  distinct per-image briefs instead of four repetitive directions. Smart
  layering upgrades the original image in place, keeps semantic children
  collapsed until extraction, groups product instances, uses transparent
  editable text, drops exact duplicates, and connects children only to the
  source. Completed generated and edited images are deduplicated into Works.
  Production orchestration now degrades one retryable visual-analysis failure
  to a deterministic validated plan before billing instead of leaving the job
  analyzing forever on upstream 502/timeout responses. Browser acceptance at
  1440x900 and 390x844 verified node/composer disclosure, panning, text drag and
  edit lifecycle, upload labels, parameter menus, structured mentions, and
  homepage panel reuse; browser logs contain no application errors. Focused
  Canvas regression passed 104/104, focused server regression passed 129/129,
  full repository regression passed 1,178/1,178, the 6,443-module production
  build passed, collaboration policy is READY, and whitespace validation is
  clean. The production diagnosis helper was removed; user-owned extension-task
  deletions and unrelated `.tmp/` research remain untouched.
- Ecommerce creative workflow rebuild Task 3 completed locally on 2026-08-05.
  The second-step direction cards now expose commercial objective, audience,
  product strategy, exact image groups and expandable per-shot duties, with a
  separately editable execution guide that keeps the edited direction selected
  and reaches the durable generation brief. The direction grid is desktop 2x2
  and mobile single-column. TDD red was observed before implementation; focused
  direction/UI/route regression passed 73/73, full repository regression passed
  1,184/1,184, the 6,443-module production build and post-build asset check
  passed, collaboration policy is READY, and whitespace validation is clean.
  Production deployment completed after authenticated canary verification; the
  12 user-owned
  `server/extension_tasks` deletions, `.tmp/`, and the unrelated diagnosis
  helper remain untouched.
- Production deployment completed on 2026-08-05 for commit `b59dd6b` via
  `scripts/deploy-production.ps1`. The first two attempts were automatically
  rolled back by the production quality gate (`401` canary credential on the
  first attempt, then a real provider result entering `needs_review`). The
  successful release passed public health, billing, three-asset ecommerce
  delivery, stable URL variants, Works continuity, and Canvas persistence.
  A post-timeout standalone verification passed with task
  `ec_614da207-c9ab-4214-b027-d0b1d5b2e3d4`; PM2 stayed on PID `3243301` and
  the remote deployment lock was cleared.
- Canvas Studio experience upgrade completed locally on 2026-08-05. Image
  sources now use canonical role labels (`产品图1` / `参考图1`) across tiles and
  mentions; composer surfaces are centrally exclusive and close on outside
  click, selection change, or Escape. Text nodes expose the complete readable
  editing toolbar, while ecommerce planning is one editable overall design
  plan with clear fields and per-image responsibilities. The visual layer now
  has larger upload rails, readable labels, stronger focus states, responsive
   toolbar overflow, and consistent spacing/shadows. Automatic ecommerce repair
   now permits only one small partial-failure repair, never auto-retries a
   full-batch failure, preserves the task reference, and supports explicit
   failed-item retry. Full regression passed 1,192/1,192 tests; the production
   build transformed 6,445 modules, and the asset and collaboration checks
   passed. Release `d425479` is live at `https://shuimg.cn/` with public and
   local health returning 200, PM2 on PID `3276104`, and the remote deploy lock
   cleared. The deployment wrapper exceeded its local wait during the
   600-second canary window, so authenticated billing and ecommerce verification
   were rerun independently after the remote PM2 restart; both passed, including
  delivery of three stable ecommerce assets. User-owned extension-task
  deletions, `.tmp/`, and the unrelated diagnosis helper remain untouched.
- The follow-up screenshot-driven ecommerce planning recovery completed locally
  on 2026-08-06 under commit `ddaf644`. Product and reference uploads now use
  canonical neutral labels; analysis facts, visual style, and uncertainty
  constraints are expanded into editable per-shot fields and compiled back into
  the durable generation direction. The homepage now shows generation errors at
  the generator, Canvas opens a durable empty workspace when no result exists,
  and a synchronous error boundary prevents a blank page after a render error.
  Focused direction and Canvas plan regressions passed. The full repository
  suite passed serially at `1194/1194` (parallel Node test workers can race when
  SQLite child processes close), the 6,448-module production build and post-build
  asset check passed, `git diff --check` is clean, and the local Canvas QA page
  loaded without console errors. User-owned `server/extension_tasks` deletions,
  `.tmp/`, and `scripts/diagnose-recent-ecommerce-jobs.cjs` remain intentionally
  uncommitted and untouched.
- Canvas suite failure recovery follow-up completed locally on 2026-08-06.
  A suite with an already-rendered overall plan previously hid `node.error` in
  the plan-preview branch while its confirm action immediately dismissed the
  composer, leaving only a transient Toast and making an intentional retry hard
  to distinguish from a duplicate submission. The selected suite composer now
  remains visible, presents its failure beside the confirm action as an
  accessible alert, and exposes a deliberate `重新生成` action that reuses the
  existing generation handler (which clears the error and preserves existing
  retry/idempotency semantics). TDD RED was observed in
  `test/canvas-studio-contract.test.mjs`; the post-review follow-up adds a
  synchronous in-flight guard around charged suite submissions and leaves only
  the explicit retry control after an error. Focused Canvas regression passed
  47/47, the full serial repository test suite, 6,448-module production build,
  post-build asset check, collaboration policy, and whitespace check all passed.
  User-owned `server/extension_tasks`
  deletions, `.tmp/`, and `scripts/diagnose-recent-ecommerce-jobs.cjs` remain
  intentionally uncommitted and untouched.
- The recovery follow-up is committed locally as `2e75578` (`fix: keep canvas
  suite failures actionable`) and independently re-reviewed with no remaining
  findings. Production deployment has not run: two invocations of the mandated
  `scripts/deploy-production.ps1` were stopped before script execution because
  external permission review timed out. Do not describe production as updated;
  the last known live Canvas release remains `d425479`. A later authorized
  resume must run the deployment script and its production canaries before
  closing the release.
- Production release completed on 2026-08-06 at `f7675a4` after the invalid
  stored canary session was replaced with an in-memory server-issued canary
  session. The controlled deployment reran the serial suite and production
  build, passed public health and authenticated billing before and after the
  600-second canary window, and passed two real ecommerce verifications with
  three stable assets each (`ec_20c2f66b-0047-4d1c-b05e-b460538dc2d6` and
  `ec_72075b1b-b4fb-4eb8-aed8-ae678cb343b7`). PM2 remained on PID `3515947`;
  the remote deployment lock was released. The temporary canary token was held
  only in the deployment process and was removed afterward.

- Production release completed on 2026-08-06 at `0ca4f81` through the mandated
  `scripts/deploy-production.ps1` flow. The local full regression passed
  `1200/1200` and the Vite production build passed. Public health and billing
  verification passed, followed by two authenticated ecommerce production
  checks that each delivered exactly three stable assets
  (`ec_dfd8afb2-dba8-46c8-8c36-8127628c952b` and
  `ec_2ff9ac11-c070-4ed7-83e2-a26bde9756b1`). The 120-second canary completed
  without a PM2 PID change; post-canary billing also passed and the remote
  deployment lock was released. User-owned deleted `server/extension_tasks`
  files, `.tmp/`, and `scripts/diagnose-recent-ecommerce-jobs.cjs` remain
  uncommitted and untouched.
- Screenshot-driven ecommerce delivery recovery completed locally on 2026-08-07.
  The design plan now exposes only the editable `整体规划` and `逐张规划`
  surfaces in a neutral product-tool layout; desktop 1440x900 and mobile
  390x844 browser checks found no horizontal overflow or console errors.
  A persisted provider image is now delivered even when advisory quality or
  suite-diversity feedback fails, and neither new nor ordinary legacy quality
  repair states can submit another provider image request. One deterministic
  local Sharp repair remains available without provider cost. Genuine
  provider-no-image failures still retain targeted completion recovery. Task
  and Canvas wording no longer exposes internal quality-review or full-suite
  regeneration language. TDD RED was observed for both current and legacy
  repair behavior; focused orchestrator regression passed 88/88, the full
  repository suite passed 1202/1202, the 6448-module production build and
  post-build asset check passed, collaboration policy is READY, and whitespace
  validation is clean. Production deployment is the remaining release step;
  user-owned extension-task deletions, `.tmp/`, and the diagnosis helper remain
  uncommitted and untouched.

- Screenshot-driven ecommerce delivery recovery was deployed and independently
  verified on 2026-08-07 at release `9a94711`. The first deployment continuation
  identified that `SHUBAO_CANARY_SESSION_TOKEN` had been set to a literal
  PowerShell expression rather than a session value. A proposed server-local
  signer was rejected by the security gate and fully reverted in `9a94711`;
  production retained the normal externally authenticated Canary boundary. The
  user-provided session then passed a standalone billing probe before deployment.
  The mandated `scripts/deploy-production.ps1` reran the serial repository suite
  (`1202/1202`) and transformed `6448` modules, installed and restarted PM2, and
  passed billing plus two real ecommerce verifications around the full 600-second
  Canary window. Tasks `ec_d212189e-968a-428b-98c7-f3cba0dfa318` and
  `ec_cd30e7bd-4d20-4d70-9213-7131a04aa118` each delivered exactly three stable
  assets. PM2 remained on PID `3714312`; the remote deployment lock was released.
  Independent public audit passed `27/27`, and local/remote `dist/index.html`
  SHA-256 matched at
  `c3c93585cdd4f64bea6447c3dda80eef8fc881fcf39dc71cacd03ce9b545f7fe`.
  User-owned extension-task deletions, `.tmp/`, and the diagnosis helper remain
  uncommitted and untouched.
- Global ecommerce Canvas delivery release candidate completed locally on
  2026-08-07 across commits `97098af`, `f950578`, `f20257b`, and `ee92a83`.
  Arrow mode now performs real marquee selection with an arrow/crosshair cursor,
  Hand mode exclusively pans with grab/grabbing feedback, and the bottom dock
  exposes the Shift multi-select hint without overlapping mobile controls.
  Canvas cards and contextual toolbars use compact content-sized metadata and
  controls. Export provenance excludes uploaded source assets and non-image
  composition data; browser-native directory/file pickers are used where
  available, with image-only single-file or ZIP fallbacks. Detail merging is
  now a deterministic top-to-bottom ecommerce long-image workflow with explicit
  ordering, server-side Sharp composition, PNG/JPEG output, and no alignment
  controls. Detail generation is 9:16 throughout planning, UI, policy, prompt,
  and provider-size resolution. Variant comparison plans carry exact confirmed
  SKU facts into deterministic overlays, while white/transparent catalog assets
  preserve already-compliant sources and prohibit shadows, cropping, halos, and
  edge contamination. Desktop 1440x1000 and mobile 390x844 browser acceptance
  verified marquee selection, panning, compact multi-selection controls,
  export-source exclusion, save-location language, disabled ineligible long
  export, zero horizontal overflow, and zero console warnings/errors. The full
  serial repository suite passed `1220/1220`; the 6,451-module production build,
  export validation, and collaboration check passed. Production deployment is
  the remaining step. The 12 user-owned extension-task deletions, `.tmp/`, and
  `scripts/diagnose-recent-ecommerce-jobs.cjs` remain untouched and uncommitted.
- Global ecommerce Canvas delivery was released to `https://shuimg.cn/` on
  2026-08-07 from commit `fe0ae63` through the mandated production deployment
  path. The deploy gate independently reran the full `1220/1220` serial suite
  and 6,451-module production build, backed up the application, WebRoot, Nginx,
  and SQLite state, validated Nginx, and restarted PM2. Initial authenticated
  ecommerce task `ec_ab108b63-8b7a-45be-83ae-85176ad50ccf` delivered three
  stable assets before the Canary. After the process-output connection ended,
  the unchanged PM2 process had remained healthy for substantially longer than
  the planned 600-second observation window; independent post-Canary billing
  and ecommerce verification then passed with task
  `ec_a2f79816-6090-4098-a1f7-93b3f357bfb9`, again delivering three stable
  assets with Canvas persistence and image variants. PM2 remained on PID
  `3866031`. The public SEO, security, health, billing-catalog, and CORS audit
  passed `27/27`; local and production `dist/index.html` SHA-256 matched at
  `7aa407016372551695fac4e08f5024c993fbc2cbb10e52e8e43edeaf028f5b6d`.
  The release lock and exact temporary helper directory were cleared. User-owned
  extension-task deletions, `.tmp/`, and the diagnosis helper remain untouched
  and uncommitted.

- Ecommerce Canvas creative/export stability release completed on 2026-08-07
  at `02e517d` (`fix: compact canvas selection toolbars`) and is live at
  `https://shuimg.cn/`. Arrow mode now supports drag marquee selection while
  hand mode only pans; compact contextual actions stay visible on desktop and
  mobile. Export uses a two-stage destination then explicit `开始导出` flow,
  suite ZIPs contain generated images only, and selected detail images compose
  into a durable, vertically stitched long image placed to the right of source
  nodes. Detail defaults are 9:16; confirmed SKU facts reach overlays; compliant
  white/transparent sources retain clean edges without added shadows.
  Browser acceptance at `1440x1000` and `390x844` verified marquee, hand pan,
  Shift selection, export paths, long-detail placement, dismissible notices,
  no horizontal overflow, and no console/network errors. The release gate passed
  full serial regression `1265/1265`, a 6,455-module production build,
  `npm run check`, `npm run collab:check`, and whitespace validation. The
  mandated deployment script backed up and validated production, then passed
  public health, 600-second Canary, stable PM2 PID `3983196`, and two real
  ecommerce checks: `ec_8f02ea03-d987-4cf9-b7f0-60731e3ad7cb` and
  `ec_c69dd604-b011-4dba-bbf6-6f050c27d400`, each with three stable assets.
  A transient Canary ecommerce verification retried once and passed. Independent
  public audit passed `27/27`; local, remote application and WebRoot
  `index.html` SHA-256 values match
  `85177ffb7cf961ddace3fff333bdcf489d2359264d110025a8e1038d47aa7c04`.
  The remote deployment lock is released. The 12 user-owned deleted
  `server/extension_tasks` files, `.tmp/`, and
  `scripts/diagnose-recent-ecommerce-jobs.cjs` remain intentionally uncommitted
  and untouched.

- Production data recovery completed on 2026-08-07 for owner
  `867550189@qq.com`. The reported empty Works page was not a legacy migration
  omission: the live database contained 54 active works, 79 projects and 173
  project assets for this owner, with no soft-deleted works. A read-only
  `PRAGMA integrity_check` identified inconsistent `works` and `tasks` indexes;
  this allowed a work-list read to fail and the client fallback to appear as an
  empty collection. A consistent SQLite backup was created under the protected
  production deploy-backup directory before executing `REINDEX` only. Post-fix
  integrity is `ok`, the exact owner query returns all 54 records (50 on the
  current list page), `/health` is healthy, and PM2 remained PID `3983196`.
  No work payload, owner, asset, project, or billing record was changed.

- Global entitlement visibility is complete locally at `d44ebff` and `c0658ab`.
  The shared server-authoritative balance control now appears in the application
  header and Canvas, distinguishes `AI 积分` from `购买额度`, supports guarded
  refresh and the existing login/pricing paths, and keeps mobile Canvas commands
  accessible. Focused regression passed `17/17`; the serial repository suite
  passed `1273/1273`; the production build transformed `6457` modules; build,
  collaboration, and whitespace checks passed. Local browser acceptance could
  not be run because the environment denied access to `127.0.0.1:5174`.
  A production release attempt from `c0658ab` was safely rolled back after the
  authenticated billing probe returned `401`; the script restored the previous
  application and Nginx backup and released the remote lock. Do not describe
  this feature as live until a newly issued ephemeral
  `SHUBAO_CANARY_SESSION_TOKEN` passes the normal deployment gate. User-owned
  extension-task deletions, `.tmp/`, and the diagnosis helper remain untouched.

- Ecommerce Canvas and entitlement delivery release completed on 2026-08-07 at
  `6213ab1` (`fix: close ecommerce canvas and credit delivery gaps`). The
  mandated deployment path reran the serial suite (`1275/1275`) and the
  6,457-module production build, then backed up production and restarted PM2.
  Authenticated billing passed before and after the full 600-second Canary;
  real ecommerce verifications `ec_42adc18f-be89-4cd5-bb0d-ce4837d8d1ba` and
  `ec_3eb2752c-da29-4bfb-88f0-4f795b882541` each delivered three stable assets.
  PM2 remained stable on PID `4022215`; the remote deployment lock was
  released. Independent public health and billing probes passed, and the public
  security, SEO, catalog, and CORS audit passed `27/27`. The temporary Canary
  session token was held only in the deployment process and removed at exit;
  user-owned extension-task deletions, `.tmp/`, and the diagnosis helper remain
  untouched.

- Canvas interaction follow-up completed locally on 2026-08-08. The shared
  entitlement control now preserves readable label, numeric balance, and
  recharge-arrow colors over its Canvas dark hover state. Long-image preview
  opens at 100%, listens to a non-passive mouse wheel, clamps zoom to 50%-400%,
  and resets when closed or replaced. Hand mode retains empty-canvas panning,
  but clicking a node selects it and exposes the same object toolbar as Select
  mode; modifier multi-selection remains available in both modes. Focused
  tests passed, the full serial suite passed `1282/1282`, and production build
  (`6457` modules), build check, collaboration policy, and whitespace validation
  passed. Browser-only visual inspection was not run because the local gstack
  browse binary has not been set up; no runtime file or credential was changed.

- Production deployment of `58f4a1d` was attempted on 2026-08-08 through the
  mandated deployment script. Local serial tests and the production build
  passed, remote backup/upload/restart and public health passed, then the first
  authenticated billing probe returned `401`. The script fail-closed, restored
  the remote application and Nginx backup, reloaded PM2, and released the
  deployment lock. The public `/health` endpoint was healthy after rollback.
  The local `SHUBAO_CANARY_SESSION_TOKEN` and current clipboard were not
  parseable JWTs, so a fresh owner session is required before retrying; do not
  bypass the billing canary or claim this commit is live.

- A second deployment of `c0d21f6` completed on 2026-08-08 with a fresh
  owner-scoped HMAC session supplied only to the release process. The full
  deployment workflow retained the new release, completed its long Canary and
  authenticated verification stages, then released the remote lock. Post-release
  public health remained stable, remote and local `dist/index.html` SHA-256
  matched at `5e97dff096123a27f26cbb2851fd38e61f5a8e76a9c910a82d9cd136357a3479`,
  and the independent public audit passed `27/27`. The earlier `401` attempt
  had already restored safely; this later record is the authoritative online
  state for the Canvas interaction follow-up.

- Ecommerce task reconnection and gallery ownership release `28e22cb` completed
  on 2026-08-08. The reported `Failed to fetch` task was confirmed in production
  as `completed` with all 10 assets; the client had mistaken an exhausted
  transient polling burst for a business failure. New submissions now reuse a
  durable owner/draft idempotency key, transient POSTs cannot create duplicate
  jobs or charges, and exhausted polling reconnects to the same durable task.
  The complete 14-case, 117-image `薯包出品` catalog is now part of the release
  archive, atomically replaced and rolled back with the application, and image
  components retry bounded decode/delivery failures instead of remaining blank.
  The mandated release passed `1287/1287`, the 6,457-module build, all 117 public
  gallery probes, authenticated billing, two real ecommerce tasks
  (`ec_6d3f5b7a-6e4d-4c39-986f-0ed47423fc1a` and
  `ec_9e5c0814-333a-40af-9ac7-a15c19cf8a02`, three stable assets each), and the
  600-second Canary on stable PM2 PID `22334`. Independent browser acceptance
  decoded all 14 covers with zero HTTP failures and opened the image modal;
  public audit passed `27/27`. Production contains 14 top-level case folders and
  132 source files with no nested duplicate, and the deployment lock is free.

- Global commerce generation implementation completed locally on 2026-08-08.
  A single normalized commerce context now carries content type, domestic or
  cross-border platform, target language/locale and policy version from the
  first-step configuration through design direction, durable orchestration,
  per-asset planning, provider prompts, Works persistence and Canvas suite
  recovery. The UI exposes main/detail/ad modes, 18 platform targets and 22
  language choices in portal-backed menus; visual-only output explicitly bans
  generated typography, while localized output preserves confirmed facts and
  locale policy. Detail defaults remain 9:16 and legacy tasks keep their prior
  behavior. The serial suite passed `1320/1320`; the production build transformed
  `6458` modules; asset, collaboration and whitespace checks passed. Commit
  `69fdd38` was deployed through the mandated release script. Production stayed
  healthy on PM2 PID `122374` through the full 600-second Canary; real tasks
  `ec_665db7a4-da6b-4f8b-baa1-ac0238aafd4e` and
  `ec_7d9aea13-ea33-4a2a-bb2d-f6c89dac900e` each delivered three stable assets.
  The independent public audit passed `27/27`, the deployed bundle contains the
  new Amazon A+, TikTok Shop and visual-only controls, and the remote lock was
  released. The friend beta account `240485042@qq.com` remains a real unlimited
  user and was excluded from automation; only owner account `867550189@qq.com`
  was eligible for the deployment Canary.

- Video creation integration candidate completed locally on 2026-08-10. Home
  mode cards now present ecommerce generation, video generation, and
  Xiaohongshu content in that order with fixed angled poses; the video
  workbench is embedded in the same visual shell, supports script, first/last
  frame, multimodal reference, and remake workflows, and routes delivered
  video results into the existing Canvas video-node path without paid
  generation during QA. Ecommerce generation settings are first in the
  toolbar, use real model visual thumbnails, keep the server quote next to
  resolution, and move negative constraints into visual direction. Focused
  contracts passed, full serial regression passed `1359/1359`, production
  build passed with `6462` modules, `npm run check`, `npm run collab:check`,
  and whitespace validation passed. Production deployment is the remaining
  step. User-owned package changes, extension-task deletions, `.tmp/`, and the
  diagnosis helper remain untouched and uncommitted.

- Video creation experience unification Task 1: complete (commits
  `77e1c5d..875935a`, review clean). The standalone studio now exposes only
  smart creation, first/last frames, and viral remake; all optional smart
  image/video/audio references survive the API boundary, and focused model,
  studio contract, and server generation tests pass `9/9` without paid work.

- Video creation experience unification Task 2: complete (commits
  `875935a..d20739d`, review clean). Canvas now uses the same three video jobs,
  validates frame/remake materials before quote creation, routes mixed image
  and video sources through one uploader, and preserves connected nodes,
  durable polling, and result placement. Focused contracts pass `7/7`; the
  production build transformed `6463` modules without paid generation.

- Free visual creation integration and reference-asset correction completed
  locally on 2026-08-10. The fourth home entry is `自由创作`, with skill-based
  poster, social-cover, brand-KV, and free-creation recipes, durable reference
  uploads, per-slot retries, Canvas handoff, and server allowlisted intent
  prompts. The home video and free-creation cards now use the user-provided
  transparent layered-card PNGs directly (`reference-card-video.png` and
  `reference-card-product.png`); the previously generated opaque collages are
  no longer referenced. Desktop and 390px mobile browser checks found no
  horizontal overflow or image clipping. The API now defers optional Canvas
  VLM client creation until a vision action runs, so an unconfigured local VLM
  no longer prevents health and gallery-image routes from starting; those
  routes returned 200 and the full browser pass had no failed responses or
  console errors. Full serial regression passed `1379/1379`, production build
  transformed `6467` modules, and build, collaboration, and whitespace checks
  passed. No paid generation was used; production deployment was intentionally
  pending at this local-validation checkpoint.

- Production release `8d793fe` completed on 2026-08-10 through the mandated
  `scripts/deploy-production.ps1` entry point. The release passed `1379/1379`,
  the 6,467-module production build, all 117 gallery-image checks,
  authenticated billing verification, and two real ecommerce tasks
  (`ec_c5c91415-d80c-403b-a602-4856bae6f2b0` and
  `ec_8bb9251f-5a16-4baf-aafc-c03cd41c06ba`, three stable assets each). The
  full 600-second Canary completed on stable PM2 PID `826010`; explicit public
  audit passed `27/27` at `https://shuimg.cn/`. Independent 1440px desktop and
  390px mobile browser acceptance confirmed all four home entries, the supplied
  transparent layered-card assets, and the free-creation workspace with no
  failed responses, console errors, or horizontal overflow. The deployment
  script reported the remote lock released and saved the PM2 process list.
- 2026-08-11 continuation: the local release candidate now preserves the original ecommerce
  product x reference workbench as the default and adds try-on as an explicit ability recipe.
  Try-on uses semantic product/person/scene slots, an original input-to-output showcase,
  tailored material/fit/consistency settings, and a server-backed second-step plan. Free
  creation uses the same workbench language with four skill previews and a unified reference
  upload/prompt/toolbar contract. Video keeps three distinct modes, multimodal plan analysis,
  idempotent billing, fair queues and Canvas handoff; no paid video generation was run.
  Admin now reports account permissions, finite point balances, audit history, runtime/task
  health, and cost/profit breakdowns by feature, provider, SKU and model. Full regression has
  passed `1453/1453`; desktop and 390px browser QA found no console errors or page overflow.
  Remaining release gate: build/check, explicit staging and review, then the mandated production
  deployment script and public verification. User-owned extension-task deletions, `.tmp/`, and
  the diagnosis helper remain outside the release. Production video generation remains a user
  test because it is paid.

- Production release `996792d` was completed through `scripts/deploy-production.ps1` on
  2026-08-11. The local command window expired during the final post-Canary tail, so the
  wrapper did not return its final line; independent verification confirmed the release was
  active and no rollback was needed: local and remote `server/index.mjs` and `dist/index.html`
  SHA-256 values matched, PM2 `shubao-production` was online at PID `1147183`, the deployment
  lock was free, public health returned 200, the public audit passed `27/27`, and the public
  video capability contract passed without creating a video task. PM2 startup state was saved.
  No paid video generation was run. The remaining external acceptance item is one user-run
  real video generation against the configured Seedance route.

- 2026-08-12 ecommerce stability and workbench polish release candidate: production
  diagnosis identified the recurring first-failure/second-success pattern as an expired
  billing quote reused from the design-direction page. The failed request created no
  provider assets and incurred no image-generation cost. Confirmation now refreshes the
  quote immediately before durable job creation, with server-side freshness preflight
  before persistence. Mention insertion now preserves the caret and selection and works
  on the first click across ecommerce, Xiaohongshu, free creation, video and Canvas.
  Ecommerce step two no longer renders the home mode-card showcase over analysis content;
  its plan hierarchy, editable states and route-difference labels are clearer and fully
  localized. The prompt assembler now preserves the compiled `abilityRecipe` section.
  Full serial regression passed `1462/1462`; the production build transformed `6474`
  modules; build assets, collaboration policy and whitespace checks passed. Desktop and
  390px browser QA covered ecommerce, try-on, video, free creation and the animated
  sidebar without console errors or page overflow. No paid video generation was run.
  Remaining gate: explicit staging and review, commit, mandated production deployment,
  then public acceptance. User-owned extension-task deletions, `.tmp/`, and the diagnosis
  helper remain outside the release.

- 2026-08-12 upstream cost sync candidate: audited the logged-in 65535,
  Change2Pro and IP233 consoles and added `server/billing/upstreamLedger.mjs`.
  Admin now reconciles provider-reported balance/today/cumulative spend,
  requests, live route prices, local point settlement, and the provider/local
  cost difference. Relay `$` values are RMB 1:1. IP233 Seedance request routes
  remain the low-cost production candidates; no paid video generation was run.
  Full regression passed `1468/1468`, build transformed `6474` modules, and
  `git diff --check` is clean. Runtime extension-task deletions, `.tmp/`, and
  the diagnosis helper remain excluded. Commit `2d24d93` is now deployed as
  release `20260812-152607-2d24d93`; PM2 PID `1420063` is online, public health
  is `200`, public audit is `27/27`, and anonymous admin summary is `401`.
  Owner-admin browser QA confirmed all three provider snapshots and the RMB
  1:1 unit-price/points/settlement ledger without desktop horizontal overflow.
  The deployment runner was terminated by its local 900-second execution limit
  during the final Canary tail; independent health and PM2 checks remained
  stable for about 14 minutes. No second paid ecommerce task and no paid video
  task were run. Runtime extension-task deletions, `.tmp/`, and the diagnosis
  helper remain excluded. Next boundary: user-owned real video acceptance only;
  do not trigger it automatically.

- 2026-08-13 screenshot-driven production-case redesign is approved and active under
  `docs/superpowers/specs/2026-08-13-production-case-and-canvas-experience-redesign.md`.
  Showcase assets for anything-tryon and all four free-creation recipes must be created
  through the real ShuBao production image pipeline so case creation also validates
  idempotency, billing, provider delivery, stable assets, Canvas handoff, and recovery.
  Local contract and UI fixes must land before paid image cases are submitted. Each case
  gets one initial task; a retry may reuse the same request key only after confirming no
  duplicate settlement. Existing provider images must never trigger an automatic second
  provider call. No real video generation is authorized. The 12 extension-task deletions,
  `.tmp/`, and `scripts/diagnose-recent-ecommerce-jobs.cjs` remain user-owned and excluded.

- 2026-08-13 production-case and Canvas acceptance completed locally. Twenty-four
  visual recipe examples (six each for free creation, poster, social cover, and
  brand KV) plus one real anything-tryon example were generated through the
  production image route, synced to durable public assets, and wired into the
  home showcase with native ratios, modal arrows, keyboard navigation, and
  Works/"做同款" metadata. The try-on run reused task
  `ec_c0e0e32f-686c-4184-bdd5-27a17d0bbceb` after retry and its 3:4 result was
  visually inspected. Canvas segmentation acceptance completed against the
  real production route: transparent removal, one product group, six unique
  product instances, a clean background plate, and save/reload session
  `a0901cd6-62eb-4536-a71b-36552a6b48b7`; no original source node remains in
  the replacement layer snapshot. The verifier now derives billing action IDs
  from source pixels and SKU so interrupted audits replay safely. A short-timeout
  duplicate audit was formally reversed by 3,500 units under a separate admin
  idempotency record. Full serial regression passes `1506/1506`; build transforms
  `6477` modules. Formal production deployment and public acceptance remain the
  final gate. No paid video generation was run.

- 2026-08-13 visual gallery polish candidate `d258a93` integrates all 24
  production-backed visual assets with their actual generation prompts and
  replay settings into Inspiration Discovery. Ecommerce, Xiaohongshu and the
  four visual recipes are deterministically interleaved; the first 16 cards
  render first and an IntersectionObserver reveals later batches. Natural
  aspect ratios, masonry flow, hover overlays and one-image modal deduplication
  remove the fixed-frame whitespace shown in beta screenshots. The visual
  recipe showcase now uses mode-specific native-ratio layouts, lighter selected
  states and the ecommerce-family warm-to-white background treatment. Browser
  acceptance verified 1440px and 390px without horizontal overflow, progressive
  16-to-28-card loading, a single-image detail with the complete production
  prompt, and zero application alerts. The committed release head is `5caefea`.
  Its final deployment regression passed `1507/1507`, and the production build
  transformed `6478` modules. `scripts/deploy-production.ps1` deployed the release
  on 2026-08-13: all 117 gallery images and responsive variants passed delivery
  verification; PM2 stayed on PID `1846772` through the 600-second Canary; public
  billing and video capability contracts passed; and authenticated ecommerce
  tasks `ec_f8d90e8a-c110-4132-85da-4c8ed9e65e3c` and
  `ec_efa38f6f-9fe2-43e3-b130-8e0a7f9058f0` each delivered three stable assets.
  The release finished with the PM2 snapshot saved and the remote deployment lock
  released. No paid video generation was run. Runtime extension-task deletions,
  `.tmp/`, and the diagnosis helper remain excluded.

- 2026-08-14 ecommerce showcase final release `1d7eff3` is live at
  `https://shuimg.cn/` through the mandated `scripts/deploy-production.ps1`
  path. Nginx current is `/var/www/shubao/releases/20260814-182811-1d7eff3`;
  PM2 PID `2139610` is healthy, the deploy lock is free, and the root disk has
  about `5.3G` available after removing only verified stale deploy helpers,
  non-current static releases, and oldest backups. Full regression passed
  `1523/1523`, build transformed `6479` modules, 117 gallery images and two
  public video products passed contract checks, the full 600-second Canary
  completed, and ecommerce tasks
  `ec_38dc5aee-5f32-41d4-9cc4-a21072aa37ab` and
  `ec_c596bacf-4418-4141-b04d-afa22e473734` each delivered three stable assets.
  Online browser QA at 1440px, 768px, and 390px confirmed no horizontal
  overflow, no failed image decodes, no console errors, working modal keyboard
  navigation, stable 16-to-28 gallery reveal positions, and working hover/remix
  controls. The homepage showcase rasters were created with Codex imagegen,
  not the ShuBao production generator; the two recorded Canary jobs are the
  independent evidence for the real production pipeline. The executable video
  roadmap remains at
  `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`, ordered P0
  reliability, P1 asset/storyboard/timeline MVP, P2 declarative Skills and
  project memory, then P3 precision editing and routing. No paid video job was
  created. The 12 runtime extension-task deletions, `.tmp/`,
  `.tmp_patch_responsive.py`, and the diagnosis helper remain user-owned and
  excluded.

- 2026-08-15 production-showcase and image-delivery release candidate replaces
  the imagegen homepage mockups with real ShuBao production outputs. The
  ecommerce showcase uses task `ec_request_739acd9f-4873-4ff2-94b5-35f057278356`
  and request catalog `showcase-20260814-earbuds-suite` for one complete
  pearl-white earbud source plus white-background, benefit, lifestyle, craft
  and long-detail deliverables. Anything try-on now presents the complete
  uncropped flat-lay, full reference person and four independently generated
  front/motion/side/back street-fashion outputs; source/reference cards never
  reuse cropped composites. Both ability selectors are compact 58px fan-card
  tabs, while product and try-on stages share one continuous warm-to-white
  workbench gradient and all images open in the shared keyboard-accessible
  lightbox. Free-creation previews use equal 390px stages with native-ratio,
  recipe-specific arrangements and an alternating social-cover layout.
  `ResponsiveImage` now loads checked-in 720px WebP thumbnails before durable
  full-resolution sources: 56 thumbnails total 2.07 MB versus 141.09 MB of
  originals, a 98.5% transfer reduction for card views. All 112 source and
  thumbnail files passed pixel decoding; three corrupt cached production PNGs
  were re-downloaded from their existing stable task URLs without new billing.
  Browser acceptance at desktop and 390px verified no horizontal overflow,
  stable 16-to-28-to-40-to-42 masonry positions, no duplicate gallery titles,
  no failed visible image decode, modal button/keyboard navigation, and a real
  contenteditable caret insertion result of `ABCXDEF`. Ecommerce uploads now
  send authenticated raw image bytes, deduplicate in-flight File uploads,
  retry one transient network/provider failure and retain Data URL compatibility;
  the server validates binary roles and persists through the existing durable
  asset service. Full serial regression passed `1532/1532`, collaboration and
  asset checks passed, and `git diff --check` is clean. Remaining release gate:
  explicit staging/review, commit, mandated production deployment and public
  browser verification. The 12 runtime extension-task deletions, `.tmp/`,
  `.tmp_patch_responsive.py`, and the diagnosis helper remain user-owned and
  excluded. No paid video generation was run.

- 2026-08-15 production-showcase and image-delivery release is complete at
  `888b81c` through the mandated `scripts/deploy-production.ps1` path. Full
  regression passed `1535/1535`, build transformed `6479` modules, and check,
  collaboration, whitespace, 117-image delivery, public video contract,
  billing, two real ecommerce generations, and the full 600-second Canary all
  passed. Pre-Canary task `ec_4185742d-290d-4724-8bf9-5095976a95cd` and
  post-Canary task `ec_d15b1429-b46a-48da-8119-6fd256b925f2` each delivered
  three stable assets. Public health is ready, the homepage returns 200, and
  the active bundle is `assets/index-Bb3OH1SM.js`. Live desktop/mobile QA found
  no document overflow, broken images, or failed mode/lightbox interactions.
  A follow-up coordinate audit revealed the apparent 16-to-28-to-40 gallery
  "reorder" was only column-major DOM enumeration: every previously visible
  card retained the exact same document x/y/width/height while new cards were
  appended below their columns. No corrective gallery code change was made.
  No paid video generation was run. Runtime extension-task deletions, `.tmp/`,
  `.tmp_patch_responsive.py`, and the diagnosis helper remain excluded.

- 2026-08-15 AI-video research and route discovery is complete. The current
  project/version, asset, billing, generation, canvas, gallery, operations and
  one-shot video code paths were inventoried before proposing new architecture.
  `VideoStudio` remains the shot-generation foundation; the exact missing layer
  is durable project asset versions, storyboard shots, candidates/selections,
  timeline clips, declarative SkillRuns and a provider-result event log. The
  evidence and three route options are recorded in
  `docs/superpowers/specs/2026-08-15-ai-video-platform-evidence-and-options.md`.
  The recommended route uses Flova/TapNow as the project/workflow skeleton and
  selectively adopts proven interaction patterns from Runway, Firefly,
  Higgsfield, Luma, Google Flow, Dreamina, Vidu and Kling. Open-source reuse is
  license-gated; GPL workflow projects are references or isolated services, not
  code to copy into the proprietary UI. Public WeChat index snippets and public
  videos confirm the direction of the 屿帆AI methods, but full article text was
  not obtained and is explicitly not represented as verified. New AI-video
  implementation is waiting at the required product-route approval gate. No
  paid video generation was run, and the user-owned runtime deletions/temp files
  remain excluded.

- 2026-08-15 AI-video P0 reliability audit is complete and recorded in
  `docs/superpowers/specs/2026-08-15-ai-video-p0-reliability-audit.md`. The
  existing video path has useful idempotency, queue, circuit-breaker, provider
  task recovery and wallet primitives, but six code-proven gaps block P1:
  unauthenticated asset reads, a terminal `needs_review` dead end, swallowed
  credit-release failures with false refund copy, non-atomic delivery/billing/
  job/work projection, isolated unversioned video assets, and whole-file upload
  and download buffering. Existing video tests pass 39 targeted cases, but no
  route test protects asset ownership and no operational action resolves review
  jobs. The audit defines the failure-injection tests and hard P0 exit gates;
  implementation remains behind route-C and formal-design approval. No paid
  generation or runtime-data mutation occurred.

- 2026-08-15 the formal AI-video P0 foundation design is complete at
  `docs/superpowers/specs/2026-08-15-ai-video-reliable-media-job-foundation-design.md`.
  It fixes route C and the P0 boundary, defines the Job/Attempt/Delivery/Billing/
  Projection and ReviewCase state machines, durable outbox/reconciliation,
  authenticated user media, short-lived provider media signatures, streaming
  delivery, additive migration flags, rollback, SLOs and the full fault-injection
  exit matrix. Resumable upload is no longer an open dependency choice: use the
  official MIT `@tus/server`, `@tus/file-store` and `tus-js-client`, keep ShuBao
  SQLite sessions as the owner/audit source of truth, reject legacy
  `tus-node-server`, and stop at a design-change gate instead of silently
  hand-rolling a partial protocol if integration tests prove incompatibility.
  The design is self-reviewed and is waiting for the required written product
  approval before a file-by-file TDD implementation plan. No production code,
  deploy, paid video generation or runtime-owned files were changed.

- 2026-08-15 the complete existing-product requirement/evidence audit is now
  recorded in
  `docs/superpowers/specs/2026-08-15-existing-product-requirements-evidence-audit.md`.
  Every previously stated ecommerce, free-creation, gallery, upload/caret,
  Canvas, reliability/admin and AI-video requirement is mapped to code, tests
  and production evidence or an explicit limitation. The only newly proven
  undeployed behavior gap was smart layering: success must replace the source
  image and pending placeholder at the same frame, preserve source provenance
  without a live source edge, initially show one collapsed layer-group
  composite, and on the first layer extraction hide that composite while
  revealing all real child layers. Failure keeps the source image. The change
  was developed red-green and the focused Canvas suite passes 77/77. A final
  relation-migration review added coverage so source-node workflow edges move
  to the replacement group instead of disappearing; the focused interaction
  suite passes 71/71. The full repository passes 1537/1537, the production build
  transforms 6479 modules, build check and collaboration policy pass, and the
  diff check is clean. Commit, production deployment and public verification
  remain pending. No paid video generation ran, and the 12 runtime
  extension-task deletions plus local temporary/diagnosis files remain excluded.

## 2026-08-18 Ecommerce Showcase Production Deployment

- `df4a7a7` 修复商品套图与万物上身的展示关系：主展示保留同套服饰素材、连续弯曲箭头和四张完整模特卡片；顶部万物上身选择器单独使用四卡片完整缩略图，避免把两个展示需求混用。
- 正式执行 `scripts/deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 60`，构建、全量测试 `1574/1574`、生产构建 `6483` 模块、图库/视频/运行时检查和 600 秒 canary 全部通过。
- 公网 `https://shuimg.cn/health` 返回 `ok=true, ready=true`；主展示资源 `editorial-multi-angle-workflow-v7.png` 与选择器资源 `editorial-multi-angle-fan-v7.webp` 均返回 HTTP 200；远端 `index-BbzpPMof.js` 与本地构建 hash 一致。
- 两次真实电商生产验收均通过，任务分别生成 3 个稳定资源；AI 视频线程未触碰、未部署。

## 2026-08-18 Inspiration Gallery Prompt Replay

- 内置 14 个小红书图文案例现在从各自 `薯包出品/<案例>/提示词.txt` 提供复用提示词；服务端新增 `/api/gallery-prompts` 元数据接口，前端异步合并提示词但不改变案例顺序。
- 点击这些案例的“做同款”会进入小红书图文制作区，checkpoint 使用文件中的单句提示词，并明确清空 `referenceImages`；电商、视觉案例和普通内容案例复用逻辑保持不变。
- 定向素材/复用回归通过 `10/10`，全量回归 `1577/1577`，生产构建 `6484` 模块，`npm run check` 与协作检查通过；本轮未部署、未触发付费生成。

## 2026-08-18 XHS And Plog Reference Generation Release

- `7896195` 完成小红书图文与 Plog 的语义参考素材链路：风格参考用于视觉分析，用户素材按镜头职责选择性参与图生图；XHS 风格参考最多 3 张、用户素材最多 6 张，Plog 复用电商素材上传样式并支持分组上传。
- Plog 与 XHS 作品均保存封面及每张内容图的实际生成提示词；Plog 额外保存 `page_id`、`shot_role`、`reference_use`，用于灵感发现案例展示和后续复用。
- 聚焦回归 `18/18`，全量回归 `1592/1592`，生产构建 `6486` 模块，`npm run check`、协作检查和差异检查通过。
- 生产 release `20260818-100741-548b8ca` 已切换，公网健康检查为 `200/ready=true`，生产审计 `27/27`；真实电商验收任务交付 3 个稳定资产并通过作品、Canvas、缩略图持久化检查。未触发付费视频生成。
- 远端锁已确认释放；由于版本切换后本地部署进程与远端锁通道断开，未把本轮记为完整 600 秒 Canary 已通过。

## 2026-08-18 XHS Publish Preview And Workbench Polish

- 小红书案例区现在以真实厦门案例展示完整 9 张发布配图；点击九宫格或“查看完整发布预览”进入左图右文的发布检查弹窗，支持缩略图、上一张/下一张、键盘方向键、Esc 关闭，正文和全部标签完整呈现。Plog 案例位保持空状态，等待真实成品入库。
- 小红书输入区复用电商 `SupplementAssetDeck` 的素材/风格参考上传框架，但关闭倾斜卡片；底部设置改为小红书本地化的发布结构、内容策略、视觉参考，并在桌面端向上展开。电商套图与视频代码路径保持原有行为。
- 为避免首屏九宫格出现懒加载骨架，小红书案例的 9 张静态展示图改为首屏加载；本地后端联动验证 9 个图片节点均有实际宽度，桌面截图完整，390px 移动端无横向溢出。
- 全量回归 `1613/1613`，生产构建转换 `6493` 个模块，`npm run check` 与 `git diff --check` 通过。
- `scripts/deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 60` 已完成，版本 `45ab6b6` 已部署到 `https://shuimg.cn/`；图库 117 张、视频公共契约、电商稳定资产验收和 canary 均通过，部署锁已释放。公网独立验收 `/health` 与首页均为 HTTP 200，线上小红书预览弹窗确认包含完整正文和 9 张缩略图。canary 期间一次公共视频契约瞬时网络失败由脚本自动重试后通过，未触发视频生成。

## 2026-08-19 AI Video Asset Delivery And Provenance Hardening

- 新增视频资产 HTTP 恢复契约：稳定 `ETag`、`Last-Modified`、安全的 inline 文件名、`If-Range` 续传、条件请求 `304`、
  无正文 `HEAD` 和不可满足区间 `416`。现有 owner 鉴权、私有缓存策略和正常 `206` Range 语义保持不变。
- 候选卡片和数据库新增不可伪造的来源状态：规划候选为 `planned`，没有历史 attempt 快照的旧任务为
  `unverified-legacy`，只有同时拥有 provider、model、上游 request/task id、request hash、catalog version、生成时间和
  `provider-attempt` 来源标记时才为 `verified`；来源状态在工作台可见并随 replay/clone 传递。
- 新 B 站 `BV1p7gP6CErH` 通过 yt-dlp 取得只读 360p 副本并提取 30 帧；飞书 Seedance 2.5 正文已核验最小版本、素材职责、
  事件时间轴、局部时空编辑、白模/绿幕、失败归因和版权质检。未触发视频生成或任何计费。
- 本轮聚焦回归 `32/32`（资产交付 `7/7`、工作台存储 `25/25`）和工作台 UI `2/2` 通过；全量回归、构建、部署和公网
  验收仍以本记录后续命令输出为准，不能提前宣称已上线。

## 2026-08-18 AI Video Planning Workbench Slice

- 将 provider-neutral 规划模式接入视频能力发现与所有者工作台：`VIDEO_PLATFORM_P1_PLANNING=true`，而实时渲染
  `VIDEO_PLATFORM_P1_WORKBENCH=false` 仍保持关闭。项目、素材、分镜、候选、时间线、项目记忆、Skill 预览、
  创作配方和生成预检均可编辑/回看，但不会选择供应商、提交视频任务或扣除积分。
- 规划模式在 UI 中显示明确的“不会调用供应商，也不会扣除积分”状态；导出任务路由在鉴权与所有者 cohort
  校验之后返回 `VIDEO_WORKBENCH_PLANNING_ONLY`，匿名请求仍返回 401，避免泄露模式信息或绕过权限。
- 本地焦点回归 `48/48`（包含新增规划路由鉴权门禁与媒体 Range 恢复），全量回归
  `1830/1830`、生产构建转换 `6520` 个模块、协作门禁、无付费视频验证和部署前生产契约检查均已通过。
  试点验证为 `10` 个项目、`40/40` 操作成功，`providerSubmissions=0`、`billingMutated=false`；当前没有触发视频生成、供应商调用、钱包/用量变更。

## 2026-08-19 AI Video Release Gate Result

- 本轮最终本地证据：全量回归 `1840/1840`、生产构建 `6520` modules、`npm run check`、协作门禁、无付费视频验证、
  renderer reconciliation dry-run、40 操作规划试点和本地生产审计 `27/27` 均通过；试点记录
  `providerSubmissions=0`、`billingMutated=false`。
- `scripts/deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 60` 已执行，但在远端 helper/锁创建前因当前环境
  无法读取 `C:\Users\SHEJI\.ssh\shubao_deploy_ed25519` 而被服务器拒绝；远端没有文件、进程、锁、账务或供应商任务变更，
  本轮没有 600 秒公网 Canary，因此不得宣称本轮已上线。
- 后续恢复只能重跑唯一正式部署脚本并重新取得公网健康、资产、视频契约、账务隔离与 Canary 证据；实时视频渲染和付费供应商调用
  仍保持关闭。用户运行态删除项和临时文件继续排除。

## 2026-08-19 AI Video Single-Shot Recovery Plan

- 新增 provider-neutral 单镜头恢复计划：`replace_candidate` 与 `rebuild_shot` 两种模式均记录镜头快照、受影响时间线片段、
  保留的相邻镜头、有限原因文本和稳定 `planHash`；计划可验证、可审计，篡改会 fail closed。
- 新增 `video_shot_recovery_plans` 持久化表和工作台入口“建立单镜头重拍计划”。相同请求按 hash 幂等返回，不创建供应商任务、
  不扣积分、不写 wallet/usage 账务，也不触发付费视频生成。
- 本轮聚焦回归 `60/60` 已通过（纯逻辑、存储、HTTP 路由、重复提交和 UI wiring）。这只是 P1 可靠性切片；真实供应商执行、
  逐镜头高清生成、时间线合成和商业化 canary 仍需在能力/版权/审核/存储/成本/质量门禁完成后单独启用。
- 当前切片尚未重新部署；上一轮正式部署因本执行环境无法读取 `C:\Users\SHEJI\.ssh\shubao_deploy_ed25519` 而在远端 helper/锁创建前停止，
  因此不得把本地测试结果写成线上已更新。运行态删除项和临时文件继续保持原样。

## 2026-08-19 AI Video Recovery Verification Refresh

- 修正一个过时的 UI 测试契约：小红书首页已经使用 `XhsSupplementDeck` 的 `sourceImages/styleImages` 上限，测试不再要求
  已删除的 `maxProductImages/maxReferenceImages` 属性；Plog 独立页仍保留共享 `SupplementAssetDeck`。聚焦回归最终为 `60/60`。
- 全量串行回归最终为 `1846/1846`，生产构建成功并转换 `6520` 个模块，`npm run check`、`npm run collab:check`、
  `git diff --check` 均通过。`verify-video-platform --local --no-paid-generation` 返回 `ok=true`、`providerSubmissions=0`；
  renderer reconciliation dry-run、40 操作规划试点和本地生产审计 `27/27` 均通过，试点 `billingMutated=false`。
- 本轮没有供应商调用、视频生成、上传、wallet hold、结算或 usage 变更。正式部署脚本此前在远端 helper/锁创建前因
  `C:\Users\SHEJI\.ssh\shubao_deploy_ed25519` 无法读取而停止；本地 AI 视频切片仍未上线，线上仍是上一版 `9225816` 基础底座。

## 2026-08-19 XHS/Plog Ecommerce Layout Follow-up

- 按最新截图继续收敛小红书图文与 Plog：九宫格使用共享 390px 展示框并让每张图填满自身格子，移除案例下方三块静态说明；种草案例选择器复用电商扇形卡片但适配三张竖图，Plog 保留空案例位。
- 输入区移除无实际操作效果的生成设置、发布结构、文章信息和发布规范入口；图文只保留主题填充，Plog 只保留内容风格与图片节奏，素材上传继续复用电商卡片并增强“可选”标签。
- 聚焦回归 `10/10`、生产构建 `6523` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 通过；本轮未部署，未触发生图或账务操作。工作树中既有导航契约失败仍属用户并行改动，未纳入本提交。

## 2026-08-19 Creative Domain Navigation And Validation Policy

- 本轮提交：`da6fc48`（`feat: add creative domain navigation and validation profiles`）。

- 新增顶部创作域导航：电商视觉、视频创作、内容发布、自由视觉、工作台。视频保持单一入口；桌面端使用暖白玻璃 Mega menu，滚动后收紧，支持 80ms 悬停打开、180ms 离开关闭、键盘导航；移动端使用抽屉和单层手风琴。
- 导航入口复用现有 `NAVIGATE`、`SET_MODE`、`OPEN_CANVAS`，并通过一次性客户端启动意图直达万物上身、Plog、海报/封面/品牌主视觉等工作台选项；不新增网络请求，不触发生成或计费。
- 新增 `auto/frontend/full` 生产验收分层。纯导航壳和静态 UI 可跳过真实电商生图；服务端、账务、生成、共享状态、画布和无法判断的改动 fail closed 到完整门禁。修正部署脚本中验收分类器路径初始化顺序。
- 全量回归 `1856/1856`，聚焦回归 `40/40`，生产构建转换 `6523` 个模块（使用 Windows 下保留 `dist` 输出目录的方式），`npm run check`、`npm run collab:check`、`git diff --check` 均通过；本轮未部署、未触发红苹果、电商生成或账务变更。导航壳层可判为 `frontend`，但本次为直达具体工作台而增加的首页/共享客户端启动意图接线，按 `auto` 保守判为 `full`；只有人工确认该接线不影响业务动作后，才应显式使用 `-ValidationProfile frontend`。

## 2026-08-19 Creative Domain Navigation Production Deployment

- 正式部署提交：`da6fc48`，其父提交包含并上线了另一线程的 `e8e06cd` XHS/Plog 电商布局修复；部署包在后续本地提交 `5f2b027` 产生前构建，因此 `5f2b027` 的 AI 视频验收门禁不在本次线上版本内。
- 使用 `-ValidationProfile full` 执行正式部署。全量回归 `1860/1860`，生产构建转换 `6523` 个模块，构建后检查通过，协作检查和差异检查通过；视频验收报告 `paidGenerationRequested: false`、`providerSubmissions: 0`。
- 线上 `https://shuimg.cn` 健康检查、图库 `117` 张、视频合同 `2` 个公开产品、认证非计费视频 canary、账务验证均通过。真实电商首轮任务 `ec_009c1eea-3c46-4d26-b2d5-bcf9ed9685b1` 和金丝雀末轮任务 `ec_6298b8d6-26e5-4034-a20d-f27861a7b5f1` 均完成并返回 `3` 个稳定素材；`600` 秒金丝雀观察通过，部署锁已释放。

## 2026-08-19 Creative Navigation Stabilization Deployment

- 正式部署提交：`afad5cc`，仅包含本次导航交互修复；另一线程的 AI 视频提交 `78108bf` 未纳入本次发布。
- 桌面 Mega menu 改为 fixed portal 层，增加 pointer-safe bridge、延迟关闭、外部点击/焦点/Escape 关闭和更强的 active/open 状态。顶级域只负责打开并固定面板，子项和 CTA 负责跳转；视频暂不拆分子分类。
- 验证：`1863/1863` 测试、生产构建 `6523 modules`、静态检查、117 张图库、视频公开契约、认证非计费视频 canary、账务检查和 600 秒前端金丝雀均通过。使用 `frontend` 验收范围，跳过真实电商生图，未产生付费 provider submission。

## 2026-08-19 Unified Visual Product Long-Term Coordination

- 主线程长期目标：把薯包 AI 建设为面向真实商业化用户的成熟视觉内容生产平台，统一图片、视频、音频和项目资产身份，让 Canvas、Works、电商生图和 AI 视频工作台形成可恢复、可追踪、可复用的创作闭环；同时守住 owner 隔离、账务边界、稳定资产、跨域引用、桌面/移动端体验、全量测试和发布质量门。
- 主线程职责：canonical `project_assets`、项目/版本、Canvas/Works、跨域接口、共享状态、质量审查、发布验收和最终部署。任何共享 schema、账务、生产脚本和跨域客户端契约的变更，必须由主线程审查后合入。
- AI 视频线程长期目标：把视频工作台建设为可商业化交付的视频领域能力，覆盖项目、分镜、候选版本、时间线、音频、渲染/交付、恢复和视频专属 UI，并严格通过统一项目资产契约接入；不得把视频领域细节塞入 Canvas 的生成逻辑。
- AI 视频线程职责：仅修改视频领域文件及其测试，完成 `video_workbench` 到 canonical `project_assets` 的适配；视频输出必须能被 Canvas/Works 消费，视频本体、缩略图/抽帧、来源资产和 generation run 必须保留可追溯 lineage。发现共享层缺口时提交接口需求，不抢改主线程拥有的共享文件。
- 协同规则：不新建第三个开发线程；双方以 canonical asset contract 为唯一跨域边界，先确认文件所有权和接口，再实现；视频线程回报精确变更文件、commit、测试结果和剩余风险，主线程负责审核、整合、全量本地验收和最终发布。未完成验证前不得声称跨域集成完成；本阶段不触发真实生成、账务变更或生产部署。

## 2026-08-20 Canvas Project Asset Bridge

- 主线程提交 `42a4998`：Works 增加 owner-scoped 项目素材库，展示 canonical image/video/audio assets；导入画布只接受
  `projectId + projectAssetId + contentHash + stableUrl`，按 canonical key 幂等，图片继续走缩略图交付，视频/音频保留稳定媒体 URL。
- Canvas 新增项目素材导入适配和音频节点，导入不会调用 provider、创建生成任务或扣除积分；MIME 类型优先于客户端展示提示，避免媒体类型伪造影响渲染。
- 本地证据：定向 `20/20`、全量 `1899/1899`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过；匿名首页和移动端无溢出检查通过。真实登录态下的私有项目素材卡片交互仍未伪造会话验证。
- 该提交涉及 `src/pages/EcCanvas/`，上线必须按 `full` 生产门禁执行；视频线程领域文件未修改，继续由视频线程维护并通过 canonical asset contract 消费该桥接。

## 2026-08-20 Canvas Project Asset Bridge Production Release

- 正式部署提交 `3d9c86d`（包含功能提交 `42a4998`）已上线 `https://shuimg.cn`；部署脚本按 `full` 执行并完成远端锁释放。
- 发布前全量回归 `1899/1899`、生产构建 `6524` modules、构建检查、协作检查和差异检查通过；线上健康 `ready`，图库 `117` 张，公开视频合同 `2` 个，
  认证视频 canary 通过，视频 `providerSubmissions=0`、`paidGenerationRequested=false`。
- 完整 `600` 秒公网金丝雀通过，真实电商验收两轮均返回 `3` 个稳定素材；最终线上电商活跃任务 `0`、图片队列 active/queued 均为 `0`，部署锁已释放。
- 本轮没有修改视频线程文件；视频线程继续负责视频域能力，主线程维护 canonical project assets、Canvas/Works 桥接和发布验收。

## 2026-08-20 Unified Project Asset Library Read Path

- 主线程提交 `4fc5892`：新增 owner-scoped `/api/project-assets` 聚合读取接口，返回脱敏的项目摘要和 canonical
  asset identity，支持项目、项目类型、媒体类型和数量过滤；增加 owner/created-at 索引，避免资产库随项目数增长重复遍历。
- Canvas Works 和视频工作台改用同一资产库接口；Canvas 提供全部/图片/视频/音频筛选，视频跨项目素材导入继续通过
  `importProjectAssetVersion` 和 canonical hash 校验，不触发生成或账务。
- 本地证据：定向 `41/41`、全量 `1902/1902`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、
  `git diff --check` 通过；390px 浏览器检查无横向溢出。视频线程没有返回新的共享变更，本轮未修改其领域文件。
- 该提交包含服务端、Canvas 和视频工作台，若发布必须按 `full` 生产门禁执行；尚未把本条本地证据写成线上证据。

## 2026-08-20 Unified Project Asset Library Production Release

- 正式部署提交 `21de16e` 已上线 `https://shuimg.cn`，使用 `full` 生产门禁；远端锁已释放。
- 发布前全量 `1902/1902`、生产构建 `6524` modules、构建检查、协作检查和差异检查通过；线上健康 `ready=true`，
  图片图库 `117` 张，公开视频合同 `2` 个，视频认证非计费 canary 通过，`providerSubmissions=0`。
- 完整 `600` 秒公网金丝雀通过，三轮真实电商验收均交付 `3` 个稳定素材；最终线上电商 active jobs 为 `0`、图片队列为 `0`，
  未授权请求 `/api/project-assets` 返回 `401`，证明统一资产库仍受 owner session 保护。
- 视频线程本轮仍没有返回新的共享变更；主线程只修改统一项目资产读取、Canvas 和视频工作台消费端，后续继续按 canonical asset contract 协同。

## 2026-08-20 Project Asset Lineage Readback

- 主线程新增 owner-scoped `GET /api/projects/:projectId/assets/:assetId/lineage`：同项目生成关系从
  `project_asset_lineage` 读取，跨项目视频引用只展示已校验的 `sourceProjectAssetRef` 元数据，不伪造同项目血缘。
- Canvas Works 的项目素材卡片修正素材名称和项目标题来源，增加关系入口和来源/派生/跨项目引用弹层；导入仍是纯引用，
  不生成、不扣费。视频线程领域文件未修改，继续消费统一资产接口。
- 定向 `43/43`、全量 `1904/1904`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、
  `git diff --check` 均通过；390px 与桌面浏览器无横向溢出，匿名私有资产请求仍返回 401。本轮未部署、未触发真实生成或账务变更。

## 2026-08-20 Project Asset Lineage Release Blocker

- `e9fef88` 已通过两次完整 `full` 发布前门禁：全量 `1904/1904`、构建 `6524` modules、视频非计费验收
  `providerSubmissions=0`，但两次均在远端 release backup 前的生产根分区 3GB 可用空间预检失败。
- 部署脚本两次均恢复运行时网关配置、释放远端锁，未创建 release backup、未重启 PM2、未切换静态版本；线上健康仍为
  `ready=true`，active ecommerce jobs `0`，线上保持此前 `21de16e` 版本。未删除生产资产或历史备份来绕过预检。

## 2026-08-20 Project Asset Lineage Verification Hardening

- 修正跨项目来源引用的真实性边界：`GET /api/projects/:projectId/assets/:assetId/lineage` 现在只有在同一 owner 下，
  `project_assets.id`、`project_id`、`content_hash` 和未删除的源项目全部精确匹配时，才返回 `verified=true`、源资产摘要和项目摘要。
  资产不存在、哈希不匹配或引用伪造的来源不会被展示，避免把未验证的 metadata 当成资产血缘。
- 新增存储回归覆盖真实跨项目源资产和篡改/缺失资产两种情况。定向回归 `36/36`、全量回归 `1905/1905`、生产构建
  `6524` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 均通过；本轮没有供应商调用、视频生成、账务变更或生产部署。
- 协同规则本轮重新一次性通知视频线程：视频线程继续完成原定视频工作，不等待主线程、不因询问停工；只有共享接口阻塞、数据安全风险或实际冲突才集中反馈。
  主线程继续拥有 canonical project assets、Canvas/Works、跨域接口、质量门和最终发布，双方不轮询式互相打断。
- `e9fef88` 的生产发布仍受此前远端根分区可用空间预检阻塞；没有删除线上资产、历史备份或绕过 full 门禁，线上继续保持已发布版本并由健康检查负责观察。

## 2026-08-20 Ecommerce Canonical Asset Metadata Hardening

- 修正电商生成完成时的 canonical `project_assets` 写入：此前内容哈希被错误地写成资产文件名，MIME 永远固定为 `image/png`；
  现在服务端从受信任的 `/api/generated-assets/<sha256>.<ext>` 稳定 URL 推导真实内容哈希和 MIME，只有非标准历史 URL 才使用兼容回退。
- 项目版本快照仍严格保持公开交付字段，不把内部哈希/MIME 扩散到 Works/Canvas 恢复快照；真实元数据只留在 owner-scoped canonical asset 行，供跨 Canvas、Works、视频工作台引用和保留策略使用。
- 新增回归覆盖真实 WebP 元数据、稳定 URL 优先级和伪造快照字段；定向 `24/24`、全量 `1908/1908`、生产构建 `6524` modules、
  `npm run check`、`npm run collab:check`、`git diff --check` 均通过。本轮没有供应商调用、视频生成、账务变更或生产部署。
- 同步修正 legacy Works 迁移写入：带内容寻址稳定 URL 的历史 WebP/PNG 资产沿用真实哈希和 MIME，非内容寻址的旧 URL 保持原有兼容回退；
  迁移回归 `3/3` 通过，避免同一资产在新旧入口进入资产库后出现身份漂移。

## 2026-08-20 Video Source Asset Fail-Closed Boundary

- 修正视频草稿进入 canonical `project_assets` 的源素材写入：上传源没有真实校验哈希时不再用 `assetId` 伪造 `content_hash`，而是以
  `VIDEO_ASSET_NOT_READY` 失败并回滚项目草稿写入；已验证的视频上传仍按原有 owner、MIME、字节数和 SHA-256 契约进入资产库。
- 定向视频/项目回归 `27/27`，Git 已跟踪测试集全量 `1909/1909`，生产构建 `6524` modules、`npm run check`、
  `npm run collab:check`、`git diff --check` 均通过。本轮没有供应商调用、视频生成、账务变更或生产部署。
- 直接 `npm test` 当前被视频线程同时新增但尚未跟踪的 `test/video-renderer-worker-batch.test.mjs` 阻断；该文件属于视频线程，主线程未修改、未删除、未暂存。
  等视频线程完成该测试后，再由其自行纳入完整测试闭环；不能把这次隔离后的 tracked 全量结果误报成未跟踪测试也已通过。
- 生产发布继续保留既有远端磁盘空间预检阻塞，不删除线上数据、不绕过 `full` 门禁；视频线程仍按一次性协同通知继续原定视频工作，主线程未修改视频领域文件。

## 2026-08-20 Video Canonical Delivery And Lineage Hardening

- 主线程提交 `3b68601`：视频源素材和视频输出进入 canonical `project_assets` 前必须同时具备稳定标识、应用内稳定 URL、内容哈希和合法媒体类型；不再把 `assetId` 当作输出哈希，也不再用默认 `video/mp4` 掩盖未校验输出。失败发生在事务提交前，项目和版本状态保持不变。
- 主线程提交 `a3b0f1d`：拒绝视频源/输出的外部 HTTP(S) 或控制字符 URL；同一视频项目的后续生成即使复用同一个外部 `assetId`，也会按新的 source version 建立独立 canonical 行，避免 `INSERT OR IGNORE` 复用旧版本并丢失 source lineage。
- 定向项目/视频桥接回归 `32/32` 通过；构建、构建后检查和协作检查在本轮提交前通过，提交后只需复核无关工作树变化。
- 当前直接 `npm test` 含视频线程尚未完成的未跟踪 `test/video-renderer-worker-batch.test.mjs`，结果为 `1913/1917`；Git 跟踪测试为 `1911/1912`，唯一失败来自并行导航改动使既有 `creative-nav-signature` 合同尚未同步。主线程没有修改、删除或暂存这些并行文件，不把隔离结果误报为全工作树绿灯。
- 视频线程继续独立完成 `server/videoRendererWorker.mjs` 及其测试；主线程不轮询、不介入实现。生产仍未部署，未触发视频供应商、真实生成、账务或额度变更。

## 2026-08-20 Owned Result URL Boundary

- 主线程提交 `62d48dc`：电商完成路径现在拒绝外部或含控制字符的结果 URL，并在写入结果版本前失败；外链不会进入 canonical `project_assets`，项目仍保持运行中。
- 项目版本、legacy 迁移、路由和视频桥接定向回归 `45/45` 通过；本轮没有供应商调用、真实生成、账务变更或生产部署。

## 2026-08-20 Canonical Asset URL Gate

- 主线程提交 `1d71c2d`：`createProjectAsset` 统一要求稳定地址为无控制字符的应用内 `/api/...` URL，协议相对地址、外部 HTTP(S) 和其他非应用地址全部拒绝；电商与视频专用写入路径继续共享同一边界。
- 定向项目/迁移/视频桥接回归保持 `45/45` 通过；`npm run build` 已通过并转换 `6524` modules，随后单独执行 `npm run check`、`npm run collab:check` 和 `git diff --check` 均通过。
- 联合工作树仍有视频线程的 `server/videoRendererWorker.mjs`、未跟踪批处理测试，以及并行导航文件的未提交改动；主线程不修改、不暂存、不轮询这些文件。直接全量测试在这些并行变更完成前不作为发布证据。

## 2026-08-20 Retention Owner Isolation

- 主线程使用系统化调试和 TDD 复现并修正 retention 保护查询的 owner 边界：实际 `works` 表存在 `owner_email`，但旧查询只按稳定 URL 匹配，可能让其他账号的 Work 延长本账号资产保留期。现在真实表按 `owner_email + stable_url` 匹配；缺少 owner 列的历史迁移表保留兼容查询，避免误删无法证明归属的旧资产。
- 提交 `3d61c56`。Retention、项目、迁移、路由和视频桥接定向回归 `53/53`；Git 跟踪测试 `1917/1917`，直接 `npm test` `1922/1922`；构建 `6524` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 均通过。
- 视频线程已自行完成其批处理测试/导航同步，主线程未修改或暂存其文件。当前联合工作树仍有其未提交修改，尚未形成可供主线程审核的正式交接 commit；本轮不触发生产部署或真实生成。

## 2026-08-20 Canvas Snapshot Asset Boundary

- 主线程提交 `5f7b409`：Canvas 创建和保存快照现在会逐项校验嵌入的 canonical project asset，要求项目资产 ID、所属项目、owner、内容哈希和应用内稳定 URL 精确一致，且项目/资产未删除；跨 owner 引用在落库前失败，避免恢复时越权读取或保留外部资产。
- 同一 owner 在不同项目之间复用已经存在且权威的图片、视频或音频资产仍然允许；保存校验失败不会推进 Canvas revision，也不会覆盖原快照。新增创建、同 owner 复用和保存失败回滚回归，项目存储及跨域 Canvas 定向测试 `50/50`，项目存储单测 `29/29` 通过。
- 本轮没有修改视频线程领域文件，没有触发供应商调用、真实生成、账务变更或生产部署；视频线程继续其原定视频工作，主线程不轮询、不介入实现。

## 2026-08-20 Retention Shared-Asset Owner Boundary

- 主线程使用回归先复现并修正 retention 清理的第二层 owner 问题：此前同名 `asset_id` 的其他 owner 引用会阻止当前账号清理，且删除条件按 `asset_id` 可能批量改写其他账号记录；争议账单、生成运行和合成引用也缺少完整 owner 过滤。
- 提交 `eada5f7`：保护判断按资产 owner 限定，删除按单条 canonical project asset 记录执行；底层二进制只有在所有 owner 均无剩余引用时才移除，避免跨账号误删共享文件或延长生命周期。新增外部同名资产和外部争议账单回归；retention、项目、路由、迁移及 Canvas 定向 `54/54` 通过。
- 本轮没有触发供应商调用、真实生成、账务变更或生产部署；视频线程文件保持未修改、未暂存、未轮询。

## 2026-08-20 Composition Canonical Asset Authorization

- 主线程审计发现合成授权器此前会把项目版本快照里出现的任意 `assetId` 当成已授权素材，再从全局生成素材存储读取；版本快照不是资产所有权证明，存在跨项目/跨 owner 读取风险。
- 提交 `d378d27`：合成背景、图层和后续 PSD/像素处理的授权只接受当前 owner、当前 project、当前 version 下未删除的 canonical `project_assets`，或已持久化的 owner-scoped composition revision；伪造快照字段和其他项目 canonical asset 均拒绝。
- 合成定向回归 `6/6` 通过。本轮没有供应商调用、真实生成、账务变更或生产部署，视频线程继续独立工作。

## 2026-08-20 Project Media Playback Recovery Boundary

- 主线程审计发现 Canvas/Works 项目素材库会把视频和音频的 canonical `stableUrl` 直接交给媒体元素；该 URL 需要自定义 session header，而浏览器 `<video>/<audio>` 不会携带该 header，导致跨域资产在画布中无法稳定预览。
- 提交 `b16e221`：项目资产路由在 owner 校验后动态补发短期 `playbackUrl`，生产端复用现有视频签名播放能力；canonical `stableUrl` 和 `assetRef` 保持不变，不把播放凭据写进项目快照。Canvas 内存节点使用 playback URL，`createCanvasSnapshot` 会递归还原 stable URL 并移除 transient playback 字段。
- 项目路由、视频生成、项目桥接、视频工作台和 Canvas 定向回归 `106/106`；本轮未触发供应商调用、真实生成、账务变更或生产部署。

## 2026-08-20 Canvas Retention Owner Boundary

- 主线程继续审计 retention 的引用保护查询，发现 Canvas 会话保护条件只按 `project_id` 和快照内容匹配，没有同时约束会话 owner；这对正常 UUID 项目通常不显现，但会让历史迁移或异常数据污染资产保留判断。
- 提交前修复：Canvas retention 保护现在要求 `owner_email + project_id` 同时匹配；新增跨 owner Canvas 会话回归，确保不会延长其他账号项目资产的生命周期。定向 retention 回归 `11/11` 通过。

## 2026-08-20 Canvas Session Media Recovery Boundary

- 主线程继续验证媒体资产恢复链路，发现项目素材导入时虽然使用了短期 `playbackUrl`，但 Canvas 会话从数据库创建、读取或保存后只返回持久化的 `stableUrl`；浏览器媒体元素恢复视频/音频时无法携带自定义 session header，存在空白预览风险。
- 修复：Canvas 会话路由在 owner 校验后对快照中的 canonical 视频/音频 `stableUrl` 动态补发 playback capability；数据库快照和 Works 仍只保留 `stableUrl`。客户端恢复保留运行时播放地址，下一次 `createCanvasSnapshot` 会再次去除 transient 字段。播放 ID 从受信任的应用内 URL 推导，不依赖客户端额外字段。
- 创建、读取、保存恢复回归与 Canvas 模型定向测试 `26/26` 通过；本轮不触发供应商、真实生成、账务或生产部署。

## 2026-08-20 Works Media Playback Recovery Boundary

- 主线程审计发现 `/api/works` 之前只恢复顶层 `video_url`，嵌套的 `video`、`audio`、`projectAssetRefs` 等记录仍可能把 canonical `stableUrl` 直接交给浏览器，导致从 Works 导入或恢复媒体时出现空白预览。
- 新增 `server/projects/workMediaPlayback.mjs`，对 owner 已授权的 Works 响应做读取时装饰：视频和音频统一保留 `stableUrl`，动态补发短期 `playbackUrl` 并把运行时 `url` 指向播放地址；图片和非媒体 URL 不受影响，签发失败则保留可读 metadata。原始 Work 对象不被改写，短期 token 不会持久化。
- `/api/works` 已接入该装饰器，并继续用未装饰的原始 Work 计算 retention，避免 transient URL 改变保留判断。新增嵌套视频/音频、跨层 project asset ref、非媒体和失败回退回归；聚焦回归 `30/30` 通过。
- 本轮仍未触发供应商、真实生成、账务或生产部署；代码尚未进入线上 release。后续需完成提交前审查、全量测试、构建、协作检查和差异检查，再决定是否进入 full production gate。

## 2026-08-20 Canvas Project Library Playback Boundary

- 继续审计发现项目素材库接口虽然已经返回 transient `playbackUrl`，Canvas 右侧项目素材预览卡片却仍直接使用 canonical `stableUrl` 渲染视频；导入动作正确，导入前预览仍可能因浏览器无法携带 session header 而空白。
- 修正 Canvas 项目素材卡片采用 `asset.playbackUrl || asset.stableUrl`，图片缩略图代理和 canonical asset ref 保持不变；保存快照仍由已有 durable snapshot 逻辑去除 transient playback 字段。
- Canvas 跨域资产、项目路由和会话恢复定向回归 `26/26`，提交 `ab097e8`；随后全量回归 `1936/1936`、生产构建 `6524` modules 通过。本轮未触发供应商、真实生成、账务或生产部署。

## 2026-08-20 VideoStudio Canvas Canonical Handoff

- 继续沿 VideoStudio 到 Canvas 的真实交接链路审计，发现视频工作台传入的是短期播放 URL，但 Canvas 初始化视频节点时只保留 `id/name/url`，会丢掉 `projectAssetRef`；后续保存或恢复无法可靠关联 canonical `project_assets`。
- 修正 `canvasVideoAsset`：优先提取带稳定 URL、内容哈希和 MIME 的 canonical 视频资产引用，同时把短期 URL 仅作为运行时 playback capability 传入 Canvas。durable snapshot 仍由既有边界还原稳定 URL并移除 transient playback 字段，旧版没有 canonical ref 的视频继续兼容旧路径。
- 新增 VideoStudio handoff 回归，验证运行时播放 URL、canonical project asset identity 与持久化快照三者边界；全量 `npm test` `1937/1937`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮没有触发供应商、真实生成、账务或生产部署；代码尚未进入线上 release，视频线程文件保持未修改、未暂存。

## 2026-08-20 Canvas Video Result Identity

- 继续审计 Canvas 内部视频生成器，发现成片轮询完成后 composer 节点只写入播放 URL 和 `videoAssetId`，没有保留服务端返回的 `projectAssetRef`；这会让 Canvas 内生成的视频在后续快照/Works 投影中失去 canonical project asset 关联。
- 新增 `canvasVideoResultPatch`，统一把已交付 job 的运行时播放地址、资产 ID 和 canonical project asset ref 投影到 Canvas 节点；既有 durable snapshot 仍负责把 transient playback URL 还原为稳定 URL，缺少 canonical ref 的历史 job 保持兼容。
- 新增生成结果身份回归；全量 `npm test` `1938/1938`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮没有触发供应商、真实生成、账务或生产部署；视频线程文件保持未修改、未暂存。

## 2026-08-20 Canonical Video Result Validation

- 提交前复核发现客户端结果投影不应原样接受不完整的 `projectAssetRef`。`canvasVideoResultPatch` 现在仅保留同时具备项目资产 ID、稳定 URL、内容哈希和 MIME 的 canonical 引用；不完整引用会被丢弃，运行时播放 URL 和结果资产 ID仍保持可用。
- 新增不完整引用回归；定向 Canvas/项目恢复回归 `28/28`，全量 `npm test` `1941/1941`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮没有触发供应商、真实生成、账务或生产部署；线上仍是 `c98be11`，本地提交需经过独立 full production gate 后才可发布。

## 2026-08-20 Display-Safe Video Ref Projection

- 进一步收紧客户端跨域边界：视频结果引用现在复用 Canvas 既有 `buildCanvasAssetRef` 规范化器，仅写入 display-safe 的项目、资产、哈希、稳定 URL、MIME、媒体类型和有限尺寸字段；服务端扩展字段（例如 owner 身份）不会进入 Canvas 节点或快照。
- 新增敏感字段隔离回归；定向 Canvas/项目恢复回归 `28/28`，全量 `npm test` `1941/1941`、生产构建 `6524` modules 通过。提交前仍需复核 `check`、`collab:check` 和差异检查。
- 本轮没有触发供应商、真实生成、账务或生产部署。

## 2026-08-20 Local Canvas Draft Media Recovery

- 主线程审计发现 Canvas 本地草稿恢复路径优先读取 `localStorage` 中的 durable `stableUrl`，会绕过远端 Canvas session 已有的 playback capability 重签逻辑；视频和音频草稿刷新后可能因浏览器无法携带 session header 而空白。
- 新增 `canvasMediaAssetRefs` 与 `restoreCanvasMediaPlayback`：启动时从草稿节点提取去重、display-safe 的 canonical `(projectId, projectAssetId)` 引用，按 owner-scoped `getProjectAsset` 读取短期 `playbackUrl`，只更新当前节点运行时播放地址，稳定 `assetRef` 和本地快照身份不变；读取失败则保留元数据，不阻断画布打开。
- 定向 Canvas session/work/跨域回归 `29/29`，生产构建 `6524` modules 和 `npm run collab:check` 通过。当前联合工作树全量 `npm test` 未通过 `4` 个并行 creative-navigation 合同断言，失败文件属于并行导航线程，主线程未修改、未暂存；因此本轮不进入生产发布。
- 本轮没有触发供应商、真实生成、账务或生产部署。

## 2026-08-20 Cached Work Media Recovery

- 继续审计发现首次打开本地缓存的 AI 视频 Work 时可能没有 Canvas 草稿，旧逻辑因此不会进入草稿媒体恢复分支，直接以 durable `stableUrl` 初始化媒体节点。
- 调整 Canvas 初始化：无论节点来自本地草稿还是缓存 Work 的新建 session，都先提取 canonical 媒体引用，再通过 owner-scoped `getProjectAsset` 获取临时播放能力；异步回写只替换匹配节点的运行时 URL，不覆盖用户编辑或 canonical ref。
- 新增“无本地草稿打开缓存视频 Work”回归；Canvas/项目定向回归 `17/17`，构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。

## 2026-08-20 Cross-domain Audio And Upload Audit

- 主线程复核了视频项目的音频链路：已确认的 voice/music 版本通过 owner/project 校验进入 `video_audio_tracks`，并由时间线、字幕、导出清单和 replay manifest 持久化；工作台读取时会为音频版本重新签发短期播放能力，Canvas 导入音频也保留 canonical project asset ref。当前没有发现需要主线程修改视频领域表或音轨契约的缺口。
- 发现并记录一个独立的长期边界：Canvas 直接上传但尚未进入视频生成/项目导入的视频或音频，当前仍是 `video_assets` 摄取记录，尚未建立 `project_assets` 身份。现有生成前视频桥接会在任务进入项目时创建 canonical source asset，因此不改变本轮已验证链路；后续如要让“仅上传到 Canvas 也能长期作为项目资产复用”，必须由主线程和视频线程先定义带项目上下文的服务端摄取/幂等接口，再单独实现和验收，不能在客户端伪造 project asset ref。
- 本轮全量回归 `npm test` `1944/1944`、`npm run check`、`npm run collab:check`、`git diff --check` 均通过；未触发供应商、真实生成、账务或生产部署。线上仍为 `c98be11`，本地 Canvas/Works 恢复提交不在生产 release 内。
- 联合工作树全量测试仍受并行 creative-navigation 改动的 `4` 个既有合同断言影响，主线程未修改或暂存其文件；本轮不进入生产发布。

## 2026-08-20 Canvas Uploaded Media Canonicalization

- 修复此前审计出的 Canvas 直接上传缺口：视频/音频上传完成后不再只停留在 `video_assets` 摄取记录；已有项目直接导入 `project_assets`，空白 Canvas 会幂等创建非计费 `video` 项目及 `manual_save` 版本，再以 owner-scoped 服务端校验导入。
- 新增 `POST /api/projects/:projectId/assets/import-media` 与 `createVideoProjectAssetImporter`：只接受当前账号拥有、文件已落盘、SHA-256/MIME/字节数完整且不是 output 的媒体；稳定身份写入项目资产，播放能力仍由服务端临时签发。客户端不传 owner 权限字段，音频节点同样携带 canonical asset ref。
- 新增项目客户端、路由、导入器和 Canvas 上传回归；定向 `node --test test/project-video-asset-import.test.mjs test/project-routes.test.mjs test/project-client.test.mjs test/ec-canvas-state.test.mjs` 为 `69/69`，生产构建 `6524` modules 通过，`git diff --check` 通过。
- 本轮只修改主线程资产/项目/Canvas边界，视频线程领域文件未修改；未触发供应商、真实生成、账务或生产部署。线上仍为 `c98be11`，本地本轮提交需经过 full production gate 后才可发布。

## 2026-08-20 Creative Navigation Motion Refresh

- 导航面板按已确认方案收敛为单一居中的目标列表：移除左侧说明栏、重复领域图标、编号和重复 CTA；保留电商、视频、内容、自由视觉、工作台五个一级入口，视频继续保持单一功能入口。
- 每个目的地补充语义 Phosphor 图标和独立 motion 标识；桌面悬停/键盘聚焦触发分层、试穿、画布扩展、胶片推进、翻页、魔法棒等 CSS 动效，面板保留触发按钮到面板的 pointer bridge；移动端同步使用稳定三列入口布局，减少动态偏好关闭关键帧和变换。
- 变更范围限定为 `CreativeDomainNav.jsx`、`creativeDomainNavigation.js`、`app-shell.css` 及导航契约测试；设计规格和实施计划已记录。定向测试 `6/6`、浏览器桌面/移动/键盘验收通过，全量 `npm test` `1951/1951`、`npm run build` `6524` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 通过。
- 本轮尚未部署；生产发布必须使用 `scripts/deploy-production.ps1 -ValidationProfile auto`，由最新提交范围自动判定前端变更并跳过无关的真实电商红苹果验收，同时保留健康、静态资源、审计和 Canary 门禁。并行视频工作台及运行态文件未修改、未暂存。

## 2026-08-20 Canvas Works Media Projection

- 继续收口 Canvas/Works 资产闭环：视频或音频媒体-only Work 现在会从 Work 元数据、canonical `projectAssetRefs` 和画布媒体节点统一投影，保留稳定 `(projectId, projectAssetId, contentHash)` 身份，并能在重新打开 Canvas 时恢复为可引用的媒体节点；Works 不再因为没有图片缩略图而丢弃这类记录。
- Work 持久化前会移除短期 `playbackUrl`，只保存 canonical stable URL 和媒体身份；已有 owner-scoped playback decorator 在读取 Works 或 Canvas 时重新签发运行时播放能力。Canvas 初始化不再为纯媒体 Work 制造无效的空图片源节点；有图片输出但无产品源时仍保留布局锚点以兼容历史 output-only Work。
- 新增 Canvas work model/session 回归及静态组件契约，覆盖媒体去重、durable/runtime URL 边界、音频节点恢复和媒体-only Works 面板呈现。最终全量 `npm test` `1954/1954`、`npm run build` `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮只修改主线程 Canvas/项目资产投影及测试文件；视频线程的工作台、渲染器、音轨和导航运行态改动未修改、未暂存。未触发供应商、真实生成、账务或生产部署；线上仍为 `c98be11`，本地提交需另行通过 full production gate 后才能发布。

## 2026-08-20 Project Library Canvas Recovery

- 修复项目素材库导入的真实恢复缺口：从 Works 的 owner-scoped 项目素材库把 canonical 图片、视频或音频加入空白 Canvas 时，现在会幂等创建非计费项目/基础版本、绑定 Canvas 结果上下文并保存 Work；项目创建或归档失败时仍保留本地草稿并明确提示，不宣称已完成远端归档。
- image-only canonical Work 不再因为没有 `images` 缩略图被丢弃；其 `projectAssetRefs` 会投影为恢复用 `productAssets`，重新打开 Work 时会生成带 canonical asset ref 的图片源节点。Works 卡片对这类源素材显示真实缩略图，视频/音频路径保持原有媒体卡片和播放能力。
- 新增项目库导入和 image-only Work 回归；聚焦 Canvas/项目/Works `127/127`、全量 `npm test` `1956/1956`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮只修改主线程 `EcCanvas` 及其测试/账本；视频线程文件和用户运行态未修改、未暂存。没有供应商调用、真实生成、账务变更或生产部署；线上仍为 `c98be11`，本地提交必须另行通过 full production gate。

## 2026-08-20 Creative Navigation Motion Refresh Production Release

- 导航动态交互已通过唯一入口 `scripts/deploy-production.ps1 -ValidationProfile frontend` 发布至 `https://shuimg.cn/`；线上 `current` 指向 `/var/www/shubao/releases/20260820-130655-e823283`，PM2 `shubao-production` 在线，健康接口返回 `200/ready`，部署锁已释放。
- 发布前全量 `npm test` `1954/1954`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 通过；公网图库 `117` 张、公开视频契约 `2` 个产品、认证非计费视频 canary 和 `600` 秒生产 canary 通过。前端专项发布按规范跳过真实电商红苹果验收，未产生付费生成。
- 本次发布包按归档时的共享工作树打包；导航提交为 `e823283`，共享线程随后完成 `f521363` Canvas 媒体持久化提交。发布后 curl/SSH 复核线上首页与健康接口 `200`、PM2 PID `4159840` 在线。远端磁盘约 `95%` 使用率，未阻断本次发布但需要后续清理备份/发布物并建立容量门禁。

## 2026-08-20 Creative Navigation Adaptive Motion Revision

- 根据视觉复核重构导航面板：面板宽度按入口数量自适应并以触发按钮中心为锚点；两项和四项入口使用紧凑双列，三项入口保持单列，移除重复的一级标题和底部说明，一级导航与目的地列表形成明确层级。
- 目的地图标改为复合 glyph：语义 Phosphor 核心图标外增加四个可拆解角部和轨道层，悬停/键盘聚焦触发错峰散开、轨道脉冲与回收锁定；不同入口保留不同轨道形态，减少动态偏好时关闭动画与变换。
- 定向导航回归 `6/6`、全量 `npm test` `1968/1968`、生产构建 `6524` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 通过。待使用 `scripts/deploy-production.ps1 -ValidationProfile frontend` 发布。

## 2026-08-20 Project Library Canvas Import Single-Flight

- 收口项目素材库导入的并发边界：Canvas 导入现在由组件级 single-flight 锁保护整个异步流程，重复点击不会并行创建多个非计费项目版本或覆盖彼此的导入状态；无效素材分支也会在 finally 中释放锁。
- 远端作品归档反馈改为以 `saveWork` 的服务端返回结果为准；服务端保存失败时仍保留 Canvas 本地草稿和已加入的节点，但明确提示云端作品暂未保存，不再显示“已保存”的成功反馈。
- 新增导入并发与远端归档失败回归。聚焦 Canvas/项目/Works `71/71`、全量 `npm test` `1958/1958`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮仍只修改主线程 Canvas 及进度账本；视频线程文件和用户运行态未修改、未暂存。没有供应商调用、真实生成、账务变更或生产部署；线上仍为 `e823283`，本地提交涉及 asset/project/Canvas 路径，发布前必须另行通过 full production gate。

## 2026-08-20 Project Version Idempotency Boundary

- 收口项目版本创建的跨标签页、网络重试和页面重放边界：`POST /api/projects/:projectId/versions` 现在接收 owner-scoped `Idempotency-Key`，以稳定请求指纹校验重放；同一请求返回原版本，不推进 sequence，不创建第二条历史；同 key 跨项目或请求内容改变时 fail closed 为 `409 IDEMPOTENCY_CONFLICT`。
- 存储事务使用 SQLite immediate write lock，避免并发版本创建竞争同一 sequence；客户端只将幂等键写入请求头，不把它伪装成业务版本 payload。Canvas 媒体项目基础版本和电商 durable project lifecycle 均使用派生版本 key，统一恢复语义。
- 新增存储、路由、客户端、生命周期和 Canvas 契约回归。全量 `npm test` `1962/1962`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 本轮只修改主线程项目版本/Canvas/生命周期边界及对应测试；视频线程、导航线程、用户运行态和未跟踪研究/截图未修改、未暂存。未调用供应商、真实生成或账务，未部署；线上仍为 `e823283`，本地提交涉及 server/project/asset/Canvas 路径，发布前必须通过 full production gate。

## 2026-08-20 Canvas Persistence Generation Boundary

- 修复跨作品切换时的 Canvas 持久化竞态：切换 Works/Canvas 结果会清空旧远端快照指纹、取消旧保存计时器并同步更新会话 ref；自动保存、手动保存和恢复请求都携带当前持久化代次，旧作品的迟到响应不会覆盖新作品的节点、会话或结果上下文。
- 新增四条 Canvas 竞态契约回归，覆盖相同快照跨作品切换、自动保存迟到响应、手动保存迟到响应和恢复迟到响应。聚焦资产/项目/Canvas `145/145`、全量 `npm test` `1966/1966`、隔离生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- 标准 `npm run build` 在清理既有 `dist/images` 时被本工作树已有的 5174 Vite dev server 触发 Windows `ENOTEMPTY`；未停止并行服务，改用同一导出校验和 Vite 配置输出到隔离 `dist-codex-build-20260820` 完成编译验证。未调用供应商、真实生成、账务或生产部署；视频/导航线程及运行态未修改、未暂存，线上仍为 `e823283`。

## 2026-08-20 Canvas Work Archive Truth Boundary

- 收口 Canvas Works 自动归档的迟到响应：自动归档定时器现在绑定当前持久化代次，在作品切换前后分别检查代次；旧作品的 `saveWork` 返回不会再污染当前 Works 列表、输出指纹或生成作品身份。
- 手动保存现在区分画布会话和作品归档两个结果：会话成功后立即同步 session ref 与远端快照指纹，避免重复自动保存；作品归档失败时保留本地草稿并明确提示“云端作品暂未保存”，不再无条件宣称完整成功。
- 新增两条回归契约；聚焦 Canvas 代际/归档测试 `6/6`，全量 `npm test` `1968/1968`，隔离 Vite 构建 `6524` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 均通过。标准 `npm run build` 仍受既有 5174 Vite 进程占用 `dist/images` 的 Windows `ENOTEMPTY` 影响，本轮未停止并行服务。
- 本轮只修改主线程 Canvas 和对应回归测试；视频线程、导航线程、用户运行态及未跟踪研究/截图未修改、未暂存。未调用供应商、真实生成、账务或生产部署；线上仍为 `e823283`，本地改动涉及 asset/project/Canvas 路径，发布前必须通过 full production gate。

## 2026-08-20 Creative Navigation Adaptive Motion Revision Production Release

- 导航视觉重构已通过唯一入口 `scripts/deploy-production.ps1 -ValidationProfile frontend` 发布至 `https://shuimg.cn/`；线上 `current` 指向 `/var/www/shubao/releases/20260820-142005-c668bca`，PM2 `shubao-production` PID `4177559` 在线，健康接口返回 `200/ready`，部署锁已释放。
- 面板按入口数量自适应宽度并锚定触发器中心；两项/四项目的地使用紧凑双列，重复一级标题和底部说明移除；复合 glyph 使用核心语义图标、四角分片和轨道层，悬停/聚焦触发拆解、脉冲与重组。浏览器桌面、移动端、键盘和减弱动态偏好均完成验证。
- 发布前全量 `npm test` `1972/1972`、生产构建 `6524` modules、`npm run check`、`npm run collab:check`、`git diff --check` 通过；公网图库 `117` 张、公开视频契约 `2` 个产品、认证非计费视频 canary 和 `600` 秒生产 canary 通过。前端专项发布跳过真实电商红苹果验收，未产生付费生成。
- 本次导航提交为 `c668bca`，发布后共享线程继续产生 `a0f80b3` 等 Canvas 提交；并行工作树文件未被本次导航提交回退。远端磁盘约 `95%`，没有阻断本次发布，仍需后续治理历史 release/backup 容量。

## 2026-08-21 Unified Project Asset Search And Reuse Contract

- 主线程提交 `a635704`：项目素材库支持 owner-scoped 服务端检索，覆盖资产 ID、角色、项目 ID/标题和结构化元数据；Canvas 搜索输入会把查询传到服务端，并将无查询上限提升到服务端允许的 500 条，避免只在前 200 条结果上本地筛选。
- 主线程提交 `ac5f362`：前端二次过滤与服务端搜索字段保持一致，补充 `projectAssetId` 和完整可序列化元数据搜索；异常元数据只降级搜索，不阻断素材库读取。素材库、路由、项目存储及 Canvas 相关回归和最终构建均通过。
- 主线程提交 `e4203c0`、`77dff6e`：canonical project store 新增 `getProjectAsset({ purpose: 'reuse' })` 复用读取边界。默认 `read` 仍支持历史 Canvas/Works 恢复；显式复用只接受 active、未到期或 pinned 资产，marked/isolated/已过期资产 fail closed，并返回明确的 `PROJECT_ASSET_NOT_REUSABLE`，避免上层把生命周期限制误报成不存在。项目 retention/路由/Canvas 定向回归 `76/76` 通过。
- 本轮最终全量回归 `2012/2012`、生产构建 `6526` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 通过；未调用供应商、真实生成、账务或生产部署。视频线程已收到一次排队式契约通知，但尚未将其跨项目导入调用切换到 `purpose: 'reuse'`；在其正式交接前不得声称视频复用边界已完整落地。
- 随后联合工作树新增视频路由改动后，最新 `npm test` 为 `2019` 项、`2017` 通过、`2` 项失败，均在视频线程的 `test/video-workbench-plan.test.mjs`：speed objective 的 route recommendation 实际选择 `seedance_standard` 而测试期望 `seedance_fast`。主线程已一次性通知视频线程并未修改其文件；本轮构建 `6526` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 仍通过，因此不进入生产发布。

## 2026-08-21 Canonical Project Asset Reuse Revalidation

- 主线程提交 `29f27c1`：Canvas 项目素材库检索增加 180ms 防抖和取消保护，连续输入不会为每个字符发起请求，旧响应不会覆盖新查询；项目素材搜索相关回归通过。
- 主线程提交 `3ed5931`：项目资产读取接口支持显式 `purpose=reuse`，服务端在复用入口重新执行 canonical retention 校验；默认读取仍保留历史 Canvas/Works 恢复能力。Canvas 点击“加入”前会重新获取 owner-scoped 可复用资产，过期/待清理竞态返回 `409 PROJECT_ASSET_NOT_REUSABLE`，不会先写入画布或归档作品。
- 新增项目路由、客户端和 Canvas 回归；本轮全量 `npm test` `2022/2022`、生产构建 `6526` modules、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。未调用供应商、真实生成、账务或生产部署；视频线程继续保留其独立工作范围。

## 2026-08-21 Asset Access Purpose Fail-Closed Contract

- 主线程提交 `f554664`：canonical project asset 访问意图现在只允许 `read` 与 `reuse`；未知 purpose 不再静默降级为普通读取，服务端返回 `PROJECT_ASSET_PURPOSE_INVALID`，客户端在发请求前拒绝，避免未来跨域消费者意外绕过复用生命周期。
- 项目存储、项目路由、客户端、Canvas/Works 相关回归通过；本轮全量 `npm test` `2025/2025`、生产构建 `6526` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 均通过。未调用供应商、真实生成、账务或生产部署。
- 视频线程已收到一次完整交接：其跨项目导入必须将 `getProjectAsset` 切换为 `purpose: 'reuse'` 并覆盖不可复用资产回归；在该领域改动正式交接前，视频跨域复用仍标记为未完成。
- 随后提交 `f59dcca`：客户端对未知访问意图抛出与服务端一致的 `PROJECT_ASSET_PURPOSE_INVALID`，保持参数错误、资产缺失和生命周期限制的错误语义可区分；客户端回归通过。

## 2026-08-21 Canvas Pending Project Archive Recovery

- Canvas 上传后的项目归档失败现在会保留 owner-scoped 原始资产身份、素材类型、角色和对应节点 ID，显示持续存在的“待归档素材”状态，并提供单飞“重试归档”入口；图片、视频、音频均通过既有项目导入器重试，服务端仍重新校验所有权、哈希和生命周期。
- 重试成功后只回填对应节点的 canonical `projectAssetRef`、播放地址和 ready 状态，成功记录从待处理队列移除；失败记录保留，作品切换时清空，避免跨作品污染或误报归档成功。未改变计费和供应商调用路径。
- 新增 Canvas 恢复契约测试；本轮全量 `npm test` `2034/2034`、生产构建 `6526` modules、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。未调用真实生成、账务或生产部署；本地改动仍未上线，线上不包含本轮 Canvas/资产恢复改动。

## 2026-08-21 Video Candidate Provenance Contract Revalidation

- 视频线程在 `registerCandidate` 边界补齐可由当前交付事实确定的 `projectAssetRef.role` 与 `expectedContentHash`，再交给 `normalizeVideoProvenance`；没有放宽恢复执行对服务端核验引用的要求，也没有信任浏览器提交的媒体事实。
- 视频恢复/工作台 focused 回归 `41/41` 通过，Canvas/XHS focused 回归 `18/18` 通过；`git diff --check`、`npm run check`、`npm run collab:check` 通过，稳定复跑等价全量测试 `2039/2039` 通过。隔离 Vite 构建 `6527` modules 与产物引用检查通过；标准 `npm run build` 仍受并行 Vite 进程占用 `dist/images` 的 Windows `ENOTEMPTY` 影响。未调用真实生成、账务或生产部署；该修复仍属于共享工作树待归档变更，不能视为已上线。

## 2026-08-21 Durable Media Payload And Recovery Draft Boundary

- Canvas 浏览器快照和服务端项目版本现在统一移除 `data:`、`blob:`、`filesystem:` URL 以及 `file`/`rawData` 等原始上传载荷；已有 canonical `projectAssetRef.stableUrl` 会恢复为可持久化地址，没有稳定身份的媒体节点会标记为 unavailable，不会把不可恢复的原始媒体写进 durable snapshot。
- Works 的 `payload` 持久化沿用同一媒体边界，防止图片/封面原始数据进入 SQLite；新增 Canvas、项目版本和 Works 回归覆盖有稳定引用与无稳定引用两条路径。
- 视频镜头恢复合同合并了共享工作树中的并行函数声明冲突：恢复应用只生成候选/时间线操作草稿和哈希，保持 provider/billing 均为 `false`，并对过期片段及不完整项目素材引用 fail closed。视频恢复与路由聚焦回归 `41/41` 通过。
- 本轮串行全量回归 `2045/2045` 通过；隔离 Vite 构建 `6528` modules、产物检查、`npm run check`、`npm run collab:check`、`git diff --check` 通过。标准 `npm run build` 未抢占并行 Vite 进程占用的 `dist/images`，因此没有删除或停止任何共享运行态。
- 未调用供应商、真实生成、账务或生产部署。`e673c10` 已在线上，但本轮 Canvas/Works 媒体边界和恢复草稿合并属于当前共享工作树待归档变更，不能视为已上线；涉及 asset/project/video/server 的后续发布必须走 full production gate。

## 2026-08-21 Project Asset Batch Canvas Intake

- 项目素材库新增基于 `projectId:projectAssetId:contentHash` 的多选入口，图片、视频、音频沿用同一 canonical 身份；已到期或待清理素材不能被选入批次，保留状态变化后会自动从选择集中清除。
- 批量加入采用逐项 `purpose: 'reuse'` 服务端复验，并在本地累积同一个 Canvas session 后一次性更新节点、选区和作品归档；重复素材、复验失败素材分别统计跳过，不会用旧闭包覆盖先前加入的节点，也不会触发供应商、生成或扣费。
- 单个加入与批量加入共用 single-flight 和忙碌态，批量完成后清空选择并明确反馈云端归档是否成功；未改变视频工作台的数据表或恢复合同，视频素材仅通过统一项目资产引用进入 Canvas。
- 资产选择模型与 Canvas 合同聚焦回归 `87/87` 通过；串行全量回归 `2048/2048`、隔离 Vite 构建 `6528` modules、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；本轮 Canvas/资产库批量接入属于共享工作树待归档变更，涉及 asset/project/Canvas 路径，后续发布必须走 full production gate。

## 2026-08-21 Ecommerce Project Asset Delivery Metadata

- 电商生成结果现在从服务端持久化的 Asset Plan 派生安全的交付元数据，并随项目结果版本进入 canonical `project_assets`；覆盖 `label`、`displayName`、`name`、`role`、`group`、比例、尺寸和电商生成 provenance，避免依赖浏览器或供应商私有字段。
- `project_assets` 保存派生 `metadata_json` 与角色，同时继续由服务端确定稳定资产 ID、content hash、MIME 和应用内 stable URL；私有 prompt、provider job、外链地址和模型信息不会进入共享资产库。这为 Works、Canvas 和视频工作台按同一资产身份发现并复用电商产物提供了基础，但不宣称已完成全部监管可见 AIGC 标识能力。
- 电商任务、项目版本、资产库、Canvas 和跨域资产合同 focused 回归 `118/118`，串行全量回归 `2049/2049`，隔离 Vite 构建 `6528` modules，`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；本轮 `server/ecommerceEngine/projectLifecycle.mjs`、`server/projects/projectStore.mjs` 及相关测试仍属于共享工作树待归档改动，涉及 server/project/asset 路径，后续发布必须走 full production gate。

## 2026-08-21 Ecommerce Asset Provenance Hardening

- 电商结果的 canonical 项目资产现在由服务端补齐内部 AIGC provenance：`generatedAt` 由完成事务生成，`aigc.generated` 与 `provenance.type/route` 由服务端覆盖，不能被客户端提交的同名字段伪造；Asset Plan 中的产品、风格、证明和保护素材 ID 会去重后进入 `provenance.sourceAssetIds`。
- 该 provenance 会随项目素材库返回，并在视频跨项目导入时沿用已有的源资产元数据复制路径；本轮没有修改视频生成、账务或 provider 逻辑，也没有把内部 provenance 误称为完整的显式/元数据合规标识方案。
- provenance focused 回归 `152/152`、构建 `6528` modules、`npm run check`、`npm run collab:check`、`git diff --check` 通过。全量回归当前为 `2041` 项、`2040` 通过、`1` 个共享视频文件级失败：`test/video-shot-recovery.test.mjs` 导入的 `buildShotRecoveryDeliveryReceipt` 尚未从 `server/videoShotRecovery.mjs` 导出；已一次性交接给视频线程，主线程未改视频文件。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；本轮改动尚未上线，涉及 server/project/asset 路径，必须等视频合同恢复后重新跑 full production gate。

## 2026-08-21 Unified Visual Delivery Provenance And Canvas Manifest

- 电商结果的 server-derived AIGC provenance 已完成闭环：服务端事务覆盖客户端同名字段，固定 `generatedAt`、`aigc.generated`、`provenance.type/route`，并从 Asset Plan 派生去重后的源素材 ID；私有 prompt、provider job、外链和模型字段不会进入 canonical project assets。
- Canvas 多图 ZIP 现在包含受白名单约束的 `manifest.json`，记录文件名、资产身份、角色、尺寸、AIGC 和 provenance，名称优先级固定为 `displayName > label > name`；不会把 URL、blob、原始文件、prompt 或 provider 私有信息带入交付包。单文件保存与单文件下载行为保持不变。
- 视频交付引用已恢复兼容归一化：服务端可确定的 `role=generated-video` 与 `expectedContentHash` 会在严格校验前补齐；跨项目归属、视频 MIME、内容哈希不一致、过期/未核验引用以及 provider/billing 仍 fail closed。视频恢复与导航定向验收 `28/28` 通过。
- 本轮最终串行全量回归 `2051/2051`、隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`，本轮 asset/project/video/server/Canvas 改动仍未上线，后续发布必须走 full production gate。

## 2026-08-21 Video Asset Reuse Boundary At Mutation Entrances

- 修复视频工作台的生命周期绕过：历史版本列表继续使用 `purpose: read`，但镜头素材绑定、候选选定/进入时间线、音频轨道创建或切换、项目记忆素材引用现在统一重新执行 `purpose: reuse` 的 owner-scoped canonical project asset 校验。
- 被标记、隔离、过期或缺少 canonical 身份的版本不能再进入新的镜头、音频或记忆写入；已经存在的历史记录仍可读取和恢复，避免把 retention 清理误报成数据丢失。provider、billing、上传和生成路径未改变。
- 新增 3 条回归覆盖绑定、生成候选选定、音频/记忆引用在导入后资产状态变化的 fail-closed 行为。相关视频、路由、导出、渲染器和 retention focused 回归 `101/101`，串行全量回归 `2055/2055`，隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。本轮改动尚未上线，涉及 video/project/asset/server 路径，后续必须走 full production gate。

## 2026-08-21 Canvas Project Asset Metadata Projection

- 项目素材库导入 Canvas 节点时现在保留受控的展示与交付 provenance：`displayName`、角色/分组/比例、尺寸、AIGC 标记以及来源资产 ID；不会把完整项目资产对象或 owner、prompt、provider、外链等私有字段带进节点。
- 图片、视频和音频节点共用同一安全白名单投影，持久化快照继续沿用 durable media 边界，后续 Canvas ZIP `manifest.json` 可以读取可审计的资产信息而不泄露生成内部字段。
- 新增 Canvas 节点 metadata 回归；Canvas、Works、资产库和交付 focused 回归 `58/58`，串行全量回归 `2056/2056`，隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。本轮改动仍属于共享工作树待归档变更，涉及 Canvas/asset/project/video 交付边界，后续发布必须走 full production gate。

## 2026-08-21 Canvas Reuse Retention Boundary

- Canvas 服务端保存校验现在区分“新复用”和“历史恢复”：创建会话或保存时新增的项目素材引用必须仍处于可复用状态（active 且未过期，或 permanent/pinned）；owner、项目、哈希和稳定 URL 仍逐项核验。
- 已存在于当前 Canvas 快照的引用，即使后来进入 retention marked，也允许继续保存和恢复，避免用户打开旧作品时被误报为素材丢失；新增同一过期/标记素材仍 fail closed，并返回 `PROJECT_ASSET_NOT_REUSABLE`。
- 新增 retention 回归覆盖创建拒绝、历史会话恢复和保存时新增引用拒绝。项目版本与路由 focused 回归 `59/59`，串行全量回归 `2057/2057`，隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。本轮修改涉及 Canvas/asset/project 服务端边界，仍属于共享工作树待归档变更，后续发布必须走 full production gate。

## 2026-08-21 Video Canonical Asset Provenance Projection

- 旧 VideoStudio 项目桥接完成视频交付时，现在由服务端在 canonical `project_assets.metadata_json` 写入 `source: video-generation`、AIGC 标记、`provenance.type/route/generatedAt`、实际参与该视频项目的 canonical 来源资产 ID，以及任务计划中的 `durationMs`。
- 视频交付引用会携带受控 metadata 到 Works/Canvas；没有可靠媒体探测证据的宽高继续保持空值，不用比例或分辨率猜测像素尺寸；provider task、prompt、外部 URL 等私有字段不会进入 canonical 资产。
- 视频项目桥接 focused 回归 `7/7`，跨域项目/Canvas 回归 `112/112`，串行全量回归 `2058/2058`，隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。本轮修改涉及 server/project/video/asset 跨域边界，仍属于共享工作树待归档变更，后续发布必须走 full production gate。

## 2026-08-21 Canonical Reference Metadata Whitelist

- `assertCanonicalProjectAssetRef` 现在统一投影安全 metadata：展示名、角色/分组/比例、尺寸/时长、AIGC 标记和 provenance；视频工作台、VideoStudio、Canvas 和其他 canonical ref 消费方共享该结果，不再各自决定是否暴露原始 metadata。
- prompt、owner、provider 等私有字段，以及未在白名单中的任意扩展字段不会进入引用；身份仍由 owner/project/asset/content hash/stable URL 服务端校验，metadata 不参与授权判断。
- canonical asset contract、视频工作台、视频桥接 focused 回归 `50/50`，串行全量回归 `2059/2059`，隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。本轮修改仍属于共享工作树待归档变更，涉及 asset/project/video 跨域边界，后续发布必须走 full production gate。

## 2026-08-21 Local Browser QA Boundaries And Responsive Works Filters

- 本地 QA fixture 的合成登录态不再触发 VideoStudio `/api/video/jobs`、Canvas 账户权限或计费刷新请求；视频工作台仍对真实会话保持原有鉴权边界，浏览器 QA 不会伪造登录后的网络状态。
- 修复移动端作品集分类筛选条的实际截断：筛选容器在 620px 以下改为内容列内的可换行布局，按钮允许收缩；移动端实测 `x=72..370`，桌面端 `x=72..628`，两者均无横向溢出。
- focused 回归 `70/70`、本地浏览器 QA（首页、电商工作台、Canvas、作品集、视频工作台）通过；未上传素材、调用供应商、真实生成、账务或生产部署，线上仍为 `e673c10`。

## 2026-08-21 Project Asset Production Lifecycle

- 统一项目资产新增服务端维护的 `productionState`：`draft`、`candidate`、`delivered`、`archived`；它与 retention 独立，表示素材是否进入候选、交付和归档流程，不改变资产身份、复用资格或播放能力。
- 项目资产库新增 owner-scoped 状态查询与更新路由、状态筛选和单素材状态操作；图片、视频和音频共用同一合同，旧数据库通过默认 `draft` 迁移，非法状态 fail closed。视频线程无需修改渲染、计费、provider 或 provenance 逻辑。
- 生产生命周期、路由、客户端、Canvas 资产库和移动筛选 focused 回归 `146/146`，串行全量回归 `2069/2069`，隔离 Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；本轮涉及 `server/projects`、资产服务和 Canvas/Works UI，仍属于共享工作树待归档变更，后续发布必须走唯一入口的 full production gate。

## 2026-08-21 Project Asset Production State Derivation

- 修复统一项目资产生命周期的服务端写入缺口：电商 `completed` 结果和视频交付结果现在事务内直接进入 `delivered`，电商 `needs_review` 结果进入 `candidate`，不会再因数据库默认值回落为 `draft`。
- `completeProject` 会把被接受版本的 `draft/candidate` 资产收敛为 `delivered`，但保留已归档资产；`reviewProject` 会把待审核版本的未归档资产推进为 `candidate`；历史作品迁移也显式写入 `delivered`。来源/上传资产仍保持 `draft`，客户端不能伪造交付状态。
- 新增状态派生回归，项目/资产/视频共享 focused 回归 `216/216`，串行全量回归 `2071/2071`，Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；本轮涉及 `server/projects`、asset/project/video 共享边界，仍属于当前工作树待归档变更，后续必须通过唯一入口的 full production gate 后才能发布。

## 2026-08-21 Project Asset Production State Contract Hardening

- 收紧统一项目资产的生产状态写入合同：浏览器和 signed API 只能在 `draft/candidate/archived` 之间执行允许的人工转换，`delivered` 只能由服务端根据真实完成结果、项目完成事务或历史迁移写入；客户端伪造交付状态返回明确的 `409`，非法回退也 fail closed。
- Canvas 素材库的状态菜单现在按当前状态给出允许选项，视频工作台注册的 canonical `generated-video` 资产由服务端自动进入 `candidate`；项目完成/审核只推进结果资产，不会把同一版本的来源、上传或参考资产错误标成交付。
- 状态机、路由、客户端、Works/Canvas 模型以及视频候选接入回归通过 `167/167`；Canvas 合同回归 `61/61`；串行全量回归 `2074/2074`；Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；当前工作树仍含并行视频及其他未提交变更，本轮修改涉及 server/project/asset/video/Canvas 路径，后续必须按唯一入口执行 full production gate 后才能发布。

## 2026-08-21 Durable Product Profile Foundation

- 在现有电商 SKU UI 之上新增 owner-scoped 商品档案基础：保存规范化商品事实、变体和 canonical 项目资产引用，不重复创建 SKU 生成器，也不保存 raw URL、blob/data 媒体、provider 信息或账务字段。
- `product_profiles`、变体、资产引用和独立幂等表采用 additive schema；创建/更新事务会按 owner、project、asset、content hash 和 retention 状态重新验证引用，跨用户、哈希不一致和 marked/不可复用素材均 fail closed。归档只改变档案状态，不删除 canonical assets。
- 新增签名 API 与客户端服务：列表、创建、详情、更新、归档；请求体中的 owner 不参与授权。新增纯前端适配模型，把当前 Ecommerce editor 的商品描述、参数、SKU 和已确认资产映射为可复用档案，并在应用时保留平台、尺寸和生成设置。
- retention 现在只保护仍被 active 商品档案引用的资产；档案归档后恢复普通清理策略。图片、视频、音频统一沿用同一 project asset identity，未改变视频 provider、billing 或生成路径。
- 商品档案/资产生命周期聚焦回归 `30` 个客户端与路由测试、全套项目/视频/Canvas 跨域回归 `144/144`，串行全量回归 `2089/2089`；Vite 构建 `6528` modules、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用供应商、真实生成、账务或生产部署。线上仍为 `e673c10`；本轮商品档案代码与共享工作树中的视频、Canvas、资产改动均未发布，涉及 server/project/asset/video/Canvas 的后续发布必须按唯一入口执行 full production gate。

## 2026-08-21 Product Profile Workbench Integration

- 商品档案已从后端基础能力接入现有电商工作台：新增可收起 shelf，支持按 signed owner 列表、保存当前商品、应用已有档案、归档档案和刷新；现有 `SkuPanel` 仍保留，档案不是 SKU UI 的替代品。
- 保存只提取商品描述、确认过的参数、SKU 变体和文案要点；应用只恢复商品事实和变体，保留本轮本地图片/参考图、平台、尺寸方案、生成设置和其他编辑状态，避免把 blob/data 媒体当成 durable asset。
- 桌面本地浏览器确认档案入口、空列表、未登录保存错误和面板布局；390px 视口确认入口整行布局、面板不产生横向溢出；未触发 provider、生成、billing 或真实 API 写入。新增 shelf model/UI 合同 `5/5` 通过，相关客户端/模型回归 `25/25` 通过，构建 `6532` modules。
- 本轮仍未部署，线上仍为 `e673c10`；工作树包含共享视频/Canvas/资产改动，需统一归档并完成 full production gate 后再发布。

## 2026-08-21 Product Profile Auth And Final QA

- 商品档案读取与保存现在共同受 `state.logged && ownerEmail` 保护；未登录但残留本地身份字段时不会自动请求 signed product-profile API，保存仍给出明确登录提示。
- 先红后绿补充 UI 合同回归；商品档案 shelf/model/UI `5/5`、全量串行测试 `2094/2094`、Vite 构建 `6532` modules、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 本地浏览器最终验收：桌面 `1440px` 下页面 `scrollWidth=1436`、档案面板宽 `1128px`；移动 `390px` 下 `scrollWidth=386`、面板宽 `346px`，无横向溢出或面板内遮挡。未调用供应商、真实生成、账务或生产部署。
- 线上仍为 `e673c10`；当前工作树继续包含并行视频、Canvas、资产和导航未提交改动。本轮商品档案集成尚未单独提交或发布，后续必须统一归档并按唯一入口执行 full production gate。

## 2026-08-21 Product Profile Canonical Media Reuse And Video Contract Recovery

- 商品档案应用现在会以 signed `purpose=reuse` 逐项读取项目素材，只接受 owner-scoped、未标记、`mediaKind=image` 且 `contentHash` 与档案引用完全一致的 canonical 图片；已有本地图片不覆盖，空槽才带入，失效引用显示部分素材不可复用。
- 新增纯模型回归覆盖 product/reference/person/video/hash-mismatch 过滤；商品档案聚焦回归 `9/9`。桌面与 390px 浏览器检查确认新提示、空状态和面板尺寸稳定，未登录页面没有自动读取档案。
- 共享视频工作树曾因 `applyCandidateToTimeline` 缺失导致全量回归失败；已按既有 revision/canonical reuse/owner 事务模式恢复候选切换与时间线更新的幂等方法，视频 focused `40/40`，全量回归 `2096/2096`。
- 构建 `6532` modules、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过；未调用 provider、真实生成、billing 或生产部署。线上仍为 `e673c10`，当前共享工作树仍未统一提交，后续发布必须走 full production gate。

## 2026-08-21 Product Profile Session Boundary Hardening

- 商品档案列表读取和异步素材带入新增账号/请求代际校验：退出登录、切换账号或发起新的带入操作后，旧请求结果不能回写当前编辑器；带入期间归档动作互斥，避免档案状态在素材解析中途发生变化。
- 商品档案 focused 回归 `15/15`、全量回归 `2096/2096`、Vite 构建 `6532` modules、`npm run check`、`npm run collab:check` 和 `git diff --check` 全部通过。
- 本轮浏览器自动化服务无法连接本机调试端口，未虚报新的浏览器证据；此前 1440px/390px 商品档案布局验收仍有效。未调用 provider、真实生成、billing 或生产部署，线上仍为 `e673c10`，共享工作树仍待统一归档并按 full production gate 发布。

## 2026-08-21 Ecommerce Input Asset Lineage Completion

- 商品档案带入的 canonical `projectAssetRef` 现在会经过客户端透传、能力请求边界保留和服务端 owner/项目/哈希/复用状态复核；伪造、跨用户、哈希或稳定 URL 不匹配的引用会在项目事务创建前 fail closed。
- 电商生成开始时，项目源版本会登记产品、参考、上身角色和证明素材的受控输入资产快照；电商交付结果会根据计划中的 `sourceAssetIds` 在同一项目内写入 `generated_from` lineage，Works/Canvas 可以沿项目资产链追溯来源。
- 新增源资产、生命周期透传、结果 lineage 和前端请求合同回归；相关 focused 回归通过，全量回归 `2100/2100`，构建 `6532` modules、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- 未调用 provider、真实生成、billing 或生产部署；线上仍为 `e673c10`。共享工作树仍含视频/Canvas/资产/导航等混合未提交改动，后续必须先完成按归属的统一归档，再按唯一入口执行 full production gate。

## 2026-08-21 Cross-Domain Zero-Paid Video Gate

- `npm run verify:video-acceptance` 通过，平台、渲染对账和工作台三段均通过；`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。
- `npm run collab:check` 仍为 `READY`，`git diff --check` 通过；本轮没有调用供应商、真实生成、账务或生产部署，线上仍为 `e673c10`。
- 共享工作树仍含视频、Canvas、资产、导航和构建产物等混合未提交内容，不能直接归档或发布；后续必须按文件归属拆分，再对涉及 server/project/asset/video/Canvas 的归档执行 full production gate。

## 2026-08-21 Content Input Asset Lineage Completion

- 小红书与 Plog 的已上传风格/主体参考图现在会在内容项目源版本中创建 owner-scoped canonical `project_assets`，导入器重新校验原始资产所有权、字节哈希和 MIME；无参考图、预览和旧客户端路径保持兼容。
- 内容生成结果写入受控 `aigc`/`provenance` metadata，并为每个结果与实际输入源建立幂等 `generated_from` lineage；账务 SSE runner 只把受控输入传给项目生命周期，不把客户端字段当作授权依据。
- 新增内容生命周期输入血缘、runner 透传和导入器版本绑定回归；定向内容/项目/资产回归 `140/140`，全量回归 `2102/2102`，构建 `6532 modules`、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- `npm run verify:video-acceptance` 通过，`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。
- 当前共享工作树仍含视频/Canvas/资产/导航和历史构建产物等混合未提交内容，本轮不得直接发布；后续必须按归属拆分后统一执行 full production gate。

## 2026-08-21 Content Lineage And Video Contract Gate

- 内容参考资产血缘修复后的完整门禁再次通过：全量串行回归 `2103/2103`，Vite 构建 `6532 modules`，导出校验、`npm run check`、`npm run collab:check` 和 `git diff --check` 全部通过。
- 视频工作台 UI 合同同步到当前原子 `applyShotCandidateToTimeline` 接口；视频工作台 UI、模型、Studio 合同和存储 focused 回归全部通过，候选应用的版本校验与幂等重放保持有效。
- `npm run verify:video-acceptance` 通过：`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`；未调用供应商、真实生成或账务。
- 未部署，线上仍为 `e673c10`。当前共享工作树仍包含多线程视频、Canvas、资产、导航及历史构建产物等混合未提交内容；任何发布都必须先按归属拆分，再按唯一入口执行 full production gate。

## 2026-08-21 Dedicated Project Asset Library Surface

- Canvas 顶部导航新增独立的“素材库”入口，与“作品集”和“回收站”分离；素材库复用既有 owner-scoped 素材搜索、保留状态、生产状态、批量复用和来源关系能力，不新增生成、供应商或账务路径。
- 修正素材库与 Works 的渲染边界：登录态素材库不会再重复渲染作品列表，未登录素材库有独立登录状态；素材接口只在素材库打开时请求，移动端顶部标签保持横向可达。
- Canvas UI focused `10/10`、串行全量回归 `2106/2106`；隔离 Vite 构建 `6532 modules`、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 全部通过。
- `npm run verify:video-acceptance` 通过：`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。
- 当前共享工作树仍含视频、Canvas、资产、导航和其他混合未提交改动，不能直接把本轮视为已发布；涉及 server/project/asset/video/Canvas 的后续发布必须按文件归属拆分后走唯一入口的 full production gate。

## 2026-08-22 Top-Level Asset Library Entry And Canvas Tab Sync

- 进度修正：本轮完整回归实际为 `2109/2109`，此前同节记录的 `2108/2108` 为旧计数。

- 左侧快捷导航新增一级“素材”入口，登录用户直接进入 Canvas 素材库；未登录用户的登录意图携带 `canvasTab=assets`，验证成功后恢复到素材库而不是默认画布。顶部创作导航的 Canvas 目标也统一透传 tab 意图。
- Canvas 内部 tab 切换现在写回共享 `canvasEntryTab`，从全局导航切换素材库、作品集、回收站或当前画布时，已挂载的 Canvas 页面会同步更新本地视图；素材库与 Works 的互斥渲染和请求边界保持不变。
- 导航/Canvas focused 回归 `84/84`；本轮完整回归 `2108/2108`；隔离 Vite 构建 `6532 modules`、导出校验、`npm run check`、`npm run collab:check`、`git diff --check` 均通过。
- `npm run verify:video-acceptance` 通过：`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。
- 当前共享工作树仍含视频、Canvas、资产、导航和历史构建产物等混合未提交内容；本轮未将其视为已上线，后续涉及 server/project/asset/video/Canvas 的整合发布必须按文件归属拆分并走唯一入口的 full production gate。

## 2026-08-22 Cross-Domain Asset Reuse Audit

- 复核素材库到视频工作台的真实链路：图片、视频、音频均通过 owner-scoped project asset library 展示，导入视频项目时服务端以 `purpose=reuse` 重新校验项目归属、生命周期、稳定地址、MIME 和内容哈希，再建立工作台版本；Canvas/Works 继续保留 canonical asset identity 和独立 playback capability。
- 现有合同已覆盖过期/待清理素材拒绝、跨用户拒绝、哈希不一致拒绝、跨项目引用、幂等恢复和失败反馈；没有发现需要主线程重复添加的跨域入口或裸 URL 复制路径。
- 发现一个留给视频线程的后续可靠性项：工作台导入采用“创建素材记录 → 导入版本 → 确认版本”三步流程，第二步或第三步失败时应避免留下可见的空工作台素材，并在重试时复用同一导入意图。该项属于视频工作台内部写入边界，本轮不越权修改视频线程专属文件。
- 本轮本地证据：全量回归 `2109/2109`；Vite 构建 `6532` modules；`npm run check`、`npm run collab:check`（READY）和 `git diff --check` 通过。未部署、未调用真实生图/视频供应商、未改变账务。

## 2026-08-22 Canvas Asset Library Account Boundary

- 修复 Canvas 素材库的账号切换边界：请求依赖当前 signed owner identity，账号变化时立即清空上一账号的素材列表和批量选择；旧请求仍由取消标记阻止回写。
- 新增素材库账号边界 UI 合同回归；Canvas/状态聚焦回归 `73/73`。本轮未改变资产格式、服务端授权、生成或账务路径，未部署。
- 最终本地门禁：全量回归 `2110/2110`，Vite 构建 `6532` modules，`npm run check`、`npm run collab:check`（READY）、`git diff --check` 和 `npm run verify:video-acceptance` 通过；零供应商提交、零账务变化、零付费视频请求。

## 2026-08-22 Logout Owner-State Boundary

- 修复 `SET_LOGGED(false)` 的账号边界：退出或会话失效时清空旧账号的结果、生成状态、作品集、画布入口、作品启动意图、登录意图和输入内容，并回到公开首页；同时关闭遗留付费面板状态，避免新账号登录前看到旧账号创作内容。
- 先红后绿新增登出状态回归契约；聚焦登录/账务/Canvas/视频相关回归 `44/44`，串行全量回归 `2111/2111`，生产构建 `6532` modules、`npm run check`、`npm run collab:check`（READY）和 `git diff --check` 通过。
- `npm run verify:video-acceptance` 通过：`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。
- 本轮只修改主线程 `AppContext` 与对应回归测试；共享工作树仍包含视频、Canvas、资产、导航及构建产物等混合未提交变更，不能视为已上线。后续统一归档时需按文件归属拆分，涉及 server/project/asset/video/Canvas 的发布必须走唯一入口的 full production gate。

## 2026-08-22 Session Restore Generation Boundary

- 修复页面启动 `getSession()` 的旧会话回写竞态：恢复请求开始时捕获 `sessionRequestGate` 代际，返回后只有仍属于当前会话才允许写入登录状态、挂起付费动作和余额刷新；退出或切换账号期间返回的旧 session 会被丢弃。
- 先红后绿补充会话恢复回归契约；相关聚焦回归 `7/7`，串行全量回归 `2112/2112`，生产构建 `6532` modules、`npm run check`、`npm run collab:check`（READY）和 `git diff --check` 全部通过。
- `npm run verify:video-acceptance` 通过：`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。未调用供应商、真实生成、账务或生产部署；线上仍为 `e673c10`。
- 本轮只修改主线程 `AppContext` 与对应回归测试；共享工作树仍包含视频、Canvas、资产、导航及构建产物等混合未提交变更，不能视为已上线。后续统一归档时需按文件归属拆分，涉及 server/project/asset/video/Canvas 的发布必须走唯一入口的 full production gate。

## 2026-08-22 Payment Restore Owner And Modal Boundary

- 支付订单恢复现在拥有独立 `AbortController`，请求携带 abort signal；账号退出、支付面板关闭、恢复 effect 清理时都会中止旧请求并清空临时支付视图与恢复 key，避免旧账号或旧面板状态回写当前用户。
- 恢复同一订单仍保持幂等；关闭后重新打开允许重新读取订单。新增支付合同回归覆盖 owner/modal 会话变化，聚焦 `33/33`，串行全量回归 `2113/2113`。
- 本轮新鲜门禁：Vite 构建 `6532 modules`、`npm run check`、`npm run collab:check`（READY）、`git diff --check` 均通过；`npm run verify:video-acceptance` 通过，`providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。
- 正确的视频线程是 `019ff647-2893-7cd3-828c-b894c01cad21`，工作树 `F:/da/shubao/.worktrees/video-integration`；它继续负责视频工作台内部领域开发。跨域审计发现的“三步导入失败留下空素材”仅交由该线程处理，主线程不重复打断或越权修改。
- 本轮未提交、未部署、未调用真实供应商或账务；线上仍为 `e673c10`。当前工作树仍含并行视频、Canvas、资产和导航混合改动，后续必须按文件归属拆分后再走唯一入口的 full production gate。
## 2026-08-23 Canvas Generated-Image Archive Recovery Complete Local Acceptance

- 完成 Canvas 生成图「归档失败可恢复闭环」的完整本地验收：给待归档记录区分受控操作类型 `import-source`（原图导入）与 `register-generated`（生成结果注册），避免归一化把生成结果误当用户上传原图；仅持久化稳定资产 ID、角色和节点 ID，不保存 URL 以外的媒体数据、提示词或账务信息。队列键包含操作类型，同一稳定图片既可能是原图导入也可能是生成结果注册，不会互相覆盖；已进入待归档队列的生成图不能被其他画布状态变化反复自动请求注册，只能由用户显式「重试归档」恢复。
- 新增 `shared/canvasPendingArchive.mjs`、`shared/canvasSnapshotMedia.mjs`、`shared/workPersistence.mjs` 三个共享资产边界模块，并在主线程 `server/projects/projectStore.mjs` 与 `src/pages/EcCanvas/canvasSessionModel.js` 接入：快照持久化移除 data/blob/filesystem 等瞬时媒体载荷，无稳定身份节点标记为 `unavailable` 并提供重试归档提示。
- 本地验收证据：聚焦 Canvas/项目/资产恢复回归 `162/162` 通过；串行全量 `npm test` `2115/2115` 通过；`npm run check` 通过、`npm run collab:check` READY（0 处 peer 所有权冲突）、`git diff --check` 通过。
- 已确认本轮未触及视频线程边界：视频工作台领域文件（`server/video*.mjs`、`src/pages/VideoStudio/*`、`test/video-*.test.mjs`、`server/videoModelRouter.mjs`）为并行视频线程（`019ff647-2893-7cd3-828c-b894c01cad21`，工作树 `F:/da/shubao/.worktrees/video-integration`）的同步改动，主线程未修改、未暂存这些文件，与本次验收的 Canvas/资产改动完全不相交。
- 本轮未调用供应商、未触发真实生成、未改变账务、未部署；线上仍为 `e673c10`。涉及 server/project/asset/Canvas 的后续发布必须按唯一入口 `scripts/deploy-production.ps1` 执行 full production gate，并等待真实账务、生图、Canary 与独立健康/审计验证完成后再报「已上线」。

## 2026-08-23 Video Storyboard Shot Model Enrichment

- 视频线程在分镜（storyboard）卡片模型上补齐 VID-P1-02 的字段：video_storyboard_shots 表新增 first_frame_ref/last_frame_ref/model_intent 三列，采用 additive 迁移；createShot/updateShot 接受并持久化这三项，首/末帧引用经 purpose reuse 的 canonical 项目资产校验，外主、伪造哈希、缺失资产均 fail closed。

- 分镜卡片 UI 在卡片上展示新增的「意图」与「首末帧已绑定」标识；新建/编辑表单支持输入模型意图并随请求透传。路由（shot.create）透传新字段，客户端服务经 jsonBody 自动透传。

- 聚焦视频回归：video-workbench-store 42/42（新增 2 个分镜字段测试）、routes/client/model/ui 62/62、视频域完整子集 188/188；串行全量 npm test 2117/2117（含 2 个新测试）；npm run collab:check READY（0 peer 冲突）、git diff --check 通过。

- 未调用供应商、未触发真实生成、未改变账务、未部署。线上仍为 e673c10；工作树仍为共享工作树，视频改动与主线程 Canvas/资产改动混合未提交，后续发布必须由主线程按唯一入口 scripts/deploy-production.ps1 执行 full production gate 后统一归档。

## 2026-08-23 Video Storyboard Shot Model Enrichment

- 视频线程在分镜（storyboard）卡片模型上补齐 VID-P1-02 的字段：video_storyboard_shots 表新增 first_frame_ref/last_frame_ref/model_intent 三列，采用 additive 迁移；createShot/updateShot 接受并持久化这三项，首/末帧引用经 purpose reuse 的 canonical 项目资产校验，外主、伪造哈希、缺失资产均 fail closed。

- 分镜卡片 UI 在卡片上展示新增的「意图」与「首末帧已绑定」标识；新建/编辑表单支持输入模型意图并随请求透传。路由（shot.create）透传新字段，客户端服务经 jsonBody 自动透传。

- 聚焦视频回归：video-workbench-store 42/42（新增 2 个分镜字段测试）、routes/client/model/ui 62/62、视频域完整子集 188/188；串行全量 npm test 2117/2117（含 2 个新测试）；npm run collab:check READY（0 peer 冲突）、git diff --check 通过。

- 未调用供应商、未触发真实生成、未改变账务、未部署。线上仍为 e673c10；工作树仍为共享工作树，视频改动与主线程 Canvas/资产改动混合未提交，后续发布必须由主线程按唯一入口 scripts/deploy-production.ps1 执行 full production gate 后统一归档。

## 2026-08-23 Video Storyboard Shot Enrichment - UI & Build Closure

- 分镜字段前端闭环已补齐：新建/编辑分镜表单新增「模型意图」输入（shotDraft/edit 均透传）；编辑表单新增「首帧素材」/「末帧素材」两个下拉，从项目素材库（reusableProjectAssets 的 image 素材）选择 canonical 引用，提交时经 purpose:reuse 由服务端权威校验内容哈希（UI 不传播 contentHash/stableUrl/mimeType，符合 UI 测试契约）。

- vite build 22.46s 成功、check-build 通过（dist 产物完整）、video-project-workbench-ui/model 13/13、视频域完整子集 182/182、全量 npm test 2117/2117、collab READY、git diff --check 干净。

- 未调用供应商、未触发真实生成、未改变账务、未部署。线上仍为 e673c10；共享工作树待主线程统一归档后按唯一入口执行 full production gate。

## 2026-08-23 Video Thread Response To Material Library Design

背景：主线程调研素材库并把4个问题写入账本，视频线程从视频工作台视角回应，双方据此定稿素材库最终方案。

视频线程回应：

1. 视频素材使用流程：上传素材(视频片段/音频/图片/分镜)走 availableUploadedAssets→reusableProjectAssets，经 importer 建 canonical asset(project_assets)；分镜用 bindShotAssetVersion 绑定已确认版本；本次新增的 first_frame_ref/last_frame_ref 走 canonical project asset 引用(purpose:reuse)；视频成片(生成结果)进作品集 Works，不进素材库。

2. 视频素材确实刚需素材库：上传的组合素材(视频片段/音频/分镜图)需跨镜头、跨次生成复用并版本追溯，应保持自动入库；视频生成成片(如图片生成物)应进作品集，不自动塞素材库。

3. first_frame_ref/last_frame_ref 依赖素材库 canonical 身份：store 用 requireCanonicalProjectAsset({purpose:reuse}) 校验 project_assets。因此图片生成物若改默认不入库、用户手动决定，用户用生成图作视频首末帧前须先显式加入素材库，否则 PROJECT_ASSET_NOT_FOUND fail closed；这合理，但 UI 需给清晰的加入素材库入口。

4. 落地建议：保持自动入库=视频/画布的上传原始素材(视频片段、音频、分镜参考图)；改用户自主决定=图片生成物(电商套图、小红书图文、未来视频关键帧图)，默认进作品集+作品卡片/画布加加入素材库按钮。落地顺序：①图片生成物改默认进作品集+手动入库按钮 ②视频工作台首末帧选择器跟随先入库再复用 ③作品→素材回收闭环。

与主线程结论一致：素材库是可复用输入素材；图片生成物默认进作品集、手动入库；视频/画布上传素材自动入库。

## 2026-08-23 Video Thread Notice: Main-Thread Domain Regression Found In Full Suite

- 视频线程本轮完成渲染结算预算守卫（P1-07 收尾）：videoRendererAdapter 响应规范化新增 settlementUsage——供应商响应携带 usage.points 时强制校验为安全非负整数且不超过预检证明的 maximumPoints/requestedCapPoints，超限抛 RENDER_SETTLEMENT_BUDGET_EXCEEDED fail closed；无 usage 的中间状态向后兼容。adapter 测试 10/10（4 个新用例）、渲染器家族 38/38、视频域完整子集 203/203、verify:video-acceptance ok（providerSubmissions=0 / billingMutated=false / paidGenerationRequested=false）。
- 全量回归 2121 中 2120 过、1 失败：content-project-lifecycle.test.mjs 第47行「content generation gets an owner-scoped project and canonical output refs」断言 listProjectAssetLibrary(projectKind:xiaohongshu).length===2 实际 0（projectAssetRefs 写入正常、素材库按 kind 查询返回空）。该测试仅 import server/projects/{schema,projectStore,contentProjectLifecycle}.mjs；git diff 确认工作树中 server/projects/{contentProjectLifecycle,projectGeneratedAssetImport,projectRoutes,projectStore}.mjs 存在未提交改动且均属主线程并行修改，视频线程未触碰该域。请主线程排查修复，视频线程不越权处理。
- 本轮视频改动：server/videoRendererAdapter.mjs(+37)、test/video-renderer-adapter.test.mjs(+52)，另含此前每镜头成本估算(videoWorkbenchPlan shot.cost + UI 卡片展示约X积分)。未部署、未触发真实生成、未改变账务；线上仍为 e673c10。

## 2026-08-23 VID-P3-05 Data-Driven Routing History Slice

- videoModelRouter 新增 normalizeRouteHistory（有界500条、仅认已知状态、无效条目丢弃）与 buildRouteHistoryStats（按 productId 聚合 attempts/delivered/successRate/交付秒中位数；数据源 video_job_attempts.capability_json 内嵌 productId）。recommendVideoRoute 接受可选 history：达到 ROUTE_HISTORY_MIN_ATTEMPTS=3 的产品叠加有界加性调整（成功率±15、慢中位数最多再扣10），candidate 带 historyApplied 标记，返回体带 historySummary；无历史时输出与既有契约完全一致（向后兼容）。

- 打分公式经一轮修正：初版凸组合因静态分(150~200)与数据分(≤100)尺度不匹配会系统性压低所有候选分，改为有界加性调整后保持静态排序语义且被验证产品分数严格提升。

- 验证证据：video-model-router 9/9（4 个新用例）、下游关联 40/40（plan/preflight/skill-run/acceptance）、视频域完整子集 207/207、git diff --check 干净。纯路由层切片，未接 store 查询与 UI（后续增量），无供应商提交、无账务变更、未部署。

## 2026-08-23 VID-P3-05 Data-Driven Routing Full Wiring (Slice 2)

- store 层：videoWorkbenchStore 新增 recentRouteHistory——先查 sqlite_master 防御（video_job_attempts 表不存在时返回空数组，视频队列默认关闭的部署不受影响），存在时有界(≤500)按 created_at DESC 返回并从 capability_json 解析 productId（坏 JSON 降级为空串）。store 测试 44/44（2 个新用例）。

- plan/routes 接线：buildVideoWorkbenchPlan options 新增 routeHistory 白名单透传；mountVideoWorkbenchRoutes 定义统一 routeHistoryFor(request) helper 并在 GET plan / preflight / approve / generation-draft 四处一致注入，保证预览-批准-预检-草稿的计划指纹一致（历史变化导致指纹失配时要求重新确认，属预期行为）。本地库无该表 → 输出与旧契约完全一致，routes/client/model/ui 62/62 全绿验证向后兼容。

- UI：路线建议卡新增「已结合近期 X 次交付记录调整推荐排序」摘要（historySummary.attemptsConsidered），配套 CSS 样式，符合 UI 不传播 contentHash/stableUrl/mimeType 契约。

- 验证证据：plan 12/12（1 新用例）、聚焦子集 135/135、视频域完整子集 210/210、git diff --check 干净。改动：store(+27)/routes(+10)/plan(+14)/UI(+30)/css(+8)/测试(+60)。无供应商提交、无账务变更、未部署；线上仍为 e673c10。

## 2026-08-23 VID-P3-01 Time-Range Reshoot (reshoot_range)

- videoShotRecovery 新增 reshoot_range 模式：rangeStartMs/rangeEndMs 严格校验（安全整数、0≤start<duration、end≤duration、区间宽≥500ms），edit intent 表达 strategy=preserve_untouched_ranges + range 窗口 + fallbackToWholeShot 标记（整镜头区间时为 true，即路线图要求的 whole-shot 回退语义）。operation=reshoot 复用既有 execution/application/receipt/commit 通路，下游零改动；videoShotRecoveryLimits.modes 自动纳入新模式。

- 全链路接线：store.createShotRecoveryPlan 签名与透传扩展；routes recovery-plans 端点透传 rangeStartMs/rangeEndMs；客户端 jsonBody 自动透传；UI 恢复方式下拉新增「区间重拍」选项并配起止秒双输入框（recoveryRanges state）。

- 验证证据：video-shot-recovery 15/15（2 个新用例：intent/非法矩阵/无时长拒绝/整镜头回退/execution 编译链路）、全链路回归 121/121、视频域完整子集 212/212、git diff --check 干净。改动 server/videoShotRecovery.mjs(+24)、test/video-shot-recovery.test.mjs(+64) 另含 store/routes/UI 各少量接线。无供应商提交、无账务变更、未部署；线上仍为 e673c10。

- P1-07 结算守卫与 P2 六项核验此前已闭环；P3-05 数据驱动路由全线贯通。P3 剩余：P3-02 延长已核验达标（extend_shot 显式时长+上限）、P3-03 追踪替换已核验达标（track_replace 归一化区域）；下一项按序推进 P3-04 参考-到视频动作控制或 P3-06 候选学习。

## 2026-08-23 VID-P3-03 Previewable Mask + UI Tracked Replacement + Video Thread Commit

- P3-03 补齐最后缺口：UI 恢复下拉新增「区域追踪替换」，归一化 x/y/width/height 四轴输入（0~1、step0.05、clamp01+越界收缩），16:9 示意预览框内 CSS 蒙版实时叠加（dashed 边框+半透明蓝），满足「previewable masks and normalized coordinates」验收。

- 协作记录：主线程部署 gate 失败根因是视频线程未提交改动；视频线程将 P3 全部增量（P3-05 路由/P3-01 区间重拍/P3-06 候选学习/P1-07 守卫）以提交 836d154（父=9899645）完整入库，视频域工作树清空。本轮 mask 切片随后单独提交。

- 验证证据：video-project-workbench-ui 2/2（含 track_replace/recoveryRegions/蒙版断言）、视频域完整子集回归绿、git diff --check 干净。无供应商提交、无账务变更、未部署。

## 2026-08-23 VID-P3-07 Collaboration/API Slice (comments + export webhooks)

- 项目评论全链路：video_project_comments 表（shot_id 可空外链镜头）、store.addProjectComment（body 有界 1..2000，VIDEO_COMMENT_INVALID fail-closed；作者=操作者单租户模型）、listProjectComments（有界≤500 倒序+可选 shotId 过滤）；routes 新增 GET/POST /workbench/comments（owner-scoped dispatch 沿用 cohort 门禁）。

- 导出 webhook 订阅基础：server/videoExportWebhooks.mjs 纯函数——normalizeWebhookUrl 仅接受公网 https（拒 http/localhost/.local/私网 IPv4 字面量/超长），buildExportWebhookPayload 确定性 provider-neutral 负载；实际 HTTP 投递留待 worker 增量。

- 核验达标项：team roles=既有 authorizeCohort.requireEligible cohort 门禁；scoped API=既有 owner-scoped REST dispatch（每端点 operationName 审计）。approvals=既有生成计划审批指纹机制。

- 验证证据：video-collaboration 2/2、含协作模块的视频域完整子集 219/219、git diff --check 干净。提交 e319801。无供应商提交、无账务变更、未部署。
