# IP233 视频模型 · 权威价目与接入建议（2026-09-11）

来源：GET https://api-new.ip233.com/api/pricing（用我方 IP233 key 实测的权威价目，不靠 OCR 截图）。
同平台 GET /v1/models 返回 124 个模型 id；价目表 156 行（含图片/文本模型），其中视频类有报价的 86 个。
用户模型广场截图（3 张，49 个/页）与本文价目一致。

## 1. 当前已上线
| 产品 | routeId | 上游价 | 我方记账 | 用户价 |
|---|---|---|---|---|
| Seedance 2.0 Fast | agv-seedance2.0fast | ¥0.91/条（价目一致） | 0.91 | 27 积分 / ¥6.9 |
| Seedance 2.0 标准 | sd5-seedance-2.0 | 价目 ¥3.77/条 | 5.07（偏保守，见下） | 46 / 57 积分 |
| MiniMax H3 768P（本轮新增） | minimax-h3-768p | ¥4.55/条（价目一致） | 4.55 | 38 积分 / ¥9.9 |

对账项：sd5-seedance-2.0 价目为 ¥3.77/条，我方台账按 ¥5.07/条（同族 sd4-fast / sd10 的价格）记账，
毛利被低估约 8pp（是少算不是超收）；首条真实账单落库后校准，用户价不用动。

## 2. 全量价目（视频类 · 有报价的 86 条）
格式：模型 id, 上游价(CNY), 计费方式

grok-imagine-video,0.104,per_second
kling-3.0,1.82,per_request
kling-3.0-omni,1.82,per_request
sd25-30s,0.27,per_second
seedance-2.0-fast-0826-pfv,3.78,per_request
xn-wan3.0,0.455,per_request
omni-v2v,1.15128,per_request
sd7-seedance-2.0-720p,6.37,per_request
seedance-2.0-fast-480p,0.325,per_second
xn-seedance-2.0-fast,0.715,per_second
minimax-h3,0.162,per_second
seedance2.0-B,4.725,per_request
grok-video-1.5,1.807,per_request
sd10-seedance-2.0-fast,3.77,per_request
sd4-seedance-2.5-480p,0.455,per_second
sd2.0-1080p-official,9.625,per_request
sd2.0-720p-fast-official,3.135,per_request
xn-seedance-2.0,6.63,per_request
sd4-seedance-2.0,6.37,per_request
xn-seedance-2.0-second,1.859,per_second
omni-fast-no-water,1.053,per_request
sd4-seedance-2.0-fast,5.07,per_request
sd5-seedance-2.0,3.77,per_request
sd11-seedance-2.0,5.85,per_request
sd11-seedance-2.0-fast,4.55,per_request
seedance-2.5-B-720p,5.775,per_request
sd8-seedance-2.0,3.77,per_request
wan3.0-video,6.37,per_request
sd6-seedance-2.0-720p,5.98,per_request
seedance2.0-fast-F-720p,3.78,per_request
seedance-2.0-0826-pfv,4.725,per_request
sd10-seedance-2.0,5.07,per_request
xn-seedance-2.5,1.872,per_second
seedance-2.0-mini,3.77,per_request
seedance-2.0-4k,5.85,per_second
seedance-2.0-mini-8s,1.937,per_request
veo-3.1-fast,1.17,per_request
wan3.0-15s,2.587,per_request
seedance-2.0-fast-720p,0.975,per_second
sd7-seedance-2.5-720p,0.897,per_second
sd6-seedance-2.0-1080p,1.157,per_second
seedance2.0-0826,4.725,per_request
seedance2.0-A,0.675,per_second
xn-seedance-2.0-fast-cnt,5.07,per_request
sd2.5-720p-official,5.775,per_request
sd9-seedance-2.5-discount,0.897,per_second
sd9-seedance-2.5,0.897,per_second
seedance-2.5-480p,0.767,per_second
omni-fast-v2v,1.15128,per_request
gemini-omni-flash,0.975,per_request
sd7-seedance-2.5-480p,0.767,per_second
sd10-seedance-2.0-mini,3.77,per_request
agv-seedance2.0fast,0.91,per_request
minimax-h3-768p,4.55,per_request
grok-imagine-video-1.5,0.416,per_second
sd2.5-1080p-official,14.443,per_request
seedance-2.0,6.37,per_request
xn-minimax-h3,3.64,per_request
sd11-seedance-2.5,16.64,per_request
seedance-2.5-720p,0.897,per_second
omni-v2v-no-water,1.3455,per_request
sd10-seedance-2.5,6.37,per_request
seedance-2.0-480p,0.585,per_second
seedance2.0-fast-B,4.05,per_request
grok-video,0.897,per_request
omni-fast-v2v-no-water,1.3455,per_request
sd11-seedance-2.0-mini,2.86,per_request
sd8-seedance-2.0-fast,2.47,per_request
minimax-h3-4k,7.28,per_request
seedance2.0-F-720p,5.67,per_request
sd4-seedance-2.0-mini,4.55,per_request
veo-3.1,1.287,per_request
seedance-2.0-720p,1.2675,per_second
seedance2.5-A,0.8775,per_second
sd7-seedance-2.0-1080p,7.67,per_request
sd4-seedance-2.5-720p,0.585,per_second
sd2.0-720p-official,3.85,per_request
grok-imagine-video-6s,0.39,per_request
sd8-seedance-2.5,5.07,per_request
kling-3.0-pro,3.77,per_request
omni-fast,0.86112,per_request
sd5-seedance-2.0-fast,2.47,per_request
xn-minimax-h3-second,0.364,per_second
seedance-2.0-fast,4.55,per_request
seedance-2.0-1080p,7.67,per_request
seedance2.0-F-1080p,9.45,per_request
minimax-h3-2k,5.85,per_request
seedance2.0-E-720p,5.67,per_request
seedance-2.0-C,5.13,per_request

