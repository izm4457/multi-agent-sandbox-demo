import { describe, expect, it } from "vitest";
import type { Todo } from "./todo.js";
import { filterTodos } from "./filter.js";

const baseDate = "2026-10-12T00:00:00.000Z";

const makeTodo = (overrides: Partial<Todo> & Pick<Todo, "id" | "title">): Todo => ({
  status: "open",
  tags: [],
  createdAt: baseDate,
  ...overrides,
});

const todos: Todo[] = [
  makeTodo({ id: 1, title: "Write docs", tags: ["docs"], due: "2026-10-10" }),
  makeTodo({ id: 2, title: "Buy milk", tags: ["shopping"], due: "2026-10-12" }),
  makeTodo({ id: 3, title: "Call mom", tags: ["family", "shopping"], status: "done" }),
  makeTodo({ id: 4, title: "Schedule meeting", tags: ["work"] }),
  makeTodo({ id: 5, title: "  write release notes  ", tags: ["docs", "work"], due: "2026-10-15" }),
];

describe("filterTodos", () => {
  it("returns all todos when filter is empty", () => {
    expect(filterTodos(todos, {})).toEqual(todos);
  });

  it("filters by status", () => {
    expect(filterTodos(todos, { status: "done" })).toEqual([todos[2]]);
    expect(filterTodos(todos, { status: "open" }).map((t) => t.id)).toEqual([1, 2, 4, 5]);
  });

  it("filters by tags (case-insensitive, all must match)", () => {
    expect(filterTodos(todos, { tags: ["shopping"] }).map((t) => t.id)).toEqual([2, 3]);
    expect(filterTodos(todos, { tags: ["DOCS", "work"] }).map((t) => t.id)).toEqual([5]);
  });

  it("ignores empty tags array", () => {
    expect(filterTodos(todos, { tags: [] })).toEqual(todos);
  });

  it("filters by text (case-insensitive, trimmed)", () => {
    expect(filterTodos(todos, { text: "write" }).map((t) => t.id)).toEqual([1, 5]);
    expect(filterTodos(todos, { text: "  WRITE  " }).map((t) => t.id)).toEqual([1, 5]);
    expect(filterTodos(todos, { text: "milk" }).map((t) => t.id)).toEqual([2]);
  });

  it("ignores empty text", () => {
    expect(filterTodos(todos, { text: "" })).toEqual(todos);
    expect(filterTodos(todos, { text: "   " })).toEqual(todos);
  });

  it("filters by dueBefore (inclusive, excludes todos without due)", () => {
    expect(filterTodos(todos, { dueBefore: "2026-10-12" }).map((t) => t.id)).toEqual([1, 2]);
    expect(filterTodos(todos, { dueBefore: "2026-10-09" }).map((t) => t.id)).toEqual([]);
  });

  it("combines conditions with AND", () => {
    expect(filterTodos(todos, { status: "open", tags: ["docs"] }).map((t) => t.id)).toEqual([1, 5]);
    expect(filterTodos(todos, { status: "open", text: "write", dueBefore: "2026-10-12" }).map((t) => t.id)).toEqual([1]);
  });

  it("does not mutate the input array and preserves order", () => {
    const original = [...todos];
    const result = filterTodos(todos, { status: "open" });
    expect(todos).toEqual(original);
    expect(result.map((t) => t.id)).toEqual([1, 2, 4, 5]);
  });
});
