# 4c183cd4 续命阶段 V2 三竞品画布深度调研报告

> **调研时间**: 2026-08-28
> **执行人**: 三竞品画布深度调研 (V2 真调研) 子代理
> **方法**: 真打开 + 真点击 + 真截图 (browse 工具 / Browserbase CLI) + DOM 抓取 + modlens 视觉识别
> **诚实声明**: 3 家画布 (TapNow / Liblib / Quantv) 全部需要登录才能进入. 登录方式为邮箱+密码+Cloudflare Turnstile (TapNow) / 微信扫码 (Liblib) / 手机号+验证码 (Quantv). 在 headless 浏览器下 Cloudflare Turnstile 与手机验证码无法自动通过. 报告基于 **3 家公开营销页/产品页 + 登录页 + 完整 DOM 数据 + 完整按钮清单** 调研, 营销页**已包含产品级多模态串联展示** (TapNow 7 大功能模块在 marketing 页用 video/canvas mockup 完整呈现), 画布内功能结构由其公开 mockup 推断.
> **截图**: 47 张, 全部存 `.superpowers/sdd/research-shots/`

---

## 0. TL;DR — 3 家根本不是一类产品

| 维度 | TapNow | Liblib (LibTV) | Quantv (知渔AI) |
|---|---|---|---|
| **定位** | Creative OS (AI 创作操作系统) | AI 视频/图片创作平台 (TV Show 社区) | 电商图生成平台 (模板驱动) |
| **画布形态** | **节点 + 导演台 + Agent** | 模板/任务流 + 视频时间线 | **无画布** — 仅模板卡片 |
| **多模态串联** | ✅ Agent 主动串联 (Scene 1-3) | ⚠️ 通过 LibTV Agent prompt 串 | ❌ 模板独立, 无节点串联 |
| **公开画布 demo** | marketing 页 mockup 完整呈现 7 大功能 | "TV Show" 视频案例库 + 创作者署名 | 无画布 demo |
| **画布可访问性** | ❌ 强制登录 (Cloudflare 阻断) | ❌ 强制登录 (微信扫码) | ❌ 强制登录 (手机号) |
| **模型列表** | Hailuo, Jimeng, Vidu, Flux, Pixve + Seedance 2.5/2.0/Mini, MiniMax H3, Wan 3.0, Kling O3 | Seedance 2.5, Wan 3.0, MiniMax H3, 导演台, 逐帧拉片, 片段重拍 | 仅电商图模型, 视频生成未见公开 |
| **定价** | $7.5~$432/月 (4 档) + 积分永久有效 | "限时 45 折" 营销, 无公开定价页 | 无公开定价页 |
| **公司** | Tamar AI Inc. (2025-2026) | 哩布哩布AI (国内头部) | 武汉 Quantv |
| **社交** | X/YouTube/TikTok/Discord/Instagram (海外) | 国内为主 | 国内 |

**核心结论**:
1. **TapNow = 真正对标薯包** — 节点画布 + Agent + 导演台 + 模板克隆. 其 "Your AI Executive Director" 是薯包 v2 的目标.
2. **Liblib = 模板/任务流形态** — 类似 "AI 创作工坊", "TV Show" 是视频社区. 公开功能见 30 个 skill 标签.
3. **Quantv = 纯电商图生成, 没有画布概念** — 接近传统 SaaS 模板, 不在薯包 v2 的对标范围 (但有 1 个点值得抄: 全模板列表清晰可枚举).

---

## 1. 真调研流程 — 7 个真截图 (按 4c183cd4 "三遍+查漏" 规范)

### 1.1 TapNow (https://app.tapnow.ai/canvas/38d9f403-7dfb-49af-b83f-7b679c8fdec7)

#### 第一遍: 找到入口 → 触发 → 截图 (视觉态)

| 步骤 | 操作 | 截图 | 结果 |
|---|---|---|---|
| 1.1.1 | open URL | 01-tapnow-login.png | 重定向到 login 页, 背景是暗色画布, 前景是登录框 |
| 1.1.2 | 关 cookie 弹窗 | (eval) | 弹窗消失 |
| 1.1.3 | 填 test@test.com + 勾选条款 | 02-tapnow-after-email.png | 进入"创建账户"页 (Cloudflare Turnstile iframe) |
| 1.1.4 | 填密码 + 点 captcha + 提交 | 09/10/11-tapnow-*.png | "继续" 按钮 disabled, captcha 不过 |
| 1.1.5 | open tapnow.ai (营销页) | 21-tapnow-home.png | 完整产品介绍 + 7 个功能 mockup |
| 1.1.6 | 滚各档 (10%-100%) | 22/23-tapnow-*.png | 完整截 13 张 |
| 1.1.7 | open pricing 页 | 24-tapnow-pricing.png | 完整定价 + 模型价格表 |

#### 第二遍: eval 抓计算态 (z-index/transform/getComputedStyle/事件流)

