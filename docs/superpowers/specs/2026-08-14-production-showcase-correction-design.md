# Production Showcase Correction Design

## Goal

Correct the homepage showcase so every case communicates the actual production workflow, uses complete media, and preserves one coherent visual system across ecommerce and visual creation.

## Non-negotiable Contracts

1. `product-suite`, `tryon-angles`, and `tryon-reference` may only use assets returned by ShuBao production tasks. Each catalog entry stores its task and request identifiers.
2. Source product, outfit, and model media must be the complete uploaded image. A crop, montage, or generated result cannot be relabelled as a source asset.
3. Showcase cards preserve each image's natural aspect ratio. The card is sized from the asset, uses `object-fit: contain`, and may not introduce letterboxing inside a second fixed-ratio frame.
4. Ecommerce showcase and composer surfaces share one continuous left-to-right warm gradient. Copy and media do not receive separate background layers.
5. The four visual-creation showcase stages use one common outer size. Mode-specific layouts only rearrange media inside that stage.

## Ecommerce Layout

### Ability selector

- Restore a compact navigation-control height.
- Use a wide 16:9 thumbnail occupying no more than 42 percent of each control.
- Compose three production-derived cards into a restrained fan. The thumbnail supports the label and never becomes a second showcase.
- Product-suite and try-on thumbnails are independent assets and never reuse the lower showcase composition verbatim.

### Product suite

- Subject: unbranded pearl-white wireless earbuds with champagne-gold metal details.
- Production prompt locks shape, materials, color, product count, and readable product hierarchy before defining scene and layout.
- Output set communicates one coherent ecommerce campaign: clean hero, lifestyle benefit image, acoustic/detail visual, and premium usage scene.
- Stage layout uses one dominant hero and three supporting panels, inspired by the user-supplied reference while avoiding copied branding or text.

### Anything try-on

- Slide A: complete outfit flatlay, then four complete model views. Results show front, three-quarter, side, and back views with consistent garment identity.
- Slide B: complete outfit flatlay plus complete reference model, then a complete full-body fashion result.
- The workflow symbols remain between input and output, but the media uses a dynamic fan/editorial arrangement instead of equal rigid columns.

## Visual Creation Layout

- Common stage height is fixed across free creation, poster, social cover, and brand visual.
- Social slide A places a dominant vertical Xiaohongshu card with two enlarged landscape cards tightly stacked beside it.
- Social slide B mirrors the structure: two landscape cards on the left and one dominant vertical card on the right.
- Free, poster, and brand use asymmetric editorial layouts derived from each asset ratio rather than three equal cards.
- Only the active slide is eager-loaded. The next slide is prefetched after the active images decode; inactive images remain lazy.

## Validation

- Catalog tests reject ecommerce entries without production task provenance.
- Component tests assert compact selector structure, complete input roles, common visual-stage contract, and keyboard image preview.
- Browser QA covers desktop and 390px mobile, verifies decoded images, no blank placeholders, no clipping, no horizontal overflow, and equal visual-stage dimensions.
- Deployment uses `scripts/deploy-production.ps1`, followed by public health, audit, production generation, and canary verification.
