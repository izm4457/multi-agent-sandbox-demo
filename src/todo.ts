/**
 * tiny-todo のドメインモデル。
 * AIチームの試走用ベースライン。各タスク(tasks/)はこのモデルの上に機能を足していく。
 */

export type TodoStatus = "open" | "done";

export interface Todo {
  id: number;
  title: string;
  status: TodoStatus;
  tags: string[];
  /** ISO 8601 の日付文字列 (YYYY-MM-DD)。期限なしは undefined */
  due?: string;
  createdAt: string;
}

export interface NewTodo {
  title: string;
  tags?: string[];
  due?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class TodoList {
  private items: Todo[] = [];
  private nextId = 1;

  constructor(private readonly now: () => Date = () => new Date()) {}

  add(input: NewTodo): Todo {
    const title = input.title.trim();
    if (title.length === 0) {
      throw new Error("title must not be empty");
    }
    if (input.due !== undefined && !DATE_RE.test(input.due)) {
      throw new Error(`due must be YYYY-MM-DD: ${input.due}`);
    }
    const todo: Todo = {
      id: this.nextId++,
      title,
      status: "open",
      tags: [...new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()))].filter(Boolean),
      due: input.due,
      createdAt: this.now().toISOString(),
    };
    this.items.push(todo);
    return todo;
  }

  complete(id: number): Todo {
    const todo = this.get(id);
    todo.status = "done";
    return todo;
  }

  remove(id: number): void {
    const index = this.items.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`todo not found: ${id}`);
    }
    this.items.splice(index, 1);
  }

  get(id: number): Todo {
    const todo = this.items.find((t) => t.id === id);
    if (!todo) {
      throw new Error(`todo not found: ${id}`);
    }
    return todo;
  }

  all(): Todo[] {
    return this.items.map((t) => ({ ...t, tags: [...t.tags] }));
  }

  /** 永続化から復元するときに使う。ID採番も復元後の最大値から続ける */
  static fromArray(todos: Todo[], now?: () => Date): TodoList {
    const list = new TodoList(now);
    list.items = todos.map((t) => ({ ...t, tags: [...t.tags] }));
    list.nextId = todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    return list;
  }
}
