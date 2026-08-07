# Ecommerce Creative, Export, and Canvas Stability Design

Date: 2026-08-07
Status: Approved for implementation

## Goal

Complete the ecommerce workflow as one coherent product system. Product facts must remain trustworthy, deliberate new generations must feel meaningfully different, configuration overlays must remain usable, generation failures must not create billing harm, and every canvas export path must end in a verified local file.

## Product Principles

1. Product truth is deterministic. Color, structure, visible components, confirmed SKU facts, dimensions, material, platform constraints, white-background rules, and uncertainty guards never change merely to create novelty.
2. Creativity is bounded and deliberate. A new plan may vary the selling thesis, scene family, hero composition, camera duty, information hierarchy, proof strategy, and layout rhythm. A failed retry must reuse the original route.
3. Every user action has a complete state machine. Configuration, generation, stitching, and export expose ready, running, success, cancelled, retryable failure, and terminal failure states where applicable.
4. Derived canvas content is placed to the right of its source group first. Downward placement is only a collision fallback.
5. Delivery contains only generated or explicitly derived assets. Source uploads and internal JSON are never silently included.

## Scope

### 1. Truth-Stable, Creativity-Variable Planning

The direction service is split into two contracts:

- `evidence`: deterministic visual observations, user-confirmed facts, uncertainties, reference-language observations, platform requirements, and requested deliverables.
- `creativeRoute`: a bounded route selected for a deliberate planning attempt.

Each deliberate new planning attempt receives an immutable `creativeAttemptId` and a `routeFingerprint`. The route is selected from compatible dimensions:

- selling thesis
- scene family
- hero composition
- camera language
- information hierarchy
- proof strategy
- palette and lighting interpretation
- per-shot communication duties

The planner receives recently used route fingerprints for the same draft and must avoid near-duplicates. A local similarity gate compares normalized route dimensions and visible plan copy. If the route is too similar, one bounded re-plan is allowed before using the safest distinct local route. This is not free-form randomness and cannot alter facts.

The plan UI visibly explains:

- observations from this product
- transferable reference traits
- prompt-specific intent
- chosen route and why it fits
- what changed from the previous route, when applicable

Failed provider retries preserve `creativeAttemptId`, route, campaign bible, asset plan, and charge hold. An explicit user action such as `换一套方案` creates a new attempt. Generation retries never masquerade as a new creative attempt.

### 2. Configuration Overlay and Ecommerce Format Registry

All expandable configuration controls render through a viewport-level portal with anchored positioning, collision detection, viewport padding, and responsive max height. Parent panels may scroll without clipping the overlay.

A central format registry replaces local four-ratio lists. It contains role-aware and platform-aware presets, including at minimum:

- square: 1:1
- portrait commerce: 3:4, 4:5, 2:3, 9:16
- landscape commerce: 4:3, 3:2, 16:9
- platform and role labels for main image, feed image, SKU, detail slice, white background, transparent asset, video cover, and custom ratio
- detail defaults remain 9:16

Only formats supported by the selected generation model can be submitted directly. Unsupported display formats use a documented promoted generation size and deterministic crop or fit policy. The same registry drives step-one configuration, step-two editable plans, canvas suite composers, validation, summaries, and prompts.

### 3. Generation Reliability, Retry, and Billing

Generation failures are classified as transient provider failure, timeout, malformed response, policy rejection, user cancellation, lease loss, and terminal validation failure.

- Transient failures receive bounded retry or resume using the same asset identity.
- A failed asset is never settled as delivered.
- Unspent holds are released atomically on terminal parent failure or cancellation.
- Verified assets are settled exactly once.
- UI copy states generated, charged, released, and retryable counts without exposing internal provider jargon.
- Failed tasks retain a deliberate retry action and a dismiss/archive action.

The global task sidebar supports owner-scoped dismiss/archive for terminal tasks. Active tasks cannot be accidentally dismissed. Closing the panel and dismissing a task are separate operations.

### 4. Unified Export State Machine

Single-image save, selected-image export, full-suite export, and long-detail export use one delivery subsystem.

States:

