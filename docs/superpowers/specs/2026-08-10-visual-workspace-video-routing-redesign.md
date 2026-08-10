# Visual Workspace and Video Routing Redesign

**Status:** Approved

**Date:** 2026-08-10

**Supersedes:** The copied-reference-asset and expanding-side-navigation portions of:

- `docs/superpowers/specs/2026-08-10-free-visual-creation-design.md`
- `docs/superpowers/plans/2026-08-10-video-creation-experience-unification.md`

## 1. Decision Summary

Shubao keeps four first-class creation domains:

1. Ecommerce images
2. Video generation
3. Xiaohongshu graphics
4. Free visual creation

Poster generation is a recipe inside Free Visual Creation, not a fifth domain. The
product does not use implementation labels such as "chat mode" as top-level
navigation.

The redesign is one coordinated release. It replaces all competitor-derived home
artwork, corrects navigation motion, rebuilds the video and free-creation workbenches,
and introduces a server-authoritative video product catalog with explicit routing,
pricing, health gates, and billing semantics.

MiniMax H3 is implemented behind a closed availability gate. It remains absent from
the public selector until production canaries establish that the intermediary route
can reliably submit, complete, download, persist, and settle real 2K jobs.

## 2. Goals

- Give every top-level domain an original, inspectable visual identity.
- Make the four home cards feel like one coherent selector while preserving the
  reference interaction's fan, overlap, and lift behavior.
- Make navigation motion come from icon internals instead of layout expansion.
- Give video modes, material inputs, model choice, delivery settings, cost, and the
  submit action an obvious hierarchy.
- Make visual recipes predictable by showing what is preserved, what changes, and
  what the output looks like before selection.
- Hide intermediary complexity behind a small product catalog without hiding price
  or capability constraints from the user.
- Preserve idempotent submission, durable outputs, hold/settle/release accounting,
  restart recovery, and owner-scoped concurrency.
- Make all decisions recoverable from Git, specifications, tests, and runtime
  configuration rather than conversation history.

## 3. Non-Goals

- Exposing every model listed by the intermediary.
- Adding video-to-video editing beyond the approved Smart, First/Last Frame, and
  Viral Remake modes.
- Turning Free Visual Creation into an unrestricted low-level prompt playground.
- Publishing H3 based only on a model-marketplace listing or a successful HTTP
  validation request.
- Reusing, tracing, recoloring, or lightly modifying competitor artwork.

## 4. Original Home Artwork

### 4.1 Rights and provenance

The four current `reference-card-*.png` files are competitor reference images and
must be removed from production usage and then deleted. Tests must reject their file
names and paths.

All four replacements are generated specifically for Shubao and contain no third-
party logos, recognizable public figures, copied typography, or competitor assets.
Generation prompts and final file hashes are recorded in a small asset manifest.
References may guide only the broad concept of layered cards; they are never image
inputs to generation.

The committed paths are:

- `public/images/home/entry-ecommerce.png`
- `public/images/home/entry-video.png`
- `public/images/home/entry-xhs.png`
- `public/images/home/entry-visual.png`
- `public/images/home/entry-assets.manifest.json`

### 4.2 Visual concepts

- **Ecommerce images:** three product-delivery frames showing hero packshot,
  contextual use, and material detail.
- **Video generation:** three spread storyboard frames showing an opening product
  close-up, a hand interaction, and a final lifestyle scene. No centered presenter.
- **Xiaohongshu graphics:** three editorial social frames combining a lifestyle
  photograph, structured type area, and detail crop.
- **Free visual creation:** three visibly different outputs: an abstract poster, an
  editorial collage, and a brand key visual.

The art uses a consistent neutral paper frame, restrained shadows, distinct accent
colors per domain, and transparent outer backgrounds. Any text embedded in generated
art is removed or replaced by controlled UI typography.

### 4.3 Card interaction

Desktop cards preserve the measured reference behavior:

- Four `148 x 156px` cards inside a centered `640 x 156px` fan at the reference
  breakpoint, scaled only through breakpoint-specific dimensions.
- Initial rotations: `-10deg`, `+5deg`, `-5deg`, `+5deg`.
- Initial offsets: card 1 `margin-right:-24px`, card 3 `translateY(-8px)`, card 4
  `margin-left:-16px`.
- Hover and keyboard focus animate only `transform` to
  `translateY(-16px) rotate(0deg)` over `200ms cubic-bezier(0, 0, 0.2, 1)`.
- Neighbor cards do not move, resize, or reflow.
- Selection persists independently of hover and is conveyed through border/focus
  treatment and `aria-selected`.

The reference site's fixed `1440px` mobile layout is not copied. Small screens use
breakpoint-specific card dimensions that keep all four entries available without
horizontal page overflow. Touch selection supplies the persistent active treatment;
hover-only effects are not required.

## 5. Side Navigation Motion

The navigation rail and every item keep stable geometry. An item never expands from
`44px` to a label width.

