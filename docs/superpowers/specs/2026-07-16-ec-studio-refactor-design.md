# 薯包AI 电商精修工坊重构设计稿

**日期**: 2026-07-16
**状态**: 已批准，准备进入实现
**范围**: `src/pages/EcStudio/`、`src/constants/data.js`、`server/ecommercePromptEngine.mjs`、`server/index.mjs`

---

## 一、目标

重构电商精修工坊，把当前 6 个图片类型 + 6 个风格包的复杂配置，精简为 4 类图片 + 1 套默认风格，并改为「智能一键 + 5 步精细配置」双通道入口，提升小白卖家可用性。

## 二、整体架构

页面顶部「智能一键」+ 下方「5 步精细配置」两套独立又互通的通道。

```
┌──────────────────────────────────────────┐
│ 📝 智能一键（顶部）                       │
│ 「用一段话描述你想要的商品图，AI自动填」 │
│ [大textarea]  [🤖 AI自动识别] [▶开始]     │
└──────────────────────────────────────────┘
              ↓ 填完自动同步到下方
┌──────────────────────────────────────────┐
│ 🎯 精细配置（5步流程）                    │
│ ① 实拍图 → ② 参考图 → ③ 规格SKU          │
│ → ④ 详情策划 → ⑤ 保养维护                │
└──────────────────────────────────────────┘
```

**互通逻辑**：用户填智能框 → 点「AI自动识别」→ AI 看参考图+文字 → 自动填充下方5步所有字段。用户也可以跳过智能框，直接往下一步步填。

---

## 三、图片类型与尺寸（精简后）

| 类型 | 尺寸 | 数量 | 说明 |
|-----|------|-----|------|
| 白底图 | 800×800 1:1 | 必选1张 | 首图规范 |
| 主图 1:1 | 1440×1440 | 5张 | 白底1 + 卖点4 |
| 主图 3:4 | 1440×1920 | 5张 | 多角度/场景 |
| PNG透明图 | 800×800 1:1 | 1张 | 去底素材 |
| 详情长图切片 | 1440宽，每片≤2880高 | 多片 | 详见第五节 |
| SKU规格图 | 800×800 1:1 | 用户定义 | 纯AI并排 |

**平台尺寸统一**：除亚马逊外全部 1440×1440 / 1440×1920。亚马逊保持 1000×1000 / 1500×2000。

**详情长图生成方式（C 方案）**：AI 先按主题生成切片 → 用户可选「自动拼成长图」导出（用于微信分享）+ 切片也能单独上传淘宝/京东后台。

**SKU 生成方式（A 方案）**：纯 AI 按用户填的变体列表一次出并排图。Prompt 严格约束"同款不同色、保持形状一致、颜色名按用户输入、不自创"。

---

## 四、5步流程详细

### ① 上传产品多角度实拍图
- 上传框，最多10张
- 提示推荐角度：正面/45°侧面/细节/包装/场景

### ② 上传目标参考图
- 上传框，最多5张
- 说明：「想模仿的风格/竞品爆款图，AI 会学习它的视觉调性」

### ③ 产品尺寸颜色规格（含 SKU 字段）
分两区：

**基础规格**
- 商品名（必填）
- 品类
- 尺寸标注（长×宽×高 cm）
- 材质/工艺

**SKU 变体配置**（可增删行）：

| 字段 | 说明 |
|-----|------|
| 颜色 | 变体颜色名（中文，≤4字，如"月岩白") |
| 规格/尺码 | 如 "M" / "100ml" |
| 容量/数量 | 如 "500ml" / "3件装" |
| 标注尺寸 | 如 "20×10×5cm" |
| 图片数 | 默认1 |

每行 = 一张 SKU 图。颜色名/数值由用户填，AI 严格按这些生成，不自创。

### ④ 详情页策划思路（5个勾选项，决定切片内容）
- ☐ 尺寸标注图（引线标毫米/厘米）
- ☐ 场景拍摄图（产品在真实环境）
- ☐ 质检报告图（合格证/检测信息图）
- ☐ 优势对比图（vs 同款的差异）
- ☐ 细节功能描述图（功能点 callout）

每勾选一项 = 生成一张长图切片（1440宽，≤2880高）。还可以为每个勾选项补一句自定义文案。

### ⑤ 保养维护描述
- 一个 textarea：「用一句话写保养方式，AI 生成保养说明图」
- 默认产出 1 张保养说明切片

---

## 五、数据模型（前端 state）

```js
{
  smartBrief: '',           // 顶部智能描述
  realShots: [],            // ① 多角度实拍
  refShots: [],             // ② 目标参考图
  product: {                // ③ 规格
    name, category, material, dimensions
  },
  skus: [                   // ③ SKU变体表
    { color, size, capacity, dimLabel, count }
  ],
  detailPlan: {             // ④ 详情策划
    sizeAnnot: true, scene: true, qc: false,
    compare: true, feature: true,
    notes: { sizeAnnot:'', scene:'', qc:'', compare:'', feature:'' }
  },
  maintenance: '',          // ⑤ 保养维护
}
```

