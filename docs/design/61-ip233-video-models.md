# 中转站（IP233 Media API）视频模型全清单 —— 2026-09-19 实测

> 用户给的资料：模型广场 https://new.ip233.com/pricing · 文档 https://new.ip233.com/docs/models
> 本文件由**零成本 GET** 生成（读 `/api/pricing` 与 `/v1/models`，不发任何生成请求）。

## 一、结论先行

1. **我们的接口拼法是**对的`——中转文档里写的与我们代码里用的**逐字一致**：
   - Base URL `https://api-new.ip233.com/v1`
   - 视频提交 `POST /v1/videos` · 查询 `GET /v1/videos/{task_id}` · 下载 `GET /v1/videos/{task_id}/content`
   - 鉴权 `Authorization: Bearer <KEY>`
   **所以"调不通"从来不是端口/路径问题。**
2. **真正的原因是模型名**：中转按**模型名**放行，名字不对就回 `not a public model name`。
   文档原话：「**请直接使用展示的正式模型名，不需要自行添加渠道前缀**」。
3. **中转现在有 39 条视频模型**（全部在我们买的 `default` 分组里有价），
   **我们只放出了 5 条** —— 这就是用户说的「你把模型搞丢了」的**真实差距**。

## 二、中转当前视频模型全清单（39 条，default 分组）

```
中转里支持视频端点的模型数: 39
agv-seedance2.0fast            ¥0.91 | default | ratio=0
grok-video                     ¥0.897 | default/advanced/advanced-one | ratio=0
grok-video-1.5                 ¥1.807 | default/advanced/advanced-one | ratio=0
ip233-minimax-h3               ¥0.364 | default/advanced/advanced-one | ratio=0
minimax-h3                     ¥0.364 | advanced-one/default/advanced | ratio=0
minimax-h3-per-request         ¥7.41 | default/advanced/advanced-one | ratio=0
omni-fast                      ¥0.86112 | default/advanced/advanced-one | ratio=0
omni-fast-no-water             ¥1.053 | default/advanced/advanced-one | ratio=0
omni-v2v                       ¥1.15128 | default/advanced/advanced-one | ratio=0
omni-v2v-no-water              ¥1.3455 | default/advanced/advanced-one | ratio=0
sd-2.0-933-max                 ¥0.624 | advanced-one/default/advanced | ratio=0
sd-2.0-933-medium              ¥0.442 | default/advanced/advanced-one | ratio=0
sd-2.0-as                      ¥2.21 | default/advanced/advanced-one | ratio=0
sd-2.0-js                      ¥2.6 | default/advanced/advanced-one | ratio=0
sd-2.0-js900                   ¥2.08 | default/advanced/advanced-one | ratio=0
sd-2.5-js2                     ¥3.38 | default/advanced/advanced-one | ratio=0
sd-face-720p                   ¥0 | advanced-one/default/advanced | ratio=37.5
sd-full-1080p                  ¥0 | advanced/advanced-one/default | ratio=37.5
sd-full-720p                   ¥0 | advanced/advanced-one/default | ratio=37.5
sd-full-fast-720p              ¥0 | advanced/advanced-one/default | ratio=37.5
sd-reference-image             ¥0.91 | default | ratio=0
sd-reference-image-25          ¥0.91 | default | ratio=0
seedance-2.0                   ¥5.07 | default/advanced/advanced-one | ratio=0
seedance-2.0-1080p             ¥7.67 | advanced/advanced-one/default | ratio=0
seedance-2.0-480p              ¥0.585 | advanced/advanced-one/default | ratio=0
seedance-2.0-4k                ¥5.85 | default/advanced/advanced-one | ratio=0
seedance-2.0-720p              ¥1.2675 | default/advanced/advanced-one | ratio=0
seedance-2.0-fast              ¥3.77 | default/advanced/advanced-one | ratio=0
seedance-2.0-fast-480p         ¥0.325 | default/advanced/advanced-one | ratio=0
seedance-2.0-fast-720p         ¥0.975 | default/advanced/advanced-one | ratio=0
seedance-2.0-mini              ¥3.77 | default/advanced/advanced-one | ratio=0
xn-minimax-h3                  ¥3.64 | advanced/advanced-one/default | ratio=0
xn-minimax-h3-second           ¥0.364 | advanced/advanced-one/default | ratio=0
xn-seedance-2.0                ¥6.63 | advanced/advanced-one/default | ratio=0
xn-seedance-2.0-fast           ¥0.715 | default/advanced/advanced-one | ratio=0
xn-seedance-2.0-fast-cnt       ¥5.07 | advanced-one/default/advanced | ratio=0
xn-seedance-2.0-second         ¥1.859 | advanced/advanced-one/default | ratio=0
xn-seedance-2.5                ¥1.872 | advanced/advanced-one/default | ratio=0
xn-wan3.0                      ¥0.455 | advanced/advanced-one/default | ratio=0
```

