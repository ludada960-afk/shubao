# 61 · 知渔 /ai-video「代为撰写」实测 + 右侧「教学示例 / 作品示例」

> **出处更正**：用户批注（58 · image.png #1）反复点名的「代为撰写」，**不是 flova.tv 的**，是 **知渔（laoyu.quantv.com）视频创作页 `/ai-video`** 的。
> 本轮在 **未登录态**实测确认：该页**公开可达**，「代为撰写」按钮**真实存在于页面**，但**点击后功能被登录墙挡住**。
> 实测 URL：`https://laoyu.quantv.com/ai-video`；视口 2048×1026（deviceScaleFactor 1.25，CSS 宽 1638.4px）；未登录。
> 工具：仓库 `.tmp/shot.mjs`（CDP 代理 `http://localhost:3456`）。**全程只读，未注册、未付费、未点「立即生成视频」。**

---

## 0. 一句话结论

| 问题 | 结论 |
|---|---|
| 在哪 | 脚本输入框**左下角「占位文案行」**里；**另一处在输入框右下方工具条**（有内容时才出现） |
| 是什么 | 一个**纯文字按钮**，不是胶囊、不是图标按钮；主入口原文带方括号 `[代为撰写]` |
| 点击后 | **空输入 → 只弹一个 toast**「请先上传参考元素或简单描述脚本。」；**有输入 → 弹「计费确认弹窗」**，而**确认后必然 401**（未登录） |
| 要钱吗 | **要**。弹窗原文 **≈ 0.60 积分**，三段明细见 §6。**因为没有账号，我按约定停在了确认弹窗，没有点「继续生成」** |
| 登录墙 | `POST /api/ai-video/help-write` → **401 `{"message":"请先登录"}`**（实测） |
| 结果长什么样 | **未取到**（需登录 + 需付费）。§4/§5 的流程与文案来自**前端 bundle 源码**（已发布在 CDN，可公开读取），非猜测 |

---

## 1. 确切位置

页面左栏（宽 570.4px 的 `video-workspace-controls-column`）内，是一张 `ai-video-surface` 卡片（530×683，圆角 10px，底色 `#101118`）。

框内自上而下：**① 素材区 `0 / 6` + 「选择图片」74×74 方块 → ② 脚本输入框（489×488）→ ③ 字数计数行 → ④ 模型 / 视频设置 → ⑤ 立即生成视频**。

「代为撰写」**共 2 处**，都在 ②③ 之间：

### 位置 A —— 空输入时的「占位文案行」（主入口）
- 它是 `div[contenteditable]` **外挂的一层覆盖层**（`pointer-events-none absolute left-0 top-0`），位于输入框**左上角**，与光标起点重合。
- 该层横向 flex，两个子元素并排：
  1. `<span>输入视频脚本，使用 @ 指定参考素材，或 </span>`（宽 319）
  2. `<button>[代为撰写]</button>`（x=630, y=306, **92×35**）
- 即整行读作：**「输入视频脚本，使用 @ 指定参考素材，或 [代为撰写]」**（与我方文档 47 第 43 行完全一致）。
- 空格细节：`或` 与 `[` 之间有**一个空格**（span 末尾带空格），按钮本身 `px-1`（左右各 4.96px 内边距）。
- **一旦输入任何文字，这一层整体消失**。

### 位置 B —— 有输入时的「右下角工具条」
- 输入框下方一行：`flex h-7 shrink-0 items-center justify-between`（489×35，y=793）。
- 左端 `<span>0 / 10000</span>`（字数计数，x=310），右端 `<button>代为撰写</button>`（**x=717, y=800, 82×22**）。
- 这行的原文**不带方括号**（`代为撰写`），**多一个图标**（见 §3）。
- 实测输入 23 字后计数变为 `23 / 10000`，按钮出现在右下。

> 两处**调用同一个 `onClick` 处理函数 `Ln`**（bundle 里 `onClick:Ln` 出现两次），行为完全一致。

---

## 2. 文案原文 / hover / tooltip