- Labels render in an independently positioned tooltip to the right of the rail.
- Tooltips use opacity and short translation only; they do not affect layout.
- Lucide icon child paths/rectangles animate as separate parts with
  `420ms cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Sparkles rotate/scale with staggered delays; canvas panels shift by small opposing
  offsets; video frame/play elements separate and settle; folder body and inner line
  lift with different amplitudes.
- Hover, `:focus-visible`, and active state remain distinct.
- `prefers-reduced-motion: reduce` removes transforms while retaining color, tooltip,
  focus, and current-page information.
- The mobile bottom rail keeps fixed button dimensions and suppresses tooltips.

## 6. Video Workbench

### 6.1 Mode selector

The three modes are one connected segmented control with a sliding selected layer,
mode icon, title, and concise input contract:

- **Smart:** prompt required; all materials optional.
- **First/Last Frame:** exactly one first image and one last image required.
- **Viral Remake:** at least one reference video and one replacement image required;
  audio is optional when supported by the chosen product.

Selection motion does not change the component's height. The control remains three
columns on desktop and uses a horizontally stable compact variant on narrow screens,
instead of producing an accidental two-plus-one grid.

### 6.2 Material stage

Image, video, and audio are primary actions, not footnotes.

- The empty Smart stage presents three explicit material lanes with icons, names,
  accepted purpose, and separate file pickers.
- First/Last Frame presents two equally weighted frame slots with a directional link.
- Viral Remake visually prioritizes reference video, then replacement imagery, then
  optional audio.
- Uploaded assets replace empty actions with stable thumbnails and type badges.
- The material stage is the only upload entry point. The redundant plus button below
  the prompt is removed.
- The mention action appears only when at least one uploaded material can be cited.

### 6.3 Prompt and controls

The prompt remains the largest text input. Job progress and failures appear directly
beside it and remain persistent until resolved or dismissed.

At desktop widths, the bottom bar is one row in this order:

1. Video product/model
2. Aspect ratio and duration
3. Audio
4. Delivery quality and seed
5. Locked cost
6. Generate action

The row uses explicit grid tracks and stable control dimensions. It does not wrap into
two incidental rows. Below the compact breakpoint, secondary controls collapse into
one settings trigger while cost and generation remain visible. Mobile uses an
intentional stacked command area, not a compressed desktop toolbar.

## 7. Free Visual Creation

### 7.1 Recipe catalog

The entry is called Free Visual Creation. The initial catalog includes:

- Free creation
- Poster design
- Social cover
- Brand key visual

Each recipe option shows two original sample outputs and three short facts:

- what input identity is preserved;
- what visual transformation is applied;
- what delivery contexts it suits.

Recipes are inspectable capability objects, not unexplained personas. A future role or
designer presentation may wrap a recipe, but it cannot replace its input, output,
constraint, cost, and example contract.

### 7.2 Layout

- Four columns at workbench widths of at least `1180px`, two columns from `641px` to
  `1179px`, and one column at `640px` or below.
- Every grid parent and child uses `min-width:0`; previews use explicit aspect ratios;
  no option can extend beyond the workbench.
- Selection does not change card dimensions.
- Reference assets, prompt, image model, ratio, clarity, count, total cost, and submit
  action form one continuous task flow.
- The desktop parameter bar stays one row. Mobile groups compatible controls and uses
  a full-width submit action.

## 8. Video Product Catalog

The public catalog exposes products, not raw intermediary SKUs.

| Product ID | Public label | Provider route | Cost basis | 4-8s | 9-15s | Initial state |
|---|---|---|---:|---:|---:|---|
| `seedance_fast` | 快速成片 | `sd5-seedance-2.0-fast` | CNY 2.73/task | 40 points | 46 points | public |
| `seedance_standard` | 稳定成片 | `sd5-seedance-2.0` | CNY 4.355/task | 62 points | 72 points | public/default |
| `minimax_h3_2k` | 2K 精制 | `minimax-h3-2k` | CNY 3.25/task | 68 points (5-8s) | 78 points | hidden |

Prices use the least favorable purchasable point package, a 3% payment-cost allowance,
and a minimum 70% contribution-margin gate. The server validates this relationship in
tests. The existing 32-point video tier does not satisfy its stated gate and is
replaced.

The public API returns labels, supported modes, durations, ratios, resolutions,
material limits, audio rules, current availability, and point quotes. It never returns
provider costs, provider credentials, or raw routing secrets.

### 8.1 Capability rules

- Seedance routes support text, image, video, and audio references, First/Last Frame,
  and 4-15 second delivery within the verified intermediary contract.
- H3 supports 5-15 seconds and 2K delivery. A 4-second request cannot select H3; the
  UI disables that combination instead of silently changing duration. First/Last
  Frame disables generated or reference audio when the intermediary contract
  requires it.
- Unsupported combinations are disabled before quote creation and are revalidated by
  the server before a hold is created.
- Placeholder or unverified routes such as zero-priced Seedance 2.5 entries are never
  exposed.

## 9. Provider Architecture

### 9.1 Catalog and adapters

One server-side registry owns product IDs, routes, credentials, capabilities, polling
intervals, cost snapshots, point SKUs, concurrency, and release gates. The frontend
does not duplicate model or price constants.

Provider adapters convert the normalized task contract to route-specific payloads and
normalize task status and output delivery. Seedance and H3 may share an OpenAI-style
transport, but they retain separate capability validation and credentials.

Every job persists at least:

- public product ID;
- provider route ID;
- provider task ID;
- capability/pricing snapshot version;
- quote and hold IDs;
- mode, delivery settings, references, and audio choice;
- terminal output or persistent failure state.

Historical jobs keep their original snapshot even after catalog changes.

### 9.2 Routing and reliability

- Default per-user active-job limit remains two.
- Initial provider concurrency is two for Seedance and one for H3, configurable only
  through validated runtime settings.
- Queue selection is owner-fair so one user cannot monopolize a provider.
- Polling is provider-specific and never faster than the documented safe interval.
- Retryable transport failures continue polling the same accepted task.
- Equivalent fallback is allowed only before an upstream task ID exists and only when
  capabilities and the locked customer price remain valid.
- Once a provider task ID exists, the application never submits the job to another
  route automatically.
- Recent terminal outcomes feed a bounded circuit breaker. After at least five
  accepted jobs, the circuit opens on three consecutive provider failures or a
  provider-failure rate of at least 50% across the latest 20 terminal jobs. The
  cooldown is 15 minutes, followed by one half-open probe. An unhealthy product is
  removed from new quotes while accepted jobs continue recovery.

### 9.3 H3 release gate

`minimax_h3_2k` remains `public:false` until all conditions pass:

1. Runtime credential is configured through the production secret path.
2. Capability probe succeeds without exposing the credential.
3. At least three real canaries complete across text, image/reference, and First/Last
   Frame inputs.
4. Every result downloads as non-empty video content and is persisted to a durable
   Shubao URL.
5. Hold, settlement, release, restart recovery, and no-double-submit assertions pass.
6. A 600-second monitored observation window shows no route-level circuit-breaker
   event.

Passing the gate permits an explicitly labeled Beta release; it does not make H3 the
default route.

## 10. Billing and Failure Semantics

- The server derives the SKU from product ID and duration band.
- Quote creation locks product, duration, points, and expiration.
- Job creation verifies the quote, validates capabilities, and creates one hold.
- Points settle only after a valid video is downloaded, atomically persisted, and
  attached to the durable work record.
- Terminal failure releases the full held amount.
- Unknown submission outcome becomes `needs_review`; it is never blindly resubmitted.
- UI failures are persistent and local to the composer. They state whether points are
  held, settled, or released without exposing provider details.

## 11. Credential and Deployment Rules

- Seedance and H3 use separate runtime environment variables.
- Keys never enter source, documentation, tests, generated assets, logs, frontend
  bundles, or Git history.
- Deployment extends the existing secret-update mechanism and preserves encrypted or
  permission-restricted runtime files during release and rollback.
- Logs use product ID, route ID, task ID, latency, status, and redacted error class.
- Production deployment uses only `scripts/deploy-production.ps1` and must retain the
  remote lock, backup, rollback, Canary, billing, health, and public-audit gates.

## 12. Accessibility and Responsive Acceptance

- All selectors use native buttons or form controls with current state exposed via
  ARIA.
- Tooltips are supplementary; every navigation item retains an accessible name.
- Keyboard focus produces the same semantic state as pointer hover without requiring
  pointer movement.
- No text clips, overlaps, or changes container geometry at 390, 768, 1024, 1440,
  1600, and 2048 CSS-pixel viewports.
- Fixed-format cards, thumbnails, toolbar controls, counters, and buttons retain stable
  dimensions during hover, upload, loading, error, and completion states.
- Reduced-motion mode removes decorative movement.

## 13. Verification and Rollout

Implementation follows TDD and is divided into independently reviewable commits:

1. Original asset manifest and home-card contract.
2. Stable side navigation and icon micro-motion.
3. Video product catalog, pricing, capability validation, and persistence migration.
4. Provider adapters, queue policy, circuit breaker, and secure runtime configuration.
5. Video workbench interaction and responsive controls.
6. Free Visual Creation recipe catalog and responsive workbench.
7. Cross-browser visual QA, focused regression, full regression, build, and release.

Before production release:

- Existing competitor-derived files are absent from the build.
- Desktop and mobile screenshots are reviewed for every domain and video mode.
- Pointer, keyboard, upload, menu, quote, insufficient-balance, failure, recovery,
  completion, Canvas handoff, and history flows pass.
- Billing tests prove server-authoritative prices and the margin gate.
- Seedance production Canary completes and settles correctly.
- H3 remains hidden unless its separate release gate passes.
- Production deploy, 600-second Canary, health, public audit, PM2 stability, and lock
  release all complete before the release is reported online.
