#!/usr/bin/env bash
# worktree の変更をタスクブランチにコミットする。files_allowed 外の変更があれば拒否する。
#   使い方：scripts/commit-task.sh <TASK> "<メッセージ>"
#   メッセージ先頭の "<TASK>:" は取り除く（接頭辞の重複防止）。
#   コミット後（変更なしでも）verify を実行し .agent-runs/<TASK>/verify.log に保存する。
#   終了コード：0=成功かつ verify PASS / 1=引数エラー等 / 3=files_allowed 外の変更 / 4=コミット成功だが verify FAIL
source "$(dirname "$0")/lib.sh"

TASK="${1:-}"; MSG="${2:-}"
require_task "$TASK"
[[ -n "$MSG" ]] || die "コミットメッセージを指定してください"
if [[ "$MSG" == "${TASK}:"* ]]; then
  MSG="${MSG#"${TASK}:"}"
  MSG="${MSG#"${MSG%%[![:space:]]*}"}"   # 先頭の空白を除去
  [[ -n "$MSG" ]] || die "コミットメッセージが空です（接頭辞のみ）"
fi
WT="$(wt_path "$TASK")"
[[ -d "$WT" ]] || die "worktree がありません：$WT"

RUN="$(run_dir "$TASK")"

run_verify() {
  if "$ROOT/scripts/verify.sh" "$WT" >"$RUN/verify.log" 2>&1; then
    log "${TASK}：$(tail -1 "$RUN/verify.log")"
  else
    warn "${TASK}：$(tail -1 "$RUN/verify.log")"; exit 4
  fi
}

cd "$WT" || die "worktree に移動できません：${WT}"
changed="$(git status --porcelain --untracked-files=all | sed -E 's/^.{3}//' | sed -E 's/.* -> //' | grep -v '^node_modules$' || true)"
if [[ -z "$changed" ]]; then
  warn "変更がありません（コミットをスキップ）"
  run_verify
  exit 0
fi

allowed="$(task_allowed_files "$TASK")"
violations=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  grep -qxF "$f" <<<"$allowed" || violations+="  $f"$'\n'
done <<<"$changed"

if [[ -n "$violations" ]]; then
  printf '%s\n' "files_allowed 外の変更があります（オーケストレーターの判断が必要）：" "$violations" >&2
  exit 3
fi

git add -A -- $allowed 2>/dev/null || git add -A
git commit -q -m "$TASK: $MSG"
log "コミット：$(git log -1 --oneline)"
run_verify
