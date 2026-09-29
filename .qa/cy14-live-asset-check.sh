#!/bin/sh
# 批 CY-⑭ 线上复验（**服务器侧**读已部署产物）
#
# 为什么不用浏览器打 https://shuimg.cn：
#   部署脚本自己就警告过 —— 「部署机是机房来源 + 域名未备案 + Cloudflare 仅 DNS」时腾讯云会拦
#   机房来源访问该域名，公网校验**物理上不可能跑通**（本批实测 page.goto → ERR_CONNECTION_RESET）。
#   所以「改动有没有真的上线」只能在服务器本地读产物来验。
#
# ⚠️ 两个踩过的坑，写在这里免得下一个人再踩：
#   ① **不要在整个 assets 目录里 grep**。部署日志里有一条
#      ⚠️ 2026-09-29 批 CY-⑮ 更正：`Remote locked step passed: Old static release
#      cleanup failed` 是**成功**日志 —— 那个步骤的 FailureMessage 本身就是它的失败文案。
#      旧 release 清理一直是好的。真正的原因是**上游**：`deploy-production.ps1` 正路径
#      `tar xzf` 覆盖解包前不删 `dist/`，累加物被 `cp -a` 复制进每一个 release
#      （所以每个 release 目录自己就有 6000+ 个 js，不是"旧 release 没清干净"）。
set -e
cd /var/www/shubao/current
echo "release: $(readlink -f /var/www/shubao/current)"
CSS=$(grep -o -E 'assets/[^"]+\.css' index.html | head -1)
echo "入口 css: $CSS   assets 下 js 总数: $(ls -1 assets/*.js 2>/dev/null | wc -l)（>100 = 旧产物没清干净）"
NEW=$(find assets -maxdepth 1 -name '*.js' -mmin -90 2>/dev/null)
echo "本次部署新写的 js: $(echo "$NEW" | grep -c .) 个"
echo

echo "── 新形态标记（应 ≥1）──"
for k in ec-canvas-config-trigger ec-canvas-config-group ec-canvas-config-popover ec-canvas-config-count-row data-canvas-config-trigger ec-canvas-ratio-shape.is-adaptive; do
  printf '%-32s css=%s\n' "$k" "$(grep -F -o -- "$k" "$CSS" 2>/dev/null | wc -l)"
done
echo

echo "── 旧的三块小弹层（应全为 0）──"
for k in ec-canvas-count-popover ec-canvas-ratio-popover ec-canvas-resolution-popover; do
  printf '%-32s css=%s\n' "$k" "$(grep -F -o -- "$k" "$CSS" 2>/dev/null | wc -l)"
done
echo

echo "── 越权裸 z-index（应全为 0；CANVAS_Z 权威块里只有 var(--cvl-z-*)）──"
for k in 'z-index:10004' 'z-index:10005' 'z-index:62'; do
  printf '%-32s css=%s\n' "$k" "$(grep -F -o -- "$k" "$CSS" 2>/dev/null | wc -l)"
done
echo

echo "── 水印面板层���（应走 --cvl-z-popover，不再是 62）──"
for f in assets/*.css; do
  if grep -q 'ec-wm-panel' "$f" 2>/dev/null; then
    grep -A3 'ec-wm-panel {' "$f" 2>/dev/null | grep -E 'z-index' | head -2
  fi
done
echo

echo "── 画布 chunk 里的四个新模型 + P0 签名 ──"
CANVAS=$(echo "$NEW" | xargs -r grep -l -F 'ec-canvas-config-trigger' 2>/dev/null | head -1)
echo "画布 chunk: ${CANVAS:-(未找到，可能本次是纯样式变更)}"
if [ -n "$CANVAS" ]; then
  for k in '自适应' '导出这张图片' '图片-NN' 'mediaRatioFor' 'looksLikeContentHash' 'dismissAllCanvasSurfaces'; do
    printf '  %-28s x%s\n' "$k" "$(grep -F -o -- "$k" "$CANVAS" 2>/dev/null | wc -l)"
  done
  echo "  onOpenWorkbench 签名（编译后是 <别名>=null）:"
  grep -o -E '.{0,16}onOpenWorkbench:[A-Za-z_$]+ *= *null' "$CANVAS" 2>/dev/null | head -3
  echo "  旧文案（应全为 0）:"
  for k in '导出整套图片' '电商图片交付' '电商图片'; do
    printf '    %-20s x%s\n' "$k" "$(grep -F -o -- "$k" "$CANVAS" 2>/dev/null | wc -l)"
  done
fi
echo

echo "── 站点与进程 ──"
curl -s -o /dev/null -w 'public_home=%{http_code}  ' https://shuimg.cn/
curl -s -o /dev/null -w 'public_ec_canvas=%{http_code}  ' https://shuimg.cn/ec-canvas
curl -s -o /dev/null -w 'local_health=%{http_code}\n' http://127.0.0.1:3002/health
pm2 list 2>/dev/null | grep -E 'shubao-production' | head -2