---

## 六、后端 Prompt 引擎改造

文件：`server/ecommercePromptEngine.mjs`

### 删除
- `STYLE_PACKS`（风格包定义）
- `CONVERSION_DRIVERS`（转化驱动力）
- `getSmartRecommendations`（智能推荐按风格包切换的逻辑）
- `TIER_ROLES`, `TIER_META`（旧的 basic/standard/complete 档次）
- `buildBeautyReportPrompt`（美妆分析报告）

### 保留
- `CATEGORY_VISUALS`（品类视觉特征库）
- `PLATFORM_SIZES`（平台尺寸，但需更新为1440）
- `PLATFORM_VISUAL_GUIDE`
- `IMAGE_ROLES`（部分保留，见下）

### 图片角色（重构后）

| key | label | group | ratio |
|---|---|---|---|
| `white_bg` | 白底图 | 主图 | 1:1 |
| `main_text` | 主图 | 主图 | 1:1 |
| `main_3x4` | 主图3:4 | 主图 | 3:4 |
| `transparent` | 透明PNG | 素材 | 1:1 |
| `sku` | SKU规格图 | 规格 | 1:1 |
| `detail_slice_size` | 尺寸标注切片 | 详情 | 3:4 |
| `detail_slice_scene` | 场景拍摄切片 | 详情 | 3:4 |
| `detail_slice_qc` | 质检报告切片 | 详情 | 3:4 |
| `detail_slice_compare` | 优势对比切片 | 详情 | 3:4 |
| `detail_slice_feature` | 细节功能切片 | 详情 | 3:4 |
| `detail_slice_care` | 保养维护切片 | 详情 | 3:4 |

**删除的角色**：`feature_1/2/3`, `composite`, `macro`, `comparison`, `sku`（旧）, `package`, `beauty_report`

### 新增/修改的构建函数

- `buildMainPrompt(...)` — 主图（白底+促销文案）
- `buildSkuPrompt({ productName, variants[] })` — 接收用户变体行，生成并排SKU图，严格约束"同款不同色、形状一致、色名按用户输入、不自创"
- `buildDetailSlicePrompt(sliceType, ctx)` — 5种切片各自一个 prompt 分支
- `buildTransparentPrompt(...)` — 透明素材

### 新增 API 路由（`server/index.mjs`）

- `POST /api/ecommerce/auto-recognize`
  - 接收：`{ smartBrief, refShots[] }`
  - 逻辑：Vision 模型分析参考图 + smartBrief 文字，返回推断的 product/skus/detailPlan/maintenance
  - 响应：填充下方5步所有字段的 JSON

- `POST /api/ecommerce/stitch-long`
  - 接收：`{ imageUrls[] }` (切片URL列表，按时序)
  - 逻辑：用 sharp 把多张切片纵向拼接成一张长图
  - 响应：`{ url: '长图URL' }`

---

## 七、与现有代码的关系

| 文件 | 变更 |
|---|---|
| `src/pages/EcStudio/index.jsx` | **重写**（保留页面骨架、样式、顶部插件导入卡片） |
| `src/constants/data.js` | EC_* 常量大幅精简：删 `EC_STYLE_PACKS`, `EC_ADV_TYPES`；`EC_MAIN_TYPES` 改为4类；新增 `EC_DETAIL_SLICES` |
| `server/ecommercePromptEngine.mjs` | 删风格包，新增切片/SKU变体 prompt；删美妆报告 |
| `server/index.mjs` | 新增2个路由 |
| `src/services/api.js` | 新增 `autoRecognizeEcommerce`、`stitchLongImage` 函数；更新 `generateEcommerce` 入参 |

**保留**：顶部「一键复刻爆款」插件导入卡片（与本次重构正交，不动）。

---

## 八、非目标 / 不做

- 不做风格包切换 UI（统一一套默认风格）
- 不做美妆分析报告
- 不做 AI 素材+程序拼版的 SKU B 方案
- 不动小红书图文生成模块
- 不动 Plog 模块
- 不动首页电商 tab、EcAuto 一键出图、Remake、EcLegacyForm（本次只重构精修工坊本身）

---

## 九、风险与应对

| 风险 | 应对 |
|---|---|
| AI 生成 SKU 多色形状不一致 | Prompt 严格约束 "All variants share identical shape, only color differs"；用户填的色名硬写入 prompt |
| AI 生成中文色名/数值出错 | 数值（尺寸/容量）走 callout 文字思路、prompt 里把用户输入的值原样写死，不让 AI 自由发挥 |
| 切片拼接长图可能超大 | 每片≤2880高，shap 拼接时检测总高，超过限制给提示 |
| 智能识别依赖 Vision API | `MINI_API_KEY`（65535.space gpt-5.4-mini）已配好，可直接用 |