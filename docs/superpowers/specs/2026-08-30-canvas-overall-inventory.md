# 薯包画布总统筹重审 - 全站功能清单 (commit 9444c34f + c3da9800)

## 一、EcCanvas (src/pages/EcCanvas/) - 49 个文件

### 入口 & 状态 (1 个文件, 5543 行)
- `index.jsx` - 主入口, 内置 4 tab (canvas/assets/works/trash) + 3 overlay (chain/multiModal/templateMarketplace) + 中央空状态 3 行分层 + CanvasAssetQuickPanel 1-click 拖入

### 节点视觉 (components/workflowNodes/, 12 个文件)
- `CanvasWorkflowNode.jsx` - 节点壳
- `CanvasPortHandle.jsx` - 输入/输出端口
- `CanvasNodeActionPicker.jsx` - 节点动作选择
- `CanvasNodeShell.jsx` - 节点外壳
- `CanvasWorkflowNodes.module.css`
- `CompactProcessNodeCard.jsx` - 紧凑过程卡片
- `LayerWorkbenchNodeCard.jsx` - 图层工作台卡片
- `SmartRemixNodeCard.jsx` - 商品改造卡片
- `workflowNodeViewModel.js` - 节点视图模型

### 中央弹窗/派生菜单 (CanvasStudio.jsx, 1304 行, 19 export)
- `CanvasAddMenu` - 中央弹窗添加节点菜单 (7 项: 上传图片/上传视频/从作品导入/生成图片/生成文案/生成电商套图/生成视频)
- `CanvasObjectToolbar` - 选中节点顶部工具条
- `CanvasDeriveMenu` - 派生菜单 (从选中节点生成新节点)
- `CanvasTextToolbar` - 文本工具条
- `CanvasMultiSelectionToolbar` - 多选工具条
- `CanvasGenerationNode` - 生成节点 (图层组合)
- `CanvasImageComposer` / `CanvasTextGenerationComposer` / `CanvasVideoComposer` / `CanvasEcommerceComposer` - 4 种生成器节点
- `CanvasFocusedEditor` - 焦点编辑器 (裁剪/宫格/移动缩放/标注)
- `CanvasImageNode` / `CanvasSourceNode` / `CanvasTextNode` / `CanvasAudioNode` - 4 种素材节点
- `CanvasParameterControls` / `CanvasSuiteControls` / `CanvasSuitePlanEditor` - 参数面板

### 顶部/底部工具 (components/CanvasChrome.jsx, 198 行, 4 export)
- `CanvasTopBar` - 顶部工具栏, 含 4 tab (canvas/assets/works/trash) + 3 overlay 入口按钮 (1-click 视频/多模态串联/模板广场) + 导出整套图片 + 恢复 + 新建
- `CanvasLeftRail` - 左侧添加节点按钮
- `CanvasBottomToolbar` - 底部工具区, 5 工具 (选择/抓手/添加图片/添加文本/图层)
- `CanvasLayersPanel` - 右侧图层面板
- `CanvasZoomControls` - 缩放控制

### 右侧固定面板 (components/EcCanvasRightPanel.jsx, 249 行)
- 玻璃+暗色面板, 顶部素材卡 + 中部 CanvasDeriveMenu + 底部参数调整 (透明度/尺寸/位置/时长/音量) + AI 积分消耗徽章
- 14 项派生菜单 (5 原有 core + 4 智能 magic + 5 调整/分割 = CANVAS_ACTIONS)

### 3 个 Overlay (components/)
- `CanvasChainOverlay.jsx` (33 行) - 1-click 视频链式 (4 步: 文案->首帧->视频->音轨+字幕), 包装 ChainOrchestrator
- `CanvasMultiModalOverlay.jsx` (39 行) - 三方多模态串联 (视频/音频/商品档案 3 路), 包装 MultiModalEntry
- `CanvasTemplateMarketplace.jsx` (137 行) - 100 套模板广场, 9 类目 pill + 9 列 SVG 缩略图 + 价格徽章
- `CanvasAssetQuickPanel.jsx` (77 行) - 1-click 拖入素材持久面板, 3 按钮 (商品档案/公共素材库/本地上传)

