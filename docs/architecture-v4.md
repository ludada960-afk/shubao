# 薯包AI v4 架构设计文档

> **目标：** 打造国内一线电商 AI 生图平台底层引擎
> **核心原则：** 不做全靠提示词的"假 AI"，做多阶段 Workflow 工程体系
> **双模式驱动：** 老板一键 Agent 模式 + 设计师精修工坊模式，共享同一底层引擎

---

## 一、Imagen2 极致电商生图流水线架构

### 1.1 当前痛点

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 画面死板同质化 | 一套固定 prompt 打天下 | 多 Skill 风格包 + 分层动态 prompt |
| 光影廉价 | 无视觉分析，通用描述 | VLM 分析实拍图 + 提取真实光影参数 |
| 参考图失效 | 直接 URL 传图，无解析 | 双图差异化解析 → 保真与风格独立权重 |
| 实拍图变形 | 模型不认得产品 | RealShot 保真层 + 结构化产品描述 |
| 没有高级感 | 无工程化 Workflow | 预处理→规划→生成→质检→后处理五阶段 |

### 1.2 五阶段流水线架构

```
┌─────────────────────────────────────────────────────────────┐
│                   用户输入层                                  │
│  一句话描述  │  实拍图 1-N  │  风格参考图 1-N  │  品类选择     │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│   Stage 1: 预处理 (Pre-processing)                           │
│   - VLM 分析实拍图 → real_shot_analysis (结构化 JSON)         │
│   - VLM 分析风格图 → style_ref_analysis (结构化 JSON)         │
│   - LLM Agent 决策: 品类/风格包/权重                           │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│   Stage 2: 视觉规划 (Visual Planning)                        │
│   - 选择 Style Skill 包                                      │
│   - 构建 Campaign Lock (视觉一致性锁)                          │
│   - 确定图片类型列表 & 每张的角色                               │
│   - 融合实拍/风格双图分析结果                                   │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│   Stage 3: 分层动态 Prompt 构建 (Layered Prompt Assembly)     │
│   基础层: 产品名/品类/材质/纹理                                  │
│   视觉层: 光照/色调/构图/背景                                    │
│   风格层: Campaign Lock (Skill 包的视觉方向)                    │
│   细节层: 每张角色独有的文案/卖点/标注                             │
│   约束层: 平台规范/文字规则/无水印/禁止人物                        │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│   Stage 4: 生成 + 质检 (Generation + Quality Check)          │
│   - 并发调用 GPT Image 2 / Imagen2 API                       │
│   - 生成后 VLM 质检: 产品准确度/风格一致性/视觉质量               │
│   - 不合格 → 自动调整参数重试 (最多 N 次)                       │
│   - 合格 → 进入后处理                                           │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│   Stage 5: 后处理 (Post-Processing)                          │
│   - 去底透明图生成 (background removal)                       │
│   - 详情长图纵向拼接 (stitching)                              │
│   - 批量套图打包 ZIP                                          │
│   - 缓存 & 保存                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Style Skill 包的完整结构

每个 Skill 包不再是单一的 campaignLock，而是完整视觉定义：

```javascript
{
  key: 'premium_minimal',
  name: '高级极简',
  emoji: '⬜',
  desc: '大量留白·低饱和·产品细节突出',
  category_boost: ['美妆护肤', '珠宝配饰', '家居日用'],
  
  // 视觉一致性锁 (已实现)
  campaignLock: { ... },
  
  // 光照系统
  lighting_system: {
    type: 'softbox_diffuse',
    key_light: 'above-left 45°',
    fill_light: 'right side soft',
    rim_light: 'back-edge cool',
    shadow_type: 'soft gradient',
    color_temp: 'neutral-warm ~5200K',
  },
  
  // 色彩系统
  color_system: {
    palette: ['#FFFFFF', '#F5F0EB', '#333333', '#C4A882'],
    saturation: 'desaturated -20%',
    contrast: 'medium-soft',
    treatment: 'editorial minimal',
  },
  
  // 构图规则
  composition_rules: {
    product_coverage: '50%',
    positioning: 'centered',
    angle_preference: '3/4 elevated',
    whitespace: 'generous',
    depth: 'shallow depth of field',
  },
  
  // 对各类图片的个性化调整
  role_overrides: {
    white_bg: { bg: 'pure white #FFFFFF', coverage: '60-70%' },
    main_3x4: { coverage: '55%', angle: 'lifestyle 3/4' },
    transparent: { shadow: 'soft ground shadow for compositing' },
    detail_slice: { bg: 'off-white', layout: 'clean editorial grid' },
  },
}
```

---

## 二、VLM 识图解析完整架构

### 2.1 双通道解析逻辑

```
用户上传图片 ──┬──→ RealShot (实拍图) ──→ VLM-1: 产品本体解析
              │                        → 输出 real_shot_analysis
              │                        → 高保真权重绑定
              │
              └──→ StyleRef (风格参考) ──→ VLM-2: 视觉风格解析
                                       → 输出 style_ref_analysis
                                       → 中转移权重绑定