| 元素 | 原文 |
|---|---|
| 位置 A 按钮 | `[代为撰写]`（含方括号，方括号是**文案的一部分**，不是样式） |
| 位置 A 同行前缀 | `输入视频脚本，使用 @ 指定参考素材，或 ` |
| 位置 B 按钮 | `代为撰写`（无方括号，前置一个 sparkles 图标） |
| 计费弹窗标题 | `立即「代为撰写」` |
| 空输入 toast | `请先上传参考元素或简单描述脚本。` |

- **hover 文字：无。** 实测 `mouseenter`/`mouseover` 后页面无任何 `[role="tooltip"]` / `.tooltip` 元素生成。
- **原生 tooltip：无。** 两个按钮的 `title` 与 `aria-label` **均为 `null`**（已逐个读属性）。
- hover 只有**颜色过渡**：`hover:text-[var(--app-text)]`，即从 80% 不透明 → 100%。

---

## 3. 视觉规格（实测 computed style）

### 位置 A：`[代为撰写]` —— **纯文字按钮**
```html
<button type="button"
  class="pointer-events-auto cursor-pointer px-1 font-bold text-[var(--app-text)]/80 transition hover:text-[var(--app-text)]">
  [代为撰写]
</button>
```
```css
width: 92px;  height: 34.725px;          /* 实占 92 × 35 */
background: rgba(0,0,0,0);               /* 无底色 */
border: 0px solid …;  border-radius: 0px;/* 无边框、无圆角 */
color: oklab(0.210081 -0.00294439 -0.0316202 / 0.8);  /* = var(--app-text)/80 */
font-family: "Noto Sans SC";
font-size: 17.36px;  font-weight: 700;   /* font-bold */
line-height: 34.72px;
padding: 0px 4.96px;                     /* px-1 */
cursor: pointer;
box-shadow: none;
transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s …, border…;
```
- **图标：无。**
- 字号 17.36px 是**根字号 19.84px × 0.875** 的结果（该页根字号被放大到 19.84px，故 `text-[14px]` 实际渲染 17.36px）。

### 位置 B：`代为撰写` —— **图标 + 文字**
```html
<button type="button"
  class="inline-flex cursor-pointer items-center gap-1 font-bold text-[var(--app-text)]/80 transition hover:text-[var(--app-text)]">
  <svg viewBox="0 0 512 512" class="h-3.5 w-3.5"> … </svg>
  代为撰写
</button>
```
```css
width: 82px;  height: 22.3125px;
display: inline-flex;  align-items: center;  gap: 4.96px;   /* gap-1 */
background: rgba(0,0,0,0);  border-radius: 0px;  border: 0px;
color: 同 A（var(--app-text)/80）;
font-size: 14.88px;  font-weight: 700;  line-height: 22.32px;
padding: 0px;  cursor: pointer;
```
- **图标**：**sparkles（闪光/魔法棒）线性图标**，`viewBox="0 0 512 512"`，`h-3.5 w-3.5`（≈16.5px），`stroke="currentColor"`、`fill="none"`、`stroke-width="32"`、`stroke-linecap/linejoin="round"`。
  路径三段：大四角星 `M259.92 262.91L216.4 149.77…` + 小四角星 `M108 68L88 16L68 68L16 88l52 20l20 52l20-52l52-20z` + 第三段。
- 即：**图标与文字同色（currentColor），随 hover 一起变亮**。

### 一句话给设计
> 这两处都是**「文字按钮」而不是「胶囊」**——无底、无框、无圆角、无内阴影，靠 `font-bold` + 80% 透明度 + sparkles 图标区分于正文。**我方若要 1:1 复刻，重点在「克制」：不要给它加胶囊底色。**

---

## 4. 点一下发生什么（实测 + 源码）

### 实测 A：空输入点击（位置 A，未登录）
1. 点击 `[代为撰写]`。
2. 约 **1.0s** 后页面出现一行 toast：**`请先上传参考元素或简单描述脚本。`**
3. **无网络请求**（已 hook `fetch` + `XMLHttpRequest.prototype.open/send`，`window.__net` 为空数组）。
4. **无弹窗、无 loading、无面板**；输入框内容不变。
   → 这是**纯前端前置校验**，不消耗任何积分。

