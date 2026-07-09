const fs = require("fs");
let c = fs.readFileSync("index.mjs", "utf8");

// Find the VISUAL_PLANNING_SP boundaries
const spMarker = 'const VISUAL_PLANNING_SP = `# 角色：小红书视觉编排师';
const spStart = c.indexOf(spMarker);
const upMarker = '\nconst VISUAL_PLANNING_UP';
const spEnd = c.indexOf(upMarker, spStart);

if (spStart < 0 || spEnd < 0) {
  console.log("Could not find VISUAL_PLANNING_SP boundaries");
  process.exit(1);
}

console.log("SP section:", spStart, "->", spEnd, "=", (spEnd-spStart), "chars");

// Build the new compact SP - use template injection for category rules
const newSP = `const VISUAL_PLANNING_SP = \`# 角色：小红书视觉编排师
任务：根据内容方案，为【{{category}}】赛道生成9条prompt（1封面+8内容），输出JSON。

## 硬性红线
1. ⛔ 禁止横图：必须 portrait vertical 3:4 exact
2. ✅ 中文在图上：prompt引用该页story的具体中文文本，标明文字位置
3. ⛔ 禁止火星文/乱码：所有文字必须是可读简体中文
4. ⛔ 所有内容留5%边距，不贴边
5. ⛔ 禁止深色/黑色/暗色背景，全部浅色/白色/柔和色
6. ✅ 版式必须变化：连续两页不能用同一种排版，同一篇≥3页同版式
7. ✅ 所有价格用"约/起/~"前缀

## 排版模式库（每页必选一种，连续两页不同）
1.满版图+文字浮动  2.上下分栏  3.左右分栏  4.拼贴/网格  5.卡片堆叠
6.斜切/对角线  7.环绕/放射  8.时间线/步骤流  9.对比分屏  10.极简文字+小图

## 当前赛道视觉方案
{{category_rules}}

## 输出格式
{"visual_system":"简短描述≤30字","cover_prompt":"英文prompt(竖图+中文标题)≤280字符","image_prompts":["page_id":2,"prompt":"英文(竖图+版式+中文文字)≤280字符","page_id":3,"prompt":"英文"...]}
image_prompts共8条page 2-9，必须生成8条。纯JSON，不包含任何解释文字。`;

