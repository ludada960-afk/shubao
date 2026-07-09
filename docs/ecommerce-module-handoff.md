# 薯包AI · 电商图生成模块 — 完整项目文档

> 本文档供 Claude（另一实例）接手项目时使用。含完整的架构说明、代码结构、当前状态和待办事项。

---

## 1. 项目概述

薯包AI (Shubao AI) 是一个 AI 内容生成平台，当前有两条产品线：
- **小红书图文生成**（XHS）— 输入主题 → 文案 + 9 张配图（SSE 流式）
- **电商商品图生成**（EC）— 输入商品信息 → 多张电商商品图

本文档专门针对**电商商品图生成**模块，包含两个模式：

| 模式 | 说明 | 状态 |
|------|------|------|
| **快捷生成（Quick Generate）** | 用户填写商品名称/品类/卖点/平台 → 直接出图 | 基本可用，后端刚实现 |
| **从链接复刻（Remake）** | 浏览器插件采集电商页面 → AI 分析 → 用户替换商品 → 生成 | 完整可用 |

---

## 2. 项目架构

```
┌─ 前端 (React / Vite) ─────────────────────────────┐
│  src/pages/Home/index.jsx       ← EC 模式（快捷生成表单）  │
│  src/pages/Ecommerce/index.jsx  ← 独立 EC 页面（未接入路由）│
│  src/pages/Remake/index.jsx     ← 复刻页面               │
│  src/services/api.js            ← 所有 API 调用          │
│  src/constants/data.js          ← 品类/平台/定价常量      │
│  src/store/AppContext.jsx        ← 全局状态（page/mode等） │
│  src/App.jsx                    ← 路由                   │
│  src/components/layout/Navbar.jsx ← 导航栏               │
└─────────────────────────────────────────────────────────┘

┌─ 后端 (Express 4) ────────────────────────────────┐
│  server/index.mjs                 ← 主服务器入口          │
│    ├── POST /api/generate-ecommerce  ← 快捷生成（新实现）  │
│    ├── POST /api/generate            ← XHS 图文生成        │
│    ├── POST /api/regenerate-image    ← 单图重生成          │
│    ├── POST /api/regenerate-text     ← 文案重生成          │
│    └── POST /api/save-work / GET /api/works ← 作品存取    │
│                                                   │
│  server/ecommercePromptEngine.mjs  ← 电商提示词引擎      │
│    ├── 8 品类视觉特征库（CATEGORY_VISUALS）            │
│    ├── 11 种图片角色（IMAGE_ROLES）                    │
│    ├── 3 级 tier 系统（TIER_ROLES）                    │
│    ├── 6 平台尺寸/视觉规范（PLATFORM_SIZES）            │
│    ├── buildECPrompt()           ← 标准分图 prompt      │
│    ├── buildBeautyReportPrompt() ← 美妆分析报告 prompt  │
│    └── buildRolePrompt()         ← 各角色具体 prompt    │
│                                                   │
│  server/extensionRoutes.mjs      ← 复刻流程后端         │
│    ├── POST /api/extension/collect    ← 接收插件数据     │
│    ├── GET  /api/extension/task/:id   ← 查任务状态      │
│    ├── POST /api/extension/analyze    ← AI 视觉分析     │
│    └── POST /api/extension/regenerate ← 复刻生成        │
│                                                   │
│  server/extensionTaskManager.mjs  ← 任务状态机          │
│  server/ecommercePromptEngine.mjs ← 提示词引擎（共享）   │
└─────────────────────────────────────────────────────────┘

┌─ 浏览器插件 (Manifest V3) ───────────────────────┐
│  shubao-extension/                                │
│    ├── manifest.json         ← 插件声明             │
│    ├── background-wrapper.js ← 后台服务             │
│    ├── popup.js              ← 弹出面板             │
│    ├── content.js            ← 内容脚本（注入）      │
│    ├── extractors/           ← 提取器              │
│    │   └── genericDOM.js     ← 通用 DOM 提取        │
│    ├── platforms/            ← 各平台专用提取器      │
│    │   ├── taobao.js         ← 淘宝/天猫            │
│    │   ├── jd.js             ← 京东                │
│    │   ├── amazon.js         ← Amazon              │
│    │   ├── shopify.js        ← Shopify             │
│    │   └── ...               ← 1688/拼多多等        │
│    └── utils/                ← 工具函数             │
│        ├── imageFilter.js    ← 图片过滤              │
│        └── urlBuilder.js     ← URL 构建             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 代码文件详解

### 3.1 提示词引擎 (`server/ecommercePromptEngine.mjs`)

最核心的文件。定义了 **品类→角色→平台→prompt** 的完整映射。

**品类视觉特征库（CATEGORY_VISUALS）** — 8 品类：

| 品类 | 关键字段 |
|------|---------|
| 美妆护肤 | materials, texture, lighting, scene_desc, surface, base_colors, accent_colors, color_scheme |
| 数码3C | 同上结构 |
| 食品饮料 | 同上 |
| 服饰穿搭 | 同上 |
| 家居生活 | 同上 |
| 母婴用品 | 同上 |
| 宠物用品 | 同上 |
| 其他 | 通用兜底 |

**图片角色（IMAGE_ROLES）** — 11 角色：

| Role Key | Label | 比例 | 说明 |
|----------|-------|------|------|
| main_white | 白底主图 | 1:1 | 纯白底产品展示 |
| feature_1~3 | 卖点图①②③ | 1:1 | 各突出一个卖点 |
| scene | 场景图 | 3:4 | 使用场景展示 |
| detail | 材质细节图 | 1:1 | 材质/工艺特写 |
| comparison | 对比效果图 | 3:4 | 使用前后对比 |
| sku | SKU规格图 | 1:1 | 颜色/尺寸变体 |
| package | 包装组合图 | 3:4 | 全套配件展示 |
| transparent | 透明PNG图 | 1:1 | 无背景透明图 |
| **beauty_report** | **美妆分析报告** | **3:4** | **新加—单张信息图** |

**Tier 系统（TIER_ROLES）**：

| Tier | 包含的角色 | 张数 |
|------|-----------|------|
| basic | main_white + feature_1 + scene | 3 |
| standard | main_white + feature_1~2 + scene + detail | 5 |
| complete | main_white + feature_1~3 + scene + detail + comparison + sku + package | 9 |

**关键函数**：

```javascript
// 标准分图 prompt（已支持 brandWorld 参数）
buildECPrompt({ productName, category, roleKey, sellingPoints, platform, brandWorld })