### 实测 B：有输入点击（位置 B，未登录）
1. 先向 `contenteditable` 注入 23 字脚本（计数变 `23 / 10000`，位置 A 消失、位置 B 出现）。
2. 点击 `代为撰写`。
3. 约 **2.5s 内**弹出**计费确认弹窗**（DOM: `.ai-video-help-write-cost-modal`）——见 §6。
4. 弹窗遮罩 `bg-black/70 + backdrop-blur-sm`，z-index `99999`，页面其余部分变模糊。
5. **我按约定停在这里**：没有点「继续生成」。
6. 追加验证（只读）：直接 `POST /api/ai-video/help-write`（空 body）→
   ```json
   HTTP 401  {"message":"请先登录","error":"Unauthorized","statusCode":401}
   ```
   → **即使点了「继续生成」，未登录也只会得到登录拦截，拿不到生成结果。**

### 源码 B：点「继续生成」之后的流程（来自已发布 bundle `router-nTm2HaBw.js`）
**不是我的猜测**——以下字符串常量与 DOM 结构均来自线上 JS 文件
（`https://cdn.quantv.com/site/models/front/assets/router-nTm2HaBw.js`，3,181,288 字节，公开可读）。

界面是一个**三步进度条**（`grid grid-cols-3 gap-3`，每 step 圆角 `rounded-[12px]`，序号圆点 `h-7 w-7 rounded-full`）：

| 步 | 标题 | 副标题 | 状态机 |
|---|---|---|---|
| 1 | **分析素材** | 分析素材内容 | active = `analyzing`/`analysis`；done = `script`/`preview` |
| 2 | **创作脚本** | 选择创作方向与脚本偏好 | active = `script` |
| 3 | **预览脚本** | 确认脚本并应用 | active = `preview` |

- 状态变量 `J.value ∈ { analyzing, analysis, script, preview }`。
- **loading（`analyzing`）**：居中一个 134×134 的 SVG **环形进度条**（`cx=60 cy=60 r=52`，底色描边 `#2a2d35`、进度描边 `#7dd3fc`、宽 8、`stroke-dasharray = 2πr` 随百分比），外加骨架文案：
  - 主 `正在分析素材` / 副 `正在分析上传图片并提炼商品洞察`
  - 卡片区骨架标题 `等待素材分析`；另有 `h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[#38bdf8]` 转圈态
- **素材分析完成**后，逐图给一张卡（`h-[90px] w-[96px]` 缩略图 + 右侧可编辑 `textarea`，占位 `图片{n}分析结果`，`resize-y`），标题 `✓ 素材分析完成`。
- 分析中文案池（轮播）：`正在提炼商品卖点和使用场景` / `正在拆解画面里的关键信息` / `正在识别素材中的主体与场景` / `正在生成可转化为脚本的创意方向`；有参考视频时用 `正在提炼拍摄方式` / `正在拆解画面` / `正在归纳可参考内容` / `正在分析节奏亮点`。
- 面板标题随步切换：第 3 步**不显示**标题栏，第 2 步显示 `创作脚本`，否则 `素材分析`。

### 「@ 指定参考素材」
输入框占位文案 `输入视频脚本，使用 @ 指定参考素材，或 [代为撰写]` 说明输入 `@` 会唤起素材选择（chip）。bundle 中对应 chip 序列化函数：
```js
tk = e => JSON.stringify({ label: e.label,
  previewKind: e.cfg.type === 'referenceVideo' ? 'video' : 'image',
  previewUrl: e.item.preview,
  playbackUrl: e.cfg.type === 'referenceVideo' ? e.item.preview : '',
  chipIcon: '', chipTone: '' })
```
→ chip = **标签 + 预览图/预览视频**，纯文本序列化后回填进脚本。素材上限 **6**（`KO=6`），图片接受 `image/jpeg,image/png`（`.jpg,.jpeg,.png`）。

---

## 5. 返回什么给用户 / 能否编辑 / 有无「重新写·采纳·取消」

