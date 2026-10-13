import type { Todo } from "./todo.js";

const MS_PER_DAY = 86_400_000;

function toUtcDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY;
}

function relative(due: string, today: string): string {
  const diff = toUtcDay(due) - toUtcDay(today);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days overdue`;
}

export function formatTodo(todo: Todo, today: string): string {
  const mark = todo.status === "done" ? "[x]" : "[ ]";
  let line = `${mark} #${todo.id} ${todo.title}`;
  if (todo.tags.length > 0) {
    line += `  ${todo.tags.map((t) => `#${t}`).join(" ")}`;
  }
  if (todo.due !== undefined) {
    const rel = todo.status === "done" ? "" : `, ${relative(todo.due, today)}`;
    line += `  (due: ${todo.due}${rel})`;
  }
  return line;
}

export function formatTodoList(todos: Todo[], today: string): string {
  if (todos.length === 0) return "No todos.";
  return todos.map((t) => formatTodo(t, today)).join("\n");
}