// 美妆分析报告 prompt（新加）
buildBeautyReportPrompt({ productName, category, sellingPoints, platform })

// 获取某 tier 的所有图片角色配置
getTierImages(tier, sellingPoints, category)

// 导出常量
IMAGE_ROLES, TIER_ROLES, TIER_META, getCategoryOptions()
```

### 3.2 后端主入口 (`server/index.mjs`)

**快捷生成 API（新实现）：**

```
POST /api/generate-ecommerce
Body: { product_name, category, tier, platform, selling_points, 
        reference_images, beauty_report, brand_world }
Return: { product_name, category, platform, tier, images, errors }
```

- `images` = `{ '白底主图': 'url', '场景图': 'url', ... }` 或 `{ '美妆分析报告': 'url' }`
- 当 `beauty_report=true` 时不走 tier 分图，只生成一张信息图
- 当 `brand_world` 非空时，每张图的 prompt 追加品牌一致性约束
- 图片生成复用已有的 `generateImage()` 和 `callImageAPI()` 函数

### 3.3 Home 页 EC 模式 (`src/pages/Home/index.jsx`)

Home 页有两个模式（XHS/EC），通过 mode-tab 切换。EC 模式的表单在 `{!isXHS && (...)}` 区块内。

**EC 表单字段：**

| 字段 | 变量 | 类型 | 说明 |
|------|------|------|------|
| 商品名称 | ecName | string | 必填 |
| 品类 | ecCat | string | 8品类选项芯片 |
| 卖点文案 | ecPoints | textarea | 每行一个 |
| 生成等级 | ecTier | 'basic'/'standard'/'complete' | Tier选择 |
| 目标平台 | ecPlatform | string | 6平台芯片 |
| 参考图 | ecRefImgs | base64[] | 上传图片预览 |
| **美妆报告** | **ecBeauty** | **boolean** | **新加** |
| **品牌统一** | **ecBrandWorld** | **string** | **新加** |

**生成流程：**
1. 用户点击生成 → `doGenEC()` 被调用
2. 检查额度/试用状态
3. `dispatch({ type: 'START_GEN' })` → 显示 LoadingView
4. 调用 `generateEcommerce({...})`
5. 成功后组装 `ecResult` 对象 → `dispatch({ type: 'SET_RESULT', result: ecResult })`
6. ecResult 包含 `_ecResult: true, images: {...}, errors: [...]`

**复刻入口卡：**
- 在 EC 表单底部，新增了「从链接复刻」入口卡
- 点击跳转到 `#/remake`（Remake 页面）

