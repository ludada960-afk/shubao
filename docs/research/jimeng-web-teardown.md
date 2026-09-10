# 即梦 AI 网页版（jimeng.jianying.com/ai-tool）全功能与交互拆解

> 调研时间：2026-09-10 13:00–14:20（CST）｜站点版本：`web_version=7.5.0` / `da_version=3.3.27` / `aid=513695`
> 调研方式：**受控 Chrome（Playwright + channel:chrome）驱动真实页面 + 直读官网接口返回 + 反查前端 JS bundle 路由表**。
> 原始素材：`.tmp-research/jimeng/`（截图、DOM dump、30+ 接口 JSON、bundle 路由表、UI 文案日志）。
> 复现脚本：`.tmp-research/jimeng-*.mjs`。

---

## 0. 先说结论：**登录态没拿到，因此"生成器内部"大面积未确认**

这一节必须先写，否则后面的"未确认"会显得莫名其妙。

### 0.1 尝试过的路径与结果

| 路径 | 结果 |
|---|---|
| ① 复用现成配方 `.tmp-research/chrome-profile`（照抄知渔配方） | ❌ 打开即 `请先登录`；`/passport/account/info/v2/` 返回 `{"description":"会话过期，请重新登录","error_code":13}` |
| ② VSS 快照拷**真实** Chrome profile（本次新做，admin 权限可用） | ✅ 读到了登录 cookie，但**解不开**（见 0.2） |
| ③ 附着本机正在运行的 Chrome（`127.0.0.1:9222` 有监听） | ❌ Chrome 152 对默认 profile 的 DevTools 端口做了缓解：`/json/version` 全部 **404**，ws 握手直接超时 |
| ④ 直接构造 API 请求绕过 UI | ❌ 所有 `/mweb/v1/*` 需要 `msToken` + `a_bogus` 签名，裸调一律 404 |

### 0.2 根因：Chrome 的 App-Bound Encryption（这是本次真正的拦路虎，值得记进 RTK）

- VSS 快照读到的真实 `Default/Network/Cookies` 里，`.jianying.com` 域下**有完整的登录 cookie**（29 条）：
  `sessionid / sessionid_ss / sid_tt / sid_guard / sid_ucp_v1 / ssid_ucp_v1 / uid_tt / uid_tt_ss / odin_tt / passport_csrf_token / n_mh / dm_auid / user_spaces_idc / has_biz_token / is_staff_user`（有效期到 2027-09-10）。
- 但**所有 cookie 密文前缀都是 `v20`**（App-Bound Encryption），不是老的 `v10`（DPAPI+AES-GCM）。
- `Local State` 里同时存在 `os_crypt.encrypted_key`（v10 用）与 `os_crypt.app_bound_encrypted_key`（v20 用）。
- 把 profile **复制到另一个 user-data-dir** 后启动 Chrome：ABE 密钥拿不到 → Chrome 把解不开的 cookie **直接删掉**，只把站点会重新下发的非鉴权 cookie 用 `v10` 重写。
  - 实测证据：复制版启动后 `ctx.cookies()` 只剩 **9 条**（`ttwid / _tea_web_id / _uetsid / _uetvid / s_v_web_id / uifid / uifid_temp / fpk1 / 主题`），且新写入的 cookie 前缀是 `v10`。
- 结论：**"复制 profile 拿登录态"这条路对即梦（Cookie 鉴权 + ABE v20）已经失效**；知渔能用是因为它的登录态在 localStorage 里的 JWT，不走 Cookie。

> 我**没有**去实现 ABE 绕过（调 elevation service 解 v20 密钥）。那属于对浏览器安全机制的规避，超出本次调研授权范围。
> 如果后续要拿即梦登录态，正解是：**用户在自己的 Chrome 上手动导出**，或**用一个全新 Chrome 实例让用户扫码登录一次**——两者都需要用户配合。

### 0.3 因此本报告的置信度分级

- **【实】**：本次实测（页面 DOM 原文 / 接口返回原文 / bundle 反查）。
- **【未确认】**：需要登录才能看到，本次未获得。
- **【二手】**：公开报道/第三方站点，仅作补充，已单独标注。

---

## 1. 登录态与一级导航

### 1.1 登录门（实测文案原文）

未登录时的拦截形态有两层：

1. **路由级**：除 `/ai-tool/home`、`/ai-tool/explore`、`/ai-tool/action`、`/ai-tool/work-detail/:id` 外，**其它所有路由都被重定向回 `/ai-tool/home`**。
   实测：`/ai-tool/generate`、`/ai-tool/asset`、`/ai-tool/assets-canvas`、`/ai-tool/jimeng-api` → 全部 302 回首页。
2. **组件级**：点"资产/主体/对话/画布"→ 弹登录抽屉，原文：

```
欢迎登录即梦
发送验证码
登录
其他登录方式
已阅读并同意用户服务协议、隐私政策、AI功能使用须知
```

顶栏常驻的两个登录位文案：`请先登录`（头像位）、`登录`（按钮位）。

### 1.2 一级导航（顶栏，实测 button 文本）

`去首页 | 创作 | 探索 | 资产 | 主体 | 对话 | 新建对话 | 请先登录 | 画布 | 全部 | 新建画布 | 更多设置 | 生成 | 去查看 | /`

也就是说**六个一级入口**：

