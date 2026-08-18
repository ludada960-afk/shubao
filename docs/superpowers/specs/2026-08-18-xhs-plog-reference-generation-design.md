# 小红书图文与 Plog 参考素材生成设计

## 背景与目标

当前小红书图文已经从旧版“按赛道固定页序”升级为动态创意方向，但上传图片仍然只有一个含义：参考图。结果是：

- 小红书图文可以分析上传图的色调、构图和信息层级，但没有明确区分“借鉴风格”和“保留我的主体”；
- 所有上传图只进入视觉分析，不会在需要保留用户商品、人物、房间、宠物或真实物件时进入图生图输入；
- Plog 只有一张参考图，服务端只抽取一张图的色调，不能形成真实的生活素材组；
- 现有动态提示词虽然不再锁死赛道，但质量护栏仍然过于泛化，难以稳定达到 `薯包出品` 案例中的“每页有职责、整组有推进、版式有变化”的水平。

本设计的目标是：

1. 保留动态创意方向和自由发挥能力，同时把旧赛道研究转为软性质量护栏。
2. 让用户明确知道每张上传图的用途：风格参考只做视觉分析，生活/主体素材才会进入图生图。
3. 将 Plog 改成“生活素材 + 风格参考”的素材组，支持最多 6 张生活素材和 3 张风格参考。
4. 复用电商工作台已经验证的多角色上传语义、缩略图、删除和批量上传行为。
5. 保持旧客户端和旧作品兼容，不要求真实付费生图来完成代码验收。

## 研究结论

### 用户与案例证据

`薯包出品` 的案例质量不是靠一套固定模板，而是靠四个稳定底线：

- 封面有明确钩子，主体、标题和信息价值一眼可读；
- 内容页每页只有一个阅读任务，但页面职责会在证据、步骤、对比、细节、总结之间变化；
- 文字层级、中文信息和画面主体严格对应，不能只生成漂亮但无信息的图；
- 整组有视觉系统，但会主动改变景别、构图、密度、背景材质和节奏。

旧调研报告中的旅游、测评、穿搭、教程、书单等页序继续保留，但只作为 `playbook`：提供该类内容常见的任务、证据类型、视觉语法和禁区，模型可以选择、重排、合并或跳过，不再强制 P1-P8 固定对应关系。

Plog 的成熟用户需求是“像一段被认真整理过的相册”，而不是九张相同滤镜的宣传图：需要开场锚点、环境关系、人物/动作、物件细节、节奏变化、一张有意保留的不完美或留白帧，以及比开场更安静的收尾。

### 成熟产品的参考图分层

调研得到的成熟做法都把参考图按责任分层：

- OpenAI Image API 支持用一张或多张图作为新图参考，也区分生成、编辑和多轮编辑；但输入图会以高保真方式处理，参考图越多，输入成本与约束越高。
- Adobe Firefly 把 `style reference` 与 `structure reference` 分开：前者影响色彩、材质、光线和整体气质，后者影响轮廓、景深和构图关系。
- Midjourney 把 Image Prompt、Style Reference、Omni Reference 分开；Style Reference 不复制人物或物件，Omni Reference 专门保留人物/物件，且 Omni 只接受一张图。
- Runway Gen-4 References 支持最多三张参考图，并建议按角色拆分人物、物件、环境；多图用于精确控制不同元素，单图用于保留主体的一致性。
- Google Gemini 图像模型和阿里云 Wan 图像模型都支持多图输入，但不同模型对主体、角色和风格参考的数量上限不同，不能把“支持多图”理解成任意数量、任意语义的无脑拼接。

因此本产品采用两类主角色，保留后端可扩展的第三类结构角色：

| 角色 | 用户看到的名称 | 默认处理 | 适用输入 |
| --- | --- | --- | --- |
| `style` | 风格参考 | 视觉分析；不直接进入图生图 | 喜欢的案例、色调、版式、光线、材质、氛围 |
| `source` | 我的素材 / 生活素材 | 视觉分析 + 按任务选择性进入图生图 | 用户自己的商品、人物、房间、宠物、食物、旅行照片、物件 |
| `structure` | 构图参考 | 当前 UI 不单独暴露；保留协议位 | 未来需要明确复用构图轮廓但不保留主体时 |

## 生成逻辑

### 小红书种草图文

生成链路固定为：

```text
用户主题
  + 风格参考 -> 视觉分析（色调/字体气质/版式/节奏/可复用原则）
  + 我的素材 -> 视觉分析（可验证主体/事实/环境/物件）
                 |
                 v
动态创意方向 -> 内容简报 -> 软性 playbook 约束 -> 8 个页面职责
                 |
                 v
封面 + 8 页视觉规划 -> 每页选择是否需要 source 输入
                 |
                 v
风格参考不进图生图；source 仅在本页需要保留主体/环境时进入图生图
```

小红书图文的 source 路由规则：

