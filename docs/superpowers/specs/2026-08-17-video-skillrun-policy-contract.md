# Video SkillRun Policy Contract

## Goal

Make the declarative SkillRun boundary explicit before any provider execution is added. A
stored run must carry a bounded budget cap, step guards, retry policy, and compensation
policy so later execution cannot silently invent billing or recovery behavior.

## Scope

- Normalize `budgetPolicy` in `ai_points` with a positive bounded `maxPoints` and an explicit
  reservation mode.
- Normalize a bounded list of declared guards and validate every step guard reference.
- Normalize a bounded per-step retry count and an allow-list of retryable failure kinds.
- Normalize provider and persistence compensation actions.
- Persist these values as part of the existing immutable SkillRun plan.

## Non-goals

- No provider submission, wallet hold, quote, usage event, or billing mutation.
- No automatic retry or compensation side effect in this slice.
- No changes to the public default-off workbench gate.

## Invariants

1. Only `ai_points` is accepted as the SkillRun budget currency.
2. Step guards must be declared by the same spec; unknown references fail before persistence.
3. Retry policy is bounded to at most three retries per step and unique failure kinds.
4. Invalid policy input is rejected with `INVALID_SKILL_RUN` before a run can be stored.

## Verification

Focused SkillRun tests cover valid normalization and invalid budget/retry/guard inputs. The
full repository suite, type/build check, and production build remain release gates.