- **生成结果正文：未取到。**（401 登录墙 + 付费，我按约定没有点「继续生成」。**不编造。**）
- 但从 bundle 可确定**交互形态**，这一条对「翻译成我方图片侧预览功能」最关键：

| 能力 | 有无 | 证据 |
|---|---|---|
| **可编辑** | **有，且是关键设计** | 第 1 步每张素材卡的分析结果就是一个 `<textarea>`（`onInput` 回写数组 `m.value[t]`），用户可改 AI 对素材的理解，改完再进下一步 |
| **三步式（分析→创作→预览）** | 有 | 三步进度条常量 |
| **「取消」** | **有** | 计费弹窗左按钮原文 `取消` |
| **「继续生成」** | **有** | 计费弹窗右按钮原文 `继续生成`（白底主按钮） |
| **「确认脚本并应用」** | 有 | 第 3 步副标题原文 `确认脚本并应用`（最终把脚本写回输入框） |
| **创作方向 / 脚本偏好（第 2 步）** | 有 | 见下 |

**第 2 步「创作脚本」的三个维度**（bundle 常量 `ek`；与线上 `/api/ai-video/config` 返回的 `scriptOptions` 一致，后者是**线上真实配置**、比 bundle 里的旧版更长）：

| 维度 | 线上 config 实际返回的选项（label） |
|---|---|
| **business（业务场景）** | 电商带货 / 同城到店 / 上门服务 / **教育培训** |
| **contentTypes（内容类型）** | 带货 / 种草 / 卖点钩子 / 剧情演绎 / 生活记录 |
| **shotTypes（拍摄方式）** | 桌拍开箱 / 真人口播 / 一镜到底 / 运动跟拍 / 品牌TVC |

每个选项都带一句**提示词级 prompt**（会拼进最终脚本生成），例如线上原文：
- `local_store` → 「侧重门店位置、同城专属福利、到店体验、门店氛围、限时权益、同城引流到店。」
- `home_service` → 「侧重服务优势、上门便捷性、用户痛点解决、服务保障、专业度、预约咨询引导。」
- `tabletop` → 「采用桌拍、开箱、细节特写等镜头，突出商品外观、材质和使用步骤。」

> **对我方最有价值的一条**：他们的「代为撰写」**不是「一句话生成一段文案」**，而是
> **「AI 先读懂素材 → 用户纠偏 → 用户再选创作方向 → 生成 → 预览确认应用」** 的四段式。
> 用户批注说「本质上就是图片生成那边的预览的功能」——**吻合**：对应我方图片侧「预览」，但多了一层**可编辑的素材理解**与**显式的方向偏好**。

---

## 6. 收费与否 —— **有价格，已抄数字**

### 实测弹出的计费确认弹窗（未登录，原文逐字抄录）

DOM：`.ai-video-help-write-cost-modal`（`fixed inset-0 z-[99999] grid place-items-center bg-black/70 px-4 backdrop-blur-sm`）
卡片：`.ai-video-help-write-cost-modal__card` = `w-[min(480px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#181a21] p-6`

实测渲染：遮罩 `rgba(100,108,122,0.54)` + `backdrop-filter: blur(9.92px)`；卡片 `595×560`，圆角 `19.84px`，内边距 `29.76px`，阴影 `0 24.8px 74.4px rgba(15,23,42,.2)`。

**弹窗全文（原文抄录）：**
```
立即「代为撰写」

预计消耗积分                    ≈ 0.60 积分
当前可用积分                    0.00 积分

计费明细
1  分析我的素材        0.10 积分 / 张 × 1 张 = 0.00 积分
2  参考视频拆解        0.50 积分 / 次
3  按配置生成脚本      0.10 积分 / 条

实际扣费以任务成功结果为准，失败不扣对应项积分。

                                  [取消]  [继续生成]
```
> 注：第 1 项显示 `× 1 张 = 0.00 积分`，是因为本次**未上传素材**（0 张 → 0 元）；上传 1 张后应为 0.10 积分。

### 线上公开配置 `GET /api/ai-video/config`（**无需登录**，200）返回的真实价格表

