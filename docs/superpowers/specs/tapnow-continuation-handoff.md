# TapNow 复刻续作交接（W4/W5 + 运营待办）

> 写于 goal 轮次 29/30。已完成：W1 骨架(1ee0ee1/9c51097/8027d5a/2158d3d)、W2 本地持久化(685cf50)、W3 连线绑定(3754600)、拆解+证据(8bd0715/fd21f74@master/4f56f77)、选型(same 8bd0715)。

## W4 音频节点全接线
1. 服务端已备：createVideoAudioTrack/updateVideoAudioTrack（services/videoWorkbench.js）——先读 server 路由确认 payload 形状
2. UI：Flow 视图音频资产卡加「加入音轨」按钮 → 调 createVideoAudioTrack({ shotId?, assetId, ... })；时间线抽屉音轨区显示
3. TTS 口播：需选供应商（候选：MiniMax TTS/ElevenLabs/火山），走 provider-neutral 底座新建 tts SKU + hold/settle；密钥走 .env 不入库
4. 卡点 beatMarkers：webaudio-analyser 类库离线检测，存 track.markers[]

## W5 ffmpeg 导出渲染 MVP
1. 服务器装 ffmpeg（部署脚本补一行）；node 侧 fluent-ffmpeg 或 child_process 直调
2. 队列：复用 export webhooks 队列基建；job 类型=render
3. 管线：manifest 片段→逐段渲染(含 trim/转场淡入淡出)→拼接→混音轨→字幕 burn-in 可选
4. 产物回写 asset + 通知；失败重试走既有 recover/retry API

## 运营/商业化待办（与代码无关但紧急）
- 定价 8 项拍板清单见 pricing-final-plan.html §6（标准档 11.9vs12.9 P0）
- Fast 档切 IP233 廉价通道(¥3.77/¥3.12)消除补贴告警
- MiniMax ¥0.76 成本首账单校准；1080p 上架前复核报价
- 部署：分支积压约 25 提交未上线，须用户授权走 server-deploy.sh
- 生产前端 bundle 落后导致 XHS 案例图不显示——部署即愈

## 已知风险
- pnpm-lock 与 package-lock 双态未收敛
- SSRF 无 DNS rebinding 防御
- Stripe webhook >100kb 413（接支付时单独放开）