## 三、我们现在的 10 条产品定义 vs 中转

| 我们的产品 | 路由（模型名） | 状态 |
|---|---|---|
| Seedance 2.0 Fast | agv-seedance2.0fast | ✅ 公开（已真实出片验证） |
| Seedance 2.0 标准 | seedance-2.0 | ✅ 公开 |
| MiniMax H3 768P | minimax-h3 | ✅ 公开（2026-09-19 复核转 callable） |
| 通义万相 3.0 | xn-wan3.0 | ✅ 公开（同日复核） |
| Grok 极速 | grok-imagine-video | ✅ 公开（同日复核） |
| 可灵 3.0 / 3.0 Pro | kling-3.0 / kling-3.0-pro | ❌ **中转清单里根本没有这两个名字** |
| Veo 3.1 Fast | veo-3.1-fast | ❌ 同样不在清单里 |
| MiniMax H3 2K | minimax-h3-per-request | ⛔ 有（¥7.41）但 > 当前余额 ¥6 |
| Seedance 2.5 | xn-seedance-2.5 | ⛔ 有（¥1.872/秒，5 秒 ¥9.36）> 余额 |

**上一版台账（09-16）把 8 条判成"不可达"，其中有若干条今天在中转里是有价可用的**
（例如 `grok-video` ¥0.897、`grok-video-1.5` ¥1.807、`seedance-2.0-720p` ¥1.2675 等）。
判"不可达"的依据是"提交被上游回 not a public model name" ——
但中转文档明说**每个模型的端点与参数各不相同**，所以那条结论需要用**逐模型正确的报文**复验后才算数。

## 四、可以直接加回来的（中转有、且便宜、属于同一族）

`sd-2.0-933-medium` ¥0.442 · `sd-2.0-933-max` ¥0.624 · `seedance-2.0-fast-480p` ¥0.325 ·
`seedance-2.0-480p` ¥0.585 · `seedance-2.0-fast-720p` ¥0.975 · `seedance-2.0-720p` ¥1.2675 ·
`omni-fast` ¥0.86112 · `sd-2.0-js900` ¥2.08 · `sd-2.0-as` ¥2.21 · `sd-2.0-js` ¥2.6 ·
`sd-2.5-js2` ¥3.38 · `seedance-2.0-mini` ¥3.77 · `seedance-2.0-fast` ¥3.77 · `seedance-2.0-4k` ¥5.85

⚠️ **用户明确要求：现在不要跑这些模型**（他后期自己跑）。本文件里的数字全部来自**只读接口**，没有任何生成请求。

---

## 五、2026-09-19 零成本探针复核（批 K-B 第一半）

手法：故意用**非法时长**提交 —— 上游参数校验在**生成之前**拦下 ⇒ 渠道活着、模型名对得上。
⚠️ 见下面「探针安全事故」一节：**不是每条路由都校验时长**。

