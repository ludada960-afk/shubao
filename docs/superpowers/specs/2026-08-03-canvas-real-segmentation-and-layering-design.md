# Canvas Real Segmentation And Automatic Layering Design

**Date:** 2026-08-03
**Status:** Approved by the user after direct comparison with `https://liuyingai.cn/canvas-studio`

## Problem

Canvas currently treats semantic descriptions as if they were editable layers. The server asks a vision model for names such as "商品主体" and "背景", then applies `segmentUniformBackground`, which only separates a corner-consistent light or solid background. The UI stores those results in a layer-workbench panel and asks the user to choose or convert a layer. Complex ecommerce scenes therefore expose controls without producing the real movable pixels shown by the reference product.

Background removal has the same limitation when `REMOVE_BG_KEY` is absent. The local flood-fill fallback cannot understand that all three containers in the supplied image form the merchant's product subject, so it cannot satisfy the requested general-scene behavior.

## Product Contract

### Remove background

- The command runs immediately from the selected image. It does not create a configuration form.
- The result preserves the original pixels of every detected merchant-product instance and removes all non-product pixels.
- Multiple instances of the same product remain together in one transparent PNG. The supplied three-container image must retain all three containers.
- The result is a normal connected image node with tight visual bounds, transparency, drag, resize, derivation and export support.
- The service never reports success when it only copied the source or produced an empty/near-empty mask.

### Smart layering

- The command runs immediately and never asks the user which layer to create.
- It automatically materializes useful child nodes on the canvas instead of creating a layer-workbench form.
- The output set contains, when actually detected:
  - one grouped transparent product layer;
  - one transparent layer for each independent product instance;
  - one background clean plate with detected products and text removed;
  - editable text nodes for OCR blocks;
  - optional non-product visual elements only when confidence and area thresholds are met.
- Every child is connected to the source, can be dragged independently and retains normalized source bounds for later recomposition or PSD export.
- Duplicate, nested and low-confidence masks are removed. A group layer and its valid independent instances may coexist because they serve different editing workflows.
- Smart layering may return a partial success only when it names the omitted capability. It must not invent an editable layer from a semantic label without pixels or OCR geometry.

## Architecture

### Semantic plan

The existing ecommerce VLM produces a bounded JSON plan before segmentation:

```js
{
  productGroup: { name, box: [x, y, width, height] },
  instances: [{ id, name, kind: 'product' | 'visual', box, confidence }],
  textBlocks: [{ id, text, box, color, background, confidence }]
}
```

Coordinates are normalized to `0..1`. Validation rejects out-of-range boxes, empty labels, excessive counts and product instances that do not overlap the product group. The VLM decides merchant semantics; it does not create masks.

### Instance segmentation

`fal-ai/sam-3/image` is the primary production mask provider. It receives the owned source image plus the validated product boxes and returns scored masks. The server uses direct authenticated HTTP with `FAL_KEY`; the key never reaches the browser or Git. Provider URLs are downloaded through bounded, timeout-controlled reads before persistence.

The provider boundary is an injected interface so route tests use deterministic fixtures and a future provider can be substituted without changing Canvas. `REMOVE_BG_KEY` remains a whole-foreground fallback. `segmentUniformBackground` remains a final safe fallback only for images it can prove have a reliable uniform border.

### Pixel processing

Sharp converts every accepted mask into source-sized single-channel alpha. The layer service:

1. validates dimensions and non-empty coverage;
2. removes tiny islands and masks touching implausible image areas;
3. deduplicates masks using intersection-over-union and containment thresholds;
4. composites original RGB pixels with the accepted alpha;
5. crops transparent assets to their tight bounding boxes while preserving normalized source bounds;
6. unions product-instance masks for the grouped product asset.

This keeps products pixel-faithful. Generative image output is never used for product layers.

### Background clean plate

