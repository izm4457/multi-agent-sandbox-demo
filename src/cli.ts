import { parseArgs } from "node:util";
import { filterTodos } from "./filter.js";
import { formatTodoList } from "./format.js";
import { loadTodos, saveTodos } from "./storage.js";

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  today: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidStatus(value: string): value is "open" | "done" {
  return value === "open" || value === "done";
}

function parseId(value: string | undefined): number {
  if (value === undefined) {
    throw new Error("id required");
  }
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`invalid id: ${value}`);
  }
  return id;
}

async function runAdd(args: string[], dataPath: string, io: CliIO): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      tag: { type: "string", multiple: true },
      due: { type: "string" },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    throw new Error("title required");
  }
  const title = positionals.join(" ");

  if (values.due !== undefined && !DATE_RE.test(values.due)) {
    throw new Error(`due must be YYYY-MM-DD: ${values.due}`);
  }

  const list = await loadTodos(dataPath);
  list.add({ title, tags: values.tag, due: values.due });
  await saveTodos(dataPath, list);
  io.stdout(`Added #${list.all().length}\n`);
  return 0;
}

async function runList(args: string[], dataPath: string, io: CliIO): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      status: { type: "string" },
      tag: { type: "string", multiple: true },
      text: { type: "string" },
      "due-before": { type: "string" },
    },
    allowPositionals: true,
  });

  if (positionals.length > 0) {
    throw new Error(`unexpected arguments: ${positionals.join(" ")}`);
  }

  if (values.status !== undefined && !isValidStatus(values.status)) {
    throw new Error(`status must be open or done: ${values.status}`);
  }

  const dueBefore = values["due-before"];
  if (dueBefore !== undefined && !DATE_RE.test(dueBefore)) {
    throw new Error(`due-before must be YYYY-MM-DD: ${dueBefore}`);
  }

  const list = await loadTodos(dataPath);
  const todos = filterTodos(list.all(), {
    status: values.status,
    tags: values.tag,
    text: values.text,
    dueBefore,
  });
  io.stdout(`${formatTodoList(todos, io.today)}\n`);
  return 0;
}

async function runDone(args: string[], dataPath: string): Promise<number> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const list = await loadTodos(dataPath);
  list.complete(parseId(positionals[0]));
  await saveTodos(dataPath, list);
  return 0;
}

async function runRm(args: string[], dataPath: string): Promise<number> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const list = await loadTodos(dataPath);
  list.remove(parseId(positionals[0]));
  await saveTodos(dataPath, list);
  return 0;
}

export async function runCli(argv: string[], dataPath: string, io: CliIO): Promise<number> {
  const report = (message: string): number => {
    io.stderr(`${message}\n`);
    return 1;
  };

  try {
    const subcommand = argv[0];
    if (subcommand === undefined) {
      throw new Error("subcommand required");
    }

    switch (subcommand) {
      case "add":
        return await runAdd(argv.slice(1), dataPath, io);
      case "list":
        return await runList(argv.slice(1), dataPath, io);
      case "done":
        return await runDone(argv.slice(1), dataPath);
      case "rm":
        return await runRm(argv.slice(1), dataPath);
      default:
        throw new Error(`unknown subcommand: ${subcommand}`);
    }
  } catch (err) {
    return report(err instanceof Error ? err.message : String(err));
  }
}