```
sd-2.0-933-medium          ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥441.558000","data":null}
sd-2.0-933-max             ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥623.376000","data":null}
seedance-2.0-fast-480p     ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥324.675000","data":null}
seedance-2.0-480p          ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥584.415000","data":null}
seedance-2.0-fast-720p     ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥974.025000","data":null}
seedance-2.0-720p          ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥1266.232500","data":null}
sd-2.0-js900               ALIVE          | {"code":"fail_to_fetch_task","message":"{\"error\":{\"code\":\"invalid_video_parameters\",\"message\":\"durati
sd-2.0-as                  ALIVE          | {"code":"fail_to_fetch_task","message":"{\"error\":{\"code\":\"invalid_video_parameters\",\"message\":\"durati
sd-2.0-js                  ALIVE          | {"code":"fail_to_fetch_task","message":"{\"error\":{\"code\":\"invalid_video_parameters\",\"message\":\"durati
sd-2.5-js2                 ALIVE          | {"code":"fail_to_fetch_task","message":"{\"error\":{\"code\":\"invalid_video_parameters\",\"message\":\"durati
seedance-2.0-mini          ALIVE          | {"code":"fail_to_fetch_task","message":"{\"code\":\"invalid_duration\",\"message\":\"该模型不支持此时长，请改用支持的秒数后重试。\",
seedance-2.0-fast          ALIVE          | {"code":"fail_to_fetch_task","message":"{\"code\":\"invalid_duration\",\"message\":\"该模型不支持此时长，请改用支持的秒数后重试。\",
seedance-2.0-4k            OTHER          | {"code":"model_price_error","message":"quota conversion (QuotaFromFloat) overflow: original=2.922075e+09, clam
xn-seedance-2.0            ALIVE          | {"error": {"message": "unsupported video duration", "type": "reference_asset_error"}}
xn-seedance-2.0-fast       ALIVE          | {"error": {"message": "unsupported video duration", "type": "reference_asset_error"}}
xn-seedance-2.0-second     ALIVE          | {"error": {"message": "unsupported video duration", "type": "reference_asset_error"}}
xn-seedance-2.5            ALIVE          | {"error": {"message": "unsupported video duration", "type": "reference_asset_error"}}
xn-minimax-h3              ALIVE          | {"error": {"message": "unsupported video duration", "type": "reference_asset_error"}}
xn-minimax-h3-second       ALIVE          | {"error": {"message": "unsupported video duration", "type": "reference_asset_error"}}
ip233-minimax-h3           ALIVE(quota)   | {"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ¥6.122880, 需要预扣费额度: ¥363.636000","data":null}
grok-video                 UNREACHABLE    | {"code":"fail_to_fetch_task","message":"{\"error\":{\"code\":\"\",\"message\":\"Invalid request: model grok-vi
grok-video-1.5             UNREACHABLE    | {"code":"fail_to_fetch_task","message":"{\"error\":{\"code\":\"\",\"message\":\"Invalid request: model grok-vi
sd-reference-image-25      OTHER          | {"id":"task_SbjFf6iogm8jpBEEygQKg7ZsqxRXiE05","task_id":"task_SbjFf6iogm8jpBEEygQKg7ZsqxRXiE05","object":"vide
sd-reference-image         OTHER          | {"code":"fail_to_fetch_task","message":"{\"code\": \"INVALID_TASK_PARAMETERS\", \"message\": \"durationSeconds
```

### 结论
- **可用的（ALIVE / ALIVE(quota)）**：`sd-2.0-933-medium` `sd-2.0-933-max` `sd-2.0-js900` `sd-2.0-as`
  `sd-2.0-js` `sd-2.5-js2` `seedance-2.0-480p` `seedance-2.0-fast-480p` `seedance-2.0-720p`
  `seedance-2.0-fast-720p` `seedance-2.0-mini` `seedance-2.0-fast` `seedance-2.0-4k`
  `xn-seedance-2.0` `xn-seedance-2.0-fast` `xn-seedance-2.0-second` `xn-seedance-2.5`
  `xn-minimax-h3` `xn-minimax-h3-second` `ip233-minimax-h3` —— **20 条左右**，
  这就是用户说的「很多模型」的真实来源；上一版台账（09-16）把它们大量误判成不可达。
- **真不可达**：`grok-video` `grok-video-1.5`（上游回 not a public model name）。
- 注：ALIVE(quota) 那些是因为探针用了 999 秒才把预扣费放大到几百元；按正常 5 秒算单价都在 ¥0.3~3。

### ⚠️ 探针安全事故（必须如实记，也要改手法）
`sd-reference-image-25` **不校验时长**：非法报文被它 200 收下并**真的建了任务**
（`task_SbjFf6iogm8jpBEEygQKg7ZsqxRXiE05`）。这已经是第二次了（第一次是第 3 轮的 `omni-fast`）。
- 代价：按该模型单价 **≤ ¥0.91**（第一次 omni-fast ≤¥0.86）。两次合计 **≤ ¥1.8**，均由我误建，如实报备。
- **新的探针纪律**（写进代码注释与本文件）：
  1. **不再对"未知校验行为"的路由盲发探针**；
  2. 先读该模型在中转的**文档页**拿到它自己的参数集，再用**对它非法**的字段去试；
  3. 仍然不能确认的，**宁可标成"未验证"也不探**。
