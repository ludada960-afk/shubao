# 44 · P1c 实施简报：图片生成 Hub 落地

> 上游依据：`docs/design/43-media-architecture.md`（§3 信息架构、§4 设计语言、§5 Skill 契约、§10 知渔实测结构）。
> 前置依赖：P1a 的 `src/components/media/`（MediaAssetCard / CaseCard / WorkbenchShell）。

## 目标（可验收）
图片生成板块 = **一个 Hub 页面 + 一个 Skill 工作台页面**，全部由声明式 Skill 配置驱动。

## 必须遵守的实测结论
1. **单页渲染**：工作台走 `?id=<skillId>`（知渔同构），**不新增页面文件**。
2. **封面统一 4:3**；案例卡上只有「封面 + 标题」两个元素；分组标题分隔。
3. **分组骨架**（借实测 8 类，按我们能力删减）：精品推荐 · 电商专区 · 创意应用 · 人像摄影 · 图片编辑 ·（视频另有其 Hub）。
4. **工作台**：左配置 + 右「示例 / 历史」；复刻/修图类 Skill 的示例用**原图 ↔ AI 成品对比**。
5. 字段名极简（如「比例」「清晰度」），必填打 `*`，上传按钮文案全站统一。

## Skill 声明（`src/skills/imageSkills.js`，单一事实源）
每条：`{ id, board:"image", name, category, complexity, cover:{template,accent}, fields[], pipeline, cases[], history }`。
一期 6 条：
| id | 名称 | 复杂度 | pipeline（复用现有引擎，不重写） |
|---|---|---|---|
| image.free | 自由创作 | simple | 现有 visual creation 链路 |
| image.poster | 海报设计 | simple | 同上 |
| image.social_cover | 社媒封面 | simple | 同上 |
| image.product_suite | 电商商品套图 | heavy | 现有 EcMode/EcommerceWorkbench 面板整体嵌入 |
| image.white_bg | 白底商品图 | standard | 现有内置技能 |
| image.try_on | 模特上身/试穿 | standard | 现有内置技能 |
| image.xhs_note | 小红书种草图文 | standard | 现有 XhsContentMode |

## 硬规则
- 老入口**继续可用**（兼容期）：不删 EcMode / XhsContentMode / VisualCreationMode 的任何现有能力，只新增 Hub 与统一工作台。
- 每步 `npm run precommit` 全绿才提交；提交用 pathspec；不部署（由统筹在主线统一部署核验）。
- 视觉一律走 `--sb-*` token；两板块（图片/视频）必须共用 P1a 的组件，不得各自手写卡片。
- 字段渲染必须走 `FieldRenderer`（P1a 交付物之一）；页面里不得再手写 model/resolution/count 控件。

## 判据（写进门禁，不许弱化）
1. Hub 的每个分组标题与其下的案例卡数量可断言；每张卡可点击进入 `?id=`。
2. 6 条 Skill 全部能进入工作台并渲染出字段（无空白页、无"未实现"）。
3. 工作台右侧「示例/历史」两页签存在，示例空态可读。
4. 图片与视频两侧的卡片组件来自同一模块（源码断言，P1a 门禁的延伸）。

## 交付
- `src/skills/imageSkills.js`（声明源）+ Hub 页面 + 工作台页面 + 门禁测试（挂 BLOCKING）。
- 回报：新增/改动文件清单、门禁断言条数、`npm run precommit` 结果、commit hash、以及**未做项**（如实列出）。