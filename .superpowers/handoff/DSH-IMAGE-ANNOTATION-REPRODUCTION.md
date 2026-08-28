# DSH 原生图片批注 + 视觉桥接 · 完整复现手册

> 自包含复现包：另一个 Mini Max 模型读完本文即可在新环境完整重做并验证。

## 0. 目标 & 整体架构

用户在 DeepSeek Harness（DSH）对话框里：
1. 粘贴截图 → 自动出现缩略图（原生长图模式）
2. 点击缩略图 → 弹大图灯箱（position:fixed, z-index 10000, 暗色全屏）
3. 在大图上**点击位置** → 该处出现红色水滴定位点，弹输入卡
4. 输入修改需求文字 → Enter 固化，定位点变成编号针
5. 多次点击加多个定位点/多次批注 → 完成后点「完成批注」
6. 写回输入框为结构化文本：
   ```
   [图片批注：shot.png]
   1. 坐标(35.0%, 62.5%)：把这里按钮再往上移一点
   2. 坐标(72.0%, 18.0%)：配色再暖一些
   ```
7. 多张图片可同时批注，**同文件名自动加 `#2 / #3` 后缀**避免覆盖
8. 视觉模型走 ModLens 桥，把图转成结构化证据文本给纯文本模型

> 关键：批注层是 DSH 内置客户端包的扩展补丁（不改它就是 Codex 那种「只看图不能点位置」），视觉能力走 ModLens 旁路（纯文本模型也能看图）。

## 1. 文件清单（4 个必须改 + 1 个建议改）

| 文件 | 改法 | 目的 |
| --- | --- | --- |
| `C:\Users\SHEJI\.dsh\profiles\web\cordis.patch.yml` | 新增/确保含 modlens 块 | 配置 ModLens 保留原生长图 + 扩展模型族 |
| `C:\Users\SHEJI\.dsh\profiles\web\node_modules\@deepseek-ai\dsh-client-ui-attachment\lib\client.js` | 注入 AnnotationLightbox 组件 + 替换调用点 | 实现批注灯箱（**profiles/node_modules 与全局 dsh 是同 inode 硬链接，改一处两处生效**） |
| `C:\Users\SHEJI\.dsh\profiles\web\node_modules\@liustack\modlens\dist\main.js` | 修一处只读 getter 崩溃 | 让 ModLens 引擎能跑起来 |
| `C:\Users\SHEJI\.dsh\annotation-patch\` | 整个目录（rebuild.cjs + anno_source.js.txt + README.md） | DSH 自更新后一键重打补丁 |
| `F:\da\shubao\RTK.md` | 加 Checkpoint 章节 | 跨线程/跨会话恢复锚点 |

## 2. ModLens 配置（cordis.patch.yml）

完整文件：
```yaml
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; !!js expressions allowed).
# Keep pasted images in Harness native attachments so the annotation lightbox
# can open them before any vision bridge converts them to a file path.
# families extends the auto-discovery set so the local x-preview/gpt routes
# also get "(modlens vision)" twins instead of only deepseek/glm ones.
- id: modlens
  config:
    pasteToPath: false
    families: [deepseek, glm, gpt, x-preview]
```

**为什么 pasteToPath: false**——若开启，ModLens 会在粘贴时把图存到磁盘并替换附件；批注灯箱在它转完前拿不到 attachment，bug 不可见。关掉后，粘贴图保留为 Harness 原生附件，灯箱能直接打开，发送时 ModLens 才会介入。

**为什么 families 扩展**——ModLens 默认只为 deepseek/glm 创建 "(modlens vision)" 孪生模型；扩展后 x-preview/gpt 也能用同一个视觉桥。

## 3. ModLens 引擎崩溃修复

`@liustack\modlens\dist\main.js` ~3836 行附近 `error.message = message` 对只读 getter 赋值会抛 TypeError。包 try/catch：

```js
// 原代码（崩溃）
error.message = message;
// 改为
try { error.message = message; } catch (_) { /* 只读 getter, 忽略 */ }
```

引擎用 dashscope qwen3-vl-plus（OpenAI 兼容），ModLens 默认配置即可。备选原生模型：qwen3-vl-flash、qwen-vl-max。

## 4. 批注层补丁（核心 · 必读）

### 4.1 锚点定位

打开 `client.js`，搜 `//#region lib/types/client/labels.js`（在 `ImageLightbox` 函数之后、labels 帮助函数之前），用 2 tab 缩进。

搜 `preview !== null && (0, react_jsx_runtime.jsx)(ImageLightbox, {`，这是一行 4 tab 缩进的调用点。

### 4.2 注入源代码片段（紧贴锚点 1 之前）

把以下完整代码以 2 tab 缩进写入（源码本身已经用 2 tab 缩进）。**所有 Unicode 字符（含中文冒号 FF1A）直接写原文，不要用转义**。

> 完整 157 行见 `C:\Users\SHEJI\.dsh\annotation-patch\anno_source.js.txt`（单一事实来源，重新打补丁时以它为准）。

