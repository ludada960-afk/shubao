# Video export manifest slice

## Goal

为视频项目工作台建立一条可恢复、可审计的交付边界：在不调用视频供应商、不扣积分、不伪造 MP4 的前提下，把已经确认的时间线、裁剪、音轨和字幕元数据编译成持久化导出清单。清单是后续渲染 worker 的唯一输入契约，也是“做同款/查看创作过程”可以复用的稳定记录。

## Constraints

- 只接受当前项目、当前选定、未过期的候选视频版本；空时间线、失效镜头、错误媒体类型和越界裁剪必须失败关闭。
- 清单不得持久化播放签名 URL、会话信息或 owner 数据；使用稳定素材引用、内容 hash 和结构化参数。
- 相同项目与相同规范化输入必须幂等返回同一份清单；失败不产生计费或渲染任务。
- UI 文案必须明确“仅生成可审计交付清单，尚未调用渲染器”，不能让用户误以为已有可下载视频。
- 本切片不改 Home、productionCase、gallery publisher 或电商展示生成脚本。

## Architecture

`videoExportManifest.mjs` 负责纯函数规范化、业务校验和 SHA-256 指纹；`videoWorkbenchStore.mjs` 负责 SQLite 持久化与 owner/project 隔离；`videoWorkbenchRoutes.mjs` 暴露创建、列表、读取接口；客户端与工作台只消费清单状态。真正的渲染器、对象存储输出和供应商调用留给后续独立切片。

## Tasks

1. 先为 manifest normalizer、store、route、client helper 和 UI contract 写失败测试。
2. 实现规范化与 hash，保证去掉 owner/URL 后输入稳定。
3. 新增 `video_export_manifests` 表和 owner-scoped CRUD，支持 hash 幂等。
4. 增加工作台导出准备接口和客户端方法。
5. 在时间线/声音区增加“生成导出清单”反馈与最新清单状态。
6. 跑 focused tests、全量 tests、`npm run check`、`npm run build`、`git diff --check` 和视频工作台 pilot verifier。
7. 更新长期路线与 `.superpowers/sdd/progress.md`，记录本地完成项、未接入渲染器的明确边界；未经发布门禁与生产证据不得宣称上线。

## Follow-up milestones

- P1：外部渲染 worker、代理视频/音频、可恢复任务状态、下载/导出权限。
- P2：逐镜头候选进入时间线、首尾帧/音频节拍绑定、版本回滚与项目克隆。
- P3：秒级重拍、延长、追踪替换、模型路由和质量/成本学习。