| 一级入口 | 登录要求 | 本次可见度 |
|---|---|---|
| **创作**（首页/composer） | 游客可看 | ✅ 完整可见 |
| **探索**（作品社区） | 游客可看 | ✅ 完整可见（7 个分类 tab + 技能 + 活动） |
| **资产** | 需登录 | ❌ 未确认 |
| **主体**（人物/角色资产，接口 `dreamina_subject`） | 需登录 | ❌ 未确认 |
| **对话**（Agent 会话，接口 `creation_agent/v2/conversation`） | 需登录 | ❌ 未确认 |
| **画布**（无限画布，面板内是画布列表 + 新建画布） | 需登录 | ⚠️ 只读预览可见，编辑器未确认 |

### 1.3 完整路由表（从 162 个 JS chunk 反查，【实】）

```
/ai-tool/home                  首页 / 创作台
/ai-tool/explore               探索（社区 + 技能市场 + 活动）
/ai-tool/asset                 资产
/ai-tool/assets-canvas         资产画布
/ai-tool/action                （空壳页，游客可访问）
/ai-tool/generate              生成器（游客被重定向回 home）
/ai-tool/login                 登录
/ai-tool/search-result         搜索结果
/ai-tool/work-detail/:id       作品详情（游客可访问，公开分享落地页）
/ai-tool/jimeng-api            开放 API 控制台
/ai-tool/jimeng-api/console/usage
/ai-tool/ai-canvas/:projectId  无限画布真身（含 ?scene=readonly 只读预览）
```

### 1.4 首页模块清单（【实】，按页面从上到下）

1. **顶部促销 banner**（原文）：`⏰触底价，官方满血Seedance2.5 720P 低至0.4元/秒 ｜Seedance2.0 Fast VIP 720P 低至0.2元/秒｜限时直降：会员5折`（点击不跳转，无落地页）
2. **Agent 创作台**（核心）：
   - 标题 `你好，今天想要创作什么?`
   - 输入区提示 `输入想法、剧本或上传参考，支持 / 使用技能，添加主体，和 Agent 一起创作`
   - `Agent 模式` + `自动`（一个 `[role=switch]` 开关）
   - 技能胶囊（首屏 6 个）：`/ 电影级长镜头运镜 New`、`/ 创作分镜 New`、`/ 名导风格大师 New`、`/ 叙事短片导演分镜 Hot`、`/ 微表情导演 Hot`、`/ 电影广告全能导演` + `更多技能`
   - 底部按钮：`生成`、`画布` 右侧 `去查看`
3. **画布面板**：`画布 | 全部 | 新建画布`（点击需登录）
4. **最近上新 / 精选** + 分类 tab：`广告营销 | 影视作品 | 平面设计 | 电商 | 动画动漫`
5. **运营位**（活动/比赛入口）：`即梦精选短片 · 妖异薄《问苍生》`、`一键 3D 白模转视频`、`让你更了解 Seedance2.5`、`即梦片场上线——寻找AI时代最敢想象的好故事`、`联想昭阳 x 酷睿 全民AI创意大赛`、`Graphis AI创意设计竞赛 · 即梦创作者五折报名费优惠`、`即梦AI 创作者成长计划・造梦新章`、`即梦APP · 创作者招募计划` + `下一个`
6. **作品流**：卡片带时长角标、作者名、`创作过程` 按钮、`关注`、收藏数

### 1.5 探索页（【实】）

- 分类 tab：`广告营销 / 影视作品 / 平面设计 / 电商 / 动画动漫 / 其他`
- 顶部三大板块：`技能`、`活动`、以及作品流（子 tab：`品牌广告 / 社媒营销 / 发布短片`）
- **活动板块**原文样例：`距离截稿还有51天10小时`、`无限算力、创作工具、顶级行业资源，全链路支持`、`本期活动设置 20万 奖金池和5万抖音流量池`、`已有294人参与`、`400万现金与2000万即梦积分已就位`、`评奖中`、`4万欧奖金`、`承包机酒直通釜山电影节`

---

## 2. 逐模块能力清单（模型 / 参数 / 上限）

> 数据来源：`/mweb/v1/creation_agent/v2/get_agent_config`（78KB）、`/mweb/v1/video_generate/get_common_config`、`/mweb/v1/audio_generate/get_common_config`。**这些接口游客也能拿到**，所以参数面是实锤；但**界面上的呈现方式（按钮旁的积分数字、预计耗时、会员锁标）未确认**。

### 2.1 AI 作图（图片模型 9 档）

| 模型名 | 底层 | req_key | tips（原文） | 分辨率档 | 单次可选张数 | 默认 |
|---|---|---|---|---|---|---|
| **图片 5.0 Pro** | by Seedream 5.0 Pro | `high_aes_general_v50p_large` | 商业设计、影视、高密度图文等场景效果全面提升 | **标清 1.5K / 高清 2K / 超清 4K** | 1/2/3/4 | 2 张，2K |
| 图片 5.0 Lite | by Seedream 5.0 Lite | `high_aes_general_v50` | 指令响应更精准，生成效果更智能 | 高清 2K / 超清 4K | 1–8 | 4 张 |
| 图片 4.7 | by Seedream 4.7（raw: 4.3 Design） | `high_aes_general_v43` | 画质全面优化，指令响应能力再次提升 | 2K / 4K | 1–8 | 4 张 |
| 图片 4.6 | by Seedream 4.6 Design | `high_aes_general_v42` | 人像一致性保持更好，性价比更高 | 2K / 4K | 1–8 | 4 张 |
| 图片 4.5 | by Seedream 4.5 | `high_aes_general_v40l` | 强化一致性、风格与图文响应 | 2K / 4K | 1–8 | 4 张 |
| 图片 4.1 | by Seedream 4.0 Design | `high_aes_general_v41` | 更专业的创意、美学和一致性保持 | 2K / 4K | 1–8 | 4 张 |
| 图片 4.0 | by Seedream 4.0 | `high_aes_general_v40` | 支持多参考图、系列组图生成 | 2K / 4K | 1–8 | 4 张 |
| 图片 3.1 | by Seedream 3.0 | `high_aes_general_v30l_art_fangzhou:general_v3.0_18b` | 丰富的美学多样性，画面更鲜明生动 | 标清 1K / 高清 2K | — | — |
| 图片 3.0 | by Seedream 3.0 | `high_aes_general_v30l:general_v3.0_18b` | 影视质感，文字更准，直出2k高清图 | 标清 1K / 高清 2K | — | — |