### 3.4 Remake 复刻页面 (`src/pages/Remake/index.jsx`)

路由：`#/remake?task=xxx`
模式始终是「有任务才能工作」，空状态显示插件使用说明 + 手动输入任务ID。

**流程：**
1. URL 解析 taskId → 轮询 `GET /api/extension/task/:id`
2. 图片下载完 → 自动/手动触发 AI 分析 `POST /api/extension/analyze`
3. 分析完成 → 展示原图 + 分析结果（构图/光线/背景/颜色/情绪）
4. 用户填写替换表单（商品名/品类/卖点/tier/平台）
5. 点击生成 → `POST /api/extension/regenerate`
6. 轮询结果 → 展示生成结果网格

### 3.5 提示词 prompt 文件 (`server/prompts/ecommerce/`)

```
white-bg-main.md
scene-image.md
detail-image.md
combo-image.md
```

这些是独立的 prompt.md 文件，但 `ecommercePromptEngine.mjs` 目前没有使用它们（提示词直接在 .mjs 中构建）。可以废弃或整合。

---

## 4. 环境变量

`.env` 文件在 `server/.env`：

```
LLM_API_KEY=xxx              # 文本模型 API Key
LLM_BASE_URL=xxx             # 文本模型 Base URL
LLM_MODEL=claude-sonnet-4-6  # 文本模型
IMAGE_API_KEY=xxx            # 图片生成 API Key
IMAGE_BASE_URL=xxx           # 图片生成 Base URL
IMAGE_MODEL=gpt-image-2      # 图片模型
PORT=3099                    # 端口
```

服务器有两个端口：
- **3099** — 主服务器（生成 + 复刻接口）
- **5173** — Vite 前端

---

## 5. 复刻流程（插件）

完整的图片采集→分析→复刻流程：

```
用户打开淘宝商品页
       ↓
点击浏览器插件 → content.js 注入
       ↓
3 层提取：
  1) JSON-LD 结构化数据（平台无关，最优）
  2) 平台专用提取器（taobao.js / jd.js / amazon.js 等）
  3) 通用 DOM 提取器（回退方案，限顶部 40% 视口）
       ↓
图片经 imageFilter 过滤（去重/过滤广告图标/认证/二维码/评论等）
       ↓
POST /api/extension/collect → 创建任务 → 异步下载图片
       ↓
POST /api/extension/analyze → Vision API 分析每张图（构图/光线/背景/颜色/情绪）
       ↓
用户填写替换信息 → POST /api/extension/regenerate
       ↓
用原图构图/光线/背景 + 新商品信息构建 prompt → GPT Image 2 生成
```

---

## 6. 「风格包 / Skill」体系（未实现，待完善）

### 6.1 核心理念

不同 GitHub 仓库/GPT Image 2 资源提供了**不同的 prompt 方法论**，每种方法论会产生不同视觉风格的输出。我们要把这些包装成**用户可选的风格包**，但不需要告诉用户 skill 名——只需要告诉他们「这个风格能出什么效果的图」。

### 6.2 已确定的风格包

