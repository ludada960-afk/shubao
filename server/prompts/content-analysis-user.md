▶ 文案是旅行内容 → 生成旅游攻略
▶ 文案是产品介绍 → 生成好物评测
▶ 文案是美食体验 → 生成美食探店
▶ 文案是护肤美妆 → 生成美妆护肤
▶ 文案是穿搭描述 → 生成穿搭分享
▶ 文案是学习经验 → 生成学习干货
▶ 文案是职场心得 → 生成职场干货
▶ 文案是影视/书籍 → 生成影视推荐/书单
▶ 文案是健康养生 → 生成健康养生

【强制】所有内容必须使用简体中文，**禁止输出任何英文**。菜品名、品牌名、产品名都必须用中文写。例如"coffee"写"咖啡"，"restaurant"写"餐厅"。
▶ 文案是家居改造 → 生成家居家装
▶ 文案是情感抒发 → 生成情感共鸣
▶ 文案是亲子育儿 → 生成育儿知识
生成的内容主题必须与文案一致，不能偏差。如果文案提到具体地名（如云南、大理），标题和正文必须保留这些地名。

品类：根据文案内容自动判断品类
检测到的品类：{{detected_category}}

严格按照以下JSON结构输出，不要输出任何多余内容。

**body_text字数由赛道决定（干货类300-500字，种草类200-350字，视觉类150-250字），严禁超出上限**。

**重要：category字段必须在JSON开头位置填写**
品类可选值：旅游攻略 | 好物评测 | 美食探店 | 穿搭分享 | 美妆护肤 | 美妆·化妆教程 | 数码3C | 学习干货 | 职场干货 | 家居家装 | 健身减肥 | 情感共鸣 | 影视推荐 | 一人食 | 书单推荐 | 美甲 | 健康养生 | 育儿知识 | 养生花茶

**pages数组必须包含8个元素（page_id 1-8），全部为内容页**

{
  "category": "此处填写品类名，从上方列表选一个",
  "title": "标题（红鸦式，参考【标题公式】）",
  "body_text": "完整正文（干货≤500字，种草≤350字，视觉≤250字）",
  "hashtags": ["#标签1", "#标签2"],
  "tags": [],
  "pages": [
    {"page_id":1,"page_type":"content","title":"页标题","hook":"一句话钩子","story":"核心内容（按赛道字数限制）","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":2,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":3,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":4,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":5,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":6,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":7,"page_type":"content","title":"延伸/对比","hook":"补充钩子","story":"横向对比或深度延伸","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":8,"page_type":"content","title":"总结推荐","hook":"互动引导","story":"总花费+推荐理由+CTA","info_blocks":[{"label":"总计","value":"金额"}],"layout_hint":"总结卡片+互动引导"}
  ]
}


=== 输入内容 ===
文案：
{{text_content}}

必须严格按照以上JSON结构输出，不要输出任何多余内容。`;