**参考图上限**：仅 5.0 Pro 显式给了 `input_image_limit: [{ max_image_num: 10, ability_name: "byte_edit" }]` → **图生图/指令编辑最多 10 张参考图**。【实】

**比例 → 像素表**（`image_resolution_display_map`，8 种比例 + "智能"）【实】

| ratio_type | 比例 | 2K | 4K |
|---|---|---|---|
| 1 | 1:1 | 2048×2048 | 4096×4096 |
| 2 | 3:4 | 1728×2304 | 3520×4693 |
| 3 | 16:9 | 2560×1440 | 5404×3040 |
| 4 | 4:3 | 2304×1728 | 4693×3520 |
| 5 | 9:16 | 1440×2560 | 3040×5404 |
| 6 | 2:3 | 1664×2496 | 3328×4992 |
| 7 | 3:2 | 2496×1664 | 4992×3328 |
| 8 | 21:9 | 3024×1296 | 6197×2656 |

其它细节（【实】，全部来自接口）：
- `sample_steps: { steps: 16, min_steps: 10, max_steps: 41 }`（种子/步数面板存在但默认折叠）
- `feat_config`：`canny/depth/pose … strength 0.6`、`style_reference … strength 0.8`（ControlNet 类结构控制，含 脸替换/背景涂抹/线稿/深度/姿态 开关位）
- feat 标签：`default_scene / t2i / byte_edit / byte_edit_2k / refuse_image / smart_scale / per_piece / think_then_draw / byte_edit_with_empty_prompt / byte_edit_with_custom_ratio / etta / support_subject`
- `post_edit_param_configs["101"]`：后编辑面板（`high_aes_general_v50p_large`）支持 1.5K/2K 两档
- `first_selected_model` 按场景分流：`canvas`/`character`/`story` → 3.1；`workbench` → 5.0 Pro

### 2.2 AI 视频（视频模型 10 档，含 3 个第三方）

| 模型名（原文） | req_key | tips（原文） | 分辨率 | 时长 | 输入类型 |
|---|---|---|---|---|---|
| **即梦 Seedance 2.5**（默认） | `dreamina_seedance_45_pro` | 最强模型，支持 50个参考，新增视频编辑、超长生成 | **480p/720p/1080p** | **96–720 帧 = 4–30s**；另有 **long_video 30000–180000ms（30–180s）** | unified_edit / prompt / first_frame / end_frame / long_video / **edit** |
| 即梦 Seedance 2.0 mini | `dreamina_seedance_40_mini` | 极致性价比，相近的体验，比Fast更快的推理速度 | 720p | 96–360 帧 = 4–15s | unified_edit / prompt / first_frame / end_frame |
| 即梦 Seedance 2.0 Fast VIP | `dreamina_seedance_40_vision` | 极速推理，会员专属通道，音视文图均可参考（暂不支持真人人脸） | 720p | 96–360 帧 = 4–15s | 同上 |
| 即梦 Seedance 2.0 VIP | `dreamina_seedance_40_pro_vision` | 全模态能力，会员专属通道，音视文图均可参考（暂不支持真人人脸） | **720p/1080p/4k** | 96–360 帧 = 4–15s | 同上 |
| 即梦 Seedance 1.5 Pro | `dreamina_ic_generate_video_model_vgfm_3.5_pro` | 音画同出，全新体验 | 720p/1080p | 120–288 帧 = 5–12s | prompt / first_frame / end_frame |
| 即梦 Seedance 1.0 | `…vgfm_3.0_pro` | 效果最佳，画质超清 | 1080p | 120–240 帧 = 5–10s | prompt / first_frame |
| 即梦 Seedance 1.0 Fast | `…vgfm_3.0_fast` | Pro级表现，加量不加价 | 720p/1080p | 120–240 帧 | prompt / first_frame / **multi_frame** |
| MiniMax H3 | `dreamina_minimax_h3` | 开源视频生成模型 | **768P / 2K** | duration_ms 4000–15000（默认 4000） | unified_edit(max 12) / prompt / first_frame / end_frame |
| HappyHorse 1.1 | `dreamina_happyhorse_v1_1` | 国产视频生成模型（by Alibaba ATH） | 720P/1080P | 4000–15000ms（默认 5000） | unified_edit(max 9) / prompt / first_frame |
| Wan 3.0 | `dreamina_wan_30` | Wan系列最新视频模型（by Tongyi Lab） | 720P/1080P | 4000–15000ms（默认 5000） | unified_edit(max 20) / prompt / first_frame / end_frame |

**通用枚举（【实】）**
- 比例：`21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16`（HappyHorse 多给 `4:5 / 5:4 / 9:21`）
- fps：固定 `24`，且 `forbidden_display: true`（**UI 上不给用户改**）
- `video_duration_display_range: { min_duration_ms: 4000, max_duration_ms: 15000 }`（界面滑杆显示 4–15 秒）
- 提示词长度上限：Seedance 2.5 `15000` 字符；2.0 系列 `4000`；MiniMax H3 `7000`；HappyHorse `2500`；Wan 3.0 `20000`
- 批量：`max_batch_gen_count: 4`；`support_prompt_enhancement: true`

