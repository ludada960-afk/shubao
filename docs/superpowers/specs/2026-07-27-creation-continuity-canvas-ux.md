# Creation Continuity And Canvas UX

## Product invariants

1. Authentication, pricing, examples, dialogs and navigation never discard a creation draft.
2. Login closes in place. A post-login route is used only for an explicit protected destination, never as a default redirect.
3. Ecommerce drafts persist product assets, reference assets, prompt, configuration and selected direction per creation surface.
4. Upload compatibility is determined from decoded bytes. JPEG, PNG, WebP and AVIF are accepted; WebP and AVIF are normalized to lossless PNG originals before entering the ecommerce asset pipeline. Unsupported files fail individually with an actionable message.
5. Imported works create output/image nodes only. Workflow actions are created only after an explicit user command.
6. Only source images and successful output images can derive. Draft, running and failed process nodes cannot derive.
7. A workflow action has one immediate parent plus explicit supplemental inputs. Successful execution creates a new output node linked to that action while retaining provenance IDs.
8. The action picker is positioned in canvas world coordinates, scrolls within the viewport and moves with pan/zoom. Edges use semantic action labels and terminate at actual ports.
9. Selection toolbar contains frequent direct commands, context menu contains the complete contextual command set, and drag ports create persistent workflow actions.
10. Product-owned dialogs replace browser alert, confirm and prompt. Unknown icon-only controls expose accessible tooltips.
11. Customer-facing copy distinguishes Xiaohongshu/Plog creation sets from ecommerce/canvas AI points and never exposes internal test-stage language.

## Acceptance flows

- Fill ecommerce inputs, open an example, close it, authenticate, inspect pricing and return: every input and uploaded asset remains.
- Upload JPEG, PNG, WebP and AVIF assets with misleading extensions/MIME values: decoded valid images succeed and invalid content fails without clearing the draft.
- Import a work into canvas: no workflow child appears. Derive two independent actions from one image, pan/zoom, execute one, retry a failure and derive from the successful output only.
- Rename and delete with product dialogs; cancel preserves state and confirm applies exactly once.
- Desktop and mobile have no inaccessible picker content, overlapping primary actions or browser-native dialogs.

## Verification

- Focused model, upload, canvas and UI contract tests.
- Full `npm test`, export verification and production build.
- Browser QA at desktop and 390x844, including login interruption and canvas pan/zoom.
- Production deployment only through `scripts/deploy-production.ps1`, followed by health, bundle, API and canary checks.
