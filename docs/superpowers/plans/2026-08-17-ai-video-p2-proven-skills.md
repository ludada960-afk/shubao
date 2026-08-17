# AI Video P2-03 Proven Skill Templates Implementation Plan

**Goal:** Register two reusable, versioned video Skill templates derived from the existing VideoStudio modes and workbench primitives: product advertisement and reference-video reconstruction.

**Non-goals:** This slice does not call a provider, create a generation job, reserve/settle credits, or enable the workbench in production. It only adds bounded metadata, contract validation, and owner-gated read access for future UI wiring.

**Reuse map:**

- `server/videoPlanning.mjs` is the source of truth for `smart` and `remake` semantics.
- `server/videoSkillRun.mjs` validates the executable DAG shape and checkpoint IDs.
- `server/videoWorkbenchRoutes.mjs` already provides owner/cohort gating and operation telemetry.
- `src/services/videoWorkbench.js` owns signed client requests and response-shape validation.

## Tasks

- [x] Define the template schema and write failing tests for the two templates.
- [x] Implement bounded registry and SkillRun spec builder.
- [x] Add owner-gated template metadata route and signed client helper.
- [x] Run focused tests, full regression, type/check/build, and diff checks.
- [x] Record local evidence and deployment blocker in RTK/roadmap; do not claim production until deploy evidence exists.

## Evidence

- Focused Skill/template/workbench tests: `31/31`.
- Full repository regression: `1687/1687`.
- `npm run check`: passed.
- Production build: passed, `6510` modules transformed.
- `git diff --check`: passed.
- No provider, generation, usage, wallet, or billing call was made.
- Production deployment remains blocked by the unreadable controlled SSH key; the route is
  owner/cohort gated and remains default-off until a clean release and 600-second canary exist.

## Follow-up: P2-04 replay provenance

The replay manifest and clone path now preserve `templateId` from a normalized template SkillRun
plan through the sanitized immutable snapshot and into the cloned project version. Runtime run IDs,
owner identity, and playback URLs remain excluded. Focused replay/store coverage is included in the
`54/54` combined run and the full repository regression is `1687/1687`; no provider or billing path
is touched.

## Contract

Each template exposes only sanitized metadata: `templateId`, `skillId`, `skillVersion`, `title`, `mode`, `sourceWorkflow`, `inputContract`, `steps`, `checkpoints`, `capabilities`, `modelPolicy`, `outputContract`, and `rightsPolicy`. Provider names, prices, credentials, and hidden prompts are excluded.

The template builder accepts bounded user `input` and returns a normal SkillRun spec compatible with the existing preview route. It never invokes providers or billing code.
