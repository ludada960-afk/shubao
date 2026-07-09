---
name: gpt-image-2-ecommerce
description: 电商商品图 GPT-Image2 提示词工程技能。基于 awesome-gpt-image-2 的 Prompt-as-Code 方法论。当需要生成电商商品图（白底主图/场景图/详情图/组合图）或优化提示词时使用。
---

# GPT-Image2 电商提示词工程

薯包AI 电商模块专用。基于 [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) 的 500+ 案例逆向工程与 20+ 工业级提示词模板。

## 架构

```
用户输入（商品名+品类+风格+卖点）
    │
    ▼
┌─────────────────────────────┐
│  Intent Analysis             │  解析品类、材质、光影需求
├─────────────────────────────┤
│  Template Selection          │  按风格选模板（白底/场景/详情/组合）
├─────────────────────────────┤
│  Structured Prompt Builder   │  组装原子化组件 → JSON Schema
├─────────────────────────────┤
│  Platform Adaptation         │  按平台尺寸约束调整
└─────────────────────────────┘
    │
    ▼
GPT-Image2 API（65535.space 中转）
```

## 电商 4 种风格

| 风格 | 用途 | 比例 | 核心能力 |
|------|------|------|---------|
| ⬜ 白底主图 | 电商主图/Hero Shot | 1:1 | 纯白背景、棚拍灯光、产品居中 |
| 🌄 场景图 | 生活方式场景 | 3:4 | 场景融入、自然光影、生活方式 |
| 📋 详情图 | 产品细节/功能标注 | 3:4 | 微距特写、中文标注、卖点callout |
| 🖼️ 组合图 | 多面板品牌展示 | 3:4 | 主图+细节+场景三合一 |

## 提示词原则（来自 awesome-gpt-image-2）

1. **原子化 Schema**：把主体、光影、材质、版式拆成可组合组件
2. **结构化控制**：用 JSON Schema 而非散文提示词
3. **材质和光影是灵魂**：必须显式指定材质（如"磨砂质感"）和灯光（如"轮廓光"）
4. **文案克制**：只给核心 1-2 句卖点，文字多画面就毁了
5. **比例锁定在最前面说**：1:1 / 3:4 在 prompt 第一句指定

## 品类视觉体系

7 个品类各有独立的视觉特征库：材质、纹理、光影、场景描述、色调。存储在 `server/ecommercePromptEngine.mjs` 的 `CATEGORY_VISUALS` 中。

## 后端调用

POST `/api/generate-ecommerce`
```json
{
  "product_name": "高保湿精华液",
  "category": "美妆护肤",
  "styles": ["白底主图", "场景图"],
  "platform": "淘宝",
  "selling_points": "高保湿, 24小时持久, 敏感肌适用",
  "reference_images": ["data:image/png;base64,..."]
}
```

## 参考

- [awesome-gpt-image-2 商品电商 case](https://github.com/freestylefly/awesome-gpt-image-2/docs/gallery.md#cat-product) — 38 个电商案例
- [工业级提示词模板](https://github.com/freestylefly/awesome-gpt-image-2/docs/templates.md#tpl-product) — 商品与电商模板
- [Style Library Skill](https://github.com/freestylefly/awesome-gpt-image-2/agents/skills/gpt-image-2-style-library/SKILL.md) — 官方 GPT-Image2 风格库
- 后端提示词引擎：`server/ecommercePromptEngine.mjs`
- Prompt 模板：`server/prompts/ecommerce/*.md`