| # | 风格包名称 | 来源 | 视觉描述 | 实现状态 |
|---|-----------|------|---------|---------|
| 1 | ⚪电商白底主图 | gpt-image2-ecommerce:01 + awesome:商品 | 纯白背景，柔光箱，居中产品 | **默认实现** |
| 2 | 💎高端质感精品 | gpt-image2:22-奢华 + awesome:商业摄影 | 深色背景，戏剧光，材质纹理 | 未实现 |
| 3 | 🌿生活场景氛围 | gpt-image2:02-场景 + awesome:叙事 | 自然光线，产品融入场景 | 未实现 |
| 4 | 📱真实买家秀 | gpt-image2:07-UGC | 手机拍摄感，噪点，不完美构图 | 未实现 |
| 5 | 🎬直播带货截图 | gpt-image2:15-直播 | 环形灯，UI 叠加层，真实布景 | 未实现 |
| 6 | 📰杂志彩页 | awesome:海报 + gpt-image2:20 | Vogue 排版，刊头，大标题 | 未实现 |
| 7 | 📸胶片复古 | gpt-image2:07-CCD变体 | 柯达 Portra 400，紫边，日期戳 | 未实现 |
| 8 | 🚀科技未来 | gpt-image2:01-tech + awesome:摄影 | 暗色底，侧光，金属反射 | 未实现 |
| 9 | 📊**美妆分析报告** | awesome:美妆推荐报告 | 肤质分析+推荐+试色信息图 | **已实现** |
| 10 | 🏷️**品牌统一** | awesome:品牌包络产品 | 多产品线同一视觉世界 | **已实现** |

### 6.3 技术实现方案

风格包应该作为 `ecommercePromptEngine.mjs` 的一个**新维度**。当前结构是：

```
品类 (category) → 视觉特征 (CATEGORY_VISUALS)
图片角色 (image role) → 具体 prompt (buildRolePrompt)
```

风格包应该是一个**修饰层**，改变 buildRolePrompt 的具体输出：

```javascript
function buildRolePrompt(roleKey, ctx, stylePack = 'default') {
  if (stylePack === 'ugc') return buildUGCPrompt(roleKey, ctx);
  if (stylePack === 'luxury') return buildLuxuryPrompt(roleKey, ctx);
  if (stylePack === 'cinema') return buildCinemaPrompt(roleKey, ctx);
  // ... 其他风格包
  return buildDefaultPrompt(roleKey, ctx);  // 现有逻辑
}
```

### 6.4 已研究但未封装的外部资源

