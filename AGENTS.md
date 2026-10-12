# AGENTS.md — 全エージェント共通のプロジェクト知識

このファイルが正本です。Claude Code（CLAUDE.md経由）、Codex、opencode のすべてが読みます。
ツール固有の手順はここに書かず、それぞれのファイルに書いてください。

## プロジェクト概要

`tiny-todo`：TypeScript製の小さなTODO管理ライブラリ＋CLI。
AI開発チーム（Claude Code / Codex / opencode）の協調を試すためのサンドボックスです。

## 技術スタック

- Node.js 22+ / TypeScript 5（ESM, `"type": "module"`）
- テスト：vitest　lint：eslint（typescript-eslint）　型：`tsc --noEmit`
- ランタイム依存は追加しない（Node 標準ライブラリのみ）。必要なら理由を報告に書くこと

## ディレクトリ

```
src/            実装とテスト（xxx.ts と xxx.test.ts を同じ場所に置く）
tasks/          タスク指示書（T-xxx.md）。ワーカーは自分のタスクだけ読む
scripts/        チーム運用スクリプト（verify / worktree / codex / opencode 連携）
templates/      受け渡しフォーマット
.worktrees/     タスクごとの作業ツリー（git管理外）
.agent-runs/    実行ログ・レビュー結果（git管理外）
```

## コマンド

| 目的 | コマンド |
| --- | --- |
| 品質ゲート一括 | `npm run verify`（typecheck → lint → test） |
| テストのみ | `npm test` |
| 型チェック | `npm run typecheck` |
| lint | `npm run lint` |

**完了の定義：`npm run verify` が通ること。** 通らない状態で「完了」と報告しない。

## コーディング規約

- `import` は拡張子 `.js` 付きの相対パス（NodeNext のため）：`import { TodoList } from "./todo.js";`
- `any` 禁止。`console.log` 禁止（CLIの出力は `process.stdout.write` を使う）
- 公開関数は純粋関数を優先。日時は引数で受け取り、`new Date()` を直接呼ばない（テスト容易性のため）
- 新しい公開関数には必ずテストを書く。境界値（空配列、存在しないID、不正な入力）を含める
- 既存の公開APIのシグネチャを変えない。変えたい場合は実装せず、報告で提案する

## 禁止事項（全エージェント共通）

- `git push`、`git merge`、`git rebase`、ブランチ削除をしない（マージはオーケストレーターの仕事）
- **ワーカーと修正担当は `git commit` もしない**（コミットはスクリプトが行う）
- タスク指示書の「変更してよいファイル」以外を編集しない
- `package.json` の依存追加、設定ファイル（tsconfig / eslint）の変更をしない
- テストを消したり `skip` したりして通さない

## 完了報告の形式

作業の最後に、次の形式で報告する（詳細は `templates/worker-report.md`）。

```
## 変更概要
## 変更ファイル
## verify 結果（PASS / FAIL と要点）
## 懸念・未対応事項
```
