import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, type CliIO } from "./cli.js";

function makeIo(today = "2026-10-12"): {
  io: CliIO;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      stdout: (s: string) => stdout.push(s),
      stderr: (s: string) => stderr.push(s),
      today,
    },
    stdout,
    stderr,
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tiny-todo-cli-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runCli", () => {
  it("adds a todo and lists it", async () => {
    const path = join(dir, "todos.json");
    const add = makeIo();
    expect(await runCli(["add", "Buy milk"], path, add.io)).toBe(0);
    expect(add.stderr).toEqual([]);
    expect(add.stdout).toEqual(["Added #1\n"]);

    const list = makeIo();
    expect(await runCli(["list"], path, list.io)).toBe(0);
    expect(list.stderr).toEqual([]);
    expect(list.stdout).toEqual(["[ ] #1 Buy milk\n"]);
  });

  it("adds a todo with tags and a due date", async () => {
    const path = join(dir, "todos.json");
    await runCli(["add", "Write report", "--tag", "work", "--due", "2026-10-15"], path, makeIo().io);

    const list = makeIo("2026-10-12");
    expect(await runCli(["list"], path, list.io)).toBe(0);
    expect(list.stdout).toEqual([
      "[ ] #1 Write report  #work  (due: 2026-10-15, in 3 days)\n",
    ]);
  });

  it("filters by status, tag, text and due-before", async () => {
    const path = join(dir, "todos.json");
    await runCli(["add", "Buy milk", "--tag", "shop"], path, makeIo().io);
    await runCli(["add", "Write report", "--tag", "work", "--due", "2026-10-15"], path, makeIo().io);
    await runCli(["add", "Clean desk", "--tag", "work", "--due", "2026-10-10"], path, makeIo().io);
    await runCli(["done", "2"], path, makeIo().io);

    const byStatus = makeIo();
    expect(await runCli(["list", "--status", "open"], path, byStatus.io)).toBe(0);
    expect(byStatus.stdout[0]).toContain("#1 Buy milk");
    expect(byStatus.stdout[0]).toContain("#3 Clean desk");
    expect(byStatus.stdout[0]).not.toContain("#2");

    const byTag = makeIo();
    expect(await runCli(["list", "--tag", "work"], path, byTag.io)).toBe(0);
    expect(byTag.stdout[0]).toContain("#2 Write report");
    expect(byTag.stdout[0]).toContain("#3 Clean desk");

    const byText = makeIo();
    expect(await runCli(["list", "--text", "report"], path, byText.io)).toBe(0);
    expect(byText.stdout[0]).toContain("#2 Write report");

    const byDue = makeIo("2026-10-12");
    expect(await runCli(["list", "--due-before", "2026-10-12"], path, byDue.io)).toBe(0);
    expect(byDue.stdout[0]).toContain("#3 Clean desk");
    expect(byDue.stdout[0]).not.toContain("#2");
  });

  it("marks a todo as done and removes it", async () => {
    const path = join(dir, "todos.json");
    await runCli(["add", "First"], path, makeIo().io);
    await runCli(["add", "Second"], path, makeIo().io);

    const done = makeIo();
    expect(await runCli(["done", "1"], path, done.io)).toBe(0);
    expect(done.stderr).toEqual([]);

    const listDone = makeIo();
    await runCli(["list", "--status", "done"], path, listDone.io);
    expect(listDone.stdout[0]).toContain("#1 First");

    const rmOut = makeIo();
    expect(await runCli(["rm", "1"], path, rmOut.io)).toBe(0);
    expect(rmOut.stderr).toEqual([]);

    const list = makeIo();
    await runCli(["list"], path, list.io);
    expect(list.stdout[0]).toContain("#2 Second");
    expect(list.stdout[0]).not.toContain("#1");
  });

  it("lists an empty file as No todos", async () => {
    const path = join(dir, "todos.json");
    const list = makeIo();
    expect(await runCli(["list"], path, list.io)).toBe(0);
    expect(list.stdout).toEqual(["No todos.\n"]);
  });

  it("reports missing subcommand", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli([], path, io)).toBe(1);
    expect(stderr[0]).toContain("subcommand required");
  });

  it("reports unknown subcommand", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli(["oops"], path, io)).toBe(1);
    expect(stderr[0]).toContain("unknown subcommand");
  });

  it("reports missing title for add", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli(["add"], path, io)).toBe(1);
    expect(stderr[0]).toContain("title required");
  });

  it("reports malformed due date for add", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli(["add", "x", "--due", "10/12"], path, io)).toBe(1);
    expect(stderr[0]).toContain("due must be YYYY-MM-DD");
  });

  it("reports invalid status for list", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli(["list", "--status", "maybe"], path, io)).toBe(1);
    expect(stderr[0]).toContain("status must be open or done");
  });

  it("reports malformed due-before for list", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli(["list", "--due-before", "tomorrow"], path, io)).toBe(1);
    expect(stderr[0]).toContain("due-before must be YYYY-MM-DD");
  });

  it("reports missing id for done and rm", async () => {
    const path = join(dir, "todos.json");
    const done = makeIo();
    expect(await runCli(["done"], path, done.io)).toBe(1);
    expect(done.stderr[0]).toContain("id required");

    const rmOut = makeIo();
    expect(await runCli(["rm"], path, rmOut.io)).toBe(1);
    expect(rmOut.stderr[0]).toContain("id required");
  });

  it("reports invalid id for done and rm", async () => {
    const path = join(dir, "todos.json");
    const done = makeIo();
    expect(await runCli(["done", "abc"], path, done.io)).toBe(1);
    expect(done.stderr[0]).toContain("invalid id");

    const rmOut = makeIo();
    expect(await runCli(["rm", "0"], path, rmOut.io)).toBe(1);
    expect(rmOut.stderr[0]).toContain("invalid id");
  });

  it("reports non-existent id for done and rm", async () => {
    const path = join(dir, "todos.json");
    await runCli(["add", "Only"], path, makeIo().io);

    const done = makeIo();
    expect(await runCli(["done", "99"], path, done.io)).toBe(1);
    expect(done.stderr[0]).toContain("todo not found: 99");

    const rmOut = makeIo();
    expect(await runCli(["rm", "99"], path, rmOut.io)).toBe(1);
    expect(rmOut.stderr[0]).toContain("todo not found: 99");
  });

  it("reports unknown options", async () => {
    const path = join(dir, "todos.json");
    const { io, stderr } = makeIo();
    expect(await runCli(["add", "x", "--priority", "high"], path, io)).toBe(1);
    expect(stderr[0]).toMatch(/unknown option|priority/i);
  });
});
