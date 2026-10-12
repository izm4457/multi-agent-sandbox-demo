#!/usr/bin/env bash
# 全タスクの状態を一覧表示する。
source "$(dirname "$0")/lib.sh"

printf '%-7s %-14s %-11s %-6s %-16s %s\n' TASK ASSIGNEE STATE ROUND REVIEW TITLE
for f in "$ROOT"/tasks/T-*.md; do
  t="$(basename "$f" .md)"
  run="$ROOT/.agent-runs/$t"
  round="$(cat "$run/round" 2>/dev/null || echo -)"
  review="-"
  if [[ -f "$run/review-r$round.json" ]]; then
    review="$(node "$ROOT/scripts/review-summary.mjs" "$run/review-r$round.json" | head -1 | awk '{print $2}')"
  fi
  if git -C "$ROOT" log "$BASE_BRANCH" --oneline --grep="^merge: $t" | grep -q .; then state=merged
  elif [[ -d "$ROOT/.worktrees/$t" ]]; then state=in-progress
  else state=todo; fi
  printf '%-7s %-14s %-11s %-6s %-16s %s\n' "$t" "$(task_meta "$t" assignee)" "$state" "$round" "$review" "$(task_meta "$t" title)"
done
