# 薯包AI 全面改造实施方案

> **目标：** UI视觉层全面对齐灵图AI + 电商生图引擎深度重构（双风格包+双参考图融合）
> **前提：** 完整保留全部现有功能、参数、生成逻辑
> **架构：** 前端React/JSX+inline-styles+CSS vars，后端Express+GPT Image 2

## 全局约束
- 不删除任何现有功能/参数/逻辑，只改造视觉层 + 扩展底层EC引擎
- 前端图标统一使用 `lucide-react`
- 平台尺寸：淘宝/京东/拼多多/抖音/小红书 = 1:1 → 1440×1440, 3:4 → 1440×1920；亚马逊保持 1000×1000 / 1500×2000
- EC图片类型4类：白底图 + 主图1:1 + 主图3:4 + PNG透明图 + SKU + 6详情切片
- 风格包不硬编码，设计多套差异化Prompt Skill，用户可选
- 全部自检通过后再交付，不半成品输出

---

## 第一部分：UI & 交互改造清单

### Task 1: TopBar — Logo间距/按钮组完整复刻

**文件：** `src/App.jsx`（TopBar组件）

**当前问题：** Logo与灵图AI的间距、字重、字间距不一致；右上角按钮缺少hover阴影交互

**改造内容：**
1. Logo区域：
   - Logo图标：46×46px，圆角12px（当前是10px）
   - 文字：24px / sm:30px，font-weight: 900（当前正确），letter-spacing: 0
   - gap: 12px / sm:16px（当前有 gap 12px，确认响应式）
   - 左侧padding-left: 36px（当前32px）— 对齐灵图
   - 整体高度 min-h-[50px]

2. 按钮组（右侧）：
   - 全部按钮高度44px（当前正确）
   - "我的作品"按钮：hover时背景变 rgba(255,255,255,0.75)，加微阴影
   - "套餐"按钮：hover时 `translateY(-2px)` + box-shadow 增强（已有，检查效果）
   - "去登录/已登录"：hover时 color 加浅色

3. 顶部 paddingTop: 28px（当前24px），让Logo离顶部更舒适

**交互细节：**
- 所有hover需同时：`transform: translateY(-1px)` + box-shadow 增强 + 背景轻微变化
- 禁止只复刻基础外形缺少hover效果

---

### Task 2: 首页标题/slogan优化

**文件：** `src/pages/Home/index.jsx`

**当前问题：** 标题"AI 一键生成爆款内容"只体现小红书能力，新用户看不到EC能力

**改造内容：**
1. Title badge pill：
   - 改为双能力展示： `<Sparkles size={16} fill="#FBBF24" color="#F59E0B" /> 薯包 AI · 小红书图文 + 电商商品图`
   - 或保留当前结构但让badge同时展示两个emoji/标签

2. H1标题（文字+渐变）：
   当前：`{isXHS ? <>AI 一键生成<span className="hero-gradient-text">爆款内容</span></> : <>AI 一键生成<span className="hero-gradient-text">电商商品图</span></>}`
   
   改为不依赖mode的动态文案，始终展示双能力：
   ```
   当前mode === 'content':
     "AI 一键生成爆款内容" + 副标题 "支持电商商品图生成，切换到电商 Tab 试试"
   当前mode === 'ecommerce':
     "AI 一键生成电商商品图" + 副标题 "支持小红书图文创作，切换到图文 Tab 试试"
   ```
   
   或者更优雅的解法——标题固定为"AI 一键生成视觉内容"，副标题改为：
   `{isXHS ? '• 小红书图文生成' : '• 电商商品图生成'} & 双模式一键切换`
   
   **取第二种方案：**
   - H1：`AI 一键生成<span className="hero-gradient-text">视觉内容</span>`
   - 副标题：`<span>小红书图文</span><span style="opacity:0.3"> | </span><span>电商商品图</span> — 双模式一键切换`

3. 保持原有font-size/sm:54px/lg:62px/sm:18px subtitle等，只改文案

---

### Task 3: 主输入容器三层结构修正

**文件：** `src/pages/Home/index.jsx` + `src/pages/Home/EcMode.jsx` + `src/pages/Home/XhsContentMode.jsx`(compactMode)

**当前结构（正确但需微调）：**
```
surface-card (shadow-xl, p-12)
  └─ surface-card-inner (rounded-26px, bg-white/92)
       └─ 组件(A): 黄梯度区(rounded-24, gradient) → 网格内容
       └─ 组件(B): 底栏(border-t, mt-8)
```

