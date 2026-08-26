# 生产链路真实演练报告（2026-08-26）

授权：真实生成演练；红线内消耗：套图一次 + 万物上身一次 + 数次试错（未产生重复计费）。

## A 失败率历史基线（生产库 works.db，近14天）
- 任务级：电商生图 189 单 = completed 158 / failed 30 / needs_review 1，表观失败率 15.9%；
  其中「AI 积分不足」23 单为业务性拒绝，**真实系统失败率 ≈ 4.2%（7/166）**。
- 资产级（全量1009）：completed 915 / failed 18 / needs_review 76，硬失败仅 1.8%，
  needs_review 7.5% 全部为质量门（complete suite 43、product_truth 12、sharp 11、manual 10）。
- TOP 失败模式：①积分不足(业务)②未生成可交付图片③duplicate commercial duty④asset plan 空
  ⑤上游超时×4⑥安全审核拒绝×3⑦上游不可达×2⑧"deployment cannot store file"×1（已扣上游未交付）。
- 视频链路：近14天零任务（P1 未商业化）。支付订单：0。成本口径：14天消耗 53万单位=530积分，上游成本 ¥20.62。
- 日志侧：design-directions PLANNER_TIMEOUT 降级高频（8/12–8/24 每日多次）；"生成图片暂时无法保存"×5。

## B 演练时间线（本地 dev + 生产 shuimg.cn 双环境）
1. 本地 dev（:3001）：登录→上传→建项目→素材入库→商品档案→9图方案→受理成功（ec_254405a0），
   但本地缺 IMAGE/NANO/LLM/MINI 网关密钥 → **任务永久 generating 40+分钟、9000 积分冻结、
   清扫每120s无限可重试重试、dismiss 409 无法取消** —— 复现为 P0 级缺陷证据。
2. 生产套图（canary 会话，tester 钱包）：上传→项目→档案→方案(degraded=false,46s)→报价9000→
   生成 ec_417ea95f **completed：9/9 稳定资产，187s，含1次供应商级自动重试，结算精确**。
3. 生产万物上身：第1次 400 duplicate asset id（同图三角色被内容寻址去重——合理校验）；
   第2次 400 smart模式不可带人物素材（模式语义约束）；第3次 **failed："asset plan must contain
   at least one item"，12s 快速失败且0扣费（hold 正确释放）**，与生产历史08-14/15两条同型；
   第4次改用 UI 同款 sizing 键 main_3x4 → ec_f9624298 **completed：1资产，60s，扣1000**。

## C 已修复项（diff stat：3 files, +75/-2，均通过聚焦测试）
- server/ecommerceEngine/ecommerceBilling.mjs (+17)：settle metadata 补 feature/provider/model，
  usage_events 不再空串，成本与失败可按供应商归因（content-billing 37/37 通过）。
- server/adminOperations.mjs (+29)：监控分离 billingRejected/systemFailed 与 systemFailureRate，
  新增全时段 TOP 错误分组（admin-video-cost-board 2/2 通过）。
- server/index.mjs (+28)：design-directions 降级计数进 /health（plannerFallbacks/degraded/served）；
  generate-ecommerce 入口 fail-fast：网关未配置直接 503 IMAGE_PROVIDER_UNAVAILABLE，
  杜绝收单后无限冻结（route-guard 等 22/22 通过）。

## D 遗留风险
- 本地 dev 滞留任务 ec_254405a0（9000 冻结）留作缺陷证据，待部署后由新 fail-fast 门+清扫收敛；
- 上游持续不可用时仍依赖 120s 清扫循环兜底，缺少"每资产重试上限→终态失败+退费"的硬闸（建议 P1）；
- "duplicate asset id"/空方案等报错文案偏技术，未完全满足"就近且用户可懂"标准；
- usage_events 历史存量 feature/provider 为空，供应商归因只能从修复日起算；
- 服务器磁盘 88.9% 高位，备份/generated-assets 生命周期策略仍未落地。

## E 稳定性结论（能否支撑商业化量级）
- 主链路（上传→档案→方案→计费→生成→交付→对账）：**可以支撑当前内测→小规模商用过渡**：
  两笔真实任务账务零误差、资产 10/10 交付、失败快速退费、质量门与重试有效。
- 商业化放量前必须补齐：①上游持续故障的每资产重试上限与自动退费硬闸；②告警接线
  （/health designDirections 与监控 TOP 错误已有数据源，需接通知渠道）；③磁盘治理。
- 路由权重建议（沿用 index.mjs 注释留档）：视频类国内中转（65535/poke2api）优先、IP233 作按条兜底；
  生图类维持 image2(65535) 主路由 + nano-banana 备用，按本报告新增的 provider 遥测周度复核权重。