**Seedance 2.5 的统一参考（unified_edit）上限——这是它最强的一处，【实】**

```
max_resource_count        : 50        # 参考素材总数
max_image_count / type1   : 30        # 图片 ≤30 张，宽高 300–6000，单张 ≤30MB，
                                      #  支持 jpeg/png/webp/bmp/tiff/gif/heic/heif，长宽比 0.4–2.5
max_video_count / type2   : 10        # 视频 ≤10 段，单段 1.8–30.2s，≤200MB，mp4/mov，24–60fps
max_audio_count / type3   : 10        # 音频 ≤10 段，1.8–30.2s，≤15MB，wav/mp3
max_total_video_duration  : 30.2s     # 视频总时长上限
max_total_audio_duration  : 30.2s
```
（Seedance 2.0 系列同名上限收紧为 12 个素材：图 9 / 视频 3 / 音频 3。）

**视频编辑（edit_config）**：Seedance 2.5 支持 `edit_min_video_duration: 4` ~ `edit_max_video_duration: 30`，`max_prompt_length: 2000`。文案侧口径（活动页原文）：`即梦 Seedance 2.5 支持智能视频编辑` / `从画面调整到内容重塑，用自然指令精准编辑视频，让创作修改更高效、更自由`。

### 2.3 数字人与对口型（两条独立产线）

**A. 对口型 / 唇形同步**（`video_generate/get_common_config`，【实】）

| 模型 | req_key | tips 原文 | 备注 |
|---|---|---|---|
| 基础模式 | `dreamina_lib_sync_base` | 仅仅修改人物口型。适合演讲、对白 | `mode: standard`，`max_audio_duration: 30` |
| 大师模式 | `dreamina_lib_sync_image_master_1.5` | 电影级的表演效果 | by OmniHuman 1.5，`mode: hq`，SKU `lip_sync_avatar_omni_15_master_vip` |
| 快速模式 | `dreamina_lib_sync_image_quick_1.5` | 更低成本，快速生成 | by OmniHuman 1.5，`mode: hq_480`，SKU `lip_sync_avatar_omni_15_quick` |

- 分辨率 720P / 1080P；界面时长显示 4–15 秒；音频输入 **1–30 秒**
- 选项：`input_media_type: [prompt]`、`audio_option: [audio_silence_detect]`（**自动静音检测**）
- `face_detection_scene: multiple_face_detection`（**多人脸检测**）

**B. 动作模仿 / 数字人驱动**（DreamActor 系，【实】）

| 模型 | req_key | tips 原文 | 底层 |
|---|---|---|---|
| 大师 | `dreamina_imitator_m15_master` | 效果最佳，画质超清 | DreamActor M1.5 |
| 生动（默认） | `dreamina_imitator_m20` | 不限画幅，动效更真 | DreamActor M2.0 |
| 快速 | `dreamina_imitator_m20_quick` | 更快生成，成本更低 | DreamActor M2.0 |

- `feature_conf.dreamina_actor_m1: { status: 2, is_white: false, is_invite: false }`（存在灰度/邀请制功能位）
- 分辨率 720P/1080P，时长显示 4–15 秒

**C. "主体"资产（`dreamina_subject`）**：接口有 `create / update / delete / get / generate_voice`（**给主体生成音色**）。界面【未确认】。

### 2.4 音频

| 类型 | 模型 | req_key | tips 原文 | 参数 | 计费 |
|---|---|---|---|---|---|
| 音乐/歌曲 | SeedMusic 1.0 Preview | `seed_music_1.0` | 细腻风格控制与多语种演唱，人声表现更自然 | `duration_ms` | `dreamina_audio_seed_music_10_1` |
| TTS 配音 | Seed TTS | `tts_model_v3` | 选择音色，输入台词生成语音 | `audio_generate_mode: [tts]`、`voice_option: [speed, emotion]`（**语速 + 情绪**） | `audio_tts_generate`，**`billing_mode: per_100_chars`（按百字计费）** |

配套接口：`tts_generate`、`voice/submit_task | query_task | update | delete`、`speech/asr_token`、`speech/asr_hotwords`、`mix_audio_video` / `mix_audio_videos`（**音视频混合/拼接**）。【实-接口层，界面未确认】

### 2.5 提交按钮附近显示什么？——【未确认】

游客态下"生成"按钮旁边只有登录入口，看不到任何 **积分消耗 / 预计耗时 / 会员限制** 文案。可以确认的是**后端确实按"模型 × 分辨率 × 时长 × 是否有输入视频"分档计价**（见 §6.2 的 benefit_type 清单），所以"生成前报价"所需的数据是齐的；但**它在 UI 上怎么呈现，本次没看到**。【未确认】

---

## 3. 画布（无限画布 / AI Canvas）

### 3.1 已确认的部分

- **真路由**：`/ai-tool/ai-canvas/:projectId`，只读预览 = `?scene=readonly`，且**渲染在作品详情页的 drawer 内 iframe 里**：【实】
  ```html
  <iframe class="iframe-UTqeVc"
          src="/ai-tool/ai-canvas/ec69d34d-77a5-40d3-b1a4-97fc268234a2?scene=readonly"
          title="查看画布：$香水-Elle fait naître le soleil" allowfullscreen></iframe>
  ```
- **入口路径**：探索/首页作品卡 → `创作过程` 按钮 → 画布只读预览抽屉。【实】
- **预览抽屉的完整 UI 文案**（原文）：
  - 标题 = 画布项目名（实测：`香水-Elle fait naître le soleil`）
  - `当前为只读模式，如需创作请点击` + 主按钮 **`复制项目`**
  - 右上角按钮 aria-label：`关闭画布预览`
  - 页面另有 `清屏` 按钮