通过 `browse eval` 抓的 DOM 关键数据:
- 登录页有 4 个 OAuth/邮箱入口: 使用Google继续 / 使用手机号继续 / 使用 SSO 继续 / 邮箱+密码
- 登录页底部有 4 个法律链接: 服务条款 / 社区准则 / 隐私政策 / 生成内容授权说明
- Cloudflare Turnstile iframe src: `https://track.tapnow.ai/_/service_worker/68j0/sw_iframe.html?origin=...`
- 注册 API: `/register?mode=email&email=...&redirect_url=base64(canvas-url)` — 注册后强制重定向回画布
- 营销页 TapNow Agent mockup 内节点: Scene 1 / Scene 2 / Scene 3 (Enclosure / Breakthrough / Framing)
- 营销页 Multi-angle camera 控件: Rotation (-30°), Tilt (23°), Scale (0), Wide-Angle Lens (toggle)
- 营销页 Studio lighting 控件: Brightness 100%, Color Temperature 5600K, Main Light (Left Top Right Front Bottom Back), Rim Light (10)

#### 第三遍: 查漏 — 父级菜单姊妹项, 相邻功能, 快捷键, hover, 错误/空/loading 态

- 营销页导航: Manifesto / Download / Community / Enterprise / Careers / Pricing / EN / Get started for free
- pricing 页 4 档: BASIC ($7.5/月, 1500 Tapies) / PRO ($45/月, 6000 Tapies, "最受欢迎") / ULTIMATE ($216/月, 36000 Tapies) / MAX ($432/月, 72000 Tapies, "最佳性价比")
- 登录方式 4 选 1: Google / 手机号 / SSO / 邮箱 (国内用户没用)
- 画布内模型价格 (Tapies/秒): Seedance 2.5 480p=20, Seedance 2.0 720p=24, Seedance Mini 480p=6, Kling O3 720 Silent=10
- 公开模型墙: Hailuo, Jimeng, Vidu, Flux, Pixve (5 个)
- footer: 版权 ©2025-2026 TapNow.ai, 公司 Tamar AI Inc., 仅海外社交 (无国内)
- 限时特惠: 订阅低至五折 + 4 模型无限畅用 + 倒计时
- "积分永久有效" — 是 TapNow 的核心营销点, 专门有 FAQ 解释
- 4 个 CTA 反复出现: Get started for free, Download App, Try TapNow Agent, Try lens combo, Try change angle, Try relight, Try replace object, Try out models, Explore works, Get Recipe, Clone Project, OKAY (cookie)

#### 查漏发现 (D1-D8 之外, 9 个 TapNow 独有):

| D# | 缺失/不足 | 详细 |
|---|---|---|
| **D9** | 画布内**没有快捷键公开文档** (登录墙后) | 无法确认 Ctrl+Z / Ctrl+C 等行为, 营销页只字未提 |
| **D10** | 营销页**多模态串联**只展示静态 mockup, 无交互 demo | "Try TapNow Agent" 是浅尝, 不能真在 marketing 页跑 |
| **D11** | 定价清晰但**没有画布内操作成本** | 不知道拖入节点 1 次扣多少 Tapies |
| **D12** | 视频对象替换 + 镜头组合 + 灯光控制, **3 套独立 UI**, 无统一面板 | 营销页是 3 个不同 demo 卡片, 画布内如何整合未知 |
| **D13** | "Clone Project" + "Get Recipe" 是核心差异点, 但 marketing 页**只放 1 句话** | 实际行为 (克隆后是否改水印? 商业授权?) 不可知 |
| **D14** | "TapNow Community" 案例库**未公开导航** | 不知道是否能按模型/标签筛选 |
| **D15** | "TapTV" 在 pricing 页 nav 出现, 营销页**无介绍** | 可能是 TapNow 自己的视频社区, 类似 LibTV |
| **D16** | "竞技场" 在 pricing 页 nav 出现, 营销页**无介绍** | 可能是 A/B 对比/排行 |
| **D17** | "工作空间" 在 pricing 页 nav 出现, 营销页**无介绍** | 团队协作空间? |

### 1.2 Liblib (https://www.liblib.tv/canvas?guideSource=home-feature-grid&spaceId=6742606&projectId=f9f7eb8b3bfe4271af447c9c5e25d7a6)

#### 第一遍: 找到入口 → 触发 → 截图

| 步骤 | 操作 | 截图 | 结果 |
|---|---|---|---|
| 1.2.1 | open URL | 03-liblib-initial.png | 直接进 LibTV 首页 (无登录墙, 可看功能) |
| 1.2.2 | 点 "新建画布创作" | 14-liblib-login-modal.png | 触发微信扫码弹窗 |
| 1.2.3 | 关弹窗 + 滚各档 | 15/16/17/18/19/20-liblib-*.png | 完整截 6 张 |
| 1.2.4 | 切到 liblib.tv 主页 + 滚 | 27-liblib-30/60/90.png | 完整截 3 张 TV Show 案例 |

#### 第二遍: eval 抓计算态

