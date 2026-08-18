# AI Video P2 SkillRun Step Events

## Goal

Persist deterministic SkillRun step completion events and expose the current
execution plan through the owner-scoped workbench API. This is a recovery and
audit slice; it does not submit provider jobs or mutate billing.

## Scope

- Derive completed step IDs from append-only events.
- Add an owner/project-scoped step completion method with dependency checks and
  optimistic revision protection.
- Return the deterministic execution plan with every SkillRun read/mutation.
- Keep status transitions explicit: `preview` → `running` → `complete`.
- Add signed client and protected route coverage.

## Non-goals

- No provider/model submission, queue, webhook, generation job, wallet, usage,
  or billing writes.
- No automatic execution: only an explicit authenticated step-completion
  action can advance the plan.

## Tasks

1. Write failing store/route/client tests for dependency ordering, replay,
   conflict, owner isolation, and completion projection.
2. Implement append-only `step.completed` events and deterministic projection.
3. Add the protected route and signed client helper.
4. Run focused/full tests, check/build, workbench verifier, and diff check.
5. Commit locally and record that deployment still requires the fenced release
   credential and 600-second canary.

## Verification

- [x] Focused SkillRun/workbench route, store, and client regression passed
  `31/31`.
- [x] Full `npm test` passed `1669/1669`; `npm run check`, production build,
  `npm run verify:video-workbench-pilot`, and `git diff --check` passed.
- [ ] Production deployment and 600-second canary remain pending the controlled
  SSH credential.

## Acceptance Criteria

- A step cannot complete until all dependencies are complete.
- Duplicate completion is idempotent only with the same expected revision;
  stale revisions return the existing conflict contract.
- The returned plan has stable declaration order and reaches `complete` only
  after every step is complete.
- All reads remain owner/project scoped and append-only events are ordered.
- No generation or billing tables change in any test.
