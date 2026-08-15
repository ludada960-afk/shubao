# Production Case Publishing and Showcase Refinement Design

Date: 2026-08-15
Status: Approved

## Context

The production homepage already uses real ecommerce generation outputs, but the
second visual review exposed four connected problems:

1. The product-suite composite is square, visually static, and undersized in its
   showcase frame.
2. The try-on workflow banners bake excessive whitespace and duplicated imagery
   into their raster assets.
3. Gallery slides discard stored generation prompts and display generic fallback
   copy, so remix cannot reproduce the case faithfully.
4. Gallery detail preloading covers only the active and next image, causing late
   images to load after the user scrolls to them.

These are treated as one production-case publishing problem. A generated case
must preserve the images, exact prompts, source materials, replay inputs, cover
policy, and generation provenance that made it.

## Goals

- Replace the product-suite hero with a denser 4:3 production-generated composite.
- Show a model's face and the earbuds in the selector preview.
- Recompose both try-on workflow banners to fit their 16:9 frames without baked-in
  blank bands or duplicated image groups.
- Make exact per-output prompts and source materials the source of truth for case
  detail and remix.
- Preload an opened case efficiently without delaying the gallery cover grid.
- Turn the publishing workflow into a reusable project skill and CLI contract.
- Exercise the real production generation path and preserve enough diagnostics to
  investigate failures without issuing duplicate provider requests.

## Non-goals

- AI video features, Canvas interaction, and Canvas rendering are out of scope.
- The generation provider contract is not replaced.
- Existing production cases without provenance are not retroactively fabricated;
  they may keep explicit legacy fallbacks.
- The homepage shell and unrelated visual sections are not redesigned.

## Chosen Approach

Use a manifest-driven publishing pipeline.

Each case manifest is the durable boundary between production generation and the
gallery. It records:

- case identity, title, category, and generation mode;
- source assets and their upload roles;
- every output image with its exact generation prompt and semantic role;
- request key, task ID, quote ID, and stable result URL when available;
- the top-level replay prompt and remix configuration;
- an explicit cover strategy (`mosaic`, `single`, or `auto`).

The homepage catalog consumes the manifest-shaped data rather than rebuilding
prompt semantics from filenames. The importer validates and publishes the same
shape. The skill documents the repeatable authoring, validation, generation,
cover, and verification sequence.

## Visual Design

### Product Suite

The final product composite uses a 4:3 canvas. It keeps the existing pearl-white
and champagne-gold product language but changes the composition:

- four detail panels form a shallow directional fan instead of an upright row;
- the earbud case and loose earbuds overlap the lower foreground at a larger scale;
- light trails reinforce the same direction as the panel tilt;
- the lower-right benefits use compact icon-and-type lockups rather than plain
  text blocks;
- the safe margin is small enough to fill the homepage frame while retaining all
  meaningful content.

The result remains a single zoomable image. The selector preview uses a generated
usage image with a clearly visible face and a worn earbud, not a hand crop.

### Try-on Multi-angle Banner

The 16:9 canvas contains exactly one workflow:

- complete product flatlay at left;
- one broad, editorial curved arrow in the center;
- four full-body result cards opening as a fan at right.

The cards use small rotational offsets, consistent bottoms, visible full outfits,
and no internal white padding. The center card is visually dominant.

### Try-on Reference Banner

The 16:9 canvas contains exactly three stages:

- complete product flatlay;
- a full reference-model image;
- a full generated try-on result.

A compact plus symbol and curved directional arrow separate the stages. Portrait
images fill their frames directly; blurred padding and duplicated background
copies are prohibited.

### Responsive Behavior

Raster compositions retain their native aspect ratios. Desktop fills the available
showcase width; mobile scales the entire composition without cropping, overlaying,
or changing card geometry.

## Data Contract

The minimum case manifest shape is:

```js
{
  id,
  title,
  category,
  prompt,
  sourceAssets: [{ role, url, name }],
  outputs: [{
    id,
    role,
    title,
    prompt,
    url,
    taskId,
    requestKey,
    quoteId
  }],
  cover: { strategy, outputIds },
  remix: { mode, prompt, sourceAssetRoles }
}
```

`outputs[].prompt` is mandatory for newly published production cases. UI copy may
have a separate `description`, but it must never replace the exact prompt.

## Gallery Detail and Remix

The modal builds slides from `outputs`. Slide metadata displays the exact prompt
when present. Legacy cases may use an explicitly labelled description fallback,
but the product-suite case must not use generic text.

`Do the same` hydrates:

- the case replay prompt into the correct generation input;
- product, reference-model, scene, and style materials into their declared upload
  roles;
- the case mode and relevant generation options.

The hydration contract is tested independently of React rendering.

## Loading Strategy

Gallery covers remain the first network priority. No whole-case preload occurs on
the gallery grid.

When a case modal opens:

1. Decode the active image immediately.
2. Start the next image at high priority.
3. Prefetch all remaining case images with a bounded concurrency of two.
4. Deduplicate URLs and reuse an in-memory promise cache across slide changes.
5. Cancel scheduling when the modal case changes; completed browser-cache entries
   remain reusable.

This provides early readiness for scrolling without creating an unbounded request
burst or competing with the initial cover grid.

## Publishing Skill

Create a repository skill for publishing generated visual cases. It will:

1. Collect or resume production generation with stable request keys.
2. Validate output dimensions, URLs, prompts, and provenance.
3. Build a manifest with exact per-output prompts and source roles.
4. Choose `mosaic` for declared suites and `single` for small cases; `auto` may use
   an output-count threshold as a fallback.
5. Import catalog data and deterministic cover assets.
6. Verify case detail, remix hydration, and image loading behavior.

The existing ecommerce importer and production-generation script are extended to
implement this contract. The skill does not duplicate those mechanisms.

## Reliability and Diagnostics

- New production generation uses a unique deterministic request key.
- A timeout never triggers a blind duplicate request; status is reconciled first.
- Task ID, quote ID, stage, elapsed time, stable URLs, and validation failures are
  written to the local audit manifest.
- Publishing fails closed when a new output lacks its exact prompt or required
  source role.
- Existing successful stage-one earbud outputs may be reused; the new 4:3 final
  composition and face-forward usage result still exercise production generation.

## Testing

Tests are written before implementation for:

- manifest validation and exact prompt preservation;
- slide construction using `output.prompt`;
- remix hydration of prompt and source materials;
- cover strategy selection for suites versus small cases;
- bounded, deduplicated modal preloading;
- 4:3 product and 16:9 try-on asset contracts;
- no blurred padding or duplicate workflow groups in banner composition inputs;
- generation payload ratio, request keys, and prompt requirements.

After unit and contract tests, run the production generation, build the deterministic
banners, inspect desktop and mobile screenshots, run the full relevant test/build
suite, deploy through the isolated production script, and repeat smoke and visual
acceptance checks on `https://shuimg.cn`.

## Rollback

The previous image paths and catalog objects remain in Git history. Rollback is a
normal code revert plus deployment; production generation tasks are immutable
audit records and do not need deletion.