- 封面最多使用 3 张 source，适合用户希望展示同一件物品的不同角度或一组旅行照片；
- 内容页默认使用 1 张最相关 source；一张 source 时可被多个页面复用以保持主体一致；多张 source 时按页面职责轮换，不把全部素材塞给每页；
- `comparison`、`collage` 等明确需要并列事实的页面可以使用 2 张 source；
- 没有 source 时仍然使用纯文本生图，旧行为不被破坏；
- style 永远只通过视觉分析摘要进入提示词，不直接把案例图复制进输出，避免把参考图的文字、人物、商品和具体构图原样带入；
- 用户未明确选择 source 的旧 `referenceAssetIds` 按 `style` 兼容处理，不突然改变历史调用的语义。

内容质量护栏：

- 页面职责必须覆盖至少四种不同任务，不能九张图都只是“展示”；
- 每一页必须有事实来源、视觉主体、构图职责、文字区域和与相邻页不同的变化点；
- 旧赛道 playbook 只提供“应优先检查什么”和“哪些事实不能臆造”，模型仍可根据输入选择结构；
- 当用户内容事实不足时，输出审美型、观察型或整理型内容，不虚构价格、地点、效果、评分、经历和品牌信息；
- 对 `薯包出品` 这类信息图案例，允许标题、标签、路线、对比、卡片和手账等视觉语法，但必须由当前页面事实驱动，而不是只复制案例的外观。

### Plog 生活碎片

Plog 的默认素材模型改为：

- `生活素材`：最多 6 张，代表用户真实想保留的人、物、空间和事件；会按镜头职责进入图生图；
- `风格参考`：最多 3 张，代表色调、颗粒、构图、纸张、排版或摄影氛围；只做分析，不作为主体来源；
- 文本描述：决定这组照片发生的时间、地点、情绪和用户想记录的瞬间；
- 风格/排版选择仍然保留，作为用户可见的偏好，不再替代素材语义。

Plog 的质量 floor 是“生活叙事覆盖”，不是固定九页模板。动态导演从下列软性镜头职责中选取并可以改变顺序：

`anchor`、`context`、`subject`、`action`、`detail`、`texture`、`pause`、`imperfect`、`closer`。

至少保证：一个锚点、一个环境关系、一个细节、一个动作或人物状态、一个节奏缓冲、一个收尾。用户上传生活素材时，镜头会将素材绑定到合适职责；没有素材时保持文本生成，但提示词仍要求自然、不完美和景别变化。

## 接口契约

新请求字段：

```json
{
  "referenceAssets": {
    "style": ["asset-id-1"],
    "source": ["asset-id-2", "asset-id-3"]
  }
}
```

兼容字段：

- `referenceAssetIds` 继续有效，并等价于 `referenceAssets.style`；
- `images` / `refImage` 继续用于未登录预览，按旧客户端语义等价于 style；
- 新的 preview 和登录流程都可以直接传数据 URI，服务端不把不可信的浏览器临时 URL 作为持久输入。

图像供应商适配器已经支持多张 `inputAssets`，本轮只扩展上层路由，不修改供应商协议和模型目录。`callImageAPI` 将接受单个或数组 data URI，只有 source 任务才传入数组。

## UI 交互

小红书图文和 Plog 共用一个轻量 `ContentReferencePicker`，视觉上复用电商工作台的角色上传语言：

- 两个并列素材槽：风格参考、我的素材/生活素材；
- 每个槽显示数量上限、已上传缩略图、删除按钮、继续添加入口和一句用途说明；
- 小红书默认把已有“参考图”放在风格参考槽，旧用户不会突然从“参考案例”变成“被改造的原图”；
- Plog 默认展示两个槽，生活素材槽优先，风格参考槽可选；
- 上传控件支持批量选择、拖拽和粘贴已有单图行为；
- 生成前不展示内部 prompt，但展示一句可读的计划说明，例如“本次会保留你的生活素材主体，并借鉴风格参考的色调”；
- 结果保留 `creative_direction`、`creative_brief` 和 `reference_usage`，便于用户理解这一套图为什么这样生成。

## 非目标与风险控制

- 本轮不把旧赛道模板全部删除；它们仍作为 fallback 和质量检查依据。
- 本轮不把所有参考图都强制改成图生图；style 直接图生图会把案例文字、构图和主体带入，且会提高输入成本并降低主题自由度。
- 本轮不自动触发真实付费图片或视频生成；使用纯函数测试、构建和本地浏览器检查验证链路。
- 多 source 不能保证供应商始终严格保留每个主体；系统通过按任务选择、提示词中明确角色和结果完整性检查降低风险，后续可在质量反馈中增加人工重选 source。

## 研究来源

- [OpenAI Image Generation Guide](https://developers.openai.com/api/docs/guides/image-generation)
- [Adobe Firefly Style Image Reference](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/style-image-reference/)
- [Adobe Firefly Structure Image Reference](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/structure-image-reference/)
- [Midjourney Image Prompts](https://docs.midjourney.com/hc/en-us/articles/32040250122381-Image-Prompts)
- [Midjourney Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)
- [Midjourney Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference)
- [Runway Gen-4 Image References](https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References)
- [Google Nano Banana image generation](https://ai.google.dev/gemini-api/docs/interactions/image-generation)
- [Alibaba Wan image generation and editing API](https://help.aliyun.com/en/model-studio/wan-image-generation-and-editing-api-reference)