**改造内容：**
1. 移除 `hero-section` CSS类中的渐变背景（`background: linear-gradient(180deg, var(--bg) 0%, transparent 280px)`）和 `input-card` 相关冗余CSS
2. 确保 `creative-bg-glow` 作为唯一背景，不叠加其他渐变层
3. `surface-card-inner` 的 background 确认是 `rgba(255,255,255,0.88)`（当前是0.92，改为0.88对齐灵图更通透的白色）
4. `surface-card` 的 padding 当前12px，检查是否需要对齐灵图（灵图外层 p-[12px] → surface-card）

---

### Task 4: 生成按钮重做

**影响文件：** `src/pages/Home/EcMode.jsx` + `XhsContentMode.jsx`(compactMode)

**当前（EcMode.jsx 底栏生成按钮）：**
- height: 50px, padding: '0 10px 0 14px'
- 白色背景 + shadow + 圆形 accent 图标按钮

**改造内容：**
1. 放大按钮：`height: 54px`（当前50px），`padding: '0 16px 0 20px'`
2. 右侧边距：确认底栏 `justify-content: space-between`，按钮两侧留白舒适
3. 按钮文字：字号14→15，字重900（确保够粗）
4. hover效果：`translateY(-2px)` + box-shadow 增强 + 半秒过渡
5. 内圈图标：44→48px，背景色加深
6. 禁止状态（disabled）：opacity 0.45，cursor not-allowed

**底栏整体：** `marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10`

---

### Task 5: 折叠面板（热门主题 + Plog选项）

**文件：** `src/pages/Home/XhsContentMode.jsx`（compactMode，content子模式和plog子模式）

**当前问题：** 热门主题（QUICK_HINTS 14项）全部平铺在输入框下方；Plog风格/排版选择器平铺。

**改造方案：**
1. 热门主题 → 折叠到pill按钮：
   ```jsx
   <button onClick={() => setTopicsOpen(!topicsOpen)}
     style={{ display:'flex', alignItems:'center', gap:6,
       height:36, padding:'0 12px',
       borderRadius:'var(--radius-full)',
       border:'1px solid var(--border)', background:'#fff',
       fontSize:12, fontWeight:700, color:'var(--text-muted)',
       cursor:'pointer', fontFamily:'inherit' }}>
     <Lightbulb size={14} /> 热门主题
     {topicsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
   </button>
   {topicsOpen && (
     <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
       {QUICK_HINTS.map(...)}
     </div>
   )}
   ```

2. Plog 风格/排版 → 折叠到"Plog 设置"pill：
   ```jsx
   style + layout 全体收进折叠面板
   ```

---

### Task 6: XHS/Plog Tab按钮重设计

**文件：** `XhsContentMode.jsx`（compactMode内子模式切换）

**当前问题：** 切换Tab字体偏小（13px）、padding偏小，选中态不够醒目

**改造内容：**
1. Font-size: 13→14px
2. Padding: '8px 0' → '10px 0'
3. 选中态背景：#fff，加粗box-shadow，加深文字颜色
4. 整体height: 44px
5. 微圆角：10px（当前7px）
6. 容器增加高度到44px，gap 3px保持不变

---

### Task 7: EC上传组件引导优化

**文件：** `src/pages/Home/EcRefImages.jsx` + `EcMode.jsx`（参考图弹窗部分）

**当前问题：** 上传组件只有"点击上传"四个字，缺乏商家视角的引导

**改造内容（EcRefImages.jsx）：**
1. 无图状态 → 显示详细引导卡片：
   ```
   [虚线框]
   📷 点击上传商品实拍图
   ↑ 正面照、侧面45°、细节特写都很有用
   1 张正面照也能出图，拍得越清晰 AI 效果越好
   ```
2. 双栏各自增加不同引导：
   - 左栏（商品实拍图）："把你的产品实物照片传上来，AI会照着画出你的产品，不会跑偏变形。建议：正面照1张 + 各角度2-3张"
   - 右栏（参考风格图）："传一张你喜欢的光影/构图/色调参考图，AI会学习它的氛围但保留你的产品。可以是竞品好图、杂志风、或你喜欢的设计"

**改造内容（EcMode.jsx 内参考图弹窗）：**
- 弹窗内上传区域增加更多拍摄建议，明确"仅需1张正面照也能出"
- 把灵图风格的86×108上传按钮也用于EC参考图上传

---

### Task 8: EC尺寸配置面板

**文件：** `src/pages/Home/EcPlatformPicker.jsx`

**当前：** 已有智能/自定义切换下拉，包含ratio/resolution/count配置

