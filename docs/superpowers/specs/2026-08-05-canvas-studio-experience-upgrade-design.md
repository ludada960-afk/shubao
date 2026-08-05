# Canvas Studio Experience Upgrade

## Scope

This change upgrades the ecommerce-focused Canvas Studio composer and its shared visual language. It covers source naming, mutually exclusive composer menus, rich text editing, the ecommerce planning step, and generation failure handling. The existing homepage ecommerce workflow remains compatible with the shared configuration and asset contracts.

## Product decisions

1. **Canonical source names**
   - Product assets are displayed as `产品图1`, `产品图2`, ...
   - Reference assets are displayed as `参考图1`, `参考图2`, ...
   - Mentions use the same labels: `@产品图1` and `@参考图1`.
   - Raw filenames and internal asset IDs never appear in user-facing source labels.

2. **One active surface at a time**
   - Ratio, resolution, count, suite configuration panels, and the `@` picker share one close contract.
   - Opening one surface closes every other surface.
   - Outside pointer down, Escape, selection changes, and generation submission close transient surfaces.
   - Menus are positioned with enough room for their labels and are not clipped by the composer card.

3. **Rich text node**
   - Double-clicking a text-generation node enters a real editing state.
   - The floating toolbar exposes color, H1/H2/H3/body, bold, italic, unordered/ordered lists, alignment, duplicate, and fullscreen actions.
   - Focus, hover, active, and selection states are quiet, high-contrast, and reversible. The node is readable before editing and does not rely on a heavy blue outline.

4. **Ecommerce suite planning**
   - The Canvas suite uses one editable overall plan, not four competing direction cards.
   - The plan separates visual direction, product strategy, audience, composition, copy rules, quality risks, and per-image responsibilities.
   - The user can edit the plan before confirming the shot plan and starting image generation.
   - Configuration controls show one human-readable value per control, matching the homepage's compact control logic.

5. **Generation reliability**
   - Provider polling and bounded single-asset quality repair remain allowed.
   - A failed batch is never automatically submitted again as a new full batch.
   - A task remains resumable with explicit repair/retry/cancel actions.
   - Retried work reuses the same task/idempotency identity where possible and only targets failed or review-required assets, preventing duplicate billing.
   - Upstream availability cannot be guaranteed by the client; the product must make failures bounded, attributable, and non-destructive.

## Visual system

The Canvas keeps its neutral work surface, white tool surfaces, brand blue command color, and restrained shadows. Changes prioritize:

- 8px spacing rhythm with room around source rails and control rows.
- readable 11-13px control text and 12-14px plan labels;
- stable source tiles with two-line-safe labels and no clipped upload text;
- visible focus rings and 150-220ms state transitions;
- no gradients or decorative blobs in the work surface;
- responsive single-column source rails and plan sections below the compact breakpoint;
- reduced-motion support for loading and selection transitions.

## Interaction flow

```text
connect product/reference assets
        -> write request and adjust controls
        -> generate overall ecommerce plan
        -> edit visual direction and shot responsibilities
        -> confirm plan
        -> generate assets with bounded recovery
        -> review successes and repair only failed assets
```

## Verification

- Unit tests cover canonical names, mention labels, panel exclusivity, plan normalization, and retry decisions.
- Component contract tests cover upload labels, rich text controls, plan editing, and the absence of the old four-card Canvas path.
- Build and the existing full test suite must pass.
- Browser QA checks desktop and compact viewports, source-label overflow, menu dismissal, text editing, plan editing, and a failed-generation task without a duplicate submission.

