# 商品档案 (project_assets / product-profile) 现状盘点

> 4c183cd4 续命. 主线程直接盘点, 不依赖子代理 (子代理 read 工具不稳).

## 关键里程碑 commit

- **e4203c00** feat: add reusable project asset lookup boundary (可复用边界)
- **de830674** feat: unify asset library as central hub with cross-feature integration (中心枢纽)
- **98996455** feat: material library default to user-owned inputs (generated images stay in works)
- **0c439730** feat(ecommerce): product-profile system with tabbed rail, current-product chip and generation auto-archive
- **938e8b97** feat(server): cascade retention downgrade into work deletion (WORK_ASSET_CASCADE)
- **4fc58926** feat: unify project asset library reads
- **09b6cad0** feat: add structured project asset metadata
- **081ecbb7** feat: add cross-domain project asset contract
- **e9fef88c** feat: expose project asset lineage
- **b16e221e** fix: remint project media playback URLs
- **3d61c566** fix: scope retention protection by owner
- **1d71c2d9** fix: enforce owned canonical asset URLs
- **62d48dcb** fix: reject external project result assets
- **a3d860b1** fix: preserve ecommerce asset identity
- **859e97f2** fix: verify cross-project asset lineage
- **b7956568** fix: sanitize Canvas session snapshots at storage boundary

## 已实现 (主流程)

- 素材库作为中心枢纽 (de830674) - 全站统一入口
- 可复用项目资产查找边界 (e4203c00)
- 用户自有素材库 vs 作品生成图分离 (98996455)
- 商品档案 (product-profile) tabbed rail + current-product chip (0c439730)
- 生成时自动归档到 product-profile
- 跨域项目资产契约 (081ecbb7)
- 跨项目资源 lineage (e9fef88c)
- retention 保留策略 (eada5f72, 5f7b409b, b7c7c55a)
- canonical URLs 强拥有权检查 (1d71c2d9, 62d48dcb)

## 已修复的安全问题

- reject external project result assets (62d48dcb)
- require verified video delivery metadata (3b686013)
- fail closed for unverified video assets (837dfae5)
- sanitize Canvas session snapshots (b7956568)
- scope retention protection by owner (3d61c566)
- preserve video source lineage (a3b0f1de)
- preserve ecommerce asset identity (a3d860b1)
- preserve active work assets (11a6c8e1)
- fail closed on unknown asset purpose (f5546649)
- enforce canonical project asset reuse (3ed59312)
- expose reusable asset lifecycle errors (77dff6e8)
- protect cross-project asset sources (6d9dd0ff)
- make asset retention pin idempotent (95abd8d6)
- recover content project terminal states (9c1ebbca)
- make project versions idempotent (e91a80fb)
- fail closed on ecommerce delivery (00d0796e)
- durable project version stores (c5bb5c9f)

## 跟 4c183cd4 原始规划对比

- ✅ 全站商品/素材库设计落地
- ✅ 跨项目 lineage
- ✅ retention 策略
- ✅ canonical URL 拥有权
- ⏳ 商品档案重构 - product-profile system 已落地 (0c439730), 看起来 4c183cd4 担心的"FK 级联"已修 (938e8b97 WORK_ASSET_CASCADE)
- ⏳ 孪生项 A patch modlens:646 - 这是 DSH 配置层面的事, 跟商品档案无关, 不在本盘点范围

## 结论

商品档案是 **完整可用的**, 4c183cd4 担心的几个问题:
- 商品档案 FK 级联 (bee004cf 续命代理做) - 已修 938e8b97
- 公开资料拆解保底 (a325bd62) - 已落地
- 商品档案落地实施 (d7dff595) - 已落地  
- 档案入口归一与宽度修复 (b022f5f5) - 应该在 4b4ab2b canvas 设计里

主线商品档案基本完善. 后续如果还要做, 看 subagent 们对其他线的报告 (孪生项 A 是单独的事).
