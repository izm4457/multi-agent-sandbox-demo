import { describe, expect, it } from "vitest";
import { TodoList } from "./todo.js";

const fixedNow = () => new Date("2026-10-12T00:00:00.000Z");

describe("TodoList", () => {
  it("adds a todo with normalized tags", () => {
    const list = new TodoList(fixedNow);
    const todo = list.add({ title: "  Write docs ", tags: ["Docs", "docs", " "] });
    expect(todo).toEqual({
      id: 1,
      title: "Write docs",
      status: "open",
      tags: ["docs"],
      due: undefined,
      createdAt: "2026-10-12T00:00:00.000Z",
    });
  });

  it("rejects empty titles and malformed due dates", () => {
    const list = new TodoList(fixedNow);
    expect(() => list.add({ title: "   " })).toThrow(/empty/);
    expect(() => list.add({ title: "x", due: "10/12" })).toThrow(/YYYY-MM-DD/);
  });

  it("completes and removes todos", () => {
    const list = new TodoList(fixedNow);
    const a = list.add({ title: "a" });
    const b = list.add({ title: "b" });
    list.complete(a.id);
    list.remove(b.id);
    expect(list.all().map((t) => [t.id, t.status])).toEqual([[1, "done"]]);
    expect(() => list.get(b.id)).toThrow(/not found/);
  });

  it("continues ids after restoring from an array", () => {
    const restored = TodoList.fromArray(
      [{ id: 7, title: "x", status: "open", tags: [], createdAt: "2026-01-01T00:00:00.000Z" }],
      fixedNow,
    );
    expect(restored.add({ title: "y" }).id).toBe(8);
  });

  it("returns copies from all()", () => {
    const list = new TodoList(fixedNow);
    list.add({ title: "a", tags: ["x"] });
    list.all()[0]!.tags.push("mutated");
    expect(list.all()[0]!.tags).toEqual(["x"]);
  });
});
