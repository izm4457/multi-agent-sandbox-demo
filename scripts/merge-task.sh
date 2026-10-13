#!/usr/bin/env bash
# レビュー approve 済みのタスクを BASE_BRANCH にマージし、worktree を片付ける。
# マージ後の verify が落ちたらマージを取り消す。オーケストレーターだけが実行する。
#   使い方：scripts/merge-task.sh <TASK>
source "$(dirname "$0")/lib.sh"

TASK="${1:-}"
require_task "$TASK"
RUN="$(run_dir "$TASK")"
BRANCH="$(task_branch "$TASK")"
WT="$(wt_path "$TASK")"
ROUND="$(current_round "$TASK")"

[[ -f "$RUN/review-r$ROUND.json" ]] || die "レビュー結果がありません"
node "$ROOT/scripts/review-summary.mjs" "$RUN/review-r$ROUND.json" >/dev/null \
  || die "最新レビュー（r${ROUND}）が approve ではありません"

cd "$ROOT" || die "リポジトリ直下に移動できません：${ROOT}"
[[ "$(git branch --show-current)" == "$BASE_BRANCH" ]] || die "$BASE_BRANCH をチェックアウトした状態で実行してください"
[[ -z "$(git status --porcelain)" ]] || die "メインの作業ツリーに未コミットの変更があります"

git merge --no-ff --no-commit "$BRANCH" >/dev/null || { git merge --abort; die "コンフリクトが発生しました。マージを中止しました"; }
if ! "$ROOT/scripts/verify.sh" "$ROOT" >"$RUN/verify-merged.log" 2>&1; then
  git merge --abort
  die "マージ後の verify が失敗しました（$RUN/verify-merged.log）。マージを中止しました"
fi
git commit -q -m "merge: $TASK $(task_meta "$TASK" title)" \
  -m "worker: $(cat "$RUN/worker" 2>/dev/null || echo '?') / review rounds: $ROUND"

git worktree remove --force "$WT"
git branch -q -d "$BRANCH"
log "マージ完了：$(git log -1 --oneline)"
