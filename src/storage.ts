import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { TodoList } from "./todo.js";
import type { Todo } from "./todo.js";

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ENOENT";
}

export async function loadTodos(path: string): Promise<TodoList> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (isNotFound(err)) {
      return new TodoList();
    }
    throw new StorageError(`failed to read ${path}: ${String(err)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new StorageError(`invalid JSON: ${path}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new StorageError(`invalid format (expected object): ${path}`);
  }
  const obj = data as { version?: unknown; todos?: unknown };
  if (obj.version !== 1) {
    throw new StorageError(`unsupported version ${String(obj.version)}: ${path}`);
  }
  if (!Array.isArray(obj.todos)) {
    throw new StorageError(`todos must be an array: ${path}`);
  }
  return TodoList.fromArray(obj.todos as Todo[]);
}

export async function saveTodos(path: string, list: TodoList): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const body = JSON.stringify({ version: 1, todos: list.all() }, null, 2) + "\n";
  await writeFile(tmp, body, "utf8");
  await rename(tmp, path);
}
