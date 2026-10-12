#!/usr/bin/env bash
# 品質ゲート：typecheck → lint → test。引数でディレクトリを指定可（既定はカレント）。
# 結果の要約を最後に1行で出す：VERIFY: PASS / VERIFY: FAIL (<step>)
set -uo pipefail

DIR="${1:-.}"
cd "$DIR" || exit 1

for step in typecheck lint test; do
  echo "::: npm run $step"
  if ! npm run --silent "$step"; then
    echo "VERIFY: FAIL ($step)"
    exit 1
  fi
done
echo "VERIFY: PASS"
