import { describe, expect, it } from "vitest";
import { formatTodo, formatTodoList } from "./format.js";
import type { Todo } from "./todo.js";

const TODAY = "2026-10-14";

function make(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 3,
    title: "Buy milk",
    status: "open",
    tags: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatTodo", () => {
  it("formats tags and due in N days", () => {
    const t = make({ tags: ["home", "errand"], due: "2026-10-16" });
    expect(formatTodo(t, TODAY)).toBe(
      "[ ] #3 Buy milk  #home #errand  (due: 2026-10-16, in 2 days)",
    );
  });

  it("omits tags and due when absent", () => {
    expect(formatTodo(make(), TODAY)).toBe("[ ] #3 Buy milk");
  });

  it("shows tags without due", () => {
    expect(formatTodo(make({ tags: ["a"] }), TODAY)).toBe("[ ] #3 Buy milk  #a");
  });

  it("shows due without tags", () => {
    expect(formatTodo(make({ due: TODAY }), TODAY)).toBe(
      "[ ] #3 Buy milk  (due: 2026-10-14, today)",
    );
  });

  it("tomorrow", () => {
    expect(formatTodo(make({ due: "2026-10-15" }), TODAY)).toContain("tomorrow)");
  });

  it("yesterday", () => {
    expect(formatTodo(make({ due: "2026-10-13" }), TODAY)).toContain("yesterday)");
  });

  it("overdue", () => {
    expect(formatTodo(make({ due: "2026-10-10" }), TODAY)).toContain("4 days overdue)");
  });

  it("done has no relative text", () => {
    const t = make({ status: "done", due: "2026-10-10", tags: ["x"] });
    expect(formatTodo(t, TODAY)).toBe("[x] #3 Buy milk  #x  (due: 2026-10-10)");
  });

  it("handles month boundary", () => {
    expect(formatTodo(make({ due: "2026-11-01" }), "2026-10-30")).toContain("in 2 days)");
    expect(formatTodo(make({ due: "2026-09-29" }), "2026-10-01")).toContain("2 days overdue)");
    expect(formatTodo(make({ due: "2026-03-01" }), "2026-02-28")).toContain("tomorrow)");
  });

  it("handles year boundary", () => {
    expect(formatTodo(make({ due: "2027-01-01" }), "2026-12-31")).toContain("tomorrow)");
    expect(formatTodo(make({ due: "2026-12-31" }), "2027-01-01")).toContain("yesterday)");
    expect(formatTodo(make({ due: "2027-01-03" }), "2026-12-30")).toContain("in 4 days)");
  });

  it("preserves years below 0100 in UTC date calculations", () => {
    expect(formatTodo(make({ due: "0100-01-01" }), "0099-12-31")).toBe(
      "[ ] #3 Buy milk  (due: 0100-01-01, tomorrow)",
    );
    expect(formatTodo(make({ due: "0099-12-31" }), "0100-01-01")).toBe(
      "[ ] #3 Buy milk  (due: 0099-12-31, yesterday)",
    );
    expect(formatTodo(make({ due: "0000-03-01" }), "0000-02-28")).toBe(
      "[ ] #3 Buy milk  (due: 0000-03-01, in 2 days)",
    );
  });
});

describe("formatTodoList", () => {
  it("returns message for empty list", () => {
    expect(formatTodoList([], TODAY)).toBe("No todos.");
  });

  it("joins lines with newline", () => {
    const out = formatTodoList([make({ id: 1, title: "A" }), make({ id: 2, title: "B" })], TODAY);
    expect(out).toBe("[ ] #1 A\n[ ] #2 B");
  });
});
