# 36 · VideoStudio 调色板裁定表

> **用途**：对本批 3 个文件里**全部 548 处表外 hex**（319 个不同值）逐值给出处置与依据，
> 供设计逐条裁定后再开工迁移。**本步零代码改动**（唯一 EXACT 已单独提交，见 §6）。
>
> **依据**：D15（token 只能替换与之逐值相等的字面量）。
> **方法**：从 `design-tokens-v3.css` 根作用域解析全部 50 个颜色 token → 42 个不同 hex；
> 与目标 hex 做**逐值相等**判定（EXACT）；不等者计算 **CIE ΔE**（LAB 空间）给出最近 token。

---

## 1. 总体结论

| 处置 | 值数 | 处数 | 说明 |
|---|---|---|---|
| **EXACT**（逐值相等，可直接迁） | **1** | **1** | 已在本轮单独提交 `b9a4833e` |
| **NEAR**（接近但不等，需裁定） | **318** | **547** | 本表主体 |
| **KEEP**（不可迁） | 0 | 0 | 三文件内未见业务数据/第三方品牌色（详见 §4）|
| 合计 | 319 | 548 | |

**NEAR 的 ΔE 分布（按处数）**：

| ΔE 区间 | 处数 | 我的建议倾向 |
|---|---|---|
| ΔE < 2（**肉眼几乎不可辨**） | **97** | 倾向接受为「等值化」，建议裁定 ① 直接迁 |
| ΔE 2–5 | **162** | 边界；建议逐族裁定（同类色统一处理） |
| ΔE 5–10 | 109 | 建议**不迁**或换更合适 token |
| ΔE 10–20 | 137 | 建议**不迁**（肉眼可辨） |
| ΔE > 20 | 42 | 明确**不迁** |

> ⚠️ **我的核心建议**：这批文件（尤其 `VideoProjectWorkbench`）**整体是另一套冷调视觉语言**，
> 与 V3 的暖米体系（H27–36）系统性偏离。**逐值裁定成本高且收益低** ——
> 更值得你考虑的是：**先裁决「VideoStudio 是否接入 V3 暖米体系」这个整体问题**，
> 否则我们要裁 319 条，而每条都只是同一件事的重复。

---

## 2. 三族重点（你在指令里点名的）

### 2.1 暖灰族（VPW/VCW 主色）

| 色值 | 次数 | 最近 token | ΔE | 我的判断 |
|---|---|---|---|---|
| `#3D3732` | 12 | `--sb-neutral-700` | **1.5** | ✅ 几乎等值，**建议裁定为可迁** |
| `#413A34` | 6 | `--sb-neutral-700` | **2.4** | ✅ 边界内，建议可迁 |
| `#938C84` | 13 | `--sb-neutral-500` | **3.9** | ⚠️ 偏边界，建议你定 |
| `#8A8197` | 9 | `--sb-neutral-500` | **16.1** | ❌ **明确不迁**：它是**紫调灰**（H265），非暖灰 |
| `#938A9E` | 7 | `--sb-neutral-500` | 13.9 | ❌ 同上，紫调 |
| `#403950` | 9 | `--sb-neutral-700` | **17.1** | ❌ **明确不迁**：暗紫灰（H258），非暖灰 |

**关键发现**：`#8A8197` / `#938A9E` / `#403950` 虽然**饱和度低（s≈10–17）**，
但**色相在 H258–267（紫区）**，**不是中性灰** —— 算法给它们配「最近中性 token」是误导。
**它们是「紫调中性」这一独立语言**，需你先裁决归属（归品牌紫族？还是承认是第三套语言？）。

### 2.2 自定义紫族

| 色值 | 次数 | 最近 token | ΔE | 我的判断 |
|---|---|---|---|---|
| `#7562D0` | 6 | `--sb-brand-400` | 16.5 | ❌ 不迁；且注意它离 **brand-600** 更远（它是 S54 低饱和）|
| `#6D4AFF` | 4 | `--sb-brand-400` | ~15 | ❌ 不迁（L65 S100 过饱和）|
| `#5B64D8` | 4 | `--sb-brand-400` | 19.9 | ❌ 不迁 |
| `#9A86E4` | 4 | `--sb-brand-400` | 9.8 | ⚠️ 较近，建议你定 |
| `#6B5CC4` | 4 | `--sb-info-hover` | 18.6 | ❌ 算法配到「信息蓝」是**明显误导**（它是紫）|

**→ 与上一轮我给你的判断一致**：这批自定义紫**需要先裁决「归入品牌紫族 / 收敛掉 / 保留独立」**，
不是逐值能解决的问题。

### 2.3 语义近值

| 色值 | 次数 | 最近 token | ΔE | 我的判断 |
|---|---|---|---|---|
| `#177A45` | 5 | `--sb-ink-success` | **4.1** | ⚠️ 边界，建议你定 |
| `#B24D42` | 5 | `--sb-danger-hover` | 17.1 | ❌ 不迁（偏暗偏灰）|
| `#93392E` | 8 | `--sb-danger-hover` | **23.5** | ❌ **明确不迁** |
| `#8A6C38` | 5 | `--sb-neutral-600` | **30.2** | ❌ 算法配到「灰」是**明显误导**（它是琥珀）|
| `#9B4D43` | 3 | `--sb-danger-hover` | 28.3 | ❌ 不迁 |
| `#ECD2CC` | 4 | `--sb-danger-border` | 7.6 | ⚠️ 建议你定 |
| `#BFD8CA` / `#CDE7D8` / `#C7E6D5` | 5/4/3 | `--sb-success-border` | 6.6/5.7/4.0 | ⚠️ 绿描边族，V3 已有 `--sb-success-border`，**较可能可迁** |

