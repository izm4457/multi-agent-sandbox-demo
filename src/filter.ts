import type { Todo } from "./todo.js";
import { TodoStatus } from "./todo.js";

/**
 * TODO 一覧を絞り込むための条件。
 * 未指定の条件は無視する。
 */
export interface TodoFilter {
  /** 指定時はその状態のみを返す */
  status?: TodoStatus;
  /** 指定したタグをすべて含むものを返す（大文字小文字は無視） */
  tags?: string[];
  /** title に部分一致するものを返す（大文字小文字は無視、前後空白は無視） */
  text?: string;
  /** YYYY-MM-DD。この日付以前（当日含む）に期限があるものを返す */
  dueBefore?: string;
}

/**
 * `todos` を `filter` で AND 絞り込んだ新しい配列を返す。
 * 入力配列は変更しない。並び順は入力の順を保つ。
 */
export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  const normalizedText = filter.text?.trim().toLowerCase();
  const normalizedTags = (filter.tags ?? []).map((tag) => tag.toLowerCase());

  return todos.filter((todo) => {
    if (filter.status !== undefined && todo.status !== filter.status) {
      return false;
    }

    if (normalizedText !== undefined && normalizedText.length > 0) {
      if (!todo.title.toLowerCase().includes(normalizedText)) {
        return false;
      }
    }

    if (normalizedTags.length > 0) {
      const todoTags = new Set(todo.tags.map((tag) => tag.toLowerCase()));
      const hasAllTags = normalizedTags.every((tag) => todoTags.has(tag));
      if (!hasAllTags) {
        return false;
      }
    }

    if (filter.dueBefore !== undefined) {
      if (todo.due === undefined) {
        return false;
      }
      if (todo.due > filter.dueBefore) {
        return false;
      }
    }

    return true;
  });
}
