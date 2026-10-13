import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTodos, saveTodos, StorageError } from "./storage.js";
import { TodoList } from "./todo.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tiny-todo-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("storage", () => {
  it("保存して読み込むと内容と次のIDが保たれる", async () => {
    const list = new TodoList(() => new Date("2026-01-01T00:00:00Z"));
    list.add({ title: "a", tags: ["x"], due: "2026-02-01" });
    list.add({ title: "b" });
    list.complete(1);
    const path = join(dir, "todos.json");
    await saveTodos(path, list);

    const loaded = await loadTodos(path);
    expect(loaded.all()).toEqual(JSON.parse(JSON.stringify(list.all())));
    expect(loaded.add({ title: "c" }).id).toBe(3);
  });

  it("親ディレクトリがなければ作り、一時ファイルを残さない", async () => {
    const path = join(dir, "a", "b", "todos.json");
    await saveTodos(path, new TodoList());
    expect(await readdir(join(dir, "a", "b"))).toEqual(["todos.json"]);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ version: 1, todos: [] });
  });

  it("存在しないファイルは空のリスト", async () => {
    const loaded = await loadTodos(join(dir, "none.json"));
    expect(loaded.all()).toEqual([]);
  });

  it("壊れたJSONは StorageError（パスを含む）", async () => {
    const path = join(dir, "bad.json");
    await writeFile(path, "{oops", "utf8");
    const err = await loadTodos(path).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect((err as Error).message).toContain(path);
  });

  it("version 不一致は StorageError", async () => {
    const path = join(dir, "v.json");
    await writeFile(path, JSON.stringify({ version: 2, todos: [] }), "utf8");
    await expect(loadTodos(path)).rejects.toThrow(StorageError);
  });

  it("todos が配列でなければ StorageError", async () => {
    const path = join(dir, "t.json");
    await writeFile(path, JSON.stringify({ version: 1, todos: {} }), "utf8");
    await expect(loadTodos(path)).rejects.toThrow(StorageError);
  });

  it("JSON が null や配列でも StorageError", async () => {
    const path = join(dir, "n.json");
    await writeFile(path, "null", "utf8");
    await expect(loadTodos(path)).rejects.toThrow(StorageError);
    await writeFile(path, "[]", "utf8");
    await expect(loadTodos(path)).rejects.toThrow(StorageError);
  });
});
