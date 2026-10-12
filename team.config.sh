# チーム運用の設定。環境変数で上書きできます（例：OPENCODE_MODEL=... scripts/opencode-worker.sh T-001）

# マージ先のブランチ
BASE_BRANCH="${BASE_BRANCH:-main}"

# opencode ワーカーのモデル（provider/model 形式）。空なら opencode の既定モデル
#   例：anthropic/claude-sonnet-5-5、openai/gpt-5.x、openrouter/...（`opencode models` で一覧）
OPENCODE_MODEL="${OPENCODE_MODEL:-}"

# Codex のモデル。空なら ~/.codex/config.toml の既定
CODEX_MODEL="${CODEX_MODEL:-}"
# Codex の推論強度（レビューは高め推奨）
CODEX_REVIEW_EFFORT="${CODEX_REVIEW_EFFORT:-high}"
CODEX_FIX_EFFORT="${CODEX_FIX_EFFORT:-medium}"

# レビュー→修正の往復上限。超えたら人間にエスカレーション
MAX_REVIEW_ROUNDS="${MAX_REVIEW_ROUNDS:-3}"

# minor 指摘も Codex に修正させるか（true/false）
FIX_MINOR="${FIX_MINOR:-false}"

# 1回の外部エージェント実行のタイムアウト（秒）。暴走対策
AGENT_TIMEOUT_SEC="${AGENT_TIMEOUT_SEC:-1200}"
