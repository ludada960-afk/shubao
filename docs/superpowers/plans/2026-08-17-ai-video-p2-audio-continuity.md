# AI Video P2-06 Audio Continuity Implementation Plan

> **Scope:** local, default-off AI video workbench slice. No provider, generation, usage, wallet, quote, or billing calls.

## Goal

Keep voice/music continuity when a video project is replayed or cloned: approved audio asset
versions, timeline placement, volume/mute state, voice anchors, beat markers, and bounded
subtitle cues must survive the same owner/project checks as visual assets.

## Contract

- `video_audio_tracks` is owner/project scoped and revisioned.
- Only approved `voice` or `music` asset versions with `audio/*` MIME types can be bound.
- Track timing, volume, beat markers, and subtitle cues are bounded and validated atomically.
- `POST` creates a track; `PATCH` uses optimistic `expectedRevision` and an allow-list.
- Replay manifests include sanitized continuity metadata and never include playback URLs.
- Clone remaps asset/version IDs into a new draft project and preserves the continuity fields.

## Workbench Surface

- The default-off project workbench now lists only approved audio asset versions.
- Users can add one approved voice/music version to the project timeline after at least one
  visual clip exists, and can toggle mute with optimistic revision checks.
- The panel exposes the persisted duration and volume metadata without pretending to render or
  synthesize audio. Duplicate asset/version bindings are disabled in the UI.

## Verification

- Focused workbench/store/routes/replay/client tests pass, including owner isolation, stale
  revisions, malformed markers, manifest sanitization, and clone remapping.
- Full repository tests, `npm run check`, production build, and `git diff --check` are required
  before landing.
- The UI contract is covered by the workbench source test; the full local gate passed with
  `1694/1694` tests and a `6510`-module production build after the panel was added.
- Production rollout is a separate gate. The controlled SSH key is currently unreadable, so
  this slice must not be described as deployed until the standard deploy script and canary pass.

## Non-goals

- No waveform rendering, audio transcoding, beat detection, TTS, provider routing, or real paid
  generation in this slice. Those belong after P1 production evidence and the P2 program gate.
