# 37 · A 族（语义色）映射表 —— 待你核

> **范围**：`VideoProjectWorkbench.css` / `VideoCanvasWorkbench.css` / `DirectorWorkbench.css`
> 三文件里**语义色族**（红/橙/绿/青，排除紫= D 族、排除中性= C 族）。
>
> **依据 D10**：文字用 `--sb-ink-*`，填充用本色（`--sb-danger/-success/-warning/-info`），
> 浅底用 `-soft`，描边用 `-border`。**按「L 明度」判角色，且成对映射不许压单档。**
>
> **判定顺序**（按你升级的规则）：先定语义角色 → 再找该角色 token → 最后用 ΔE 核验。

---

## 1. 总量与判定分布

| 判定 | 值数 | 处数 | 含义 |
|---|---|---|---|
| **ΔE < 8 可迁** | **59** | **98** | 阈值内，建议直接做 |
| ΔE 8–15 待核 | 8 | 9 | 边界，请你核 |
| ΔE ≥ 15 待裁 | 33 | 53 | 明显偏离，需你定（多为深色文字档）|
| 合计 | 100 | 160 | |

## 2. ⚠️ 先说三个**结构性观察**（比逐值更重要）

### 2.1 「深色文字」这一档 V3 **只有一支**，但这批文件有 **20+ 个深色变体**

| 族 | V3 现有 ink 档 | 文件里的深色变体（示例） | ΔE 范围 |
|---|---|---|---|
| danger | `--sb-ink-danger` = **#D0443C**（L47）| `#93392E`(L38) `#B24D42`(L48) `#9B4D43` `#A04440` `#8C3933` `#A64A36` … | **17–28** |
| warning | `--sb-ink-warning` = **#B45309**（L45）| `#8A6C38`(L38) `#8A6D1A`(L32) `#593C27`(L25) `#7A6420`(L30) `#996B28` … | **17–48** |
| success | `--sb-ink-success` = **#2F7D46**（L44）| `#177A45`(L28) `#23643D`(L26) `#2B7C59` `#23735C` `#32734D` … | 4–30 |

**问题**：这些深色变体**不是「没对齐」，而是它们自成一组更深的文字档**
（L25–48），而 V3 的 ink 档只有 L44–47 一支。

**这就是你说的「成对映射，不许压成单档」要解决的场景** ——
但**成对映射需要 V3 提供第二档**，而目前**没有**。

**→ 我需要你先裁一件事**：
- **(a)** 全部压到现有单档（`--sb-ink-danger` 等）—— ΔE 最大 48，**观感会明显变浅**；
- **(b)** 新增「深色文字档」（如 `--sb-ink-danger-strong` / `--sb-ink-warning-strong`），再成对映射；
- **(c)** 这些深色**不是文字而是别的东西**，我判错了（请指出）。

**我倾向 (b)**，但这直接关系「是否新增 token」，按你的规矩必须由你拍。

### 2.2 `#8A6C38` 的 ΔE 36.9 不是「颜色差得远」，是**语义判错的风险**

`#8A6C38`（H38 S42 L38）是**暗琥珀**，被算法配到 `--sb-ink-warning #B45309`（H34 S91 L37）。
两者 **L 几乎相同（38 vs 37）**，但**饱和度差一倍**（42 vs 91）—— 迁过去会**明显变艳**。

**这正是你升级的那条规则要防的情况**，我按「先定语义角色」判定为 warning-ink，但**饱和度差异需你确认可接受**。

### 2.3 浅底族（ΔE < 8 那 59 值里的大头）非常干净，建议直接做

例：`#FFFAF0`(ΔE 1.4)、`#FDF1EF`(0.3)、`#EAF7F2`(1.9)、`#FFF0ED`(1.3)、`#C7E6D5`(4.0) …
**这些几乎恒等**，且角色清晰（soft / border），无争议。

## 3. 建议的执行切分

| 组 | 内容 | 值数/处数 | 建议 |
|---|---|---|---|
| **A1 浅底 + 描边** | ΔE<8 的 soft / border 项 | ~45 值 / ~75 处 | **可直接做**（阈值内，观感几乎不变）|
| **A2 浅底 + 描边边界项** | ΔE 8–15 | 8 值 / 9 处 | 请你核 |
| **A3 深色文字** | 全部 ink 项 | ~47 值 / ~76 处 | **等你答 §2.1 的 (a)/(b)/(c)** |

## 4. 全表（100 行）