**改造内容：**
1. 确保自定义面板默认不可见（`customOpen=false`），点击"自定义"pill展开
2. 验证所有修改项 onChange → 实际生效：
   - customRatio → 传递给父组件
   - customRes → 传递给父组件  
   - customCount → 传递给父组件
3. 展开动画：使用fadeIn/slideDown
4. 增加hover效果到各选项
5. 自定义面板样式与灵图一致：圆角18px，backdrop-filter blur，暖色阴影

---

### Task 9: 全局图标一致性升级

**范围：** 全部 `*.jsx` 文件

**当前问题：** 混用了 inline SVG、emoji、混合图标风格

**改造内容：**
1. 全部使用 `lucide-react` 图标（已有依赖）
2. strokeWidth统一=2
3. size统一：按钮内16px，标题装饰20px，内嵌14px
4. 替换：
   - 上传按钮中的inline SVG `<path>` 改为 `<ImagePlus size={20} />`
   - 生成按钮中的inline SVG `<path>` 改为 `<Sparkles size={16} fill="#fff" />`
   - 其他散落SVG
5. 统一使用 `var(--accent)` / `var(--text-muted)` / `#fff` 作为图标颜色，不硬编码

---

## 第二部分：EC引擎深度重构

### Task 10: 多风格 Skill 包系统

**文件：** `server/ecommercePromptEngine.mjs`

**当前：** 单一 DEFAULT_CAMPAIGN_LOCK 覆盖所有主图

**改造内容：**
1. 设计4-5套 Style Skill，每套定义完整视觉效果参数：

```javascript
const STYLE_SKILLS = {
  premium_minimal: {
    name: '高级极简',
    emoji: '⬜',
    desc: '大量留白·低饱和·产品细节突出',
    campaignLock: {
      visualDirection: 'Premium minimal e-commerce photography, clean and luxurious',
      palette: ['#FFFFFF', '#F5F0EB', '#333333', '#C4A882'],
      colorTemp: 'neutral-warm',
      backgroundSystem: 'Pure white or off-white seamless, generous whitespace around product',
      lightingSystem: 'Large softbox from above-left, diffused fill right, soft gradient shadow',
      layoutSystem: 'Minimal centered composition, 50% product coverage, luxury editorial whitespace',
      productPresentation: 'Hero product isolated, 3/4 elevated angle, sharp on product silhouette',
    }
  },
  lifestyle_scene: {
    name: '生活场景',
    emoji: '🌿',
    desc: '真实使用环境·生活感·故事性',
    campaignLock: {
      visualDirection: 'Lifestyle/editorial photography showing product in real use context',
      palette: ['#F8F4EF', '#E8DDD3', '#8B817A', '#4A4540'],
      colorTemp: 'warm',
      backgroundSystem: 'Soft lifestyle setting — warm wood table, cozy interior corner, natural textures',
      lightingSystem: 'Natural window light from the side, warm tone, soft shadows, gentle atmosphere',
      layoutSystem: 'Contextual composition showing product in use, lifestyle arrangement, 70% product',
      productPresentation: 'Product in authentic use context — with complementary objects, not isolated',
    }
  },
  fashion_editorial: {
    name: '时尚杂志',
    emoji: '✨',
    desc: '高对比·戏剧光影·杂志封面感',
    campaignLock: {
      visualDirection: 'High-fashion editorial product photography, dramatic and bold',
      palette: ['#FFFFFF', '#000000', '#C0C0C0', '#FFD700'],
      colorTemp: 'cool-neutral',
      backgroundSystem: 'Clean dramatic backdrop — dark gradient or bright minimal, strong contrast',
      lightingSystem: 'Dramatic directional key light from above, strong rim light, hard shadows for edge definition',
      layoutSystem: 'Bold centered composition, product as hero object, strong geometric framing',
      productPresentation: 'Sculptural product presentation, dramatic angle, premium magazine quality',
    }
  },
  warm_natural: {
    name: '自然暖调',
    emoji: '🌅',
    desc: '日落光感·柔和温暖·治愈感',
    campaignLock: {
      visualDirection: 'Warm natural-light product photography, cozy and inviting',
      palette: ['#FFF8F0', '#F5E6C8', '#D4A574', '#8B6914'],
      colorTemp: 'warm-golden',
      backgroundSystem: 'Warm golden-hour inspired backdrop, subtle warm gradient, honey-toned',
      lightingSystem: 'Golden-hour warm side light simulating late afternoon sun, warm fill, long soft shadows',
      layoutSystem: 'Soft composition, product in warm light, cozy arrangement, 60% product coverage',
      productPresentation: 'Product bathed in warm golden light, soft focus background, inviting atmosphere',
    }
  },
  tech_precision: {
    name: '科技精工',
    emoji: '🔬',
    desc: '冷调·锐利·高科技感·细节放大',
    campaignLock: {
      visualDirection: 'Precision tech product photography, sharp and modern',
      palette: ['#F5F5F7', '#1D1D1F', '#007AFF', '#86868B'],
      colorTemp: 'cool',
      backgroundSystem: 'Clean cool backdrop — dark charcoal or bright clean, subtle gradient, sharp edges',
      lightingSystem: 'Multiple controlled studio lights: cool key, blue rim for edge definition, minimal shadows',
      layoutSystem: 'Precision centered composition, product as tech artifact, modular grid-aligned layout',
      productPresentation: 'Product on clean pedestal, sharp detail on surfaces, technical precision aesthetic',
    }
  },
};
```

