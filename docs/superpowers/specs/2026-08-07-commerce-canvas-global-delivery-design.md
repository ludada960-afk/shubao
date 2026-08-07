# Commerce Canvas Global Delivery Design

## Goal

Unify the ecommerce planning, generation, canvas, export, and quality-control paths so the product behaves as one coherent workflow instead of a set of partially connected features.

## Decision: Keep The Existing Canvas Engine

The current canvas already implements viewport transforms, node dragging, marquee geometry, multi-selection, connections, layer materialization, persistence, and generation state. The reported arrow/hand bug is caused by the pointer-intent reducer mapping the default select action to `pan`; it is not an engine capability gap.

Replacing the engine now would require simultaneous migration of node persistence, connectors, generation status, segmentation, layer editing, project recovery, and browser QA. That produces a larger regression surface without solving the underlying business-contract problems. This release keeps the current engine and extracts the missing contracts into focused pure modules. A future engine migration remains possible behind those contracts.

## Global Contracts

### Canvas Interaction Contract

- `select` uses the normal pointer cursor.
- Dragging blank canvas in `select` starts a marquee selection without a modifier.
- Clicking blank canvas clears selection.
- `Shift + click` toggles a node in the current selection.
- Holding Space or using the middle mouse button temporarily pans while `select` remains active.
- `hand` always pans with a grab/grabbing cursor and never starts a marquee.
- The select tool tooltip and empty-selection hint state `拖拽框选，Shift+点击多选`.

### Canvas Density Contract

- Canvas controls use shared density tokens instead of per-component guessed widths.
- Action text is at least 12px with a 30-32px stable control height.
- Node title text remains readable at 12px or greater; metadata is at least 10px.
- Media footers size to content and do not reserve a 48px empty area.
- Multi-selection actions wrap or scroll within the viewport and do not use a fixed 680px panel width.
- Icon buttons have tooltips and accessible names.

### Asset Provenance Contract

Every canvas asset resolves to one provenance value:

- `source`: user uploads and external references.
- `generated`: model-generated deliverables.
- `derived`: deterministic transformations of generated or approved source assets.
- `composition`: canvas-only editable compositions.

Normal ecommerce delivery exports include only `generated` and `derived`. Source assets are never included by a broad URL filter. Existing saved projects are normalized from `sourceRole`, `kind`, generation metadata, and group information without rewriting user data.

### Long Detail Contract

- `合成长图` replaces the ambiguous multi-selection `合并图层` action for eligible detail outputs.
- Arbitrary visual compositing remains a separate `合成画面` command and is not shown as a detail export setting.
- Long-image candidates must be deliverable detail outputs.
- Order uses explicit plan/shot sequence first. If sequence is absent, nodes are clustered into visual rows and sorted top-to-bottom, then left-to-right within each row.
- The export modal presents an ordered thumbnail list that can be reordered before confirmation.
- Images are resized to one width while preserving aspect ratio and stitched vertically with no gaps.
- The operation keeps the source slices and creates one derived `详情长图` node.

### Export Contract

- Opening export never starts a download.
- The modal reports exactly how many deliverables will be exported and how many source assets were excluded.
- `逐张图片` writes image files to a user-selected directory through `showDirectoryPicker` when supported.
- `详情长图` writes one file through `showSaveFilePicker` when supported.
- Unsupported browsers fall back to one image-only ZIP for multiple files or one normal download for a single file.
- JSON manifests are not included in the normal UI or default package.
- Alignment controls are absent from long-detail export.

### Commerce Fact Contract

- Product truth remains the only source of exact commercial claims.
- A frame that presents two or more variants must include deterministic labels or a comparison matrix built from confirmed variant facts.
- Useful fields include variant name, dimensions, capacity, material, finish, color, weight, compatibility, pack quantity, and care information when confirmed.
- If variants do not have confirmed differentiating facts, the planner must not invent them and must not request an unlabeled multi-variant comparison.
- When at least two confirmed variants exist, one requested detail slot is assigned the `variant_comparison` duty; total requested image count and billing do not increase.
- Step-two direction cards, the confirmed asset plan, generated canvas nodes, and export labels all display the same role and ratio metadata.

### Catalog Isolation Contract

- White-background and transparent-background roles override campaign lighting, style presets, and generic shadow instructions.
- White-background deliverables use pure white, no cast/contact shadow, no floor line, no gradient, no props, complete product, and safe edge clearance.
- Transparent deliverables use real alpha, no shadow pixels, no matte halo, no jagged edge, complete product, and safe edge clearance.
- A preflight classifier identifies already-compliant white-background uploads. Those assets use deterministic passthrough resize/format processing and skip generative editing.
- Non-compliant isolation images receive the smallest necessary correction instead of a full creative restyle.
- Quality gates detect shadow contamination, alpha fringe, edge clipping, and insufficient subject clearance.

### Detail Ratio Contract

- New detail screens default to `9:16` in direction planning, plan confirmation, generation requests, canvas metadata, and export metadata.
- Model routing selects a provider-supported 9:16 resolution. A nominal 1K request is promoted to the smallest supported 9:16 tier instead of silently falling back to 3:4.
- Existing projects retain their saved ratio until regenerated.
- Long-detail output height remains content-driven.

## End-To-End Flow

1. Product truth records confirmed product and variant facts.
2. Step two proposes directions and a shot plan using 9:16 detail roles, including a fact-gated variant comparison when applicable.
3. Confirmation produces generation assets with stable role, sequence, ratio, and provenance metadata.
4. Prompt compilation applies commerce facts and the catalog isolation override before provider routing.
5. Generated and deterministic outputs enter Canvas with the same metadata shown in step two.
6. Canvas selection semantics choose nodes; export eligibility resolves from provenance.
7. Detail outputs can be reordered and stitched into a derived long-detail image.
8. The user chooses a filesystem destination only after confirming export.
9. Quality and browser regression gates must pass before deployment.

## Compatibility And Migration

- Existing nodes are normalized at read time; persisted schemas remain backwards compatible.
- Existing `merge-layers` action identifiers may be accepted as an alias during hydration, but new UI and persisted actions use the new explicit semantics.
- Saved 3:4 detail nodes remain viewable and exportable.
- File System Access API use is feature-detected and has a single-download fallback.

## Verification Gates

- Unit tests cover pointer intent, cursor state, modifier behavior, provenance normalization, export eligibility, visual ordering, save strategy, ratio routing, variant comparison, and isolation prompts.
- Image fixture tests verify stitched order, common width, height sum, and seam-free output.
- Contract tests verify step-two direction data matches canvas node metadata.
- Full test suite and production build pass.
- Playwright desktop and mobile passes verify marquee selection, hand panning, Shift multi-select, compact toolbars, export modal contents, reorder behavior, and no overlapping controls.
- Production smoke verification passes after deployment.