### 4.3 AnnotationLightbox 核心逻辑要点

- 缩放 0.5–3 倍（步长 0.25），`transform: scale() + transformOrigin: center`，160ms expo-out
- 定位点用红色水滴：`transform: translate(-50%, -100%) rotate(-45deg)` + `border-radius: 50% 50% 50% 0`，内部编号反旋 45°
- 输入卡 `transform: translate(10px, -8px)` 偏移定位点，stopPropagation 防触发全局 Escape
- 完成批注调 `mergeAnnotationDraft(block, label)`，label 与 annotationStore 内已固化值优先（防漂移）
- `useRef` 保存已写入的 block，重复批注时不会重写 textarea 之外的内容

### 4.4 替换调用点

把：
```js
				preview !== null && (0, react_jsx_runtime.jsx)(ImageLightbox, {
					src: preview.previewUrl,
					alt: preview.file.name || t("image.original"),
					labels: lightboxLabels(t),
					onClose: closePreview
				})
```
替换为：
```js
				preview !== null && (0, react_jsx_runtime.jsx)(AnnotationLightbox, {
					attachment: preview,
					attachments,
					onClose: closePreview
				})
```

注：`attachments` 变量已在 ComposerAttachments 闭包内可用。

### 4.5 验证

```bash
node --check "C:\Users\SHEJI\.dsh\profiles\web\node_modules\@deepseek-ai\dsh-client-ui-attachment\lib\client.js"
```

## 5. 关键设计取舍（为什么这样做）

| 取舍 | 理由 |
| --- | --- |
| 直接修改内置包（不是写插件） | DSH 当前没有图片附件灯箱的官方扩展点（plugins 只能改 UI 组件，不能改 ComposerAttachments 这种内部 hook） |
| 坐标用 getBoundingClientRect 算百分比 | 抗缩放、抗窗口变化；坐标语义稳定 |
| annotationStore 用模块级 Map | 同一会话内跨开关灯箱保留状态 |
| label 优先取 saved?.label | 同名图被删其中一张后，剩余那一张的标签不漂移 |
| 保留用户写在批注段下面的散文行 | 用 `/^\d+\. 坐标/` 排除我们的坐标行，其它行原样保留在新块下方 |
| React 18 setState updater 不能放副作用 | savePin/editPin 必须从闭包 `pins` 派生 next，不能在 updater 里 persist |
| splice(insertAt, 0, para) 不写 splice(insertAt, 1, para) | 0 是「插入」，1 是「替换」会把后面块吞掉 |
| 不用 framer-motion | 保持零依赖；纯 transform/opacity 即可 |

## 6. DSH 自更新后的重打补丁套件

`C:\Users\SHEJI\.dsh\annotation-patch\` 目录：

### anno_source.js.txt
—— 157 行，完整 `annotationStore` + `mergeAnnotationDraft` + `AnnotationLightbox`，用 Tab 缩进，**单一事实来源**。重新部署时以它为准。

### rebuild.cjs
—— 自动注入补丁。逻辑：读 `client.js` → 检查是否已含 `AnnotationLightbox`（幂等）→ 在 labels region 前插入源码 → 替换 ImageLightbox 调用点 → 写回。

### README.md
—— 包含使用说明与 DSH 升级触发条件。

**DSH 自更新触发条件**：`@deepseek-ai\dsh-client-ui-attachment` 被重新抽取时（hash 变化自动触发），补丁会消失。`profiles\node_modules\...` 与全局 dsh 内的同包互为硬链接，更新一处两处同步失效。**每次升级后必须重打**。

## 7. 复现步骤（按顺序）

### Step 1：环境准备
- 安装 MiniMax DSH（一个 npm 客户端）
- 启动 DSH，确认 `http://127.0.0.1:3080` 可访问
- 安装 ModLens 插件（`@liustack\modlens`），配置引擎为 dashscope qwen3-vl-plus（OpenAI 兼容）

### Step 2：修 ModLens getter 崩溃
找到 `@liustack\modlens\dist\main.js` ~3836 行，把：
```js
error.message = message;
```
改为：
```js
try { error.message = message; } catch (_) {}
```

### Step 3：写 cordis.patch.yml
覆盖 `C:\Users\SHEJI\.dsh\profiles\web\cordis.patch.yml` 为 §2 的内容。

