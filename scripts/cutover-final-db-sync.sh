#!/bin/bash
# scripts/cutover-final-db-sync.sh
# ═══════════════════════════════════════════════════════════════════════════
# 换机收尾：把**旧机的运行时数据库**最后一次同步到新机（本脚本在**新机**上跑）。
#
# 为什么必须在切 DNS **之后**再跑一次：
#   旧机在切换前一直在收真实写入；新机同时也在写（后台任务）。
#   只有「先冻结旧机 → 再快照 → 再装上」才能保证不丢数据。
#   而且运行时库是 SQLite **WAL 模式**（实测 works.db-wal 有 4MB 未落盘页），
#   直接 cp works.db 会**漏掉这些写入** —— 所以用 better-sqlite3 的 online backup API。
#
# 前置自检：公网 /health 的 pid 必须已经等于**本机**的应用 pid。
#   不等于 → 说明 DNS 还没真正切过来，脚本拒绝执行（除非 --force）。
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

OLD_HOST="43.129.180.134"
OLD_KEY="/home/ubuntu/.ssh/migrate-tmp"
REMOTE_DIR="/home/ubuntu/shubao"
DB="$REMOTE_DIR/server/works.db"
APP="shubao-production"
STAMP=$(date +%Y%m%d-%H%M%S)
SNAP="/home/ubuntu/final-sync-$STAMP.db"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

ssh_old() { ssh -q -o LogLevel=ERROR -o BatchMode=yes -o ConnectTimeout=20 -i "$OLD_KEY" "ubuntu@$OLD_HOST" "$@"; }

step() { echo; echo "===== $* ====="; }

step "0/6 前置自检：公网是否已指向本机"
LOCAL_PID=$(curl -s --max-time 10 http://127.0.0.1:3002/health 2>/dev/null | sed -n 's/.*"pid":\([0-9]*\).*/\1/p' || true)
echo "  本机 pid = $LOCAL_PID"
if [ -z "$LOCAL_PID" ]; then
  echo "  !! 本机应用没起来（/health 取不到 pid），先解决再跑。已中止。"
  exit 1
fi

# 预期失败：大陆机房**经 Cloudflare 回访自己的公网域名通常不通**（实测新机 curl
#   https://shuimg.cn/health 取不到内容）。所以这里必须容错 —— 早先没容错，
#   curl 的非零退出码经 pipefail + set -e 直接把脚本打死在第 0 步，--force 根本没机会生效。
#   取不到公网 pid 时，改由**操作方从外部**确认切流已生效，再加 --force 继续。
PUB_PID=$(curl -s --max-time 10 "https://shuimg.cn/health?cb=$STAMP" 2>/dev/null | sed -n 's/.*"pid":\([0-9]*\).*/\1/p' || true)
echo "  公网 pid = ${PUB_PID:-（本机取不到，见下）}"
if [ -z "$PUB_PID" ]; then
  echo "  !! 本机无法访问公网 https://shuimg.cn —— 大陆机房经 Cloudflare 回访自身通常不通，属预期。"
  echo "     请由操作方**从外部**确认公网 /health 的 pid 已是本机 pid（$LOCAL_PID），再加 --force 重跑。"
  [ "$FORCE" -eq 1 ] || { echo "  已中止。"; exit 1; }
  echo "  --force 已给，继续。"
elif [ "$LOCAL_PID" != "$PUB_PID" ]; then
  echo "  !! 公网仍指向 pid=$PUB_PID，不是本机（DNS 未生效或边缘仍有缓存）。"
  [ "$FORCE" -eq 1 ] || { echo "  已中止。确认后再跑，或加 --force 强制继续。"; exit 1; }
  echo "  --force 已给，继续。"
else
  echo "  OK：公网已经就是本机。"
fi

step "1/6 冻结旧机应用（让数据源停止变化）"
ssh_old "pm2 stop $APP >/dev/null 2>&1; pm2 jlist | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);for(const p of j)if(p.name==='$APP')console.log('  旧机 $APP status='+p.pm2_env.status)})\"" || echo "  (旧机 pm2 查询失败，继续)"
ssh_old "ls -la --time-style=+%F_%T $DB $DB-wal 2>/dev/null | sed 's/^/  /'"

step "2/6 旧机生成一致性快照（online backup API，含 WAL）"
ssh_old "cd $REMOTE_DIR && node scripts/backup-runtime-db.cjs $REMOTE_DIR $DB $SNAP && ls -la $SNAP | sed 's/^/  /' && sha256sum $SNAP | sed 's/^/  /'"

step "3/6 拉取快照到本机"
scp -q -o BatchMode=yes -i "$OLD_KEY" "ubuntu@$OLD_HOST:$SNAP" "/home/ubuntu/final-sync-$STAMP.db"
sha256sum "/home/ubuntu/final-sync-$STAMP.db" | sed 's/^/  /'
LOCAL_SHA=$(sha256sum "/home/ubuntu/final-sync-$STAMP.db" | awk '{print $1}')
REMOTE_SHA=$(ssh_old "sha256sum $SNAP | awk '{print \$1}'")
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then echo "  !! sha256 不一致，中止"; echo "  旧机应用处于 stopped，请手动 pm2 start $APP"; exit 1; fi
echo "  OK：两端 sha256 一致"

step "4/6 停本机应用 + 备份现有库"
pm2 stop "$APP" >/dev/null 2>&1 || true
cp -a "$DB" "$DB.pre-final-sync-$STAMP" 2>/dev/null && echo "  已备份到 $DB.pre-final-sync-$STAMP" || echo "  (无现有库可备份)"
rm -f "$DB-wal" "$DB-shm"

step "5/6 装入快照"
cp -a "/home/ubuntu/final-sync-$STAMP.db" "$DB"
ls -la "$DB" | sed 's/^/  /'
node -e "
const path=require('node:path');
const D=require(require.resolve('better-sqlite3',{paths:['$REMOTE_DIR']}));
const db=new D('$DB');
console.log('  quick_check=' + db.prepare('pragma quick_check').get().quick_check);
console.log('  tables=' + db.prepare(\"select count(*) c from sqlite_master where type='table'\").get().c);
db.close();
"

step "6/6 起本机应用并复验"
pm2 start "$APP" >/dev/null 2>&1 || pm2 restart "$APP" >/dev/null 2>&1
sleep 6
curl -s -o /dev/null -w "  本机 /health code=%{http_code}\n" http://127.0.0.1:3002/health
NEW_PID=$(curl -s http://127.0.0.1:3002/health | sed -n 's/.*"pid":\([0-9]*\).*/\1/p')
echo "  新应用 pid = $NEW_PID"
echo
echo "完成。收尾别忘了："
echo "  · 旧机已 pm2 stop $APP，若确认不再需要可整机下线"
echo "  · 清理临时迁移密钥：新机 /home/ubuntu/.ssh/migrate-tmp、旧机 authorized_keys 里 temp-migration-key-new-server 那条"
echo "  · 清理临时文件：旧机 $SNAP、本机 /home/ubuntu/final-sync-$STAMP.db、works-snapshot.db、.delta-check.sh"