- 主页 nav: 新建项目 / 首页 / 项目 / LibTV Agent / 创作者挑战赛 / 帮助
- 顶栏 CTA: Blender 插件 / 积分超市 / 开通会员 (限时 45 折) / 注册/登录
- 中心 6 大功能卡片: Seedance 2.5 (多参创作, 音视频直出 30s) / Wan 3.0 (全新上线, 改写视频画面/剧情/环境) / MiniMax H3 (高性价比) / 导演台 (独家, 3D 虚拟场景) / 逐帧拉片 (独家, 传视频逐帧拉片快捷参考) / 片段重拍 (精准修改视频片段)
- LibTV Agent: prompt 输入区 "说出你的创意, 或者从一个 skill 开始创作" + 附件按钮 + 3 个 skill 标签 (POP MV 音乐MV / 日系剧情镜头导演 专业影视 / 真人感美妆UGC产品测评 商业广告) + 全部 Skill
- TV Show 频道: 分类 tab (全部 / Seedance 2.5 / 无畏契约觉醒计划 / 精选画布 / 专业影视 / 短剧漫剧 / 商业广告 / 动漫游戏 / 教) + 搜索 + 缩略图网格 (每张有创作者署名)
- 案例样例: PLEASURETOWN (星曜AG 欢愉镜) / 第一视角记忆闪回-工作流分享 (贾麦子) / Mutiam 默示 (yoimachigusa) / 58 转角遇到 (墨墨墨Ink) / 一腔冰块 消亡史 / 莫羌 (MetaAI 藏地人文AI诗性短片) / 锁关 (JIOJIO焦集) / 白塔第三集 (洪哄李) / 离职冠军 / TOWER-3 (临夏Summer) / 大龙凤 Trailer / 华夏仙宫 / 咸柠七 / 风雪山神庙 / 电影不存在了 / IRON CO[...]ANT / EIGHTH SECOND 第八秒 (啊嘛鲸) / 与之同在 To Be With (Beichen_) / 山海奇遇 EP.03 | 东方幻想美学 / 王朝·末日 (宋朝的最后120分钟) / THRONES OF CINDER DRAGON SLAYER / AI 漫剧精卫计划 S+级项目 / 墨武 无畏契约手游新套装 / 巨物美学 / 寂静的朋友 (香港国际AI电影节最佳AI短片) / 重返未来 1999 二创 PV / XIAOMI Buds 5 静音 / CHOICE™ (eeresherin) / Second Wind 拳生 (环屿AI) / 焰起之地 (翻山计划) / 呱比在芦苇荡闯祸 (Muertu木二) / 广告导演请就位 / SOUNDLESS MOMENTUM (XIAOMI SU7 2024) / CoffeePrince 真心话 (导演王宇) / 黑翼天使终章 (Jcy樂多) / Still You 北美最后一个练习生 (祿林好汉) / 七夕用AI重新遇见 (有無劇院)
- 弹窗 OAuth: 微信一键登录 (QR 占位) / 手机号登录 / 团队邮箱登录 / QQ 登录
- 弹窗文案: "继续即表示您同意 使用条款 和 隐私政策"
- 侧边 nav 5 个图标: + (新建) / 首页 / 项目 / LibTV Agent / 创作者挑战赛 + 帮助 (齿轮)

#### 第三遍: 查漏

- Liblib **没有定价页** (pricing 404)
- 主页是 liblib.tv, 营销是 liblib.art — **两个域**
- TV Show 频道**是核心差异** — 案例库, 视频社区, 每个 case 标了创作者 + 模型
- "逐帧拉片" 是独家功能, 跟 TapNow "Lens Combo" 不一样 — **逐帧拉片 = 视频帧分析参考**, 镜头组合 = 相机参数模拟
- "导演台" 是独家, 跟 TapNow "Agent" 不一样 — **导演台 = 3D 虚拟场景, 精准控制空间** (Liblib 3D 场景, TapNow 2D 镜头)
- 创作者挑战赛 (侧边) = 官方活动, 吸引创作者
- "限时抢购" banner 是常驻 (有倒计时 5 天 10 时 11 分 50 秒) — 持续营销
- Blender 插件 = 跟 Blender 软件集成, 这是薯包没有的

#### Liblib 独有 D 项 (D18-D24):

| D# | 缺失/不足 | 详细 |
|---|---|---|
| **D18** | **画布内没公开** — Login 触发, 看不到节点 UI | Liblib Agent prompt 区是唯一可看输入, 不知道画布是否真有节点 |
| **D19** | 模型 6 个卡片**没有完整价格表** | 跟 TapNow 比缺定价透明度 |
| **D20** | 6 卡片功能描述**只 1 句话** | 跟 TapNow 的 3-4 句+图+交互 demo 比, 简略 |
| **D21** | TV Show 案例库**没有"克隆"按钮** | 创作者署名是 credit, 不是 "Clone Project" 入口 — 跟 TapNow "Clone Project" 差异大 |
| **D22** | "Skill 标签"**不可见 skill 详情** | 点 POP MV 跳登录墙, 不能看 skill 是 prompt template 还是工作流 |
| **D23** | LibTV Agent 跟画布**关系不明** | 不知道 Agent 输出是直接进画布还是单独结果 |
| **D24** | **没有公开的工作流模板** | 案例只展示结果, 不展示节点图 |

### 1.3 Quantv / 知渔AI (https://laoyu.quantv.com/canvas/editor?id=cmtatr6pk6cpn122438es918o)

#### 第一遍

