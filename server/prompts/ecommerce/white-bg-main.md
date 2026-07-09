# 白底主图 Prompt Template

> GPT-Image2 结构化商品主图生成
> Style: White-background e-commerce hero shot
> Aspect Ratio: 1:1 square

## 模板

```
Generate an e-commerce hero product image of {{product}}.

PRODUCT SPEC:
- Product: {{product}}
- Category: {{category}}
- Material/Finish: {{materials}}
- Angle: 3/4 elevated view, product slightly angled
- Scale: Product occupies 60-70% of frame, centered

LIGHTING & SETTING:
- Background: Pure white (#FFFFFF), seamless infinity curve
- Lighting: Soft studio key light from upper-left at 45°
- Fill light: 2:1 ratio from right, soft diffusion
- Rim light: Sharp edge light to define product silhouette
- Shadow: Soft, diffused drop shadow beneath product
- Surface: Reflective white acrylic with subtle gradient

STYLE:
- Style: Professional commercial product photography
- Texture: {{texture_keywords}}
- Depth: Shallow depth of field, product in sharp focus
- Quality: Hyper-realistic, 8K product detail, no noise

TEXT OVERLAY:
- No text, no badges, no logos
- Clean product-only presentation

CONSTRAINTS:
- Chinese product label/text on packaging MUST be readable and accurate
- Preserve brand colors and packaging design faithfully
- NO people, NO hands, NO models
- NO watermarks, NO brand logos added by AI
- 1:1 aspect ratio, square format
- Realistic shadows consistent with lighting direction
```

## JSON Schema（供 Agent 调用）

```json
{
  "type": "E-commerce Hero Image",
  "style": "White Background Main Image",
  "aspect_ratio": "1:1 square",
  "product": {
    "name": "{{product}}",
    "category": "{{category}}",
    "angle": "3/4 elevated, slightly tilted",
    "scale": "60-70% of frame, centered"
  },
  "setting": {
    "background": "Pure white (#FFFFFF), seamless infinity curve",
    "lighting": "Soft key 45° upper-left + 2:1 fill + rim edge light",
    "shadow": "Soft diffused drop shadow",
    "surface": "White acrylic with subtle gradient reflection"
  },
  "style": {
    "photography": "Commercial product photography",
    "quality": "Hyper-realistic, 8K detail",
    "depth_of_field": "Shallow, product in sharp focus"
  },
  "constraints": [
    "No text, badges, or logos on image",
    "Chinese text on packaging must be accurate",
    "Preserve brand colors faithfully",
    "No people, hands, or models",
    "No watermarks or AI-generated logos",
    "Soft diffused shadow consistent with key light"
  ]
}
```

## 品类定制

### 美妆护肤
- Texture: Smooth matte finish with soft glow, frosted glass/plastic texture
- Materials: Frosted glass bottle, metallic cap, glossy label

### 数码3C
- Texture: Brushed metal, precision edges, glass screen, matte black finish
- Materials: Metal alloy, tempered glass, silicone grips

### 食品饮料
- Texture: Smooth packaging, glossy label, natural product visibility
- Materials: Glass bottle/can, paper/cardboard label, sealed cap

### 服饰穿搭
- Texture: Fabric weave, soft drape, natural fiber detail
- Materials: Cotton/linen/silk texture, metal zipper/buttons, leather tag

### 家居生活
- Texture: Natural materials, ceramic/wood grain, soft textiles
- Materials: Porcelain/ceramic, natural wood, cotton/linen blend

### 母婴用品
- Texture: Soft-touch plastic, smooth curves, pastel tones
- Materials: BPA-free plastic, silicone, soft fabric

### 宠物用品
- Texture: Durable fabric, smooth plastic, soft padding
- Materials: Nylon/polyester, rubber base, foam filling
