# Commerce Suite and Canvas Production Closure Plan

**Goal:** Implement the approved seller-facing ecommerce generation and canvas closure, verify it end to end, and deploy it to production.

## Task 1: Lock entry and smart-plan behavior

- Add tests for complete restore, SKU override state, compact summaries, prompt alignment, and direction refresh placement.
- Extract pure smart-plan defaults and summary helpers where needed.
- Reset every configuration domain and show override state consistently.
- Remove the supplemental-material explanation and relocate direction refresh.

## Task 2: Strengthen the generation contract

- Add tests for category-aware smart defaults, distinct commercial duties, camera/interaction diversity, Chinese display metadata, and original-source preservation.
- Extend the planner and shot director only where the current structured engine misses the contract.
- Keep unsupported physical states fact-gated.
- Carry source assets and normalized output metadata into persisted work records and canvas imports.

## Task 3: Make repair internal and delivery complete

- Add orchestrator tests for bounded targeted repair, whole-suite completion, billing settlement, and safe terminal failure.
- Replace user-facing partial review delivery with internal retries and complete accepted output.
- Preserve all generation inputs for a provider-level retry without another user setup pass.

## Task 4: Version and rebuild canvas sessions

- Add tests for five lane groups, meaningful names and sizes, stale-draft rejection/migration, and source preservation.
- Split white background from main images and reusable material from SKU/detail lanes.
- Version draft snapshots and reject incompatible layouts.
- Disable native image drag and keep pointer/edge geometry synchronized.
- Keep double-click inspection and compact context actions.

## Task 5: Close image loading performance

- Audit every Works, case, canvas, and lightbox image call site.
- Add tests that require `thumb`, `canvas`, and `full` variants on the correct surfaces.
- Verify local assets bypass the proxy and derivatives use cache validators.
- Validate loading behavior with request timing and screenshots.

## Task 6: Configure and probe the new gateways

- Update non-secret example configuration with the new endpoint/model names.
- Update local runtime secrets outside Git.
- Run no-charge model/schema probes, then a bounded real image edit/generation.
- Validate the supplied vision endpoint with the required image-input model.
- Keep primary/overflow failover observable in server logs but private from clients.

## Task 7: Verify and ship

- Run focused test groups after each implementation unit.
- Run `npm test`, `npm run build`, `npm run check`, and `npm run collab:check`.
- Run local desktop/mobile browser QA for entry, generation, lane layout, selection, drag, edges, double-click, persistence, and image timing.
- Commit explicit files, deploy only through `scripts/deploy-production.ps1`, and run production ecommerce, billing, image, and canvas canaries.
- Record final evidence in `.superpowers/sdd/progress.md` and mark the active goal complete only after production verification.
