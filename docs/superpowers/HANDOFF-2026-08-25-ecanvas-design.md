# 交接文档 · 电商画布视觉语言体系（主线程 → 合并线程）

> 写给接手的线程：本文档自包含，不依赖原会话上下文。按"已完成 / 待修 / 验证方法 / 红线 / backlog"五段读完即可无缝继续。

## 0. 任务背景

用户对电商画布（EcCanvas）的设计批注：图标审美不高级、hover 反馈缺乏体系、要求先调研前沿方案再动手、要"一套视觉语言"而非零散修补。经四轮迭代形成当前体系，全程未部署。

## 1. 已完成交付（全部在工作树 codex-ecommerce-stability）

### 1.1 设计 token 层 —— src/pages/EcCanvas/EcCanvas.css
- --ec-radius-sm/md/lg = 7/9/12px；--ec-shadow-1/2/3 双层柔和阶梯；--ec-ring-inset hover 内环
- --ec-motion-fast=130ms / base=200ms；--ec-ease-out=cubic-bezier(.16,1,.3,1) / spring=cubic-bezier(.34,1.56,.64,1)；--ec-hover-lift=-1px
- 全页 Lucide 统一笔宽 .ec-canvas-page svg[class*='lucide'] { stroke-width: 1.75 }，激活态（icon-button/tabs is-active）升至 2.0 与 semibold 文字同步
- tabs/command/icon-button/topbar/left-rail/bottom-toolbar/zoom/layers/selection-bar/text-node 全部接入 token

### 1.2 Hero 空状态（参照实现）
- 半透磨砂玻璃面板：rgba(255,255,255,.55) + backdrop-filter blur(10px) saturate(150%)，@supports 无 backdrop 时回退 rgba(252,253,254,.92)
- 光标聚光：面板 onMouseMove 写 --ec-spot-x/y 两个 CSS 变量，::before radial-gradient 高光层跟随，hover 才 opacity:1
- 五按钮：is-primary 唯一实心填充（上传图片），其余白面描边同级；48px 高、28px 图标芯片、入场 stagger 20-180ms、prefers-reduced-motion 全关停

### 1.3 Hero 图标活体化 —— src/pages/EcCanvas/components/HeroIcons.jsx
- 放弃手绘路径（用户否决），回归调研选型 Lucide，语义精配：
  上传图片=ImageUp · 上传视频=FileVideo(渲染为 file-play) · 从我的作品导入=FolderInput · 生成电商套图=WandSparkles · 生成视频=ImagePlay(图生视频隐喻)
- 包装组件 <HeroGlyph kind="image|video|works|suite|film">，类名 ec-hero-glyph ec-glyph-{bring|pull|magic}
- 三族环境循环（仅 hover 触发、transform-only）：bring=bob 上浮 1.2s / magic=twinkle 转角缩放脉冲 0.9s / pull=横向 nudge 1s
- 入场：ecGlyphIn 用 **backwards fill**（重要：曾用 forwards 导致 hover 替换 animation 时丢失 fill、图标隐身——已修复并实测，勿改回）
- reduced-motion：动画全关 + 字形强制 opacity:1

### 1.4 图标语义修正（index.jsx ACTION_ICONS + CanvasChrome.jsx）
- CanvasChrome 顶栏「新建」Sparkles→Plus（Sparkles 专属 AI 语义）
- regenerate→RefreshCw；remove-background→Eraser；image-info→Info；layer-edit→SquarePen（避免与图层面板 Layers3 撞形）
- index.jsx import 相应增删（+Eraser/Info/SquarePen −Shapes/Layers；hero 换 HeroGlyph 后 −Clapperboard/Image/LayoutGrid/Sparkles/Video）

### 1.5 View Transitions（index.jsx handleTabChange ~L3826）
- document.startViewTransition(() => flushSync(apply)) 包裹 setTab+dispatch；reduced-motion 或无 API 时直接 apply
- CSS ::view-transition-old/new(root) 绑定 --ec-motion-base/--ec-ease-out
- 需 import { flushSync } from 'react-dom'（已加）

