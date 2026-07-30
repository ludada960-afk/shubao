# Commerce Suite and Canvas Production Closure

**Status:** Approved by the product owner on 2026-07-31 for autonomous implementation through production deployment.

## Objective

Close the remaining gap between the current ecommerce generator and a commercial seller-facing product. A seller must be able to provide one trusted product image and one sentence, receive a complete differentiated ecommerce suite, and continue editing it in a fast persistent canvas without seeing internal model, quality-gate, or provider failures.

## Research Basis

The implementation is based on observed behavior from Liuying AI and BigBong canvas sessions, the public GPT Image prompt libraries already referenced by the project, and the existing structured ecommerce engine. We adopt interaction patterns and prompt structure, not competitor source code, brand assets, or unsupported capabilities.

Observed useful patterns:

- A blank canvas presents one central material action and concrete task shortcuts.
- Selection, configuration, and generation controls stay spatially close to the active node.
- Node movement and connected edges update in the same visual frame.
- Context menus are compact; detailed configuration opens only when requested.
- Product generation separates input fidelity, image role, camera, lighting, material, layout, and constraints.
- A suite needs explicit per-image commercial duties instead of repeated stylistic variations.

## Product Model

### Smart-by-default entry

The primary path is one product image plus a short description. Advanced controls remain optional. The six configuration controls show compact, complete summaries and visibly mark user overrides. Restoring the smart plan resets every configurable domain, including SKU data and product information.

The default planner infers a category-aware suite from trusted product evidence. Missing optional facts do not produce empty prompts; unsupported claims, measurements, certifications, detachable parts, or opening states are never invented.

### Suite recipe

Every generated asset follows this contract:

1. Trusted product identity and immutable visible traits.
2. One buyer-facing commercial duty.
3. A role-specific scene, camera, crop, product orientation, and interaction state.
4. Role-specific material and lighting instructions.
5. Explicit allowed inference and forbidden mutation constraints.
6. A Chinese display title, role group, ratio, and pixel dimensions.
7. Automated technical and product-fidelity review.

The suite planner must diversify purpose and camera across assets while preserving product identity. It may show a lid opened, a garment reversed, a shoe worn, or liquid poured only when supported by user facts or source evidence.

### Complete delivery

Quality review is an internal recovery mechanism. A configured suite is not returned as a partial user burden. Failed assets are retried with targeted repair instructions and then, when appropriate, a safer deterministic or identity-preserving fallback. Provider repair cost is not exposed as an additional user charge. Billing settles only for accepted final assets.

When the provider is unavailable after the bounded recovery policy, the whole task remains retryable with preserved inputs and a safe Chinese message. Raw provider payloads, model credentials, and internal rejection language never reach the user.

### Result contract

The final result carries:

- original product assets and supplemental product assets;
- reference assets separately from product evidence;
- complete accepted output assets;
- per-asset `displayName`, `group`, `role`, `ratio`, `size`, `width`, and `height`;
- a stable work/session identity;
- no internal role IDs as user-facing names.

## Canvas Model

### Lanes

The source product group remains visible at the left. Outputs are arranged in independent horizontal lanes in this order:

1. White background
2. Main images
3. Detail images
4. SKU variants
5. Transparent and reusable materials

Cards preserve source aspect ratio with contained media. Lane labels are buyer-facing. Default edges have no text labels.

### Interaction

- Single click selects a node and dragging can begin from the image itself.
- Native browser image dragging is disabled.
- Double click opens the full image inspector/lightbox.
- Right click opens a compact context menu.
- Hovering a node emphasizes it and directly related nodes while dimming unrelated content.
- Node and edge geometry are updated from the same state in the same animation frame.
- Contextual actions appear near the active node and expose only supported ecommerce actions.
- The blank state offers upload and Works import, with clear source-role assignment.

### Persistence and migration

Canvas drafts are schema-versioned. A stale draft cannot replace a newly imported product source or revive obsolete lane geometry. Compatible user node positions and workflow state are preserved; incompatible generated layouts are migrated or rebuilt from the current result contract.

## Image Delivery

All grids and canvas nodes use server-owned variants and stable caching:

- `thumb` for case and Works grids;
- `canvas` for node previews;
- `full` for lightbox and download.

Generated local assets never traverse the external proxy. Derivative requests are coalesced and cached with immutable validators. Layout reserves the final aspect ratio before decode. The canvas preloads only visible or imminent media.

## Gateway Policy

Runtime credentials stay in environment configuration and are never committed. The image provider uses the supplied mainland endpoint with its documented native asynchronous contract: submit JSON to `POST /v1/tasks`, carry product/reference images as URL or data-URI input, poll `GET /v1/tasks/{id}`, and consume final `result_urls`. The supplied US distribution endpoint does not expose this task contract and is therefore not used as automatic overflow; mixing protocols would turn a valid provider outage into an unrecoverable polling failure. The selected image model must first pass a model-list or no-charge compatibility probe, then a real bounded task verification. Vision uses the supplied endpoint and model and must pass an image-input schema probe before production rollout.

## Acceptance Criteria

1. Restoring the smart plan resets sizing, SKU, visual direction, product information, content rules, and generation settings.
2. Every modified configuration control displays a visible override state and a compact meaningful summary.
3. Step two places direction refresh with the direction choices and removes the inherited-material explanatory sentence.
4. One trusted image and one sentence produce a complete role-diverse suite with no repeated-purpose loop.
5. The original product source appears in every fresh canvas session.
6. White background, main, detail, SKU, and material outputs occupy separate horizontal lanes.
7. Clicking the image body selects and drags; double click opens full inspection.
8. A dragged node and every connected edge endpoint remain attached at animation-frame cadence.
9. A stale pre-migration draft cannot hide source images or restore the obsolete layout.
10. No final task exposes `undefined`, raw role IDs, raw provider errors, or quality-rejection wording.
11. Focused tests, full tests, build, checks, real generation, desktop/mobile visual QA, deployment, and production canaries pass.

## Non-goals

- Video or audio generation.
- A generic workflow editor unrelated to ecommerce image work.
- Copying competitor source code, branding, or proprietary assets.
- Allowing arbitrary uploads to become product truth without explicit role assignment.