```json
"aiSteps": {
  "write_script":              { "enabled": true, "stepName": "帮我写",          "salePrice": 0.1 },
  "video_parse":               { "enabled": true, "stepName": "视频解析",        "salePrice": 0.5 },
  "script_generate":           { "enabled": true, "stepName": "按配置生成脚本",  "salePrice": 0.1 },
  "reference_script_generate": { "enabled": true, "stepName": "参考视频生成脚本","salePrice": 0.1 }
}
```
→ 与弹窗完全对得上：**帮我写 0.1 + 视频解析 0.5 + 按配置生成脚本 0.1**，弹窗按本次配置估算为 **≈ 0.60**。

**其它页面上出现的价格数字（同页实测）：**
- `立即生成视频` 按钮副文案：**`预计 12.00 积分`**（按钮 530×55，实测为**禁用灰底** `rgb(143,143,143)`）
- 右上角余额：**`0.00`**
- 模型行：`全能参考视频2.0 - mini`；视频设置：`16:9 · 15秒 · 720p`

> **结论：「代为撰写」是明确收费项，0.10 ~ 0.60 积分/次，价格在点击后弹窗明示（不是点完才偷偷扣）。因为没有账号，我按约定停在了确认弹窗、未点「继续生成」。**

---

## 7. 同一页面上与它并列的其它胶囊/按钮（逐个列出）

### 左栏（脚本输入框内外）
| # | 位置 | 原文 | 实测尺寸 | 形态 |
|---|---|---|---|---|
| 1 | 卡片头部右上 | `新建` | 57×24 | 文字按钮（`font-bold`，色 `#4b5563`） |
| 2 | 素材区 | `选择图片` | **74×74** 方块（内含 `+`） | 描边方块 |
| 3 | 素材区 | `0 / 6` | — | 计数，非按钮 |
| 4 | 占位行 | **`[代为撰写]`** | **92×35** | **纯文字按钮（本文件主角）** |
| 5 | 计数行右端 | **`代为撰写`** | **82×22** | 图标 + 文字按钮（本文件主角） |
| 6 | 计数行左端 | `0 / 10000` | 62×22 | 计数，非按钮 |
| 7 | 底部配置 | `模型` / `全能参考视频2.0 - mini` | **260×62** | 下拉卡，`rounded-lg`、白底、`0.8px rgba(15,23,42,.1)` 描边 |
| 8 | 底部配置 | `视频设置` / `16:9 · 15秒 · 720p` | **260×62** | 同上 |
| 9 | 底部主按钮 | `立即生成视频` + `预计 12.00 积分` | **530×55** | 主 CTA（未满足条件时灰底禁用） |

> **注意**：「代为撰写」在页面上**不是胶囊**，**真正的圆角胶囊/卡片是 ⑦⑧（`rounded-lg` 9.92px 白底卡）和 ⑨（`rounded-lg` 55 高主按钮）**。写清楚这条，避免我方照抄成一排胶囊。

### 页面其它
- 左侧全局导航（200×57 / 64×64 圆角方块）：`首页` `图片制作` `视频制作` `无限画布` `我的资产` `我的作品` `提取需求` `使用手册` `主题` `通知`
- 顶部：`‹ 返回视频创作`（124×24，色 `#4b5563`）、居中标题 `视频创作`、右上 `0.00`(74×45) / `积分商城`(103×45) / `会员`(89×45，金色)
- 右下角悬浮：`联系客服`（64×64 黑色圆）
- 右侧面板页签：`作品示例` / `我的作品` / `教学示例`（各 79×40）

---

## 8. 右侧「作品示例 / 教学示例」——含用户点名的四个场景分类

### 重要更正（与用户批注 & 我方文档 47 的差异）
用户批注说「**教学示例**里面按场景分类：同城到店 / 带货开箱 / 上门服务 / 视频带货」。
**实测：那四个分类不在「教学示例」，而在默认的「作品示例」页签下。**
`教学示例` 里只有**一条**视频（无标题）。

两者是**并列的两个 tab**，都在右侧同一个面板 `.video-workspace-mine-panel`（1156×916，`bg-white`、`rounded-xl`、`px-6 py-5`）内：