## 2. 本次交接原因的 BUG（已修复，留档防复发）
**症状**：hover 五按钮图标消失。
**根因**：入场动画 forwards fill 被 hover 的 animation 简写替换，opacity 回落基础值 0。
**修复**：EcCanvas.css .ec-hero-glyph 改 backwards fill（自然态 opacity 1）。实测悬停 opacity=1 且 ecGlyphTwinkle running。
**教训**：同元素多 animation 来源时禁用 forwards 保终态。

## 3. 验证方法学（可复跑）
- 本地栈：3001 是另一会话常驻 server（node server/index.mjs）；前端 pnpm start 会因端口占用退化为 vite-only。当前 vite 在 **http://localhost:5174**（由主会话后台任务 pwsh-14 持有）
- 登录：白名单邮箱（server works.db account_access 表，如 867550189@qq.com）+ SMTP 未配置时 mock 验证码 **123456**
- 进画布：首页点「画布」；空状态仅在 当前画布 tab 且 nodes.length===0 时出现
- 实测断言样例：
  - 玻璃：getComputedStyle(panel).backdropFilter === 'blur(10px) saturate(1.5)'
  - 聚光：browse mouse hover 后 panel.style.--ec-spot-x 非空
  - 循环：hover 后 glyph.getAnimations() 含 ecGlyphTwinkle 且 state=running；同时 computed opacity==='1'
- 构建链：pnpm run check ✅；esbuild parse ✅；完整 vite build 需绕开视频线程缺失的 services/projects.js——用临时配置 vite.config.verify.mjs（alias 到 F:/da/shubao/.tmp-anno-verify/projects-stub.mjs），命令：pnpm exec vite build --config vite.config.verify.mjs

## 4. 协作红线（务必遵守）
1. **不要 git restore/checkout/stash 这些文件**：src/pages/EcCanvas/index.jsx、EcCanvas.css、components/HeroIcons.jsx、components/CanvasChrome.jsx、package.json——它们承载本设计任务全部成果，且今天 13:55 曾被并行写入整体重置回 HEAD 一次（已重放恢复）
2. ProjectAssetPicker.jsx 与 XhsContentMode.jsx 归视频线程：其出现/消失引发的 HMR 报错遮罩与画布无关，点掉即可；完整 vite build 若因此失败属预期
3. 提交归属拆分走 RTK.md 协议：主线程资产=上述五文件 + docs/superpowers/specs|research 下三份文档
4. DSH 平台侧：@deepseek-ai/dsh-client-ui-attachment 内有原生图片批注层补丁，DSH 自更新会抹掉——重打套件在 C:/Users/SHEJI/.dsh/annotation-patch/rebuild.cjs（幂等）

## 5. 恢复资产（工作树外，防覆盖）
- F:/da/shubao/.tmp-anno-verify/backups/：index.jsx、EcCanvas.css、HeroIcons.jsx、CanvasChrome.jsx 四文件快照 + ecanvas-design.patch（git diff 全量）
- 若再次被覆盖：git apply ecanvas-design.patch 即可整体恢复

## 6. Backlog（未做）
- P2：AI 生成中状态 border-beam（conic-gradient 描边，只用于生成中功能态，普通选中保持静态环）
- P3：左栏工具组磁吸（spring 350/28，需可用性验证）
- react-icons→lucide 其余页面迁移（Home/ec 等，映射表见 spec）
- hero 主操作是否让位给「生成电商套图」：产品决策待定
- 部署：明确禁止，未经用户授权只能用 scripts/deploy-production.ps1

## 7. 参考文档
- docs/superpowers/specs/2026-08-25-ecanvas-visual-language.md（体系规范，四阶段全记录）
- docs/superpowers/research/2026-08-25-icon-library-micro-interaction-research.md（图标库对比+九种微交互模式表）
- F:/da/shubao/RTK.md（跨线程协作协议与事故记录）
