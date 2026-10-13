#!/usr/bin/env bash
# opencode をワーカーとして非対話実行し、verify まで行う。
#   使い方：scripts/opencode-worker.sh <TASK>
#   出力　：.agent-runs/<TASK>/opencode.log, worker-report.md, verify.log
#   終了コード：0=verify PASS / 1=失敗
source "$(dirname "$0")/lib.sh"
require_cmd opencode

TASK="${1:-}"
require_task "$TASK"
WT="$(wt_path "$TASK")"
[[ -d "$WT" ]] || WT="$("$ROOT/scripts/new-worktree.sh" "$TASK" opencode)"
RUN="$(run_dir "$TASK")"

export TASK_ID="$TASK" WORKTREE="$WT"
export TASK_BODY="$(cat "$(task_file "$TASK")")"
export ALLOWED_FILES="$(task_allowed_files "$TASK" | sed 's/^/- /')"
PROMPT="$(render "$ROOT/templates/worker-prompt.md")"

args=(run --auto --dir "$WT" --title "$TASK")
[[ -n "$OPENCODE_MODEL" ]] && args+=(-m "$OPENCODE_MODEL")

log "opencode 実行中：${TASK}（ログ：$RUN/opencode.log）"
set +e
( cd "$WT" && with_timeout opencode "${args[@]}" "$PROMPT" ) </dev/null >"$RUN/opencode.log" 2>&1
rc=$?
set -e
[[ $rc -eq 0 ]] || warn "opencode が終了コード $rc で終了しました"

# 最終メッセージ（完了報告）を抜き出す。取れなければログ末尾
tail -n 60 "$RUN/opencode.log" > "$RUN/worker-report.md"

if "$ROOT/scripts/verify.sh" "$WT" >"$RUN/verify.log" 2>&1; then
  log "${TASK}：$(tail -1 "$RUN/verify.log")"
  exit 0
else
  warn "${TASK}：$(tail -1 "$RUN/verify.log")（詳細：$RUN/verify.log）"
  exit 1
fi