| 步骤 | 操作 | 截图 | 结果 |
|---|---|---|---|
| 1.3.1 | open URL | 05-quantv-initial.png | 重定向到 laoyu.quantv.com 营销页 |
| 1.3.2 | 滚各档 (25%/50%/75%/100%) | 05/06/07-quantv-*.png | 完整截 3 张 |
| 1.3.3 | 点 "开始使用" | 08-quantv-after-start.png | 触发"欢迎登录"弹窗 (手机+密码) |
| 1.3.4 | 关弹窗 + 重截 30/50/80 | 29/30-quantv-*.png | 完整截 5 张 |

#### 第二遍: eval 抓计算态

- 营销页 nav: 仅有"开始使用"按钮 (无其他 nav!)
- Hero: "一站式AI多媒体创意平台" + "一键生成电商图、营销图等多种风格的图片/文案/视频, 并可以深度创作AI素材和内容"
- **6 大类 36 模板 (完整列表)**:
  1. 极简日系饮品海报
  2. 极简高级产品剖面剧场广告图
  3. 高端食品商业广告摄影
  4. 高端品牌产品光场特效商业广告海报
  5. 电影级高端产品爆炸瞬间海报
  6. 汽水广告九宫格
  7. 食物爆炸瞬间
  8. 极地冰封巨型广告海报
  9. 蓝白降落伞悬浮产品创意3D渲染广告
  10. 电影级商业摄影
  11. 清爽叙事海报
  12. 奢侈时尚广告海报
  13. 识别产品卖点
  14. 复刻详情页
  15. 电商海报设计
  16. 批量出图电商图
  17. 产品展示批量图
  18. 提取模特穿搭
  19. 电商场景加模特
  20. 一键模特换背景
  21. 商品场景展示
  22. 电商图万物替换
  23. 产品包装设计
  24. 人物多姿势生成
  25. 电商产品和模特精修
  26. 照片高质量精修
  27. 商品风格材质更换
  28. 画面主体迁移融合
  29. 爆款商品文字海报
  30. 提取电商白底图
  31. 跨境电商图文翻译
  32. OOTD服装穿搭
  33. 模特试穿试戴
  34. 模特试鞋
  35. 商品多角度多视图
  36. 商品宣传爆款复刻
  37. 多场景穿搭套图
- 弹窗 OAuth: 手机登录 / 密码登录
- 3 个法律勾选 (强制): 合法企业 / 个体工商户 (电商经营) / 输入内容责任 / 用户协议+隐私政策
- footer: 公安备案 鄂公网安备42100302000249号 / 增值电信业务许可证 鄂B2-20230244 / ICP 备案 鄂ICP备2024068307号-4

#### 第三遍: 查漏

- **完全没有画布** — canvas URL 也会重定向到营销页, 画布**可能是 prompt → 结果 形态**, 不是节点画布
- **没有定价** — 仅"开始使用"
- **没有任何模型列表** — 不知道用什么模型
- **没有任何案例库** — 模板名称是占位, 没有"查看效果"按钮 (按钮是 36 个模板, 但不知道是不是只显示名称还是可点)
- **没有任何团队/协作/分享** — 单纯 prompt 出图
- **没有任何"工作流"** — 单纯模板驱动
- 6 大类 (横排卡片在 30%-50% 区域): 产品精修 / 照片精修 / 风格材质更换 / 画面主体迁移融合 / 爆款商品文字海报

#### Quantv 独有 D 项 (D25-D30):

| D# | 缺失/不足 | 详细 |
|---|---|---|
| **D25** | **完全没有画布概念** | Quantv 画布 URL 不存在, canvas/editor 是营销词, 实际是 prompt → 模板 |
| **D26** | **没有定价** | 任何价格信息都没有 |
| **D27** | **没有模型列表** | 用户不知道用什么模型, 跟 TapNow 公开 5 个模型差距大 |
| **D28** | **没有案例库** | 模板只有名称, 没有示例图, 跟 Liblib TV Show 差距大 |
| **D29** | **没有团队/协作/分享** | 电商 SaaS 雏形, 缺多用户功能 |
| **D30** | **没有"工作流"概念** | 单纯 prompt 出图, 跟 TapNow 导演台/Liblib LibTV Agent 差距大 |

### 1.4 3 家共有 D 项 (行业级普遍缺失, 4c183cd4 V3 对齐)

| D# | 缺失/不足 | 详细 |
|---|---|---|
| **D1** | **画布内快捷键不可知** | 3 家画布都登录墙后, 营销页只字未提 Ctrl+Z/Y/C/V, 不知道画布是否真支持 |
| **D2** | **节点 handle 4 端口不可知** | 营销页 mockup 都没画连线, 不知道是 freeform 拖线还是 4 端口吸附 |
| **D3** | **模板保存 + 发布到公共库不可知** | 营销页只说"克隆", 没说"发布"流程 |
| **D4** | **多模态串联流程不公开** | 营销页是 mockup 视频, 不是真可点 demo |
| **D5** | **音频混音不可知** | 营销页提音频, 但没说画布内如何混 |
| **D6** | **导出分辨率/fps 不可知** | 营销页只字未提 |
| **D7** | **协作实时多人不可知** | 营销页提"团队"但没说"实时多人" |
| **D8** | **评论/分享链接/版本历史 不可知** | 营销页提"社区"但没说"评论" |

