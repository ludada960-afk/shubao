# 视频模型清单审计（用户批注 #7「起码有 10 个模型，为什么都不见了」）

> 取证：直接读服务端目录与路由台账（`server/videoCatalog.mjs` 的 `VIDEO_PRODUCTS` + `ROUTE_REACHABILITY`），
> 用脚本逐条 join 出来。不是猜的，也不是从 UI 反推的。

## 结论
**10 个模型都在目录里，一个都没删。** 其中 **2 个已上线**、**8 个 `public:false` 被门控挡住**。
挡住它们的三条原因**没有一条在 UI 层**：5 个上游路由不可达、2 个是中转余额不足、1 个是报文口径未确认。

## 逐条对照（脚本 join 的结果）
| 状态 | 模型 | 路由 | 报价 | 台账证据（节选） |
|---|---|---|---|---|
| ✅ **已上线** | Seedance 2.0 Fast | `agv-seedance2.0fast` | ¥0.91/次 | 2026-09-16 **真实出片**：720p/5s 提交 200，156s 完成并返回成片 URL |
| ✅ **已上线** | Seedance 2.0 标准 | `seedance-2.0` | ¥5.07/次 | 提交 200；同族 1080p 被分辨率白名单拒收，故本档只开 720p |
| ⛔ unreachable | Grok 极速 | `grok-imagine-video` | — | 该 id 未声明 openai-video；同族 grok-video 上游不认 |
| ⛔ unreachable | 通义万相 3.0 | `xn-wan3.0` | — | 声明了 openai-video，但提交返回「模型聚合条件不支持」 |
| ⛔ unreachable | 可灵 3.0 | `kling-3.0` | — | 未声明 openai-video；上游可用性面板为 degraded |
| ⛔ unreachable | 可灵 3.0 Pro | `kling-3.0-pro` | — | 同上 |
| ⛔ unreachable | Veo 3.1 Fast | `veo-3.1-fast` | — | 未声明 openai-video，视频端点不可达 |
| 💰 blocked | Seedance 2.5 | `xn-seedance-2.5` | ¥1.872/秒 | 渠道与分辨率校验都过了（1080p 合法），**仅因预扣 ¥9.36 超过中转余额**被拒 |
| 💰 blocked | MiniMax H3 2K | `minimax-h3-per-request` | ¥7.41 | 渠道与参数校验都过了，**仅因预扣 ¥7.41 超过中转余额**被拒 |
| ❓ unverified | MiniMax H3 768P | `minimax-h3` | ¥0.364/秒 | 渠道活着（用 seedance 报文提交被上游指出字段不符 ⇒ 通道在），本站报文口径待确认 |

按状态汇总：`unreachable 5` · `blocked 2` · `unverified 1`。

## 两条能解锁的路径（都不需要改 UI）
1. **给中转账户充值** → `blocked` 的两个（Seedance 2.5 / MiniMax H3 2K）当即可接生产路由。
   台账原话：「充值后可直接开 public」。
2. **等上游开通/更正模型名** → 5 个 `unreachable` 的只能等中转商那边把 `openai-video` 端点与模型名对上；
   我们这一侧没有任何代码能绕过——绕过就是用户选了之后拿到失败，或者更糟：**静默回落到另一个引擎**
   （服务端对非法 model 是静默回落成默认档的，用户看到的是「生成成功但不是我要的那个模型」）。

## 为什么不能「先把它们放出来」
- 有一条门禁**就是为这件事写的**：`test/video-route-reachability.test.mjs` ——
  「`public:true` 只允许 `verified` / `callable`」。把 `public` 翻成 true 会让它当场变红。
- 更要紧的是产品后果：`unreachable` 的模型放出来，用户点「生成」拿不到片；
  而如果服务端把它回落成默认档，用户会**付了钱拿到别的模型的结果**。这两条都撞在本项目的铁律上。

## 如果只是想让用户知道「还有更多在接通」
可以在模型下拉底部加一行只读说明（列出这 8 个名字 + 一句原因），
但这需要 `/api/video/capabilities` 多回一个 `unavailableProducts` 字段（服务端改动）。
本轮**没有做**：它属于「让界面更好看」而不是「让能力可用」，
而这一轮的目标是先把用户点名的能力缺口处理干净。要的话下一轮加。