### Step 4：放补丁套件
将整个 `annotation-patch\` 目录（含 anno_source.js.txt、rebuild.cjs、README.md）放到 `C:\Users\SHEJI\.dsh\annotation-patch\`。

### Step 5：跑补丁
```bash
node "C:\Users\SHEJI\.dsh\annotation-patch\rebuild.cjs"
node --check "C:\Users\SHEJI\.dsh\profiles\web\node_modules\@deepseek-ai\dsh-client-ui-attachment\lib\client.js"
```
期望输出 `re-patched ok` 与 `syntax=0`。

### Step 6：选择视觉模型
DSH 模型选择器里选 **"Ox Alpha Free (modlens vision)"**，或在自定义里填 `qwen3-vl-plus`。同一会话发图时 ModLens 会自动给纯文本模型送结构化证据文本。

### Step 7：重启 DSH
```bash
curl -X POST http://127.0.0.1:3080/dsh-market/restart
```

## 8. 端到端验证

### 8.1 模型选择验证
进入 DSH 设置，确认模型选择器里出现 `(modlens vision)` 后缀项。切到它，发一句「你好」，应该正常返回（ModLens 不带图时走纯文本路径）。

### 8.2 单图批注 E2E
1. 截一张 DSH 对话框现状，存为 `/tmp/test.png`
2. 粘贴到对话框（Ctrl+V）→ 缩略图出现
3. 点击缩略图 → 暗色灯箱打开
4. 在图上某处点击 → 红色水滴 + 输入卡
5. 输入「把这里挪到中间」 → Enter → 红色水滴变编号 1
6. 再点图另一处 → 输入卡 → 「配色再暖一点」 → Enter
7. 关闭灯箱（点右上角 × 或 Escape）
8. 输入框出现结构化段落
9. 发送 → 模型应同时「看图」（通过 ModLens 证据文本）+ 看到你刚写的具体坐标+备注，做出精准修改建议

### 8.3 多图同名防覆盖
1. 同一张 `test.png` 再粘贴一次（再点缩略图会看到 `#2` 后缀）
2. 在新图上批注「这里太挤了」
3. 完成 → 输入框里现在两段共存（标签自动为 `test.png` 和 `test.png #2`）

### 8.4 自动化 E2E（用 browse CLI）
```bash
browse open http://127.0.0.1:3080/
browse wait load
# 用 atob + dispatchEvent 注入粘贴（base64 内联）
browse eval '(async()=>{const bin=atob("BASE64");const buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);const dt=new DataTransfer();dt.items.add(new File([buf],"test.png",{type:"image/png"}));const ta=document.querySelector("textarea");ta.focus();ta.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,900));return "ok";})()'
browse mouse click 435 334    # 缩略图位置（实际坐标需先 eval 取得）
browse mouse click 644 353    # 灯箱内图片中心
browse type "把按钮往上移"
browse press Enter
browse mouse click 1227 683   # 完成批注按钮
browse eval "document.querySelector('textarea').value"  # 应得到批注段
```

## 9. 已踩坑清单（Mini Max 模型复现时务必注意）

1. **缩进**：源码用 2 tab 缩进（与原生 client.js 风格一致），不要换成 4 空格
2. **转义**：源码中 `/\n/`、`/\n{2,}/`、`/^\d+\. 坐标/` 都是合法 JS 正则，不要双重转义
3. **splice 0 vs 1**：0 = insert，1 = replace；要保留「删除老块、插入新块」必须用 0
4. **React updater 不能存副作用**：setPins(fn) 里 fn 是延迟执行的，不能在里面 persist，必须从闭包派生
5. **modlens error.message getter**：原生对象有只读 message，不能直接赋值，必须 try/catch
6. **pasteToPath 一定要 false**：不然 ModLens 会把图提前转走，批注灯箱拿不到
7. **families 必须包含 x-preview**：否则官方默认模型看不到视觉孪生
8. **硬链接同步**：`profiles\node_modules` 与全局 dsh 同 inode，改其中一处即修改两处；这是 DSH 自我更新抹掉补丁的根因
9. **Escape 在 Draft 模式**：弹输入卡时按 Escape 取消输入卡（stopPropagation），再按一次才关灯箱
10. **缩放范围 0.5–3**：灯箱缩放合理区间，<0.5 图片看不清，>3 性能下降
11. **批注标题前缀**：中文冒号是 U+FF1A，不是 ASCII `:`；写错会导致段落匹配失败
12. **附件不跨页面刷新持久**：刷新后 textarea 草稿仍在，但 attachment 数组会清空（DSH 设计如此，不修）

## 10. 验收清单

- [ ] 选视觉模型时出现 `(modlens vision)` 孪生项
- [ ] 粘贴图片保留为 Harness 原生缩略图（不是 ModLens 转的文件路径）
- [ ] 点击缩略图打开暗色灯箱
- [ ] 灯箱内点击图 → 红点 + 输入卡
- [ ] Enter 固化、Escape 取消输入卡、再 Escape 关灯箱
- [ ] 完成批注后 textarea 含结构化段落
- [ ] 同一文件名粘贴两次 → 第二张标签 `#2`，两段共存不互相覆盖
- [ ] 关掉一张同名的再重开另一张，标签不漂移
- [ ] 在批注段下直接写散文，再打开批注，散文保留在新块下方
- [ ] DSH 自更新后，`node rebuild.cjs` 幂等恢复（输 `already patched` 或 `re-patched ok`）
- [ ] 用 ModLens 视觉模型时，发图+批注后模型能精准定位到坐标（验证：在回复里提到具体坐标+需求）