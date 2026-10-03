#!/usr/bin/env bash
# READ-ONLY: what Nano Banana model does production actually call?
#
# WHY
#   server/index.mjs defaults NANO_BANANA_FLASH_MODEL to 'gemini-2.5-flash-image',
#   a model the vendor retired (replaced by 'gemini-3.1-flash-image'), and then
#   PASSES IT EXPLICITLY into createNanoBananaProviderAdapter — overriding the
#   adapter's own correct default. The adapter validates the requested model twice
#   (allowedModels, then the gateway's live list), so a retired name fails both ways:
#     · asking for 3.1  -> "不支持的 Nano Banana 模型" (not in allowedModels)
#     · asking for 2.5  -> "模型当前不可用"      (not on the gateway)
#   ⇒ the whole nano-banana-2 (flash) tier looks broken. But we have NOT confirmed it,
#     because the answer depends on whether production overrides it via env.
#
# USAGE (needs SSH reachable from this machine — a local VPN/proxy will NOT carry SSH)
#   scp -i C:/Users/SHEJI/.ssh/shubao_deploy_ed25519 scripts/check-prod-nano-model.sh \
#       ubuntu@43.129.180.134:/tmp/check-prod-nano-model.sh
#   ssh -i C:/Users/SHEJI/.ssh/shubao_deploy_ed25519 ubuntu@43.129.180.134 \
#       'bash /tmp/check-prod-nano-model.sh'
#
# SAFEGUARDS
#   · Read-only: pm2 list / describe, find, grep, sed -n. No writes, no restarts.
#   · Never prints a secret: it only reports whether NANO_BANANA_API_KEY EXISTS,
#     never its value. Do not add anything that echoes a key.
set -uo pipefail

say() { printf '\n===== %s =====\n' "$1"; }

say "1. pm2 process"
pm2 list 2>/dev/null | grep -i shubao || echo "(pm2 list unavailable)"

say "2. runtime config files on disk"
find /var/www/shubao /home/ubuntu/shubao -maxdepth 3 \
  \( -name '*.env' -o -name 'runtime*.env' -o -name '.env' \) 2>/dev/null | sort -u

say "3. Nano Banana NON-SECRET settings (key values deliberately never printed)"
for f in $(find /var/www/shubao /home/ubuntu/shubao -maxdepth 3 \
    \( -name '*.env' -o -name 'runtime*.env' -o -name '.env' \) 2>/dev/null | sort -u); do
  echo "--- $f"
  grep -E '^(NANO_BANANA_(BASE_URL|FLASH_MODEL|PRO_MODEL)|IMAGE_PRIMARY_BASE_URL)=' "$f" 2>/dev/null \
    || echo "   (no nano settings in this file)"
  grep -qE '^NANO_BANANA_API_KEY=' "$f" 2>/dev/null \
    && echo "   NANO_BANANA_API_KEY: present" \
    || echo "   NANO_BANANA_API_KEY: absent"
done

say "4. pm2 process env (non-secret only)"
PID=$(pm2 pid shubao-production 2>/dev/null | tr -d '\r' | head -1)
if [ -n "${PID:-}" ] && [ "$PID" != "0" ] && [ -r "/proc/$PID/environ" ]; then
  tr '\0' '\n' < "/proc/$PID/environ" \
    | grep -E '^(NANO_BANANA_(BASE_URL|FLASH_MODEL|PRO_MODEL)|IMAGE_PRIMARY_BASE_URL)=' \
    || echo "(none of those keys are in the process env)"
  tr '\0' '\n' < "/proc/$PID/environ" | grep -qE '^NANO_BANANA_API_KEY=' \
    && echo "NANO_BANANA_API_KEY: present in process env" \
    || echo "NANO_BANANA_API_KEY: NOT in process env"
else
  echo "(cannot read pm2 pid /proc env: pid='${PID:-}')"
fi

say "5. what the SHIPPED code defaults to"
for f in /var/www/shubao/current/server/index.mjs /home/ubuntu/shubao/server/index.mjs; do
  [ -r "$f" ] || continue
  echo "--- $f"
  grep -nE 'NANO_BANANA_(FLASH|PRO)_MODEL' "$f" | head -5
done
for f in /var/www/shubao/current/server/ecommerceEngine/nanoBananaProviderAdapter.mjs \
         /home/ubuntu/shubao/server/ecommerceEngine/nanoBananaProviderAdapter.mjs; do
  [ -r "$f" ] || continue
  echo "--- $f (adapter single-source declaration)"
  sed -n '/NANO_UPSTREAM_MODELS = Object.freeze/,/});/p' "$f" | head -6
done

say "6. gateway errors already logged"
LOG=$(pm2 describe shubao-production 2>/dev/null | grep -oE '/[^ ]*error\.log' | head -1)
if [ -n "${LOG:-}" ] && [ -r "$LOG" ]; then
  echo "log: $LOG"
  echo "-- count of model-unavailability lines:"
  grep -cE 'NANO_BANANA_MODEL_UNAVAILABLE|模型当前不可用|不支持的 Nano Banana 模型' "$LOG" 2>/dev/null || echo 0
  echo "-- last 5 (truncated):"
  grep -E 'NANO_BANANA_MODEL_UNAVAILABLE|模型当前不可用|不支持的 Nano Banana 模型' "$LOG" 2>/dev/null | tail -5 | cut -c1-220 || echo "(none)"
else
  echo "(error log not readable: '${LOG:-}')"
fi

say "7. which nano models upstream actually received"
if [ -n "${LOG:-}" ] && [ -r "$LOG" ]; then
  grep -oE 'gemini-[0-9.]+-(flash|pro)-image(-preview)?' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head
else
  echo "(skipped)"
fi

say "done"
