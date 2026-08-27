# W4 音频节点全接线 (从 4c183cd4 续命)

## 状态盘点 (handoff 交接单 + 实际代码)

- ✅ 服务端 createVideoAudioTrack/updateAudioTrack 已实现 (server/videoWorkbenchStore.mjs L100+, video_audio_tracks 表已建)
- ✅ 路由 app.post('/audio-tracks') / app.patch('/audio-tracks/:id') 已实现 (server/videoWorkbenchRoutes.mjs)
- ✅ 47/47 video-workbench-store.test.mjs 通过, 含 audio continuity 测试
- ✅ Client services createVideoAudioTrack/updateVideoAudioTrack 已 export (src/services/videoWorkbench.js)
- ❌ UI 「加入音轨」按钮 (asset card 上)
- ❌ UI 时间线抽屉音轨区渲染
- ❌ UI 音轨 mute 切换 + 乐观 revision 检查
- ❌ UI Volume 0..2 调整面板

## 实施步骤 (按 4c183cd4 "三遍+查漏" 风格)

### 阶段 1: Contract test 增量
1. 给 video-workbench-routes.test.mjs 加 audio track POST/PATCH 路由测试
2. 给 video-workbench-client.test.mjs 加 createVideoAudioTrack/updateVideoAudioTrack client 测试
3. 给 video-canvas-contract.test.mjs 加 audio node 渲染契约

### 阶段 2: UI 增量 (增量修改 VideoCanvasWorkbench.jsx)
1. 找到 asset card 中 audio 节点 (kind==='audio' || asset.kind in ['voice','music'])
2. 在 node footer 加 "加入音轨" 按钮 (复用 imBusy/handleAddToTimeline 模式)
3. 调 createVideoAudioTrack({ kind, assetId, assetVersionId, ... })
4. 在时间线抽屉内新增 "音轨" section, 渲染 workbench.audioTracks
5. 每条音轨加 mute 切换 (调 updateAudioTrack with expectedRevision)
6. 音量 0..2 slider (调 updateAudioTrack)

### 阶段 3: CSS
- 复用 vcb-export-btn / vcb-clip-head 样式
- 新增 vcb-audio-track / vcb-audio-meter 样式
- audio track 卡片有专属图标 (Music / Volume2)

### 阶段 4: 验证
- 跑 video-workbench-routes.test + video-workbench-client.test + video-canvas-contract.test
- 跑全量 node --test, 记录数字
- npm run check, build, git diff --check

### 阶段 5: Commit + 推进
- commit: feat(video-canvas): TapNow W4 batch - audio track add/mute/volume with optimistic revisions
- 同步更新 .superpowers/sdd/progress.md 和 RTK.md
- 给 4c183cd4-resumption.md 加 W4 状态

## 不在本次范围 (按 handoff 注明)

- ❌ TTS 口播 (MiniMax TTS / ElevenLabs / 火山) - 候选供应商, 走 provider-neutral 底座
- ❌ 卡点 beatMarkers 自动检测 (webaudio-analyser) - 离线检测, 存 track.markers[]
- ❌ 实际的 ffmpeg W5 渲染 - 见 W5 计划
- ❌ 把音轨加到导出 manifest 的逻辑 (manifest.audio.tracks 已有, 需要挂上)

## 风险

- VideoCanvasWorkbench.jsx 已经 70KB, 再加 audio UI 会更复杂, 需要小心
- audio asset version 必须 approved, 否则 INVALID_AUDIO_TRACK fail-closed
- track startMs 必须在 0..600000ms 之间
- volume 必须在 0..2 之间
