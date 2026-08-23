# Video Storyboard Shot Model Enrichment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the video storyboard shot contract with per-shot first/last frame references and a model intent, completing the VID-P1-02 storyboard MVP fields without touching the shared asset layer.

**Architecture:** The video workbench store already persists shot purpose, duration, camera language, prompt, direction, status, selected candidate, and revision. Add immutable per-shot fields `firstFrameRef`/`lastFrameRef` (canonical project-asset references, validated with `purpose: 'reuse'`) and `modelIntent` (a bounded intent string). The enriched shot model flows through the store hydration, the workbench routes, the client service, and the workbench UI.

**Scope (video-domain only):** Modify `server/videoWorkbenchStore.mjs`, `server/videoWorkbenchRoutes.mjs`, `src/services/videoWorkbench.js`, `src/pages/VideoStudio/videoProjectWorkbenchModel.js`, `src/pages/VideoStudio/VideoProjectWorkbench.jsx`, `src/pages/VideoStudio/VideoProjectWorkbench.css`, and their tests. Do NOT modify `server/projects/*`, Canvas, Works, billing, or deployment files.

**Constraints:**
- No provider submission, billing mutation, real generation, or credit consumption.
- Owner and project scope checked on every store/route operation.
- First/last frame references must be validated as reusable canonical project assets.
- Stale shots/candidates fail closed with an actionable error.

## Task 1: Extend the shot schema and hydration

- [ ] Add `first_frame_ref`, `last_frame_ref`, `model_intent` columns to `video_storyboard_shots` via additive migration in `ensureSchema`.
- [ ] Update `shotFromRow` to hydrate `firstFrameRef`/`lastFrameRef` (parsed JSON) and `modelIntent`.
- [ ] Write failing tests asserting the new fields are persisted and hydrated.

## Task 2: Enrich shot creation/update

- [ ] Accept `firstFrameRef`/`lastFrameRef`/`modelIntent` in `createShot`/`updateShot`; validate first/last refs with `purpose: 'reuse'` canonical asset checks.
- [ ] Add tests for validation failure (foreign owner, marked asset, tampered hash) and success.

## Task 3: Route and client wiring

- [ ] Pass the new fields through the workbench route handler and client service.
- [ ] Update the UI to show the first/last frame and model intent in the shot card.

## Task 4: Run local gates

- [ ] Run the video-focused suite, full `npm test`, `npm run check`, `npm run collab:check`, `git diff --check`; do not deploy or trigger real generation.
