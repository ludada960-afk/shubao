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