```

### 2.2 完整 JSON 字段 Schema

```typescript
// ====== 实拍图解析 (产品保真) ======
interface RealShotAnalysis {
  product: {
    shape: string;              // "cylindrical bottle" / "box-like" / "organic"
    dominant_colors: string[];  // ["#F5F0EB", "#C4A882"]
    materials: string[];        // ["frosted glass", "matte plastic", "stainless steel"]
    texture: string;            // "smooth matte" / "brushed metal" / "natural grain"
    angles_present: string[];   // ["front", "45-degree", "top-down"]
    best_angle: string;         // "45-degree elevated"
    key_features: string[];     // ["brand logo", "cap/closure", "texture panel"]
    print_text: string[];       // 产品上印刷的文字
    // 尺度信息 (从描述或标尺推断)
    dimensions_hint: string;    // "approx 15cm tall"
  };
  quality: {
    resolution: 'high' | 'medium' | 'low';
    focus: 'sharp' | 'soft' | 'motion_blur';
    noise: 'clean' | 'slight' | 'noisy';
    suitability: number;        // 0-1, 是否适合做参考
  };
  // 提取需要保留、不能改的部分
  preservation: {
    shape: boolean;             // 必须保留外形
    color_accuracy: boolean;    // 必须保留颜色精度
    texture_fidelity: boolean;  // 必须保留材质
    details: string[];          // 需要保留的细节列表
  };
}

// ====== 风格参考图解析 (风格迁移) ======
interface StyleRefAnalysis {
  visual_treatment: {
    lighting: {
      type: string;             // "natural window" / "studio softbox" / "golden hour"
      direction: string;        // "side-left" / "above" / "backlit"
      temperature: string;      // "warm ~3500K" / "neutral ~5500K" / "cool ~6500K"
      shadow_hardness: 'soft' | 'medium' | 'hard';
      contrast: 'low' | 'medium' | 'high';
    };
    color_palette: {
      dominant: string[];       // ["#F8F4EF", "#E8DDD3"]
      accent: string[];         // ["#8B6914", "#4A4540"]
      temperature: 'warm' | 'cool' | 'neutral';
      saturation: 'desaturated' | 'natural' | 'vibrant';
    };
    composition: {
      style: string;            // "centered product" / "lifestyle scene" / "flat lay"
      product_placement: string; // "center" / "rule-of-thirds" / "off-center"
      depth: 'flat' | 'medium' | 'deep';
      background_type: string;  // "solid" / "gradient" / "scene" / "transparent"
    };
    mood: string;               // "cozy warm" / "premium clean" / "energetic"
    background_detail: string;  // 背景详细描述
  };
  transfer_weights: {
    lighting: number;           // 0-1, 光照迁移强度
    color: number;              // 0-1, 色彩迁移强度
    composition: number;        // 0-1, 构图迁移强度
    mood: number;               // 0-1, 氛围迁移强度
  };
}
```

### 2.3 VLM 解析 → Agent 规划 → 生成的串联链路

```
VLM Output (JSON)
    │
    ▼
LLM Agent (DeepSeek / Claude):
  - 读取 VLM 解析结果
  - 读取 Category Knowledge Base
  - 决策:
    a. 最佳 Style Skill 包
    b. 商品保真权重 (0-1)
    c. 风格迁移权重 (0-1)
    d. 图片类型 & 数量
    e. 生成参数 (creativity / detail / consistency)
    │
    ▼
