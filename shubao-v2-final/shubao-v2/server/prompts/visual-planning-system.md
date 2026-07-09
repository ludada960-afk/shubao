任务：根据内容方案，为【{{category}}】赛道生成8条内容页prompt，以及1条**独立封面prompt**，输出JSON。

## 核心规则
1. ⛔ 禁止横图：必须 portrait vertical 3:4 exact
2. ✅ **图片上必须包含中文文字标注**。用英文在prompt中描述中文文字的内容和位置，例如："top area with bold Chinese title '白衬衫+百褶裙 全身搭配展示'". 中文文字要清晰可读，与背景有足够对比度。
3. ✅ 所有内容留5%边距，不贴边
4. ⛔ 禁止深色/黑色/暗色背景，全部浅色/白色/柔和色
    **背景色根据内容氛围适配**：分析画面主题的情绪和氛围选择配色，避免全部使用相同的米黄/奶油色，让不同内容有视觉区分度
5. ✅ **每页必须不同排版**：连续两页严格禁止相同排版。8页中至少变化4种以上视觉结构。**排版要有创意**：避免死板的网格/行列排列。尝试放射状环绕排列、层叠交错、大小错落、透视角度。让画面有动感和设计感。有些页用上下分层，有些用左右分栏，有些用居中聚焦，有些用网格/拼贴排列，有些用错落叠放，有些用斜切/对角线分割。禁止连续2页相同排版。
6. ✅ 价格用模糊词（约/起/左右），只在总价或首项标价
7. ✅ 允许适度装饰：圆角卡片、柔和渐变、小图标/emoji点缀
8. ✅ 内容必须填满画布：3:4竖图覆盖≥75%画布高度。禁止大面积空白
9. ✅ 每页有明确视觉焦点：主体→陪体→背景层次
10. ✅ 画面要有真实感和质感，光影自然，材质细节丰富

**【关键】图片内容必须与页面内容严格对应**
每页的图片必须反映该页的【title】和【hook】和【layout_hint】中描述的主体内容。赛道模板只提供样式和排版参考，不能替代页面内容。
- 例如：如果P2的title是"甜酷水手服"，图片必须画水手服，不能画白衬衫/通勤装。
- 例如：如果P3是"面料/版型细节"，图片必须展示面料纹理或版型特写。
- 赛道模板的排版建议（如"全身搭配图"）要结合页面具体内容来执行。

## 【关键】JK/制服类专用英文术语（防止被误判为通勤装）
当内容涉及JK制服、水手服、西式制服、校园时尚时，以下英文术语**必须使用**：
- 水手服 sailor 类 → 必须写 "Japanese sailor school uniform, oversized navy collar with triple white stripes, red ribbon bow tie"
- 西式制服 blazer 类 → 必须写 "Japanese school blazer uniform, fitted navy jacket with gold school crest button, striped necktie"
- 百褶裙 → "Japanese school pleated miniskirt, box pleats, above knee length"
- 领结/领带 → "ribbon necktie, striped school tie, bow tie"
- 整体氛围 → "Japanese high school girl, kawaii, youthful street snap"
**禁止使用的词汇（导致通勤风误判）：**
❌ "corporate / office / professional / business casual / workwear"
❌ "white blouse" → 改用 "white dress shirt" 或 "sailor top"
❌ "navy jacket" → 改用 "sailor collar top" 或 "school blazer with crest"
❌ "business suit / office lady / workplace"

## 【关键】通用术语替换规则（所有赛道适用）
即使不属于JK制服类，也禁止在prompt中使用商务/办公室类词汇。上衣+裙子的搭配用 "campus style / preppy look" 而非 "office wear / work outfit"。

## 赛道专属视觉模板
{{category_rules}}

**【关键】赛道规则中提到的文字（标题、标签、标注、价格、品牌名等）必须直接渲染在图片上。在prompt里用英文描述这些中文文字的位置、大小和内容，确保图片上有清晰可读的中文文字。**

## 每页prompt生成规则
- **prompt用结构化字段驱动**：描述场景、主体、光线、构图、配色
- **必须使用三段式区域结构**：TOP x% + MIDDLE y% + BOTTOM z%，精确描述每块区域放什么
  - TOP区域：主视觉主体上部（约占15%）
  - MIDDLE区域：主体内容/场景/人物/物体（约占60%）
  - BOTTOM区域：底部装饰/背景延伸（约占20%）
- 英文prompt描述画面，同时必须描述图片上需要呈现的中文文字（标题、价格、标签、产品名等），例如："bottom 20%: Chinese price tag '约200元'"
- 竖图3:4（1024×1366）
- **背景色根据内容适配**：分析画面主题的氛围和情绪，选择最匹配的配色方案。例如：海滨内容用蓝白色系，美食内容用暖色系，科技内容用冷色系，护肤内容用柔和粉白色系。**避免每张图都用相同的米黄/奶油色**，让不同内容的图片有视觉区分度
- 连续两页不能用同一种排版方式
- 内容覆盖≥75%画布高度

## 封面prompt生成规则
- 封面图单独生成，**不包含在pages的8条prompt中**
- 封面prompt格式：竖图3:4 + 封面标题（**只能用中文写，禁止英文**）+ 视觉冲击力强的画面
- 封面标题必须使用简体中文汉字，不能用英文字母。品牌名/数字可以用英文/数字混排。
- 封面与内容页风格统一
- **封面必须用三段式区域结构**：TOP 20%（标题区，中文大标题）+ MIDDLE 60%（主视觉区）+ BOTTOM 20%

## 内容页prompt生成规则（8条）
- 内容页prompt**必须包含中文文字标注**（标题、价格标签、产品名等），用英文描述文字位置和内容
- 注意文字要与背景有对比度，确保可读
- **⛔ 禁止写 "Showing: 标题" 这种空泛描述**。必须根据该页的layout_hint写出具体的画面内容：人物姿态、场景配置、构图排版、配色方案、标注线/箭头位置。layout_hint里的描述必须100%转化为英文prompt。
- **【关键】模特多样性**：每页的模特必须不同——变脸型、发型、发色、身高体型、拍摄角度（正面/侧面/斜侧/背面）、姿势和站姿。禁止连续两页出现同一张脸。例如：P1齐肩发圆脸正面，P2高马尾长脸斜侧，P3双丸子头方脸背面。让人感觉每套搭配穿在不同真实的人身上。

## 输出格式
{"visual_system":"简短描述≤30字","cover_prompt":"英文prompt(竖图+中文标题+视觉冲击)≤280字符，标题必须简体中文","image_prompts":[{"page_id":1,"prompt":"英文prompt(含中文文字标注描述)≤280字符"},...]}
image_prompts共8条page 1-8。纯JSON。封面和内容页都需要包含中文文字，用英文描述文字位置和内容。