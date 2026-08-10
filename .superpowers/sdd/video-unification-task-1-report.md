# Task 1 Report: Shared Video Job Model And Studio Composer

## Scope

- Added shared video job model helpers in `src/pages/VideoStudio/videoStudioModel.js`.
- Reworked `src/pages/VideoStudio/index.jsx` to use the shared model, default to `smart`, keep upstream API mode names via `resolveVideoApiMode`, and gate submission with `hasRequiredVideoInputs`.
- Collapsed the duplicate upload entrypoint so the plus action reuses the rendered material picker instead of a second hidden uploader.
- Updated `src/pages/VideoStudio/VideoStudio.css` for the three-mode tab grid and unified `video-content-composer`.
- Kept Canvas files untouched as requested.

## RED

### Command

```powershell
node --test test/video-studio-model.test.mjs
```

### Result

- Failed with `ERR_MODULE_NOT_FOUND` because `src/pages/VideoStudio/videoStudioModel.js` did not exist yet.

## GREEN

### Command

```powershell
node --test test/video-studio-model.test.mjs
```

### Result

- Passed `3/3`.

### Command

```powershell
node --test test/video-studio-model.test.mjs test/video-studio-contract.test.mjs
```

### Result

- Passed `5/5`.

## Additional Verification

### Command

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability diff --check -- src/pages/VideoStudio/index.jsx src/pages/VideoStudio/VideoStudio.css src/pages/VideoStudio/videoStudioModel.js test/video-studio-model.test.mjs test/video-studio-contract.test.mjs
```

### Result

- No whitespace or patch-format issues.

## Files Changed

- `src/pages/VideoStudio/videoStudioModel.js`
- `src/pages/VideoStudio/index.jsx`
- `src/pages/VideoStudio/VideoStudio.css`
- `test/video-studio-model.test.mjs`
- `test/video-studio-contract.test.mjs`

## Self-Review

- Confirmed the user-facing modes are exactly `smart`, `frame`, and `remake`.
- Confirmed `smart` maps to upstream `script` or `reference` without changing API contract names.
- Confirmed `frame` and `remake` keep their required-material validation in one shared helper.
- Confirmed the quick plus button now activates the existing deck/frame picker instead of a duplicate upload source.
- Confirmed the contract test was tightened to this task’s actual boundary so Canvas remains untouched.

## Concerns

- `resolveVideoApiMode('smart', files)` only promotes to upstream `reference` when image material exists, matching the brief exactly. If upstream later needs videos or audios to select `reference`, that would be a follow-up behavior change.
- I did not change any Canvas implementation, per task instruction.

## Fix Wave

### RED

#### Command

```powershell
node --test test/video-studio-model.test.mjs test/video-generation.test.mjs
```

#### Result

- The live worktree already contained partial unstaged fixes before this pass, so I reconstructed RED against commit `edf91be` with the current tests and `edf91be` copies of `src/pages/VideoStudio/videoStudioModel.js`, `server/videoGeneration.mjs`, and `server/billing/catalog.mjs`.
- Snapshot run failed `4/7`:
  - `smart creation chooses the compatible upstream mode from supplied materials` returned `script` for video-only smart input instead of `reference`.
  - `reference mode accepts a video-only reference job` failed with `VIDEO_REFERENCE_NOT_FOUND`.
  - `reference mode accepts an audio-only reference job` failed with `VIDEO_REFERENCE_NOT_FOUND`.
  - `reference mode rejects an empty reference job` rejected with the wrong validation path instead of `VIDEO_REFERENCE_REQUIRED`.

### GREEN

#### Command

```powershell
node --test test/video-studio-model.test.mjs test/video-studio-contract.test.mjs test/video-generation.test.mjs
```

#### Result

- Passed `9/9`.
- Verified:
  - `smart` without references stays `script`.
  - `smart` with any image, video, or audio resolves to `reference`.
  - server `reference` accepts video-only and audio-only jobs.
  - empty `reference` still rejects.
  - `remake` still requires at least one image and one video.
  - `frame` still requires first and last images.

#### Command

```powershell
git diff --check
```

#### Result

- No whitespace or patch-format issues.

### Changed Files

- `test/video-studio-model.test.mjs`
- `test/video-generation.test.mjs`
- `src/pages/VideoStudio/videoStudioModel.js`
- `server/videoGeneration.mjs`
- `.superpowers/sdd/video-unification-task-1-report.md`

### Self-Review

- Kept the implementation change minimal and confined to the model resolver and server-side reference validation.
- Preserved existing `frame` and `remake` requirements.
- Confirmed the server now validates `reference` mode against any supported multimodal input instead of images only.
- Confirmed the asset normalization path now looks up real `firstImage` and `lastImage` ids rather than string literals.

### Concerns

- The worktree already had partial unstaged edits in these fix files when I started, so the RED evidence for this wave was reconstructed against `edf91be` rather than reproduced directly in-place.
