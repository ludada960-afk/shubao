# AI Video P2 SkillRun DAG Executor

## Goal

Add a deterministic, provider-free execution-plan layer for the owner-scoped
SkillRun preview flow. A preview must be able to tell the client which steps
are ready, blocked, or complete without creating generation jobs or charging
credits.

## Scope

- Reject cyclic step dependencies while normalizing a SkillRun specification.
- Compute a stable execution plan from normalized steps and completed step IDs.
- Keep the executor pure and bounded so it can later be called by a persisted
  SkillRun state machine.
- Add contract tests for valid DAGs, blocked steps, completion, invalid state,
  and cycle rejection.

## Non-goals

- No provider/API calls, image/video generation, billing, refunds, or queues.
- No production deployment until the existing deploy key is available and the
  standard 600-second canary can run.

## Implementation Tasks

1. Add failing tests for cycle rejection and deterministic DAG plans.
2. Add cycle detection to `normalizeSkillRunSpec`.
3. Implement `buildSkillRunExecutionPlan` with bounded state validation.
4. Run focused tests, full tests, type/check/build gates, and the video
   workbench verifier.
5. Commit the local slice and record deployment status in RTK/progress docs.

## Acceptance Criteria

- Acyclic steps are returned in declaration order for `readyStepIds`.
- A step is ready only when every declared dependency is complete.
- Incomplete steps with unmet dependencies are reported as blocked.
- All steps complete yields `status: complete` and no ready steps.
- Unknown completed step IDs and cyclic specs fail with coded validation errors.
- The implementation performs no provider, project-generation, or billing
  writes.
