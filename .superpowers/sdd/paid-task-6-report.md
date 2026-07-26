# Paid Workflow Task 6 — completion report

## Delivered

- Xiaohongshu and both reachable Plog surfaces use the server-authoritative
  `content_sets` balance. No surface mutates local credits or trial counters.
- Formal content generation uploads the original reference asset once and
  resumes with owner-scoped asset IDs; previews remain free and may use the
  temporary local image only for that request.
- Content drafts retain text, style, layout, cover choice and reference asset
  IDs. Pending payment state is deliberately narrower: it contains only the
  owner-bound draft reference and asset IDs, never File, Blob, Base64 or data
  URLs.
- The server verifies each referenced asset belongs to the signed-in owner
  before reading its stable original. Cross-owner, missing and malformed asset
  references fail safely.
- Only a server `complete` event with stable generated asset URLs and
  `content_sets` billing can present a paid result. Signed balance refreshes
  after formal completion.

## Deliberate product boundary

XHS/Plog remains a priced **content-set workspace** (copy + a coherent image
set), rather than being silently converted into a canvas job. Canvas import is
the next explicit derivative action: it must preserve the content-set source
and never change the completed set or charge it again.

## Verification

- Focused content/billing/API/reference suite: 74 passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run collab:check`: READY.
