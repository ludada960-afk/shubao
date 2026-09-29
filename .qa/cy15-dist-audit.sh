#!/bin/sh
# 验证「静态产物越堆越多」的真实位置。只读。
echo "── current release ──"
readlink -f /var/www/shubao/current
echo "  current/assets/*.js = $(ls -1 /var/www/shubao/current/assets/*.js 2>/dev/null | wc -l)"
echo
echo "── 暂存目录（每次 deploy 从这里 cp -a 出去）──"
if [ -d /home/ubuntu/shubao/dist ]; then
  echo "  /home/ubuntu/shubao/dist/assets/*.js = $(ls -1 /home/ubuntu/shubao/dist/assets/*.js 2>/dev/null | wc -l)"
  echo "  总占用: $(du -sh /home/ubuntu/shubao/dist 2>/dev/null | cut -f1)"
  echo "  最早/最新 mtime:"
  ls -1lt --time-style=+%Y-%m-%d /home/ubuntu/shubao/dist/assets/*.js 2>/dev/null | tail -1 | awk '{print "    最早:", $6}'
  ls -1lt --time-style=+%Y-%m-%d /home/ubuntu/shubao/dist/assets/*.js 2>/dev/null | head -1 | awk '{print "    最新:", $6}'
else
  echo "  （不存在）"
fi
echo
echo "── 各 release 目录各自的 assets 数量（说明是不是每个都复制了全量）──"
for d in /var/www/shubao/releases/*/; do
  [ -d "$d" ] || continue
  printf '  %-46s js=%s\n' "$(basename "$d")" "$(ls -1 "$d"assets/*.js 2>/dev/null | wc -l)"
done
echo
echo "── 磁盘 ──"
df -h /var/www /home 2>/dev/null | sed 's/^/  /'
echo
echo "── deploy-backups（回滚源，不许动）──"
echo "  目录数: $(ls -1d /home/ubuntu/shubao/deploy-backups/*/ 2>/dev/null | wc -l)"
du -sh /home/ubuntu/shubao/deploy-backups 2>/dev/null | sed 's/^/  /'
echo
echo "── 生产数据（绝对不许动，确认它们在哪、大小多少）──"
for p in /home/ubuntu/shubao/server/works.db /home/ubuntu/shubao/server/generated-assets; do
  if [ -e "$p" ]; then du -sh "$p" 2>/dev/null | sed 's/^/  /'; fi
done