### Hero 图标 & 上下文 (components/HeroIcons.jsx + ContextMenu.jsx)
- `HeroIcons.jsx` - 手绘 5 glyph (带入族/生成族/导入独立)
- `ContextMenu.jsx` - 右键菜单

### 业务模型 (src/pages/EcCanvas/*.js, 21 个文件)
- `canvasState.js` - 画布 viewport/pointer/asset 工具
- `nodeWorkflow.js` - 节点/连接/派生 workflow
- `canvasInteractionModel.js` - 节点选择/拖拽/对齐
- `canvasStudioModel.js` - 节点创建/composer/ratio
- `canvasAssetProvenance.js` - 资产来源追溯
- `canvasAssetReferenceModel.js` - 资产引用
- `canvasDraftRepository.js` - 草稿持久化
- `canvasGeometry.js` - 几何/距离/中心
- `canvasSegmentationModel/Runtime/Worker.js` - 图层分割
- `canvasInlineEditorModel.js` - 内联编辑
- `canvasLayerMaterialization.js` - 图层实例化
- `canvasSessionModel.js` - 画布会话
- `canvasSuitePlanModel.js` - 套图方案
- `canvasTextRecognitionModel.js` - OCR
- `canvasWorkModel.js` - 作品筛选/规范化
- `canvasBillingModel.js` - 计费
- `canvasBrowserQaState.js` - QA
- `detailCompositionModel.js` - 详情图组合
- `exportDeliveryModel.js` - 导出交付
- `canvasDerivedPlacement.js` - 派生节点位置
- `browserFileDelivery.js` - 浏览器文件下载
- `generationStatusModel.js` - 生成状态
- `canvasActionRegistry.js` - 27 个 actions 注册中心 (含 selection/image-editor/context 3 surface)

## 二、src/components/ - 54 个文件

### ui/ 基础 (8 个)
- Button / Popover / PopoverGroup / Toast / UploadBox / DialogProvider / AnchoredPortal / index.jsx

### 长任务 (2 个)
- `LongTaskOverlay.jsx` + `LongTaskProvider.jsx` - 全局长任务遮罩 + 进度条

### layout/ (4 个)
- `Navbar.jsx` - 顶层 Navbar, 4 项 (首页/作品展示/我的作品/套餐)
- `Footer.jsx`
- `CreativeDomainNav.jsx` + `creativeDomainNavigation.js` - 创作域导航 (workspace/video/content 3 group)

### business/ (10 个)
- `Modals.jsx` (含 LoginModal + PricingModal + 旧 PricingModalLegacy)
- `PricingModal.jsx` (新)
- `DevicesPanel.jsx` / `RetentionPanel.jsx` - 设备/留存
- `CloneProjectModal.jsx` - 克隆项目
- `AIComplianceWatermark.jsx` - AI 合规水印
- `AssetQuickDrag.jsx` - 1-click 拖入 (单按钮, 也被 EcCanvas/CanvasAssetQuickPanel 和 EcStudio 复用)
- `MultiModalEntry.jsx` - 多模态入口 (也被 VideoStudio 复用)
- `loginOtpState.js`

### creation/ (5 个) - 提示词构造
- MentionPromptField / ImageMentionPicker / ContentReferencePicker / imageMentionModel / promptPaste

### billing/ (8 个)
- `AccountEntitlementControl.jsx` - 账号权益控件 (画布右上角用)
- `BillingBalanceCard.jsx` / `BillingHistoryList.jsx` / `BillingPriceBadge.jsx` / `BillingQuoteBreakdown.jsx`
- `InsufficientBalanceModal.jsx` - 余额不足弹窗
- `billingUiModel.js` / `accountEntitlementModel.js` / `pricingCatalogModel.js`