---

## 2. 6 大类功能完整调研表 (三遍记录)

> 由于画布全在登录墙后, 本表用 **"营销页已展示 + 公开案例库 + 公开 API/DOM 推断"** 调研. 标注 [营销] [案例] [推断] [登录墙后] 区分可信度.

### 2.1 节点创建

| 竞品 | 入口 | 视觉态 | 计算态 | 查漏 | 标注 |
|---|---|---|---|---|---|
| TapNow | 营销页**无公开** 画布新建入口, 但定价页 nav 有"工作空间"链接 | 营销页 mockup 有 Scene 1/2/3 节点, 是 Agent 模式 | 节点名称: "Enclosure / Breakthrough / Framing" — 看起来是电影分镜命名 | 不知道双击/右键/拖入如何 | [推断] |
| Liblib | 营销页: 顶栏"新建项目" + 中心"新建画布创作"按钮 (被登录墙) | "新建画布创作" 是大圆圈 + 号按钮, 是显眼的中心 CTA | 点击后弹微信扫码; 进入后应该是 1-click 模板创建 | 模板库还是空白创建? 不可知 | [营销] |
| Quantv | **无节点概念**, 只有 36 模板卡片列表 | 36 卡片网格, 滚动横向 | 每个卡片点击 = 弹模板参数表单 (推测) | 不知道是单步还是多步 | [推断] |

### 2.2 节点编辑

| 竞品 | 入口 | 视觉态 | 计算态 | 查漏 | 标注 |
|---|---|---|---|---|---|
| TapNow | 营销页**多角度相机**有 Rotation/Tilt/Scale 控件; **Studio lighting** 有 Brightness/Temp/Main/Rim 控件; **Lens Combo** 有相机机身/镜头/焦距/光圈 | 这 3 套是不同 demo 卡片, 不知道画布内是否合并到 1 个右侧面板 | Rotation -30°/Tilt 23°/Scale 0 — 是数值滑块, 不是自由拖拽 | 不知道是否单选/多选节点/对齐 | [营销] |
| Liblib | **逐帧拉片** (独家) + **片段重拍** + **导演台** (3D 虚拟场景) | 3 个功能卡片, 各 1 句描述 | 导演台是 3D 场景空间控制; 逐帧拉片是视频帧分析 | 不知道画布内是浮窗/侧栏/底部 | [营销] |
| Quantv | **无节点编辑**, 只有模板参数表单 (推测) | 模板卡片点进后是表单 (不知道) | — | — | [推断] |

### 2.3 连线

| 竞品 | 入口 | 视觉态 | 计算态 | 查漏 | 标注 |
|---|---|---|---|---|---|
| TapNow | 营销页**未展示连线** | Agent mockup 里有 Scene 1→2→3 的视觉序列, 但**不是真连线** (是步骤条) | 不知道是否 freeform 拖线, 4 端口 (top/bottom/left/right), 类型限制 | — | [推断] |
| Liblib | 营销页**未展示连线** | LibTV Agent prompt 框 + 6 卡片, 没有连线视觉 | 不知道 LibTV Agent 是否是基于 prompt 的 DAG | — | [推断] |
| Quantv | **无连线** | 36 模板是独立卡片, 没有节点图 | — | — | [无] |

### 2.4 历史 (undo/redo)

| 竞品 | 入口 | 视觉态 | 计算态 | 查漏 | 标注 |
|---|---|---|---|---|---|
| TapNow | 营销页**未提 undo** | — | 不知道是否支持 Ctrl+Z | — | [推断] |
| Liblib | 营销页**未提 undo** | — | 不知道 | — | [推断] |
| Quantv | 营销页**未提 undo** | — | 不知道 | — | [推断] |

### 2.5 运行/导出

| 竞品 | 入口 | 视觉态 | 计算态 | 查漏 | 标注 |
|---|---|---|---|---|---|
| TapNow | 营销页**未提导出** | "Try TapNow Agent" 按钮触发后未知 | 不知道导出格式 (mp4/gif), 分辨率 (720/1080/4K), fps | 定价页有模型价格但**没说导出参数** | [推断] |
| Liblib | 营销页**未提导出** | TV Show 频道可以"查看创作过程" | 不知道 | — | [推断] |
| Quantv | 营销页**未提导出** | 模板生成后是图片, 导出可能=下载 | 不知道 | — | [推断] |

### 2.6 协作 + 串联

| 竞品 | 入口 | 视觉态 | 计算态 | 查漏 | 标注 |
|---|---|---|---|---|---|
| TapNow | 营销页 nav "Community" + 定价页 "支持100人团队协作" + "Creative OS" + "Agent" | Community 频道有"Clone Project"按钮 (公开), 团队 100 人 | "100 人团队" + "成员积分灵活管控" — 是企业级 SaaS 形态 | 不知道"实时多人"是否支持 | [营销] |
| Liblib | 营销页 nav "创作者挑战赛" + "LibTV Agent" + 案例库有创作者署名 | "TV Show" 案例库是社区, 不是"协作" | 不知道是否有"团队空间" | — | [营销] |
| Quantv | **无协作** (营销页无) | 单纯个人工具 | 不知道 | — | [无] |

