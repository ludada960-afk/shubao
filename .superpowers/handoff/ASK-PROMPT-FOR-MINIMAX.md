请帮我从零复现一个 DeepSeek Harness（DSH）客户端的扩展方案。完整的设计 + 代码 + 踩坑说明文档在我机器的这里：

  F:\da\shubao\.tmp-anno-verify\handoff\DSH-IMAGE-ANNOTATION-REPRODUCTION.md

也有一份直接可复用的补丁套件（4 个文件）：

  C:\Users\SHEJI\.dsh\profiles\web\cordis.patch.yml
  C:\Users\SHEJI\.dsh\annotation-patch\anno_source.js.txt
  C:\Users\SHEJI\.dsh\annotation-patch\rebuild.cjs
  C:\Users\SHEJI\.dsh\annotation-patch\README.md

**方案目标一句话**：让用户在 DSH 对话框里粘贴截图 → 点缩略图放大 → 在大图上点位置 + 写备注 → Enter 折叠成编号定位点 → 完成后写回对话框为结构化文本 `[图片批注：file.png]\n1. 坐标(50%, 60%)：改这里`。同时把 DSH 当前纯文本模型通过 ModLens 桥接成可看图模型。

**请你按以下步骤执行**：
1. 先用 read 工具读完整份复现文档（DSH-IMAGE-ANNOTATION-REPRODUCTION.md），把每一节都看完整再动手。重点是 §4（批注层补丁怎么打）和 §9（踩坑清单）。
2. 确认补丁套件 4 个文件在位。读 anno_source.js.txt 看完整源码（这就是要注入 client.js 的代码）。
3. 检查目标环境：
   - `node --check` 当前 client.js 是否已含 `AnnotationLightbox`（如果已含，跳到步骤 4 做完整性测试即可；否则跑 rebuild.cjs）
   - ModLens dist/main.js 的 `error.message = message` 是否已 try/catch
   - ModLens 引擎是否配置为 dashscope qwen3-vl-plus
4. 如果需重打：`node C:\Users\SHEJI\.dsh\annotation-patch\rebuild.cjs`，然后 `node --check` 验证语法。
5. 跑 §8 的 E2E 验证流程（用 browse CLI 自动化）。重点断言：
   - 贴图后点缩略图出暗色灯箱
   - 灯箱内点图出红点 + 输入卡
   - Enter 固化 + Escape 关闭
   - 完成批注后 textarea 有 `[图片批注：xxx]\n1. 坐标(...)：xxx` 段
   - 同名第二张自动带 `#2` 后缀，两段共存
6. 选模型时确认有 "(modlens vision)" 孪生项可切；用该模型发图+批注，回复应能精准提到坐标+备注。
7. 完成后给我一个验证报告：每条断言 ✅/❌ + 任何偏离 + 修复建议。

**重要约束**（来自 §9 踩坑）：
- 缩进必须 2 tab（与原生 client.js 一致），不要 4 空格
- splice(insertAt, 0, para) 用 0 不是 1
- React 18 setState updater 不能放副作用
- 批注段标题里的中文冒号是 U+FF1A，不是 ASCII 冒号
- profiles\node_modules 与全局 dsh 同 inode 硬链接
- 纯 transform/opacity 动画，零额外依赖

如果有不确定的地方，优先看 §9 踩坑清单；实在不行再问我。开始吧。