# 图+视频全生态统一调价提案（2026-08-26，只读核算产出）
> 方法：通读 server/billing/{catalog,upstreamLedger,unitEconomicsCatalog}.mjs、walletService 记账、adminOperations 口径与 test/billing-catalog.test.mjs 门禁；PowerShell 直抓 new.ip233.com/api/pricing 全量 28 模型实价，my.65535.space / change2pro.com / poke2api.com 公开页（三者定价页均需登录，静态不可得）；Photoroom 官网价页实抓；绘蛙/WeShop/美图设计室/Canva 直抓+Bing 快照；本地 works.db 无 usage_events 数据，综合毛利只能情景估算。未改任何代码。
> 核心口径：1 积分=1000 units；积分面值锚=¥199/760000·unit≈**¥0.2618/积分**（studio 档折价）；content_sets 面值 **¥3.3167/套**；毛利公式 m=1−3%支付费−成本/售价；**70% 门禁当前只在测试层执行**，运行时不拦截。

## A 现状表（售价积分｜折现¥｜记账成本¥｜隐含毛利）
| SKU 组 | 积分 | 折现¥ | 记账成本¥ | 毛利 |
|---|---|---|---|---|
| ec_image_2k（电商/画布生图主力） | 1 | 0.262 | 0.038 | 82.5% |
| ec_image_4k | 2 | 0.524 | 0.038 | 89.7% |
| nano_flash/pro_1k・**2k 同价** | 各1 | 0.262 | 0.060 | 74.1% |
| nano_flash/pro_4k | 2 | 0.524 | 0.060 | 85.5% |
| xhs_image_set_2k（封面+8图） | 9 | 2.357 | 0.342 | 82.5% |
| extension analysis/basic/std/complete | 1.5/3/5/9 | 0.393/0.786/1.309/2.357 | 0.09/0.114/0.19/0.342 | 74.1%/82.5%/82.5%/82.5% |
| ai_assistant/reverse_prompt/canvas_ocr | 0.2 | 0.052 | 0.010 | 77.9% |
| remove_bg | 0.5 | 0.131 | 0.030 | 74.1% |
| direction_refresh/video_plan_analysis | 1 | 0.262 | 0.050 | 77.9% |
| smart_layer/layer_psd | 3 | 0.786 | 0.200 | 71.5% |
| video_seedance_fast_short（≤8s） | 40 | 10.47 | 5.07 | **48.6% ✗** |
| video_seedance_fast_long | 46 | 12.04 | 5.07 | **54.9% ✗** |
| video_seedance_standard_short | 62 | 16.23 | 5.07 | **65.8% ✗** |
| video_seedance_standard_long | 72 | 18.85 | 5.07 | 70.1% 压线 |
| video_minimax_h3_2k_short（隐藏） | 68 | 17.80 | 5.45*估 | **66.4% ✗** |
| video_minimax_h3_2k_long（隐藏） | 78 | 20.42 | 5.45*估 | 70.3% |
XHS 套餐按套零售 ¥6.33/4.90/3.96/3.32，单套上游成本≈¥0.36（9 张 gpt-image-2+文案 token），套餐毛利 >94%。

## B 图片模型真实单张成本核实（2026-08-26 实抓）
- **IP233（公开价 API，高置信）**：gpt-image-2 平价 **¥0.0195**/张；分级档 1k/2k/4k=¥0.0715/0.0975/0.1235；mdkj-super 全尺寸 ¥0.026；nano-banana ¥0.156；nano-banana2 1k/2k/4k=0.0975/0.143/0.1885；nano-banana-pro 1k/2k/4k=0.117/0.169/0.247；seedance-2.0 720p **¥5.07**、1080p ¥6.37（与账本一致）。⚠️ 账本里的 seedance fast(¥3.77)/mini(¥3.12)/2.5 系列**已从 IP233 价表消失**，同站降级阶梯失效。
- **65535（登录墙，中置信）**：无法静态复核今日价；用户参考 gpt-image-2 $0.038/次与账本一致，且该站人民币 1:1 结算政策未变 → 生产口径 ¥0.038/张 暂维持。seedance-native 75 折按 token、veo/grok-imagine-video $0.18/s 为用户提供参考值，未验证。
- **change2pro（登录墙，中低置信）**：Nano Banana 特惠组 ¥0.06/张 的组倍率无法匿名核对；市场对照 IP233 nano 全系 ¥0.098–0.247。
- **poke（无公开价，低置信）**：MiniMax H3 维持 0.2× 折后估算 ¥5.45/条，待首张账单校准。
- **结论区间**：gpt-image-2 系 **¥0.02–0.124/张**（记账 0.038 处于区间下半段；若切 IP233 分辨率档成本×2.6–3.2）；nano 系 **¥0.06–0.25/张**（0.06 依赖特惠组存续）。

