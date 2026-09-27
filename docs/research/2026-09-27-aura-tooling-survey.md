# 2026-09-27 · Aura 工具链调研（抓取分析 / 实况图合成 / 图像分析 / 方法论 / 成本）

面向两件事：**(1) 深度抓取与分析小红书视觉账号（逐张判构图/色板/人物形态）；(2) 把静态图合成「实况图」**（iOS 同名 JPG+MOV 写同一 UUID；安卓 JPEG 尾追 MP4 + XMP 写偏移，文件名 `*_MP.jpg`），其中 2~3 秒微动效走图生视频。

---

## 0. 数据口径（先说清楚，免得被当成拍的）

- **star 数 / 最后提交 / 开源许可证**：全部来自 GitHub REST API（`https://api.github.com/repos/...` 与 `/search/repositories`），**观测时间 2026-09-27**，是本机实测返回值，不是转述。
- **npm 包**：来自 `https://registry.npmjs.org/<pkg>` 的 `license` / `dist-tags.latest` / `time` 字段，同日观测。
- **许可证**：优先看仓库 `license.spdx_id`；对标注为 `NOASSERTION` 或 `-` 的，**我另外拉了 LICENSE 原文核对**（MediaCrawler 就是这样查出真相的）。
- **star 数会变**，本文数字是 2026-09-27 快照；引用时建议写"截至 2026-09-27"。
- **本次环境限制（影响了 E 和 D 的取证）**：DuckDuckGo / lite.duckduckgo 直连超时；Bing（cn.bing.com）可用但**中文查询被截断成单字**，返回的是字典页，不能用；Google 未测。所以本文的"某厂商官方价页"类结论**只采信我直接打开过的页面**，打不开的一律写"查不到"。
- 本地可用工具实测：`ffmpeg` 在 PATH（`C:\Users\SHEJI\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe`）、`node v24.18.0`、`python 3.14.6`；**`exiftool` 不在 PATH**。B 节里有一条结论是我**在本机跑出来的**，不是读文档读来的。

---

## A. 小红书 / 内容平台抓取与数据集工具

### A.1 同类项目横评（全部实测数据）