> `ΔE<8` = 可迁；`8–15` = 待核；`≥15` = 待裁。

| 旧值 | 次数 | H/S/L | 语义族 | 角色(D10) | 目标 token | ΔE | 判定 |
|---|---|---|---|---|---|---|---|
| `#93392E` | 8 | 7/52/38 | danger | ink | `--sb-ink-danger` | 23.5 | 待裁 |
| `#177A45` | 5 | 148/68/28 | success | ink | `--sb-ink-success` | 4.1 | 可迁 |
| `#8A6C38` | 5 | 38/42/38 | warning | ink | `--sb-ink-warning` | 36.9 | 待裁 |
| `#B24D42` | 5 | 6/46/48 | danger | ink | `--sb-ink-danger` | 17.1 | 待裁 |
| `#BFD8CA` | 5 | 146/24/80 | success | border | `--sb-success-border` | 6.6 | 可迁 |
| `#CDE7D8` | 4 | 145/35/85 | success | border | `--sb-success-border` | 5.7 | 可迁 |
| `#ECD2CC` | 4 | 11/46/86 | danger | border | `--sb-danger-border` | 7.6 | 可迁 |
| `#FFF8F6` | 4 | 13/100/98 | danger | soft | `--sb-danger-soft` | 2.5 | 可迁 |
| `#9B4D43` | 3 | 7/40/44 | danger | ink | `--sb-ink-danger` | 28.3 | 待裁 |
| `#C7E6D5` | 3 | 147/38/84 | success | border | `--sb-success-border` | 4.0 | 可迁 |
| `#E7F7EE` | 3 | 146/50/94 | success | soft | `--sb-success-soft` | 2.9 | 可迁 |
| `#F9F6F2` | 3 | 34/37/96 | warning | soft | `--sb-warning-soft` | 3.4 | 可迁 |
| `#FFFAF0` | 3 | 40/100/97 | warning | soft | `--sb-warning-soft` | 1.4 | 可迁 |
| `#2F9E6C` | 2 | 153/54/40 | success | ink | `--sb-ink-success` | 14.3 | 待核 |
| `#8A6D1A` | 2 | 44/68/32 | warning | ink | `--sb-ink-warning` | 33.5 | 待裁 |
| `#A04440` | 2 | 3/43/44 | danger | ink | `--sb-ink-danger` | 23.4 | 待裁 |
| `#A86A12` | 2 | 35/81/36 | warning | ink | `--sb-ink-warning` | 17.8 | 待裁 |
| `#B8DFD3` | 2 | 162/38/80 | success | border | `--sb-success-border` | 6.8 | 可迁 |
| `#D8EEE3` | 2 | 150/39/89 | success | soft | `--sb-success-soft` | 7.0 | 可迁 |
| `#E0B7B1` | 2 | 8/43/79 | danger | border | `--sb-danger-border` | 7.0 | 可迁 |
| `#E5F5EF` | 2 | 157/44/93 | success | soft | `--sb-success-soft` | 3.1 | 可迁 |
| `#E6F6EF` | 2 | 154/47/93 | success | soft | `--sb-success-soft` | 2.9 | 可迁 |
| `#EAF7F2` | 2 | 157/45/94 | success | soft | `--sb-success-soft` | 1.9 | 可迁 |
| `#FBFEFD` | 2 | 160/60/99 | success | soft | `--sb-success-soft` | 4.4 | 可迁 |
| `#FDF1EF` | 2 | 9/78/96 | danger | soft | `--sb-danger-soft` | 0.3 | 可迁 |
| `#FDF7E3` | 2 | 46/87/94 | warning | soft | `--sb-warning-soft` | 5.1 | 可迁 |
| `#FFF0DC` | 2 | 34/100/93 | warning | soft | `--sb-warning-soft` | 6.2 | 可迁 |
| `#FFF0ED` | 2 | 10/100/96 | danger | soft | `--sb-danger-soft` | 1.3 | 可迁 |
| `#FFF4DC` | 2 | 41/100/93 | warning | soft | `--sb-warning-soft` | 7.3 | 可迁 |
| `#FFFAF7` | 2 | 22/100/98 | warning | soft | `--sb-warning-soft` | 3.9 | 可迁 |
| `#FFFDF6` | 2 | 47/100/98 | warning | soft | `--sb-warning-soft` | 3.2 | 可迁 |
| `#23643D` | 1 | 144/48/26 | success | ink | `--sb-ink-success` | 13.1 | 待核 |
| `#23735C` | 1 | 163/53/29 | success | ink | `--sb-ink-success` | 18.9 | 待裁 |
| `#2B7C59` | 1 | 154/49/33 | success | ink | `--sb-ink-success` | 11.6 | 待核 |
| `#2D7B63` | 1 | 162/46/33 | success | ink | `--sb-ink-success` | 18.3 | 待裁 |
| `#2F9B70` | 1 | 156/53/40 | success | ink | `--sb-ink-success` | 14.6 | 待核 |
| `#315E52` | 1 | 164/31/28 | success | ink | `--sb-ink-success` | 29.5 | 待裁 |
| `#32734D` | 1 | 145/39/32 | success | ink | `--sb-ink-success` | 10.9 | 待核 |
| `#356D58` | 1 | 158/35/32 | success | ink | `--sb-ink-success` | 21.8 | 待裁 |
| `#357760` | 1 | 159/38/34 | success | ink | `--sb-ink-success` | 19.4 | 待裁 |
| `#4DA483` | 1 | 157/36/47 | success | ink | `--sb-ink-success` | 20.4 | 待裁 |
| `#593C27` | 1 | 25/39/25 | warning | ink | `--sb-ink-warning` | 48.2 | 待裁 |
| `#5D9883` | 1 | 159/24/48 | success | ink | `--sb-ink-success` | 25.0 | 待裁 |
| `#78B8A8` | 1 | 165/31/60 | success | ink | `--sb-ink-success` | 34.4 | 待裁 |
| `#7A6420` | 1 | 45/58/30 | warning | ink | `--sb-ink-warning` | 37.8 | 待裁 |
| `#8C3933` | 1 | 4/47/37 | danger | ink | `--sb-ink-danger` | 27.9 | 待裁 |
| `#94603E` | 1 | 24/41/41 | warning | ink | `--sb-ink-warning` | 32.1 | 待裁 |
| `#996B28` | 1 | 36/59/38 | warning | ink | `--sb-ink-warning` | 26.5 | 待裁 |
| `#9B5D37` | 1 | 23/48/41 | warning | ink | `--sb-ink-warning` | 26.2 | 待裁 |
| `#9B7834` | 1 | 40/50/41 | warning | ink | `--sb-ink-warning` | 32.9 | 待裁 |
| `#A04D47` | 1 | 4/39/45 | danger | ink | `--sb-ink-danger` | 26.9 | 待裁 |
| `#A64A36` | 1 | 11/51/43 | danger | ink | `--sb-ink-danger` | 19.9 | 待裁 |
| `#A9D9C2` | 1 | 151/39/76 | success | border | `--sb-success-border` | 7.1 | 可迁 |
| `#B3403A` | 1 | 3/51/46 | danger | ink | `--sb-ink-danger` | 12.2 | 待核 |
| `#B84C4C` | 1 | 0/43/51 | danger | ink | `--sb-ink-danger` | 17.4 | 待裁 |
| `#B9A44C` | 1 | 48/44/51 | warning | ink | `--sb-ink-warning` | 44.8 | 待裁 |
| `#B9DEC8` | 1 | 144/36/80 | success | border | `--sb-success-border` | 2.8 | 可迁 |
| `#BFE3CD` | 1 | 143/39/82 | success | border | `--sb-success-border` | 1.7 | 可迁 |
| `#C6E4D8` | 1 | 156/36/84 | success | border | `--sb-success-border` | 6.4 | 可迁 |
| `#C8E4D5` | 1 | 148/34/84 | success | border | `--sb-success-border` | 5.1 | 可迁 |
| `#CDBF94` | 1 | 45/36/69 | warning | ink | `--sb-ink-warning` | 57.4 | 待裁 |
| `#D07A2F` | 1 | 28/63/50 | warning | ink | `--sb-ink-warning` | 15.0 | 待裁 |
| `#D5E6DF` | 1 | 155/25/87 | success | border | `--sb-success-border` | 10.8 | 待核 |
| `#D99569` | 1 | 24/60/63 | warning | ink | `--sb-ink-warning` | 32.9 | 待裁 |
| `#D9CBA2` | 1 | 45/42/74 | warning | border | `--sb-warning-border` | 7.3 | 可迁 |
| `#D9E9E1` | 1 | 150/27/88 | success | soft | `--sb-success-soft` | 6.6 | 可迁 |
| `#DFF1E7` | 1 | 147/39/91 | success | soft | `--sb-success-soft` | 5.0 | 可迁 |
| `#E2B6B6` | 1 | 0/43/80 | danger | border | `--sb-danger-border` | 7.3 | 可迁 |
| `#E4F3EE` | 1 | 160/38/92 | success | soft | `--sb-success-soft` | 3.4 | 可迁 |
| `#E7B8AE` | 1 | 11/54/79 | danger | border | `--sb-danger-border` | 6.7 | 可迁 |
| `#E7D9AE` | 1 | 45/54/79 | warning | border | `--sb-warning-border` | 4.5 | 可迁 |
| `#E8F6EE` | 1 | 146/44/94 | success | soft | `--sb-success-soft` | 2.3 | 可迁 |
| `#E9B58F` | 1 | 25/67/74 | warning | border | `--sb-warning-border` | 15.6 | 待裁 |
| `#ECC9C4` | 1 | 7/51/85 | danger | border | `--sb-danger-border` | 4.0 | 可迁 |
| `#ED755D` | 1 | 10/80/65 | danger | ink | `--sb-ink-danger` | 17.0 | 待裁 |
| `#EED8C9` | 1 | 24/52/86 | warning | border | `--sb-warning-border` | 13.5 | 待核 |
| `#EFE3C2` | 1 | 44/58/85 | warning | border | `--sb-warning-border` | 7.4 | 可迁 |
| `#EFFAF4` | 1 | 147/52/96 | success | soft | `--sb-success-soft` | 0.9 | 可迁 |
| `#F0C8C5` | 1 | 4/59/86 | danger | border | `--sb-danger-border` | 2.4 | 可迁 |
| `#F0E2C0` | 1 | 42/62/85 | warning | border | `--sb-warning-border` | 6.4 | 可迁 |
| `#F0F8F5` | 1 | 158/36/96 | success | soft | `--sb-success-soft` | 2.1 | 可迁 |
| `#F1C0BA` | 1 | 7/66/84 | danger | border | `--sb-danger-border` | 3.4 | 可迁 |
| `#F2AD75` | 1 | 27/83/70 | warning | border | `--sb-warning-border` | 25.4 | 待裁 |
| `#F2FBF5` | 1 | 140/53/97 | success | soft | `--sb-success-soft` | 0.9 | 可迁 |
| `#F3FBF7` | 1 | 150/50/97 | success | soft | `--sb-success-soft` | 1.8 | 可迁 |
| `#F4FAF6` | 1 | 140/37/97 | success | soft | `--sb-success-soft` | 2.0 | 可迁 |
| `#F5C27E` | 1 | 34/86/73 | warning | border | `--sb-warning-border` | 20.1 | 待裁 |
| `#F8FCFA` | 1 | 150/40/98 | success | soft | `--sb-success-soft` | 3.5 | 可迁 |
| `#FDEEEE` | 1 | 0/79/96 | danger | soft | `--sb-danger-soft` | 1.9 | 可迁 |
| `#FDF8EA` | 1 | 44/83/95 | warning | soft | `--sb-warning-soft` | 2.2 | 可迁 |
| `#FFF3EB` | 1 | 24/100/96 | warning | soft | `--sb-warning-soft` | 2.2 | 可迁 |
| `#FFF4DD` | 1 | 41/100/93 | warning | soft | `--sb-warning-soft` | 6.8 | 可迁 |
| `#FFF4E0` | 1 | 39/100/94 | warning | soft | `--sb-warning-soft` | 5.4 | 可迁 |
| `#FFF4F2` | 1 | 9/100/97 | danger | soft | `--sb-danger-soft` | 0.7 | 可迁 |
| `#FFF8EE` | 1 | 35/100/97 | warning | soft | `--sb-warning-soft` | 0.7 | 可迁 |
| `#FFF8F8` | 1 | 0/100/99 | danger | soft | `--sb-danger-soft` | 2.7 | 可迁 |
| `#FFFAF1` | 1 | 39/100/97 | warning | soft | `--sb-warning-soft` | 1.5 | 可迁 |
| `#FFFAF9` | 1 | 10/100/99 | danger | soft | `--sb-danger-soft` | 3.4 | 可迁 |
| `#FFFBEF` | 1 | 45/100/97 | warning | soft | `--sb-warning-soft` | 2.1 | 可迁 |
| `#FFFDFA` | 1 | 36/100/99 | warning | soft | `--sb-warning-soft` | 4.6 | 可迁 |