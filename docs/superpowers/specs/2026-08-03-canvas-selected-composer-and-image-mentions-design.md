# Canvas Selected Composer and Image Mentions Design

**Date:** 2026-08-03
**Status:** Approved through the user's detailed interaction requirements and verified against `https://liuyingai.cn/canvas-studio`

## Problem

Canvas currently renders text, image, and ecommerce generation composers as the node body. Creating a node therefore opens a large form immediately, multiple forms remain visible, and close controls delete or fail to dismiss the wrong thing. Image references are displayed as `@图片N` in places, but the interaction is not a shared structured reference contract.

The reference product was exercised in the signed-in browser. Its behavior is consistent across all three node types: creation adds only the content object, selection reveals one contextual composer below that object, deselection leaves only the object, and deriving from an image preselects that image as `@图片1`.

## Interaction Model

Canvas has exactly one selected object surface. A generation node has two independent presentations:

1. **Node body:** persists in the world, participates in drag, resize, selection, connections, save and restore.
2. **Selected composer:** appears only for the single selected generation node, is positioned below it, and does not change the node's world bounds.

Clicking blank Canvas or another node dismisses the composer without deleting the node. The composer has no close button because selection is the visibility authority. Delete remains an explicit object-toolbar command.

### Text node

- The body is an editable text document with the existing rich-text toolbar.
- Double-click edits the document directly.
- Selection reveals a text creation composer for prompt, image references, quantity and submit.
- Generated copy is written back into the same text node. It does not create a second mandatory result box.
- A text node may be used as an ordinary note without ever submitting AI generation.

### Image generation node

- Before generation the body is a neutral image placeholder.
- After generation the body is the generated image itself and adopts the output aspect ratio without outer white gutters.
- Selection reveals reference images, prompt, ratio, quality, quantity, mention picker and submit.
- The product exposes no model selector. The request always routes through GPT Image 2.
- Local edit additionally offers whole image, rectangular region and subject targeting. The selection is structured request data.

### Ecommerce suite node

- Before planning the body is a design-plan placeholder.
- After planning it displays the selected direction and plan summary.
- Selection reveals the commerce inputs reused from the homepage: product and reference image roles, prompt, target platform, output plan, ratio, quality, language and quantity.
- Submit first requests design directions. The user selects a direction before suite generation begins.

## Independent And Derived Creation

- The left add menu creates an independent node with no image references.
- An image's right-side derivation menu creates the same node type and the same selected composer, but adds a derived connection and structured reference to the source image.
- The first source is labelled `@图片1`; later ordered references use `@图片2`, `@图片3`, and so on.

## Structured Image Mention Contract

An image mention is data, not decorated prompt text:

```js
{
  sourceNodeId: 'image-node-id',
  assetId: 'owned-asset-id',
  url: '/stable-owned-asset',
  label: '@图片1',
  role: 'product' | 'reference'
}
```

- The UI derives labels from stable ordered source IDs and inserts/removes references through a shared picker.
- Prompt text may contain the display labels, but generation requests are assembled from the structured ordered reference list.
- Canvas image generation passes the first referenced image as the edit/product image and remaining images as ordered `reference_images`.
- Text generation receives the same ordered visual context through the visual text endpoint. If that endpoint cannot accept images, the client must not claim image understanding.
- Ecommerce generation preserves product/reference roles rather than flattening all inputs.
- Server-side ownership validation remains authoritative for every asset URL or asset ID.

The shared mention picker is reused anywhere the application already owns an image set: homepage ecommerce, Xiaohongshu/Plog, ecommerce direction supplements and Canvas composers. It references only images already present in that surface; upload remains a separate role-aware action.

## Visual Contract

- Composer width is responsive and anchored beneath the selected object.
- Upload cards reuse the homepage's image card proportions, remove control and role labels.
- Controls are aligned in one footer row when space permits and wrap without overlap on narrow viewports.
- Ratio uses a visual ratio/quality popover; quality options are the existing `1K`, `2K`, and `4K` values.
- Buttons use existing Lucide icons. Image and text content never resize because a composer opens.
- Fixed dimensions and `aspect-ratio` prevent hover, labels and loading states from shifting the layout.

## Persistence And Compatibility

Existing saved `image-composer`, `text-composer`, and `suite-composer` nodes are normalized into the new body geometry on load. Prompt, sources, generation status and directions are retained. Composer visibility is never persisted because it is derived from current selection.

## Acceptance

- Creating each generation type shows only its body.
- At most one selected composer is visible.
- Deselecting never deletes content; delete removes the node and its edges.
- Derived creation preselects the source image as a real ordered reference.
- Image output has the correct aspect ratio and no surrounding gutters.
- No image model selector is visible.
- Quality, ratio, quantity and `@` references reach generation requests.
- Ecommerce planning and suite generation remain two separate steps.
- Canvas save/restore preserves node content and structured references.
- Homepage, Xiaohongshu/Plog and direction supplements use the same reference-picker semantics.