| Tab | 内容 | 条数 | 版式 |
|---|---|---|---|
| **作品示例**（**默认选中**，黑色下划线 `h-0.5 rounded-full bg-[#111827]`） | **同城到店 / 带货开箱 / 上门服务 / 视频带货** | **4** | `grid-cols-4 gap-4 max-w-[1040px]` |
| 我的作品 | 空 | 0 | — |
| **教学示例** | 无标题单条 | **1** | `grid-cols-1 max-w-[920px]` |

### 作品示例（四个场景分类卡）
每张卡：
```html
<article class="relative w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm max-w-[240px]">
  <div class="aspect-[9/16] w-full overflow-hidden bg-black">
    <video src="https://cdn.quantv.com/models/ai-video/examples/xxx.mp4"
           class="h-full w-full object-contain" preload="metadata" controls></video>
  </div>
  <div class="absolute left-3 top-3 z-10 max-w-[calc(100%-24px)] truncate rounded-md bg-white/80 px-2 py-1 text-[12px] font-medium text-[#111827] backdrop-blur">
    同城到店
  </div>
</article>
```
- 实测渲染 **259×460**（`max-w-[240px]` 被撑大），**竖版 9:16**。
- **可以播放**：`<video controls>`，原生控制条，`preload="metadata"`，默认 `paused`、**不自动播放**。
- 标签是**左上角浮层**：白 80% 半透明 + `backdrop-blur` + 圆角 `md` + `12px` 字，**正好浮在视频上**。

**四个分类的线上原始数据**（来自公开 `GET /api/ai-video/config` → `entry.examples`）：

| 顺序 | `title` | 视频 URL | `sortWeight` |
|---|---|---|---|
| 1 | **同城到店** | `https://cdn.quantv.com/models/ai-video/examples/1788233626513_4s8k2v6cno.mp4` | 0 |
| 2 | **带货开箱** | `…/examples/1787893022834_oc4wa7nn4c.mp4` | 10 |
| 3 | **上门服务** | `…/examples/1787893038524_w761k6vqpnc.mp4` | 20 |
| 4 | **视频带货** | `…/examples/1787893087158_0uvdhbhv1bro.mp4` | 30 |

### 教学示例（用户另一个点名的东西）
- 单条视频卡，**横版 `aspect-video`（16:9）**，实测 **1095×616**，`max-w-[920px]` 同样被撑大。
- `<video src="https://cdn.quantv.com/models/ai-video/tutorial-examples/1788230910406_u2ennkpen8.mp4" class="h-full w-full object-contain" preload="metadata" controls>`
- **可以播放**（原生 `controls`，`preload="metadata"`，默认 paused、不自动播放）。
- 卡片左上角浮层标签原文是 **`作品示例 1`**（!!）——**不是「教学示例 1」**，这是**线上文案 bug**（复制粘贴遗留）：
  线上 config 里这条的 `title` 字段**就是空字符串** `""`，前端 fallback 成了 `作品示例 {i+1}`。

### 里面教什么
- 视频本身是**录屏教学**，位于 `tutorial-examples` 目录；配置 `GET /api/ai-video/config` 的 `entry.tutorialExamples` 中 `title` 为空、`sortWeight=0`、`enabled=true`，**只有 1 条**。
- 时长/内容：**未取到**（`readyState=0`、`duration=null`，因 `preload="metadata"` 且未交互；我没有下载解析该 mp4 —— 若需「逐帧教什么」的结论，需另开一步用 video-analyzer 拉取）。
- 但它**教什么可从上下文确定**：它被放在视频创作台右侧，与「作品示例 / 我的作品」并列，作用 = **演示这个视频创作台怎么用**（对应 bundle 里的 `tutorialVideoUrl`；其它模块如数字人也有同名的 `dh-tutorial-modal` 弹窗式教学）。
- **数据驱动**：管理员后台配置，前端只是 `(cfg.tutorialExamples||[]).filter(e=>e.enabled!==false && e.src).sort(by sortWeight)`。