### chain/ (3 个) - 4 步链式生成
- `ChainOrchestrator.jsx` - 链式调度 (文案->首帧->视频->音轨+字幕) (也被 VideoStudio 复用)
- `ChainProgress.jsx` - 进度展示
- `chain.css`

### task/ (3 个)
- `TaskSidebar.jsx` - 任务侧栏
- `GenModal.jsx` / `BatchProgress.jsx` / `ReadProgress.jsx`

### 其它 (4 个)
- `ErrorBoundary.jsx` / `ResponsiveImage.jsx` / `responsiveImageModel.js` / `ProjectAssetPicker.jsx` (被 EcStudio 用)

## 三、src/services/ - 18 个文件

### api.js (2072 行, 49 个 export, 52 个端点)
**画布相关**:
- `uploadEcommerceAsset/Assets` - 商品图上传
- `generateEcommerceSuite` - 套图生成
- `regenerateCanvasImage/Text` - 重新生成图/文
- `transformCanvasImage` - 画布变换
- `analyzeCanvasLayers` - 图层分析
- `createCanvasSegmentationPlan` / `createCanvasPixelLayers` / `exportCanvasPsd` - 图层切分/PSD 导出
- `recognizeCanvasText` / `replaceCanvasText` - OCR
- `removeBg` / `reversePrompt` / `stitchLongImage` - 工具
- `createTextComposition` / `listTextCompositions` / `loadTextComposition` / `saveTextCompositionRevision` - 文本合成

**作品管理**:
- `saveWork` / `deleteWork` / `restoreWork` / `loadTrash` / `loadWorks` / `loadCachedWorks` / `downloadZip`
- `proxyImg` / `imageVariantUrl` / `normalizeCanvasImageUrl` / `galleryImg`

**电商工作台**:
- `generateEcommerce` / `autoGenerate` / `generateContent` / `generatePlogContent` / `generateEcommercePreview`
- `getEcommerceTask` / `listEcommerceTasks` / `dismissEcommerceTask` / `quoteFailedEcommerceTask` / `retryFailedEcommerceTask`
- `autoRecognizeEcommerce` / `getDesignDirections` / `polishECText`
- `uploadECTempImages` / `extractProductLink` / `getExtractData` / `regenerateImage` / `regenerateText`
- `cloneProject`

### 其它 service (17 个)
- `video.js` / `videoUploadClient.js` / `videoWorkbench.js` - 视频
- `projects.js` - 项目
- `projectAssetContract.js` / `projectAssetDrag.js` - 项目素材
- `chain.js` - 4 步链式
- `multiModal.js` - 多模态
- `billing.js` - 计费
- `imageModelCatalog.js` - 图片模型目录
- `auth.js` / `admin.js` - 鉴权/管理
- `sse.js` / `taskSync.js` / `requestLifecycle.js` / `apiError.js`
- `ecommerceRetryPolicy.js` - 电商重试

### API 端点 (52 个 fetch 调用)
`/api/ecommerce/assets`, `/api/ecommerce/jobs/:id`, `/api/ecommerce/jobs/:id/retry-plan`, `/api/ecommerce/jobs/:id/retry-failed`, `/api/ecommerce/auto-recognize`, `/api/ecommerce/design-directions`, `/api/ecommerce/stitch-long`, `/api/ecommerce-preview`, `/api/generate`, `/api/plog-generate`, `/api/generate-ecommerce`, `/api/save-work`, `/api/delete-work`, `/api/restore-work`, `/api/trash`, `/api/works`, `/api/proxy-image`, `/api/public-image`, `/api/extract-product-link`, `/api/bookmarklet-data`, `/api/regenerate-image`, `/api/regenerate-text`, `/api/canvas/regenerate`, `/api/canvas/regenerate/status`, `/api/canvas/transform`, `/api/canvas/analyze-layers`, `/api/canvas/segmentation-plan`, `/api/canvas/ocr`, `/api/canvas/replace-text`, `/api/canvas/psd-export`, `/api/canvas/regenerate-text`, `/api/canvas/pixel-layers`, `/api/compositions`, `/api/compositions/:id`, `/api/compositions/:id/revisions`, `/api/reverse-prompt`, `/api/remove-bg`, `/api/polish-ec-text`, `/api/ec-temp-upload`, `/api/gallery-image`, `/api/generated-assets/:id`, `/api/projects/:id/clone`