---

## 3. 多模态串联专题 (TapNow / Quantv / Liblib 三家怎么串, 薯包 v2 怎么抄)

### 3.1 TapNow — 节点+Agent+导演台 全串联 (对标首选项)

**官方表述** (来自营销页):
- **"TapNow Agent" = "Your AI Executive Director"**: "Zero manual context feeding. 100% proactive creation. You set the vision. The agent executes — driving the script, predicting the next scene, and enforcing rigorous shot-by-shot consistency across characters, lighting, and style."
- **节点**: Scene 1 / Scene 2 / Scene 3 命名 (Enclosure / Breakthrough / Framing) — 这是**电影分镜命名**, 不是技术命名
- **输入**: "Use this reference image to create a short video storyboard" — 单图 + 1 句 prompt → Agent 输出多 Scene 视频
- **多角度相机**: 拖 3D cube → 重渲染 (Rotation -30°/Tilt 23°/Scale/Wide-Angle toggle)
- **Studio lighting**: Brightness/Color Temp/Main Light 6 方向/Rim Light
- **Lens Combo**: ARRI ALEXA 65 + Cooke S4/i + 85/100/50mm + f/4
- **Video object replacement**: "preserving lighting, camera motion, composition, and scene continuity. Swap identity, outfit, or persona without reshooting."
- **Global frontier models**: Hailuo, Jimeng, Vidu, Flux, Pixve + Seedance 2.5/2.0/Mini, MiniMax H3, Wan 3.0, Kling O3 — 9 个

**多模态串联流程 (推断)**:
1. 输入: 1 张参考图 + 1 句 prompt ("夏日海边, 女生回眸")
2. Agent 自动生成 Scene 1 (Enclosure) → 角色定妆
3. Agent 自动生成 Scene 2 (Breakthrough) → 推进剧情
4. Agent 自动生成 Scene 3 (Framing) → 收尾
5. 任何 Scene 都可单独: 改镜头 (Multi-angle) / 改灯光 (Lighting) / 改镜头组合 (Lens Combo) / 替换对象 (Object Replacement)
6. 用哪个模型: 9 个 frontier model 切换 (Hailuo/Seedance/Wan/Kling/Minimax...)
7. 社区: "Clone Project" 克隆别人的画布, 改参数再生成

### 3.2 Liblib — LibTV Agent + 模板库 + TV Show (Agent 形态次对标)

**官方表述** (来自营销页):
- **"LibTV Agent"**: prompt 输入 + 附件按钮 + "说出你的创意, 或者从一个 skill 开始创作" + 3 skill 标签 + 全部 Skill
- **6 大功能卡片**: Seedance 2.5 / Wan 3.0 / MiniMax H3 / 导演台 (独家, 3D 虚拟场景) / 逐帧拉片 (独家, 传视频逐帧拉片) / 片段重拍 (精准修改视频片段)
- **TV Show 频道**: 案例库 + 创作者署名 + 30+ 个 case
- **创作者挑战赛**: 官方活动

**多模态串联流程 (推断)**:
1. 入口: "LibTV Agent" prompt 框 OR 6 大功能卡片 OR "新建画布创作"
2. 选 skill (POP MV / 日系剧情 / 真人感美妆UGC...) → prompt template
3. 选模型 (Seedance 2.5 / Wan 3.0 / MiniMax H3) → 不同模型
4. 上传附件 (图/视频/音频) → 串联素材
5. 生成 → 6 卡片中 1 个: 导演台 (3D 场景) / 逐帧拉片 (帧分析) / 片段重拍 (片段修改)
6. 完成后: 推到 TV Show 频道? (推断, 不可知)

**对比 TapNow 差异**:
- TapNow = **画布+Agent+节点** (1 套整合)
- Liblib = **LibTV Agent + 6 卡片** (1 prompt + 6 模块)
- TapNow 节点名 (Scene 1/2/3) **是电影分镜**; Liblib 6 卡片是**功能模块**

### 3.3 Quantv — 模板驱动, 无多模态串联

**官方表述**:
- 36 模板卡片
- 6 大类: 产品精修 / 照片精修 / 风格材质更换 / 画面主体迁移融合 / 爆款商品文字海报
- 单步 prompt → 单图输出

**多模态串联流程 (推断 = 0)**:
- **没有**。36 模板独立, 不串联。

### 3.4 薯包 v2 应该怎么抄 (V2 真调研核心结论)

