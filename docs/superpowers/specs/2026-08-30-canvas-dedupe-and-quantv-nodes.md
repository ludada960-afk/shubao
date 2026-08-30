# 薯包画布总统筹重审 - 重复项 + Quantv 节点串联方案 (commit 9444c34f + c3da9800)

## 一、6 处重复项清单

### R1. 画布智能区 vs 中央弹窗 (CanvasAddMenu) - 用户反馈核心 ★★★
- **空状态 Row 2 "生成电商套图"** = CanvasAddMenu 第 6 项 "生成电商套图" (都调用 addCanvasComposer('suite'))
- **空状态 Row 2 "生成视频"** = CanvasAddMenu 第 7 项 "生成视频" (都调用 addCanvasComposer('video'))
- **空状态 Row 3 "1-click 套图/1-click 视频/TTS 配音"** = 顶部 overlay 按钮 1-click 视频 + 多模态串联 + 右侧派生菜单 AI 智能组 4 项
- **画布顶部 tab "从我的作品导入"** = CanvasAddMenu 第 3 项 "从作品导入" + 中央弹窗 "上传图片/上传视频"
- **唯一保留**: Row 1 (上传图片/上传视频/从作品导入) = 一次性入口; Row 2/3 拿掉, 改走节点串联

### R2. 顶部 overlay 按钮 vs 空状态 Row 3 (智能区) - ★★★
- **顶部 [1-click 视频] button** = 空状态 Row 3 [1-click 视频] button (都调 handleSmartChainAction('one-click-video'))
- **顶部 [多模态串联] button** = 空状态缺位 (multiModalOverlayOpen) → 顶部独有, 不重复
- **顶部 [模板广场] button** = CanvasTemplateMarketplace 独立功能, 不算重复
- **拿掉**: 顶部 3 个 overlay button 1-click 视频 (保留"多模态串联" + "模板广场"); 改走节点串联 (图片节点 → 视频节点 → 音频节点)

### R3. CanvasAssetQuickPanel (1-click 拖入) vs EcCanvas 顶部 tab=assets - ★★
- **顶部"商品档案"** = tab=assets 的 listProjectAssetLibrary (项目素材库)
- **顶部"公共素材库"** = 项目素材库 PROJECT_ASSET_DRAG_SOURCES.PUBLIC_TEMPLATE
- **顶部"本地上传"** = 底部工具区"添加图片"按钮 (sourceUploadRef.current?.click())
- **拿掉**: 整个 CanvasAssetQuickPanel (3 按钮); 用户走 tab=assets 完整面板 + 底部添加图片/视频

### R4. 顶部 tab=works vs Navbar "我的作品" - ★
- **Navbar "我的作品"** = SideNav "作品" 入口 = 顶部 tab "作品集"
- 三处都打开 loadWorks() 数据
- **拿掉**: Navbar "我的作品" 项 (保留 SideNav icon-only "作品" 入口 + 画布 tab=works)

### R5. 顶部 tab=assets vs SideNav "素材" - ★
- **SideNav "素材"** = Navbar 无 = 顶部 tab "素材库"
- 两处都打开 projectAssetLibrary
- **拿掉**: SideNav "素材" 入口 (保留画布 tab=assets 完整面板, 移除 SideNav icon)

### R6. 画布右侧派生菜单 AI 智能组 vs 空状态 Row 3 - ★★
- **AI 智能组 (one-click-suite/one-click-video/tts-voiceover/caption-motion)** 4 项 = 空状态 Row 3 (1-click 套图/1-click 视频/TTS 配音) 3 项 + 顶部 overlay 1-click 视频 1 项
- **拿掉**: AI 智能组 4 项 (one-click-suite/one-click-video/tts-voiceover/caption-motion); 改走节点串联 (图片节点 → 视频节点 → 音频节点)

## 二、Quantv 节点串联方案

### 节点类型精简到 5 类 (按 Quantv §10.2)
Quantv 验证: 5 个类型 + 2 资源入口 = 最简最强.

**保留** (5 类):
1. **图片节点 (image / output / layer-group / source_group)** - 已有
2. **视频节点 (video)** - 已有
3. **音频节点 (audio)** - 已有 (W4 实装)
4. **文本节点 (text)** - 已有 (镜头脚本)
5. **应用节点 (application)** - quantv 独有 = 预设工作流节点 (如"5 宫格套图"作为一个应用节点, 内部串联 5 个图片节点)

**拿掉** (10 类冗余节点):
- one-click-suite, one-click-video, tts-voiceover, caption-motion → 改走节点串联
- suite-composer, image-composer, video-composer, text-composer → composer 是过程不是节点, 走现有节点 (image/video/text)
- smart-remix, remove-bg, extend, inpaint, translate, upscale, layer-workbench → 7 个派生节点拿掉, 改走"应用节点" (预设工作流)
  - smart-remix → 应用节点"商品图改造" (1 输入, 1 输出)
  - remove-bg → 应用节点"去除背景"
  - extend → 应用节点"智能扩图"
  - inpaint → 应用节点"局部改图"
  - translate → 应用节点"图片翻译"
  - upscale → 应用节点"高清修复"
  - layer-workbench → 应用节点"智能分层"

### 节点间串联 - 按 Quantv §10.4 / §11.1
**核心**: 节点相邻排版 (quantv 无独立 Edge) + 文本节点"镜号 1→镜号 2" 时间戳串联

**保留** (现有):
- 端口连接 (PortHandle) - image/video 节点都有 port-down/out
- ConnectionLines (连接线)
- 节点拖拽 + 自动整理