The background layer is the only layer allowed to use generative reconstruction. The existing GPT Image 2 edit gateway receives the source plus the union mask and a constrained instruction to remove only the masked products and visible text while preserving composition, lighting and all unmasked pixels. If clean-plate generation fails, Smart Layering returns product and text layers with an explicit `backgroundUnavailable` capability; it does not return a holed image as a complete background.

### Text

OCR uses the existing signed ecommerce VLM path. Each accepted block becomes a normal Canvas text node, not an image-only row in an inspector. Position, approximate size, alignment and sampled foreground/background colors are retained. OCR confidence or geometry below the threshold is omitted rather than represented as editable text.

## API Contract

`POST /api/remove-bg` keeps its existing request shape and returns:

```js
{
  url,
  result_url: url,
  method: 'sam3' | 'remove-bg' | 'uniform-border',
  subjectCount,
  bounds,
  billing
}
```

`POST /api/canvas/analyze-layers` becomes the automatic layering operation and returns:

```js
{
  status: 'complete' | 'partial',
  layers: [{
    id,
    kind: 'image' | 'text',
    semanticType: 'product-group' | 'product-instance' | 'background' | 'text' | 'visual',
    name,
    url,
    text,
    bounds,
    confidence,
    editable: true
  }],
  capabilities: {
    movableLayers: true,
    productGroup: true,
    productInstances: number,
    backgroundCleanPlate: boolean,
    editableText: number,
    psdExport: boolean
  },
  warnings: []
}
```

Both routes stay behind signed owner authentication, generation rate limits, asset ownership checks and one-shot billing/idempotency. Provider failures release reserved billing according to the existing ledger policy. Logs record provider, duration, mask count and non-secret failure codes only.

## Canvas Interaction

`智能分层` no longer creates `layer-workbench`. The selected source enters a non-blocking processing state, then all successful layers are laid out to its right with stable gaps and source connections. Image nodes use each asset's tight aspect ratio without white gutters. Text layers use the normal text-node component. Selection and dragging use existing Canvas behavior.

`去除背景` keeps the existing connected-output interaction but sizes the output from returned bounds. Both commands are disabled while the same source/action request is active, and retry reuses the logical request key.

Existing saved `layer-workbench` nodes remain readable for compatibility, but new actions never create them.

## Failure Handling

- Missing `FAL_KEY` in production is a configuration error, not a fake success. Safe remove.bg or uniform-background fallback may still complete background removal.
- Smart layering without a real mask provider returns an actionable unavailable error because semantic names alone are not layers.
- Empty masks, masks over 98% of the image, product unions below 0.5% coverage and provider/source dimension mismatches fail validation.
- A failed clean plate does not discard valid product or text layers.
- A failed individual instance does not discard the valid grouped product layer.
- No external provider response URL is sent directly to the browser; every accepted asset is copied into `generatedAssetStore`.

## Verification

### Automated

- Unit tests cover semantic-plan validation, coordinate conversion, mask normalization, IoU deduplication, union, cropping and empty-mask rejection.
- Provider tests mock SAM 3 success, timeout, malformed output and partial mask sets without real charges.
- Route tests prove signed ownership, billing release/settlement, stable persisted URLs and truthful capability flags.
- Canvas tests prove no workbench node is created, automatic child nodes and edges appear, text is editable, output geometry matches bounds and retry is idempotent.
- Existing remove-background, OCR, PSD, generation-composer and image-mention contracts remain green.

### Real acceptance

Using `codex-clipboard-4b6d1734-6028-42de-b8e2-9f2326fcf643.webp`:

- Remove Background returns one transparent image containing all three containers and no table, plate, fork or caption card.
- Smart Layering returns a grouped three-container layer and three independently draggable container layers.
- It returns the background clean plate when the edit provider succeeds.
- It returns editable caption text for `三色盖子可选择` when OCR confidence is sufficient.
- Every returned image asset decodes, has non-zero alpha, uses tight bounds and remains available after a full Canvas save/reload.

Desktop and mobile browser QA checks loading, partial failure, retry, delete, drag, resize, connection geometry and the absence of overlapping controls or stale workbench panels.
