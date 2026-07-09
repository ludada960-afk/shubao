# 场景图 Prompt Template

> GPT-Image2 结构化场景图生成
> Style: Lifestyle e-commerce product scene
> Aspect Ratio: 3:4 vertical

## 模板

```
Generate a lifestyle e-commerce scene image featuring {{product}}.

PRODUCT SPEC:
- Product: {{product}}
- Category: {{category}}
- Material/Finish: {{materials}}

SETTING & ENVIRONMENT:
- Scene: {{scene_description}}
- Background: {{environment}}
- Props: Contextual props that complement the product (max 3 items)
- Surface/Placement: {{surface}}

LIGHTING:
- Key light: {{lighting_description}}
- Mood: Natural, warm, atmospheric
- Shadows: Soft natural shadows, not harsh

COMPOSITION:
- Framing: {{composition}}
- Product placement: Hero position, naturally integrated into scene
- Foreground/Background depth: Clear layered depth

COLOR PALETTE:
- Base: {{base_colors}}
- Accent: {{accent_colors}}
- Tone: Warm, inviting, lifestyle editorial

QUALITY:
- Photography style: Professional lifestyle e-commerce photography
- Detail: Product packaging/details sharp and readable
- Chinese text on product: MUST be accurate and legible

CONSTRAINTS:
- Product is the hero, scene supports not distracts
- Chinese labels/text on product MUST be readable
- No text added by AI (no fake labels, badges, or copy)
- Natural color temperature, white balance accurate
- {{platform_size_constraint}}
```

## JSON Schema（供 Agent 调用）

```json
{
  "type": "E-commerce Lifestyle Scene",
  "style": "Scene Image / Contextual Lifestyle",
  "aspect_ratio": "3:4 vertical",
  "product": {
    "name": "{{product}}",
    "category": "{{category}}",
    "role": "Hero product in lifestyle scene"
  },
  "setting": {
    "scene_type": "{{scene_type}}",
    "environment": "{{environment}}",
    "props": "2-3 contextual items, complementary to product",
    "placement": "Natural integration, product as focal point"
  },
  "lighting": {
    "type": "Natural + warm studio fill",
    "direction": "Left window light + right soft fill",
    "mood": "Warm, inviting, premium lifestyle"
  },
  "composition": {
    "framing": "Medium shot, product in lower-center third",
    "depth": "Foreground product → midground scene → background environment"
  },
  "constraints": [
    "Product is hero, scene supports not dominates",
    "Chinese packaging text must be readable",
    "No AI-generated text/labels",
    "Natural accurate white balance",
    "Adapt to {{platform}} size requirements"
  ]
}
```

## 品类定制

### 美妆护肤 — Bathroom Vanity Scene
- Scene: Elegant bathroom vanity setting
- Environment: Clean white marble countertop, soft pastel wall tiles
- Surface: White marble with subtle veining
- Lighting: Soft natural window light from left + warm studio fill
- Props: Small floral arrangement, luxurious towel, gold accent tray
- Base colors: White, soft pink, warm beige
- Accent: Gold, rose gold

### 数码3C — Modern Desk Setup
- Scene: Clean modern desk workspace
- Environment: Minimalist room with ambient evening lighting
- Surface: Light wood desk with subtle grain
- Lighting: Warm ambient desk lamp + cool screen glow
- Props: Notebook, pen, coffee cup, small plant
- Base colors: Warm wood, matte black, white
- Accent: Cool blue (screen glow), green (plant)

### 食品饮料 — Table Setting Scene
- Scene: Outdoor picnic or cozy dining table
- Environment: Rustic wooden table, natural outdoor or warm café background
- Surface: Weathered wood tabletop
- Lighting: Golden hour natural light or warm restaurant lighting
- Props: Fresh ingredients, glassware, cloth napkin
- Base colors: Warm wood, cream, olive green
- Accent: Deep red, amber

### 服饰穿搭 — Lifestyle Fashion Scene
- Scene: Street style or minimalist interior
- Environment: Clean urban background or softly lit room
- Surface/Space: Open clean area
- Lighting: Soft window light + gentle fill
- Props: Minimal — bag, shoes, accessory
- Base colors: Neutrals, whites
- Accent: Season-appropriate fashion color

### 家居生活 — Room Setting Scene
- Scene: Cozy living room or bedroom corner
- Environment: Naturally lit room with warm decor
- Surface: Coffee table, shelf, or bedside table
- Lighting: Natural daylight + warm accent lamp
- Props: Books, candle, small plant, textile accents
- Base colors: Warm beige, soft gray, cream
- Accent: Season-appropriate home decor color

### 母婴用品 — Nursery / Family Scene
- Scene: Soft, safe nursery or family room
- Environment: Gentle, calm, pastel-toned interior
- Surface: Soft rug or changing table
- Lighting: Very soft, diffuse, warm window light
- Props: Soft toy, baby blanket, storybook
- Base colors: Pastels (mint, lavender, peach)
- Accent: Soft white, warm cream

### 宠物用品 — Pet Environment Scene
- Scene: Cozy home corner or outdoor grass
- Environment: Warm home interior or natural outdoor setting
- Surface: Floor, pet bed, or grass
- Lighting: Warm natural light
- Props: Pet toy, treat, water bowl
- Base colors: Warm neutrals, soft greens
- Accent: Pet-product brand color
