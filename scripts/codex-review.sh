#!/usr/bin/env bash
# Codex にタスクブランチの差分をレビューさせる（read-only サンドボックス）。
#   使い方：scripts/codex-review.sh <TASK>
#   出力　：.agent-runs/<TASK>/review-r<N>.json（schemas/review.schema.json 準拠）
#   終了コード：0=approve / 2=request_changes / 3=往復上限に到達 / 1=実行エラー
source "$(dirname "$0")/lib.sh"
require_cmd codex

TASK="${1:-}"
require_task "$TASK"
WT="$(wt_path "$TASK")"
[[ -d "$WT" ]] || die "worktree がありません：$WT"
RUN="$(run_dir "$TASK")"
BRANCH="$(task_branch "$TASK")"

ROUND=$(( $(current_round "$TASK") + 1 ))
if (( ROUND > MAX_REVIEW_ROUNDS )); then
  warn "${TASK}：レビュー往復が上限（${MAX_REVIEW_ROUNDS}）に達しました。人間の判断が必要です"
  exit 3
fi
echo "$ROUND" > "$RUN/round"

# 未コミットの変更が残っていたら止める（レビュー対象を確定させるため）
[[ -z "$(git -C "$WT" status --porcelain | grep -v ' node_modules$' || true)" ]] \
  || die "未コミットの変更があります。先に scripts/commit-task.sh $TASK \"...\""

# verify を最新状態で取り直す
"$ROOT/scripts/verify.sh" "$WT" >"$RUN/verify.log" 2>&1 || true

export TASK_ID="$TASK" ROUND MAX_REVIEW_ROUNDS
TASK_BODY="$(cat "$(task_file "$TASK")")"; export TASK_BODY
VERIFY_RESULT="$(tail -n 40 "$RUN/verify.log")"; export VERIFY_RESULT
PREVIOUS_REVIEW="$( [[ -f "$RUN/review-r$((ROUND-1)).json" ]] && cat "$RUN/review-r$((ROUND-1)).json" || echo '(初回レビュー)' )"; export PREVIOUS_REVIEW
PROMPT="$(render "$ROOT/templates/review-prompt.md")"

OUT="$RUN/review-r$ROUND.json"
args=(exec -s read-only -C "$WT" --ephemeral
      --output-schema "$ROOT/schemas/review.schema.json"
      -o "$OUT"
      -c "model_reasoning_effort=\"$CODEX_REVIEW_EFFORT\"")
[[ -n "$CODEX_MODEL" ]] && args+=(-m "$CODEX_MODEL")

log "Codex レビュー中：$TASK ラウンド $ROUND/$MAX_REVIEW_ROUNDS"
# 差分は stdin で渡す（Codex 側では <stdin> ブロックとして読まれる）
git -C "$WT" diff "$BASE_BRANCH...$BRANCH" \
  | with_timeout codex "${args[@]}" "$PROMPT" >"$RUN/codex-review-r$ROUND.log" 2>&1 \
  || die "Codex レビューが失敗しました（$RUN/codex-review-r$ROUND.log）"

# マージ判定はスクリプト側でも機械的に行う：blocker/major が1件でもあれば request_changes 扱い
node "$ROOT/scripts/review-summary.mjs" "$OUT"
