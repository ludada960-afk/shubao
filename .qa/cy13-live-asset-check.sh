#!/bin/sh
# ═══ 批 CY-⑬ 线上复验（**服务器侧**读已部署产物）═════════════════════════════════════════════════
# 为什么不用浏览器打 https://shuimg.cn：
#   部署脚本自己就警告过 —— 「部署机是机房来源 + 域名未备案 + Cloudflare 仅 DNS」时腾讯云会拦
#   机房来源访问该域名，公网校验**物理上不可能跑通**（本批实测 page.goto → ERR_CONNECTION_RESET）。
#   所以「改动有没有真的上线」只能在服务器本地读产物来验。
#
# ⚠️ 两个踩过的坑，写在这里免得下一个人再踩：
#   ① **不要在整个 assets 目录里 grep**。本次部署日志里有一条
#      ⚠️ 2026-09-29 批 CY-⑮ 更正：`Remote locked step passed: Old static release
#      cleanup failed` 是**成功**日志 —— 那个步骤的 FailureMessage 本身就是它的失败文案。
#      旧 release 清理一直是好的。真正的原因是**上游**：`deploy-production.ps1` 正路径
#      `tar xzf` 覆盖解包前不删 `dist/`，累加物被 `cp -a` 复制进每一个 release
#      （所以每个 release 目录自己就有 6000+ 个 js，不是"旧 release 没清干净"）。
set -e
cd /var/www/shubao/current
echo "release: $(pwd)"
echo "入口 bundle: $(grep -o -E 'assets/[^"]+\.(js|css)' index.html | sort -u | tr '\n' ' ')"
echo "assets 下 js 总数: $(ls -1 assets/*.js 2>/dev/null | wc -l)　（>100 就是旧产物没清干净的信号）"
echo
NEW=$(find assets -maxdepth 1 -name '*.js' -mmin -60 2>/dev/null)
CSS=$(grep -o -E 'assets/[^"]+\.css' index.html | head -1)
echo "本次部署新写的 js: $(echo "$NEW" | grep -c . ) 个；入口 css: $CSS"
echo

echo "── 新形态标记（应 ≥1）──"
for k in ec-canvas-config-trigger ec-canvas-config-group ec-canvas-config-popover ec-canvas-config-count-row data-canvas-config-trigger; do
  printf '%-32s js=%s css=%s\n' "$k" "$(echo "$NEW" | xargs -r grep -l -F -- "$k" 2>/dev/null | wc -l)" "$(grep -F -o -- "$k" "$CSS" 2>/dev/null | wc -l)"
done
echo
echo "── 改造前的三颗小药丸 / 三块小弹层（应全为 0）──"
for k in 'ec-canvas-count-popover' 'ec-canvas-ratio-popover' 'ec-canvas-resolution-popover' 'aria-label="图片比例"' 'aria-label="生成数量"' 'aria-label="清晰度"'; do
  printf '%-32s js=%s css=%s\n' "$k" "$(echo "$NEW" | xargs -r grep -l -F -- "$k" 2>/dev/null | wc -l)" "$(grep -F -o -- "$k" "$CSS" 2>/dev/null | wc -l)"
done
echo
echo "── 视频框旧的 nth-of-type 槽位表（应为 0）──"
printf 'css: %s\n' "$(grep -F -o -- '.ec-canvas-video-controls > label:nth-of-type' "$CSS" 2>/dev/null | wc -l)"
echo
echo "── 六个 surface 标记各出现几次（video-* / suite-settings 应各 1）──"
CANVAS=$(echo "$NEW" | xargs -r grep -l -F -- 'data-canvas-config-trigger' 2>/dev/null | head -1)
echo "画布 chunk: $CANVAS"
for s in model config video-model video-config suite-settings skill; do
  printf '%-16s x%s\n' "$s" "$(grep -F -o -- "\"$s\"" "$CANVAS" 2>/dev/null | wc -l)"
done
echo
echo "── P0：onOpenWorkbench 必须在签名里解构（编译后是 <别名>=null，不是字面 onOpenWorkbench=null）──"
grep -o -E '.{0,20}onOpenWorkbench:[A-Za-z_$]+ *= *null' "$CANVAS" 2>/dev/null | head -4
echo "父组件接线（index.jsx 的 selectedWorkbenchOpen）:"
grep -o -E '.{0,30}onOpenWorkbench:[A-Za-z_$]+\}' "$CANVAS" 2>/dev/null | head -2
echo
echo "── 站点与进程 ──"
curl -s -o /dev/null -w 'public_home=%{http_code}  ' https://shuimg.cn/
curl -s -o /dev/null -w 'public_ec_canvas=%{http_code}  ' https://shuimg.cn/ec-canvas
curl -s -o /dev/null -w 'local_health=%{http_code}\n' http://127.0.0.1:3002/health
pm2 list 2>/dev/null | grep -E 'shubao-production' | head -2
