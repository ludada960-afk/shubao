#!/usr/bin/env bash
# 薯包AI 一键部署脚本
# 在线上服务器 /home/ubuntu/shubao 下执行
# 用法: bash deploy.sh
#
# 作用: git pull → 检查依赖变化 → vite build → pm2 restart → 自检
# 设计原则:
#   1. 失败即停 (set -euo pipefail)，绝不在半崩状态重启
#   2. 数据文件 (works.json / users.json / .env / uploads 等) 不在 git 里，永不被覆盖
#   3. pm2 进程名硬编码为 shubao，端口 3001
#   4. 每步打印分隔条，出错一眼看出卡在哪

set -euo pipefail

# ───────────────────────────── 配置 ─────────────────────────────
PROJECT_DIR="/home/ubuntu/shubao"
PM2_APP="shubao"
PORT=3001
BRANCH="master"
SSH_ORIGIN="origin"   # 服务器 git remote，默认 origin

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}▶ $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
die()  { echo -e "${RED}✗ $1${NC}"; exit 1; }

cd "$PROJECT_DIR" || die "项目目录不存在: $PROJECT_DIR"

# ───────────────────────────── 0. 前置检查 ─────────────────────────────
step "0. 前置检查"
[[ -d .git ]] || die "当前目录不是 git 仓库: $PROJECT_DIR"
command -v git >/dev/null || die "未安装 git"
command -v npx >/dev/null || die "未安装 node/npm"
command -v pm2 >/dev/null || die "未安装 pm2 (npm i -g pm2)"
ok "环境就绪: $(pwd)"

# ───────────────────────────── 1. git pull ─────────────────────────────
step "1. 拉取最新代码 (git pull $BRANCH)"
# 备份当前 HEAD，方便回滚说明
OLD_HEAD=$(git rev-parse --short HEAD)
echo "  当前 HEAD: $OLD_HEAD"

# 检查是否有未追踪/本地修改会挡住 pull
if ! git diff --quiet --exit-code || ! git diff --cached --quiet --exit-code; then
  warn "工作区有未提交的修改（可能是本地数据文件被 git 纳管了？）:"
  git status --short
  die "请先处理工作区再部署，deploy.sh 不会自动 stash/丢弃任何东西"
fi

git pull "$SSH_ORIGIN" "$BRANCH"
NEW_HEAD=$(git rev-parse --short HEAD)

if [[ "$OLD_HEAD" == "$NEW_HEAD" ]]; then
  ok "已经是最新 ($NEW_HEAD)，无新提交"
  NO_CHANGE=1
else
  ok "已更新: $OLD_HEAD → $NEW_HEAD"
  NO_CHANGE=0
fi

# ───────────────────────────── 2. 依赖检查 ─────────────────────────────
step "2. 检查依赖变化"
# 只在 package.json/lock 有变化时才 npm install（省时间）
if git diff --name-only "$OLD_HEAD" "$NEW_HEAD" 2>/dev/null | grep -qE '^package(-lock)?\.json$'; then
  warn "package.json 有变化，执行 npm install"
  npm install --omit=dev=false
  ok "依赖已更新"
else
  ok "package.json 未变化，跳过 npm install"
fi

# ───────────────────────────── 3. vite build ─────────────────────────────
step "3. 构建前端 (npm run build)"
# npm run build = verify-exports → vite build
npm run build
NEW_BUNDLE=$(node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const m=h.match(/assets\\/(index-[^.]+\.js)/);console.log(m?m[1]:'')" 2>/dev/null || true)
[[ -n "$NEW_BUNDLE" ]] || die "从 dist/index.html 未找到 bundle 引用"
ok "新 bundle: $NEW_BUNDLE"

# ───────────────────────────── 4. pm2 restart ─────────────────────────────
step "4. 重启服务 (pm2 restart $PM2_APP)"
pm2 restart "$PM2_APP" --update-env
sleep 2   # 给 node 一点时间起来 / 崩
ok "pm2 已发出 restart 指令"

# ───────────────────────────── 5. 自检 ─────────────────────────────
step "5. 部署自检"

# 5.1 进程状态
echo "  [5.1] 进程状态:"
pm2 describe "$PM2_APP" | grep -E 'status|pid|uptime|exec cwd' | sed 's/^/    /' || die "pm2 找不到进程 $PM2_APP"

# 5.2 端口监听 (给 node 最多 8 秒起来)
echo "  [5.2] 端口 $PORT 监听检查:"
LISTEN_OK=0
for i in 1 2 3 4 5 6 7 8; do
  if ss -tlnp 2>/dev/null | grep -q ":$PORT .*node"; then
    LISTEN_OK=1
    break
  fi
  sleep 1
done
[[ $LISTEN_OK -eq 1 ]] || die "端口 $PORT 没在监听 — 进程可能崩了，看 pm2 logs $PM2_APP --err"
ss -tlnp 2>/dev/null | grep ":$PORT" | sed 's/^/    /'
ok "端口 $PORT 正在监听"

# 5.3 HTTP 返回的 bundle 就是刚 build 的那个
echo "  [5.3] 线上 HTML 引用的 bundle:"
SERVED_BUNDLE=$(curl -s "http://localhost:$PORT/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -n1 || true)
echo "    HTML 里: $SERVED_BUNDLE"
echo "    刚 build: $NEW_BUNDLE"
[[ "$SERVED_BUNDLE" == "$NEW_BUNDLE" ]] || die "线上 HTML 引用的 bundle ($SERVED_BUNDLE) ≠ 刚 build 的 ($NEW_BUNDLE)，可能有缓存或 build 没生效"
ok "线上正在使用最新 bundle"

# 5.4 API 活着 (打一个已知会返回结构化响应的端点)
echo "  [5.4] API 健康检查:"
API_RESP=$(curl -s -X POST "http://localhost:$PORT/api/ecommerce-preview" \
  -H 'Content-Type: application/json' \
  -d '{"product_name":"部署自检探针"}' || true)
echo "    $API_RESP"
echo "$API_RESP" | grep -q 'product_name' && ok "API 正常响应" || warn "API 返回异常，手动检查: pm2 logs $PM2_APP --err"

# ───────────────────────────── done ─────────────────────────────
step "✅ 部署完成"
echo -e "  ${GREEN}HEAD${NC}: $NEW_HEAD"
echo -e "  ${GREEN}Bundle${NC}: $NEW_BUNDLE"
echo -e "  ${GREEN}端口${NC}: $PORT (pm2: $PM2_APP)"
echo -e "  ${GREEN}站点${NC}: https://shuimg.cn  (强刷 Ctrl+Shift+R 看效果)"
echo ""
if [[ "${NO_CHANGE:-0}" == "1" ]]; then
  echo -e "  ${YELLOW}提示${NC}: 本次没有新提交，仅重新 build 并重启了服务。"
fi
echo -e "  ${YELLOW}回滚${NC}: git checkout $OLD_HEAD -- . && npx vite build && pm2 restart $PM2_APP"