Pipeline Engine:
  - 构建 Campaign Lock (带 Skill 包 + 双图融合参数)
  - 逐张构建分层 prompt
  - 并发调用图像生成 API
  - 收集结果
    │
    ▼
Quality Check (VLM):
  - 评估每张图
  - 不合格 → 参数微调重试
  - 全部合格 → 交付
```

---

## 三、双用户模式共享引擎架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────┐
│                  用户界面层                           │
│                                                      │
│  ┌──────────────┐    ┌──────────────────┐           │
│  │ Agent Mode    │    │ Workshop Mode    │           │
│  │ (一键智能)     │    │ (精修工坊)       │           │
│  │              │    │                  │           │
│  │ 一句话输入    │    │ 全参数面板        │           │
│  │ 自动识别      │    │ 手动调参          │           │
│  │ 零配置        │    │ Skill 切换       │           │
│  │ 一键出图      │    │ 质检开关         │           │
│  └──────┬───────┘    └────────┬─────────┘           │
└─────────┼─────────────────────┼─────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────────────────────────────────────┐
│               共享决策层 (Shared Decision Layer)       │
│                                                      │
│   mode: 'agent' → AI 自动决策所有参数                  │
│   mode: 'workshop' → 用户手动传入或覆盖所有参数          │
│                                                      │
│   输出统一的: { styleSkill, weights, images, params }  │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│               共享引擎层 (Shared Engine)               │
│                                                      │
│   1. VLM Analysis Pipeline                            │
│   2. Visual Planning                                  │
│   3. Prompt Assembly                                  │
│   4. Generation                                       │
│   5. Quality Check                                    │
│   6. Post-Processing                                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 3.2 Agent Mode 自动决策树

```
用户输入 ───→ Check input type:

无图 + 短描述 ──→ LLM 推断品类
               → 选默认 Skill (按品类)
               → 默认出图套 (1 white_bg + 5 main_1:1 + 5 main_3:4 + 1 transparent)
               → 零配置出图

有实拍图 (1+) ──→ VLM 分析实拍
               → LLM 识别品类
               → 推荐最佳 Skill
               → 自动设定保真权重 (高)
               → 标准出图套

有风格参考 ──→ VLM 分析风格
             → 提取光影/色调/构图参数
             → 设定风格迁移权重 (中)
             → 融合到 Campaign Lock

双图混合 ──→ 实拍保真分析 + 风格分析
          → 独立设定权重
          → 差异化融合

有卖点文案 ──→ LLM 提取核心卖点
            → 分配到对应图片角色
            → 主图文案渲染
