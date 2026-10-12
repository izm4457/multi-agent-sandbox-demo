---
name: plan-tasks
description: 機能要望を、ワーカーに渡せる粒度のタスク指示書（tasks/T-xxx.md）に分解する。ユーザーが新しい機能を頼んだとき、実装の前に使う。
argument-hint: "<機能要望>"
---

# タスク分解

要望：$ARGUMENTS

1. 既存の `tasks/` と `src/` を確認し、最大の既存ID の次から採番する
2. `templates/task.md` の形式で指示書を書く。分解の基準：
   - 1タスク = 1〜2ファイル（実装とテスト）。**並列タスク同士で files_allowed を重ねない**
   - 公開APIのシグネチャを指示書に明記する（ワーカー間の結合点になるため）
   - 受け入れ条件はテストで確認できる文にする
   - 部品を組み合わせるタスクは `depends_on` で後ろに回す
3. assignee の目安：
   - 仕様が明確で独立した小タスク → `opencode`（安価なモデルで十分なもの）
   - 判断や既存コードの理解が要るタスク → `worker-claude`
4. 書いた指示書の一覧（ID / タイトル / assignee / depends_on）をユーザーに示し、確認をもらってから `/orchestrate` に進む
