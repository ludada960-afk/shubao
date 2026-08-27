# 跨模型图像协作能力 · 长期方案（Vision Bridge + Annotation）

> 目的: 不论切到哪个 LLM (M3/Codex/Claude/Gemini…), 用户都能用「粘贴图片 → 批注 → 把结构化文本喂回对话」的方式精准表达 UI/视觉需求。
>
> 能力 = 视觉桥(把图转结构化文本) + 批注层(用户在图上点位置+写备注) + 跨模型注入(把批注段塞进对话)。不绑特定模型,模型只负责读懂结构化文本。

## 三层架构

### 1. 视觉桥层 (已落库 server/services/visionBridge.mjs + server/routes/visionRouter.mjs)
- Provider-agnostic: 任何 OpenAI 兼容的 VLM 都可接入
- 加载本地 keyring: .env.d/vision-keyring.json (不入 git)
- 多 provider 轮换: round-robin + 权重 (解决单 key 周额度耗尽)
- 当前已配置: maas-pri(主力) + maas-sec(备用), 都是阿里 Maas 的 qwen3-vl-plus
- 切换模型 = 改 keyring, 代码不动

### 2. 批注层 (项目内 /#/vision 面板 + TapNow 实测的 DSH 原生批注补丁二选一)
- 项目方案: 浏览器上传图片 → 拖框批注 → 调视觉桥 → 出结构化文本 → 复制粘贴回对话
- DSH 方案: DSH 原生 composer 批注插件 (C:\Users\SHEJI\.dsh\annotation-patch\), 需要 DSH 端打补丁
- 两种任选其一,效果一样: 坐标+OCR+批注+意图的结构化文本出现在对话

### 3. 跨模型注入
- 任何纯文本 LLM 都能看到图——通过结构化文本
- 不需要模型本身支持 vision API
- 完整复现文档: F:\da\shubao\.tmp-anno-verify\handoff\DSH-IMAGE-ANNOTATION-REPRODUCTION.md

## 关键路径文件

| 路径 | 用途 |
|---|---|
| .env.d/vision-keyring.json | 多 provider + key 轮换 (本机保护, 不入 git) |
| server/services/visionBridge.mjs | 视觉桥: 调 modlens 子进程, 轮换选 provider |
| server/routes/visionRouter.mjs | POST /api/vision/annotate 上传+批注+分析 |
| src/pages/VisionFeedback/index.jsx | 浏览器端批注面板 (hash 路由 /#/vision) |
| docs/superpowers/specs/tapnow-canvas-teardown.md | TapNow 实测全集 (128 截图 + 28KB 报告) 作为画布 UI 借鉴源 |
| C:\Users\SHEJI\.dsh\annotation-patch\ | DSH 原生批注补丁 (DSH 端方案) |
| scripts/retry.mjs | shell 无限重试包装 (防 npm test 429 互踩) |
| docs/superpowers/specs/tapnow-continuation-handoff.md | W4/W5 续作路线图 |

## 切模型时需要做的

1. 若新模型支持 vision API → 直接看图, 跳过本方案
2. 若新模型是纯文本 → 本方案已就绪, 直接用 /#/vision 面板出结构化文本喂给它
3. 若需加新 VLM provider → 改 .env.d/vision-keyring.json, 代码不动

## 已知约束

- 本机 modlens 引擎必须能跑 (npx @liustack/modlens doctor 通过)
- 批注层是浏览器端交互, 需要用户能开 5173 端口
- key 曾在 chat 日志泄露过; 建议日后切模型时重新签发 + 不在 chat 里贴明文
- keyring 是本机保护 (base64 mask + 文件权限 0o600), 不防恶意软件; 真要敏感环境建议 OS keychain