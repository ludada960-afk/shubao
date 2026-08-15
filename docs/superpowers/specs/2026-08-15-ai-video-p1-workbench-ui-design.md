# AI Video P1 Workbench UI Design

Status: approved for local implementation by the user's standing instruction to execute the AI-video roadmap end to end.

Roadmap: `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`

Domain contract: `docs/superpowers/specs/2026-08-15-ai-video-p1-workbench-domain-design.md`

## 1. Goal

Add a practical project layer around the existing single-shot `VideoStudio` generator so an internal user can preserve approved source assets, plan ordered shots, import verified completed generations, select one candidate per shot, and assemble a minimal durable timeline.

The workbench is additive, standalone-page only, and protected by `VIDEO_PLATFORM_P1_WORKBENCH=false` by default. It does not replace the current homepage video composer or alter paid generation and billing paths.

## 2. Product Decision

Three approaches were considered:

1. Replace `VideoStudio` with a dense professional editor. Rejected because it would disrupt the proven generator, expose unfinished timeline behavior, and combine too many failure domains.
2. Add project fields directly inside the existing generation form. Rejected because assets, shots, candidates, and timeline would compete for one narrow composer and make mobile use harder.
3. Add an incremental project workbench below the standalone generator. Adopted because the generator remains the shot engine while the workbench becomes the durable project memory and approval surface.

The adopted information flow is one vertical sequence:

`Project -> Approved assets -> Storyboard shots -> Verified candidates -> Selected versions -> Timeline`

## 3. Scope

### In scope

- List and create owner-scoped video projects.
- Import only server-verified completed video uploads into semantic workbench assets.
- Approve immutable asset versions and bind them to a shot role.
- Create ordered shot cards from the current prompt and generation settings.
- Import a candidate by completed generation-job ID; the server resolves the actual output.
- Select a candidate and add it to the minimal timeline.
- Refresh-safe projection from the P1 workbench API.
- Clear loading, empty, conflict, unavailable, and retry states.
- Desktop and mobile review/approval layouts.

### Non-goals

- No professional multi-track editing, waveform, trimming UI, transitions, subtitles, export, or drag-to-reorder in this slice.
- No director Agent, automatic shot planning, project memory, or Skill execution.
- No new provider submission route and no automatic paid generation.
- No public navigation or production flag enablement before P1 acceptance.
- No browser-supplied stable URL, checksum, MIME type, owner, or output asset authority.

## 4. Trust Boundary

### Asset import

The browser sends only `videoAssetId` plus non-authoritative display metadata. The server must load the owner-matched `video_assets` row and derive:

- stable URL;
- SHA-256 content hash;
- MIME type;
- original file kind.

The version route ignores forged URL/hash/MIME fields. Only completed durable uploads with a real checksum are accepted.

### Candidate import

The browser sends only `generationJobId`. The server verifies the owner, terminal completed status, durable output asset, checksum, and MIME type before registering a candidate.

### Project ownership

Every request derives the owner from the signed session. A missing or foreign project, asset, shot, candidate, job, or upload returns the same not-found surface.

## 5. UI Structure

### Project rail

- Compact project selector with status and last-updated time.
- `New project` is a clear command and uses one generated idempotency key.
- Existing `video` projects only; ecommerce and social projects never appear.

### Asset shelf

- Shows completed local uploads that can be imported and semantic assets already in the project.
- Semantic kind is explicit: product, person, wardrobe, scene, prop, style, voice, or music.
- A version is visibly `Draft` or `Approved`; approval is a deliberate command.
- A source uploaded for immediate preview remains visible while durable import runs.

### Storyboard

- Ordered shot cards show purpose, duration, prompt, binding count, candidate count, and status.
- The current generator prompt/settings can seed a new shot but are copied, never implicitly linked.
- Binding selects an approved asset version and a semantic role.

### Candidate review