## 四、画布 4 大区域按钮总盘点

### A. 顶部工具栏 (CanvasTopBar, components/CanvasChrome.jsx L55-106)
```
[返回] [项目名] [当前画布/素材库/作品集/回收站]                              [积分徽章] [图片类型筛选] [1-click 视频] [多模态串联] [模板广场] [导出整套图片] [恢复] [新建生图]
```
**按钮数**: 12 个 (4 tab + 3 overlay + 4 操作 + 1 徽章)
**重复风险**: tab=assets (项目素材库) 跟"素材"侧栏入口都指 project_asset_library; tab=works (作品集) 跟"我的作品" Navbar 入口都指 loadWorks()

### B. 底部工具区 (CanvasBottomToolbar, L115-135)
```
[选择] [抓手] [添加图片] [添加文本] [图层]
```
**按钮数**: 5 个

### C. 中央空状态 3 行分层 (L4678-4703)
```
Row 1 添加素材 (3): [上传图片] [上传视频] [从我的作品导入]
Row 2 AI 生成 (2):   [生成电商套图] [生成视频]
Row 3 智能 (3):     [1-click 套图] [1-click 视频] [TTS 配音]
```
**按钮数**: 8 个 (5 原有 + 3 新增)
**重复风险**: Row 2 "生成电商套图" 跟 Row 3 "1-click 套图" 都创建 suite 节点; Row 2 "生成视频" 跟 Row 3 "1-click 视频" 都触发 video; 中央弹窗 CanvasAddMenu 还有"生成电商套图"/"生成视频"/"生成图片"/"生成文案"/"上传图片"/"上传视频"/"从作品导入" 7 项, 跟 Row 1+Row 2 完全重叠!

### D. 中央弹窗 (CanvasAddMenu, components/CanvasStudio.jsx L137-147, 7 项)
[上传图片] [上传视频] [从作品导入] [生成图片] [生成文案] [生成电商套图] [生成视频]
**重复**: 完全跟空状态 Row 1+Row 2 重叠!

### E. 1-click 拖入面板 (CanvasAssetQuickPanel, L57-76, 3 按钮)
[商品档案] [公共素材库] [本地上传]
**重复**: "商品档案"跟项目素材 tab (assets) 都走 listProjectAssetLibrary; "公共素材库"跟 PROJECT_ASSET_DRAG_SOURCES 同样; "本地上传"跟底部"添加图片"完全重叠

### F. 右侧派生菜单 (CanvasDeriveMenu, components/CanvasStudio.jsx L202, 14 项 - 27 个 actions 中 selection/image-editor 2 surface)
```
[调整生成要求] [重新生成] [商品图改造] [智能扩图] [局部改图] [图片翻译] [高清修复]
[编辑文字] [添加文字] [宫格切分] [智能分层] [去除背景] [移动缩放] [反推提示词] [图片标注]
[裁剪] [分割图片] [导出图片]
[1-click 套图] [1-click 视频模板] [TTS 配音] [字幕动效]
```
**按钮数**: 22 个 action (selection 9 + image-editor 10 + 4 智能)
**重复风险**: 跟空状态 Row 3 完全重复 (1-click 套图/1-click 视频/TTS 配音); 跟顶部 overlay 入口也重复 (1-click 视频)

### G. 上下文菜单 (ContextMenu.jsx + canvasActionRegistry.js, context surface, 14 项)
[复制] [粘贴] [创建副本] [上移一层] [下移一层] [移动至顶层] [移动至底层] [显示/隐藏] [锁定/解锁] [水平翻转] [垂直翻转] [导出] [删除] ...

