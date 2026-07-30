# Commerce Canvas and Image Delivery Redesign

## Goal

Rebuild the product image delivery and commerce canvas experience so generated
assets load predictably, canvas interaction remains responsive, work is not
lost on navigation, and image generation is arranged into an intelligible
e-commerce suite.

## Product Decisions

### Image delivery

Every image is delivered by an explicit variant rather than by an original
asset URL in a list or canvas card.

| Surface | Variant | Contract |
| --- | --- | --- |
| Work and case grids | `thumb` | WebP, small, lazy loaded |
| Canvas cards | `canvas` | WebP sized for the on-screen node |
| Inspector and lightbox | `full` | Original-quality delivery |

The server owns derivative generation, cache keys, concurrent request
coalescing, cache headers, and safe external-source proxying. The client owns
responsive selection, aspect-ratio placeholders, decode scheduling, and
viewport-based prefetching. A stable local generated asset must never make a
round trip through the external-image proxy.

### Canvas core

The hand-rolled DOM measurement loop is replaced by a model-driven canvas
renderer. Node rectangles and port positions are source-of-truth geometry;
edges are derived synchronously from those values. Pointer movement is batched
to animation frames and visual node movement cannot wait for an asynchronous
`ResizeObserver` pass.

The implementation may use a dedicated node-editor core where it improves
correctness, while e-commerce nodes, generation actions, credit behavior, and
existing server contracts remain project-owned. Node presentation is memoized
and selection/hover state is isolated from node content state.

### Canvas entry and navigation

An empty canvas gives one clear first action: add material. The import sheet
offers `My works` and `Upload from device` and asks the user to assign a source
role:

- Product original: eligible to begin e-commerce creation.
- Style reference: can influence appearance but is not presented as the sold
  product.
- General material: stored and usable in compatible editing actions only.

This prevents an arbitrary upload from being silently treated as a product
truth source. Existing works can be imported directly from this same entry
surface.

### Canvas visual and interaction model

- Blank state: centered, concise material-import affordance and double-click
  shortcut.
- Nodes: preserve media aspect ratio with an uncropped contained preview;
  node shells carry title, role and status outside the image area.
- Layout: source material starts at the left. Results use horizontal role
  lanes: main images, detail images, SKU/variants, and utility assets.
- Edges: no default textual labels. The selected edge may show a compact
  relation chip. Edge endpoints stay attached while dragging and resizing.
- Focus: hovering a node highlights it and its immediate ancestry/descendency;
  unrelated nodes and edges become visually quiet.
- Commands: left-click selects, right-click opens a compact contextual menu,
  and double-click opens full inspection. Contextual toolbars expose only
  actions supported by this product.
- Generation: an action opened from a node is a downstream work card with
  draft, running, review, completed, and retry states. It replaces the generic
  corner popover.

### Persistence

Canvas changes write immediately to local draft storage and are debounced to a
versioned server session. Entering a canvas restores node positions, viewport,
connections, selection-independent workflow state, and imported material.
Starting a new canvas is explicit and cannot silently replace a draft.

### Generation quality and failures

The quality gate remains a protection rather than a reason to hide an image or
show a raw provider failure. The UI presents one of the following actionable
states: completed, reviewing, needs revision, retry available, or temporarily
unavailable. Provider error payloads, credential details, and stack traces are
logged only on the server. The user receives safe Chinese guidance and an
operation identifier only when support needs it.

The e-commerce image recipe is deterministic and testable:

1. Confirmed product facts and source constraints.
2. Asset role and commerce duty (main, detail, SKU, transparent, white
   background, etc.).
3. Channel specification, ratio, composition, and lighting.
4. Diversity plan across the suite.
5. Explicit preservation and negative constraints.
6. Quality assertions and transparent recovery behavior.

Generic open-source image workflows and prompt collections may inform these
constraints, but no external runtime is introduced as the production commerce
engine and no third-party UI, assets, or source code is copied.

## Interfaces and Boundaries

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| Image delivery service | Variants, cache, source validation, transformations | Sharp, generated asset store |
| Image view helpers | URL selection, placeholders, lazy/decode policy | Delivery endpoints |
| Canvas geometry model | Node rectangles, ports, lane layout, edges | Canvas session state |
| Canvas UI | Interaction and contextual surfaces | Geometry model, workflow actions |
| Canvas draft repository | Local immediate persistence and remote version sync | API client |
| Generation presentation mapper | Safe user-facing task state | Server generation responses |
| E-commerce recipe policy | Planning and quality constraints | Existing engine facts and roles |

## Acceptance Criteria

1. A 24-node canvas can drag selected nodes without a visible endpoint gap;
   edge geometry updates in the same frame as node geometry.
2. Work grids, case grids, and canvas cards request thumbnail/canvas variants,
   lazy-load non-visible media, and maintain aspect-ratio layout before image
   decode completes.
3. A source card with several output types arranges results by horizontal
   category lanes and preserves each asset's aspect ratio.
4. Double-clicking a media node opens an inspectable full-size view.
5. Canvas state survives a navigation away and back without an explicit manual
   save.
6. The UI never renders `undefined`, raw provider credentials, provider JSON,
   or API stack traces.
7. A failed quality review is recoverable and comprehensible, without being
   misrepresented as a completed asset or silently charged.
8. Automated model, API, component, interaction, and visual checks pass at
   desktop and mobile viewports before production deployment.

## Non-goals

- Adding video generation, generic workflow automation, or unsupported media
  types merely to match a reference canvas.
- Replacing the current commerce generation backend with a generic external
  workflow runtime.
- Reusing a competitor's source code, branding, or assets.