- A completed generation job can be imported into the selected shot.
- Candidate cards use the authoritative stable playback URL.
- Selection is explicit and revision-checked; changing selection makes earlier timeline clips stale rather than silently replacing them.

### Timeline

- A compact ordered clip list, not a pro editor.
- Only the selected candidate of a non-stale shot can be added.
- Stale clips remain visible with a repair state and cannot masquerade as current output.

## 6. Visual Language

The workbench is a quiet production workspace rather than a marketing card wall.

- Warm neutral background, white operational surfaces, violet only for current focus, teal for approved state, amber for stale/review, red for errors.
- Cards use at most 8px radius; compact controls use Lucide icons and tooltips where labels are unnecessary.
- No black selected tabs, oversized decorative cards, nested cards, gradient decoration, or explanatory feature copy.
- The desktop view uses a narrow project rail and one main workflow column. Mobile stacks all stages and preserves the same order.
- Media frames use their intrinsic ratio; no fixed frame may introduce letterboxing or crop source content.

## 7. Client Architecture

### `src/services/projects.js`

Adds signed `listProjects` and `getProject` calls while retaining current lifecycle methods.

### `src/services/videoWorkbench.js`

Owns signed workbench HTTP calls, encoded path validation, response-shape validation, and stable API error propagation.

### `src/pages/VideoStudio/videoWorkbenchModel.js`

Pure helpers filter/sort video projects, choose next positions, map completed upload kinds to semantic defaults, expose approved versions, derive the selected candidate, and summarize timeline duration/staleness.

### `src/pages/VideoStudio/VideoProjectWorkbench.jsx`

Owns loading and mutation state for the selected project. Every successful mutation reloads the authoritative projection. It accepts current uploads, generation history, prompt, ratio, resolution, duration, and mode as inputs from `VideoStudio`; it never mutates paid generation state.

### `src/pages/VideoStudio/index.jsx`

Renders the workbench only when the route is standalone and `/api/video/capabilities` reports `workbenchEnabled=true`.

## 8. Failure Behavior

- Initial list failure: show retry without hiding the current generator.
- Mutation failure: keep the current projection, show the server message, and allow retry.
- `VERSION_CONFLICT`: reload the projection and ask the user to repeat the deliberate action.
- Upload not durable yet: disable import and name the pending state.
- Generation still pending/failed: do not offer candidate import.
- Deleted project/source during async completion: discard the stale response after verifying the active project ID.
- Feature flag disabled: no route and no client workbench DOM.

## 9. Accessibility and Responsive Rules

- All icon-only controls have `aria-label` and title text.
- Keyboard focus is visible; buttons use native disabled semantics.
- Status is expressed by text and icon, not color alone.
- At 820px the project rail becomes a horizontal selector; at 520px commands become full-width where needed.
- No horizontal document overflow at 390px.
- Reduced-motion preference removes nonessential transitions.

## 10. Rollout

1. Keep `VIDEO_PLATFORM_P1_WORKBENCH=false` in production.
2. Run local and authenticated staging/browser acceptance with no provider call.
3. Enable for the owner account only through a later cohort gate after P0 production observation.
4. Observe ten internal projects with no state loss, ownership leak, billing mismatch, or stale clip misrepresentation.
5. Roll back by disabling the flag; additive records remain auditable.

## 11. Acceptance

- One internal user can create a project and complete the six-step workflow without a paid generation initiated by the workbench.
- Browser-supplied URL/hash/MIME/output identifiers cannot enter authoritative records.
- Refresh restores the same approved assets, shots, candidates, selection, and timeline.
- Every visible control changes durable state or opens a real supported action.
- Focused tests, full regression, build, desktop/mobile browser QA, ownership tests, and default-off route tests pass.

## 12. Self-Review

- The design preserves the existing generator and billing source of truth.
- It introduces no duplicate project, upload, job, or wallet store.
- It explicitly separates immediate local preview from durable version import.
- It keeps professional timeline editing and Skill execution out of P1 UI.
- No placeholder, fake control, or unverified provider claim remains.
