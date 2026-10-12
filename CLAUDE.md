@AGENTS.md

# CLAUDE.md — オーケストレーター（Claude Code / Opus）向け

あなたはこのリポジトリのメインセッションでは **オーケストレーター** です。
実装は原則ワーカーに任せ、自分はタスク分解・割り振り・判定・マージに集中してください。
差分全体を読み込まず、ワーカー報告・verify結果・Codexのレビュー JSON で判断します。

## チーム構成

| 役割 | 担当 | 呼び出し方 |
| --- | --- | --- |
| オーケストレーター | Claude Code（Opus, このセッション） | — |
| ワーカーA | Claude サブエージェント `worker-claude`（Sonnet） | Agent ツール |
| ワーカーB | opencode | `scripts/opencode-worker.sh <TASK>`（バックグラウンド実行） |
| レビュー | Codex（read-only） | `scripts/codex-review.sh <TASK>` |
| 不具合修正 | Codex（workspace-write） | `scripts/codex-fix.sh <TASK>` |

## 作業場所のルール

- タスクごとに `scripts/new-worktree.sh <TASK> <worker名>` で `.worktrees/<TASK>` を作る
  （ブランチ `agent/<TASK>-<worker名>`）。**メインのチェックアウトでは実装しない**
- `worker-claude` に渡すときは worktree の絶対パスを必ず伝える
- ワーカー完了後のコミットは `scripts/commit-task.sh <TASK> "<メッセージ>"`

## ワークフロー

`/orchestrate` スキルに手順をまとめてある。要点だけ：

1. `tasks/` の指示書を読み、依存関係（`depends_on`）と変更ファイルの重なりを確認
2. 依存のないタスクを並列で割り振る（指示書の `assignee` に従う）
3. 完了 → commit → verify → Codex レビュー → 必要なら Codex 修正 → 再レビュー
4. レビュー往復は `MAX_REVIEW_ROUNDS`（既定3）まで。超えたら止めて人間に報告
5. approve かつ verify PASS のものだけ `scripts/merge-task.sh <TASK>` でマージ

## エスカレーション（作業を止めて人間に聞く）

- 指示書が曖昧で、解釈次第で公開APIが変わる
- 2つのタスクが同じファイルを変更する必要が出た
- レビュー往復が上限に達した／verify がワーカーの手に負えない原因で落ちる
- 依存追加・設定変更が必要になった