- **接口族**（【实】，bundle 反查）：`/mweb/v1/infinite_canvas/{list_project, conversation, edit, resume, stop_stream}` —— 说明画布是一个**基于会话/流式 Agent 的图**，有 `resume`（断点续跑）与 `stop_stream`（中断流）。
- **画布内的技能胶囊**（`scene: web_canvas_capsule`，【实】）：`视频反解` / `创作分镜` / `全流程广告片导演` / `剧本开发` / `剧情短片`
  对照 `scene: web_chat_capsule`（对话页）的 11 个：`电影级长镜头运镜 / 创作分镜 / 名导风格大师 / 叙事短片导演分镜 / 微表情导演 / 电影广告全能导演 / 系列套图生成 / 世界观美术设定 / 角色设计 / 剧情短片 / 电商套图`
- **资产画布**另有独立路由 `/ai-tool/assets-canvas`。【实-路由，界面未确认】

### 3.2 **未确认**的部分（必须点名）

- 画布编辑器 iframe 本体内容：直接打开 `/ai-tool/ai-canvas/<id>?scene=readonly` 得到的是 `登录以打开您的画布 / 登录 Dreamina / 登录`；在作品页 iframe 内同样是这三个字。→ **没登录看不到画布本体**。
- 因此：**节点类型、连线方式、右键/双击菜单、快捷键、工具栏、小地图、导出格式** —— 全部 **未确认**。
  - 只从 bundle 字符串里旁证到：画布存在"技能注入"（capsule）与流式会话；不能反推节点/边的数据模型。

---

## 4. 技能生态（即梦真正的"智能体层"，也是它原创度最高的一块）

### 4.1 数据规模（【实】，本次抓到 186 个不重复技能 + 12 个分类）

- 技能市场分类（`skill/categories`，含权重与是否运营位）：
  `热门推荐(featured) / 影视短片 / 电商 / 商业广告 / 通用创作 / 平面设计 / 社媒营销 / 娱乐 / 动漫游戏 / 大师风格复刻 / 专业运镜 / 发现`，`max_select_count: 3`
- 各类目返回的 `total_count`：28 / 18 / 19 / 23 / 20 / 13 / 22 / 30 / 26（**每一类目独立分页**，总量远大于 186）
- 技能对象字段（`skill/market/list` 原文）：
  `skill_id, skill_name, description, instruction, status, markdown_url, create_time, update_time, source, tag, sort_weight, is_private, like_count, is_like, owner_uid, effective_user, original_skill_id, showcase_media, added_count, is_test, is_added, added_skill_id, usage_count, extra_info`
  → **`instruction` 是完整的 SKILL.md 正文**（抓到的单条最长 19,247 字符），`markdown_url` 是它的原始地址。
- 技能市场 API 全家桶（【实】）：`list / market/list / market/search / categories / batch_get / create / update / delete / like / like/list / publish / publish/delete / publish/list`
  → **用户可以自己写技能并发布到市场**，有 `/ai-tool/locate_workbench`（定位工作台）与 Lark 文档引导。

### 4.2 使用量 Top（【实】，单位"次使用 / 赞 / 添加"）

| 技能 | 使用 | 赞 | 添加 | 归属 |
|---|---|---|---|---|
| 叙事短片导演分镜 | 13,264 | 1,063 | 26,940 | @森海荧光 |
| 一图成片-电影广告全能导演 | 9,904 | 627 | 10,958 | @渊静-中意 |
| 系列套图生成 | 6,952 | 395 | 8,969 | @渊静-中意 |
| 剧本资产视频一条龙创作 | 6,814 | 455 | 7,663 | @娜乌斯嘉 |
| 爆款电商短视频题材创意 | 6,613 | 397 | 10,561 | @Carson |
| 角色设计 | 5,991 | 239 | 5,445 | @慕影-中意 |
| 4K高清精修 | 3,131 | 23 | 865 | — |
| TikTok网红带货视频 | 2,937 | 106 | 1,487 | 即梦AI |
| 世界观美术设定 | 2,750 | 182 | 2,488 | @慕影-中意 |
| 电影级长镜头 | 2,343 | 7 | 1,911 | 即梦AI |
| 顶级波普视觉广告导演 | 1,899 | 271 | 4,282 | 即梦AI |
| 穿搭上身试穿视频生成 | 1,774 | 201 | 3,033 | 即梦AI |
| AI演员微表情导演 | 1,708 | 386 | 6,506 | 即梦AI |

### 4.3 官方技能（首页"更多技能"抽屉里的 7 个，描述原文）

```
视频反解        拆解参考视频的镜头语言、光影色调与声音节奏，一键生成可用于拉片复刻、元素替换和再创作的
                视频 Prompt，覆盖广告、MV、剧情片、AI 视频、短视频、产品展示等多类内容。
创作分镜        面向Seedance视频模型的专业级虚拟导演与提示词工程师。将模糊创意转化为电影级美学视频分镜
                Prompt，内置运镜词典与导演风格库，支持各类内容题材，超15秒长叙事自动分段。
全流程广告片导演 输入你的广告需求或一份 Brief，即可从创意、脚本、分镜到镜头、配乐分阶段生成，串成一支
                结构完整的商业广告片，不限品类与风格。
剧情短片        帮你自动生成故事大纲、分镜脚本并产出短片
电商套图        生成风格统一的商品全套视觉素材，适用于各大电商平台
海报设计        生成更有创意的海报内容，擅长营销场景和节日热点
品牌设计        根据公司名称、业务与客群，生成品牌 Logo 与视觉方案
```

