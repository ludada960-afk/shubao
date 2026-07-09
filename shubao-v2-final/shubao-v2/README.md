# 薯包AI v2 — 重构版

## 项目结构

```
shubao-v2/
├── index.html                  # 入口 HTML
├── vite.config.js              # Vite 配置（含 API 代理）
├── package.json
├── .env                        # API Key 配置
│
├── src/                        # 前端源码
│   ├── main.jsx                # 入口
│   ├── App.jsx                 # 路由 + 全局 Layout
│   ├── NoteModal.jsx           # 结果弹窗（重写为 JSX）
│   │
│   ├── store/
│   │   └── AppContext.jsx      # 全局状态管理（Context + useReducer）
│   │
│   ├── services/
│   │   └── api.js              # 所有 API 调用封装
│   │
│   ├── constants/
│   │   ├── images.js           # 角色图片映射
│   │   └── data.js             # Gallery/Pricing/Features/Tips 等数据
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.jsx      # 通用按钮
│   │   │   └── index.jsx       # Card/Modal/CopyButton/CharImg/Tag/Spinner/EmptyState
│   │   ├── layout/
│   │   │   ├── Navbar.jsx      # 顶部导航
│   │   │   └── Footer.jsx      # 底部
│   │   └── business/
│   │       └── Modals.jsx      # 登录弹窗 + 定价弹窗
│   │
│   ├── pages/
│   │   ├── Home/
│   │   │   ├── index.jsx       # 首页（重新设计：Hero+输入框合并）
│   │   │   └── Home.css        # 首页样式（含完整响应式）
│   │   ├── Gallery/
│   │   │   └── index.jsx       # 作品展示页
│   │   ├── Pricing/
│   │   │   └── index.jsx       # 定价页（含 FAQ）
│   │   ├── Works/
│   │   │   └── index.jsx       # 我的作品页
│   │   ├── Generate/
│   │   │   └── Loading.jsx     # 生成中加载视图
│   │   └── Ecommerce/
│   │       └── index.jsx       # 电商图生成页
│   │
│   └── styles/
│       └── design-tokens.css   # 设计系统（颜色/字体/间距/动画）
│
└── server/
    └── index.mjs               # 后端服务（原文件，未改动）
```

## 和 v1 相比的改进

### 架构重构
- **组件化拆分**：从 883 行单文件拆分为 20+ 个模块化组件
- **状态管理**：用 React Context + useReducer 替代散乱的 useState
- **API 层抽离**：所有 fetch 调用集中到 `services/api.js`
- **常量分离**：Gallery 数据、定价、功能等从代码中解耦到 `constants/`
- **设计系统**：CSS 变量体系（`design-tokens.css`），告别全 inline style

### 首页重设计
- **输入框提到 Hero 区**：用户无需滚动即可开始创作
- **标签云替代轮播**：14 条热门主题一眼可见，点击即填充
- **Before→After 对比**：自动轮播展示生成效果
- **去掉 localhost 依赖的 Demo 轮播**：部署后不会白屏
- **电商图降级为独立板块**：不抢主线注意力

### 响应式适配
- 移动端（<480px）、平板（<900px）、桌面 三档适配
- Gallery grid：4列 → 2列自适应
- Features grid：3列 → 2列 → 1列自适应
- Hero 区左右布局 → 上下堆叠

### UI / 体验
- NoteModal 从 `React.createElement` 重写为 JSX，可读性大幅提升
- 导航栏增加电商图入口
- 设计系统统一了阴影、圆角、间距、动画
- 加载动画优化
- 按钮 hover/active 微交互一致化

### 代码质量
- 每个文件职责单一，300 行以内
- import 路径清晰，依赖关系明确
- 去掉了未使用的依赖（agent-reach, codebase-memory-mcp, gm 等）

## 迁移步骤

```bash
# 1. 把原项目的 images/ 文件夹和 server/ 目录拷进来
cp -r 原项目/images/ shubao-v2/public/images/
# （server/index.mjs 已经包含在内）

# 2. 安装依赖
cd shubao-v2
npm install

# 3. 启动后端
npm run server

# 4. 启动前端
npm run dev
```

## 第二轮改进（新增）

### Prompt 热更新系统
- 4 个 prompt 模板从 2400 行服务器代码中抽离到 `server/prompts/` 目录
- `promptLoader.mjs` 支持**运行时热更新**：修改 .md 文件后无需重启服务器
- API 端点 `POST /api/prompts/reload` 清除缓存强制重载
- 变量替换：`{{current_year}}` / `{{category}}` / `{{text_content}}` 等自动注入

### 免费试用
- 新用户**不登录即可免费生成 1 次**
- 基于 IP 的简单限制（`/api/trial/status` 查询剩余次数）
- 首页生成按钮自动显示「🎁 免费体验一次」
- 用完后提示登录购买

### 文案可编辑
- NoteModal 底部新增「✏️ 编辑文案」按钮
- 点击后标题、正文、标签切换为可编辑状态
- 编辑后复制/导出使用修改后的内容
- 展示作品（Gallery）不允许编辑

### 登录系统骨架
- `services/auth.js` 预留 Supabase Auth 完整对接代码（注释状态）
- 当前使用 localStorage mock，取消注释 + 配置 env 即可切换
- 登录弹窗改为手机号 → 验证码两步流程
- 支持 `sendOTP()` / `verifyOTP()` / `getSession()` / `signOut()`

### 文件清单

```
新增文件：
  server/promptLoader.mjs          # Prompt 热加载器
  server/prompts/
    content-analysis-system.md     # 内容分析 System Prompt（612行）
    content-analysis-user.md       # 内容分析 User Prompt（52行）
    visual-planning-system.md      # 视觉规划 System Prompt（70行）
    visual-planning-user.md        # 视觉规划 User Prompt（11行）
  src/services/auth.js             # 认证服务（Supabase 骨架）

修改文件：
  server/index.mjs                 # 接入 promptLoader + 免费试用 API
  src/NoteModal.jsx                # 文案编辑功能
  src/services/api.js              # 免费试用状态 API
  src/pages/Home/index.jsx         # 免费试用提示
  src/components/business/Modals.jsx  # 登录流程改进
```
