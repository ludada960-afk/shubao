# 电商能力配方与万物上身设计

**日期：** 2026-08-11  
**状态：** 已授权自主实施，首期进入实现  
**范围：** 电商生图工作台的可扩展能力配方架构，首个配方为“万物上身”

## 1. 决策摘要

“万物上身”不是第五个首页顶层产品，也不是一个把输入框文案换掉的孤立按钮。电商生图的长期信息架构采用 **电商能力配方（commerce ability recipe）**：每个配方都声明自己的输入槽、结果承诺、保留规则、适用场景、模型路由和示例展示；工作台根据当前配方动态切换素材槽和参数提示。

首期提供两个配方：

1. **商品套图**（`product_suite`）：现有默认流程，保持产品图 + 参考图 + 套图配置的行为与账务不变。
2. **万物上身**（`anything_tryon`）：商品/服饰多图 + 模特图 + 可选场景图，生成符合商品事实和穿搭关系的模特商品图。

后续的鞋履试穿、配饰上身、换姿势、换场景、服装换色等能力只新增注册表条目和对应的后端策略，不再复制一套页面。

## 2. 调研与边界

### 2.1 竞品实际工作流

对 `marketing.k-fashionshop.com` 的公开页面进行实际交互后，万物上身的稳定模式是：

- 商品侧支持最多五张商品素材，可从资源库导入；
- 模特侧在“智能模特”和“参考模特图”之间切换；
- 参考模特模式允许每张参考图独立处理；
- 另有可选的场景、描述、比例、清晰度和生成数量；
- 示例区用“输入商品 + 输入模特/场景 -> 输出结果”的关系解释能力，而不是只展示一个技能名称；
- 结果示例和“做同款”画廊承担了降低首次使用理解成本的作用。

`liuyingai.cn/clothing-studio` 的工作流进一步验证了几个必要输入：商品多角度图、模特图、可选场景图、细节要求，以及上传、分析、方案预览、生成、完成五个状态。它的字段组织可借鉴，但本产品不复制其页面布局。

### 2.2 开源模型的商业限制

以下项目适合做技术基准和未来适配研究，但不能未经授权直接作为薯包的生产商用后端：

