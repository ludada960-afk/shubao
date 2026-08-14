#!/bin/sh
set -u

trap 'status=$?; if [ "$status" -ne 0 ]; then printf "LOCK_RUNNER_EXIT:%s\n" "$status" >&2; fi' EXIT

lock_path=${1:?lock path is required}
owner_token=${2:?owner token is required}

command -v flock >/dev/null 2>&1 || exit 127
command -v base64 >/dev/null 2>&1 || exit 127
command -v timeout >/dev/null 2>&1 || exit 127

exec flock -n "$lock_path" sh -c '
owner_token=$1
printf "LOCK_ACQUIRED:%s\n" "$owner_token"

while IFS=: read -r request_id timeout_seconds command_payload input_payload; do
  input_payload=$(printf "%s" "$input_payload" | tr -d "\r")
  printf "LOCK_REQUEST:%s\n" "$request_id"
  case "$request_id" in
    ""|*[!A-Za-z0-9._-]*)
      printf "LOCK_PROTOCOL_ERROR:invalid request id\n" >&2
      exit 64
      ;;
  esac
  case "$timeout_seconds" in
    ""|*[!0-9]*)
      printf "LOCK_RESULT:%s:64\n" "$request_id"
      continue
      ;;
  esac

  command_text=$(printf "%s" "$command_payload" | base64 -d 2>/dev/null) || {
    printf "LOCK_RESULT:%s:65\n" "$request_id"
    continue
  }
  input_text=$(printf "%s" "$input_payload" | base64 -d 2>/dev/null) || {
    printf "LOCK_RESULT:%s:66\n" "$request_id"
    continue
  }

  printf "%s" "$input_text" | timeout --kill-after=30s "${timeout_seconds}s" sh -c "$command_text" 2>&1
  status=$?
  printf "\nLOCK_RESULT:%s:%s\n" "$request_id" "$status"
done
' sh "$owner_token"