## C 第三方成品工具零售带（抓不到的标经验值）
| 工具 | 实抓结果 | 单张/单套等效 | 置信 |
|---|---|---|---|
| Photoroom | 结构实证：Pro 8000 credits/月、Max 25000、Ultra 75000，年付省33%；价格数字JS渲染未捕获 | Pro≈$9.99/月→$0.01–0.05/张 | 结构高/数字中 |
| WeShop 唯象 | 注册送 200 算力点实证；价页需登录 | 会员≈¥99–399/月→¥0.5–3/张 | 低 |
| 绘蛙 | 官网超时未抓到 | 会员≈¥39–99/月→¥0.3–2/张 | 低 |
| 美图设计室 | 价页需登录 | 会员≈¥30–40/月，点数制 | 低 |
| Canva 中国 | 403 | 国际 Pro≈$15/月（经验） | 中低 |
| 人工外包锚 | 行业常识 | 电商套图一套 ¥50–500 | 中 |
我们 9 图套图面值 ¥2.36 显著低于成品工具与人工外包 → 图片侧零售端有充足空间，无需靠压毛利换增长。

## D 分层毛利门禁（重推，替代一刀切 70%）
- **引流档 40–55%**：helpers/ocr/remove_bg/assistant/reverse_prompt/direction_refresh/plan_analysis + xhs_entry。理由：拉新漏斗、单次成本≤¥0.05，补贴换活跃；配"绝对成本上限+频控"防刷量套利，防止低于 40% 被白嫖成免费接口。
- **主力档 60–70%**：电商生图全系、nano 全系、extension、smart_layer/psd、xhs 套图、seedance 标准/fast 短档。理由：收入主体，须内化视频失败重试损耗与上游 ±30% 波动；对标 SaaS 健康线 70% 取下限弹性。
- **高端稀缺档 ≥70%（目标 75%+）**：4K/pro 档、全部长时长视频、minimax 2K、未来 veo/grok。理由：专业交付需求价格刚性强，稀缺产能应贡献溢价与上游涨价缓冲垫。
- 执行位调整：门禁从仅测试层提升为 catalog 加载断言 + admin 看板告警双保险；沿现有 cost_source/cost_confidence 字段落审计标记。

## E 最终建议价与预期综合毛利
| SKU | 现积分 | 建议积分 | 建议毛利 | 说明 |
|---|---|---|---|---|
| ec_image_2k / 4k | 1 / 2 | 不变 | 82.5%/89.7% | 主力健康，failover 应急预案见 B |
| nano_flash/pro_1k | 1 | 不变 | 74.1% | 引流平替定位保留 |
| nano_flash/pro_**2k** | 1 | **1.5** | 81.7%（特惠组）/60.6%（IP233 情景） | 修复 2K=1K 同价异常，兼容上游切换 |
| nano_flash/pro_4k | 2 | 不变 | 85.5% | 高端档达标 |
| xhs_set_2k 及 extension/helpers 全系 | 现值 | 不变 | 71–86% | 全部达标 |
| video_seedance_fast_short | 40 | **52** | 59.8% | 试稿档归入主力下限 |
| video_seedance_fast_long | 46 | **58** | 63.6% | |
| video_seedance_standard_short | 62 | **65** | 67.2% | |
| video_seedance_standard_long | 72 | **75** | 71.2% | |
| video_minimax_h3_2k_short | 68 | **70** | 67.3%（成本估算） | 解锁公开前再校准 |
| video_minimax_h3_2k_long | 78 | **82** | 71.6% | |
| XHS 套餐（P2 可选） | 3/10/25/60 套 | studio 60→50 套 | 变相提价 20% | 内容钩子暂不动价 |
预期综合毛利（情景估算，中低置信）：按面值额图片 60%/视频 40% 混合，图片加权≈82%、视频加权由现 62.7%→66.8%，综合由 ≈74%→**≈76%**；同时获得 nano/IP233 failover 情景下仍 ≥60% 的抗涨价韧性。本地库无 usage_events，上线后以 admin bySku 实测校准。

## F 与旧后台核算的差异清单
1. 后台 grossProfitFormula=面值收入−记账成本，**不含 3% 支付费**；catalog 门禁含 → 双口径并存，建议后台补"净贡献"列。
2. 面值按最优惠档 ¥0.2618/积分计：trial 用户实付 ¥0.33/积分被低估 26%，方向保守安全。
3. upstreamLedger 快照停在 2026-08-12：IP233 fast/mini/2.5 降级路由消失未反映；IP233 新增的廉价通道（gpt-image-2 ¥0.0195、mdkj-super ¥0.026、nano-banana2 全档）未纳入备选池。
4. 视频 4 档跌破门禁仅在测试里"锁定已知风险"，无产品决策落点——本文件即该决策提案。
5. MiniMax ¥5.45/条仍是零账单估算（cost_confidence=low），首单必须回填校准。
6. nano 2K 与 1K 同价的隐含补贴此前未单列披露。

## G 置信度总标
高：代码现状、门禁位置、面值口径、IP233 全量实价、Seedance ¥5.07、Photoroom credit 结构。
中：65535 ¥0.038 存续性、人工外包锚、Canva 国际价、情景综合毛利区间。
低：change2pro 特惠组倍率现状、MiniMax ¥5.45、绘蛙/WeShop/美图设计室具体价位、真实用量混合比例。
后续必办：①65535/change2pro 登录复核组倍率 ②MiniMax 首账单校准 ③admin 补净贡献列与门禁告警 ④IP233 廉价通道接入评估（可把图片边际成本再降 30–50%）。