> 两个页签都是**纯配置驱动**：`examples` / `tutorialExamples` 数组，`enabled` 开关 + `sortWeight` 排序 + `mediaType`。**我方若要照抄，建议把这两块做成同一份配置的两个数组。**

---

## 9. 实测证据 / 复现方式 / 未取到项

### 公开可达的接口（未登录）
```
GET  /api/ai-video/config        → 200  (2474 B)  ← 价格表 + 场景选项 + 示例视频清单，全部公开
POST /api/ai-video/help-write    → 401  {"message":"请先登录","error":"Unauthorized"}
GET  /api/v1/ai-video/config     → 404
GET  /api/ai-video/help-write    → 404
GET  /api/button-price/product-video/custom-script → 404
```

### 复现命令（仓库现成工具）
```powershell
# 页面 + 按钮 DOM/CSS 探测
node .tmp/shot.mjs 'https://laoyu.quantv.com/ai-video' - 7000 '@.tmp/e2.js'
# 点击「代为撰写」并观察（含网络 hook）
node .tmp/shot.mjs 'https://laoyu.quantv.com/ai-video' - 7000 '@.tmp/e6.js'
# 计费弹窗规格
node .tmp/shot.mjs 'https://laoyu.quantv.com/ai-video' - 7000 '@.tmp/e7.js'
# 截图
node .tmp/shot.mjs 'https://laoyu.quantv.com/ai-video' .tmp/qv-aivideo-default.png 8000 '@.tmp/e23.js'
node .tmp/shot.mjs 'https://laoyu.quantv.com/ai-video' .tmp/qv-dawei-cost-modal.png 8000 '@.tmp/e27.js'
```
探测脚本（本轮新建，均为只读）：`.tmp/e2.js`、`.tmp/e6.js`、`.tmp/e7.js`、`.tmp/e22.js`、`.tmp/e24.js`。

### 截图产物
- `.tmp/qv-aivideo-default.png` —— 默认态整页（2048×1026，左栏脚本框 + **作品示例四张场景卡**）
- `.tmp/qv-dawei-cost-modal.png` —— **「立即『代为撰写』」计费弹窗**实拍

### 未取到 / 卡在哪
| 项 | 状态 | 卡点 |
|---|---|---|
| 生成后的脚本**正文** | **未取到** | `POST /api/ai-video/help-write` 401 登录墙；且服务端收费 → **按约定停手，未注册/未付费** |
| 生成**耗时** | **未取到** | 同上；只能从 bundle 得知有环形进度条 + 骨架屏，无时长常量 |
| 第 2/3 步的**实际视觉** | **未取到** | 需登录 + 付费才能进入 |
| hover **tooltip** | **确认不存在** | 已实测 `mouseenter`/`mouseover`，无 tooltip 元素；`title`/`aria-label` 均为 null |
| 教学视频**内容与时长** | **未取到** | `preload="metadata"` 未触发下载；需另用 video-analyzer 解析该 mp4 |

> **没有编造任何一条。** 凡属「源码推得」的，§4/§5 已明确标注来源是线上公开 bundle；凡属「实测」的，均给了坐标/尺寸/原文。

---

## 10. 给「薯包 AI」的三条可执行建议

1. **把「代为撰写」翻译成图片侧的「预览」，但保留四段式**：素材理解（可编辑 textarea）→ 方向偏好 → 生成 → 预览确认应用。
   用户批注说的「预览功能」= 第 3 步；但他们真正的差异化在**第 1 步让人改 AI 的理解**——这一步我方图片侧目前没有。
2. **做成「文字按钮」而不是胶囊**：`font-bold` + `currentColor/80` + sparkles 图标 + `hover` 提亮。零底色、零边框、零圆角。这与我们文档 49 里「首页视频创作台极简化」的方向一致。
3. **价格沿用「点击后弹窗明示明细」**：他们先给三段明细再让确认，且写明「失败不扣对应项积分」。我方「一键解析 0.20 积分/次」目前是**把价格写在按钮上**（文档 47 §59）——两种都可，但**多步收费的操作，弹窗明细比按钮角标更清楚**。