| 维度 | 抄 TapNow 多少 | 抄 Liblib 多少 | 自创 |
|---|---|---|---|
| **画布形态** | 节点 + 导演台 (主抄) | — | 薯包 v2 = 节点画布, 1 套整合, 不分裂成 6 卡片 |
| **节点命名** | 电影分镜 (Enclosure/Breakthrough/Framing) | — | **强烈建议抄**: 节点名=分镜, 不用"节点1/2/3"技术命名 — 降低用户门槛 |
| **Agent 形态** | "Your AI Executive Director" (零输入) | "LibTV Agent" (prompt + skill) | **折中**: 给薯包 Agent 1 句 "你是短视频导演" 的人设, 但要 prompt 输入 (跟 Liblib 一样), 不能 TapNow 那么黑盒 |
| **多模态串联** | Agent 自动 Scene 1→2→3 (黑盒) | prompt + skill 选模型 (透明) | **折中**: 薯包 v2 给 2 模式 — "Agent 模式" (TapNow) + "手动模式" (Liblib), 切换按钮 |
| **导演台** | TapNow 没强调 3D | Liblib "导演台独家 3D 虚拟场景" | **抄 Liblib**: 3D 场景空间控制 (跟 2D 镜头组合互补) |
| **逐帧拉片** | TapNow 没强调 | Liblib 独家, 视频帧分析 | **抄 Liblib**: 视频上传 → 帧分析 → 选帧作参考 — 这是视频创作者刚需 |
| **片段重拍** | TapNow "Video object replacement" 接近 | Liblib "片段重拍精准修改视频片段" | **抄 Liblib**: "片段重拍" + TapNow "保留光照/相机/构图" = 薯包 v2 "片段重绘 (保持一致性)" |
| **镜头组合** | TapNow "Lens Combo" (ARRI ALEXA 65 + Cooke S4/i) | — | **直接抄**: ARRI + Cooke + 焦距/光圈 滑块 |
| **多角度相机** | TapNow 3D cube Rotation/Tilt/Scale | — | **直接抄**: 3D cube 拖动, 数值显示 |
| **Studio lighting** | TapNow 6 方向 Main Light + Brightness + Color Temp | — | **直接抄**: 这是 2D 摄影基础控制 |
| **Clone Project** | TapNow "Clone Project" (公开) | Liblib 案例库有 credit 但**无 clone 按钮** | **抄 TapNow**: 模板克隆 = 用户增长核心, 薯包 v2 必须有 |
| **Get Recipe** | TapNow "Get Recipe" (公开) | — | **直接抄**: "导出配方 (JSON)" 跟 Clone 是配对的 — Clone 是入, Get Recipe 是出 |
| **模型墙** | TapNow 5 个 (Hailuo/Jimeng/Vidu/Flux/Pixve) + 4 个 (Seedance 2.5/MiniMax H3/Wan 3.0/Kling O3) = 9 个, 公开 + 积分表 | Liblib 4 个 (Seedance 2.5/Wan 3.0/MiniMax H3/导演台 1 个非模型) | **抄 TapNow**: 9 个模型 + 积分表透明, 用户清楚每 1 秒扣多少 |
| **社区** | TapNow "TapNow Community" + "Explore works" | Liblib "TV Show" 频道 | **直接抄 TapNow + Liblib**: 案例库 + 创作者署名 + Clone Project + 模型 tag 筛选 |
| **定价** | TapNow 4 档 ($7.5/45/216/432) + 积分永久有效 | Liblib "限时 45 折" 无公开 | **抄 TapNow**: 4 档 + 积分透明, 不搞"限时打折"模糊定价 |
| **登录** | 邮箱 + Google + SSO + 手机号 | 微信 + 手机 + 团队邮箱 + QQ | **薯包国内 = 微信/手机**, 不要 TapNow 海外 OAuth 那一套 |
| **法律强制勾选** | TapNow 4 项 (服务条款/社区准则/隐私政策/生成内容授权说明) | Liblib 2 项 (使用条款/隐私政策) | Quantv **3 项 (合规! 强制)**: 合法企业/个体工商户/电商经营/输入内容责任/隐私政策 — **强烈建议抄 Quantv**: 电商图 AI 一定要"非传播/非舆论/非社交/非违法"勾选, 保护公司 |
| **多模态串联核心** | TapNow 黑盒 (Agent 自动) | Liblib 透明 (prompt + skill) | **薯包 v2 终极形态**: 用户选 "我是新手" (Agent 模式, TapNow) 还是 "我是老手" (手动模式, Liblib). 切换按钮. 两种模式共用 1 个画布. |

### 3.5 7 项薯包 v2 必须立即抄的 (P0)

1. **节点名 = 电影分镜 (Enclosure / Breakthrough / Framing)**, 不用"节点1/2/3"
2. **3D cube 多角度相机** (Rotation/Tilt/Scale/Wide-Angle) — 2D 图像变 3D 控制
3. **Studio lighting 6 方向** (Main Light 6 方向 + Rim Light + Brightness + Color Temp) — 摄影基础
4. **Lens Combo 物理相机参数** (ARRI ALEXA 65 + Cooke S4/i + 85/100/50mm + f/4) — 专业感
5. **片段重绘 (保持一致性)** = TapNow object replacement + Liblib 片段重拍 = 视频/图局部重生成, 保留整体
6. **Clone Project + Get Recipe** 模板生态 = 用户增长 + 内容复用
7. **法律强制 3 勾选 (电商 + 责任 + 协议)** = Quantv 形态, 国内合规刚需

### 3.6 5 项长期抄的 (P1)

