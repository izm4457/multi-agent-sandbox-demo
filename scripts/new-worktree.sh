#!/usr/bin/env bash
# タスク用の worktree とブランチを作る。
#   使い方：scripts/new-worktree.sh <TASK> <worker名>
#   結果　：.worktrees/<TASK>（ブランチ agent/<TASK>-<worker名>）。絶対パスを stdout に出す
source "$(dirname "$0")/lib.sh"

TASK="${1:-}"; WORKER="${2:-}"
require_task "$TASK"
[[ -n "$WORKER" ]] || die "worker名を指定してください（例：opencode / worker-claude）"

WT="$(wt_path "$TASK")"
BRANCH="agent/${TASK}-${WORKER}"
RUN="$(run_dir "$TASK")"

if [[ -d "$WT" ]]; then
  warn "$WT は既にあります。そのまま使います"
else
  # 依存タスクがマージ済みか確認
  for dep in $(task_meta "$TASK" depends_on | tr -d '[],'); do
    git -C "$ROOT" log "$BASE_BRANCH" --oneline --grep="^merge: $dep" | grep -q . \
      || die "依存タスク $dep がまだ $BASE_BRANCH にマージされていません"
  done
  git -C "$ROOT" worktree add -q "$WT" -b "$BRANCH" "$BASE_BRANCH"
  # 依存は共有（同じ lockfile 前提）。worktree ごとの npm install を省く
  ln -s "$ROOT/node_modules" "$WT/node_modules"
  log "worktree 作成：$WT（$BRANCH）"
fi

echo "$BRANCH" > "$RUN/branch"
echo "$WORKER" > "$RUN/worker"
git -C "$ROOT" rev-parse "$BASE_BRANCH" > "$RUN/base_sha"
echo 0 > "$RUN/round"
echo "$WT"
