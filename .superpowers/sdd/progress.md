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