**简化**:
- 节点间关联靠"端口连接", 但派生操作不再是独立节点, 而是端口连接 + 上下文菜单/右侧面板的"应用节点"操作
- 节点串联示例:
  - 图片节点 A → 端口 → 应用节点"商品图改造" → 端口 → 图片节点 A' (1 输入 1 输出)
  - 图片节点 A + 图片节点 B → 端口 → 应用节点"5 宫格套图" → 端口 → 5 个图片节点
  - 视频节点 → 端口 → 应用节点"加字幕" → 端口 → 视频节点 A' (字幕烧录)
  - 图片节点 → 端口 → 视频节点 (图生视频, 1 输入 1 输出, 视频节点自带)
  - 文本节点 → 端口 → 视频节点 (文生视频, 视频节点自带)

### 节点属性差异化 (按 Quantv §10.3 视频节点)
每类节点有独立面板, 而不是统一右侧派生菜单:
- **图片节点**: 工具条 (调整要求/重新生成/编辑文字/添加文字/宫格切分/智能分层/去除背景/移动缩放/反推提示词/图片标注/裁剪/分割图片/导出图片) = 现有 13 项 + 应用节点 (商品图改造/智能扩图/局部改图/图片翻译/高清修复) 5 项
- **视频节点**: 工具条 (智能去字幕/聚焦/下载/添加/预览/替换视频) 6 项 + 视频专属属性 (model/format/duration/cost) + 应用节点 (加字幕/拼接/变速) 3 项
- **音频节点**: 工具条 (聚焦/下载/添加/预览) 4 项 + 音频专属属性 (音量/时长/格式) + 应用节点 (TTS 配音/降噪) 2 项
- **文本节点**: 字数统计 + 镜号分解 + 1-click 去生图片/去生视频 ★
- **应用节点**: 预设工作流 UI, 内部展示串联的子节点

### 预计积分实时显示 (按 Quantv §10.3)
每个节点都有底部 ✦ 预计 X.XX 积分 显示, 不靠"右侧派生菜单"的全局计费徽章.

## 三、总统筹 - 改后画布应长成什么样

### A. 顶部工具栏 (10 个, 拿掉 2 个)
**保留**:
- [返回] [项目名] [当前画布/素材库/作品集/回收站] [积分徽章] [图片类型筛选] [多模态串联] [模板广场] [导出整套图片] [恢复] [新建生图]
**拿掉**:
- [1-click 视频] button (改走"图片节点 → 视频节点"端口串联)

### B. 底部工具区 (5 个, 保留)
- [选择] [抓手] [添加图片] [添加文本] [图层]

### C. 中央空状态 (5 个, 拿掉 3 个)
**保留**:
- Row 1 (3): [上传图片] [上传视频] [从我的作品导入]
**拿掉**:
- Row 2 (2): [生成电商套图] [生成视频]
- Row 3 (3): [1-click 套图] [1-click 视频] [TTS 配音]
**改为**:
- Row 2 (1): [新建应用节点] (让用户从预设工作流开始)

### D. 中央弹窗 (5 个, 拿掉 2 个)
**保留**:
- [上传图片] [上传视频] [从作品导入] [生成图片] [生成文案]
**拿掉**:
- [生成电商套图] (改走应用节点"5 宫格套图")
- [生成视频] (改走视频节点)

### E. 1-click 拖入面板 (拿掉整个)
- 整个 CanvasAssetQuickPanel 删除 (3 按钮全在 tab=assets + 底部"添加图片/视频")

### F. 右侧派生菜单 (22 项, 拿掉 4 项 AI 智能)
**保留**:
- selection 9 项 + image-editor 10 项 + context 14 项 = 33 项 (去掉 AI 智能 4 项 = 29 项, 不再重新定义)
**拿掉**:
- AI 智能组 (one-click-suite/one-click-video/tts-voiceover/caption-motion) 4 项

### G. 节点 kind 清单 (从 22 类精简到 12 类)
**保留** (12 类):
- source_group / image / output / video / audio / text / layer-group / application (新) / text-composer (文案生成) / application-suite (5 宫格套图) / application-1click-video (1-click 视频) / application-tts (TTS)
**拿掉** (10 类):
- one-click-suite, one-click-video, tts-voiceover, caption-motion, suite-composer, image-composer, video-composer, smart-remix, remove-bg, extend, inpaint, translate, upscale, layer-workbench → 合并到 application 系列

### H. 上下文菜单 (14 项, 保留)
- 不变, 复制/粘贴/创建副本/上移一层/下移一层/移动至顶层/移动至底层/显示/隐藏/锁定/解锁/水平翻转/垂直翻转/导出/删除

## 四、改后按钮总数对比

| 区域 | 改前按钮数 | 改后按钮数 | 减少 |
|------|----------|----------|------|
| 顶部工具栏 | 12 | 10 | -2 (1-click 视频) |
| 底部工具区 | 5 | 5 | 0 |
| 中央空状态 | 8 | 4 | -4 (Row 2+3 拿掉) |
| 中央弹窗 | 7 | 5 | -2 (生成套图/视频) |
| 1-click 拖入面板 | 3 | 0 | -3 (整个面板拿掉) |
| 右侧派生菜单 | 33 | 29 | -4 (AI 智能组) |
| 上下文菜单 | 14 | 14 | 0 |
| **总按钮数** | **82** | **67** | **-15 (-18%)** |

改后画布更精炼, 跟 Quantv 调研结论一致: 节点类型从 22 类精简到 12 类, 按钮数从 82 个减到 67 个.