// Category rules map - each category's visual guide (concise, just cover + key pages)
const catMap = `const CATEGORY_RULES = {
  "旅游攻略": \`视觉：写实旅行摄影，自然光偏蓝绿
  封面A)多图拼贴+标题  B)单张风景大片+标题居中+价格  C)手绘地图+打卡点
  P2 A)三栏景点拼贴+价格  B)双栏对比  C)网格4宫格
  P3 A)大图+圆形嵌入小图  B)全景+底部横幅  C)时间线水平
  P4 A)斜切上下午+时段  B)上下分屏  C)卡片堆叠
  P5 A)路线地图+标注  B)地铁线路图风  C)距离排序
  P6 A)美食拼盘+价格  B)美食地图  C)排行榜
  P7 A)出片点位  B)取景指南+构图
  P8 A)预算逐项+总额  B)饼图+金额  C)省钱对比
  P9 A)打包清单  B)精华Tip卡片  C)行程总览+互动
  配色：不固定(海滨=蓝白,山地=翠绿,古城=暖褐,雪景=冷白蓝,城市=灰咖)
  所有背景浅色\`,
  "美妆·产品测评": \`视觉：高端美妆信息图，多元素拼贴布局
  封面A)双栏拼贴(产品+价格+品牌)  B)产品70%+标题+卖点标签  C)极简产品居中+标题底部
  P2 A)各角度+参数卡片  B)全家福+卖点气泡  C)三栏(图/参数/卖点)
  P3 A)质地微距+评分标签  B)质地横评三格  C)质地十字分解
  P4 A)成分+功效箭头  B)成分轮盘图  C)浓度/功效金字塔
  P5 A)步骤图+箭头  B)环形流程  C)正确vs错误对比
  P6 A)Before/After+VS  B)时间线Day1→28  C)三维度改善卡
  P7 A)优点|缺点|评分  B)天平式  C)问答卡
  P8 A)横向对比表  B)雷达图对比  C)阶梯排列
  P9 A)总结卡+肤质+价格  B)推荐决策树  C)精华回顾+CTA
  配色：不固定(按产品类型决定，禁止冷灰底/荧光色)浅色背景\`,
  "美妆·化妆教程": \`视觉：步骤式美妆教程，自然光
  封面A)完妆面部60%+标题  B)半脸+工具  C)四宫格
  P2 A)三步并列(妆前/粉底/遮瑕)  B)底妆前后对比  C)底妆步骤递进
  P3 眼妆：眼影晕染区域+眼线/睫毛特写  P4 腮红/高光  P5 唇妆
  P6 整体效果+要点  P7 色号参考  P8 配饰搭配  P9 总结互动
  配色：不固定(按妆容风格决定，肤粉/裸色/金棕等)浅色背景\`,
  "穿搭分享": \`视觉：街拍杂志风，全身照为主
  封面A)全身80%+标题角落  B)半身+全身两段  C)杂志风侧身/背面+大标题
  P2 A)全身+引导线标注  B)单品拆解三区  C)全身+单品环绕
  P3 上半身细节  P4 风格左右对比  P5 配饰特写
  P6 场景穿搭  P7 一周穿搭网格  P8 搭配技巧图解
  P9 最佳look展示+互动
  配色：不固定，整体浅色(浅灰/白/米白/裸粉/浅紫)浅色背景\`,
  "美甲": \`视觉：精致美甲摄影，手部真实感
  封面A)手部特写+标题  B)双手展示+标题  C)手+道具场景
  P2 甲型+颜色+款式标注  P3 细节特写+工艺
  P4 双手展示不同角度  P5 不同光线效果
  P6 工具产品排列+名称+价格  P7 搭配建议
  P8 持久度+注意事项  P9 总结+互动
  配色：不固定(按款式决定)浅色背景\`,
  "健康养生": \`视觉：健康生活风，明亮自然光
  封面A)食材居中+标题  B)食材散落+标题  C)饮品特写+标题
  P2 核心食材+功效  P3 科学原理/机制
  P4 做法步骤  P5 真实场景  P6 注意事项
  P7 延伸搭配  P8 周期建议  P9 总结互动
  配色：不固定(食材天然色)浅色背景\`,
  "书单推荐": \`视觉：文艺阅读风，暖色调
  封面A)书本堆叠+标题  B)书架排列+标题  C)一本书+金句
  P2-P8 每本书一页：封面+作者+金句+推荐理由
  P9 阅读顺序+互动
  配色：暖米/浅咖/奶白 浅色背景\`,
  "职场成长": \`视觉：简洁商务风，干净线条
  封面A)办公场景+标题  B)知识卡片  C)数据图表+标题
  P2 问题+解决方案  P3 方法步骤
  P4-P8 各方法详解  P9 总结+CTA
  配色：蓝灰/白/浅米 浅色背景\`,
  "技能学习": \`视觉：学习风，清晰步骤图
  封面A)学习场景+标题  B)工具排列+标题  C)思维导图+标题
  P2 技能总览  P3-P8 各步骤详解
  P9 成果展示+互动
  配色：浅色背景\`,
  "美食探店": \`视觉：食欲摄影风，暖色调
  封面A)招牌菜80%+标题+价格  B)多菜拼图+价格区间  C)店内环境+前景菜+人均
  P2 A)微距特写+菜名+价格  B)俯拍摆盘  C)食材解构
  P3 A)剖面+引导线  B)爆炸分解  C)制作流程
  P4 A)原料+步骤  B)环形流程  C)原料→成品
  P5 拼盘展示3-4样+价格  P6 吃法展示
  P7 环境+位置+人均  P8 同类对比
  P9 推荐菜组合/三档排列/最佳评选
  配色：不固定(火锅=暖红/米白,甜品=粉嫩,日料=浅木,轻食=浅绿)暖色浅色背景\`,
  "育儿知识": \`视觉：温馨家庭纪实，柔光温暖
  封面A)亲子互动+标题  B)物品排列+标题  C)温馨合照+标题
  P2 清单排版+图标  P3 场景+标注
  P4 错误vs正确对比  P5 好物推荐
  P6 步骤图  P7 Q&A卡片
  P8 总结+互动
  配色：柔粉/淡蓝/米白/暖色 浅色背景
  特别注意：全部用常用字，不用生僻字\`,
  "好物评测": \`视觉：生活好物种草，高级产品摄影
  封面A)产品80%+标题底部+价格  B)产品入镜+人物手持+标题  C)多品网格排列  D)产品特写+标题浮层
  P2 A)平铺俯拍(产品+配件)  B)左产品60%+右信息条  C)产品斜放+配件环绕  D)上下分栏
  P3 A)真人场景使用  B)前后对比  C)手持特写  D)场景融入
  P4 A)细节微距+标注  B)2-3细节拼贴  C)产品侧躺+纹理  D)拆分美学排列
  P5 A)2-3小图时间顺序  B)中央产品+环绕场景  C)上下滑屏  D)左中右三栏
  P6 A)Before/After+VS  B)数据+产品图  C)时间线  D)环形对比
  P7 A)优点✓/缺点✗+评分  B)五星评分  C)三格横评  D)天平式
  P8 A)左右对比  B)时间线  C)三选一推荐
  P9 总结卡+购买建议+互动
  配色：不固定(按产品类型)浅色高级背景\`,
  "数码3C": \`视觉：科技感产品摄影，冷色调
  封面A)产品手持+标题+卖点  B)俯拍产品居中+标题  C)场景氛围+标题+价格
  多品横评封面：A)2×3网格排列6品+标题  B)一字排开+对比参数  C)阶梯排列+价格标签
  禁止L型/U型/边缘环绕；多品必须均匀网格排列
  P2 产品居中+四周参数  P3 拆解爆炸图+标注
  P4 功能演示+界面  P5 参数对比表格  P6 细节特写
  P7 使用场景  P8 总结+购买建议  P9 互动
  配色：不固定(按产品，浅灰/白/银/浅蓝)浅色背景\`,
  "家居家装": \`视觉：家居生活风，自然光明亮
  封面A)改造后全景+Before小图  B)场景+标题  C)细节+标题
  P2 Before/After左右分屏  P3-P5 分区展示
  P6 好物推荐3-4个  P7 避坑技巧  P8 费用明细
  P9 改造前后对比+互动
  配色：北欧=白+浅木 日式=原木+米白 法式=奶油白+浅金 现代=浅灰+白 浅色背景\`,
  "养生花茶": \`视觉：自然花草风，明亮通透
  封面A)花茶+原料散落+标题  B)多款排列+标题  C)手持茶杯+蒸汽+标题
  P2 原料+名称+功效  P3 冲泡过程  P4 功效对比
  P5 真实场景  P6 成分详解  P7 一周搭配
  P8 总结+互动
  配色：不固定(花草茶=浅绿/米白,果茶=暖橙/粉,安神=淡紫/淡蓝)浅色背景\`
};`;

