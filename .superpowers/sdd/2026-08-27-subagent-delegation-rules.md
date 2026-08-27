# 子代理委派规则 (4c183cd4 续命经验总结)

> 写于 2026-08-27 22:30. 主线程在多子代理并行委派 W4 / 月卡 8 项 / V3 路线图 / 商品档案 4 条线后总结.

## 已知问题

### 1. 子代理 "5 次重试" 硬限制

DSH subagent fork 机制有 5 次 LLM 重试限制, 超过后子代理状态变 'ready' 而不是 'done'. **子代理不一定真失败** - 它可能 commit 完只是 DSH 报回 ready 状态.

**判断方法**: `git log --oneline -10` 看子代理期间是否有新 commit. 有 commit 就是成功 (虽然 status:ready), 没 commit 才真失败.

**应对**:
- 不要立即重试, 先看 git log
- 如果 commit 已做, 直接拿 commit hash 接着推进
- 如果没 commit, 重启子代理 (send_message 唤醒)

### 2. 子代理 read 工具间歇性失败

子代理 `read` 大文件 (75KB+ VideoCanvasWorkbench.jsx) 会返回 undefined. **根因是 read 工具冷启动延迟, 同 batch 调用可能丢第一行**.

**应对**:
- **大文件 75KB+ 用 grep + offset+limit 200 行分块读**, 不要 read 整文件
- **把文件先拆成 5KB 小块写到 .tmp-anno-verify/chunks/ 目录**, 子代理读小块
- **明确告诉子代理每个修改点的精确行号和上下文**

### 3. 子代理 edit 工具缓存竞态

子代理 `edit` 工具如果文件被 read 后才能写, 连续 edit 不同位置会出现 "file changed since read" 错. **根因是 edit 工具的 file cache 没刷新**.

**应对**:
- **每次 edit 前先 `read offset=0 limit=1` 触达文件**, 强制刷新 cache
- 或用 `write` 工具整文件重写 (大文件风险高)
- 优先用 `git add -A && git commit` 而不是 patch-style 增量 edit

### 4. 子代理 commit 跟主线程 / 其他子代理撞车

子代理用 `git add -A` 会把别的子代理 staged 但没 commit 的文件一并带进去. **结果是 commit 包含未预期文件**.

**应对**:
- 主线程在委派前 `git restore --staged .`
- 子代理 commit 前 `git diff --cached --stat` 自检
- 子代理 commit 用 `git add <明确文件>` 不用 `git add -A`

### 5. commit message 中文转义

子代理用 `git commit -m "中文 message"` 在 PowerShell 嵌套 cmd /c 里被当 pathspec 拆分, 报 "pathspec 'W4' did not match".

**应对**:
- **永远用 `git commit -F <message_file>`**, 把 message 写到 .tmp-anno-verify/commit-msg.txt
- 或用 `node scripts/retry.mjs -- git commit -F file`

## 子代理委派模板

### 必备字段

- **工作目录** (绝对路径)
- **当前 commit HEAD**
- **分支名** (避免切错分支)
- **子代理自己的角色名** (避免命名冲突)
- **3 遍 + 查漏规则** (来自 4c183cd4 用户偏好)

### 任务边界

- **每步 commit**, 不要批量
- **每步报告**, 完成就回消息
- **不许碰的工作区**: .dsh/, .superpowers/sdd/, server/extension_tasks/, dist-codex-build-*, .tmp_*
- **不部署**, 由主线程决定

### 异常处理 (明确告诉子代理)

- read 工具失败: 立即用 grep 找行号 + offset+limit 分块, 不要无限重试
- edit 工具失败: 先 read 1 行触达文件, 再 edit
- npm test 失败: 用 `node scripts/retry.mjs -- npm test` 跑 (无限重试 429/5xx)
- LLM 429: `sleep 30` 后重试

## 委派范例

```javascript
// 1. 准备小文件 (主线程做)
const fs = await import('node:fs');
const code = fs.readFileSync('big.jsx', 'utf-8');
const chunks = code.match(/[\s\S]{1,5000}/g);  // 5KB 一块
chunks.forEach((c, i) => fs.writeFileSync(`chunk-${i}.txt`, c));

// 2. 委派子代理
const prompt = `
工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: 6475f1bd
角色: W4 音频节点子代理

任务: 3 步, 预计 12 轮

# 步骤
1. 读 .tmp-anno-verify/w4-chunks/asset-footer-L1128-L1148.txt (5KB 小文件)
2. 在 VideoCanvasWorkbench.jsx L1144 附近加 '加入音轨' 按钮
3. 跑 node --test test/video-canvas-audio-w4.test.mjs 验证

# 异常处理
- read 失败用 grep + offset+limit
- edit 失败先 read 1 行
- npm test 失败用 node scripts/retry.mjs -- npm test
- LLM 429 用 sleep 30 重试

# 不许碰
- .dsh/ (DSH 还在跑)
- .superpowers/sdd/ (其他子代理在工作)
- server/extension_tasks/ (4c183cd4 运行态)
`;

await tools.subagent({ description: 'W4 音频节点', prompt, run_in_background: true });
```

## 4 条线并行委派的教训 (2026-08-27)

1. **每个子代理给唯一路径写**: 我 + 子代理同时写 .superpowers/sdd/2026-08-27-4c183cd4-product-archive-status.md vs docs/superpowers/specs/2026-08-27-product-archive-status.md 互补但撞车
2. **commit message 规范化**: 4 个子代理的 W4 commit 名字一样 (重复 4 次), 后续 squash
3. **V3→v4 spec 在 reset 中丢失一次**: 5 个子代理 reset HEAD~1 互相干扰, 真正的 v4 spec 在 dbfb1ec8 出现过但被后续 commit 覆盖
4. **4c183cd4 V3 调研数据真实**: A03-A08 的 ms-precision timing tables 全在, 8 项行业缺失是基于真实测量

## 无限重试 wrapper 使用

```bash
# 包装 npm test
node scripts/retry.mjs -- npm test

# 包装 build
node scripts/retry.mjs -- npm run build

# 包装单文件测试
node scripts/retry.mjs -- node --test test/foo.test.mjs

# 限制最大重试次数 (默认 999999)
RETRY_MAX=10 node scripts/retry.mjs -- npm test

# 调整退避 (默认 1→2→4→...→60s)
RETRY_BASE_MS=2000 node scripts/retry.mjs -- npm test
```
