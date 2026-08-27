# 薯包周一切片·商业化 §6 — 8 项落定汇总

> 2026-08-26 周一切片 · 8 项 §6 待拍板项全部已独立 commit 落地。
> 工作树：F:/da/shubao/.worktrees/codex-ecommerce-stability
> 分支：codex/ecommerce-stability
> 风险/默认建议/落地步骤见 .superpowers/sdd/monday-slice-monetization.md。

## 8 项 commit 哈希

| # | 标题 | 短哈希 | 完整哈希 |
|---|------|--------|----------|
| #1 | monday-slice: #1 H3-2K long tier priced at ¥16.9 (1元=100分锚) | `751ab44e` | `751ab44ecc8e3736e8e9571d56cfb8c9a1bcabd2` |
| #2 | monday-slice: #2 standard tier A/B price experiment flag + byUserId split + admin byVariant | `0d0726aa` | `0d0726aa3a3f9c64829960065db830257a1e8e62` |
| #3 | monday-slice: #3 nano 2K price fix 1->1.5 credits + 7-day legacy transition | `d6c07e31` | `d6c07e31f5d9c7cb38b1cb7d796982bbba9f402e` |
| #4 | feat(billing): price defense plan + admin alert (item §6 P2 #4) | `88aa3ff8` | `88aa3ff8a12cb1beb0836c443054402c0126cbba` |
| #5 | monday-slice: #5 monthpack 30d + xcard_gift whitelist + admin byChannel | `23fa42d9` | `23fa42d962c0f89b3302fd2c614ce2ac3cc99fa5` |
| #6 | feat(billing): fast tier N=2 daily limit (default) with 7d ramp to N=3 (item §6 P1) | `fbe685c2` | `fbe685c24307d6c4ba228e04ad5cc3cede24a055` |
| #7 | monday-slice: #7 H3-2K gray-release invite codes (table + admin generator + public check) | `e793f773` | `e793f7738b2139e4da2443cbccf120eb4744266d` |
| #8 | monday-slice: #8 XHS studio 60→50 with 60-day legacy user snapshot | `7e0624c5` | `7e0624c5e88070b7fc351ea57f8c2f67faa725cd` |

## 收尾说明

- 本轮（#8）由本次会话新提交 1 项；其余 7 项 (#1/#2/#3/#5/#7 同 monday-slice 编号；#4/#6 同 §6 P1/P2 编号) 已由前任会话独立 commit 落地。
- 每个 commit 都带独立的 `.test.mjs` 定向回归，未跑 `npm test` 全量。
- 未部署，未触发真实账务/供应商/付费视频/真实生图。
- 共享工作树仍含视频、Canvas、资产、导航、运行态截图与历史构建产物等混合未提交改动；按 RTK 约定，本轮不视为已上线。
- 任何后续发布必须先按文件归属拆分，再走唯一入口 `scripts/deploy-production.ps1` 执行 full production gate。

## 验收证据（按项）

- #1 H3-2K long ¥16.9：catalog.priceFen 1490→1690；units 锚 1元=100分；h3-long-pricing.test.mjs 7/7。
- #2 标准档 A/B：priceExperiment.mjs 末 4 字符末位奇偶 50/50（奇=B ¥12.9，偶=A ¥11.9），env 关闭回 control；adminOperations byVariant 转化聚合；price-experiment.test.mjs 9/9。
- #3 nano 2K 修复：catalog ec_nano_flash_2k/ec_nano_pro_2k units 1000→1500；legacy_orders 表幂等；7 天窗口内老价结算，metadata.legacyPriceFen 已 stamp；nano-price-transition.test.mjs 9/9。
- #4 降价预案：priceDefensePlan.mjs 4 周 < 2% 触发线 + 720p ¥9.9 / 1080p ¥15.9 限时促销价机制 + admin bySku 告警；price-defense-plan 测试通过。
- #5 月卡细则：paymentChannels.mjs 月卡 SKU 30 天当月制 + 赠分限图/工具类；xcardWhitelist.mjs 硬限制；admin byChannel 收入聚合。
- #6 Fast N=2：fastDailyLimit.mjs 默认 N=2 + 7 天 ramp 至 N=3；runtime 开关 + admin bySku byDay 看板。
- #7 H3 灰度邀请：h3InviteCodes.mjs sqlite 表 + batch 50 个 / 7d 过期 / max_uses=1；CSV 导出 + admin 路由；公开端 validate 状态机 + 中文灰度文案；h3-invite-codes.test.mjs 10/10。
- #8 XHS 60→50：catalog xhs_studio_199 grantUnits 60→50；xhsLegacyProtection.mjs legacy_user_snapshot 表幂等 + 60 天保护窗口；resolveXhsStudioGrantUnits 保护期内 60 / 期外 50；xhs-legacy-protection.test.mjs 10/10。

—— 薯包项目总监子代理 · 周一商业化切片收尾 · 2026-08-26
