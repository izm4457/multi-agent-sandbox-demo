#!/usr/bin/env bash
# worktree の変更をタスクブランチにコミットする。files_allowed 外の変更があれば拒否する。
#   使い方：scripts/commit-task.sh <TASK> "<メッセージ>"
source "$(dirname "$0")/lib.sh"

TASK="${1:-}"; MSG="${2:-}"
require_task "$TASK"
[[ -n "$MSG" ]] || die "コミットメッセージを指定してください"
WT="$(wt_path "$TASK")"
[[ -d "$WT" ]] || die "worktree がありません：$WT"

cd "$WT"
changed="$(git status --porcelain --untracked-files=all | sed -E 's/^.{3}//' | sed -E 's/.* -> //' | grep -v '^node_modules$' || true)"
if [[ -z "$changed" ]]; then
  warn "変更がありません（コミットをスキップ）"
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
