# TapNow 超级体验官 - 深度测试日志

**会话目标**: 真实用户姿态体验 TapNow/liblib/老鱼 三个画布平台，全部交互亲做，不消耗扣费生成/导出。
**工作树**: F:/da/shubao/.worktrees/codex-ecommerce-stability
**数据落点**: docs/reports/canvas-shots/super-test/{site}/ + docs/reports/canvas-trace/super-test/{site}/ + 本文件
**纪律**: 死前必输 PROGRESS 状态, 不主动退, 全部 3 阶段做完才结束

## 时间线 (北京时间)

| 时:分:秒 | 阶段 | step | 事件 |
|---|---|---|---|
| 13:23:17 | 启动 | 0 | 切到 tab 26 (TapNow 主画布), snapshot 画布 1, 截图 step-00 |
| 13:23:49 | A | 1 | 切到 tab 30 (Creative OS 新手教程), 这就是公共模板"INS风格自拍生成" |
| 13:24:00 | A | 1 | 截图 step-01-public-template, 确认工作流节点: MJ图片自动生成, 换脸, 脸部打码, MJ Prompt, 最终视频, AI自动描述, AI自动打标, 上传模特, Tech Product Ad, Text |

## Phase A 计划 - TapNow 公共模板工作流

公共模板"INS风格自拍生成"工作流: 改图 → 生成视频 → 给视频打码 → 用提示词再扩 → 多创几条 → 改其中一条

PROGRESS: Phase A 0/6 子项完成
下一步: 关闭"发现新版本"通知弹窗, 缩放到合适位置, 双击 MJ Prompt 节点展开检查