- [CatVTON](https://github.com/Zheng-Chong/CatVTON)：单衣物试穿能力强，许可证为 CC BY-NC-SA 4.0。
- [IDM-VTON](https://github.com/yisol/IDM-VTON)：依赖人体解析、DensePose/OpenPose 等预处理，许可证为 CC BY-NC-SA 4.0。
- [OOTDiffusion](https://github.com/levihsu/OOTDiffusion)：上装、下装、连衣裙分类试穿，许可证为 CC BY-NC-SA 4.0。
- [FastFit](https://github.com/Zheng-Chong/FastFit)：更接近多件服饰/鞋/包的多参考场景，但其非商业许可证要求生产或商业使用另行取得授权。

因此首期不把“下载权重并在服务器上自托管”当作交付方案。现有已接通并具备账务、稳定资产和重试能力的商业图像编辑路由作为默认执行路径；专用 VTON 路由必须同时满足商业授权、输入/输出质量基准、并发容量和成本 canary，才可以加入注册表。

### 2.3 能力承诺边界

“万物上身”首期承诺的是 **商品视觉合成**，不是尺码级的虚拟试衣测量，也不保证复杂多层服饰在每一种姿势下都完全符合真实版型。界面必须明确：

- 服饰、鞋包和配件会尽量保留颜色、材质、结构、图案、标识和数量；
- 提供模特图时尽量保留人物身份、体态和姿势；
- 提供场景图时将其作为环境参考，不把场景中的其他商品当成输入商品；
- 复杂遮挡、透明材质、极端姿势或商品信息不足时，结果需要人工复核。

## 3. 用户体验设计

### 3.1 工作台层级

在现有电商工作台标题下增加一条紧凑的能力配方栏。配方卡必须同时展示：

- 原创示例缩略图或输入/输出关系图；
- 名称和一句结果描述；
- `保留`、`结果`、`适合` 三组可扫描信息；
- 当前选中态、键盘焦点态和移动端横向可滚动但不造成页面级横向溢出。

选择配方只改变当前工作台的输入合同和提示词策略，不清空用户已经上传的素材；无法映射到新槽位的素材保留在“待整理素材”区域，并给出明确迁移提示。

### 3.2 万物上身输入合同

选中 `anything_tryon` 后，上传区切换为三类明确的素材槽：

| 槽位 | 数量 | 用户看到的文案 | 语义 |
|---|---:|---|---|
| 商品与穿搭 | 1-5 | 商品、服饰、鞋包或配件 | 生成结果必须服从的商品事实 |
| 模特参考 | 0-1 | 目标人物、姿态或身形参考 | 人物身份/姿态参考；空缺时使用智能模特 |
| 场景参考 | 0-1 | 环境、光线或构图参考 | 只提供环境与视觉关系，不替代商品 |

“图片 / 视频 / 音频”不再作为与新增卡片并列的第二套上传入口。它们是素材类型筛选和可接受格式说明，统一放在对应槽位的上传动作及拖拽态中；底部工具栏不再重复放置加号上传按钮。

模特槽提供两个明确模式：

- **智能模特**：没有人物图也可以生成，用户只需描述年龄段、气质、体态、姿势和地区等非敏感视觉要求；
- **参考模特图**：用户上传一张人物参考，系统尽量保留人物身份和姿势。

场景槽为空时由提示词生成中性商业场景；有场景图时默认保留空间关系、光向和色调，但不复制其中未授权的品牌或人物。

### 3.3 结果说明面板

配方选择器旁提供“看懂结果”轻量面板，不用打开新页面。面板固定呈现：

1. 输入关系：商品 + 模特 + 场景（可选）；
2. 结果预期：例如“保留商品细节，生成自然穿搭与真实接触阴影”；
3. 适合任务：上新主图、穿搭展示、场景化商品图；
4. 注意事项：多件叠穿和复杂遮挡需要复核。

同时在配方栏下保留一组原创案例轮播。案例必须由薯包自行生成或合法授权，不能直接使用竞品截图、竞品素材或其网页资源。案例数据和 UI 分离，未来可以仅增添 manifest 与图片，不改工作台组件。

### 3.4 现有流程兼容

- 默认 `product_suite` 继续使用现有商品图、参考图和套图参数。
- “下一步”请求增加配方和角色清单，但旧请求缺省归一化为 `product_suite`。
- 生成按钮、报价、积分扣除、任务抽屉、Works 和 Canvas 的入口保持原有位置和交互语义。
- 页面刷新、任务恢复和从 Works 再编辑时，配方及角色清单必须恢复，不能退回默认商品套图。

## 4. 数据与接口设计

### 4.1 配方注册表

新增共享纯数据模块 `shared/ecommerceAbilityRecipes.mjs`，导出：

```js
export const ECOMMERCE_ABILITY_RECIPES = Object.freeze([...]);
export function getEcommerceAbilityRecipe(id = 'product_suite') { /* returns immutable normalized recipe */ }
export function normalizeEcommerceAbilityRequest(input = {}) { /* returns safe request contract */ }
```

每个配方至少包含：

```js
{
  id: 'anything_tryon',
  version: 1,
  label: '万物上身',
  summary: '把商品组合到模特身上，生成可用于电商展示的穿搭画面',
  preserves: ['商品颜色、材质、结构和数量'],
  outcome: '自然穿搭、接触阴影和场景化商品视觉',
  bestFor: ['上新主图', '穿搭展示', '场景化商品图'],
  inputSlots: [
    { id: 'items', label: '商品与穿搭', min: 1, max: 5, required: true },
    { id: 'person', label: '模特参考', min: 0, max: 1, required: false },
    { id: 'scene', label: '场景参考', min: 0, max: 1, required: false },
  ],
  outputProfile: { kind: 'commerce_suite', allowedRatios: ['1:1', '3:4', '4:5', '9:16'] },
  routePolicy: { provider: 'ecommerce-image-edit', specializedProvider: null },
  promptPolicyId: 'anything_tryon_v1',
  examples: [{ id, inputAssetUrls: [], outputAssetUrls: [], caption: '' }],
}
```

运行时只能接受注册表中的 `id`、正整数 `version` 和槽位角色白名单。客户端不能提交系统提示词、供应商模型名或任意路由。

### 4.2 请求格式

在现有 `/api/generate-ecommerce` body 中增加：

```json
{
  "ability_recipe": { "id": "anything_tryon", "version": 1 },
  "asset_roles": [
    { "assetId": "asset-item-1", "role": "items", "ordinal": 0 },
    { "assetId": "asset-person-1", "role": "person", "ordinal": 0 },
    { "assetId": "asset-scene-1", "role": "scene", "ordinal": 0 }
  ],
  "assets": {
    "product": [],
    "reference": [],
    "person": [],
    "scene": []
  }
}
```

`product_suite` 仍把旧的 `product` 和 `reference` 解释为原语义。`anything_tryon` 将 `product` 映射为 `items`，`person` 和 `scene` 使用新增正式分组；兼容旧客户端时缺省分组为空，不猜测角色。

### 4.3 任务与作品快照

以下字段进入经过 `sanitizeSnapshot` 的任务 payload、orchestration snapshot、Works input snapshot 和 Canvas source snapshot：

```js
abilityRecipe: { id, version, promptPolicyId },
assetRoles: [{ assetId, role, ordinal }],
```

持久化只保存稳定 asset ID、稳定生成 URL、角色和用户可编辑文本，不保存临时 blob/data URL、原始字节、API key 或隐藏提示词。

Canvas 继续保留通用 `productAssets` / `referenceAssets` 兼容字段，同时增加 `abilityRecipe` 和 `roleAssets`；老作品读取时按 `product_suite` 恢复。

## 5. 服务端生成策略

### 5.1 角色归一化

新增 `server/ecommerceEngine/abilityRecipeContract.mjs` 负责：

- 读取并校验注册表；
- 校验槽位数量、asset 所有权、重复 ID 和 ordinal；
- 将正式分组转换为编排器使用的 role-aware asset map；
- 对未知配方、未知角色和版本不匹配返回可定位的 4xx 错误；
- 对旧 payload 输出 `product_suite@1`。

### 5.2 视觉分析

`anything_tryon` 下：

- `items` 进入商品事实分析，是商品身份唯一权威；
- `person` 进入人物/姿态分析，不得被归类成风格参考或商品；
- `scene` 进入环境/光影分析，不得作为商品事实；
- 没有 person 时生成 deterministic smart-model brief，不将空图伪装成参考素材。

分析失败时沿用现有可恢复 fallback；如果必要输入不满足，生成前即在客户端和服务端阻止，不产生账务 hold。

### 5.3 提示词合同

`anything_tryon_v1` 必须把以下规则编译到每个资产请求：

- 只使用 `items` 列出的商品，不新增或删除服饰、鞋、包、配件；
- 保留商品轮廓、颜色、材质、图案、五金、标识和相对数量；
- 保留 `person` 的身份、脸部、体态和姿势，除非用户明确要求变化；
- 根据人体比例完成合理穿着、接触、遮挡、重力和阴影；
- `scene` 只影响环境、构图和光线，不能改变商品事实；
- 不复制参考图中的品牌、文字、人物或其他商品；
- 文字生成不承诺精确尺码、版型测量或法律意义上的试衣结果；
- 失败质量检查保留结果并进入现有 needs-review/定向修复链路。

商品套图现有提示词和保护规则不得被新配方覆盖；编译器根据 recipe strategy 分支，避免“万物上身”语义泄漏到默认流程。

### 5.4 路由与成本

首期复用现有已计费的电商图像编辑供应商，不新增积分价格。配方可以声明未来的 `specializedProvider`，但当前必须为 `null`，由服务端拒绝客户端强制指定。

以后接入专用 VTON 时，路由必须通过：商业许可记录、真实输入基准集、成功率/延迟/并发/成本 canary、熔断和降级策略；不能仅因为 GitHub star 或竞品页面展示就上线。

## 6. 错误与安全

- 未登录、余额不足、上传失败、任务失败继续使用现有错误码和可恢复动作。
- 角色缺失、数量超限、跨用户 asset ID、重复 ID、非法 URL 和未知配方均在计费前拒绝。
- API 响应不得回显供应商 key、内部 prompt 或未授权的原始路径。
- 并发沿用全局图像队列和任务 lease；同一提交使用稳定 draft/idempotency key，不能重复扣费。
- 上传区只接受当前槽允许的 MIME/大小；视频和音频不是首期“万物上身”输入类型，必须在前端和服务端同时拒绝。

## 7. 测试与验收

### 单元与契约

- 配方注册表返回稳定顺序、不可变字段和正确默认回退；
- 输入槽校验覆盖缺失、超限、重复、未知角色和旧 payload；
- API body 正确发送 `ability_recipe`、`asset_roles` 和正式分组；
- 提示词区分商品、人物和场景，并确认默认商品套图不受影响；
- 任务、Works、Project/Canvas snapshot 恢复配方和角色；
- 原有电商测试和完整测试不回归。

### 浏览器

- 桌面和 390px：配方栏、动态槽、结果说明面板无横向溢出；
- 点击配方不会丢失素材；从商品套图切到万物上身后角色映射正确；
- 上传、删除、拖拽、键盘焦点、Esc 关闭说明面板、`prefers-reduced-motion` 可用；
- 无真实付费生成：使用 mock route/fixture 验证 queued、partial、failed、needs-review；
- 检查控制台错误、图片解码、文字重叠和固定底栏遮挡。

### 交付门槛

只有完整测试、构建、协作检查、生产配置验证、浏览器 QA 和 `git diff --check` 均通过，才可进入部署流程。没有真实生产 canary 证据时，不宣称已上线。

