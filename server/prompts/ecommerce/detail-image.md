# 详情图 Prompt Template

> GPT-Image2 结构化详情图生成
> Style: Product detail/feature breakdown
> Aspect Ratio: 3:4 vertical

## 模板

```
Generate a product detail/info image for {{product}} with Chinese annotations.

PRODUCT SPEC:
- Product: {{product}}
- Category: {{category}}
- Key feature 1: {{feature1}}
- Key feature 2: {{feature2}}
- Key selling point: {{selling_point}}

LAYOUT STRUCTURE:
- Main visual: Product detail close-up on left 55-60% of frame
- Annotation area: Right 40-45% or overlaid on product image
- Flow: Top-to-bottom feature breakdown with numbered callouts
- Labels: Each callout has a short Chinese label (max 6 chars) + brief description (max 15 chars)

ANNOTATIONS (in Chinese, max 3 callouts):
1. {{feature1_label}} → {{feature1_desc}}
2. {{feature2_label}} → {{feature2_desc}}
3. {{feature3_label}} → {{feature3_desc}}

VISUAL STYLE:
- Background: {{background}} 
- Photography: Professional macro/product detail photography
- Lighting: {{lighting}}
- Quality: Sharp focus, texture detail visible, 8K

TEXT STYLE:
- All annotations in Chinese characters
- Small, clean sans-serif style text
- White text on semi-transparent dark background pill/badge
- Thin connector lines from callout to product feature
- NO fake or generic text — labels must be real Chinese product descriptions

CONSTRAINTS:
- Chinese text MUST be accurate, readable Chinese characters
- Do not add text that looks like lorem ipsum or placeholder
- Every callout must point to a specific visible product feature
- No huge blocks of text — keep annotation short and precise
- Product feature in focus, background clean
- {{platform_size_constraint}}
```

## 品类定制

### 美妆护肤
- Background: Soft gradient (white → pale pink)
- Lighting: Macro beauty lighting, even diffused
- Features: Bottle cap detail, texture close-up, ingredient callout

### 数码3C
- Background: Dark gradient (charcoal → black) or sleek dark surface
- Lighting: Precision studio lighting with edge highlights
- Features: Port/button detail, material texture, screen/display spec

### 食品饮料
- Background: Clean warm gradient (cream → warm white)
- Lighting: Soft food photography lighting
- Features: Ingredient detail, packaging seal, nutrition feature

### 服饰穿搭
- Background: Clean white or soft gray
- Lighting: Even textile lighting, weave detail visible
- Features: Fabric texture, stitch detail, hardware/zipper close-up

### 家居生活
- Background: Warm neutral gradient
- Lighting: Soft natural + fill
- Features: Material texture, craftsmanship detail, size/measurement note

### 母婴用品
- Background: Soft pastel gradient
- Lighting: Very soft diffuse light
- Features: Safety feature, material detail, ease-of-use highlight

### 宠物用品
- Background: Bright clean background
- Lighting: Even product lighting
- Features: Durability detail, material spec, size indicator
