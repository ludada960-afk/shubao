# Xuan AI Video Corpus Research

Date: 2026-08-17

This note records the read-only research pass for the second Xuan-jiang video and
the AI-video section of the linked Feishu knowledge base. It is an evidence and
product-design input for the existing [AI video platform roadmap](./2026-08-14-ai-video-platform-roadmap.md),
not a claim that every provider feature has been independently generated or paid-tested.

## Sources and Access Boundary

- [Bilibili: 烧3万块，踩坑无数，爆款科幻AI大片工作流全分享](https://www.bilibili.com/video/BV1p7gP6CErH/)
- [Xuan酱的 AI 知识库](https://my.feishu.cn/wiki/RxmAw9xGhiFx0CkptXFcGxFNn8c)

The Bilibili API verified the video metadata: `BV1p7gP6CErH`, 828 seconds,
published 2026-08-14, author `Xuan_酱`, and a stated spend of more than 30,000
RMB for a galaxy-archaeology science-fiction film. The public player exposed only
a short preview in this environment, and the local ffmpeg binary was unavailable,
so this note does not invent a frame-by-frame transcript. The Feishu index and
publicly exposed document bodies were read without login, generation, or payment;
some documents expose headings and summaries rather than their full private body.

## AI-Video Corpus

The AI-video directory contains these topics:

`AI视频景别组接`, `即梦Seedance2.5测评-教程文档`, `LuxReal人物一致性保持教程`,
`AI镜头角度`, `AI视频调度`, `AI漫剧`, `在Tapnow用AI复刻《沙丘》`,
`Seedance 2.0 实用玩法技巧`, `小云雀Seedance 2.0复刻电影视觉`,
`AI视频真实感-人物篇`, `AI视频打光`, `AI视频生成分镜思维`,
`AI视频生成最强视频工作流`, `N8N AI 视频自动生成`, `AI视频运镜超全盘点`,
`复原圆明园 分镜提示词`, `Veo3 JSON提示词模板`, `最强AI视频生成工作流工具链接`,
and `用AI拍广告-分镜-教程文档`.

## Distilled Product Primitives

| Observed method | User value | Failure mode to prevent | Shubao contract |
| --- | --- | --- | --- |
| Story, asset sheet, storyboard, shot, timeline stages | Turns an expensive long-film request into reviewable decisions | A single opaque prompt creates expensive, unrepairable output | `Project -> SkillRun -> Asset/Version -> Shot -> Candidate -> TimelineClip` |
| Approved character, wardrobe, scene and prop versions | Preserves identity and continuity across shots | New references silently drift the character or product | Bind immutable approved asset versions to every shot |
| Shot scale grammar and 180/30 degree rules | Makes edits readable and spatially coherent | Random angle changes, gaze flips and axis breaks | Store `shotType`, `angle`, `lens`, `movement`, `axis`, and transition intent |
| One primary action per shot with explicit timing | Makes motion easier for a provider to follow | Long prompts mix actions and produce mushy movement | Validate a bounded action list and per-shot duration |
| Emotion as facial/body micro-actions | Produces believable performance rather than generic smiles | Abstract emotion words yield artificial faces | Store face action, body action, pause and negative-prompt fields |
| Lighting as a named, positioned design choice | Controls mood and product legibility | Lighting is left to a model default and changes between shots | Normalize key/fill/rim, direction, hardness, color and mood |
| Reference-video reconstruction and motion transfer | Reuses a proven camera/performance language | Rights, identity and unsupported capability are ignored | Separate reference-video mode, rights confirmation and capability gate |
| Draft low resolution, select, then enhance | Controls cost and avoids upscaling rejected work | Every candidate is rendered at the most expensive quality | Candidate states and explicit HD promotion |
| Polling DAGs and n8n-style loops | Makes long jobs observable and restartable | Lost tasks, duplicate submits and unclear retries | Durable job attempts, idempotency key, outbox, polling and compensation |
| Ad recipes with fixed durations and transitions | Lets a user start from a proven commercial pattern | Free-form controls overwhelm users | Templates expose intent; server maps to provider capabilities |
| JSON/structured prompt templates | Makes provider adapters testable and portable | Provider-specific prompt strings become the product | Normalize project style/negative prompt and scene-level timing/camera |
| Asset history, version selection and process replay | A finished case becomes a reusable starting point | “Do the same” only copies a final image | Persist source assets, prompt, parameters, model route, approvals and versions |

## What This Changes in the Roadmap

1. **Cinematography becomes data, not prose.** Add a normalized shot-direction
   object to the existing shot schema: `shotType`, `angle`, `movement`, `lens`,
   `subjectAction`, `facialAction`, `bodyAction`, `lighting`, `axis`,
   `transition`, `durationMs`, and `negativePrompt`. Provider adapters translate
   this object; the user does not need to learn each provider's syntax.
2. **The first useful product is an approval-driven director.** The workbench
   should propose a story beat map, named assets, shot cards, cost range and
   dependencies. Users confirm assets and checkpoints before any paid job.
3. **Reference-video recreation is a distinct workflow.** It needs source-video
   rights, target identity references, shot extraction, a replacement map and a
   provider capability check. It must not be hidden behind ordinary image-to-video.
4. **Quality and cost are a funnel.** Generate a bounded draft candidate, let the
   user select, then enhance only selected shots. A failed shot retries alone and
   never invalidates successful clips or charges a terminal failure.
5. **The case gallery is part of the product loop.** “View process” and “Clone
   project” must rehydrate the same assets, shot directions, approvals, model
   route and parameters. A final MP4 without provenance is not a replayable case.

## Implementation Sequence

### Stage 0: reliability and schemas

Finish the current local SkillRun checkpoint work; add normalized shot-direction
validation, deterministic plan hashes, provider capability checks, idempotent job
attempts, polling recovery, and cost/rights guards. Keep all preview paths provider-free.

### Stage 1: director workbench

Expose asset sheet, shot cards and a minimal timeline. Ship three bounded recipes:
product advertisement, image-to-video, and first/last-frame. Keep model selection
server-routed behind Fast/Stable/High intent.

### Stage 2: continuity and replay

Add character/product identity locks, wardrobe and scene bindings, version history,
candidate selection, voice/music anchors, and full process replay/clone. Add a
read-only “view process” presentation before enabling public case cloning.

### Stage 3: advanced local editing

Add reference-video breakdown, interval reshoot, extension, motion/pose transfer,
tracking replacement and 3D scene previews only after each provider capability has
three non-billing input-variant canaries and a whole-shot fallback.

### Stage 4: automation and operations

Offer bounded n8n/API/CLI jobs, queue and budget controls, provider success-rate
routing, per-shot cost dashboards, support drill-down, and automatic refund/release
reconciliation. A workflow may be automated only when its approval and rollback
boundaries remain auditable.

## Explicit Non-Goals and Risks

- No promise of perfect identity, motion or text consistency; uncertain shots need
  human approval and a fallback.
- No direct copying of hidden prompts, proprietary assets, or provider UI. Public
  methods are translated into Shubao-owned normalized contracts.
- Open-source runners and model weights require license, security, GPU, latency,
  moderation and commercial-cost gates before production use.
- The corpus includes creator claims and platform marketing claims. They are useful
  design signals, not independent quality or latency benchmarks.
- This research and the current implementation used no paid production video call.
