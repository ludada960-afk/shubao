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

## Ownership

- Codex owns: `server/`, existing application pages, API integration, database, deployment, and all plan execution unless delegated explicitly.
- GLM reserved scope for the next independent handoff only: `src/components/billing/` new presentational files and `test/billing-ui-model.test.mjs` as listed in the paid workflow plan.
- No overlapping implementation agents may run concurrently.

## Minor findings backlog

- Billing Task 4: resolved in Task 7 by mapping SQLite busy/locked failures to structured retryable HTTP responses.
- Billing Task 6: resolved during Task 7 final review by replacing next-route source markers with balanced structural handler extraction and removing the production marker comment.
- Ecommerce Engine Task 2: non-blocking documentation follow-up — `buildVlmPrompt` JSDoc type union should include `product_truth` when `vlmSchema.mjs` is next touched.
