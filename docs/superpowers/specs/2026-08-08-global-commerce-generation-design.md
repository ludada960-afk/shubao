# 全球电商生图上下文设计

## 目标

让同一套电商生图流程能够明确服务国内外平台，并且让目标平台、目标语言、内容类型和平台交付约束真正影响第二步设计方案、逐张规划、提示词、画布标签、导出命名和作品元数据。

## 调研结论

- Amazon Listings API 支持 1 张主图和最多 9 张辅图；A+ 内容由多个模块组成，图片仍需符合商品图片要求。[Amazon Listings](https://developer-docs.amazon.com/sp-api/lang-zh/docs/building-listings-management-workflows-guide) [Amazon A+](https://developer-docs.amazon.com/sp-api/lang-en_US/docs/create-edit-publish-aplus-content)
- TikTok Shop 的商品图强调完整商品、白底首图、无水印/营销文字、至少 600x600，并建议多角度、细节、场景、规格和尺度信息；部分站点限制为最多 9 张方图。[TikTok Shop listing quality](https://seller-us.tiktok.com/university/essay?from=feature_guide&identity=1&knowledge_id=481891871868714&role=1) [TikTok Shop product listing](https://seller-us.tiktok.com/university/essay?knowledge_id=6581713858676522&lang=en)
- 平台规则会随站点、类目和账号状态变化，因此产品只把已验证条目标为硬约束，其他条目显示为发布前建议，不把经验尺寸伪装成官方规则。
- 国际化不能只翻译图片文字。还需要处理单位、货币/数字格式、阅读方向、禁用或受限表达、平台图片数量/比例、商品事实保护和变体规格展示。

## 统一生成上下文

```text
commerceContext = {
  platform: stable platform id,
  contentType: main | detail | ad,
  targetLanguage: visual | zh-CN | zh-TW | en | ...,
  locale: locale used for units and copy conventions,
  requestedImages: normalized role/count/ratio list,
  platformPolicyVersion: immutable policy snapshot id,
}
```

`targetLanguage=visual` 表示纯视觉，不生成后加文字；确认事实的尺寸、材质、容量、颜色和 SKU 差异只通过确定性文字层渲染。模型不可猜测规格，不可把参考图商品当成当前商品。

## 交互设计

- 套图配置浮层改为三个内容类型分段：主图、详情图、广告图。
- 平台选择采用分组下拉：国内平台、跨境平台；保留“智能匹配”，并展示当前选中平台的交付摘要。
- 语言选择提供“无文字（纯视觉）”和常用市场语言；语言选项显示本地名称与代码，避免用户误解。
- 平台切换只替换智能默认套图，不覆盖用户已经手动编辑的数量、比例或 SKU；切换后显示一条可撤销的变更提示。
- 面板内所有下拉浮层通过 Portal/稳定 z-index 越出工作台容器，不被面板截断；移动端采用全宽底部浮层。

## 端到端影响面

1. 第一步保存 `commerceContext` 与旧字段兼容值。
2. 第二步请求设计方向时传入平台、内容类型、语言和已解析套图；方案摘要展示“市场/平台/语言”。
3. 服务端规划器把上下文写入视觉分析与创意总监提示词，并把每张图的职责、角度、语言和平台约束写入方向与 asset plan。
4. 生图请求、确定性规格叠加和平台导出目标读取同一份上下文快照。
5. 画布节点、作品归档和导出文件名保留平台/语言/内容类型元数据，后续恢复不会依赖当前 UI 默认值。

## 非目标

- 本阶段不直接调用各平台发布 API，不凭空声称能自动上架。
- 不为每个平台硬编码未经验证的尺寸；像素输出仍由合法模型尺寸和确定性导出缩放负责。
- 不替换现有图像引擎；先建立可审计上下文边界，后续可在 provider adapter 层增加按市场路由。

## 验收

- 至少覆盖 12 个国内/跨境平台和 20 个目标语言值，未知值 fail-closed 到智能推荐或无文字。
- 目标平台/语言/内容类型在第一步、第二步请求、服务端提示词、asset plan、Canvas 元数据和作品保存中可追踪。
- Amazon 与 TikTok 的白底、文字、水印、图片数量等已验证约束不被普通广告图策略污染。
- 现有国内默认流程、计费、任务恢复、画布和导出回归不改变。