### 4.4 技能里暴露的**工具名**（= 它们的内部"节点/动作"词汇表）【实，从 instruction 原文里抽】

- `图生图工具`、`文生图工具`、`首帧生视频工具`、`状态查询工具`
- `multi_modal2video`（"全能参考分段生成"）、`video_editor`（"最终拼接"）
- 触发词密度：主体×27、参考×22、拼接×14、高清×9、节点×5、抠图×2、对口型×1、TTS×1、扩图×1

> 这条非常有价值：**即梦的"技能"其实是在 Agent 里调度一组固定工具**，工具集比想象的窄（约 6 个），
> 但通过 `instruction`（SKILL.md 级的长提示词 + 状态机 + 质检重试）把效果拉起来。

### 4.5 技能清单（186 个全名，节选覆盖电商/带货场景的）

- 电商：`珠宝电商图文视频一站式 / TikTok网红带货视频 / 素人穿搭配方 / AI造型师高转化模特图 / 穿搭上身试穿视频生成 / ASMR沉浸式潮玩开箱导演 / 商业美食拆解 / 商品沉浸式旋转广告 / 万能电商图 / 电商详情页 / 苹果风电商海报 / 高级感饰品商品图生成 / 冰饮冷感微距广告 / 夏日水下饮品广告 / 反差叙事剧情广告 / 工业产品商业宣传视频`
- 运镜（20 个）：`电影级长镜头 / 遮挡转场一镜到底 / 伪纪录手持一镜到底 / FPV精准穿越运镜 / 螺旋环绕镜头 / 运镜轨迹匹配转场 / 八字轨迹双主体环绕 / 子弹时间镜头 / 贴身固定镜头 / 希区柯克变焦 / 不可能空间穿越运镜 / 视差焦点接力运镜 / 物体锁定跟拍 / 无限递归变焦运镜 / 手持跟拍运镜 / 格莱美运镜 / 分屏镜头 / 摆荡穿梭跟拍运镜 / 滚轴运镜 / 躲避危机动作运镜生成`
- 平面/风格：`日系生活碎片 / 万物皆可拼豆风 / 复古印章明信片 / 金箔压印 / 中式刺绣美学 / 透视结构线稿 / 极简线条风 / 照片转极简独立杂志拼贴海报 / 信息图海报生成`
- 完整名单见 `.tmp-research/jimeng/all-skills.json`。

---

## 5. 资产库与复用（**大面积未确认**）

### 5.1 接口层面能确认的（【实】，bundle 反查）

| 能力 | 接口 |
|---|---|
| 资产列表 | `get_asset_list`、`get_local_item_list` / `get_user_local_item_list` |
| 工作区分组 | `workspace/create | list | update | delete | get_by_ids` |
| 收藏/关注 | `mark_favorite`、`simple_favorite_item`、`follow`、`get_follow_list` |
| 历史/队列 | `get_history_by_ids`、`get_history_queue_info`、`get_weekly_challenge_*` |
| 素材取回 | `get_image_by_uri`、`get_video_by_vid`、`mget_item_info`、`update_item`、`remove_from_homepage` |
| 上传 | `get_upload_token`、`imagex/submit_audit_job` |
| 主体资产 | `dreamina_subject/{create,update,delete,get,generate_voice}` |
| 提示词资产 | `prompt_enhancement/{create,query,update,retry,delete,delete_all}`（提示词是可**持久化、可复用**的一等资产） |
| 画布工程 | `infinite_canvas/list_project` |

### 5.2 复用与分享（【实】）

- **作品详情页是公开的**：`/ai-tool/work-detail/:id` 游客可访问，带 `关注`、收藏数、`内容由 AI 生成` 水印文案、时长/分辨率角标（如 `00:50 / 1080P`）。
- **画布可直接"复制项目"**：只读预览里有 `复制项目` 主按钮 —— 即**别人的画布工程可以一键复制成自己的**（"复用"最强的形态）。【实-按钮存在；点击后流程未确认，因为要登录】
- 生成物可作为**参考图/参考视频/参考音频**再次进入生成（Seedance 2.5 unified_edit：图 30 / 视频 10 / 音频 10）。【实-接口】
- **导出**（下载/打包/工程文件导出）：未确认。

### 5.3 未确认

- 资产库页面结构（分组/筛选/搜索/批量操作）、生成历史的时间线组织方式、能否直接"再次作为输入"（UI 路径）、分享链接的权限粒度（公开/私密）。【未确认】

---

## 6. 计费与会员

### 6.1 单位与展示（【实】）

- 单位是 **积分**（points）。**全站没有出现"火苗"字样**——火苗是别的产品的说法；即梦活动页原文亦为 `400万现金与2000万即梦积分`。
- **价格展示方式 = "元/秒"**（促销 banner 原文）：
  ```
  ⏰触底价，官方满血Seedance2.5 720P 低至0.4元/秒 ｜Seedance2.0 Fast VIP 720P 低至0.2元/秒｜限时直降：会员5折
  ```
- 会员标识直接写进模型文案：`Seedance 2.0 Fast VIP —— 极速推理，会员专属通道`、`Seedance 2.0 VIP —— 全模态能力，会员专属通道`。
- 计费相关接口：`execute_generate_audit`、`locate_workbench`、`get_invite_status`（**邀请返利**）、`feelgood_token`、`submit_survey`。

### 6.2 计费 SKU（benefit_type）全清单 —— **可直接当"分档定价表"抄** 【实】

