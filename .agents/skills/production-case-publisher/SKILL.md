---
name: production-case-publisher
description: Publish real Shubao image-generation outputs into reusable gallery cases without losing prompts, source materials, task provenance, or remix behavior. Use this skill whenever adding generated images to 灵感发现/案例, creating a 做同款 case, publishing a full ecommerce image suite, choosing a mosaic cover, or recovering a production showcase generation after a timeout.
---

# Production Case Publisher

Turn real production outputs into gallery cases that users can inspect and reproduce. A case is complete only when its images, exact generation instructions, source materials, and production evidence travel together.

## Workflow

1. Generate through the authenticated production route that a user would use. Keep the original request key stable across retries.
2. Record `quoteId`, `billingActionId`, and `requestKey` before sending a long generation request. A gateway timeout is not permission to resubmit. Inspect or resume the durable job first.
3. Download only stable generated-asset URLs. Verify image MIME, byte size, dimensions, and intended aspect ratio.
4. Create `manifest.json` beside the output images. Use the schema below and preserve the exact per-image prompt actually used for each output.
5. Run the project importer:

```powershell
node scripts/import-ecommerce-gallery-case.mjs --input <case-folder> --output public/gallery/ecommerce
```

6. Verify the generated `case.json` and `cases.json`: every image keeps its prompt, task ID, request key, optional quote ID, and role; `sourceAssets` and `remix` remain intact.
7. Exercise the gallery modal and `做同款`. The modal must display the selected image's prompt, and remix must restore the declared prompt and source materials to their correct upload roles.

## Manifest Contract

```json
{
  "id": "stable-case-id",
  "title": "用户可读标题",
  "category": "电商套图",
  "prompt": "整套方案的真实重放提示词",
  "sourceAssets": [
    { "id": "product", "role": "product", "url": "/stable/source.png", "name": "商品母图" }
  ],
  "outputs": [
    {
      "id": "detail-01",
      "role": "detail",
      "title": "逐图用途标题",
      "prompt": "该图片真实使用的完整提示词",
      "url": "01.png",
      "taskId": "durable-task-id",
      "requestKey": "stable-request-key",
      "quoteId": "optional-quote-id",
      "ratio": "3:4"
    }
  ],
  "cover": { "strategy": "auto", "outputIds": ["detail-01"] },
  "remix": {
    "mode": "product_suite",
    "prompt": "做同款时恢复的真实提示词",
    "sourceAssetRoles": ["product"]
  }
}
```

## Cover Selection

Use `auto` unless the art direction explicitly requires otherwise.

- Four or more outputs represent a suite, so `auto` builds a curated mosaic from persuasive results.
- One to three outputs use one normal cover instead of pretending to be a complete suite.
- Exclude white-background cutouts and transparent production assets from a mosaic when richer main, usage, scene, structure, or material images exist.
- Keep every source output in the case even when it is not selected for the cover.

## Prompt And Material Integrity

- Never replace a missing prompt with generic copy such as “展示本套方案中的视觉内容”. Missing production evidence is an import error to fix at the source.
- Keep per-output prompts distinct when the outputs perform different commercial jobs.
- Keep the suite replay prompt separate from per-output prompts.
- Preserve source roles such as `product`, `reference`, `person`, and `scene`; these roles drive the correct upload lanes during remix.
- Do not claim a case is reproducible until `做同款` restores both the prompt and every required source role.

## Recovery Rules

- For HTTP 409, 502, 503, 504, 524, timeout, or aborted connections, query durable generation status with the same payload and request key.
- If the provider output exists but stable persistence failed, retry persistence only. Do not call the image provider again.
- Reuse an unexpired quote and its original billing action. If a released or expired quote requires an explicit recovery, use a newly named billing action and document why.
- Confirm the balance changed exactly once for a completed paid output and did not change for a failed or released attempt.

## Verification

Run focused importer, manifest, gallery, remix, and preload tests. Before release, run the full test suite, production build, build check, collaboration check, and `git diff --check`. Deploy only through `scripts/deploy-production.ps1`, then verify desktop and mobile layouts, image decoding, modal preload behavior, prompt display, and `做同款` restoration.
