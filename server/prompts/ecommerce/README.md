# 电商 Prompt 模板（参考存档）

> ⚠️ 这些模板文件是 **历史参考存档**，当前未被任何运行时代码引用。
>
> 实际的提示词构建逻辑已内联在 `server/ecommercePromptEngine.mjs` 的 `buildRolePrompt()` 函数中（switch/case 各角色分支）。
>
> 如需重新启用模板加载，需要在 `buildRolePrompt()` 中调用 `loadPrompt()` 替换对应的 case 分支。

## 文件说明

| 文件 | 对应角色 | 说明 |
|------|---------|------|
| `white-bg-main.md` | `white_bg` | 白底主图结构化模板（含 JSON Schema + 品类定制） |
| `scene-image.md` | `scene` | 场景图模板（7品类场景定制） |
| `detail-image.md` | `detail` | 详情图模板（卖点标注体系） |
| `combo-image.md` | `composite` | 组合图模板（多面板品牌展示） |
