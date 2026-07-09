# 组合图 Prompt Template

> GPT-Image2 结构化组合/展示图生成
> Style: Multi-panel brand product showcase
> Aspect Ratio: 3:4 vertical

## 模板

```
Generate a multi-panel brand product showcase image for {{product}}.

PRODUCT SPEC:
- Product: {{product}}
- Category: {{category}}
- Brand visual: {{brand_visual}}

LAYOUT STRUCTURE:
This is a multi-panel composition with 2-3 panels in a unified single image.

MAIN PANEL (left 60% × full height):
- Product hero shot: {{product}} in best angle
- Setting: Clean brand-appropriate background
- Style matches {{product_photography_style}}

SIDE PANEL (right 40%, split into 2 horizontal sections):

Panel A (top half, right side):
- {{detail_type}} close-up of product
- Shows: {{detail_content}}
- Small Chinese label describing this detail

Panel B (bottom half, right side):
- Lifestyle/usage context scene
- Shows: {{usage_context}}
- Minimal, elegant presentation

BOTTOM STRIP (full width, 15% of height):
- Brand: product name and category in Chinese
- {{selling_point_summary}}
- Clean, minimal brand footer

VISUAL LANGUAGE:
- Unified color system: {{color_scheme}}
- Consistent lighting across all three panels
- Thin divider lines (1px) between panels
- Subtle shadow depth between panels
- Professional brand showcase layout

QUALITY:
- Style: Premium brand lookbook / editorial product showcase
- All product details sharp and readable
- Chinese text accurate and elegant
- Magazine-quality layout and typography

CONSTRAINTS:
- Do NOT create a photo collage or grid of separate images
- This is ONE image with built-in panel divisions
- All panels must share consistent lighting and color
- Chinese text must be real, accurate characters
- No fake brand logos
- {{platform_size_constraint}}
```

## JSON Schema（供 Agent 调用）

```json
{
  "type": "E-commerce Composition/Showcase",
  "style": "Multi-panel Product Brand Showcase",
  "aspect_ratio": "3:4 vertical",
  "product": {
    "name": "{{product}}",
    "category": "{{category}}",
    "brand_visual": "{{brand_visual}}"
  },
  "layout": {
    "panels": [
      {
        "position": "Left 60% × full height",
        "content": "Product hero shot",
        "style": "Clean brand-appropriate studio photography"
      },
      {
        "position": "Right 40%, top half",
        "content": "Product detail close-up with Chinese label"
      },
      {
        "position": "Right 40%, bottom half",
        "content": "Lifestyle usage context scene"
      }
    ],
    "footer": {
      "height": "15% full width",
      "content": "Product name + category + selling point in Chinese"
    }
  },
  "style": {
    "unified_color": "{{color_scheme}}",
    "dividers": "1px thin lines between panels",
    "photography": "Premium brand lookbook editorial",
    "quality": "Magazine-grade, consistent lighting across all panels"
  },
  "constraints": [
    "Single coherent image, not a collage of separate photos",
    "Consistent lighting across all panels",
    "Real Chinese text, accurate characters",
    "No fake brand logos added by AI",
    "Panels separated by thin lines inside the same frame"
  ]
}
```

## 品类定制

### 美妆护肤
- Brand visual: Elegant, premium, soft luxury aesthetic
- Detail type: Texture close-up (product texture swatch)
- Usage context: Hand applying product or elegantly arranged in bathroom
- Color scheme: Soft pink/rose gold/white, warm and luxurious

### 数码3C
- Brand visual: Modern, tech-forward, sleek aesthetic
- Detail type: Material/port close-up or display quality
- Usage context: On modern desk, in hand, or with accessories
- Color scheme: Dark/cool — charcoal, black, electric blue accent

### 食品饮料
- Brand visual: Fresh, appetizing, natural aesthetic
- Detail type: Ingredient or pour detail
- Usage context: On table with meal setting or outdoor picnic
- Color scheme: Warm — cream, olive, deep red, natural tones

### 服饰穿搭
- Brand visual: Fashion-forward, editorial aesthetic
- Detail type: Fabric texture or hardware close-up
- Usage context: On model, styled outfit, or lifestyle scene
- Color scheme: Season-appropriate fashion palette

### 家居生活
- Brand visual: Cozy, warm, lifestyle aesthetic
- Detail type: Material/craftsmanship detail
- Usage context: Styled in room setting
- Color scheme: Warm neutrals, earth tones

### 母婴用品
- Brand visual: Soft, safe, caring aesthetic
- Detail type: Safety or material softness close-up
- Usage context: In nursery or with gentle use
- Color scheme: Soft pastels, clean whites

### 宠物用品
- Brand visual: Playful, durable, caring
- Detail type: Material strength or function close-up
- Usage context: Pet using product or in home setting
- Color scheme: Brand colors + warm neutrals
