#!/usr/bin/env bash
# 共通関数。各スクリプトから source される。
set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --path-format=absolute --git-common-dir)"
ROOT="$(dirname "$ROOT")"
# shellcheck source=../team.config.sh
source "$ROOT/team.config.sh"

log()  { printf '\033[1;34m[team]\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m[team]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[team]\033[0m %s\n' "$*" >&2; exit 1; }

require_task() {
  [[ $# -ge 1 && -n "$1" ]] || die "タスクIDを指定してください（例：T-001）"
  [[ -f "$ROOT/tasks/$1.md" ]] || die "タスク指示書がありません：tasks/$1.md"
}

task_file()  { echo "$ROOT/tasks/$1.md"; }
wt_path()    { echo "$ROOT/.worktrees/$1"; }
run_dir()    { local d="$ROOT/.agent-runs/$1"; mkdir -p "$d"; echo "$d"; }
task_branch(){ cat "$(run_dir "$1")/branch" 2>/dev/null || die "$1 の worktree がありません。先に scripts/new-worktree.sh $1 <worker>"; }

# 指示書の front matter から値を取り出す（1行の単純な key: value のみ対応）
task_meta() {
  sed -n '/^---$/,/^---$/p' "$(task_file "$1")" | grep -E "^$2:" | head -1 | sed -E "s/^$2:[[:space:]]*//; s/[[:space:]]+#.*$//"
}

# files_allowed: [a, b] → 1行1ファイル
task_allowed_files() {
  task_meta "$1" files_allowed | tr -d '[]' | tr ',' '\n' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' | grep -v '^$' || true
}

current_round() { cat "$(run_dir "$1")/round" 2>/dev/null || echo 0; }

# {{KEY}} を環境変数 KEY の値で置換してテンプレートを描画
render() { node "$ROOT/scripts/render.mjs" "$1"; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "$1 が見つかりません。インストールしてください"; }

# timeout コマンドがあれば使う（macOS は coreutils の gtimeout）
with_timeout() {
  if command -v timeout >/dev/null; then timeout "$AGENT_TIMEOUT_SEC" "$@";
  elif command -v gtimeout >/dev/null; then gtimeout "$AGENT_TIMEOUT_SEC" "$@";
  else "$@"; fi
}