---

## 3. ⚠️ 对「最近 token」算法的三点警告（请裁定者务必读）

ΔE 最近邻在**低饱和/深色**时会给出**语义上完全错误**的建议。我已核实三例：

1. `#8A6C38`（**琥珀/金棕**，H38 S42）→ 算法配 `--sb-neutral-600`（灰）。**错**。
   正确方向应是 `--sb-ink-warning #B45309`，但 ΔE 更大。
2. `#6B5CC4`（**紫**，H251）→ 算法配 `--sb-info-hover`（蓝）。**错**。
3. `#403950`（**暗紫灰**，H258）→ 算法配 `--sb-neutral-700`（暖灰）。色相偏 230°。**错**。

**故本表的「最近 token」列只作数值参考，不能当语义依据。**
我在 §2 里已对高频项做了人工纠正。

---

## 4. KEEP 类：本批为 0，但有两处**需你注意**

三个文件里**没有** SVG 属性值、没有第三方品牌色、没有 JS 拼接值（纯 CSS 文件），
所以 KEEP = 0。**但现在没有 KEEP ≠ 迁移时可无视**，因为：

- `VideoCanvasWorkbench.css` 有 `var(--text-faint, #B0AAA5)` 这类 **fallback 值** ——
  迁 fallback 时必须**保留外层 legacy var**（深色主题下 `--text-faint` = `#5C5651`）。
  这是本轮唯一 EXACT 项的处理方式，已写进 commit。
- 该文件还有 `var(--vcb-accent, ...)` 等**画布自有变量**，不在 V3 token 体系内，
  迁色值时要小心不要破坏这些局部变量。

---

## 5. 我的建议：先裁「整体归属」，再裁「逐值」

**理由（数据支撑）**：

- 548 处里，**ΔE > 5 的有 288 处（53%）**，即**过半色值肉眼可辨地不同于任何 V3 token**；
- 这批文件的**整体色相偏冷**（VPW 大量 H216–240 冷灰、H250–265 紫灰），
  而 V3 中性阶锚定 **H27–36 暖灰** —— 这不是「个别值没对齐」，是**两套体系**。

**所以我请求你先答一个问题**（比逐条裁定 319 值更高效）：

> **VideoStudio 这三个文件，是否要接入 V3 的暖米体系？**

- **若「要」**：那这不是「迁 token」，而是**视觉重做**（冷→暖），应由设计出整体方案，
  我的角色是执行，不是逐值拍板。
- **若「不要」**（保留其冷调独立语言）：那应当**为它定义一套模块级 token**
  （如 `--vs-bg-1`/`--vs-ink-2`），把 548 处收敛进去 —— 这同样能达成「消除硬编码」的目标，
  **且不破坏观感**（符合 D15 精神）。
- **若「部分要」**：请指出哪些族（如仅语义色 `#93392E`/`#177A45` 对齐，中性阶保留）。

**我倾向第二条**（定义模块级 token）：它既解决硬编码，又不强迫改观感，
且与你刚立的 D15「不许改观感」完全一致。

---

## 6. 本轮已做的（不改动其余）

| commit | 内容 | 验证 |
|---|---|---|
| `b9a4833e` | **D15 EXACT 迁移 1 处** —— `VideoCanvasWorkbench.css:626` 的 `var(--text-faint, #B0AAA5)` → `var(--text-faint, var(--sb-neutral-400))` | build ✅ / ratchet 无新增 / pass 9 fail 0 |

其余 **547 处一律未动**，等你的裁定。

---

## 7. 全量裁定表（319 行）

> 文件缩写：VPW = `VideoProjectWorkbench.css`，VCW = `VideoCanvasWorkbench.css`，DW = `DirectorWorkbench.css`
> **「最近 token」仅为 ΔE 数值参考，语义正确性见 §3。**