2. 前端 `EcMode.jsx` 增加风格包选择区（顶栏底部的pill选择器）
3. 用户当前选择的styleSkill传递到 `/api/generate-ecommerce`
4. buildECPrompt 中添加 `styleSkill` 参数 → 替换 DEFAULT_CAMPAIGN_LOCK

5. 风格包切换时自动更新selections智能推荐

---

### Task 11: 默认一键生成工作流

**文件：** `src/pages/Home/EcMode.jsx` + `server/ecommercePromptEngine.mjs` + `server/index.mjs`

**当前：** 一键生成按钮调用 generateEcommerce，内部扩展imageSelections

**改造内容：**
1. 当用户仅输入商品描述（无参考图、无卖点）时 → 自动选择 `premium_minimal` 风格包
2. 当有sellPoint但无refImage时 → auto-detect category via LLM → 选最匹配的风格
3. 当有refImage时 → Vision分析 → `auto-recognize` → 自动匹配风格包

---

### Task 12: 双参考图融合逻辑

**文件：** `server/index.mjs`（`/api/generate-ecommerce` 路由）+ `server/ecommercePromptEngine.mjs`

**当前：** `reference_images` 数组统一处理，每张图都走 Vision 分析

**改造内容：**
1. 区分 `real_shots`（商品实拍图）vs `reference_images`（风格参考图）两个独立参数
2. 对 `real_shots` 做 Vision 分析：提取产品形状、颜色、材质、角度
3. 对 `reference_images` 做 Vision 分析：提取光影、色调、构图、氛围
4. 构建融合prompt：

```
PRODUCT FIDELITY (from real_shot analysis):
- Product shape: {extracted}
- Product colors: {extracted}
- Material/texture: {extracted}
- Best angle: {extracted}
→ Maintain EXACT product appearance, only borrow photographic style from below

STYLE REFERENCE (from reference image analysis):
- Lighting: {extracted}
- Color palette: {extracted} 
- Composition: {extracted}
- Mood: {extracted}
→ Apply this photographic treatment to the product above

OUTPUT: Product {name} with EXACT physical appearance + photographic style
```

5. 如果只传了real_shots → 用real_shots分析做产品保真 + CAMPAIGN_LOCK风格
6. 如果只传了reference_images → 产品描述文本 + 风格参考（当前逻辑）
7. 如果两者都传了 → 融合逻辑

---

### Task 13: 智能识别（auto-recognize）增强

**文件：** `server/index.mjs`（`/api/ecommerce/auto-recognize` 路由）

**改造内容：**
1. 增加对 `real_shots`（实拍图）的独立分析路径
2. 回填字段扩展到 styleSkill 的选择
3. 返回建议的风格包 + 推荐理由（在前端toast展示）
4. 添加 Vision 分析脚本文本提取 → 产品名自动识别优化

---

## 验证清单（逐项自检）

1. □ TopBar Logo间距12px/16px，icon 46×46，字重900，padding-left 36px
2. □ 按钮组高度44px，全部hover有 translateY + box-shadow 效果
3. □ 首页标题文案不再是纯小红书视角，展示双能力
4. □ surface-card-inner background 0.88透明度
5. □ 没有重叠的渐变层（唯一背景是 creative-bg-glow）
6. □ 生成按钮height 54px，不贴右边距，hover动效完整
7. □ 热门主题折叠在pill内，展开/收起动画正常
8. □ Plog 风格+排版折叠在pill内
9. □ XHS/Plog Tab 44px高，选中态醒目
10. □ EC上传组件有分栏引导（实拍+风格）
11. □ EC尺寸面板可打开/修改/关闭且值传递
12. □ 全局图标统一 lucide-react，strokeWidth=2
13. □ 5套 Style Skill 定义完整、切换生效
14. □ dual reference prompt 融合逻辑正确
15. □ build 通过，无报错
