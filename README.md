# ai-team-sandbox

Claude Code（Opus）をオーケストレーターに、Claude サブエージェントと opencode を実装ワーカー、
Codex をレビュー・不具合修正担当にした **AI開発チームの試走用プロジェクト** です。
題材は小さな TypeScript 製 TODO ライブラリ（`tiny-todo`）で、4つのタスクが用意されています。

```
            ┌──────────────── Claude Code (Opus) : オーケストレーター ────────────────┐
            │  /plan-tasks で分解 → /orchestrate で割り振り・判定・マージ              │
            └───────┬──────────────────────┬───────────────────────────┬──────────────┘
                    │ Agent ツール          │ scripts/opencode-worker.sh │ scripts/codex-*.sh
                    ▼                      ▼                           ▼
          worker-claude (Sonnet)      opencode (任意モデル)        Codex
          .worktrees/T-002 など       .worktrees/T-001 など        review: read-only → JSON
                                                                  fix   : workspace-write
                    └──────── commit-task.sh → verify → review ⇄ fix（最大3往復）→ merge-task.sh
```

## 1. 準備（初回のみ）

動作確認したバージョン：Claude Code 2.1.296 / codex-cli 0.162.1 / opencode 1.19.0 / Node 22

```bash
# CLI のインストール
npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai

# それぞれログイン（サブスクリプション or API キー）
claude            # 起動して /login
codex login
opencode auth login

# プロジェクトの依存とベースライン確認
cd ai-team-sandbox
npm ci
npm run verify    # → VERIFY: PASS
scripts/status.sh # 4タスクが todo で並ぶ
```

モデルは `team.config.sh` で設定します（環境変数でも上書き可）。

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `OPENCODE_MODEL` | opencode の既定 | ワーカーB のモデル（`opencode models` で一覧） |
| `CODEX_MODEL` | `~/.codex/config.toml` の既定 | レビュー・修正のモデル |
| `MAX_REVIEW_ROUNDS` | 3 | レビュー往復の上限 |
| `FIX_MINOR` | false | minor 指摘も修正させるか |
| `AGENT_TIMEOUT_SEC` | 1200 | 外部エージェント1回の制限時間 |

## 2. 試走の進め方（おすすめの順番）

いきなり全部を自動で回さず、部品ごとに確認してから広げると問題を切り分けやすいです。

### Step 1：opencode ワーカー＋Codex レビューを手動で1往復

```bash
scripts/new-worktree.sh T-001 opencode
scripts/opencode-worker.sh T-001           # 実装 → verify
scripts/commit-task.sh T-001 "filterTodos を実装"
scripts/codex-review.sh T-001              # 0=approve / 2=要修正 / 3=往復上限
scripts/codex-fix.sh T-001                 # 要修正なら
scripts/codex-review.sh T-001
scripts/merge-task.sh T-001
```

確認ポイント：`.agent-runs/T-001/` の `opencode.log`・`review-r1.json`・`fix-r1.md` の中身が期待通りか。

### Step 2：オーケストレーターに並列で任せる

```bash
claude --model opus
> /orchestrate T-002 T-003
```

T-002 と T-003 は `worker-claude` が並列で実装し、それぞれ Codex レビューを経てマージされます。

### Step 3：残りを全部任せる

```
> /orchestrate
```

T-004（CLI の組み立て）は T-001〜T-003 のマージ後にしか着手できないよう、スクリプト側でも止めています。

### Step 4：新しい機能を自分で足してみる

```
> /plan-tasks 期限切れTODOの件数を表示する stats サブコマンドを追加したい
```

指示書を確認してから `/orchestrate` に進みます。

## 3. ファイル構成

| パス | 役割 |
| --- | --- |
| `AGENTS.md` | 全エージェント共通のルール（正本）。Codex・opencode が直接読む |
| `CLAUDE.md` | `@AGENTS.md` を取り込み、オーケストレーター固有の指示を追加 |
| `.claude/agents/worker-claude.md` | Claude ワーカー（Sonnet）の定義 |
| `.claude/skills/orchestrate/` | `/orchestrate`：割り振りからマージまでの手順 |
| `.claude/skills/plan-tasks/` | `/plan-tasks`：機能要望をタスク指示書に分解 |
| `.claude/settings.json` | スクリプト実行の許可、`git push` などの禁止、マージは毎回確認 |
| `opencode.json` | opencode の権限（commit・push・依存追加・外部ディレクトリを禁止） |
| `tasks/T-00x.md` | タスク指示書（assignee・depends_on・files_allowed 付き） |
| `templates/` | ワーカー・レビュー・修正へのプロンプト、報告とタスクのひな形 |
| `schemas/review.schema.json` | Codex レビュー出力の JSON スキーマ（`--output-schema`） |
| `scripts/` | worktree 作成・コミット・verify・opencode/Codex 呼び出し・マージ・状態表示 |

## 4. 仕組みで守っていること

- **作業場所の分離**：タスクごとに `.worktrees/<TASK>`＋`agent/<TASK>-<worker>` ブランチ。`node_modules` は共有リンク
- **変更範囲の制限**：`commit-task.sh` が `files_allowed` 外の変更を検出したら終了コード 3 で止める
- **コミットとマージはスクリプトだけ**：ワーカーと Codex には commit をさせない（Codex のサンドボックスとも相性が良い）
- **機械的なマージ判定**：Codex が approve と言っても blocker/major が残っていれば request_changes 扱い
- **マージ後の verify**：落ちたらマージを取り消す
- **往復上限とタイムアウト**：`MAX_REVIEW_ROUNDS` を超えたら止めて人間にエスカレーション
- **コンテキスト節約**：オーケストレーターには差分ではなく要約（`review-summary.mjs` の出力）だけを返す

## 5. 試走中に見ておくとよいこと

- **手戻り率**：レビュー1回目で approve になった割合。低ければ指示書の書き方を見直す
- **指摘の妥当性**：Codex の指摘のうち、実際に直す価値があったものの割合
- **ワーカーごとの差**：同じ粒度のタスクで opencode と worker-claude の品質・速度・コストを比べる
- **オーケストレーターのコンテキスト**：/orchestrate 1回でどれだけ使ったか（`/cost` などで確認）

## 6. トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| Codex が応答せず止まる | スクリプトは stdin を明示的に渡しています。手動実行時は `</dev/null` を付ける |
| opencode が権限確認で止まる | `--auto` 付きで実行しています。`opencode.json` の deny ルールに当たっていないかログを確認 |
| Codex 修正後の verify で書き込みエラー | `codex-fix.sh` は `node_modules` を `--add-dir` しています。worktree を作り直すと直ることがあります |
| worker-claude がメイン側を編集した | `git status` で確認して戻し、worker-claude.md の指示を強めるか `isolation: worktree` を検討 |
| マージで「未コミットの変更があります」 | メインの作業ツリーを綺麗にしてから再実行 |
| やり直したい | `git worktree remove --force .worktrees/<TASK>; git branch -D agent/<TASK>-*; rm -rf .agent-runs/<TASK>` |

各 CLI のフラグは更新が速いので、動かないときはまず `codex exec --help` / `opencode run --help` で確認してください。