| 色值 | 次数 | 文件 | 语义角色 | 处置 | 目标 token / 理由 |
|---|---|---|---|---|---|
| `#938C84` | 13 | VCW | 边框/分隔 | NEAR | 最近 `--sb-neutral-500`（ΔE 3.9）-> 待裁 |
| `#3D3732` | 12 | VCW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 1.5）-> 待裁 |
| `#8A8197` | 9 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 16.1）-> 待裁 |
| `#403950` | 9 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-700`（ΔE 17.1）-> 待裁 |
| `#93392E` | 8 | VCW | 底色+文字 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 23.5）-> 待裁 |
| `#938A9E` | 7 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 13.9）-> 待裁 |
| `#7562D0` | 6 | VPW | 文字 | NEAR | 最近 `--sb-brand-400`（ΔE 16.5）-> 待裁 |
| `#413A34` | 6 | VPW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 2.4）-> 待裁 |
| `#B24D42` | 5 | VPW | 文字 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 17.1）-> 待裁 |
| `#8A6C38` | 5 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 30.2）-> 待裁 |
| `#BFD8CA` | 5 | VCW | 底色+文字 | NEAR | 最近 `--sb-success-border`（ΔE 6.6）-> 待裁 |
| `#177A45` | 5 | DW | 底色+文字 | NEAR | 最近 `--sb-ink-success`（ΔE 4.1）-> 待裁 |
| `#3F49B8` | 5 | DW | 底色+文字 | NEAR | 最近 `--sb-brand-900`（ΔE 19.5）-> 待裁 |
| `#CDE7D8` | 4 | VPW | 底色+文字 | NEAR | 最近 `--sb-success-border`（ΔE 5.7）-> 待裁 |
| `#ECD2CC` | 4 | VPW | 底色+文字 | NEAR | 最近 `--sb-danger-border`（ΔE 7.6）-> 待裁 |
| `#FFF8F6` | 4 | VPW | 底色+文字 | NEAR | 最近 `--sb-neutral-25`（ΔE 2.1）-> 待裁 |
| `#E5DEF8` | 4 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-100`（ΔE 4.6）-> 待裁 |
| `#6F837C` | 4 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 13.5）-> 待裁 |
| `#FBF9FF` | 4 | VPW, VCW | 底色+文字 | NEAR | 最近 `--sb-info-soft`（ΔE 3.3）-> 待裁 |
| `#777068` | 4 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 4.8）-> 待裁 |
| `#9A86E4` | 4 | VPW | 未定 | NEAR | 最近 `--sb-brand-400`（ΔE 9.8）-> 待裁 |
| `#6B5CC4` | 4 | VPW | 底色+文字 | NEAR | 最近 `--sb-info-hover`（ΔE 18.6）-> 待裁 |
| `#F4F2F6` | 4 | VCW | 禁用 | NEAR | 最近 `--sb-info-soft`（ΔE 3.3）-> 待裁 |
| `#FCFCFE` | 4 | VCW, DW | 边框/分隔 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 1.4）-> 待裁 |
| `#ECEAFA` | 4 | VCW | 禁用 | NEAR | 最近 `--sb-brand-100`（ΔE 2.7）-> 待裁 |
| `#9AA0AB` | 4 | DW | 底色+文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 10.2）-> 待裁 |
| `#5B64D8` | 4 | DW | 底色+文字 | NEAR | 最近 `--sb-brand-400`（ΔE 19.9）-> 待裁 |
| `#FAFBFD` | 4 | DW | 边框/分隔 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 1.8）-> 待裁 |
| `#767B87` | 4 | DW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 13.7）-> 待裁 |
| `#FBFAF8` | 3 | VPW | 底色 | NEAR | 最近 `--sb-neutral-25`（ΔE 1.1）-> 待裁 |
| `#E9E5DF` | 3 | VPW | 底色 | NEAR | 最近 `--sb-neutral-200`（ΔE 0.7）-> 待裁 |
| `#D8D1CA` | 3 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 0.9）-> 待裁 |
| `#B9ADF1` | 3 | VPW | 未定 | NEAR | 最近 `--sb-brand-300/--sb-brand-border`（ΔE 3.9）-> 待裁 |
| `#FAF8FF` | 3 | VPW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 2.9）-> 待裁 |
| `#948AA5` | 3 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 17.7）-> 待裁 |
| `#C7E6D5` | 3 | VPW | 底色+文字 | NEAR | 最近 `--sb-success-border`（ΔE 4.0）-> 待裁 |
| `#9B4D43` | 3 | VPW | 未定 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 28.3）-> 待裁 |
| `#FFFAF0` | 3 | VPW, DW | 底色 | NEAR | 最近 `--sb-warning-soft`（ΔE 1.4）-> 待裁 |
| `#DED9D2` | 3 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 2.9）-> 待裁 |
| `#E7E1F5` | 3 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-100`（ΔE 2.8）-> 待裁 |
| `#F9F6F2` | 3 | VPW | 未定 | NEAR | 最近 `--sb-neutral-50`（ΔE 0.6）-> 待裁 |
| `#E7F7EE` | 3 | VPW, DW | 底色+文字 | NEAR | 最近 `--sb-success-soft`（ΔE 2.9）-> 待裁 |
| `#6D4AFF` | 3 | VCW | 底色+文字 | NEAR | 最近 `--sb-brand-600`（ΔE 7.9）-> 待裁 |
| `#4D4741` | 3 | VCW | 边框/分隔 | NEAR | 最近 `--sb-neutral-700`（ΔE 6.9）-> 待裁 |
| `#23262F` | 3 | DW | 底色+文字 | NEAR | 最近 `--sb-neutral-800`（ΔE 11.3）-> 待裁 |
| `#E0E2E9` | 3 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 6.3）-> 待裁 |
| `#8B909C` | 3 | DW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 10.1）-> 待裁 |
| `#ECEEF3` | 3 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 3.0）-> 待裁 |
| `#565B66` | 3 | DW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 11.6）-> 待裁 |
| `#292722` | 2 | VPW | 文字 | NEAR | 最近 `--sb-neutral-800`（ΔE 8.4）-> 待裁 |
| `#6C5ED1` | 2 | VPW | 未定 | NEAR | 最近 `--sb-brand-400`（ΔE 18.9）-> 待裁 |
| `#D7CFF0` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-200`（ΔE 4.4）-> 待裁 |
| `#6655B7` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-info-hover`（ΔE 17.1）-> 待裁 |
| `#7957F5` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-brand-500`（ΔE 4.9）-> 待裁 |
| `#D8EEE3` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-soft`（ΔE 7.0）-> 待裁 |
| `#948A78` | 2 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 9.0）-> 待裁 |
| `#FFF4DC` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-warning-soft`（ΔE 7.3）-> 待裁 |
| `#E6F6EF` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-success-soft`（ΔE 2.9）-> 待裁 |
| `#FFF0ED` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-danger-soft`（ΔE 1.3）-> 待裁 |
| `#FFFAF7` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-25`（ΔE 1.2）-> 待裁 |
| `#B8DFD3` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-border`（ΔE 6.8）-> 待裁 |
| `#EAF7F2` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-soft`（ΔE 1.9）-> 待裁 |
| `#F0ECFF` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-brand-100`（ΔE 1.4）-> 待裁 |
| `#E5F5EF` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-success-soft`（ΔE 3.1）-> 待裁 |
| `#CFC3F3` | 2 | VPW | 底色+文字 | NEAR | 最近 `--sb-brand-200`（ΔE 7.9）-> 待裁 |
| `#6555B7` | 2 | VPW | 文字 | NEAR | 最近 `--sb-info-hover`（ΔE 16.9）-> 待裁 |
| `#DDD7CF` | 2 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 2.2）-> 待裁 |
| `#FAF9F7` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-25`（ΔE 1.3）-> 待裁 |
| `#FFF0DC` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-warning-soft`（ΔE 6.2）-> 待裁 |
| `#EEEAFF` | 2 | VPW | 未定 | NEAR | 最近 `--sb-brand-100`（ΔE 0.4）-> 待裁 |
| `#332F2A` | 2 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 4.5）-> 待裁 |
| `#9A9289` | 2 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 3.0）-> 待裁 |
| `#938A81` | 2 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 4.9）-> 待裁 |
| `#DED8D0` | 2 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 2.6）-> 待裁 |
| `#4A4641` | 2 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 6.2）-> 待裁 |
| `#E3DDD6` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-200`（ΔE 2.2）-> 待裁 |
| `#DED8D1` | 2 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-300`（ΔE 2.7）-> 待裁 |
| `#D0C8C0` | 2 | VPW | 文字 | NEAR | 最近 `--sb-neutral-300`（ΔE 3.2）-> 待裁 |
| `#786D63` | 2 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 5.1）-> 待裁 |
| `#403A35` | 2 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 1.7）-> 待裁 |
| `#6754DB` | 2 | VPW | 文字 | NEAR | 最近 `--sb-brand-500`（ΔE 12.7）-> 待裁 |
| `#DED5FA` | 2 | VPW | 未定 | NEAR | 最近 `--sb-brand-200`（ΔE 1.7）-> 待裁 |
| `#6B50DA` | 2 | VPW | 文字 | NEAR | 最近 `--sb-brand-500`（ΔE 11.0）-> 待裁 |
| `#FAF9FB` | 2 | VCW | 底色 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 2.2）-> 待裁 |
| `#2D2925` | 2 | VCW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 7.1）-> 待裁 |
| `#FDF7E3` | 2 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning-soft`（ΔE 5.1）-> 待裁 |
| `#8A6D1A` | 2 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning-hover`（ΔE 26.0）-> 待裁 |
| `#FDF1EF` | 2 | VCW | 底色+文字 | NEAR | 最近 `--sb-danger-soft`（ΔE 0.3）-> 待裁 |
| `#77716A` | 2 | VCW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 4.9）-> 待裁 |
| `#FCFBFD` | 2 | VCW | 边框/分隔 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 1.7）-> 待裁 |
| `#FBFEFD` | 2 | VCW | 底色+文字 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 1.3）-> 待裁 |
| `#5C554E` | 2 | VCW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 6.7）-> 待裁 |
| `#2F9E6C` | 2 | VCW | 底色+文字 | NEAR | 最近 `--sb-success`（ΔE 10.1）-> 待裁 |
| `#EFECEF` | 2 | VCW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 4.6）-> 待裁 |
| `#FFFDF6` | 2 | VCW | 底色+文字 | NEAR | 最近 `--sb-neutral-25`（ΔE 1.6）-> 待裁 |
| `#E0B7B1` | 2 | VCW | 边框/分隔 | NEAR | 最近 `--sb-danger-border`（ΔE 7.0）-> 待裁 |
| `#F6F4FD` | 2 | VCW | 边框/分隔 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 1.6）-> 待裁 |
| `#E4E6EC` | 2 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 5.1）-> 待裁 |
| `#ECEEF2` | 2 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 3.3）-> 待裁 |
| `#F5F6F9` | 2 | DW | 底色+文字 | NEAR | 最近 `--sb-info-soft`（ΔE 3.3）-> 待裁 |
| `#DFE2E9` | 2 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 6.4）-> 待裁 |
| `#EEF0FF` | 2 | DW | 底色+文字 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 2.4）-> 待裁 |
| `#C3C9F5` | 2 | DW | 底色+文字 | NEAR | 最近 `--sb-brand-200`（ΔE 7.3）-> 待裁 |
| `#E7E9EF` | 2 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 4.1）-> 待裁 |
| `#6D7280` | 2 | DW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 13.0）-> 待裁 |
| `#A86A12` | 2 | DW | 底色+文字 | NEAR | 最近 `--sb-warning-hover`（ΔE 10.1）-> 待裁 |
| `#A04440` | 2 | DW | 底色+文字 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 23.4）-> 待裁 |
| `#C9CDD8` | 2 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-border`（ΔE 10.5）-> 待裁 |
| `#D9E9E1` | 1 | VPW | 未定 | NEAR | 最近 `--sb-success-soft`（ΔE 6.6）-> 待裁 |
| `#356D58` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-success`（ΔE 21.8）-> 待裁 |
| `#EFFAF4` | 1 | VPW | 未定 | NEAR | 最近 `--sb-success-soft`（ΔE 0.9）-> 待裁 |
| `#F8FCFA` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 2.2）-> 待裁 |
| `#2F9B70` | 1 | VPW | 文字 | NEAR | 最近 `--sb-success-hover`（ΔE 11.2）-> 待裁 |
| `#668277` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 16.4）-> 待裁 |
| `#C8E4D5` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-border`（ΔE 5.1）-> 待裁 |
| `#FFF4DD` | 1 | VPW | 未定 | NEAR | 最近 `--sb-warning-soft`（ΔE 6.8）-> 待裁 |
| `#FFFAF1` | 1 | VPW | 未定 | NEAR | 最近 `--sb-warning-soft`（ΔE 1.5）-> 待裁 |
| `#817970` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 8.4）-> 待裁 |
| `#4A3CC4` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-800/--sb-brand-active`（ΔE 12.2）-> 待裁 |
| `#716876` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 11.5）-> 待裁 |
| `#443A70` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-ink-info`（ΔE 19.0）-> 待裁 |
| `#32734D` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-success`（ΔE 10.9）-> 待裁 |
| `#F2FBF5` | 1 | VPW | 未定 | NEAR | 最近 `--sb-success-soft`（ΔE 0.9）-> 待裁 |
| `#B9DEC8` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-border`（ΔE 2.8）-> 待裁 |
| `#23643D` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-ink-success`（ΔE 13.1）-> 待裁 |
| `#F8F6FF` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 1.8）-> 待裁 |
| `#E2D9FB` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-200`（ΔE 3.4）-> 待裁 |
| `#E4DCF8` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-100`（ΔE 5.7）-> 待裁 |
| `#D8CFF2` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-200`（ΔE 3.6）-> 待裁 |
| `#A49BB2` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 15.5）-> 待裁 |
| `#DED6F7` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-200`（ΔE 3.7）-> 待裁 |
| `#E8E0F7` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-100`（ΔE 3.3）-> 待裁 |
| `#A9D9C2` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-border`（ΔE 7.1）-> 待裁 |
| `#625A70` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 16.8）-> 待裁 |
| `#E7D9AE` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-warning-border`（ΔE 4.5）-> 待裁 |
| `#9B7834` | 1 | VPW | 文字 | NEAR | 最近 `--sb-warning-hover`（ΔE 24.9）-> 待裁 |
| `#746A5E` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 5.0）-> 待裁 |
| `#756F7D` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 12.1）-> 待裁 |
| `#F8F5FF` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 1.3）-> 待裁 |
| `#315E52` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 21.3）-> 待裁 |
| `#DDD6F6` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-200`（ΔE 4.2）-> 待裁 |
| `#5043B8` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-900`（ΔE 14.7）-> 待裁 |
| `#4436A7` | 1 | VPW | 底色 | NEAR | 最近 `--sb-brand-900`（ΔE 10.7）-> 待裁 |
| `#51439A` | 1 | VPW | 文字 | NEAR | 最近 `--sb-info-hover`（ΔE 16.8）-> 待裁 |
| `#A096AA` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 13.6）-> 待裁 |
| `#4D445C` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 18.5）-> 待裁 |
| `#EED8C9` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 8.3）-> 待裁 |
| `#54433A` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 9.2）-> 待裁 |
| `#A18170` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 14.7）-> 待裁 |
| `#E9B58F` | 1 | VPW | 未定 | NEAR | 最近 `--sb-warning-border`（ΔE 15.6）-> 待裁 |
| `#9B5D37` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-warning`（ΔE 26.2）-> 待裁 |
| `#D99569` | 1 | VPW | 禁用 | NEAR | 最近 `--sb-warning-hover`（ΔE 25.8）-> 待裁 |
| `#FFF3EB` | 1 | VPW | 禁用 | NEAR | 最近 `--sb-warning-soft`（ΔE 2.2）-> 待裁 |
| `#5D9883` | 1 | VPW | 文字 | NEAR | 最近 `--sb-success-hover`（ΔE 20.9）-> 待裁 |
| `#57524C` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 8.1）-> 待裁 |
| `#AAA39A` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-400`（ΔE 3.5）-> 待裁 |
| `#E5E0D9` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-200`（ΔE 1.2）-> 待裁 |
| `#352E28` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 5.0）-> 待裁 |
| `#F2AD75` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-warning`（ΔE 24.6）-> 待裁 |
| `#593C27` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-700`（ΔE 18.1）-> 待裁 |
| `#FFF8EE` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-warning-soft`（ΔE 0.7）-> 待裁 |
| `#F1C0BA` | 1 | VPW | 未定 | NEAR | 最近 `--sb-danger-border`（ΔE 3.4）-> 待裁 |
| `#8C3933` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 27.9）-> 待裁 |
| `#FFF4F2` | 1 | VPW | 未定 | NEAR | 最近 `--sb-danger-soft`（ΔE 0.7）-> 待裁 |
| `#D8CFF6` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-200`（ΔE 2.5）-> 待裁 |
| `#E8E2F6` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-100`（ΔE 2.5）-> 待裁 |
| `#ED755D` | 1 | VPW | 文字 | NEAR | 最近 `--sb-danger`（ΔE 14.2）-> 待裁 |
| `#928980` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 5.2）-> 待裁 |
| `#7D746A` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 6.9）-> 待裁 |
| `#34312E` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 3.5）-> 待裁 |
| `#9A938A` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-500`（ΔE 2.9）-> 待裁 |
| `#5F5952` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 5.2）-> 待裁 |
| `#E7E2DC` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-200`（ΔE 0.5）-> 待裁 |
| `#94603E` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 29.2）-> 待裁 |
| `#3E65A0` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-ink-info`（ΔE 10.9）-> 待裁 |
| `#EAF1FF` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-info-soft`（ΔE 3.0）-> 待裁 |
| `#DFDAD3` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-200`（ΔE 3.2）-> 待裁 |
| `#D8D2CA` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 0.6）-> 待裁 |
| `#4A443E` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 5.7）-> 待裁 |
| `#DCD5CD` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-300`（ΔE 1.7）-> 待裁 |
| `#928A81` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-500`（ΔE 4.8）-> 待裁 |
| `#E5DFD7` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-200`（ΔE 1.8）-> 待裁 |
| `#F1EFEC` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-100`（ΔE 2.3）-> 待裁 |
| `#8F867D` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 6.1）-> 待裁 |
| `#E6DFD6` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-200`（ΔE 2.3）-> 待裁 |
| `#FFFDFA` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-25`（ΔE 0.9）-> 待裁 |
| `#DDD6CE` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 2.1）-> 待裁 |
| `#5B524B` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 7.9）-> 待裁 |
| `#A04D47` | 1 | VPW | 文字 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 26.9）-> 待裁 |
| `#D8CFC5` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 1.9）-> 待裁 |
| `#F8F6F3` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-50`（ΔE 1.1）-> 待裁 |
| `#E7B8AE` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-danger-border`（ΔE 6.7）-> 待裁 |
| `#FFFAF9` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-neutral-25`（ΔE 1.9）-> 待裁 |
| `#6257BC` | 1 | VPW | 未定 | NEAR | 最近 `--sb-info-hover`（ΔE 16.9）-> 待裁 |
| `#958C83` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-500`（ΔE 4.3）-> 待裁 |
| `#6F6860` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 2.2）-> 待裁 |
| `#F7F5F2` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-50`（ΔE 1.3）-> 待裁 |
| `#E8E3DC` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-200`（ΔE 0.6）-> 待裁 |
| `#989087` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 3.3）-> 待裁 |
| `#E4DFD8` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-200`（ΔE 1.5）-> 待裁 |
| `#4C453E` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 6.4）-> 待裁 |
| `#8A8178` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 7.9）-> 待裁 |
| `#EEEAE4` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-150`（ΔE 1.6）-> 待裁 |
| `#D9D2CA` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 0.9）-> 待裁 |
| `#5D554D` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 6.9）-> 待裁 |
| `#F6F4F1` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-neutral-50`（ΔE 1.5）-> 待裁 |
| `#78B8A8` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-border`（ΔE 20.5）-> 待裁 |
| `#E4F3EE` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-success-soft`（ΔE 3.4）-> 待裁 |
| `#151515` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-800`（ΔE 2.6）-> 待裁 |
| `#8D857B` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-500`（ΔE 6.8）-> 待裁 |
| `#ECE9E4` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-200`（ΔE 2.2）-> 待裁 |
| `#B1A99F` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-400`（ΔE 2.9）-> 待裁 |
| `#7F776E` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 7.7）-> 待裁 |
| `#996B28` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-warning-hover`（ΔE 20.8）-> 待裁 |
| `#23735C` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-ink-success`（ΔE 18.9）-> 待裁 |
| `#D9D3CC` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-300`（ΔE 1.0）-> 待裁 |
| `#4F4943` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 7.7）-> 待裁 |
| `#D8CDFB` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-200`（ΔE 4.5）-> 待裁 |
| `#6253BB` | 1 | VPW | 未定 | NEAR | 最近 `--sb-info-hover`（ΔE 19.3）-> 待裁 |
| `#C6E4D8` | 1 | VPW | 未定 | NEAR | 最近 `--sb-success-border`（ΔE 6.4）-> 待裁 |
| `#2D7B63` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-success`（ΔE 18.3）-> 待裁 |
| `#F3FBF7` | 1 | VPW | 未定 | NEAR | 最近 `--sb-success-soft`（ΔE 1.8）-> 待裁 |
| `#357760` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-success`（ΔE 19.4）-> 待裁 |
| `#275D9B` | 1 | VPW | 文字 | NEAR | 最近 `--sb-ink-info`（ΔE 9.5）-> 待裁 |
| `#4DA483` | 1 | VPW | 文字 | NEAR | 最近 `--sb-success`（ΔE 14.9）-> 待裁 |
| `#4B3D75` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-ink-info`（ΔE 18.3）-> 待裁 |
| `#8B81A5` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 23.6）-> 待裁 |
| `#382F55` | 1 | VPW | 底色 | NEAR | 最近 `--sb-neutral-700`（ΔE 27.4）-> 待裁 |
| `#38342F` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 2.4）-> 待裁 |
| `#F9F7F4` | 1 | VPW | 底色 | NEAR | 最近 `--sb-neutral-50`（ΔE 1.1）-> 待裁 |
| `#2E2D2C` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-700`（ΔE 5.9）-> 待裁 |
| `#5A5149` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 8.5）-> 待裁 |
| `#F5C27E` | 1 | VPW | 未定 | NEAR | 最近 `--sb-warning-border`（ΔE 20.1）-> 待裁 |
| `#D5E6DF` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-200`（ΔE 7.5）-> 待裁 |
| `#F0F8F5` | 1 | VPW | 未定 | NEAR | 最近 `--sb-success-soft`（ΔE 2.1）-> 待裁 |
| `#F7F3FF` | 1 | VPW | 底色 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 0.7）-> 待裁 |
| `#ECE6FF` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-100`（ΔE 2.4）-> 待裁 |
| `#B8A7F4` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-300/--sb-brand-border`（ΔE 5.8）-> 待裁 |
| `#5D42C6` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-800/--sb-brand-active`（ΔE 13.6）-> 待裁 |
| `#665D78` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 19.4）-> 待裁 |
| `#C9BDF5` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-300/--sb-brand-border`（ΔE 9.1）-> 待裁 |
| `#6047C9` | 1 | VPW | 未定 | NEAR | 最近 `--sb-brand-800/--sb-brand-active`（ΔE 15.8）-> 待裁 |
| `#8B73E5` | 1 | VPW | 边框/分隔 | NEAR | 最近 `--sb-brand-400`（ΔE 9.7）-> 待裁 |
| `#E2B6B6` | 1 | VPW | 未定 | NEAR | 最近 `--sb-danger-border`（ΔE 7.3）-> 待裁 |
| `#B84C4C` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 17.4）-> 待裁 |
| `#FFF8F8` | 1 | VPW | 未定 | NEAR | 最近 `--sb-danger-soft`（ΔE 2.7）-> 待裁 |
| `#F5FBFF` | 1 | VPW | 底色 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 3.4）-> 待裁 |
| `#3B6FD8` | 1 | VPW | 未定 | NEAR | 最近 `--sb-info`（ΔE 11.1）-> 待裁 |
| `#6B7D94` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 20.2）-> 待裁 |
| `#CFE0F5` | 1 | VPW | 未定 | NEAR | 最近 `--sb-info-border`（ΔE 7.3）-> 待裁 |
| `#37608F` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-info`（ΔE 17.8）-> 待裁 |
| `#6D829A` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 20.2）-> 待裁 |
| `#DBE3EF` | 1 | VPW | 未定 | NEAR | 最近 `--sb-info-soft`（ΔE 6.5）-> 待裁 |
| `#40536C` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-600`（ΔE 22.1）-> 待裁 |
| `#23334A` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-700`（ΔE 19.2）-> 待裁 |
| `#718198` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 19.1）-> 待裁 |
| `#7553BF` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-brand-900`（ΔE 21.0）-> 待裁 |
| `#F0EAFF` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-brand-100`（ΔE 0.9）-> 待裁 |
| `#1669A9` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-ink-info`（ΔE 12.9）-> 待裁 |
| `#E3F2FF` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-info-soft`（ΔE 4.4）-> 待裁 |
| `#A64A36` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 19.9）-> 待裁 |
| `#2B7C59` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-ink-success`（ΔE 11.6）-> 待裁 |
| `#6E7784` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-neutral-600`（ΔE 13.7）-> 待裁 |
| `#EDF0F4` | 1 | VPW | 底色+文字 | NEAR | 最近 `--sb-info-soft`（ΔE 3.0）-> 待裁 |
| `#CAD8EA` | 1 | VPW | 未定 | NEAR | 最近 `--sb-info-border`（ΔE 6.9）-> 待裁 |
| `#3166AD` | 1 | VPW | 未定 | NEAR | 最近 `--sb-ink-info`（ΔE 6.6）-> 待裁 |
| `#F8FAFC` | 1 | VPW | 未定 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 2.2）-> 待裁 |
| `#8A7F6F` | 1 | VPW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 10.8）-> 待裁 |
| `#B9A44C` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning`（ΔE 31.6）-> 待裁 |
| `#D9CBA2` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning-border`（ΔE 7.3）-> 待裁 |
| `#FDF8EA` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning-soft`（ΔE 2.2）-> 待裁 |
| `#7A6420` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning-hover`（ΔE 32.5）-> 待裁 |
| `#ECC9C4` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-danger-border`（ΔE 4.0）-> 待裁 |
| `#F3EFFF` | 1 | VCW | 边框/分隔 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 2.5）-> 待裁 |
| `#EEF4FF` | 1 | VCW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 1.2）-> 待裁 |
| `#CDC7EF` | 1 | VCW | 禁用 | NEAR | 最近 `--sb-brand-200`（ΔE 5.4）-> 待裁 |
| `#7D74C9` | 1 | VCW | 禁用 | NEAR | 最近 `--sb-info`（ΔE 11.6）-> 待裁 |
| `#F5F3F7` | 1 | VCW | 未定 | NEAR | 最近 `--sb-info-soft`（ΔE 3.3）-> 待裁 |
| `#8F86F2` | 1 | VCW | SVG 描边/填充 | NEAR | 最近 `--sb-brand-400`（ΔE 6.6）-> 待裁 |
| `#B7AFA6` | 1 | VCW | SVG 描边/填充 | NEAR | 最近 `--sb-neutral-400`（ΔE 3.0）-> 待裁 |
| `#D07A2F` | 1 | VCW | SVG 描边/填充 | NEAR | 最近 `--sb-warning-hover`（ΔE 5.1）-> 待裁 |
| `#6B645C` | 1 | VCW | SVG 描边/填充 | NEAR | 最近 `--sb-neutral-600`（ΔE 1.9）-> 待裁 |
| `#CDBF94` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-warning-border`（ΔE 11.1）-> 待裁 |
| `#F4FAF6` | 1 | VCW | 边框/分隔 | NEAR | 最近 `--sb-success-soft`（ΔE 2.0）-> 待裁 |
| `#DFF1E7` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-success-soft`（ΔE 5.0）-> 待裁 |
| `#F7F6FA` | 1 | VCW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 3.2）-> 待裁 |
| `#55504A` | 1 | VCW | 边框/分隔 | NEAR | 最近 `--sb-neutral-600`（ΔE 8.9）-> 待裁 |
| `#FBFAFF` | 1 | VCW | 边框/分隔 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 3.0）-> 待裁 |
| `#ECE6FB` | 1 | VCW | 禁用 | NEAR | 最近 `--sb-brand-100`（ΔE 1.1）-> 待裁 |
| `#F6F4F6` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-neutral-50`（ΔE 3.7）-> 待裁 |
| `#E9E1D7` | 1 | VCW | 底色+文字 | NEAR | 最近 `--sb-neutral-200`（ΔE 2.6）-> 待裁 |
| `#7568E0` | 1 | VCW | 底色 | NEAR | 最近 `--sb-brand-400`（ΔE 16.0）-> 待裁 |
| `#B0AAA5` | 1 | VCW | 禁用 | EXACT | **逐值相等** -> `--sb-neutral-400` |
| `#4353C6` | 1 | DW | 底色+文字 | NEAR | 最近 `--sb-info-hover`（ΔE 22.1）-> 待裁 |
| `#8A8F9C` | 1 | DW | 文字 | NEAR | 最近 `--sb-neutral-500`（ΔE 10.7）-> 待裁 |
| `#D8DBE3` | 1 | DW | 边框/分隔 | NEAR | 最近 `--sb-neutral-200`（ΔE 8.2）-> 待裁 |
| `#A0A4AF` | 1 | DW | 文字 | NEAR | 最近 `--sb-neutral-400`（ΔE 9.9）-> 待裁 |
| `#B3B7C1` | 1 | DW | 文字 | NEAR | 最近 `--sb-neutral-400`（ΔE 9.9）-> 待裁 |
| `#F0F1F5` | 1 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 2.9）-> 待裁 |
| `#FFF4E0` | 1 | DW | 底色+文字 | NEAR | 最近 `--sb-warning-soft`（ΔE 5.4）-> 待裁 |
| `#F4F7FF` | 1 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 1.3）-> 待裁 |
| `#55618E` | 1 | DW | 底色 | NEAR | 最近 `--sb-ink-info`（ΔE 18.1）-> 待裁 |
| `#E2E4EA` | 1 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 5.8）-> 待裁 |
| `#B3403A` | 1 | DW | 文字 | NEAR | 最近 `--sb-ink-danger/--sb-danger-hover`（ΔE 12.2）-> 待裁 |
| `#F4F6FF` | 1 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 1.1）-> 待裁 |
| `#F0E2C0` | 1 | DW | 底色 | NEAR | 最近 `--sb-warning-border`（ΔE 6.4）-> 待裁 |
| `#F2F3FA` | 1 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 1.4）-> 待裁 |
| `#E8EAF1` | 1 | DW | 边框/分隔 | NEAR | 最近 `--sb-info-soft`（ΔE 3.6）-> 待裁 |
| `#DFE3F2` | 1 | DW | 边框/分隔 | NEAR | 最近 `--sb-brand-100`（ΔE 5.1）-> 待裁 |
| `#FBFCFF` | 1 | DW | 边框/分隔 | NEAR | 最近 `--sb-neutral-0/--sb-surface-panel-solid/--sb-surface-card/--sb-ink-on-dark/--sb-brand-ink`（ΔE 1.9）-> 待裁 |
| `#EFE3C2` | 1 | DW | 未定 | NEAR | 最近 `--sb-warning-border`（ΔE 7.4）-> 待裁 |
| `#FFFBEF` | 1 | DW | 未定 | NEAR | 最近 `--sb-warning-soft`（ΔE 2.1）-> 待裁 |
| `#EEF0F5` | 1 | DW | 底色 | NEAR | 最近 `--sb-info-soft`（ΔE 2.5）-> 待裁 |
| `#E8F6EE` | 1 | DW | 底色+文字 | NEAR | 最近 `--sb-success-soft`（ΔE 2.3）-> 待裁 |
| `#BFE3CD` | 1 | DW | 底色+文字 | NEAR | 最近 `--sb-success-border`（ΔE 1.7）-> 待裁 |
| `#EEF1FF` | 1 | DW | 底色 | NEAR | 最近 `--sb-brand-50/--sb-brand-soft`（ΔE 2.2）-> 待裁 |
| `#CDD4F5` | 1 | DW | 底色 | NEAR | 最近 `--sb-info-border`（ΔE 3.5）-> 待裁 |
| `#FDEEEE` | 1 | DW | 底色+文字 | NEAR | 最近 `--sb-danger-soft`（ΔE 1.9）-> 待裁 |
| `#F0C8C5` | 1 | DW | 底色+文字 | NEAR | 最近 `--sb-danger-border`（ΔE 2.4）-> 待裁 |