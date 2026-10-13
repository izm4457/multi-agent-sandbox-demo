#!/usr/bin/env bash
# 直近のレビュー指摘を Codex に修正させ、コミット → verify まで行う。
#   使い方：scripts/codex-fix.sh <TASK>
#   終了コード：0=修正後 verify PASS / 1=失敗（verify FAIL を含む） / 3=files_allowed 外の変更
source "$(dirname "$0")/lib.sh"
require_cmd codex

TASK="${1:-}"
require_task "$TASK"
WT="$(wt_path "$TASK")"
RUN="$(run_dir "$TASK")"
ROUND="$(current_round "$TASK")"
REVIEW="$RUN/review-r$ROUND.json"
[[ -f "$REVIEW" ]] || die "レビュー結果がありません：${REVIEW}（先に codex-review.sh）"

# 修正対象の指摘だけ渡す
FINDINGS="$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const fixMinor = process.argv[2] === "true";
  const targets = r.findings.filter(f => f.severity !== "minor" || fixMinor);
  console.log(JSON.stringify(targets, null, 2));
' "$REVIEW" "$FIX_MINOR")"
export FINDINGS
[[ "$FINDINGS" != "[]" ]] || { log "修正対象の指摘はありません"; exit 0; }

export TASK_ID="$TASK" WORKTREE="$WT"
TASK_BODY="$(cat "$(task_file "$TASK")")"
export TASK_BODY
ALLOWED_FILES="$(task_allowed_files "$TASK" | sed 's/^/- /')"
export ALLOWED_FILES
PROMPT="$(render "$ROOT/templates/fix-prompt.md")"

args=(exec -s workspace-write -C "$WT" --ephemeral
      --add-dir "$ROOT/node_modules"   # vitest のキャッシュ書き込み用（node_modules は共有シンボリックリンク）
      -o "$RUN/fix-r$ROUND.md"
      -c "model_reasoning_effort=\"$CODEX_FIX_EFFORT\"")
[[ -n "$CODEX_MODEL" ]] && args+=(-m "$CODEX_MODEL")

log "Codex 修正中：${TASK}（ラウンド $ROUND の指摘）"
# </dev/null：非TTYから起動されたとき Codex が stdin を待ち続けないようにする
with_timeout codex "${args[@]}" "$PROMPT" </dev/null >"$RUN/codex-fix-r$ROUND.log" 2>&1 \
  || die "Codex 修正が失敗しました（$RUN/codex-fix-r$ROUND.log）"

rc=0
"$ROOT/scripts/commit-task.sh" "$TASK" "fix review round $ROUND (codex)" || rc=$?

case $rc in
  0) exit 0 ;;
  3) exit 3 ;;
  4) exit 1 ;;
  *) exit 1 ;;
esac
