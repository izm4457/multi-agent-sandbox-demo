---
name: orchestrate
description: tasks/ のバックログを、Claudeワーカー・opencodeワーカー・Codexレビュー/修正のチームで実装からマージまで進める。ユーザーが /orchestrate と言ったとき、またはバックログの消化を頼まれたときに使う。
argument-hint: "[タスクID ...]（省略時は未着手の全タスク）"
---

# オーケストレーション手順

対象：$ARGUMENTS（空なら `scripts/status.sh` で state=todo のもの全部）

あなたはオーケストレーターです。**自分では src/ を編集しない。** 差分全文も読まない。
判断材料はワーカー報告・verify 結果・`codex-review.sh` の要約出力だけにする。

## 0. 計画
1. `scripts/status.sh` で現状を確認
2. 対象タスクの指示書を読み、`depends_on` と `files_allowed` の重なりを確認
   - 依存が未マージのタスクは今回のウェーブから外す
   - 同じファイルを触るタスクが同じウェーブにあれば、片方を後回しにする
3. ウェーブ計画（並列で走らせる組）をユーザーに1〜3行で示し、そのまま進める

## 1. 割り振り（ウェーブ内は並列）
各タスクについて：
- `scripts/new-worktree.sh <TASK> <assignee>` を実行し、出力された worktree の絶対パスを控える
- assignee が **opencode**：`scripts/opencode-worker.sh <TASK>` を **バックグラウンドで** 実行
- assignee が **worker-claude**：Agent ツールで `worker-claude` を起動。プロンプトは
  「タスクID: <TASK> / worktree: <絶対パス> / 指示書: <worktree>/tasks/<TASK>.md を実装して報告して」
  複数ある場合は1つのメッセージで同時に起動して並列にする

## 2. 完了処理（タスクごと）
1. worker-claude のタスクは `scripts/commit-task.sh <TASK> "<報告の変更概要を1行で>"`
   （opencode は opencode-worker.sh 終了後に同じく commit-task.sh を実行）
   - 終了コード 3（files_allowed 外の変更）なら、内容を確認して人間に判断を仰ぐ
2. verify が FAIL のままなら、まず Codex 修正に回さずワーカーに1回だけ差し戻す
   （同じ worktree で、失敗ログ `.agent-runs/<TASK>/verify.log` の末尾を添えて再依頼）

## 3. レビューループ
```
scripts/codex-review.sh <TASK>
  終了コード 0（approve）       → 4. へ
  終了コード 2（request_changes）→ scripts/codex-fix.sh <TASK> → もう一度 codex-review.sh
  終了コード 3（往復上限）       → 止めて人間に報告（要約と .agent-runs/<TASK>/ の場所を示す）
```
- 指摘が仕様の解釈違い（指示書の曖昧さが原因）なら、修正に回す前に人間に確認する
- minor のみの approve はそのまま進める（minor は最終報告に一覧で載せる）

## 4. マージ
- `scripts/merge-task.sh <TASK>`（BASE_BRANCH をチェックアウトしたメインのツリーで実行）
- 同じウェーブのマージは1件ずつ順番に。失敗したら原因を報告して次のタスクに進む
- ウェーブが終わったら、新たに依存が解けたタスクで次のウェーブへ

## 5. 最終報告（ユーザー向け）
- タスクごとに：担当 / レビュー往復数 / 結果（merged・要判断）
- 残った minor 指摘の一覧
- チーム運用で気づいた改善点（指示書の曖昧さ、ワーカーの癖など）を2〜3点