| 项目 | stars | 许可证 | 最后提交 | 语言 | 能否商用 |
|---|---|---|---|---|---|
| [NanmiCoder/MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) | 65,811 | **非商用（自定义）** | 2026-09-19 | Python | **不能** |
| [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) | 16,005 | Apache-2.0 | 2026-09-22 | Go | 能 |
| [JoeanAmier/XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) | 12,849 | GPL-3.0 | 2026-09-20 | Python/JS | 有条件（GPL 传染） |
| [cv-cat/Spider_XHS](https://github.com/cv-cat/Spider_XHS) | 7,889 | **无 LICENSE** | 2026-09-27 | Python | **不能**（默认保留所有权利） |
| [jackwener/xiaohongshu-cli](https://github.com/jackwener/xiaohongshu-cli) | 2,634 | **无 LICENSE** | 2026-03-21 | Python | **不能** |
| [ReaJason/xhs](https://github.com/ReaJason/xhs) | 2,213 | MIT | 2025-07-01 | Python | 能（但停更 14 个月） |
| [Jamailar/Beav](https://github.com/Jamailar/Beav) | 1,749 | NOASSERTION | 2026-09-27 | TypeScript | 需核对原文 |
| [submato/xhscrawl](https://github.com/submato/xhscrawl) | 1,482 | **无 LICENSE** | 2026-08-15 | - | **不能** |
| [iszhouhua/social-media-copilot](https://github.com/iszhouhua/social-media-copilot) | 1,338 | GPL-3.0 | 2026-08-31 | TypeScript | 有条件 |
| [TikHub/TikHub-API-Python-SDK](https://github.com/TikHub/TikHub-API-Python-SDK) | 898 | Apache-2.0 | 2026-06-05 | Python | SDK 可商用，**服务是付费商业 API** |
| [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach) | 85,708 | MIT | 2026-09-15 | Python | 能 |

**结论 1（最重要、必须知道）**：`MediaCrawler` 虽然是最有名的（65.8k star），但**不能商用**。它的 `license.spdx_id` 是 `NOASSERTION`，我拉了 `LICENSE` 原文，标题就是：

> **NON-COMMERCIAL LEARNING LICENSE 1.1**
> "The Software is limited to learning and research purposes only, and may not be used for large-scale crawling or activities that disrupt platform operations."
> "Without the written consent of the copyright owner, the Software may not be used for any commercial purposes..."

出处：`https://github.com/NanmiCoder/MediaCrawler/blob/main/LICENSE`（2026-09-27 拉取）。**这条直接排除"把 MediaCrawler 塞进我们产品"这条路。** 它被广泛误传成"开源随便用"，实际是"学习研究用"。

**结论 2**：`cv-cat/Spider_XHS`（7,889★）、`jackwener/xiaohongshu-cli`（2,634★）、`submato/xhscrawl`（1,482★）都是**无 LICENSE 文件**（GitHub API 返回 `license: null`）。无许可证 = 保留所有权利，**不能商用、不能改、不能分发**。技术上能跑，法务上不能用。

**结论 3（我们真正能用的三个）**：
- **`xpzouying/xiaohongshu-mcp`** — 16,005★，**Apache-2.0**，Go 写的 MCP server，2026-09-22 仍在更新，2,355 fork / 99 open issues。README 明确：**第一步必须登录**（扫码登录 + 检查登录态），支持发布图文、检索。Apache-2.0 **可用于闭源商业产品**。这是 A 类里"星数高 + 许可干净 + 活跃"的唯一组合。
- **`ReaJason/xhs`** — 2,213★，**MIT**。Web 端请求封装（含 x-s/x-t 签名实现），是最"库化"的一个：`pip install xhs` 直接用。缺点：**最后提交 2025-07-01**，48 个 open issue，小红书签名算法一改就可能失效。适合当"签名算法参考实现"而不是长期依赖。作者自己在 README 里写明"爬虫可能违法，不要对网站施压"。
- **`Panniantong/Agent-Reach`** — 85,708★，MIT，"一个 CLI 读 Twitter/Reddit/YouTube/GitHub/Bilibili/**XiaoHongShu**，零 API 费用"。**我们环境里已经装了这个 skill**（`agent-reach`，见 `C:\Users\SHEJI\.agents\skills\agent-reach\SKILL.md`），所以这条路**零新增依赖**，值得先拿它试单篇笔记。

### A.2 登录态与反爬（每家都要面对）

- **登录态是硬门槛**：小红书 Web 端几乎所有接口都要登录 cookie。`xiaohongshu-mcp` README 把"登录/检查登录状态"列为**第一步必须**；`XHS-Downloader` 的功能清单里有"**从浏览器读取 Cookie**"这一项（出处：[README](https://github.com/JoeanAmier/XHS-Downloader)，2026-09-27 拉取）。
- **反爬对抗方式**：小红书 Web 需要 `x-s` / `x-t` 请求签名（时间戳 + 哈希）。`ReaJason/xhs` 就是干这个的；`MediaCrawler` 走 Playwright 真浏览器 + 扫码登录存 cookie 的路子。
- **图片防盗链**：抓到的图片 URL 通常不能裸 `GET`，要带 `Referer` 或复用登录 cookie。这一点所有方案共通，自己写 Playwright 脚本时要注意。
- **实操建议**：登录态用"人工扫码一次 → 存 cookie → 复用"，不要去破解验证码。`iszhouhua/social-media-copilot`（1,338★, GPL-3.0, 支持 Docker + API）走的也是这条"浏览器插件采集 + API"路线，思路可以借。

### A.3 "只做单篇笔记解析"的轻量方案（我们已有的 Playwright 脚本要不要换）

**有，而且比 MediaCrawler 省事得多。** 三个选项，按"省事程度"排：

1. **`JoeanAmier/XHS-Downloader`（12,849★, GPL-3.0）— 功能上最对口**。README 功能清单原文包含："采集小红书作品信息 / 提取小红书作品下载地址 / **下载小红书作品文件** / **下载小红书 livePhoto 文件** / 自定义图文作品文件下载格式 / 从浏览器读取 Cookie / **支持 API 调用功能** / **支持 MCP 调用功能** / 支持文件断点续传下载"。
   → **"给一个笔记链接，把这篇笔记的全部图（含 livePhoto）下载下来"它是开箱即用的**，正是我们"逐张判构图"需要的前置步骤。
   → **但许可证是 GPL-3.0**：如果我们把它作为独立进程调用、不链接、不分发其代码，通常可以；如果要嵌进我们闭源产品里分发，需要走 GPL 合规（或干脆不用）。**这是我们最需要法务确认的一条。**
2. **`xiaohongshu-mcp`（Apache-2.0）** — 走 MCP 协议拿笔记详情。许可干净、活跃，但要起一个 Go 服务 + 登录态。
3. **我们自己写 Playwright**：其实**并不差**。小红书笔记页是 SSR + 内联 JSON（`window.__INITIAL_STATE__`），单篇解析的核心工作量就是"登录 + 签名/或走真浏览器 + 解析内联 JSON 的 imageList"。如果只要单篇，自研脚本的**维护成本低于**依赖 MediaCrawler 那种重型框架（还要面对它的非商用许可）。

**判断**：**别上 MediaCrawler**（许可不允许 + 对我们过重）。单篇抓取优先 ① `XHS-Downloader` 当外部工具用（先确认 GPL 合规）；② 或者在我们的 Playwright 脚本里直接解析 `__INITIAL_STATE__`（零许可风险）。批量/账号级才考虑 `xiaohongshu-mcp`。

---

## B. 实况图 / 动态照片合成

先把两个格式的规范钉死：

- **安卓 Motion Photo（Google 规范）**：静态 JPEG/HEIC 文件**尾部直接追加**一个 MP4，用 XMP（命名空间 `http://ns.google.com/photos/1.0/camera/`，GCamera）记录视频偏移与长度。Google 相机约定文件名 `MVIMG_*.jpg`；国内厂商（小米/OPPO/三星）各有自有 trailer 标签，兼容性靠"借元数据"解决。官方规范：[developer.android.com/media/platform/motion-photo-format](https://developer.android.com/media/platform/motion-photo-format)。
- **iOS Live Photo**：一对文件（静图 + MOV），两侧写入**同一个 36 位 UUID**：MOV 侧是 QuickTime key `com.apple.quicktime.content.identifier`；静图侧是 **Apple MakerNote 的 tag 0x0011 `ContentIdentifier`**。另有封面帧用的 `still-image-time` timed metadata track。

### B.1 iOS 路径：**关键坑已确认，并已找到绕法**

**（a）MOV 侧：可以纯命令行做，我在本机验证通过。**
`exiftool` 文档里 `QuickTime` 组的 `ContentIdentifier`（tag id `'content.identifier'`）**Writable = yes**（出处：[exiftool TagNames/QuickTime](https://exiftool.org/TagNames/QuickTime.html)）。

**不装 exiftool、只用 ffmpeg 也行——这是我实测的**：

```
ffmpeg -i in.mov -c copy -movflags +use_metadata_tags \
  -metadata "com.apple.quicktime.content.identifier=5F7A1B2C-3D4E-4F50-8A9B-0C1D2E3F4A5B" out.mov
```

验证方式不是"看文件里有没有这个字符串"，而是**用 ffmpeg 自己把元数据读回来**：

```
$ ffmpeg -v error -i out.mov -f ffmetadata -
;FFMETADATA1
major_brand=qt
com.apple.quicktime.content.identifier=5F7A1B2C-3D4E-4F50-8A9B-0C1D2E3F4A5B
```

（本机 2026-09-27 实测，ffmpeg 来自 winget。）**不带 `-movflags +use_metadata_tags` 时这个 key 会被 ffmpeg 静默丢弃**，我验证过——这是个很容易踩的坑，写代码时记得加上。

**（b）静图侧：exiftool `写不进去`——原因是它无法凭空创建 Apple MakerNotes。**
exiftool 的 Apple 组里 `ContentIdentifier`（0x0011）在文档表格中是有 writable 类型（`string`）的（出处：[exiftool TagNames/Apple](https://exiftool.org/TagNames/Apple.html)），**但前提是文件里本来就有 Apple MakerNote 块**。

两个独立项目都明确踩到并记录了这一点：
- [`RhetTbull/makelive`](https://github.com/RhetTbull/makelive)（254★，**MIT**，2026-05-03）README 原文：
  > "Unfortunately, these tags cannot be written with the standard **exiftool** utility **if they do not already exist in the file** as the metadata is stored in **Maker Notes which exiftool cannot create**."
  所以 makelive 改用 macOS 的 **Core Graphics + AV Foundation** 来写（**因此它只能在 macOS 上跑**，依赖 macOS 10.15+ / Python 3.9+）。
- [`AssassinJY/live_motion_photos_convert`](https://github.com/AssassinJY/live_motion_photos_convert)（7★，**MIT**，2026-02-15）README 原文：
  > "用 ImageMagick 从 JPG 转出的 HEIC **没有** Apple 的 MakerNotes 结构，exiftool **无法在「空」的 HEIC 上单独创建或写入 MakerNotes 里的某一项，会得到 "image files unchanged"**。"
  它的绕法是：**从一张真实实况图里抠出 MakerNotes 块保存下来复用**（该项目借用了微信实况图的 MakerNotes，理由是"相对干净"）。

**→ 这意味着我们 AI 生成的 JPEG（天生没有 Apple MakerNote）不能只靠 exiftool 写上 ContentIdentifier。** 三条可行路线：
1. **维护一个"捐赠者(donor)"模板**：从一张真实 iPhone 实况图的静图里提取 Apple MakerNote 块，用 `exiftool -TagsFromFile donor.jpg -MakerNotes target.jpg` 之类的方式移植过去，再覆盖 `ContentIdentifier`。可脚本化、可服务端跑，但需要一份合规来源的样板图。
2. **有 Mac 就用 makelive**（MIT，`makelive photo.jpg video.mov` 一条命令），它用 AVFoundation 顺带把 `still-image-time`（封面帧）也写了，是最正统的实现。
3. 参考 [`LengxiQwQ/live-photo-box`](https://github.com/LengxiQwQ/live-photo-box)（41★，**GPL-3.0**，2026-09-27，C#/Windows，"处理跨设备/品牌/平台的实况照片"）的实现细节——**注意 GPL-3.0，只能当参考，不能直接抄进闭源产品**。

**（c）封面帧（still-image-time）**：exiftool 文档里 `StillImageTime`（tag `'still-image-time'`）**Writable = no**（出处同 QuickTime 标签页）。也就是说**纯命令行无法写封面帧元数据**；不写通常仍能被识别为实况并播放，但"编辑封面帧"会不可用（makelive 与 AssassinJY 两处都印证了这个降级行为）。

**（d）iOS 侧其他可复用件**：
- [`LimitPoint/LivePhoto`](https://github.com/LimitPoint/LivePhoto) — 479★，**无 LICENSE**，Swift 单文件库，2018 年起维护。**无许可证 → 不能商用**，但代码短，适合**当规范读**（它把"资产 ID 怎么写"讲得最清楚）。
- [`TouSC/Video2LivePhoto`](https://github.com/TouSC/Video2LivePhoto) — 133★，**无 LICENSE**，2024-06-20，Swift，"支持 iOS17 壁纸"。同样只能当参考。
- npm **`livephoto-check`** — v0.4.2，**MIT**，2026-08-18，"检查一个 Apple Live Photo 会不会被 iPhone 锁屏接受为动态壁纸"。**这个对我们很有价值：合成完可以自动判定合格。**
- npm **`@ziuchen/live-photo-helper-bin`** v0.0.0，MIT，2026-05-18，是 `@live-photo-maker/helper` 的**macOS 预编译二进制**（说明：这类"真·Live Photo 合成"件基本都是 macOS-only）。

### B.2 安卓路径：工具链成熟，**这是最省事的一条**

| 项目 | stars | 许可证 | 最后提交 | 说明 |
|---|---|---|---|---|
| [PetrVys/MotionPhoto2](https://github.com/PetrVys/MotionPhoto2) | 308 | **MIT** | 2026-09-15 | 从 JPG/HEIC + 视频生成 Motion Photo v2/v3，兼容 Google Photos / 三星相册 |
| [wszqkzqk/live-photo-conv](https://github.com/wszqkzqk/live-photo-conv) | 225 | **LGPL-2.1** | 2026-09-04 | 跨平台 GUI + **CLI**（`live-photo-make`），还能"修复"坏元数据的实况图 |
| [mihir-io/MotionPhotoMuxer](https://github.com/mihir-io/MotionPhotoMuxer) | 176 | **GPL-3.0** | 2025-03-26 | Apple Live Photo → Google Motion Photo |
| [doodspav/motionphoto](https://github.com/doodspav/motionphoto) | 32 | Apache-2.0 | 2024-05-08 | Python 库，**三星 trailer 标签文档最全**（被 MotionPhoto2 点名引用） |
| [YuleBest/LivePhotoTools](https://github.com/YuleBest/LivePhotoTools) | 23 | **MIT** | 2025-01-25 | Bash + exiftool + FFmpeg，**目前只支持小米格式**，Apple/OPPO 在开发中 |
| [hellodk34/make_motion_photo](https://github.com/hellodk34/make_motion_photo) | 17 | **MIT** | 2026-07-09 | 任意长度视频 → motion photo 的脚本 |
| [lutao043/MotionPhotoConverter](https://github.com/lutao043/MotionPhotoConverter) | 15 | Apache-2.0 | 2026-09-23 | 同名 jpg + mp4 合并成"符合安卓规范"的 live 图（中文项目） |
| [ZhiQiu-Kinsey/AppleLivePhotoConvert](https://github.com/ZhiQiu-Kinsey/AppleLivePhotoConvert) | 76 | **MIT** | 2026-09-27 | **iPhone 实况 ↔ 安卓动态照片互转**，HEIC+MOV → 单文件 MVIMG JPG |
| [HoshinoSuzumi/chronoframe](https://github.com/HoshinoSuzumi/chronoframe) | 1,932 | MIT | 2026-09-27 | 自建相册，支持 Live/Motion Photo、EXIF 解析（**解析逻辑可抄**） |
| [flashlab/motion-live-photo](https://github.com/flashlab/motion-live-photo) | 34 | **无 LICENSE** | 2025-08-31 | TS/web 的 live+motion photo 工具，**许可不明，不能商用** |

**结论（安卓最省事）**：**`MotionPhoto2`（MIT，2026-09-15 还活跃）直接用。** 它是 Python 脚本 + **只依赖 exiftool**；能力覆盖 单张/整目录批量/EXIF 自动配对/`--incremental-mode`/HEIC 与 JPG，输出可被 Google Photos 与三星相册识别。
它 README 里有一条对我们**特别有用**的能力原文：
> "In case the source is an iPhone Live Photo, the presentation timestamp will be migrated as well, thus the photo will start from the same keyframe."
（封面帧时间戳会被迁移——正好补上 iOS 侧写不了的封面帧问题，如果素材来源是实况图的话。）

配套的 Node 侧依赖（**都要用 npm 装，不要假设机器上有 exiftool**）：
- **`exiftool-vendored`** v38.2.0，**MIT**，2026-09-24 更新 —— 跨平台带上 exiftool 二进制，"Efficient, cross-platform access to ExifTool"。**这是 Node 服务端做元数据读写的首选**（我们本机就 **没有** exiftool）。
- `exifreader` v4.46.0，**MPL-2.0**，2026-09-26 —— 纯 JS 读 EXIF/XMP，读 XMP 偏移不用起子进程。
- `piexifjs` v1.0.6，MIT，**2019 年后停更** —— 不建议新用。
- `ffmpeg-static` v5.3.0（**GPL-3.0-or-later**，2025-11-14）vs `@ffmpeg-installer/ffmpeg` v1.1.0（**LGPL-2.1**，2021-07-15，停更）。**许可提醒**：`ffmpeg-static` 分发的是 GPL 构建；如果只是服务端调子进程、不分发二进制，一般没问题，但如果产品要随包分发，LGPL 构建更安全。真要严谨，请法务过一遍。
- `FFmpeg/FFmpeg` 本仓库 license 字段是 `NOASSERTION`（即"Other"，LGPL/GPL 取决于构建配置）——出处 [github.com/FFmpeg/FFmpeg](https://github.com/FFmpeg/FFmpeg)（64,571★，2026-09-27）。
- `exiftool` 本体：[github.com/exiftool/exiftool](https://github.com/exiftool/exiftool) 的 license 字段是 **GPL-3.0**（5,094★，2026-05-27）；官方站点 [exiftool.org](https://exiftool.org/) 自述是"platform-independent Perl library plus a command-line application"、"Requires Perl 5.004 or later"，Windows 有**自带 Strawberry Perl 的可执行包**。
  **商用判断**：GPL 工具**以独立进程方式调用**通常不构成衍生作品（我们只在服务端内部跑，风险低）；但 exiftool 历史上的官方口径是"与 Perl 同许可（Artistic-2.0 / GPL-1.0+ 双许可）"，**本次我没能打开其 License 页原文，所以这条按"需法务确认"处理，不要当成既定事实**。

### B.3 B 节总结：我们走哪条路

- **安卓 `*_MP.jpg`：走 `MotionPhoto2`（MIT）**，Node 侧用 `exiftool-vendored`（MIT）供 exiftool。**纯服务端、无 Apple 依赖、许可干净、批量能力现成**。这是**"最省事"的一条**。
- **iOS 实况：MOV 侧用 ffmpeg（已验证）；静图侧必须额外解决 Apple MakerNote**。要么备一台 Mac 跑 `makelive`（MIT，最稳），要么维护一个 donor MakerNote 模板 + exiftool 移植（可纯服务端，但要样板图）。
- **验收**：合成后用 `livephoto-check`（MIT，npm）自动判定 iOS 侧是否会生效。
- **注意厂商碎片化**：`live-photo-conv` README 明确说"不同厂商可能要求专有元数据才能正确识别"，并给出解法 `copy-img-meta --exclude-xmp` 把某品牌真机的元数据复制过来。**如果我们要求"小米/OPPO/三星都认"，就要按品牌各存一份元数据模板。** 另有 Windows 限制原文："**在 Windows 上无法读写非 ASCII 路径的元数据**"（Exiv2/GExiv2 限制）——我们是中文文件名场景，**这条要重点规避**（先用 ASCII 临时名处理再改名）。

---

## C. 图像分析（构图 / 色板 / 人脸与姿态）

### C.1 色板：低风险，直接选一个

| 方案 | 版本/许可 | 状态 | 备注 |
|---|---|---|---|
| **npm `colorthief`** | 3.5.0，**MIT**，发布 2026-08-02 | **活跃** | 零依赖、TypeScript、支持 OKLCH。**首选** |
| [lokesh/color-thief](https://github.com/lokesh/color-thief) | 13,644★，**MIT**，2026-08-03 | 活跃 | 老牌；Node 用需 npm 老包 `color-thief@2.2.5`（BSD-2-Clause，2019-06-02，依赖 `canvas`） |
| [Vibrant-Colors/node-vibrant](https://github.com/Vibrant-Colors/node-vibrant) | 2,454★，**仓库无 LICENSE 文件**，2026-01-27 | 半活跃 | **注意出入**：npm `node-vibrant@4.0.4` 声明 **MIT**，但 GitHub 仓库 license 字段是空的。商用前把仓库 LICENSE 与 npm 字段对齐核对 |
| `get-image-colors` | 4.0.1 MIT，2022-02-04 | **停更** | 不推荐新用 |
| `quantize` / `image-q` | MIT，2022 | 停更 | 只是量化算法，可用但非色板方案 |

### C.2 人脸与姿态：能不能判"有无人脸 / 侧脸 / 戴墨镜 / 只有手部"

| 方案 | stars / 许可 | 状态 | Node 可调？ | 本地免费？ |
|---|---|---|---|---|
| [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe) | 37,090★ / **Apache-2.0** | **活跃**（2026-09-25） | 见下 | **是** |
| [justadudewhohacks/face-api.js](https://github.com/justadudewhohacks/face-api.js) | 17,973★ / MIT | **停更 2024-01-24**，476 open issues | 是（tfjs-node） | 是 |
| [vladmandic/face-api](https://github.com/vladmandic/face-api) | 1,081★ / MIT | **已 ARCHIVED（2025-02-05）** | 是 | 是 |
| npm `@vladmandic/human` | v3.3.6 / **MIT**（npm 2025-08-26） | 在维护 | **是**（face-api 的后继） | 是 |
| [deepinsight/insightface](https://github.com/deepinsight/insightface) | 29,847★ / **license 字段为空** | 活跃（2026-09-09） | 否（Python） | 是 |
| [ultralytics/ultralytics](https://github.com/ultralytics/ultralytics) | 62,045★ / **AGPL-3.0** | 活跃 | 否（Python） | **不是免费商用** |
| [exadel-inc/CompreFace](https://github.com/exadel-inc/CompreFace) | 8,334★ / Apache-2.0 | **停更 2024-10-05** | 通过 HTTP 服务 | 是 |
| [open-mmlab/mmpose](https://github.com/open-mmlab/mmpose) | 7,925★ / Apache-2.0 | 2025-08-04 | 否 | 是 |
| npm `@tensorflow-models/face-landmarks-detection` | 1.0.6 / Apache-2.0 | **2024-10-10 停更** | 是 | 是 |
| npm `@tensorflow-models/pose-detection` | 2.1.3 / Apache-2.0 | **2023-08-29 停更** | 是 | 是 |
| [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) (+ npm `onnxruntime-node`) | 21,934★ / MIT | 活跃 | **是** | 是 |

**逐项回答我们的四个判定需求：**

- **有没有人脸**：MediaPipe `FaceDetector` / `FaceLandmarker`、`@vladmandic/human`、InsightFace SCRFD —— 都行，**全部本地免费**。
- **是否侧脸**：**有现成输出，不用自己训。** MediaPipe `FaceLandmarker` 给 478 点 + blendshapes，可用鼻/眼的对称性算 yaw；`@vladmandic/human` 直接给 3D 人脸朝向（rotation/angle）。**在 Node 里这是最省事的（human 是 MIT + 纯 npm）。**
- **是否戴墨镜**：**没有现成输出，查不到开箱即用的模型**。现实做法：① 用 CLIP 零样本分类打 `"wearing sunglasses"` 这类标签（见 C.3，本地免费）；② 用眼周区域像素统计（暗度/高光）做启发式；③ 自己标几百张训一个小分类头。**不要以为调个 API 就有这个字段。**
- **是否只有手部**：用"**人脸数 = 0 且手部关键点 ≥ 2**"这个规则自己判。MediaPipe 有 `HandLandmarker`（21 点）；`@vladmandic/human` 也带 hand detection。

**关于"Node 里跑 MediaPipe"这个容易踩的坑**：`@mediapipe/tasks-vision` v1.0.1，**Apache-2.0**，2026-07-31 更新——但它是**面向 Web/WASM 的包**；我实测 npm 上 **`@mediapipe/tasks-node` 不存在（404）**。也就是说官方**没有** Node 版 Tasks API，在 Node 里用要自己加载 wasm + 处理环境差异。
→ **务实建议：人脸/姿态先用 `@vladmandic/human`（MIT，纯 npm，Node 原生支持，含朝向+姿态+手部）；若精度不够，再把 MediaPipe 放成 Python sidecar（pip 装，本地零成本）。** 不建议为了 MediaPipe 去啃 wasm 加载。

**许可红线**：`ultralytics/ultralytics` 是 **AGPL-3.0**（62k★，YOLO 全系）。**用它做闭源商用服务要买商业授权**，这条要提前告诉团队，别写出去了才发现。

### C.3 构图分析（三分法 / 对称 / 视线引导）：**现成库查不到**

**如实说：本次调研没有找到可直接调用的"构图规则检测"开源库。** 这类东西基本只有论文、博客教程代码和商业 API（各家 Vision API 的 saliency），没有成熟可依赖的库。可核实的替代路径是**自己用两条现成能力拼**：

1. **CLIP 零样本分类**（本地免费、Node 可调）——把构图/景别/机位变成自然语言标签：
   - [openai/CLIP](https://github.com/openai/CLIP) 34,376★ / **MIT** / 2026-03-25
   - [mlfoundations/open_clip](https://github.com/mlfoundations/open_clip) 14,171★ / NOASSERTION / 2026-09-25
   - [huggingface/transformers.js](https://github.com/huggingface/transformers.js) 16,327★ / **Apache-2.0** / 2026-09-25 → **在 Node 里本地跑 CLIP 的 ONNX 权重**，零调用费。可以判 `close-up portrait` / `full body shot` / `symmetrical composition` / `centered subject` / `low angle` / `looking away from camera` 这类我们真正要的维度。
2. **主体掩码 → 自己算几何规则**（"三分法"最实用的自研方式）：
   - [danielgatis/rembg](https://github.com/danielgatis/rembg) 24,898★ / **MIT** / **2026-09-20 活跃** —— 抠主体，拿掩码
   - [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net) 9,874★ / Apache-2.0 / 2024-06-26 —— 显著目标检测
   - 拿到主体掩码后，**算主体重心相对三分点的偏移、左右/上下对称性、主体面积占比**——这些是十几行几何代码，比找库可靠。
3. **美学/构图评分**：**本次未逐条核验** `improved-aesthetic-predictor` / NIMA / PickScore 之类的星数与许可证，**故不在此给结论，避免拿去当事实用**。列为待办。

> 交叉印证：本仓 `docs/research/2026-09-25-art-direction-research-digest.md` 第五节第 10 条也得出过近似结论——"**开源侧没有图像版 design tokens**，最接近的是 ComfyUI workflow JSON、A1111 X/Y/Z、StoryDiffusion 的算法级一致性"。**这与"构图没有现成库"是同一个空位。**

---

## D. 方法论：公开的"AI 视觉账号批量化生产"

### D.1 先看我们已有的：**这个题目本仓 2 天前刚调研过**

`docs/research/2026-09-25-art-direction-research-digest.md`（2026-09-25）就是干这个的，目录已经覆盖：
- 一、广告业的艺术指导体系（KV / 视觉识别 / 网格系统 / **differentiation vs distinctiveness**）
- **二、AI 出图「系列一致性 + 刻意变化」的实战机制** ← **正是"同一次拍摄感 + 篇内不重复"**
  - 2.1 三种"风格承载"；2.2 **刻意变化必须显式枚举，且成熟工具都配了上限**；2.3 "提示词 = 美术指导"的块化写法；2.4 四套字段 schema；2.5 用 LLM 生成概念；2.6 失败模式
- 三、内容账号选题与运营 SOP；四、市场产品形态（风格系统）；五、**未能验证的点**

**建议：D 不要重做，直接接着这份文档做。** 它第五节已经自曝了不确定性（"visual territory"等术语无权威来源、"变量矩阵 + 算子扰动"是本文档构造而非行业框架、小红书/抖音官方规则原文没拿到）。

### D.2 外部可核实的公开工程实践（不是"方法论文章"，是能跑的代码）

**（1）"提示词模板 + 变量矩阵"批量出图——最成熟的开源载体：**
- [adieyal/sd-dynamic-prompts](https://github.com/adieyal/sd-dynamic-prompts) — **2,294★，MIT**，2024-07-19。为 A1111 实现的"随机提示词的小模板语言"（wildcards / 组合枚举 / 变量），**"篇内不重复"就是靠这种显式枚举 + 上限控制实现的**。
- [adieyal/comfyui-dynamicprompts](https://github.com/adieyal/comfyui-dynamicprompts) — **440★，MIT**，2024-07-09，同作者的 ComfyUI 节点版。
- 现状：这两个都**停在 2024-07**，说明这套"变量矩阵"思路已定型，不是还在演进的东西。

**（2）"同一次拍摄感"= 角色/风格一致性，公开可用的手段：**
- [instantX-research/InstantID](https://github.com/instantX-research/InstantID) — **11,996★，Apache-2.0**，2024-07-18（已停更）
- [ToTheBeginning/PuLID](https://github.com/ToTheBeginning/PuLID) — **3,555★，Apache-2.0**，2025-07-31（NeurIPS 2024）
- [modelscope/facechain](https://github.com/modelscope/facechain) — **9,507★，Apache-2.0**，2025-06-06，阿里"数字分身"工具链，**自带风格/模板体系**（最接近"一套图"的生产方式）
- ComfyUI 落地件：[cubiq/ComfyUI_InstantID](https://github.com/cubiq/ComfyUI_InstantID) 1,843★ Apache-2.0；[cubiq/PuLID_ComfyUI](https://github.com/cubiq/PuLID_ComfyUI) 911★ Apache-2.0

**（3）端到端"小红书图文批量生产"开源实现（最接近我们业务的公开样本）：**
- [HisMax/RedInk](https://github.com/HisMax/RedInk) — **5,587★**，NOASSERTION（需核对），2026-06-30，"一句话生成小红书图文"
- [op7418/guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill) — **7,274★，AGPL-3.0**，2026-07-01，小红书图文卡片，**28 布局 × 10 主题**（"篇内不重复"的版式侧实现样本；**AGPL 不能直接抄进闭源产品**）
- [comeonzhj/Auto-Redbook-Skills](https://github.com/comeonzhj/Auto-Redbook-Skills) — 2,332★，**无 LICENSE**，2026-08-13
- [ZJU-REAL/Easel](https://github.com/ZJU-REAL/Easel) — 1,721★，Apache-2.0，2026-09-24，跨平台社媒 agent
- [metrosir/consistent-ai-character-prompts](https://github.com/metrosir/consistent-ai-character-prompts) — **仅 4★**，2026-06-24，"同一角色跨场景"的提示词库。**星数极低，只能当线索，不能当方法论依据**
- [TreasureProject/eGirlArmy](https://github.com/TreasureProject/eGirlArmy) — **仅 3★**，2026-02-01，"20 个角色 × 5 个赛道"的虚拟网红机构尝试。**同上，星数过低**

### D.3 D 节结论

**"AI 视觉账号批量化生产"没有权威行业方法论**（英文 side 只有"character consistency"的技术论文与工具；中文 side 的"方法论"多在公众号/自媒体，本次**因为搜索引擎不可用而无法取证**——这是能力限制，不是"不存在"）。
**能核实的三条落地实践就是上面这些代码**：变量矩阵用 `sd-dynamic-prompts` 的枚举+上限思路；拍摄感一致靠 InstantID/PuLID/FaceChain 这类身份/风格载体；篇内不重复靠"显式枚举 + 强制上限"（与本仓 2026-09-25 文档 §2.2 结论一致）。

---

## E. 成本口径：2~3 秒微动效（图生视频）

### E.1 能核实的官方公开价（我直接打开了页面）

**来源 1：阿里云百炼官方计费文档** — [help.aliyun.com/zh/model-studio/billing-for-model-studio](https://help.aliyun.com/zh/model-studio/billing-for-model-studio)
计费规则原文：
> "计费规则：输入不计费，输出计费。输出按成功生成的视频秒数计费。"
> "费用 = 视频单价 × 输出的视频时长（单位：秒）。"

| 模型（图生视频-基于首帧） | 480P | 720P | 1080P |
|---|---|---|---|
| happyhorse-1.1-i2v | **0.45 元/秒** | **0.9 元/秒** | **1.2 元/秒** |
| happyhorse-1.0-i2v | — | 0.9 元/秒 | 1.6 元/秒 |

（华北2·北京；免费额度 10 秒。同页海外新加坡 happyhorse-1.1-t2v 480P 为 0.524594 元/秒。）

**来源 2：Vidu 官方定价** — [platform.vidu.cn/docs/pricing](https://platform.vidu.cn/docs/pricing)
页面标注计价基准：**1 积分 = ¥0.03125**。

| 模型（图生视频） | 分辨率 | 原价 | 低峰价 |
|---|---|---|---|
| viduq3-turbo | 720p | 12 积分/秒（≈**0.375 元/秒**） | 6 积分/秒（≈0.1875 元/秒） |
| viduq3-turbo | 1080p | 13 积分/秒（≈0.406 元/秒） | 7 积分/秒 |
| viduq3-turbo | 540p | 7 积分/秒（≈0.219 元/秒） | 4 积分/秒 |
| viduq3-pro | 720p | 20 积分/秒（≈**0.625 元/秒**） | 10 积分/秒（≈0.3125 元/秒） |
| viduq3-pro | 1080p | 24 积分/秒（≈0.75 元/秒） | 12 积分/秒 |

（"≈元"是我按页面给的 1 积分 = ¥0.03125 换算的，页面只给积分数。另 Q2 系列是"第 1 秒 X 积分，后续每秒 +Y"的阶梯价。）

**来源 3：本仓自己实测的上游价目（最贴合我们的成本结构）** — `docs/research/ip233-model-pricing-20260911.md`，来源为 `GET https://api-new.ip233.com/api/pricing`（用我方 key 实测，非截图 OCR）。按秒计费条目举例：

| 模型 id | 上游价 | 计费方式 |
|---|---|---|
| minimax-h3 | 0.162 元 | **per_second** |
| sd25-30s | 0.27 元 | **per_second** |
| seedance-2.0-fast-480p | 0.325 元 | **per_second** |
| sd4-seedance-2.5-480p | 0.455 元 | **per_second** |
| kling-3.0 | 1.82 元 | per_request |
| wan3.0-video | 6.37 元 | per_request |

同文档已上线的对账数据：**Seedance 2.0 Fast 上游 ￥0.91/条、MiniMax H3 768P 上游 ￥4.55/条**（我方用户价分别为 27 积分/￥6.9、38 积分/￥9.9）。

### E.2 换算到我们的口径（2~3 秒）

| 路径 | 720P 单条（2~3 秒） |
|---|---|
| 阿里云百炼 happyhorse-1.1-i2v | **1.8 ~ 2.7 元** |
| 阿里云百炼 happyhorse-1.1-i2v（480P） | 0.9 ~ 1.35 元 |
| Vidu viduq3-turbo 720p | 0.75 ~ 1.13 元（低峰 0.375 ~ 0.56 元） |
| Vidu viduq3-pro 720p | 1.25 ~ 1.88 元 |
| 本仓 ip233 上游按秒档（0.162~0.455 元/秒） | **0.32 ~ 1.37 元** |

**一句话口径**：**2~3 秒 720P 微动效，可核实的公开价区间约 0.4 ~ 2.7 元/条**；走本仓已有的 ip233 上游按秒档可压到 **1 元/条以内**。

### E.3 查不到的部分（**明确标注，不要当事实用**）

- **即梦 / Dreamina、可灵 Kling、火山引擎方舟（Seedance）、智谱 BigModel、MiniMax 开放平台**的视频生成**官方公开价页，本次均未能取到**：
  - `klingai.com/app/dev/pricing` → 重定向后只返回标题，无价目（JS 空壳）
  - `docs.volcengine.com/docs/82379/1544106` → 重定向后内容为空
  - `open.bigmodel.cn/pricing` → 只有站点名，无价目（JS 空壳）
  - `platform.minimax.cn/docs/guides/pricing` → **只有语音资源包**，无视频定价
  - `cloud.tencent.com/document/product/1729/97731` → **只有文本/视觉的 token 价**，无生视频定价
  - `help.aliyun.com/zh/model-studio/models` → 只有模型清单（ wan2.7-image-pro / wan3.0-video 等），**价目在别处**
- **我不用转述/估算去填这些空。** 如果你要即梦/可灵的口径，最可靠的来源其实是**我们自己的 ip233 价目表**（已实测），或者直接找这些厂商的商务报价。

---

## F. 汇总建议

### F.1 最推荐的 3 个工具

1. **[PetrVys/MotionPhoto2](https://github.com/PetrVys/MotionPhoto2)**（308★，**MIT**，2026-09-15）—— 安卓实况图（`*_MP.jpg`）合成**开箱即用且许可干净**，单张/批量/EXIF 配对/HEIC 全覆盖，只依赖 exiftool。
2. **npm [exiftool-vendored](https://www.npmjs.com/package/exiftool-vendored)**（v38.2.0，**MIT**，2026-09-24）—— 让 Node 服务端**不装 exiftool 也能读写 EXIF/XMP**；iOS 与安卓两条路都要靠它（我们本机就没 exiftool）。
3. **[xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp)**（16,005★，**Apache-2.0**，2026-09-22）—— A 类里唯一"高星 + 许可可商用 + 在更新"的组合；单篇笔记详情/检索走它，**注意必须扫码登录**。
   *（若只要一个 Python 库，备选 `ReaJason/xhs`（MIT）——但已 14 个月未更新。）*

### F.2 实况图走哪条最省事

**先做安卓 `*_MP.jpg`（`MotionPhoto2` + `exiftool-vendored`），因为它是唯一纯服务端、无 Apple 依赖、MIT 许可、还能批量的路径。**
iOS 侧记住三件事：**MOV 侧 ffmpeg `-movflags +use_metadata_tags` 已验证可写**；**静图侧的 Apple MakerNote exiftool 造不出来**（要么上 Mac 跑 `makelive`，要么维护 donor MakerNote 模板）；**封面帧 `still-image-time` 纯命令行写不了**（会被降级，不影响播放）。合成后用 `livephoto-check`（MIT）自动验收。

### F.3 C 节最省事的组合

色板用 npm `colorthief`（MIT）；人脸朝向/姿态/手部用 npm `@vladmandic/human`（MIT，Node 原生，`face-api.js` 已停更/归档）；构图**没有现成库**，用 `@huggingface/transformers` 跑 CLIP 零样本 + `rembg` 主体掩码自算几何规则。**避开 `ultralytics`（AGPL-3.0，商用要授权）。**

---

## 附：本次未完成 / 需后续跟进

1. **美学与构图评分库**（improved-aesthetic-predictor / NIMA / PickScore 等）**未逐条核验**星数与许可证——不要在定价或代码里引用本文之外的数字。
2. **中文方法论文章**（公众号/知乎/小红书运营方法论）因**搜索引擎不可用**未能取证。
3. **即梦/可灵/火山/智谱/MiniMax 官方视频价目**未取到（见 E.3）。
4. **`exiftool` 的 License 页原文**未打开，商用结论待法务确认（见 B.2 末尾）。
5. **`XHS-Downloader` 的 GPL-3.0 合规判断**（独立进程调用 vs 嵌入分发）需法务确认；若不接受 GPL，改走"自研 Playwright 解析 `__INITIAL_STATE__`"。
6. **`node-vibrant` 的许可证出入**（npm 声明 MIT，GitHub 仓库无 LICENSE 文件）需核对。