**图片（resource_id: `generate_img`）**，amount 默认 1：
```
image_basic_v50_pro_1k / _15k / _2k / _4k        # 图片 5.0 Pro：按分辨率四档
image_basic_v5_2k / _4k                          # 5.0 Lite
image_basic_v43_2k / _4k                         # 4.7
image_basic_v46_2k / _4k                         # 4.6 / 4.3
image_basic_v4_pro_2k / _4k                      # 4.5
image_basic_v41_2k / _4k                         # 4.1
image_basic_generate_piece + image_uhd_4k        # 4.0
image_basic_generate_plus + image_uhd            # 3.1 / 3.0
image_blend_piece / image_blend_plus             # 图生图（融合）单独一档
image_inpainting_repaint_piece                   # 局部重绘
image_inpainting_eraser_piece                    # 消除
image_inpainting_repaint_byteedit_piece          # 重绘+指令编辑
```

**视频（resource_id: `generate_video`）**：
```
seedance_25_480p_output / _720p_output / _1080p_output
seedance_25_long_video_480p_output / _720p_output / _1080p_output     # 30–180s 超长视频单独计价
seedance_25_<res>_no_input_video_output                               # 无输入视频（纯文生）单独计价
seedance_20_mini_{720p,1080p}_output
seedance_20_fast_{480p,720p,...}_output   + format_conf.unified_edit_input_video
seedance_20_pro_{480p,720p,1080p,...}_output
dreamina_video_seedance_15_pro  (+ additional_conf: 1080p 加价 dreamina_video_seedance_15_pro_1080_add)
minimax_h3_{768p,2k}_output
happyhorse_11_{720p,1080p}_output
wan_30_{720p,1080p}_output
lip_sync_avatar_omni_15_master_vip  /  lip_sync_avatar_omni_15_quick      # 对口型
basic_video_operation_video_template15_pro / ..._video_template15         # 动作模仿（DreamActor）
```

**音频（resource_id: `generate_audio`）**：
```
audio_tts_generate            # billing_mode: per_100_chars（按百字）
dreamina_audio_seed_music_10_1
```

**要点**：即梦的定价是**四维分档**——① 模型档位 ② 分辨率 ③ 时长/帧数 ④ 是否有输入视频；
另外**图生图（blend）与局部重绘（inpainting）是独立 SKU**，不含在基础价里。

### 6.3 免费额度 / 会员价格