## 五、画布 27 个 actions 详细清单 (canvasActionRegistry.js)
1. adjust-requirements 调整生成要求 (composer)
2. regenerate 重新生成 (route)
3. edit-text 编辑文字 (selection)
4. add-text 添加文字 (selection)
5. grid-split 宫格切分 (selection)
6. layer-edit 智能分层 (selection)
7. remove-background 去除背景 (selection)
8. move-scale 移动缩放 (selection)
9. reverse-prompt 反推提示词 (selection)
10. annotation 图片标注 (selection)
11. crop 裁剪 (selection)
12. split-image 分割图片 (selection)
13. download 导出图片 (selection)
14. copy 复制 (context)
15. paste 粘贴 (context)
16. duplicate 创建副本 (context)
17. bring-forward 上移一层 (context)
18. send-backward 下移一层 (context)
19. bring-front 移动至顶层 (context)
20. send-back 移动至底层 (context)
21. toggle-visibility 显示/隐藏 (context)
22. toggle-lock 锁定/解锁 (context)
23. flip-horizontal 水平翻转 (context)
24. flip-vertical 垂直翻转 (context)
25. export-object 导出 (context)
26. delete 删除 (context)
27. product-remix 商品图改造 (image-editor)
28. outpaint 智能扩图 (image-editor)
29. inpaint 局部改图 (image-editor)
30. translate 图片翻译 (image-editor)
31. upscale 高清修复 (image-editor)
32. one-click-suite 1-click 套图 (AI 智能)
33. one-click-video 1-click 视频模板 (AI 智能)
34. tts-voiceover TTS 配音 (AI 智能)
35. caption-motion 字幕动效 (AI 智能)

**总 35 个 action, 4 个分组: 优先操作/创作与修改/电商处理/AI 智能**

## 六、画布节点 kind 清单 (按现有实现)
- `source_group` - 商品素材组 (group of source images)
- `image` - 图片素材节点
- `output` - 生成图片节点
- `video` - 视频节点
- `audio` - 音频节点 (W4 实装)
- `text` - 文本节点
- `layer-group` - 图层组合
- `image-composer` - 图片生成器
- `suite-composer` - 套图生成器
- `video-composer` - 视频生成器
- `text-composer` - 文案生成器
- `smart-remix` - 商品改造
- `remove-bg` - 去背景
- `extend` - 智能扩图
- `inpaint` - 局部改图
- `translate` - 图片翻译
- `upscale` - 高清修复
- `layer-workbench` - 图层工作台
- `one-click-suite` - 1-click 套图
- `one-click-video` - 1-click 视频模板
- `tts-voiceover` - TTS 配音
- `caption-motion` - 字幕动效

## 七、跨页面组件复用 (重复风险高)
- `MultiModalEntry` 被 VideoStudio (L1878) + EcCanvas (CanvasMultiModalOverlay L36) 同时用
- `ChainOrchestrator` 被 VideoStudio (L1038) + EcCanvas (CanvasChainOverlay L30) 同时用
- `AssetQuickDrag` 被 EcStudio (L724/L768) + EcCanvas (CanvasAssetQuickPanel L72) 同时用
- `ProjectAssetPicker` 被 EcStudio 用
- `LongTaskOverlay/Provider` 全局用 (不算重复)

## 八、画布视觉体系
- 字体: lucide-react (stroke-width 1.75) 全量替换
- CSS 变量: --ec-* token (圆角/阴影/动效)
- HeroGlyph 手绘 5 glyph (带入族/生成族/导入)
- cursor spotlight (radial-gradient)
- 微动效: transform-only + spring130ms
- prefers-reduced-motion 修复 (结构错误)
- 三档尺寸: 16/18/42 px
- hover 图标消失 bug 已修 (backwards fill)