```

### 3.3 Workshop Mode 暴露参数

| 参数 | 类型 | 范围 | 说明 |
|------|------|------|------|
| styleSkill | select | 5个Skill包 | 切换整体视觉风格 |
| productFidelity | slider | 0-1 | 实拍图保真度权重 |
| styleTransfer | slider | 0-1 | 风格参考迁移权重 |
| creativity | slider | 0-1 | 生成创意度 |
| detailLevel | select | low/mid/high | 细节丰富度 |
| qualityCheck | toggle | on/off | 生成后质检 |
| autoRegen | toggle | on/off | 不合格自动重试 |
| maxRetries | number | 1-5 | 最大重试次数 |
| postProcess | toggle | on/off | 后处理增强 |
| bgRemoval | toggle | on/off | 透明背景生成 |
| imageTypes | multi-select | 全部类型 | 选择要生成的图片类型 |
| customDimensions | input | w×h | 自定义尺寸 |

---

## 四、竞品方案逆向分析

### 4.1 椒图 AI (JiaoTu AI)

**可推断的架构：**
- **多风格引擎**：不是一套 prompt 走天下，每品类预置多套视觉方案
- **品类级渲染策略**：美妆偏高级极简打光，食品偏暖调自然光，数码偏科技锐利光
- **渐进式生成**：先生成白底主图确保产品一致，再基于主图生成其他类型
- **智能推荐系统**：根据商品描述自动匹配风格包、图片类型

**可学习点：**
- ✅ 风格包 + 品类的交叉矩阵配置
- ✅ 渐进式生成（白底→主图→场景→详情）
- ✅ 用户上传 1 张图就能出全套

### 4.2 灵图 AI (LingTu AI)

**可推断的架构：**
- **图片反推提示词**：上传任意商品图 → AI 提取视觉参数 → 输出可复用的 prompt
- **多模型分工**：VLM 分析图像内容 → LLM 规划 prompt 结构 → 组装完整 prompt
- **精简/专业双版本**：短版给 AI 作图用，长版给设计师手动调

**可学习点：**
- ✅ 图片反推 = 视觉解析 + 结构化 prompt 输出
- ✅ 双版本输出机制
- ✅ 用户上传一张参考图就让 AI 学会风格

### 4.3 我们的差异化优势

| 对比项 | 椒图 AI | 灵图 AI | 薯包 AI v4 |
|--------|---------|---------|------------|
| 双模式 | ❌ | ❌ | ✅ Agent + Workshop |
| Skill 包 | 品类级 | 通用 | 跨品类 + 品类增强 |
| 双图融合 | ❌ | ❌ | ✅ 实拍保真 + 风格迁移 |
| 质检重试 | ❌ | ❌ | ✅ VLM 质检 + 自动重试 |
| 后处理 | ✅ | ❌ | ✅ 去底 + 拼接 + 打包 |
| 开放式架构 | ❌ | ❌ | ✅ 预留 VLM 接口 |

---

## 五、文件结构规划

```
server/
├── ecommerceEngine/
│   ├── index.mjs              # 引擎入口，导出所有模块
│   ├── pipeline.mjs            # 五阶段流水线编排
│   ├── vlmSchema.mjs           # VLM 解析 Schema + 解析器
│   ├── vlmClient.mjs           # VLM API 客户端（预留接口位）
│   ├── styleSkills.mjs         # Style Skill 包完整定义
│   ├── promptAssembler.mjs     # 分层 prompt 构建器
│   ├── imageFusion.mjs         # 双图差异化融合逻辑
│   ├── qualityCheck.mjs        # 质检 + 自动重试
│   ├── postProcessor.mjs       # 后处理（去底/拼接/打包）
│   ├── categoryKnowledge.mjs   # 品类视觉知识库
│   ├── agentDecider.mjs        # Agent 模式自动决策
│   └── workshopBridge.mjs      # Workshop 模式用户参数桥接
├── ecommercePromptEngine.mjs    # (重构) 整合新引擎
│
src/
├── pages/EcStudio/
│   ├── index.jsx               # EC Studio 根组件
│   ├── AgentMode.jsx           # 一键智能模式
│   ├── WorkshopMode.jsx        # 精修工坊模式
│   ├── SkillSelector.jsx       # 风格包选择器
│   ├── ParamPanel.jsx          # 高级参数面板
│   └── QualityControls.jsx     # 质检控制面板
```

---

## 六、开发执行计划

### Phase 1: 底层引擎 (server/ecommerceEngine/)
1. `vlmSchema.mjs` — Schema 定义 + 解析框架
2. `vlmClient.mjs` — API 客户端（留空 key 入口）
3. `styleSkills.mjs` — Skill 包完整定义（含 5 包的完整配置）
4. `categoryKnowledge.mjs` — 品类知识库（扩展已有 CATEGORY_VISUALS）
5. `promptAssembler.mjs` — 分层 prompt 构建器
6. `imageFusion.mjs` — 双图融合逻辑
7. `pipeline.mjs` — 五阶段流水线编排
8. `qualityCheck.mjs` — 质检模块
9. `postProcessor.mjs` — 后处理
10. `agentDecider.mjs` — Agent 决策器
11. `workshopBridge.mjs` — Workshop 桥接
12. `index.mjs` — 引擎统一入口

### Phase 2: 重构 ecommercePromptEngine.mjs
- 整合新引擎模块
- 向后兼容旧 API

### Phase 3: 前端 EcStudio 页面
- AgentMode / WorkshopMode 双模式
- Skill 选择器 / 参数面板 / 质检开关

### Phase 4: UI 全面收官
- 解决所有遗留 UI 问题

### Phase 5: 全链路验证
- 自检 + 场景测试

---

> **网络恢复后接入点：**
> 1. `server/ecommerceEngine/vlmClient.mjs` — 填入 VLM API Key
> 2. `server/.env` — 填入新 VLM API 配置
> 3. DNS 配置切换回正常
> 4. 零代码改动，直接上线