- **【未确认】**：会员定价页、每日免费积分、会员权益矩阵。均需登录或未在本次可见页面中出现。
- **【二手】**（仅作参考，2026-04 报道，可能已过时）：
  - 免费用户每天 60–100 积分；免费会员每天赠送 66 积分（[腾讯新闻实测](https://view.inews.qq.com/a/20260425A04E8B00)）
  - Seedance 2.0 VIP 生成 1 条 495 积分 ≈ 1.38 元/秒；Seedance 2.0 720p 16:9 15 秒 = 45 积分 ≈ 0.65 元
  - 2026 年 4 月一个月内三次涨价，15 秒视频从 45 积分涨到 120 积分（[搜狐](https://www.sohu.com/a/1010914272_115565)、[新浪财经](https://finance.sina.com.cn/wm/2026-04-13/doc-inhukefa4728806.shtml)）
  - 与本次 banner 的"0.4 元/秒（Seedance2.5 720P 触底价）"对照，**降价幅度很大**，说明价格战正在进行。

---

## 7. 对标结论：对我们最有价值的 3 件事

### 7.1 立刻该抄的（成本最低、回报最高）

**① 技能市场 = "可发布、可分页、带使用数据"的提示词资产层**
- 它的技能就是一段 SKILL.md（`instruction` 最长 1.9 万字符）+ 一个封面 + 分类标签；
- 市场有完整的**创作者经济闭环**：`usage_count / like_count / added_count` 三个数字全部公开摆在卡片上，作者署名 `@森海荧光`；
- 官方自己也在市场里发技能（`@即梦AI` 是最大供给方之一），并给分类页一个"去使用"的官方推荐位；
- 用户能 `create / update / publish / delete`，有 `is_private`（私有技能）与 `original_skill_id`（**派生/二创溯源**）。
- **对我们的含义**：我们已有"技能系统 + 电商模板"，但**没有把技能当商品运营**。把 template/skill 统一成市场化资产，加 usage/like/add 三个计数与作者署名，是我们零成本能补上的一课（正是总体方案 §3.5 说的"模板/技能/智能体三合一"，即梦已经把它做成了市场）。

**② "生成偏好"抽屉的极简参数面（学它的克制）**
- 就三块：`自动 / 图片 / 视频` ＋ `选择比例：智能 1:1 3:4 16:9 4:3 9:16 2:3 3:2 21:9` ＋ `其他设置`，右下角一枚模型 chip（`图片 4.0`）。
- 对比：它的后端参数面极其复杂（10 个视频模型 × 分辨率 × 4–180s × 6 种输入类型 × 最多 50 个参考素材），但**首屏只暴露 3 个决策点**，其余全折叠进"其他设置"。
- **对我们的含义**：我们的节点 composer 现在把"模型 + 参数 + 次数 + 价格"全摊在卡片上。**建议默认折叠为"主参数 + 更多"，把复杂度留给专业用户**。

**③ 只读预览 + "复制项目" 的复用范式**
- 别人作品的画布，"创作过程"按钮 → 抽屉里直接给 iframe 只读画布 + 主按钮 `复制项目` + `当前为只读模式，如需创作请点击`。
- **对我们的含义**：这是"作品 → 可复用工程"最短路径，比"导出 JSON 再导入"友好一个数量级。我们的成品页应该直接挂"复制成我的节点图"。

### 7.2 它独有、我们做不了（模型层，不必追）

- **Seedance 2.5 的 50 参考统一编辑**：图 30 + 视频 10 + 音频 10，单视频 ≤30.2s，**总时长 ≤30.2s**，混合驱动一次生成；
- **超长视频生成 30s–180s**（`long_video: 30000–180000ms`，单独 SKU）；
- **视频编辑**：用自然语言改已有视频（4–30s，提示词 ≤2000 字）；
- **音画同出**（Seedance 1.5 Pro）、**动作模仿**（DreamActor M1.5/M2.0）、**OmniHuman 对口型**（多人脸检测 + 静音检测）；
- **模型聚合**：已经把 MiniMax H3 / HappyHorse 1.1（阿里）/ Wan 3.0（通义）**作为第三方模型接进同一个表单** —— 这是"模型超市"级的分发能力。
- **对我们的含义**：这些是字节/阿里自己的模型资产，我们只能做**上游适配层**（我们的 Provider 四层适配已经在做这件事），不必自研。

### 7.3 我们已经有、而且比它强的

| 能力 | 我们 | 即梦 |
|---|---|---|
| 真实电商商品档案 / 卖点 / 合规护栏 / 尺寸锁 / 平台规格 | ✅ 有 | ❌ 完全没有（技能里只有"通用电商套图"，无商品事实） |
| 图驱动执行引擎（拓扑调度 / 边传值 / stale 传播 / 失败只污染子图） | ✅ 规格齐（待接线） | ❓ 画布内部未确认，但**它的技能是"提示词驱动"而非"图驱动"** |
| 一次性计费 quote → hold → settle + 幂等键 + 失败自动释放 | ✅ 有 | ❓ 只看到 SKU 分档，未看到前端报价呈现 |
| 端口级多输入 + 类型校验 | ✅ 有（Quantv 式） | ❓ 未确认 |
| 任务队列落库 / 断点续跑 | ✅ 有（CAS 租约） | ✅ 有（`infinite_canvas/resume`、`get_history_queue_info`） |

**一句话**：即梦强在**模型能力 + 技能市场 + Agent 编排**，弱在**商品事实与行业约束**；
我们该抄的是它**把智能体能力"市场化 + 数据化"的运营方式**，而不是它的模型。

---

## 8. 未确认项清单（明确列出）

1. **所有生成器的实际界面**：AI 作图的表单布局、AI 视频的表单布局、生成按钮旁的积分/耗时/会员文案。
2. **画布编辑器全部**：节点类型、连线方式、右键/双击/快捷键、面板、小地图、导出格式、`infinite_canvas/edit` 的请求体结构。
3. **资产库**：页面结构、生成历史组织方式、能否一键"再次作为输入"、分享/导出的权限粒度。
4. **主体（数字人资产）管理界面**：`dreamina_subject` 的 UI 化形态、`generate_voice` 怎么用。
5. **对话（Agent）界面**：会话列表、`creation_agent/v2/conversation` 的流式交互、`clear_user_context`/`resume` 的用户可见语义。
6. **会员/积分体系**：定价页、每日免费额度、会员权益矩阵、积分获取渠道（签到/邀请/活动）。
7. **`/ai-tool/jimeng-api`（开放 API 平台）**：定价、限流、可用模型。
8. **`/ai-tool/action` 这个空壳页的用途**。
9. **图片模型的参考图上限**：只有 5.0 Pro 给了 `max_image_num: 10`，其余模型未给，**其它模型的参考图上限未确认**。
10. **视频模型"其他设置"里还有什么**：`extend_config`（续写）、`frames_slide_bar` 之外可能还有未展开项。

---

## 9. 复现配方（下次直接用）

```bash
# 1) 起浏览器（复制 profile 已失效，用空 profile 即可，游客态能拿到大部分接口数据）
node .tmp-research/jimeng-*.mjs        # 见各脚本里的 openJimeng()（.tmp-research/jimeng-browser.mjs）

# 2) 抓配置"五件套"（游客可拿，信息量最大）
#   /mweb/v1/creation_agent/v2/get_agent_config   → 图片/视频模型全清单 + 参考素材上限
#   /mweb/v1/video_generate/get_common_config     → 视频 / 对口型 / 动作模仿模型
#   /mweb/v1/audio_generate/get_common_config     → 音乐 / TTS
#   /mweb/v1/capability/capsules                  → 画布 / 对话的技能胶囊
#   /mweb/v1/creation_agent/v2/skill/{market/list,categories}  → 技能市场
#   /mweb/v1/get_explore + get_explore_category_list → 作品流

# 3) 关键脚本
node .tmp-research/jimeng-sweep.mjs    # 路由巡检 + 接口捕获
node .tmp-research/jimeng-probe.mjs    # 只读接口探测
node .tmp-research/jimeng-bundle.mjs   # 从 162 个 JS chunk 反查路由表与 API 表
node .tmp-research/jimeng-final.mjs    # 技能分类抓取 + 画布 iframe 检查
node .tmp-research/jimeng-mine*.mjs    # 本地 JSON 提炼
```

**踩坑备忘（重要）**：
- 必须带 `--no-proxy-server`，否则一切导航超时（沿用知渔配方）。
- **不要**再用"复制 Chrome profile 拿即梦登录态"这条路：Chrome 152 的 ABE（v20）会让鉴权 cookie 解不开并被删除。
- 本机 Chrome 的 9222 端口虽然 LISTENING，但 Chrome 152 对默认 profile 做了缓解，HTTP/WS 都不通。
- 游客态下 `/ai-tool/generate` 等路由会被重定向回 `/ai-tool/home`，**不要在路由上浪费时间**，直接读接口。