| 仓库 | ⭐ | 核心价值 | 可提取的风格 |
|------|---|---------|------------|
| [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) | 8k | 21 套工业级模板，Agent Skill | 电商主图、品牌视觉、美妆报告 |
| [buluslan/gpt-image2-ecommerce](https://github.com/buluslan/gpt-image2-ecommerce) | - | 25 电商场景模板，4 变体/每个 | 直播/UGC/平铺/多角度等 |
| [AlijeeWrites/awesome-gpt-image-2-prompts](https://github.com/AlijeeWrites/awesome-gpt-image-2-prompts) | 2 | 公式法：Subject+Scene+Lighting+Angle+Style+Constraints | 自由度高的自定义模式 |
| [YouMind-OpenLab/awesome-gpt-image-2](https://github.com/YouMind-OpenLab/awesome-gpt-image-2) | 7.8k | 11k+ prompt，CI 自动更新 | 30+ 风格库（水彩/像素/3D） |
| [Anil-matcha/Awesome-GPT-Image-2-API-Prompts](https://github.com/Anil-matcha/Awesome-GPT-Image-2-API-Prompts) | 63 | Python SDK 代码，批量自动化 | 批量流水线 |
| 微信文章「公众号营销 skill」 | - | 文案+配图方案 | 待定（暂缓） |

---

## 7. 待办事项 / 已知问题

### P0 — 立即需要修复
- [ ] **启动服务器测试 `/api/generate-ecommerce` 路由是否正常工作**（刚实现，未测试）
- [ ] 测试 `ecBeauty` 模式能否正常生成美妆分析报告
- [ ] 测试 `ecBrandWorld` 参数能否正确影响 prompt

### P1 — 风格包体系
- [ ] 设计风格包的数据结构（在 ecommercePromptEngine.mjs 中）
- [ ] 实现 UGC/买家秀风格包（从 gpt-image2-ecommerce 提取）
- [ ] 实现直播带货风格包
- [ ] 实现杂志彩页风格包
- [ ] 实现胶片复古风格包
- [ ] 实现科技未来风格包
- [ ] 实现高端质感风格包
- [ ] UI: 在 EC 表单增加风格包选择器（卡片网格，每个带图标+描述）

### P2 — 前端完善
- [ ] `src/pages/Ecommerce/index.jsx` 是独立的 EC 页面，但没有挂到 App.jsx 路由中。考虑是否接入。
- [ ] Remake 页面空状态可以加一张截图/动画说明插件用法
- [ ] 考虑在 Navbar 加「AI 创作」入口指向 Remake 页面

### P3 — 用户体验
- [ ] 快捷生成结果展示有待优化（目前靠 NoteModal 兜底）
- [ ] 错误提示更友好
- [ ] 美妆分析报告的结果展示（如果只有 1 张图，展示方式应不同于多图）
- [ ] 品牌统一视觉的示例/预设文案

### 后端细节
- `generateImage(prompt, category, isCover, jkContext)` — 通用图片生成函数，内部处理 JK 安全过滤、调用 `callImageAPI()`
- `callImageAPI(fullPrompt)` — 实际调用 GPT Image 2 API，默认尺寸 1024x1366
- `/api/generate-ecommerce` 路由在 `mountExtRoutes(app)` 之前注册

---

## 8. 数据流示例

### 快捷生成请求

```
POST /api/generate-ecommerce
{
  product_name: "高保湿精华液",
  category: "美妆护肤",
  tier: "basic",
  platform: "淘宝",
  selling_points: "高保湿\n24小时持久\n敏感肌适用",
  beauty_report: false,
  brand_world: "极简北欧风，主色墨绿+米白"
}

→ 返回
{
  product_name: "高保湿精华液",
  category: "美妆护肤",
  platform: "淘宝",
  tier: "basic",
  images: {
    "白底主图": "https://xxx.com/img1.png",
    "卖点图①": "https://xxx.com/img2.png",
    "场景图": "https://xxx.com/img3.png"
  },
  errors: []
}
```

### 美妆分析报告请求

```
POST /api/generate-ecommerce
{
  product_name: "玫瑰花水精华",
  category: "美妆护肤",
  beauty_report: true,
  selling_points: "补水保湿\n舒缓敏感\n提亮肤色"
}

→ 返回
{
  images: {
    "美妆分析报告": "https://xxx.com/report.png"
  }
}
```

---

## 9. App 路由结构

```
src/App.jsx (AppRouter)
  ├── page='home'    → <HomePage />          (默认)
  │     mode='content'  → XHS 图文生成表单
  │     mode='ecommerce' → EC 快捷生成表单
  ├── page='gallery' → <GalleryPage />       (薯包出品展示)
  ├── page='pricing' → <PricingPage />       (定价页)
  ├── page='works'   → <WorksPage />         (我的作品)
  └── page='remake'  → <RemakePage />        (复刻页面)
```

导航方式：
- 按钮点击：`dispatch({ type: 'NAVIGATE', page: 'xxx' })`
- Hash 路由（仅 remake）：`window.location.hash = '#/remake?task=xxx'`
- URL 监听：`useEffect` 中 `hash.startsWith('#/remake')` → 自动切换

---

## 10. 当前 UI 里的 EC 控件

在 Home 页 EC 模式，生成配置区域新增的控件：

```
┌─ 生成配置 ─────────────────────────────────────┐
│ 生成等级：[基础3张] [标准5张] [完整9张]          │
│ 目标平台：[淘宝] [京东] [拼多多] [小红书] [抖音]  │
│                                                 │
│ 美妆分析报告                                     │
│ [📊 已开启 — 单张分析报告信息图]                  │
│ 不生成多张图，生成肤质分析+推荐+试色信息图         │
│                                                 │
│ 品牌统一视觉（可选）                              │
│ [_____________________________________________] │
│ 极简北欧风，主色墨绿+米白，哑光质感                │
└─────────────────────────────────────────────────┘
```

---

## 11. 下一步工作建议

1. **先启动服务器测试** `/api/generate-ecommerce` 是否可用（刚实现，没测过）
2. **实现风格包数据层** — 在 `ecommercePromptEngine.mjs` 新增 `STYLE_PACKS` 常量，包含每个风格包对每个 image role 的 prompt 重写
3. **实现第一个非默认风格包**（比如 UGC 买家秀）验证体系
4. **前端风格选择器** — 网格卡片 + 图标 + 描述，加在 EC 表单里
5. **持续集成更多外部 skill** — 上文列出的 5 个仓库是已筛选的有价值的资源