## 3. 分家族速览
- Seedance 2.0：agv-seedance2.0fast ¥0.91/条；seedance-2.0-fast ¥4.55/条；sd4/sd8/sd10/sd11-seedance-2.0 ¥3.77–5.85/条；480p ¥0.585/秒；720p ¥1.2675/秒；1080p ¥7.67/条；4K ¥5.85/秒。
- Seedance 2.5：sd9-seedance-2.5 ¥0.897/秒；sd7-…-720p ¥0.897/秒；sd8-seedance-2.5 ¥5.07/条；sd11-seedance-2.5 ¥16.64/条；sd25-30s ¥0.27/秒（30 秒长片）。
- MiniMax H3：minimax-h3 ¥0.162/秒；minimax-h3-768p ¥4.55/条；minimax-h3-2k ¥5.85/条；minimax-h3-4k ¥7.28/条；xn-minimax-h3-second ¥0.364/秒。
- Kling 3.0（快手可灵）：kling-3.0 ¥1.82/条；kling-3.0-omni ¥1.82/条；kling-3.0-pro ¥3.77/条。
- Grok Imagine Video：grok-imagine-video ¥0.104/秒（全场最便宜）；-1.5 ¥0.416/秒；grok-video ¥0.897/条；-6s ¥0.39/条。
- Wan 3.0（通义万相）：xn-wan3.0 ¥0.455/条；wan3.0-15s ¥2.587/条；wan3.0-video ¥6.37/条。
- Google Veo：veo-3.1 ¥1.287/条；veo-3.1-fast ¥1.17/条。
- Omni：omni-fast ¥0.86112/条；omni-v2v ¥1.15128/条；去水印版 ¥1.053 / ¥1.3455。

## 4. 建议接入（用户价 = 成本/(1−54%)，1 元 ≈ 3819 units）
| 建议档位 | routeId | 成本 | 建议用户价 | 说明 |
|---|---|---|---|---|
| 极速档 | grok-imagine-video | ¥0.104/秒 | 8 积分 / 8 秒 | 最便宜可用路线，试稿与批量 |
| 可灵档 | kling-3.0 | ¥1.82/条 | 16 积分 / ¥4.1 | 第三方认知度最高 |
| 可灵 Pro | kling-3.0-pro | ¥3.77/条 | 21 积分 / ¥5.4 | 高质量第三方 |
| Veo 档 | veo-3.1-fast | ¥1.17/条 | 17 积分 / ¥4.3 | Google 品牌，好讲 |
| 通用档 | xn-wan3.0 | ¥0.455/条 | 10 积分 / ¥2.5 | 国产主流性价比 |
| MiniMax 2K | minimax-h3-2k | ¥5.85/条 | 沿用隐藏档 ¥14.9（57 积分，毛利 60.7%） | 只需把台账成本 0.76 改成 5.85 再开公开 |
| Seedance 2.5 | sd7-seedance-2.5-720p | ¥0.897/秒 | 24 积分 / 8 秒 | 画质升级档 |

结论：一把 IP233 key 覆盖全部 124 个模型（上述家族全含），接模型不需要新 key；
唯一缺的 key 是可用的 LLM（DeepSeek 那把已 401 失效），文案/策划/分析链路都受影响。
