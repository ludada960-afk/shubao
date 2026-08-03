# Canvas Browser Segmentation Design

**Date:** 2026-08-03
**Status:** Approved by the user
**Supersedes for new releases:** The fal.ai segmentation boundary in `2026-08-03-canvas-real-segmentation-and-layering-design.md`

## Goal

Keep the existing automatic Canvas background-removal and smart-layering product contract while removing the paid segmentation dependency. Product masks are computed on each user's device with a pinned U2NetP ONNX model. The server remains authoritative for product-instance detection, billing, mask validation, owned asset persistence, background reconstruction and text layers.

## Product Contract

- `去除背景` keeps every detected merchant-product instance and returns one connected transparent image node.
- `智能分层` automatically creates a grouped product layer, independent product-instance layers, a background clean plate when available and editable text nodes.
- The user never chooses semantic layers in a form. A semantic label without a validated pixel mask is not presented as a layer.
- The source image and every output remain in the existing owned-asset and Canvas save/reload workflow.
- The segmentation step has no provider call or per-image segmentation fee. Existing VLM detection and optional background reconstruction costs remain unchanged.

## Browser Runtime

- Model: U2NetP ONNX, pinned under `public/models/`, Apache-2.0.
- Runtime: ONNX Runtime Web WASM, pinned through the npm lockfile, MIT.
- Execution: one dedicated Web Worker with one WASM thread. The main thread never performs model inference or pixel loops.
- Input: the source image is fetched through the existing same-origin image proxy and decoded in the Worker.
- Strategy: the server returns one padded crop prompt for every VLM-detected product instance. The Worker runs U2NetP on each crop rather than on the entire ecommerce poster. This prevents captions, plates and broad scene background from entering the product mask and preserves multiple products.
- Output: one 320x320 grayscale PNG mask per signed prompt. The browser does not create final product assets.

The Worker fetches the model with `cache: 'force-cache'`, streams bytes when possible and reports actual downloaded bytes. HTTP cache handles repeat visits. A small singleton controller prewarms the model after Canvas becomes idle and shares the warm session across Remove Background and Smart Layering.

## Loading Experience

Processing is shown in a contextual transient card beside the source image. It is React-only state and is never added to persisted Canvas nodes.

Stages are monotonic and tied to real work:

1. `准备智能抠图组件` - model download bytes and session initialization;
2. `识别商品` - server semantic-plan request;
3. `提取商品 N/M` - completed crop inferences;
4. `生成透明图层` - signed mask upload, server validation and owned-asset creation.

During a cold start the card may show that the component is being prepared once. Cached starts skip download wording. Cancel stops later crop work and ignores the current inference result; retry reuses the warm Worker and requests a fresh short-lived plan. Success removes the card automatically. Failure retains a compact error card with retry and close commands.

## Signed Plan Boundary

`POST /api/canvas/segmentation-plan` receives an owned image URL and returns:

```js
{
  source: { width, height },
  prompts: [{ id, name, box: [xMin, yMin, xMax, yMax] }],
  textBlocks: [],
  planToken,
  expiresAt
}
```

The server obtains the semantic plan with the existing ecommerce VLM, normalizes it and calculates bounded padded pixel crop boxes. It signs owner email, normalized image URL, source dimensions, prompts, text blocks and expiry with `AUTH_SESSION_SECRET`. The token expires quickly and is size/count bounded. It contains no provider secret.

The existing final routes accept `segmentation_plan_token` and `segmentation_masks` in addition to their billing identifiers. A mask entry contains only a prompt id and PNG data URL. The server ignores client geometry and expands each crop mask according to the signed prompt box. Missing, duplicate, oversized, malformed, nearly empty or nearly full masks fail closed.

## Server Pixel Processing

`canvasLayeringService` is split into two phases:

- `createSegmentationPlan({ imageUrl, ownerEmail })` reads and normalizes the source, invokes the VLM and creates signed crop prompts.
- `removeBackground` and `createLayers` consume the verified plan plus browser masks.

Sharp resizes each crop mask to its signed crop rectangle, embeds it into a source-sized grayscale canvas, removes small islands, validates coverage and deduplicates overlaps. The existing original-pixel compositing, group union, tight crop, text-node and background-clean-plate behavior then runs unchanged.

fal.ai is removed from runtime construction and production deployment requirements. `REMOVE_BG_KEY` and uniform-border detection remain explicit fallback paths only for legacy direct requests that do not provide browser masks; they are never reported as U2NetP results.

## Security And Limits

- All three routes require the existing signed ecommerce owner session and rate limits.
- Plan tokens are owner-bound, source-bound, HMAC-signed and short-lived.
- Maximums: 8 product prompts, 20 text blocks, 1 MiB per mask, 6 MiB total JSON mask payload.
- Only PNG data URLs are accepted for masks. Geometry always comes from the signed token.
- Final billing settles only after owned assets exist. Planning is authenticated and separately rate-limited to limit unpaid VLM abuse.
- Logs include stage, duration, prompt count and non-secret error code only.

## Compatibility

- `/api/remove-bg` and `/api/canvas/analyze-layers` keep their response shapes.
- Existing saved workbenches remain readable, but no new action creates one.
- An old client without browser masks may use the existing safe fallback behavior; Smart Layering returns an unavailable error rather than semantic-only fake layers.
- Browsers without Worker, WebAssembly, OffscreenCanvas or createImageBitmap receive a clear unsupported error and can retry in a supported browser.

## Verification

- Unit tests cover plan signing, owner/source/expiry validation, crop-box padding, crop-mask expansion, count/size limits and incomplete-instance rejection.
- Worker-facing pure tests cover preprocessing, monotonic progress, cancellation and response correlation.
- Route tests prove final billing, no FAL construction, and no client-controlled geometry.
- Canvas tests prove the progress card is contextual, transient, cancellable, retryable and absent from persisted nodes.
- A real Chromium acceptance uses the supplied three-container image and checks that Remove Background retains all three products while excluding the scene and caption, and that Smart Layering creates three independently movable product nodes.

