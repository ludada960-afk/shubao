# 电商面板组件 UI 审计报告

> 审计范围：\`src/pages/Home/ec/\` 下 7 个面板 + \`src/pages/Home/\` 下 4 个 Ec* 组件
> 审计方式：**只读**源码逐行核对（行号均为文件内 1-based 行号）
> 审计日期：本次会话

---

## 0. 关键前置：面板外框不在面板里

7 个 \`ec/\` 面板自己**都没有面板外壳**（无标题栏、无 padding、无圆角、无阴影）。它们全部以 \`<div style={{ padding: 0 }}>\` 开头，外框由父组件 \`EcMode.jsx\` 提供：

| 层 | 位置 | 值 |
|---|---|---|
| 玻璃面板（第 1 层 surface） | \`EcMode.jsx:46-54\` \`GLASS_PANEL\` | \`borderRadius: 20\` / \`background: rgba(255,255,255,0.85)\` / \`backdropFilter: blur(40px) saturate(220%)\` / \`border: 1px solid rgba(255,255,255,0.7)\` / \`boxShadow: 0 12px 48px rgba(124,58,237,0.15), 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.5)\` |
| 连接箭头 | \`EcMode.jsx:346-357\` | 8px 三角，\`borderTop: 8px solid rgba(255,255,255,0.95)\` |
| 面板容器 | \`EcMode.jsx:359-369\` | \`overflowY: auto\`、\`maxHeight: panelPos.maxH\`、\`zIndex: 101\` |
| 面板宽度（**三档不一致**） | \`EcMode.jsx:303\` | copy=520 / sizing=460 / settings=380 / 其余=420 |

**结论：所谓"面板头部"在 7 个面板中只有 SkuPanel 有（\`SkuPanel.jsx:26-32\`）。SizingPanel / StylePanel / ParamsPanel / CopyPanel 的"头部"实际是内容区顶部的**状态横幅**（智能方案 / 已自定义），不是标题栏。**EcPlatformPicker / EcProductParams / EcRefImages / EcSkuPanel / DesignDirection* 则是另一种形态：裸内容块或整页，完全没有面板外框。

---

## 1. 逐文件审计

### 1.1 SizingPanel.jsx（340 行）

#### 头部结构
| 元素 | 行号 | 字号 / 字重 / 颜色 | padding | 分割线 |
|---|---|---|---|---|
| 根容器 | 202 | — | \`0\` | — |
| 智能方案横幅 | 204-214 | 12 / 600 / \`#16a34a\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(34,197,94,0.12)\`（行 208） |
| └ 背景 | 207 | \`linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))\` | — | — |
| └ 图标 | 211 | \`<Zap size={14} />\` | — | — |
| 已自定义横幅 | 215-225 | 12 / 600 / \`#7c3aed\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(124,58,237,0.1)\`（行 219） |
| └ 背景 | 218 | \`linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.03))\` | — | — |
| 内容区 | 227 | — | \`14px 16px 12px\` | — |

#### 分组结构
| 组 | 标签行号 | 标签样式 | marginBottom | 组间距 |
|---|---|---|---|---|
| 目标平台 | 229 | 11 / 700 / \`var(--text-secondary)\` / letterSpacing 0.3 | 8 | 网格 marginBottom 16（行 230） |
| 平台说明 | 254 | 11 / 400 / \`var(--text-muted)\`，背景 \`rgba(0,0,0,0.025)\`，radius 8 | 14 | — |
| 图片类型 | 260 | 11 / 700 / \`var(--text-secondary)\` / letterSpacing 0.3 | 8 | 列表 gap 4（行 261） |
| 底部统计 | 323-334 | 12 / 600 / \`var(--text-muted)\` | — | marginTop 12 + \`borderTop: 1px solid rgba(0,0,0,0.06)\`（行 324） |

#### 可点击控件

**A. 平台 chip（7 个）— 行 234-247**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 7px 14px\`，无显式高度；图标是 emoji（字号继承 12px） |
| 圆角 | **10**（行 237） |
| 默认态 | bg \`rgba(0,0,0,0.03)\` / border \`1.5px solid rgba(0,0,0,0.1)\` / 文字 \`var(--text-secondary)\` |
| hover | **内联 onMouseEnter 改 style**（行 244-245）→ bg \`rgba(0,0,0,0.06)\`，仅改背景，不改边框 |
| selected | bg \`#1a1a1a\` / border \`#1a1a1a\` / 文字 \`#fff\`（行 239-241） |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

**B. 勾选框（20×20）— 行 274-282**
| 属性 | 值 |
|---|---|
| 尺寸 | \`width: 20, height: 20\`，圆角 **6**（行 275） |
| 默认态 | bg \`#fff\` / border \`2px solid rgba(0,0,0,0.15)\` |
| hover | **完全缺失** |
| checked | bg \`#1a1a1a\` / border \`#1a1a1a\` / 图标 \`<Check size={12} color="#fff" strokeWidth={3} />\`（行 281） |
| focus-visible | **无**（且是 \`<div>\` 而非 input，键盘完全不可达） |
| disabled | **无**（未勾选时仍可点） |
| loading | **无** |

**C. 数量 input — 行 299-310**
尺寸 \`width: 38, height: 26\`，圆角 **6**，默认 bg \`#fff\` / border \`1px solid rgba(0,0,0,0.12)\`；disabled 态 bg \`rgba(0,0,0,0.03)\` / border \`rgba(0,0,0,0.06)\` / 文字 \`var(--text-muted)\` / cursor not-allowed（行 305-309）。**无 hover、无 focus-visible（\`outline: 'none'\` 行 307 直接抹掉焦点环）**。

**D. RatioSelect 触发器 — 行 62-75**
| 属性 | 值 |
|---|---|
| 尺寸 | \`height: 26\`、\`padding: 0 7px\`、gap 4 |
| 圆角 | **7**（行 65） |
| 默认态 | bg \`#fff\` / border \`1px solid rgba(0,0,0,0.14)\` / 文字 \`#1a1a1a\` 11px/700 |
| hover | **完全缺失** |
| 展开态 | 下拉浮层 \`top: 30\`、radius 10、bg \`rgba(255,255,255,0.97)\`、blur 16px、border \`rgba(0,0,0,0.10)\`、shadow \`0 8px 24px rgba(0,0,0,0.14)\`（行 78-82） |
| 下拉项 | \`padding: 6px 4px\`、radius **7**、选中 bg \`rgba(124,58,237,0.08)\` / border \`rgba(124,58,237,0.3)\` / 文字 \`#7c3aed\`（行 90-98） |
| 下拉项 hover | **有**：内联 onMouseEnter → bg \`rgba(0,0,0,0.04)\`（行 95-96） |
| disabled | **有**：bg \`rgba(0,0,0,0.03)\` / border \`rgba(0,0,0,0.06)\` / cursor not-allowed（行 65-67），且隐藏箭头（行 74） |
| focus-visible | **无** |
| loading | **无** |

**E. 比例形状图标 RatioShape — 行 37-45**
\`<svg width={w+2} height={h+2}>\`，内部 \`rx={2}\`；默认 \`stroke: rgba(0,0,0,0.35)\` \`strokeWidth 1.5\` \`fill: none\`；active \`fill/stroke: #7c3aed\`。**形状尺寸随比例变化**（18×18 / 14×18 / 24×7 … 行 24-33），是面板内唯一"尺寸不固定"的图标。

#### 嵌套 surface 层数（SizingPanel 内）
1. **玻璃面板底** — \`rgba(255,255,255,0.85)\` / radius 20 / 父级（\`EcMode.jsx:46-54\`）
2. **状态横幅** — 半透明绿/紫渐变，**无圆角、无边框**（行 207-208 / 218-219）
3. **平台 chip** — \`rgba(0,0,0,0.03)\` / border 1.5px / radius 10 / 无阴影
4. **图片类型行** — 选中时 \`rgba(0,0,0,0.03)\` / border 1.5px \`rgba(0,0,0,0.1)\` / radius 10（行 268-270）
5. **勾选框** — \`#fff\` / border 2px / radius 6（行 275-277）
6. **数量 input** — \`#fff\` / border 1px / radius 6（行 304-305）
7. **RatioSelect 触发器** — \`#fff\` / border 1px / radius 7（行 65-66）

→ **最深 4 层真实 surface 嵌套**（面板 → 类型行 → 勾选框/输入框）。**无任何一层使用阴影**（除下拉浮层）。

#### 硬编码颜色清单
| Hex / rgba | 行号 | 用途 |
|---|---|---|
| \`#7c3aed\` | 41, 42, 91, 92, 98, 218, 219, 220 | 比例选中、下拉选中、自定义横幅（**与全局 \`--accent: #0C0A09\` 冲突**） |
| \`rgba(0,0,0,0.35)\` | 42 | RatioShape 默认描边 |
| \`rgba(0,0,0,0.06)\` | 65, 305, 324 | 禁用边框 / 底部分割线 |
| \`rgba(0,0,0,0.14)\` | 65 | RatioSelect 边框 |
| \`rgba(0,0,0,0.03)\` | 66, 240, 245, 269, 306 | 禁用底 / chip 底 / 行底 |
| \`#fff\` | 66, 277, 281, 306 | 白底、勾选图标 |
| \`var(--text-muted)\` | 69, 254 | 禁用文字 |
| \`#1a1a1a\` | 69, 239, 240, 276, 277 | **近黑主色（非 token）** |
| \`#999\` | 74 | 下拉箭头 |
| \`rgba(255,255,255,0.97)\` | 79 | 下拉底 |
| \`rgba(0,0,0,0.10)\` | 80, 239, 270 | 边框 |
| \`rgba(0,0,0,0.14)\` | 81 | 下拉阴影 |
| \`rgba(124,58,237,0.08 / 0.3 / 0.06 / 0.03 / 0.1)\` | 91, 92, 218, 219 | 紫色系 |
| \`rgba(0,0,0,0.04)\` | 95 | 下拉项 hover |
| \`#555\` | 98 | 下拉项文字 |
| \`#aaa\` | 99 | 下拉 usage 文字 |
| \`rgba(34,197,94,0.08 / 0.04 / 0.12)\` | 207, 208 | 绿色横幅 |
| \`#16a34a\` | 209 | 绿色文字 |
| \`rgba(0,0,0,0.06)\` | 244, 245 | chip hover |
| \`rgba(0,0,0,0.025)\` | 254 | 平台说明底 |
| \`rgba(0,0,0,0.15)\` | 276 | 勾选框边框 |
| \`#e67e22\` | 330 | 亚马逊提示橙 |

---

### 1.2 StylePanel.jsx（220 行）

#### 头部结构
| 元素 | 行号 | 样式 | padding | 分割线 |
|---|---|---|---|---|
| 根容器 | 80 | \`padding: 0\` | 0 | — |
| 智能方案横幅 | 82-92 | 12 / 600 / \`#16a34a\`，bg 绿渐变 | \`10px 16px\` | \`borderBottom: 1px solid rgba(34,197,94,0.12)\`（行 86） |
| └ 图标 | 89 | \`<Sparkles size={14} />\` | — | — |
| 已自定义横幅 | 93-103 | 12 / 600 / \`#7c3aed\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(124,58,237,0.1)\`（行 97） |
| └ 文案 | 101 | **"已自定义配置"** | — | — |
| 内容区 | 105 | — | \`14px 16px 12px\` | — |

> ✅ 与 SizingPanel 的头部**逐值一致**（行号一一对应），仅文案与图标不同。

#### 分组结构
| 组 | 标签行号 | 标签样式 | 副标题 | marginBottom |
|---|---|---|---|---|
| 画面风格 | 107 | 11 / 700 / \`var(--text-secondary)\` / ls 0.3 | 行 108：10 / 400 / \`var(--text-muted)\`，mb 8 | 标签 mb **4** |
| 风格网格 | 110 | grid 3 列 gap **6** | — | mb 16 |
| 品牌色区 | 150-155 | 自成一卡 | — | — |

> ⚠️ **不一致**：SizingPanel 的组标签 marginBottom=8（行 229/260），StylePanel=4（行 107），ParamsPanel=10（行 54），CopyPanel=8（行 54）。

#### 可点击控件

**A. 风格卡（6 个）— 行 114-144**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 10px 4px\`，flex column，gap 4，**无显式高度** |
| 圆角 | **10**（行 117） |
| 默认态 | bg \`rgba(0,0,0,0.03)\` / border \`1.5px solid rgba(0,0,0,0.08)\` / 文字 \`var(--text-secondary)\` |
| hover | **内联 onMouseEnter**（行 123-124）→ bg \`rgba(0,0,0,0.06)\`，边框不变 |
| selected | bg \`#1a1a1a\` / border \`#1a1a1a\` / 主文字 \`#fff\`（行 119-120, 133）/ 副文字 \`rgba(255,255,255,0.6)\`（行 141）/ 色条边框转 \`rgba(255,255,255,0.3)\`（行 128） |
| 内部色条 | \`width: 36, height: 20\`，圆角 **4**，\`boxShadow: 0 2px 4px rgba(0,0,0,0.1)\`（行 125-130） |
| 内部图标 | 由 \`React.cloneElement\` 强制为 \`size: 11\`（行 136），**与声明的 \`size={14}\`（行 8）不符** |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

**B. 品牌色锁定开关 — 行 156-182**
| 属性 | 值 |
|---|---|
| 容器 | bg（locked）\`rgba(124,58,237,0.04)\` : \`rgba(0,0,0,0.03)\`；radius **10**；padding \`10px 12px\`；border 1px \`rgba(124,58,237,0.15)\` : \`rgba(0,0,0,0.06)\`（行 150-153） |
| 开关轨道 | \`width: 36, height: 20\`，圆角 **10**，off bg \`rgba(0,0,0,0.12)\` / on bg \`#7c3aed\`（行 170-173） |
| 开关滑块 | \`width: 16, height: 16\`，圆角 50%，bg \`#fff\`，\`left: on ? 18 : 2\`，shadow \`0 1px 3px rgba(0,0,0,0.2)\`（行 175-180） |
| 图标 | Lock 13px \`#7c3aed\` / Unlock 13px \`var(--text-muted)\`（行 162） |
| hover | **完全缺失** |
| focus-visible | **无** |
| disabled | **无** |

**C. HexColorPicker — 行 188**
第三方 \`react-colorful\`，强制 \`width: 160, height: 140\`。**是面板内唯一无自定义样式的控件**，其内置 focus/hover 行为与其它控件完全脱节。

**D. Hex 输入框 — 行 200-208**
\`height: 28\`、\`padding: 0 8px\`、radius **6**、border 1px \`rgba(0,0,0,0.12)\`、bg \`#fff\`、11px/600、\`fontFamily: monospace\`。**无 hover、无 focus-visible（\`outline: none\` 行 207）**。

**E. 取色色块 — 行 193-199**
\`28×28\`、radius **8**、border \`2px solid rgba(0,0,0,0.1)\`、\`boxShadow: 0 2px 8px rgba(0,0,0,0.1)\`。**不可点击**（无 onClick）。

#### 嵌套 surface 层数
1. 玻璃面板底（父级）
2. 状态横幅（无圆角无边框）
3. 风格卡（\`rgba(0,0,0,0.03)\` / border 1.5 / radius 10）
4. 卡内色条（radius 4 / 有 shadow）
5. 品牌色卡（\`rgba(0,0,0,0.03)\` / border 1 / radius 10）
6. 品牌色卡内 hex 输入框（\`#fff\` / border 1 / radius 6）

→ **5 层嵌套**，比 SizingPanel 多一层，且**第 5 层与第 3 层背景色完全相同**（\`rgba(0,0,0,0.03)\`）却圆角不同（10 vs 10，边框 1px vs 1.5px）——视觉同质但规格不同。

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`#7c3aed\` | 9, 96, 98, 151, 153, 162, 172 | 紫主色 |
| \`#ec4899\` | 9 | smart 渐变中段 |
| \`#f59e0b\` | 9 | smart 渐变末段 |
| \`#f5f5f5\` / \`#e5e5e5\` | 12 | 高级极简渐变 |
| \`#f5f0eb\` / \`#d1fae5\` | 15 | 生活场景渐变 |
| \`#1a1a2e\` / \`#d4a574\` | 18 | 时尚杂志渐变 |
| \`#fde68a\` / \`#fed7aa\` | 21 | 自然暖调渐变 |
| \`#3b82f6\` / \`#60a5fa\` | 24 | 科技精工渐变 |
| \`rgba(34,197,94,0.08 / 0.04 / 0.12)\` | 85, 86 | 绿横幅 |
| \`#16a34a\` | 87 | 绿文字 |
| \`rgba(124,58,237,0.06 / 0.03 / 0.1)\` | 96, 97 | 紫横幅 |
| \`#1a1a1a\` | 119, 120 | 选中近黑 |
| \`rgba(0,0,0,0.08)\` | 119, 128 | 卡边框 / 色条边框 |
| \`rgba(0,0,0,0.03)\` | 120, 124, 151 | 卡底 |
| \`rgba(0,0,0,0.06)\` | 123, 153 | hover / 边框 |
| \`rgba(255,255,255,0.3)\` | 128 | 选中色条边框 |
| \`#fff\` | 133, 136, 176, 205 | 白 |
| \`rgba(255,255,255,0.6)\` | 141 | 选中副文字 |
| \`rgba(0,0,0,0.12)\` | 172, 205 | 开关 off / 输入框边框 |
| \`rgba(0,0,0,0.1)\` | 196 | 色块边框 |
| \`rgba(0,0,0,0.1)\` | 129, 179, 197 | 阴影 |

---

### 1.3 ParamsPanel.jsx（98 行）

#### 头部结构
| 元素 | 行号 | 样式 | padding | 分割线 |
|---|---|---|---|---|
| 根容器 | 28 | \`padding: 0\` | 0 | — |
| 智能方案横幅 | 30-40 | 12 / 600 / \`#16a34a\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(34,197,94,0.12)\`（行 34） |
| └ 图标 | 37 | \`<Sparkles size={14} />\` | — | — |
| 已自定义横幅 | 41-51 | 12 / 600 / \`#7c3aed\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(124,58,237,0.1)\`（行 44） |
| 内容区 | 53 | — | \`14px 16px 12px\` | — |

> ✅ 与 SizingPanel / StylePanel 头部**三值一致**（\`10px 16px\` + 同色分割线 + 12/600）。

#### 分组结构
- 组标签「产品参数」行 54：11 / 700 / \`var(--text-secondary)\` / letterSpacing 0.3 / **marginBottom 10**
- 字段网格行 55：\`1fr 1fr\`，gap 8
- 字段 label 行 57 / 88：\`{...lbl, fontSize: 11}\` → 其中 \`lbl\`（行 6）= 12 / 600 / \`var(--text-secondary)\` / display block / marginBottom **4**，被覆盖为 **11px**

> ⚠️ \`lbl\` 基座定义 fontSize 12（行 6）但两处使用都覆盖成 11（行 57、88）——**基座的 12px 是死代码**。

#### 可点击控件

**A. 文本输入框（品类 + 5 字段）— 行 59-63 / 89-91**
| 属性 | 值 |
|---|---|
| 尺寸 | \`height: 36\`、padding \`8px 12px\`（\`inp\` 行 8） |
| 圆角 | **8** |
| 默认态 | bg \`rgba(0,0,0,0.03)\` / border \`1px solid rgba(0,0,0,0.12)\` / 文字 \`var(--text-primary)\` |
| hover | **完全缺失** |
| focus | **有**（行 60 \`onFocus={() => setCatOpen(true)}\`）但**只用于开启下拉，不改任何视觉样式**；且 \`outline: 'none'\`（行 10）抹掉焦点环 → **focus 无视觉反馈** |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

**B. 品类下拉 chip（12 个）— 行 72-81**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 4px 10px\`、11px |
| 圆角 | **6** |
| 默认态 | bg \`rgba(0,0,0,0.04)\` / 无边框 / 文字 \`var(--text-secondary)\` / 字重 400 |
| hover | **完全缺失** |
| selected | bg \`#1a1a1a\` / 文字 \`#fff\` / 字重 600（行 76-78） |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |
| 浮层 | 行 65-71：\`background: #fff\`、border \`rgba(0,0,0,0.08)\`、radius **8**、\`boxShadow: 0 8px 30px rgba(0,0,0,0.1)\`、padding 6、gap 4、maxHeight 120 |

> ⚠️ 该浮层用 \`onBlur + setTimeout(200)\` 关闭（行 61）—— **键盘/触摸可达性差**。

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`rgba(0,0,0,0.12)\` | 9 | 输入框边框 |
| \`rgba(0,0,0,0.03)\` | 9, 33 | 输入框底 / — |
| \`rgba(34,197,94,0.08/0.04/0.12)\` | 33, 34 | 绿横幅 |
| \`#16a34a\` | 35 | 绿文字 |
| \`rgba(124,58,237,0.06/0.03/0.1)\` | 44, 45 | 紫横幅 |
| \`#7c3aed\` | 46 | 紫文字 |
| \`rgba(0,0,0,0.08)\` | 67 | 浮层边框 |
| \`#fff\` | 67, 77 | 浮层底 / 选中文字 |
| \`rgba(0,0,0,0.1)\` | 68 | 浮层阴影 |
| \`rgba(0,0,0,0.04)\` | 76 | chip 底 |
| \`#1a1a1a\` | 76 | chip 选中底 |

---

### 1.4 SkuPanel.jsx（145 行）

> ⭐ **7 个面板中唯一自带真正"面板头部"的组件**。

#### 头部结构
| 元素 | 行号 | 字号 / 字重 / 颜色 | padding | 分割线 |
|---|---|---|---|---|
| 头部容器 | 26-29 | — | **\`14px 16px 12px\`** | \`borderBottom: 1px solid rgba(0,0,0,0.06)\`（行 28） |
| 主标题「SKU 变体配置」 | 30 | **12** / **700** / \`var(--text-primary)\` / letterSpacing 0.3 | — | — |
| 副标题 | 31 | **11** / 400 / \`var(--text-muted)\` / marginTop 2 | — | — |
| 状态区 | 35 | — | \`10px 16px\` | — |
| 列表区 | 59 | — | \`0 16px 12px\` | — |

> ⚠️ **主标题仅 12px**，与 StylePanel 组内小标签同字号（11px 组标签 / 12px 主体文字），**标题层级几乎不存在**。对比 DesignDirection.jsx:192 的页面标题是 22px/800。

#### 状态横幅（两种）
| 态 | 行号 | 背景 | 边框 | 文字 | 圆角 |
|---|---|---|---|---|---|
| 警告（未启用） | 37-42 | \`linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04))\` | \`1px solid rgba(245,158,11,0.15)\` | \`#d97706\` 12px | 10 |
| 成功（已启用） | 47-52 | \`linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))\` | \`1px solid rgba(34,197,94,0.15)\` | \`#16a34a\` 12px | 10 |
| 图标 | 43 / 53 | \`<AlertCircle size={14} />\` / \`<CheckCircle2 size={14} />\` | — | — | — |

> ⚠️ **同一份"智能/状态横幅"语系，在 Sizing/Style/Params/Copy 里是无边框、无圆角的通栏；在 SkuPanel 里变成有边框、radius 10 的卡片。**同一个产品里两种规格。

#### 可点击控件

**A. 变体卡 — 行 62-68**
bg \`rgba(0,0,0,0.03)\` / radius **12** / padding **12** / border \`1px solid rgba(0,0,0,0.06)\` / marginBottom 8。禁用时 \`opacity: 0.5\` + \`pointerEvents: none\`（行 65-66）。

**B. 删除按钮 — 行 72-80**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 2px 8px\`、11px/600 |
| 圆角 | **6** |
| 默认态 | 无背景 / 文字 \`#e74c3c\` |
| hover | **内置 onMouseEnter**（行 78-79）→ bg \`rgba(231,76,60,0.1)\` |
| focus-visible | **无** |
| disabled | **无**（仍可点，但父卡 pointerEvents:none 会拦住） |

**C. 4 个输入框 — 行 86-102**
\`{...sInp, height: 32}\`，\`sInp\`（行 4-8）= padding \`6px 10px\` / radius **8** / 12px / border \`1px solid rgba(0,0,0,0.12)\` / bg \`#fff\`。**无 hover / 无 focus-visible（\`outline: none\`）**。

**D. 数量输入 — 行 107-109**
\`{...sInp, width: 48, height: 28, textAlign: center, fontSize: 12}\` → radius **8**，与 SizingPanel 数量框（38×26 / radius **6**）**规格不同**。

**E. 添加按钮 — 行 116-129**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 10px\`、12px/600、图标 \`<Plus size={14} />\` |
| 圆角 | **10** |
| 默认态 | 透明底 / \`1.5px dashed rgba(0,0,0,0.15)\` / 文字 \`var(--text-muted)\` |
| hover | **内置 onMouseEnter**（行 126-127）→ borderColor \`#7c3aed\`、color \`#7c3aed\`、bg \`rgba(124,58,237,0.04)\`（**hover 引入紫色，与全站近黑主色冲突**） |
| disabled | 半 disabled：\`opacity: 0.4\` + cursor not-allowed（行 122-123），**但 onClick 仍挂着 add()**，是**视觉禁用而非行为禁用**（行 116 未做守卫） |
| focus-visible | **无** |
| loading | **无** |

**F. 底部统计 — 行 132-141**
11px / \`var(--text-muted)\`；\`marginTop: 10, paddingTop: 8, borderTop: 1px solid rgba(0,0,0,0.06)\`。
> ⚠️ SizingPanel 底部统计是 \`marginTop: 12, paddingTop: 10, fontSize: 12\`（行 323-326）。**同一位置、同一功能，两套值。**

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`rgba(0,0,0,0.12)\` | 5 | 输入框边框 |
| \`rgba(0,0,0,0.06)\` | 28, 64, 134 | 头部分割线 / 卡边框 / 统计分割线 |
| \`rgba(245,158,11,0.08/0.04/0.15)\` | 39, 40 | 警告横幅 |
| \`#d97706\` | 41 | 警告文字 |
| \`rgba(34,197,94,0.08/0.04/0.15)\` | 49, 50 | 成功横幅 |
| \`#16a34a\` | 51 | 成功文字 |
| \`rgba(0,0,0,0.03)\` | 63 | 变体卡底 |
| \`#e74c3c\` | 74 | 删除红（**非 \`--red: #E8544B\`**） |
| \`rgba(231,76,60,0.1)\` | 78 | 删除 hover |
| \`rgba(0,0,0,0.15)\` | 120, 127 | 虚线边框 |
| \`#7c3aed\` | 126 | 添加按钮 hover 紫 |
| \`rgba(124,58,237,0.04)\` | 126 | 添加按钮 hover 底 |

---

### 1.5 CopyPanel.jsx（93 行）

#### 头部结构
| 元素 | 行号 | 样式 | padding | 分割线 |
|---|---|---|---|---|
| 根容器 | 28 | \`padding: 0\` | 0 | — |
| 智能方案横幅 | 30-40 | 12 / 600 / \`#16a34a\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(34,197,94,0.12)\`（行 34） |
| 已自定义横幅 | 41-51 | 12 / 600 / \`#7c3aed\` | \`10px 16px\` | \`borderBottom: 1px solid rgba(124,58,237,0.1)\`（行 45） |
| 内容区 | 53 | — | \`14px 16px 12px\` | — |

> ✅ 与 Sizing/Style/Params 头部一致。
> ⚠️ **行 53 存在多余缩进**（\`        <div style=...\` 比同级多 2 空格），说明是从别处复制粘贴，暗示后续合并可能出错。

#### 分组结构
- 组标签「文案策划」行 54：11 / 700 / \`var(--text-secondary)\` / ls 0.3 / **marginBottom 8**
- label \`lbl\` 行 4：11 / **700** / \`var(--text-secondary)\` / marginBottom **5**
- 字段块 行 56：marginBottom 10；网格 行 69：\`1fr 1fr\` gap 8

> ⚠️ **label 字重不一致**：CopyPanel \`lbl\` = 11px/**700**（行 4）；ParamsPanel \`lbl\` = 12px/**600** 实际渲染 11px/**600**（行 6, 57）。**同一语义标签两种字重。**
> ⚠️ **label marginBottom 不一致**：CopyPanel=5，ParamsPanel=4。

#### 可点击控件

**A. textarea（5 个）— 行 60-66 / 80-86**
| 属性 | 值 |
|---|---|
| 尺寸 | padding \`8px 10px\`、12px、lineHeight 1.55、minHeight 60（\`taBase\` 行 7-12） |
| 圆角 | **8** |
| 默认态 | bg \`rgba(0,0,0,0.025)\` / border **\`1.5px solid rgba(0,0,0,0.10)\`** |
| hover | **完全缺失** |
| focus | **有**（行 64-65 / 84-85）→ borderColor \`rgba(124,58,237,0.4)\`，**通过内联 onFocus 改 style 实现**，无 transition 之外的机制；blur 还原 \`rgba(0,0,0,0.10)\` |
| focus-visible | **无**（用了 \`:focus\` 语义） |
| disabled | **无** |
| loading | **无** |
| 自适应高度 | \`autoGrow\`（行 6）在 \`onInput\` 撑开 |

> ⚠️ CopyPanel textarea 边框是 **1.5px**（行 9）；ParamsPanel input 边框是 **1px**（行 9）；SkuPanel 是 **1px**（行 5）。**同层级表单控件三种边框粗细。**
> ⚠️ 背景也不同：CopyPanel \`rgba(0,0,0,0.025)\`；ParamsPanel \`rgba(0,0,0,0.03)\`；SkuPanel \`#fff\`。

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`rgba(0,0,0,0.10)\` | 9, 65, 85 | 默认边框 / blur 还原 |
| \`rgba(0,0,0,0.025)\` | 9 | textarea 底 |
| \`rgba(34,197,94,0.08/0.04/0.12)\` | 33, 34 | 绿横幅 |
| \`#16a34a\` | 35 | 绿文字 |
| \`rgba(124,58,237,0.06/0.03/0.1)\` | 44, 45 | 紫横幅 |
| \`#7c3aed\` | 46, 58, 64, 71, 72, 73, 74, 84 | 紫文字 + 5 个字段图标 |
| \`rgba(124,58,237,0.4)\` | 64, 84 | focus 边框 |

---

### 1.6 DesignDirection.jsx（544 行）

> ⚠️ **形态完全不同**：这是一个 **整页**（\`minHeight: 100vh\`），不是浮动面板。它自带顶部导航、加载进度、方向卡片、补充调整区、确认按钮、生成进度条。

#### 头部结构
| 元素 | 行号 | 字号 / 字重 / 颜色 | padding |
|---|---|---|---|
| 页面根 | 179 | \`background: var(--bg)\`、\`paddingBottom: 100\` | — |
| 内容容器 | 180 | \`maxWidth: 1100\`、\`margin: 0 auto\` | \`20px 16px\` |
| 顶部导航行 | 182 | — | marginBottom 24 |
| 「返回」按钮 | 183-189 | 13 / 600 / \`var(--text-secondary)\` | \`8px 14px\`，radius **12**，bg \`#fff\`，border \`1px solid rgba(0,0,0,0.08)\`，图标 \`MdArrowBack size={16}\` |
| 页面标题 \`<h2>\` | 192 | **22 / 800** / **\`#1a1a1a\`** | margin 0 |
| 副标题 \`<span>\` | 195 | 13 / 400 / \`var(--text-muted)\` | marginLeft 4 |

> ⚠️ 标题用硬编码 \`#1a1a1a\` 而非 \`var(--text-primary)\`（= \`#1A1614\`）。**同是"近黑主文字"，token 与硬编码并存。**

#### 加载态（行 201-236）
卡片：bg \`#fff\` / radius **16** / padding \`32px 28px\` / \`boxShadow: 0 2px 12px rgba(0,0,0,0.04)\` / border \`1px solid rgba(0,0,0,0.06)\`（行 202-206）。
标题行 209：16 / 700 / \`#1a1a1a\`，图标 \`MdAutoAwesome size={20}\` \`#7c3aed\` + \`animation: spin 1.5s linear infinite\`。
阶段圆点 行 219-228：\`24×24\` 圆，bg = 完成 \`#22c55e\` / 当前 \`#7c3aed\` / 未到 \`#e5e7eb\`；文字 \`#fff\` / \`#9ca3af\`。

#### 错误态（行 239-251）
bg \`#fef2f2\` / border \`1px solid #fecaca\` / radius 12 / padding \`14px 18px\`；文字 \`#dc2626\` 13px；「重试」按钮 padding \`4px 12px\` / radius **8** / bg \`#dc2626\` / \`#fff\` 12px/600。

#### 可点击控件

**A. 方向卡（2×2）— 行 264-343**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 16px 18px\`（内层行 281）、\`overflow: hidden\` |
| 圆角 | **16** |
| 默认态 | bg \`#fff\` / border **\`2px solid rgba(0,0,0,0.06)\`** / \`boxShadow: 0 2px 8px rgba(0,0,0,0.04)\` |
| hover | **完全缺失** |
| selected | border \`2px solid {primaryColor}\`（方向自带色，默认 \`#7c3aed\`）/ \`boxShadow: 0 4px 20px {primaryColor}30\` / 右上角 22×22 圆 \`#a78bfa\`/\`primaryColor\` + \`MdCheck size={14}\`（行 268-269, 286-290） |
| 顶部色条 | \`height: 8\`，\`linear-gradient(90deg, ...preview_colors)\`（行 274-279） |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

> ⚠️ **硬编码 \`#7c3aed\` / \`#a78bfa\` 作为方向配色回退**（行 261-262），与设计 token 的 \`--accent: #0C0A09\` 直接冲突。

**B. 「AI 润色」按钮 — 行 439-451**
| 属性 | 值 |
|---|---|
| 尺寸 | padding \`5px 10px\`、11px/700、图标 \`MdAutoAwesome size={12}\` |
| 圆角 | **8** |
| 默认态 | \`background: linear-gradient(135deg, #7c3aed, #a78bfa)\` / \`#fff\` / **无边框** |
| hover | **完全缺失** |
| loading | **有**：bg 变 \`#e5e5e5\`、cursor \`wait\`、图标 \`animation: spin 1s linear infinite\`、文案「润色中…」（行 444-450） |
| disabled | 视觉禁用 \`opacity: 0.4\` + \`pointerEvents: none\`（行 447），**未用 \`disabled\` 属性** |
| focus-visible | **无** |

**C. 「重新生成方向」按钮 — 行 455-464**
padding \`8px 16px\` / radius **10** / border \`1.5px solid rgba(0,0,0,0.1)\` / 透明底 / 12px/600 / \`var(--text-secondary)\` / 图标 \`MdRefresh size={14}\`。**无 hover、无 focus-visible、无 disabled、无 loading。**

**D. 「确认方向，开始生成」主按钮 — 行 470-486**
| 属性 | 值 |
|---|---|
| 尺寸 | padding \`14px 48px\`、16px/800、\`gap: 8\`、箭头 span 18px |
| 圆角 | **25**（形似胶囊但非 \`--radius-full\`） |
| 默认态 | \`background: linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)\` / \`#fff\` / border none / \`boxShadow: 0 6px 24px rgba(124,58,237,0.35)\` |
| hover | **完全缺失** |
| disabled | **有且真实**：\`disabled={generating}\`（行 470）→ bg \`#ddd\` / \`boxShadow: none\` / cursor not-allowed（行 475-477） |
| loading | **有**：图标 spin 1s + 显示 \`genProgress\`（行 481-482） |
| focus-visible | **无** |

**E. 上传添加块（左/右各一）— 行 381-387 / 414-420**
\`52×52\` / radius **8** / border \`2px dashed rgba(124,58,237,0.25)\` 或 \`rgba(236,72,153,0.25)\`；hover **有**（内联，行 383-384 / 416-417）→ borderColor 变实色、bg \`rgba(124,58,237,0.05)\`；图标 \`MdAddPhotoAlternate size={14}\`；文字 8px/600。
**无 focus-visible、无 disabled、无 loading。**

**F. 图片删除 ×— 行 377-378 / 410-411**
\`16×16\` 圆 / bg \`rgba(0,0,0,0.6)\` / \`#fff\` / fontSize 9 / 位置 \`top: -4, right: -4\`。**无 hover。**

**G. 补充描述 textarea — 行 430-437**
\`width: 100%\` / minHeight 64 / padding \`10px 14px\` / paddingRight 90 / radius **10** / border \`1px solid rgba(0,0,0,0.08)\` / bg \`rgba(0,0,0,0.01)\` / 13px / \`resize: vertical\`。**无 hover / 无 focus 样式（\`outline: none\`）**。

#### 嵌套 surface 层数
1. 页面底 \`var(--bg)\` = \`#F5EFE4\`
2. 白卡（加载卡 / 补充调整卡 / 进度卡）：\`#fff\` / radius 16 / border 1px / shadow \`0 2px 12px rgba(0,0,0,0.04)\`
3. 方向卡 \`#fff\` / radius 16 / border 2px / shadow \`0 2px 8px rgba(0,0,0,0.04)\`
4. 方向卡内：one_liner chip \`{primaryColor}10\` / radius 8；visual_tone chip \`rgba(0,0,0,0.03)\` / radius 6；色块圆 20×20 / border 2px \`#fff\`
5. 补充区：歪斜虚线框 \`rotate(-1.5deg)\` / radius 12 / 渐变底 / \`2px dashed\`
6. 框内 upload tile \`52×52\` / radius 8 / \`2px dashed\` / bg \`#fff\`

→ **最深 4-5 层**，且**方向卡与白卡圆角都是 16 但边框宽度不同（1px vs 2px）、阴影不同**。

#### 硬编码颜色清单（节选，共 40+ 处）
| 值 | 行号 | 用途 |
|---|---|---|
| \`#7c3aed\` | 208, 223, 261, 369, 383, 385, 386, 444, 475, 493, 494, 500, 509, 515 | 紫主色（**贯穿全页**） |
| \`#22c55e\` | 223 | 阶段完成绿 |
| \`#e5e7eb\` | 223 | 阶段未达灰 |
| \`#9ca3af\` | 224, 230 | 未达文字 |
| \`#1a1a1a\` | 192, 209, 230, 284, 355, 435, 506 | **近黑（应为 \`--text-primary\`）** |
| \`#fef2f2\` / \`#fecaca\` / \`#dc2626\` | 241, 244, 246, 247 | 错误态 |
| \`#fff\` | 186, 203, 247, 266, 335, 350, 382, 384, 415, 417, 492 | 白 |
| \`#a78bfa\` | 262, 444 | 紫浅 |
| \`#ec4899\` | 394, 402, 417, 418, 475, 515 | 粉 |
| \`rgba(236,72,153,0.2 / 0.25 / 0.05)\` | 402, 415, 416 | 粉虚线/hover |
| \`rgba(124,58,237,0.2 / 0.25 / 0.05 / 0.15 / 0.35)\` | 369, 382, 383, 477, 493, 494 | 紫系 |
| \`#FAF7F2\` / \`#F5F0FF\` | 368 | 左框渐变 |
| \`#FFF5F7\` / \`#FDF2F8\` | 401 | 右框渐变 |
| \`#999\` | 332, 363, 396 | 弱提示 |
| \`#ddd\` | 475 | 主按钮 disabled |
| \`#e5e5e5\` | 444 | 润色 loading |
| \`#888\` | 507 | 进度副文字 |
| \`#f59e0b\` | 475 | 主按钮渐变末段 |

---

### 1.7 DesignDirectionView.jsx（158 行）

> **暗色整页**，与全站暖白 token 体系**完全脱节**。

#### 头部结构
| 元素 | 行号 | 字号 / 字重 / 颜色 | padding | 分割线 |
|---|---|---|---|---|
| 页面根 | 55 | \`background: #0f0f1a\` / \`color: #fff\` / \`paddingBottom: 40\` | — | — |
| Top bar | 57 | — | \`16px 24px\` | \`borderBottom: 1px solid rgba(255,255,255,0.06)\` |
| 返回按钮 | 58-63 | \`36×36\` / radius **10** / bg \`rgba(255,255,255,0.06)\` / 图标 \`MdArrowBack size={18} color="rgba(255,255,255,0.6)"\` | — | — |
| 页面标题 | 65 | **15 / 700 / \`rgba(255,255,255,0.9)\`** | — | — |
| 副标题 | 66 | **12 / 400 / \`rgba(255,255,255,0.35)\`** / marginTop 2 | — | — |
| Header 区 | 71 | — | \`28px 24px 8px\`，\`maxWidth: 900\` | — |
| \`<h2>\` | 72 | **22 / 800** / 继承 \`#fff\`，内嵌 span \`#a78bfa\` | marginBottom 6 | — |
| \`<p>\` | 75 | 14 / 400 / \`rgba(255,255,255,0.45)\` / lineHeight 1.6 | — | — |

> ⚠️ **标题体系自相矛盾**：Top bar 标题 15/700（行 65），主 \`h2\` 22/800（行 72）——**两个标题层级在同一屏**，且 Top bar 的 15px 甚至小于 DesignDirection.jsx 的 22px 页面标题。与 V1（DesignDirection）**完全不同**。

#### 可点击控件

**A. 方向卡（纵向排列）— 行 91-132**
| 属性 | 值 |
|---|---|
| 布局 | \`display: flex\`，左侧 140px 色卡 + 右侧内容 |
| 圆角 | **16** |
| 默认态 | bg \`rgba(255,255,255,0.03)\` / border \`1px solid rgba(255,255,255,0.08)\` / 无阴影 |
| hover | **有**（行 98-99）→ borderColor \`rgba(255,255,255,0.15)\`（仅边框，不改背景） |
| selected | border \`2px solid #a78bfa\` / bg \`rgba(167,139,250,0.06)\` / 标题色转 \`#a78bfa\`（行 114）/ 右侧出现 22×22 圆 \`#a78bfa\` + \`MdCheck size={13}\`（行 118-120） |
| ⚠️ 布局跳动 | 默认 \`1px\` border → selected \`2px\` border，**尺寸变化会导致卡片位移**（对比 DesignDirection.jsx 用固定 2px 规避了此问题） |
| 左侧序号块 | \`60×60\` / radius **14** / \`background: rgba(255,255,255,0.15)\` / \`backdropFilter: blur(8px)\` / 24px/800 |
| outputs chip | \`padding: 3px 8px\` / radius **6** / \`rgba(255,255,255,0.06)\` / 11px/500 / \`rgba(255,255,255,0.45)\` |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

**B. 主按钮「确认方向 · 开始生成全套素材」— 行 139-154**
| 属性 | 值 |
|---|---|
| 尺寸 | \`width: 100%\`、\`height: 52\`、16/700、\`gap: 8\`、图标 \`MdAutoAwesome size={18}\` |
| 圆角 | **14** |
| 默认态 | \`background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #c4b5fd 100%)\` / \`#fff\` / border none / \`boxShadow: 0 4px 24px rgba(124,58,237,0.3)\` |
| hover | **完全缺失** |
| disabled | **有**：\`disabled={!selectedId}\`（行 140）→ bg \`rgba(255,255,255,0.06)\` / color \`rgba(255,255,255,0.25)\` / cursor not-allowed / shadow none（行 145-150） |
| loading | **无** |
| focus-visible | **无** |

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`#0f0f1a\` | 55 | 页面底（**暗色，全站唯一**） |
| \`#fff\` | 55, 119, 146 | 白 |
| \`rgba(255,255,255,0.06 / 0.1)\` | 59, 60, 61 | 返回按钮 |
| \`rgba(255,255,255,0.6)\` | 62 | 返回图标 |
| \`rgba(255,255,255,0.9)\` | 65, 114 | 标题 |
| \`rgba(255,255,255,0.35)\` | 66, 115 | 副标题 / 分隔点 |
| \`#a78bfa\` | 73, 81, 94, 95, 114, 118, 144 | 紫强调（**全页强调色**） |
| \`rgba(255,255,255,0.45)\` | 75, 126 | 正文 / chip |
| \`rgba(167,139,250,0.1 / 0.2 / 0.06)\` | 79, 95 | 产品标签 / 选中底 |
| \`rgba(255,255,255,0.03 / 0.08 / 0.15)\` | 94, 95, 98, 99 | 卡片底/边框/hover |
| \`rgba(255,255,255,0.15)\` | 104 | 序号块底 |
| \`rgba(255,255,255,0.4 / 0.5)\` | 80, 116, 123 | 次级文字 |
| \`rgba(255,255,255,0.06)\` | 126 | chip 底 |
| \`#c4b5fd\` | 144 | 渐变末段 |
| \`rgba(124,58,237,0.3)\` | 150 | 按钮阴影 |
| \`rgba(255,255,255,0.25)\` | 146 | 按钮 disabled 文字 |

---

### 1.8 EcPlatformPicker.jsx（175 行）

> 这是**唯一大规模使用 design token 的面板**（\`var(--accent)\` / \`var(--radius-full)\` / \`var(--border)\` 等），风格与 \`ec/\` 目录其它 7 个面板**完全相反**。

#### 头部结构
- **无头部**。根容器行 40 是裸 \`<div>\`，无 padding、无标题、无分割线。
- 平台 pill 行 42：\`gap: 6\`、\`marginBottom: 10\`
- 尺寸配置行 67-70：\`display: flex, alignItems: center, gap: 6, padding: 0\`

#### 可点击控件

**A. 平台 pill（6 个）— 行 46-61**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 8px 14px\`、\`gap: 6\`、12px，**无显式高度** |
| 圆角 | **\`var(--radius-full)\` = 9999px 胶囊** |
| 默认态 | bg \`#fff\` / border \`1px solid var(--border)\` / 文字 \`var(--text-secondary)\` / **fontWeight 600** |
| hover | **完全缺失** |
| selected | bg \`var(--accent)\` = \`#0C0A09\` / **\`border: 'none'\`**（行 54，**移除了边框 → 宽度跳变**）/ 文字 \`#fff\` / **fontWeight 900**（行 55，**字重跳变导致宽度二次抖动**）/ \`boxShadow: 0 1px 3px rgba(0,0,0,0.1)\` |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |
| 图标 | emoji（\`🟠 🛒 🟢 🎵 📕 🌐\`，行 5-10）**尺寸不可控** |

> ⚠️ 用 \`<button>\` 实现（行 46）但**没有重置 \`outline\`**，浏览器默认 focus ring 会以系统蓝出现在这套暖白设计里。

**B. 智能/自定义下拉触发器 — 行 72-92**
| 属性 | 值 |
|---|---|
| 尺寸 | \`height: 40\`、\`padding: 0 12px\`、\`gap: 6\`；图标 \`MdTune size={15}\` / \`MdExpandLess·MdExpandMore size={14}\` |
| 圆角 | \`var(--radius-full)\` 胶囊 |
| 默认态 | bg \`#fff\` / border \`1px solid var(--border)\` / 12px/**700** / \`var(--text-muted)\` |
| hover | **内置 onMouseEnter**（行 84-85）→ borderColor \`var(--accent)\`、color \`var(--accent)\` |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

**C. 下拉浮层 — 行 96-105**
radius **18** / border \`1px solid var(--border)\` / bg \`rgba(255,255,255,0.95)\` / \`backdropFilter: blur(16px)\` / padding 12 / \`boxShadow: 0 18px 46px rgba(57,45,26,0.16)\` / \`animation: fadeIn 0.12s ease\`。
> ⚠️ \`animation: fadeIn\` 引用的 keyframes **在本文件中没有定义**，需依赖全局 CSS 存在。

**D. 比例 chip（4 个）— 行 115-126**
\`padding: 5px 12px\` / radius **8** / 12px；默认 bg \`rgba(0,0,0,0.04)\` / 文字 \`var(--text-secondary)\` / 字重 **600**；选中 bg \`var(--accent)\` / 文字 \`#fff\` / 字重 **900**（行 119-121）。**无 hover、无 focus-visible、无 disabled。**

**E. 清晰度 chip（3 个）— 行 140-151**
与 D **完全相同**（padding/radius/颜色/字重）。

**F. 生成张数 range — 行 165-167**
\`width: 100%\`、\`accentColor: var(--accent)\`、\`height: 4\`。**唯一无自定义样式的原生控件**，其轨道/拇指外观完全由浏览器决定。

#### 分组标签
行 108-110 / 133-135 / 162：11 / **900** / \`var(--text-muted)\` / letterSpacing 0.3 / marginBottom 6。

> ⚠️ **字重 900** 与所有 \`ec/\` 面板的分组标签（**700**）不一致。

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`#fff\` | 52, 79, 120, 145 | pill 底 / 选中文字 |
| \`rgba(0,0,0,0.1)\` | 57 | 选中阴影 |
| \`rgba(0,0,0,0.04)\` | 119, 144 | chip 默认底 |
| \`rgba(255,255,255,0.95)\` | 100 | 浮层底 |
| \`rgba(57,45,26,0.16)\` | 103 | 浮层阴影（**暖棕系，与 token 一致**） |

其余全部走 token：\`var(--accent)\` \`var(--border)\` \`var(--radius-full)\` \`var(--text-secondary)\` \`var(--text-muted)\` \`var(--text-primary)\`。

---

### 1.9 EcProductParams.jsx（98 行）

> 也走 token 体系，但**与 ParamsPanel.jsx 是同一功能的两个平行实现**。

#### 头部结构
- **无头部**。根容器行 23：\`display: flex, flexDirection: column, gap: 10\`。

#### 可点击控件

**A. 输入框（6 个）— 行 30-46 / 81-93**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 10px 14px\`、13px、无显式高度 |
| 圆角 | \`var(--radius-sm)\` = **8** |
| 默认态 | bg \`rgba(0,0,0,0.02)\` / border \`1px solid var(--border)\` / \`var(--text-primary)\` |
| hover | **完全缺失** |
| focus | \`onFocus={() => setShowCatDropdown(true)}\`（行 33）仅开下拉，**无视觉样式**；\`outline: none\`（行 44） |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |

> ⚠️ **与 ParamsPanel 直接冲突**：ParamsPanel 输入框是 padding \`8px 12px\` / height **36** / **12px** / bg \`rgba(0,0,0,0.03)\`（\`ParamsPanel.jsx:8, 63, 91\`）；这里是 padding \`10px 14px\` / 无高度 / **13px** / bg \`rgba(0,0,0,0.02)\`。

**B. 品类 chip（12 个）— 行 59-69**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 5px 12px\`、12px |
| 圆角 | \`var(--radius-sm)\` = **8** |
| 默认态 | bg **\`transparent\`** / **无边框** / \`var(--text-secondary)\` / 字重 400 |
| hover | **完全缺失** |
| selected | bg \`var(--accent-bg)\` = \`rgba(12,10,9,0.06)\` / 文字 \`var(--accent)\` = \`#0C0A09\` / 字重 600 |
| focus-visible | **无** |

> ⚠️ 对比 ParamsPanel 同款 chip（\`ParamsPanel.jsx:72-81\`）：padding \`4px 10px\` / radius **6** / 默认 bg \`rgba(0,0,0,0.04)\` / 选中 bg **\`#1a1a1a\` 实心黑 + 白字**。**同一个品类选择器，两套完全不同的视觉语言（一个描边轻量、一个实心黑块）。**

**C. 品类浮层 — 行 48-57**
bg \`#fff\` / border \`1px solid var(--border)\` / \`var(--radius-sm)\` / \`var(--shadow-lg)\` / padding **4** / gap 4 / maxHeight **200**。
> ⚠️ 对比 ParamsPanel（行 65-71）：padding **6** / maxHeight **120** / boxShadow \`0 8px 30px rgba(0,0,0,0.1)\`。**同一浮层两种规格。**

#### 硬编码颜色清单
仅 \`#fff\`（行 51）与 \`rgba(0,0,0,0.02)\`（行 42, 89）。**其余全 token —— 这是全部 11 个文件中最干净的一个。**

---

### 1.10 EcRefImages.jsx（117 行）

#### 头部结构（两栏列头）
| 元素 | 行号 | 字号 / 字重 / 颜色 | padding |
|---|---|---|---|
| 根容器 | 10 | \`display: grid\`、\`gridTemplateColumns: 1fr 1fr\`、gap **12** | — |
| 列容器 | 38-43 | bg \`rgba(0,0,0,0.02)\` / radius \`var(--radius-md)\` = **16** / padding **16** / border \`1px solid var(--border-light)\` | 16 |
| 列标题 | 44 | **14 / 600 / \`var(--text-primary)\`** / marginBottom 2 | — |
| 列副标题 | 45 | **11 / 400 / \`var(--text-faint)\`** / marginBottom 12 | — |
| 无分割线 | — | — | — |

> ⚠️ 列标题 14px/600 是目前**所有面板中最接近"标题"的规格**（除 DesignDirection 的 22/800 页面标题外）。而 \`ec/\` 面板的主标题 SkuPanel 只有 12px/700。

#### 可点击控件

**A. 上传区（空态）— 行 48-64**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 32px 14px\`、\`textAlign: center\` |
| 圆角 | \`var(--radius-md)\` = **16** |
| 默认态 | 透明底 / \`border: 2px dashed var(--border)\` |
| hover | **完全缺失** |
| focus-visible | **无** |
| disabled | **无** |
| loading | **无** |
| 图标 | \`<Upload size={22} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />\` |

**B. 缩略图 — 行 68-84**
\`72×72\` / radius \`var(--radius-sm)\` = **8** / border \`1px solid var(--border)\` / \`overflow: hidden\`。

**C. 删除 ✕ — 行 75-83**
\`18×18\` 圆 / bg = \`color\` prop（**\`#2D6A4F\` 深绿 或 \`#6B21A8\` 紫**，行 18/27）/ \`#fff\` / fontSize 10 / \`boxShadow: 0 1px 3px rgba(0,0,0,0.3)\` / 位置 \`top: 2, right: 2\`。**无 hover、无 focus-visible、无 disabled、无 aria-label。**

> ⚠️ **这两处颜色（\`#2D6A4F\` / \`#6B21A8\`）不在任何 design token 里**，且与全站的 \`--accent: #0C0A09\`、\`#7c3aed\` 紫色系都不搭。同时行 60 用 \`color === '#2D6A4F'\` **做字符串比较来决定文案**——把颜色当状态标识用。

**D. 「+」添加上块 — 行 87-95**
\`72×72\` / radius \`var(--radius-sm)\` = **8** / \`border: 2px dashed var(--border)\` / fontSize 20。**无 hover。**

**E. 「继续添加」— 行 109-112**
\`marginLeft: 10\` / \`color: var(--accent)\` / cursor pointer / 字重 500。**无 hover、无 focus-visible。**

#### 嵌套 surface 层数
1. 页面底（父级，\`var(--bg)\`）
2. 列容器 — \`rgba(0,0,0,0.02)\` / radius **16** / border \`--border-light\`
3. 上传虚线框 — 透明 / radius **16** / \`2px dashed --border\`
4. 缩略图 — radius **8** / border 1px

> ⚠️ **第 2 层与第 3 层圆角相同（都是 \`--radius-md\` = 16）但内层是虚线**，视觉上"框套框"很容易糊在一起，因为没有留白对比（外层 padding 16，内层紧贴）。

#### 硬编码颜色清单
| 值 | 行号 | 用途 |
|---|---|---|
| \`#2D6A4F\` | 18, 60 | 左栏删除按钮 / 文案分支判断 |
| \`#6B21A8\` | 27 | 右栏删除按钮 |
| \`#fff\` | 79 | ✕ 图标 |
| \`rgba(0,0,0,0.02)\` | 39 | 列背景 |
| \`rgba(0,0,0,0.3)\` | 82 | ✕ 阴影 |

---

### 1.11 EcSkuPanel.jsx（130 行）

> **与 \`ec/SkuPanel.jsx\` 是同一功能的两个平行实现**，且字段集不同（\`color/spec/size/count/label\` vs \`color/size/capacity/dimLabel/count\`）。

#### 头部结构
- **无头部、无标题、无分割线**。行 34 起 \`marginBottom: 12\`。
- 唯一"说明文字"行 35-37：12 / 400 / \`var(--text-muted)\` / marginBottom 10 / lineHeight 1.6。

> ⚠️ \`ec/SkuPanel.jsx:30-31\` 有 12/700 主标题 + 11px 副标题 + \`borderBottom\`；这里**什么都没有**。

#### 可点击控件

**A. 空态「添加变体」— 行 40-50**
| 属性 | 值 |
|---|---|
| 尺寸 | \`padding: 24px 14px\`、13px |
| 圆角 | \`var(--radius-md)\` = **16** |
| 默认态 | \`border: 2px dashed var(--border)\` / 透明底 / \`var(--text-faint)\` |
| hover | **完全缺失** |
| focus-visible | **无** |
| 图标 | \`<Plus size={18} style={{ margin: '0 auto 6px', display: 'block' }} />\` |

**B. 变体卡 — 行 54-60**
bg \`rgba(0,0,0,0.02)\` / radius \`var(--radius-sm)\` = **8** / padding **12** / border \`1px solid var(--border-light)\`。

**C. 变体字段输入（3 个）— 行 120-129 \`SkuField\`**
\`padding: 7px 10px\` / border \`1px solid var(--border)\` / radius **8** / 12px / bg \`#fff\`。**无 hover / 无 focus-visible（\`outline: none\`）。**

**D. 标注输入 — 行 67-74**
\`flex: 1\` / \`padding: 6px 10px\` / radius **8** / 12px / bg \`#fff\`。
> ⚠️ **与同一卡片内的 SkuField（padding \`7px 10px\`）差 1px** —— 行 71 vs 行 125。

**E. 数量输入 — 行 78-85**
\`width: 40\` / \`padding: 4px 4px\` / radius **8** / 12px / center。
> ⚠️ 对比 \`ec/SkuPanel.jsx:109\` 的 \`width: 48, height: 28, padding: 6px 10px\`。**同一功能两种尺寸。**

**F. 删除按钮（Trash2）— 行 87-95**
\`26×26\` 圆 / bg 透明 / \`var(--text-faint)\` / 图标 \`<Trash2 size={13} />\`。
> ⚠️ **无 hover 样式**，尽管行 92 声明了 \`transition: 'all 0.12s'\`——**transition 是死代码**（没有任何状态会变化）。
> ⚠️ 对比 \`ec/SkuPanel.jsx:72-80\`：文字「删除」按钮 / padding \`2px 8px\` / radius **6** / \`#e74c3c\` 红 + hover 背景。**一个用图标无 hover，一个用文字有 hover。**

**G. 「+ 添加变体」— 行 99-107**
\`padding: 10px\` / radius \`var(--radius-sm)\` = **8** / \`1px dashed var(--border)\` / 13px / \`var(--text-muted)\` / \`gap: 6\` / 图标 \`<Plus size={14} />\`。
> ⚠️ 对比 \`ec/SkuPanel.jsx:116-129\`：radius **10** / **\`1.5px\` dashed \`rgba(0,0,0,0.15)\`** / 12px / 有紫色 hover。**虚线粗细、圆角、字号、hover 全不同。**

#### 硬编码颜色清单
仅 \`#fff\`（行 72, 127）。其余全 token。**干净度仅次于 EcProductParams.jsx。**

---

## 2. 跨面板不一致清单

### A. 圆角体系（最严重的分散）

| 用途 | 文件:行 | 值 |
|---|---|---|
| 选项卡 / chip | \`SizingPanel.jsx:237\` 平台 chip | **10** |
| 选项卡 / chip | \`StylePanel.jsx:117\` 风格卡 | **10** |
| 选项卡 / chip | \`ParamsPanel.jsx:75\` 品类 chip | **6** |
| 选项卡 / chip | \`EcPlatformPicker.jsx:117, 143\` 比例/清晰度 chip | **8** |
| 选项卡 / chip | \`EcProductParams.jsx:61\` 品类 chip | **8** (\`--radius-sm\`) |
| 选项卡 / chip | \`EcPlatformPicker.jsx:50, 77\` 平台 pill / 触发器 | **\`--radius-full\` 9999px** |
| 小输入框 | \`SizingPanel.jsx:304\` 数量 input | **6** |
| 小输入框 | \`SizingPanel.jsx:65\` RatioSelect | **7** |
| 小输入框 | \`SkuPanel.jsx:5\` 4 个字段 input | **8** |
| 小输入框 | \`StylePanel.jsx:204\` hex input | **6** |
| 表单框 | \`ParamsPanel.jsx:8\` inp | **8** |
| 表单框 | \`CopyPanel.jsx:8\` taBase | **8** |
| 表单框 | \`DesignDirection.jsx:433\` 补充描述 | **10** |
| 卡片 | \`SkuPanel.jsx:63\` 变体卡 | **12** |
| 卡片 | \`EcSkuPanel.jsx:56\` 变体卡 | **8** |
| 卡片 | \`DesignDirection.jsx:266, 350\` 方向卡/白卡 | **16** |
| 卡片 | \`EcRefImages.jsx:41\` 列容器 | **16** (\`--radius-md\`) |
| 卡内子块 | \`StylePanel.jsx:194\` 取色色块 | **8** |
| 卡内子块 | \`DesignDirectionView.jsx:103\` 序号块 | **14** |
| 复选框 | \`SizingPanel.jsx:275\` | **6** |
| 开关 | \`StylePanel.jsx:171\` 轨道 | **10** |
| 圆形 | \`EcSkuPanel.jsx:89\` 删除 | **50%** 26×26 |
| 圆形 | \`DesignDirection.jsx:335\` 色块 | **50%** 20×20 |

**→ 同一"小控件"语义下出现了 6 / 7 / 8 / 10 / 14 / 16 / 9999px 七种圆角。**

### B. 边框规格

| 语义 | 文件:行 | 值 |
|---|---|---|
| 选项卡 | \`SizingPanel.jsx:238\`、\`StylePanel.jsx:118\` | **1.5px** |
| 选项卡 | \`EcPlatformPicker.jsx:54\` | **none（选中时）/ 1px（默认）** |
| 选项卡 | \`ParamsPanel.jsx:76\` | **无边框** |
| 选项卡 | \`EcProductParams.jsx:63\` | **无边框** |
| 表单 | \`ParamsPanel.jsx:9\` | **1px** |
| 表单 | \`CopyPanel.jsx:9\` | **1.5px** |
| 表单 | \`SkuPanel.jsx:5\` | **1px** |
| 表单 | \`EcSkuPanel.jsx:125\` | **1px** |
| 卡片 | \`SizingPanel.jsx:270\` 类型行 | **1.5px** |
| 卡片 | \`SkuPanel.jsx:64\` | **1px** |
| 卡片 | \`DesignDirection.jsx:268\` 方向卡 | **2px** |
| 虚线 | \`SkuPanel.jsx:120\` 添加按钮 | **1.5px dashed \`rgba(0,0,0,0.15)\`** |
| 虚线 | \`EcSkuPanel.jsx:103\` 添加按钮 | **1px dashed \`var(--border)\`** |
| 虚线 | \`EcSkuPanel.jsx:42\`、\`EcRefImages.jsx:50\` | **2px dashed \`var(--border)\`** |
| 虚线 | \`DesignDirection.jsx:369\` | **2px dashed \`rgba(124,58,237,0.2)\`** |

### C. 分组标签（section label）规格

| 文件:行 | 字号 | 字重 | 颜色 | letterSpacing | marginBottom |
|---|---|---|---|---|---|
| \`SizingPanel.jsx:229\` 目标平台 | 11 | 700 | \`--text-secondary\` | 0.3 | **8** |
| \`SizingPanel.jsx:260\` 图片类型 | 11 | 700 | \`--text-secondary\` | 0.3 | **8** |
| \`StylePanel.jsx:107\` 画面风格 | 11 | 700 | \`--text-secondary\` | 0.3 | **4** |
| \`ParamsPanel.jsx:54\` 产品参数 | 11 | 700 | \`--text-secondary\` | 0.3 | **10** |
| \`CopyPanel.jsx:54\` 文案策划 | 11 | 700 | \`--text-secondary\` | 0.3 | **8** |
| \`EcPlatformPicker.jsx:108\` 画面比例 | 11 | **900** | \`--text-muted\` | 0.3 | 6 |
| \`EcPlatformPicker.jsx:133\` 清晰度 | 11 | **900** | \`--text-muted\` | 0.3 | 6 |
| \`EcPlatformPicker.jsx:162\` 生成张数 | 11 | **900** | \`--text-muted\` | 0.3 | 6 |

**→ marginBottom 出现 4 / 6 / 8 / 10 四档；字重出现 700 / 900；颜色出现 \`--text-secondary\` / \`--text-muted\` 两种。**

### D. 字段 label 规格

| 文件:行 | 字号 | 字重 | 颜色 | marginBottom |
|---|---|---|---|---|
| \`ParamsPanel.jsx:6\` + \`57\`/\`88\` | **11**（基座写 12 被覆盖） | **600** | \`--text-secondary\` | **4** |
| \`CopyPanel.jsx:4\` | 11 | **700** | \`--text-secondary\` | **5** |
| \`SkuPanel.jsx:85\`/\`90\`/\`95\`/\`100\` | 11 | 600 | **\`--text-muted\`** | **3** |
| \`EcProductParams.jsx:26\`/\`78\` | **12** | 600 | **\`--text-muted\`** | 4 |

**→ 字号 11/12、字重 600/700、颜色 secondary/muted、marginBottom 3/4/5 —— 四个维度全部不一致。**

### E. 状态横幅（智能方案 / 已自定义）规格

| 载体 | 文件:行 | 边框 | 圆角 | padding |
|---|---|---|---|---|
| 通栏横幅 | \`SizingPanel.jsx:204-210\` | **无** | **无** | \`10px 16px\` |
| 通栏横幅 | \`StylePanel.jsx:82-88\` | **无** | **无** | \`10px 16px\` |
| 通栏横幅 | \`ParamsPanel.jsx:30-36\` | **无** | **无** | \`10px 16px\` |
| 通栏横幅 | \`CopyPanel.jsx:30-36\` | **无** | **无** | \`10px 16px\` |
| 卡片横幅 | \`SkuPanel.jsx:37-42\`（警告） | \`1px solid rgba(245,158,11,0.15)\` | **10** | \`10px 12px\` |
| 卡片横幅 | \`SkuPanel.jsx:47-52\`（成功） | \`1px solid rgba(34,197,94,0.15)\` | **10** | \`10px 12px\` |

**→ 同一个"智能方案指示"组件，4 处是无边框通栏，SkuPanel 里变成有边框圆角卡。**

### F. hover 实现方式（三种并存 + 大量缺失）

| 实现方式 | 文件:行 |
|---|---|
| **内联 onMouseEnter 改 style** | \`SizingPanel.jsx:95-96, 244-245\`；\`StylePanel.jsx:123-124\`；\`SkuPanel.jsx:78-79, 126-127\`；\`EcPlatformPicker.jsx:84-85\`；\`DesignDirection.jsx:60-61, 98-99, 383-384, 416-417\`；\`DesignDirectionView.jsx:60-61, 98-99\` |
| **CSS class** | 全局 \`design-tokens.css\` 中确有 hover 规则，但 **7 个 ec/ 面板内一个都没用到** |
| **完全缺失** | \`SizingPanel.jsx:274\` 勾选框、\`SizingPanel.jsx:62\` RatioSelect 触发器、\`StylePanel.jsx:156\` 品牌锁开关、\`ParamsPanel.jsx:59\`/\`89\` 输入框、\`ParamsPanel.jsx:72\` 品类 chip、\`CopyPanel.jsx:60\`/\`80\` textarea、\`SizingPanel.jsx:299\` 数量 input、\`SkuPanel.jsx:86\` 4 输入框、\`EcPlatformPicker.jsx:46\` 平台 pill、\`EcPlatformPicker.jsx:115\`/\`140\` chip、\`EcProductParams.jsx:59\` chip、\`EcRefImages.jsx:48\`/\`87\` 上传块、\`EcSkuPanel.jsx:40\`/\`99\` 添加、\`EcSkuPanel.jsx:87\` 删除、\`DesignDirection.jsx:183\` 返回、\`DesignDirection.jsx:264\` 方向卡、\`DesignDirection.jsx:439\` 润色、\`DesignDirection.jsx:455\` 重新生成、\`DesignDirection.jsx:470\` 主按钮、\`DesignDirectionView.jsx:139\` 主按钮 |

**→ 内联 hover 无法被 CSS 覆盖、无法统一治理，且不响应键盘。**

### G. focus-visible 态：**全部缺失**

**11 个文件中，focus-visible 出现 0 次。** 具体：
- 显式 \`outline: 'none'\` 抹掉焦点环：\`SizingPanel.jsx:307\`、\`ParamsPanel.jsx:10\`、\`StylePanel.jsx:207\`、\`SkuPanel.jsx:6\`、\`CopyPanel.jsx:10\`、\`EcProductParams.jsx:44,91\`、\`EcSkuPanel.jsx:73,84,127\`、\`DesignDirection.jsx:436\`
- \`<div onClick>\` 伪按钮（键盘完全不可达）：\`SizingPanel.jsx:234, 274, 87\`、\`StylePanel.jsx:114, 156\`、\`ParamsPanel.jsx:73\`、\`SkuPanel.jsx:72, 116\`、\`EcPlatformPicker.jsx:115, 140\`、\`EcProductParams.jsx:59\`、\`EcRefImages.jsx:48, 75, 87, 109\`、\`EcSkuPanel.jsx:40, 87, 99\`、\`DesignDirection.jsx:183, 245, 264, 381, 414, 439, 455, 532\`
- 用 \`<button>\` 但未重置 outline：\`EcPlatformPicker.jsx:46, 72\`（**会出现系统默认蓝 focus ring，与暖白设计冲突**）
- 用 \`<button>\` 且无焦点样式：\`DesignDirectionView.jsx:139\`、\`DesignDirection.jsx:470\`

### H. disabled 态

| 有真实 disabled | 仅视觉禁用（pointerEvents/opacity，行为仍可触发） | 完全缺失 |
|---|---|---|
| \`SizingPanel.jsx:302\`（原生 disabled）、\`SizingPanel.jsx:62-67\`（RatioSelect）、\`DesignDirection.jsx:470\`（native disabled）、\`DesignDirectionView.jsx:140\`（native disabled） | \`SkuPanel.jsx:122-123\`（添加按钮）、\`DesignDirection.jsx:447\`（AI 润色）、\`SizingPanel.jsx:294-295\`（数量/比例组） | \`StylePanel.jsx\`、\`ParamsPanel.jsx\`、\`CopyPanel.jsx\`、\`EcPlatformPicker.jsx\`、\`EcProductParams.jsx\`、\`EcRefImages.jsx\`、\`EcSkuPanel.jsx\` 全部控件 |

### I. loading 态

| 有 loading | 无 loading |
|---|---|
| \`DesignDirection.jsx:481-482\` 主按钮（图标 spin + 文案）、\`DesignDirection.jsx:439-451\` AI 润色（spin + 「润色中…」） | **其余 9 个文件全部没有** |

> ⚠️ 生成过程有 SSE 进度（\`DesignDirection.jsx:125-134\`）和进度条（\`DesignDirection.jsx:512-519\`），但**任何面板内的按钮都不反映这个状态**。

### J. 主按钮规格

| 文件:行 | padding / 高度 | 圆角 | 背景 | 阴影 |
|---|---|---|---|---|
| \`DesignDirection.jsx:472-477\` | \`14px 48px\` | **25** | 紫→粉→橙三色渐变 | \`0 6px 24px rgba(124,58,237,0.35)\` |
| \`DesignDirectionView.jsx:142-150\` | \`height: 52\` | **14** | 紫三色渐变 | \`0 4px 24px rgba(124,58,237,0.3)\` |
| \`EcPlatformPicker.jsx:76-82\`（次级） | \`height: 40\` | **9999px** | \`#fff\` + border | 无 |

**→ 两个"确认方向/开始生成"主按钮，在同一产品流程里圆角 25 vs 14、高度隐式 vs 52、渐变配方不同。**

### K. 硬编码近黑 vs token

| 值 | 文件:行 |
|---|---|
| 硬编码 \`#1a1a1a\` | \`SizingPanel.jsx:69, 239, 240, 276, 277\`；\`StylePanel.jsx:119, 120\`；\`ParamsPanel.jsx:76\`；\`DesignDirection.jsx:192, 209, 230, 284, 355, 435, 506\`；\`DesignDirection.jsx:535\` |
| \`var(--text-primary)\` = \`#1A1614\` | \`SizingPanel.jsx:287, 308, 328\`；\`SkuPanel.jsx:30, 138, 139\`；\`EcProductParams.jsx:43, 64, 90\`；\`EcSkuPanel.jsx:73\` |
| \`var(--accent)\` = \`#0C0A09\` | \`EcPlatformPicker.jsx:52, 119, 144\`；\`EcRefImages.jsx:110\` |

**→ 同一个"主文字/主色"语义，出现了 \`#1a1a1a\` / \`#1A1614\` / \`#0C0A09\` 三个值。**

### L. 紫色系统一性

\`#7c3aed\`（紫）在设计中**不是 token**，却被 8 个文件硬编码使用：\`SizingPanel.jsx\`（6 处）、\`StylePanel.jsx\`（7 处）、\`ParamsPanel.jsx:46\`、\`SkuPanel.jsx:126\`、\`CopyPanel.jsx\`（9 处）、\`DesignDirection.jsx\`（15 处）、\`DesignDirectionView.jsx:144\`、\`EcPlatformPicker.jsx\`（0 处）。

而设计 token 明确写了 \`--accent: #0C0A09\` 且注释「**强调色（近黑极简，无彩色主色）**」（\`design-tokens.css:12-13\`）。

**→ 这是全局层面最根本的冲突：token 体系声明"无彩色主色"，但 7 个面板把紫色当主色用。**

### M. 绿色 / 橙色 / 红色语义色

| 语义 | token | 面板硬编码 |
|---|---|---|
| 成功绿 | \`--green: #5CA86C\` | \`#16a34a\`（\`SizingPanel.jsx:209\`、\`StylePanel.jsx:87\`、\`ParamsPanel.jsx:35\`、\`SkuPanel.jsx:51\`、\`CopyPanel.jsx:35\`）、\`#22c55e\`（\`DesignDirection.jsx:223\`） |
| 警告橙 | 无 | \`#d97706\`（\`SkuPanel.jsx:41\`）、\`#e67e22\`（\`SizingPanel.jsx:330\`） |
| 删除红 | \`--red: #E8544B\` | \`#e74c3c\`（\`SkuPanel.jsx:74\`）、\`#dc2626\`/\`#fecaca\`/\`#fef2f2\`（\`DesignDirection.jsx:241-247\`） |

**→ 三种语义色，token 全部被绕过，且每种语义出现 2-3 个不同 hex。**

### N. 两套平行实现（同功能、两套代码、两套视觉）

| 功能 | 实现 1 | 实现 2 | 差异 |
|---|---|---|---|
| SKU 配置 | \`ec/SkuPanel.jsx\`（145 行） | \`EcSkuPanel.jsx\`（130 行） | 字段集不同（\`capacity/dimLabel\` vs \`spec/label\`）；有/无头部；删除按钮文字红 vs 图标灰；添加按钮 radius 10/1.5px dashed/12px/紫 hover vs radius 8/1px dashed/13px/无 hover |
| 产品参数 | \`ec/ParamsPanel.jsx\`（98 行） | \`EcProductParams.jsx\`（98 行） | 同为 98 行但样式几乎全不同：input padding \`8px 12px\`/h36/12px vs \`10px 14px\`/无高/13px；chip radius 6/实心黑 vs 8/透明描边；浮层 padding 6/maxH 120 vs 4/maxH 200 |
| 设计方向 | \`DesignDirection.jsx\`（暖白整页，2×2 卡片） | \`DesignDirectionView.jsx\`（暗色整页 \`#0f0f1a\`，纵向卡片） | 配色体系完全相反；卡片圆角 16/16 vs 16；主按钮 25 vs 14；标题 22/800 + 13px 副标题 vs 15/700 + 12/0.35 |

**→ 这三对是最大的技术债：任何 UI 改动都要改两处，且现在两处已经长得完全不一样。**

---

## 3. 优先级建议（按影响面）

1. **P0 — focus-visible 全缺**：11 个文件 0 处，且 20+ 处 \`<div onClick>\` 伪按钮键盘不可达。这是无障碍硬伤，且修复成本低（加全局 \`*:focus-visible\` 规则 + 把 \`<div onClick>\` 换成 \`<button>\`）。
2. **P0 — 紫 vs 近黑主色冲突**：token 声明无彩色主色，代码里紫色占主导。需产品决策：要么改 token，要么改面板。
3. **P1 — 合并三对平行实现**：SKU / 产品参数 / 设计方向各有两套，维护成本翻倍且视觉已分叉。
4. **P1 — 建立控件层组件**：当前 7 种圆角、3 种 hover 实现、3 种边框粗细，根因是每个面板手写内联样式。抽 \`<Chip>\` \`<Field>\` \`<Card>\` \`<Banner>\` 四个基础组件即可消掉 80% 的不一致。
5. **P2 — 把内联 hover 收进 CSS**：内联 \`onMouseEnter\` 无法统一、无法用 \`@media (hover: none)\` 处理触屏、也无法与 focus 状态复用。
6. **P2 — 硬编码 \`#1a1a1a\` 换 \`var(--text-primary)\`**：纯机械替换，但消除一整个颜色维度。

---

*报告结束。本审计为只读操作，未修改任何源文件。*