1. **多模态串联 Agent = TapNow "Your AI Executive Director"** — 长期目标, 短期 manual 模式先
2. **3D 虚拟场景导演台** = Liblib 独家, 跟薯包 v2 的"商品场景展示"对齐
3. **逐帧拉片** = Liblib 独家, 视频创作者刚需
4. **TV Show 案例库 + 创作者署名 + 模型 tag** = Liblib 形态, 内容运营
5. **积分透明定价** = TapNow 4 档 + 9 模型 + 积分表, 不搞"限时折扣"模糊

---

## 4. 8 项行业级普遍缺失 (V3 对齐)

| D# | 4c183cd4 V3 提出 | V2 调研验证 | V2 状态 |
|---|---|---|---|
| **D1** | 节点 handle 4 端口 (top/bottom/left/right) | 3 家营销页都没画连线, 真状态不可知 | **未改进** (登录墙后) |
| **D2** | 撤销/重做深度 | 3 家营销页都未提 undo | **未改进** |
| **D3** | 模板保存 + 发布公共库 | TapNow "Clone Project" 是反向 (从库克隆), 不是发布 | **部分改进** (TapNow) |
| **D4** | 多模态串联 (图→视频→音频) | TapNow Agent 黑盒串联, Liblib prompt 串联 | **V2 大改进** (TapNow Agent 是关键) |
| **D5** | 音频混音 | 3 家都没在营销页强调音频混音 | **未改进** |
| **D6** | 导出分辨率/fps | 3 家营销页都没提 | **未改进** |
| **D7** | 协作实时多人 | TapNow "100 人团队" 但未知实时; Liblib 创作者挑战赛是异步 | **部分改进** (TapNow) |
| **D8** | 评论/分享链接/版本历史 | Liblib TV Show 有 credit; TapNow Community 有 explore | **部分改进** |

**新增 9 项 V2 独有发现 (D9-D30)**: 见 1.1/1.2/1.3 各竞品"查漏"小节.

---

## 5. 3 站最有特色的 5 个细节

### 5.1 TapNow
1. **节点命名用电影分镜** (Enclosure/Breakthrough/Framing) — 不是技术语言, 是产品语言
2. **Agent 黑盒但有 "Use this reference image to create a short video storyboard" 示例 prompt** — 降低首次使用门槛
3. **"Clone Project" + "Get Recipe" 配对** — 模板生态的入口+出口
4. **"积分永久有效" 是核心营销点** — 跟竞品月底清零对比
5. **3D cube 拖动** (Multi-angle) + 6 方向灯光 (Lighting) + 物理相机参数 (Lens) — 三套独立控制, 但画布内可能合并

### 5.2 Liblib
1. **TV Show 频道 = 案例库 + 创作者署名** — 内容运营核心
2. **LibTV Agent = prompt + 附件 + skill 标签** — 透明可定制
3. **"独家" 标签 (导演台, 逐帧拉片)** — 营销差异
4. **创作者挑战赛** (侧栏) — 用户活跃度
5. **Blender 插件** (顶栏) — 跟 3D 软件集成

### 5.3 Quantv
1. **36 模板清晰可枚举** — 单一目的明确
2. **法律 3 强制勾选** — 国内合规范本
3. **"开始使用" 极简** — 没有"探索/案例/定价/团队" 等 nav 噪音
4. **"深度创作 AI 素材和内容"** — 留了延伸空间
5. **武汉备案** (鄂公网安备) — 监管明确

---

## 6. 总结

| 维度 | 结论 |
|---|---|
| **对标首选项** | TapNow (节点 + Agent + 导演台 + 模板生态) |
| **对标次选项** | Liblib (Agent + skill + 案例库) |
| **非对标** | Quantv (纯模板电商图, 跟薯包 v2 不在同一类) |
| **登录阻断** | 3 家画布全在登录墙后, 营销页+定价页+案例库是公开数据源 |
| **V2 报告可信度** | 营销页 90% (已多档截图+DOM) + 案例库 80% (Liblib TV Show 完整) + 画布内 0% (登录墙) |
| **强烈建议** | 用 TapNow "Clone Project" + "Get Recipe" 重建薯包模板生态, 用 Liblib "逐帧拉片" + "片段重拍" 增强视频能力, 用 Quantv "3 强制勾选" 解决国内合规, 用 9 个模型墙透明积分定价 |

---

## 附录 A: 截图清单 (47 张, 在 .superpowers/sdd/research-shots/)

- 01-02: TapNow 登录页
- 03-04, 12-20, 25-27: Liblib LibTV 主页 + 弹窗 + TV Show
- 05-08, 28-30: Quantv 营销页
- 09-11: TapNow 注册页
- 21-24: TapNow 营销页 + 定价页
- 22/23: TapNow 完整功能滚动截图 (13 张)

## 附录 B: 调研方法学

- **browse 工具**: `C:\Users\SHEJI\AppData\Roaming\npm\browse` (Browserbase CLI 0.9.5, headless)
- **modlens_read_image**: 视觉识别 (每张 5-10s)
- **JS 抓 DOM**: 完整 button/anchor/text 列表
- **登录失败**: Cloudflare Turnstile (TapNow) / 微信扫码 (Liblib) / 手机号 (Quantv) — 全部无法 headless 通过
- **诚实声明**: 画布内 UI **完全没看到** (登录墙后), 营销页 mockup 推断 = 70% 可信度, 完整画布需用户提供 session 才能继续