1. `configuring`: choose mode, format, scope, and long-image order.
2. `destination-ready`: select a directory or file handle; the chosen destination name is shown.
3. `preparing`: fetch and validate every required blob before opening any writable stream.
4. `writing`: write verified non-empty image blobs and expose progress.
5. `success`: show count, destination name, completion action, and repeat-export action.
6. `cancelled` or `error`: preserve configuration and allow retry.

Primary actions are explicit:

- `导出整套图片`
- `合成并导出详情长图`
- `另存为`
- after destination selection: `开始导出`

The operating-system Save button only selects a destination. The application then retains a visible `开始导出` action, satisfying the two-stage workflow.

Before writing, responses must be successful, have an image content type, and contain a non-zero blob. All suite blobs are prepared before the first file is created. Writable streams are aborted on errors. Unsupported browsers fall back to a validated ZIP or single-file download, without JSON or source assets.

### 5. Long-Detail Asset Pipeline

The stitch endpoint writes to stable generated-asset storage, not the mutable frontend distribution directory. The returned asset must be readable through the same durable asset route as other generated images.

Composition validates input count, image type, dimensions, decoded pixels, output dimensions, and final byte size. Long-image generation and local export have separate statuses:

- successful composition always creates a canvas asset
- cancelling local export does not delete the composed asset
- failed composition creates neither an empty asset nor an empty local file

The composed node is placed to the right of the union bounds of source detail nodes using the shared blank-placement algorithm. Connections preserve all source IDs and ordered provenance.

### 6. Canvas Interaction and Global UI Consistency

- Select mode uses an arrow cursor and drag marquee selection.
- Hand mode pans the canvas and uses grab/grabbing cursors.
- The select hint includes `Shift + 左键多选` without becoming a persistent obstruction.
- Multi-selection labels and command containers size to content with compact global spacing tokens.
- Export entire suite remains available separately from long-image export.
- Bottom controls use existing canvas capabilities first: selection, pan, add image/text, layers, zoom/fit, and discoverable secondary controls. Competitor behavior is used as interaction reference, not copied blindly.
- Popovers, task notices, progress messages, and completion states are dismissible where persistence is not required for safety.

## Architecture

New or consolidated modules should have narrow ownership:

- `ecommerceFormatRegistry`: platform/role/model format policies.
- `creativeRoutePolicy`: attempt identity, route dimensions, fingerprints, recent-route avoidance, and similarity checks.
- `browserFileDelivery`: destination selection, validated preparation, writing, fallback, progress, and cancellation.
- `canvasDerivedPlacement`: source-union placement for all derived outputs.
- task dismissal store/API contract for owner-scoped terminal history.

Existing campaign bible, asset planner, prompt compiler, and orchestration snapshots carry the creative attempt and route fields end to end. No hidden prompt-only field is allowed; the UI and stored snapshot must agree with the prompt sent to generation.

## Error Handling

- No empty file is created before payload validation.
- No generated result is marked delivered without a durable readable URL.
- No retry changes creative intent unless the user explicitly requests a new plan.
- No terminal failure retains an unaccounted billing hold.
- Cancelling a picker is informational, not an error.
- Errors remain next to the action that failed and keep a deliberate retry control.

## Verification

Unit and contract coverage must include:

- same facts plus new attempt creates a distinct bounded route
- same attempt retry preserves the exact route and asset plan
- factual fields never mutate across route changes
- plan copy includes product/reference/prompt-specific evidence
- overlay portal positioning and collision behavior
- every registry consumer uses legal formats and detail defaults to 9:16
- generation terminal paths settle or release holds exactly once
- task dismissal is owner-scoped and rejects active tasks
- delivery state transitions, picker cancellation, invalid content type, zero bytes, write abort, ZIP fallback, and source exclusion
- long-detail durable URL, non-zero output, ordering, and right-side placement
- selection and hand cursor/marquee behavior

Browser QA must cover desktop and mobile viewports, Chrome file-system access behavior with test doubles, export success/error recovery, overlay clipping, canvas selection/pan, task dismissal, and long-image placement. Production validation must use `scripts/deploy-production.ps1`, followed by health, audit, billing, generation, and canary checks required by the project release contract.

## Non-Goals

- Randomly changing confirmed product facts
- Generating three paid image sets merely to select one
- Replacing the canvas engine without evidence that current interaction defects cannot be fixed safely
- Copying every competitor control regardless of product relevance
- Exposing full local filesystem paths, which browsers intentionally protect