// Replace the old VISUAL_PLANNING_SP with new compact one
const fullReplace = c.slice(0, spStart) + newSP + c.slice(spEnd);

// Add CATEGORY_RULES map after VISUAL_PLANNING_SP
const afterSP = fullReplace.indexOf("const VISUAL_PLANNING_UP");
const withMap = fullReplace.slice(0, afterSP) + "\n\n" + catMap + "\n\n" + fullReplace.slice(afterSP);

// Update the visualPlanning function to use category-specific rules
// Find where sysPrompt is built and inject category_rules
const funcStart = withMap.indexOf("async function visualPlanning");
const promptBuild = withMap.indexOf("const sysPrompt = VISUAL_PLANNING_SP", funcStart);

if (promptBuild < 0) {
  console.log("Could not find prompt building code");
  process.exit(1);
}

const oldBuild = withMap.slice(promptBuild, promptBuild + 200);
console.log("Old prompt building:", oldBuild.slice(0, 100));

// We need to replace the sysPrompt building to inject category_rules
const oldSysPrompt = "const sysPrompt = VISUAL_PLANNING_SP.replace(/{{current_year}}/g, String(currentYear)).replace(/{{current_month}}/g, String(currentMonth));";
const newSysPrompt = `const categoryKey = analysisResult.category;
  const catRules = CATEGORY_RULES[categoryKey] || CATEGORY_RULES["好物评测"];
  const sysPrompt = VISUAL_PLANNING_SP
    .replace(/{{category}}/g, categoryKey)
    .replace(/{{category_rules}}/g, catRules)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));`;

if (!withMap.includes(oldSysPrompt)) {
  console.log("sysPrompt pattern not found, trying partial match");
  const idx = withMap.indexOf("VISUAL_PLANNING_SP.replace");
  if (idx < 0) { console.log("Cannot find replace"); process.exit(1); }
  // Find the line
  const lineStart = withMap.lastIndexOf("\n", idx) + 1;
  const lineEnd = withMap.indexOf("\n", idx);
  const oldLine = withMap.slice(lineStart, lineEnd);
  console.log("Found line:", oldLine.slice(0, 80));
  // Build replacement with category injection
  const newLine = `const categoryKey = analysisResult.category;
  const catRules = CATEGORY_RULES[categoryKey] || CATEGORY_RULES["好物评测"];
  const sysPrompt = VISUAL_PLANNING_SP${oldLine.slice(oldLine.indexOf(".replace"))}`;
  // Also add category/rules replace
  // Actually,. Let me just do a simpler approach - add the category_rules replace inline

  const final = withMap.slice(0, lineStart) +
    "const categoryKey = analysisResult.category;\n  " +
    "const catRules = CATEGORY_RULES[categoryKey] || CATEGORY_RULES[\"好物评测\"];\n  " +
    "const sysPrompt = " +
    oldLine.slice(oldLine.indexOf("VISUAL_PLANNING_SP")).replace(
      ".replace(/{{current_year}}/g",
      ".replace(/{{category}}/g, categoryKey).replace(/{{category_rules}}/g, catRules).replace(/{{current_year}}/g"
    ) +
    "\n  " + withMap.slice(lineEnd);

  fs.writeFileSync("index.mjs", final, "utf8");
  console.log("✓ Done - replaced VISUAL_PLANNING_SP with compact version + category injection");
} else {
  // Direct replacement works
  const final = withMap.replace(oldSysPrompt, newSysPrompt);
  fs.writeFileSync("index.mjs", final, "utf8");
  console.log("✓ Done - replaced VISUAL_PLANNING_SP with compact version");
}
