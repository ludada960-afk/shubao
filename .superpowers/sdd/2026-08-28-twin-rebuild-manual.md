# 孪生项 A 重建手册 (modlens vision 图片批注)

> 4c183cd4 续命. 用户原话: "切模型没回应, 因为我孪生项 A 的 patch 真丢了".

## 症状 (用户口述)

- 4c183cd4 时代在 C:\\Users\\SHEJI\\.dsh\\profiles\\web\\cordis.patch.yml 里有完整孪生项 A 配置 (pasteToPath: false + families 列表)
- 4c183cd4 时代有 C:\\Users\\SHEJI\\.dsh\\annotation-patch\\rebuild.cjs (一键重打补丁)
- 4c183cd4 时代有 C:\\Users\\SHEJI\\.dsh\\annotation-patch\\anno_source.js.txt (批注层源码)
- **现在 2026-08-27**: cordis.patch.yml 是 [],annotation-patch/ 整个目录不存在
- 原因: 8-25 DSH 自我更新干净还原 + 8-27 豆包方案 Remove-Item -Recurse -Force $env:USERPROFILE\\.dsh (但只删了 .dsh,没还原 patch)
- 结果: 切到 MiniMaxAI/MiniMax-M3 后无法粘图批注, 用户发图没回应

## 重建依赖 (4c183cd4 时代留下的完整复现手册)

| 文档 | 位置 | 用途 |
|------|------|------|
| **DSH-IMAGE-ANNOTATION-REPRODUCTION.md** | F:\\da\\shubao\\.tmp-anno-verify\\handoff\\ | 完整复现手册, 7 步 + 9 踩坑 + 10 验收 |
| ASK-PROMPT-FOR-MINIMAX.md | F:\\da\\shubao\\.tmp-anno-verify\\handoff\\ | 问 MiniMax 模型的 prompt |
| ASK-TWIN-FIX.md | F:\\da\\shubao\\.tmp-anno-verify\\handoff\\ | 孪生项修复 prompt |
| MODLENS-TWIN-TROUBLESHOOTING.md | F:\\da\\shubao\\.tmp-anno-verify\\handoff\\ | ModLens 孪生项故障排查 |

## 7 步复现 (DSH-IMAGE-ANNOTATION-REPRODUCTION.md §7 摘要)

1. **Step 1 环境准备**: 确认 DSH 路径, 用户登录态, MiniMax-M3 API key
2. **Step 2 修 ModLens getter 崩溃**: dist/main.js 的 error.message = message 加 try/catch
3. **Step 3 写 cordis.patch.yml**: pasteToPath: false + families: [ox, gpt, deepseek, glm, qwen, opencode, zai, anthropic, moonshot, kimi, minimax]
4. **Step 4 放补丁套件**: 4 个文件到 C:\\Users\\SHEJI\\.dsh\\annotation-patch\\(anno_source.js.txt, rebuild.cjs, README.md, modlens-孪生体-fix.cjs)
5. **Step 5 跑补丁**: node C:\\Users\\SHEJI\\.dsh\\annotation-patch\\rebuild.cjs
6. **Step 6 选择视觉模型**: 在 DSH 模型选择器选 "MiniMaxAI/MiniMax-M3 (modlens vision)" 孪生项
7. **Step 7 重启 DSH**: dsh web, 验证孪生项出现在模型列表

## 9 踩坑清单 (§9 摘要 - 必读)

1. 缩进必须 2 tab (与原生 client.js 一致), 4 空格会爆
2. splice(insertAt, 0, para) 用 0 不是 1
3. React 18 setState updater 不能放副作用
4. 批注段标题中文冒号是 U+FF1A, 不是 ASCII
5. profiles\\node_modules 与全局 dsh 同 inode 硬链接, 改一个会双写
6. 纯 transform/opacity 动画, 零额外依赖
7. 切孪生体后必须重启 DSH 才生效
8. cordis.patch.yml 修改后必须 DSH 重启
9. anno_source.js.txt 必须用 §4.2 注入位置 (锚点 1 之前), 错位会破坏 client.js 语法

## 重建时序 (4c183cd4 用户的核心约束)

- **DSH 必须关闭** 才能改 C:\\Users\\SHEJI\\.dsh\\profiles\\web\\client.js (会重新写回, 覆盖补丁)
- 4c183cd4 时代做法: 关 DSH -> 跑 rebuild.cjs -> 重启 DSH
- 主线程不能帮关 DSH, 只能准备好脚本, 您自己操作

## 主线程已经做

- 7.93MB VSS 副本完整恢复 (RTK.md + MEMORY.md 都有)
- handoff/ 目录 4 文档完整保留
- 现在 commit 到主 worktree, 长期保存

## 验证 (§10 验收清单)

- 切到 (modlens vision) 孪生项, 粘图 -> 出现缩略图
- 点缩略图 -> 弹大图灯箱
- 点大图 -> 红点 + 输入卡
- Enter 固化 -> 编号定位点
- 完成批注 -> 写回输入框为结构化文本
- 同名第二张 -> 自动 #2 后缀, 两段共存

## 用户必须做的 (主线程不能做)

- **关 DSH** (在 dsh web 父 PowerShell Ctrl+C)
- **跑 rebuild.cjs** (我会先准备好脚本)
- **重启 DSH** (dsh web)
- **验收** (按 §10 清单逐条)

## 主线程下次可帮做的 (DSH 关闭时)

- 4 个 handoff 文档 commit 到主 worktree
- 写一份一键重建脚本 .superpowers/sdd/scripts/rebuild-twin-a.mjs (Node 跨平台, 不用 cmd /c 嵌套)
- 准备 4 个 patch 套件文件, 跟原版字节级一致

## 风险

- DSH 自我更新会再次清空 patch, 4c183cd4 时代发生过 2 次 (8-25 一次, 您还说 8-22 一次)
- 建议: rebuild.cjs 加 DSH 版本检查, 自动检测 patch 是否还在
