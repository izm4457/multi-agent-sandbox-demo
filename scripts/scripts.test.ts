import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPTS_DIR);

const shFiles = readdirSync(SCRIPTS_DIR)
  .filter((f) => f.endsWith(".sh"))
  .sort();

/** 親プロセスの GIT_* を引き継がない（実在リポジトリを触らないため） */
function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("GIT_")) env[k] = v;
  }
  env.PATH = `${env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin`;
  return {
    ...env,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    ...extra,
  };
}

describe("scripts/*.sh の静的検査", () => {
  it("検査対象のスクリプトが存在する", () => {
    expect(shFiles.length).toBeGreaterThan(0);
  });

  it.each(shFiles)("bash -n %s", (file) => {
    const r = spawnSync("bash", ["-n", join(SCRIPTS_DIR, file)], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
  });

  it.each(shFiles)("shellcheck -S warning %s", (file) => {
    const r = spawnSync("shellcheck", ["-S", "warning", join(SCRIPTS_DIR, file)], {
      encoding: "utf8",
      env: cleanEnv(),
    });
    if (r.error) {
      expect.fail("shellcheck をインストールしてください（brew install shellcheck）");
    }
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});

describe("commit-task.sh スモークテスト", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const d = tmpDirs.pop();
      if (d) rmSync(d, { recursive: true, force: true });
    }
  });

  function git(cwd: string, args: string[]): string {
    const r = spawnSync("git", args, { cwd, encoding: "utf8", env: cleanEnv() });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
    return r.stdout.trim();
  }

  function setup(): { root: string; wt: string } {
    const root = mkdtempSync(join(tmpdir(), "commit-task-test-"));
    tmpDirs.push(root);
    git(root, ["init", "-q", "-b", "main"]);
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "tasks"));
    for (const f of ["lib.sh", "commit-task.sh"]) {
      copyFileSync(join(SCRIPTS_DIR, f), join(root, "scripts", f));
    }
    copyFileSync(join(REPO_ROOT, "team.config.sh"), join(root, "team.config.sh"));
    writeFileSync(
      join(root, "tasks", "T-999.md"),
      "---\nid: T-999\ntitle: smoke\nfiles_allowed: [src/a.ts]\n---\n\nbody\n",
    );
    const verify = join(root, "scripts", "verify.sh");
    writeFileSync(
      verify,
      '#!/usr/bin/env bash\nif [[ "${STUB_VERIFY:-}" == "fail" ]]; then echo "VERIFY: FAIL (test)"; exit 1; fi\necho "VERIFY: PASS"\n',
    );
    chmodSync(verify, 0o755);
    writeFileSync(join(root, "README.md"), "init\n");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "init"]);
    git(root, ["worktree", "add", "-q", "-b", "agent/T-999-test", join(root, ".worktrees", "T-999")]);
    return { root, wt: join(root, ".worktrees", "T-999") };
  }

  function addFile(wt: string, rel: string): void {
    mkdirSync(dirname(join(wt, rel)), { recursive: true });
    writeFileSync(join(wt, rel), "export const x = 1;\n");
  }

  function run(root: string, msg: string, extra: Record<string, string> = {}) {
    return spawnSync("bash", [join(root, "scripts", "commit-task.sh"), "T-999", msg], {
      cwd: root,
      encoding: "utf8",
      env: cleanEnv(extra),
    });
  }

  const count = (wt: string) => Number(git(wt, ["rev-list", "--count", "HEAD"]));
  const lastMsg = (wt: string) => git(wt, ["log", "-1", "--format=%s"]);
  const logPath = (root: string) => join(root, ".agent-runs", "T-999", "verify.log");

  it("files_allowed 内の変更をコミットし verify PASS を記録する", { timeout: 20000 }, () => {
    const { root, wt } = setup();
    addFile(wt, "src/a.ts");
    const before = count(wt);
    const r = run(root, "foo");
    expect(r.status, r.stderr).toBe(0);
    expect(count(wt)).toBe(before + 1);
    expect(lastMsg(wt)).toBe("T-999: foo");
    const lines = readFileSync(logPath(root), "utf8").trimEnd().split("\n");
    expect(lines[lines.length - 1]).toBe("VERIFY: PASS");
  });

  it("接頭辞付きメッセージで接頭辞が二重にならない", { timeout: 20000 }, () => {
    const { root, wt } = setup();
    addFile(wt, "src/a.ts");
    const r = run(root, "T-999: foo");
    expect(r.status, r.stderr).toBe(0);
    expect(lastMsg(wt)).toBe("T-999: foo");
  });

  it("接頭辞のみのメッセージは終了コード 1 でコミットしない", { timeout: 20000 }, () => {
    const { root, wt } = setup();
    addFile(wt, "src/a.ts");
    const before = count(wt);
    const r = run(root, "T-999:");
    expect(r.status).toBe(1);
    expect(count(wt)).toBe(before);
  });

  it("files_allowed 外の変更は終了コード 3 でコミットも verify もしない", { timeout: 20000 }, () => {
    const { root, wt } = setup();
    addFile(wt, "src/b.ts");
    const before = count(wt);
    const r = run(root, "foo");
    expect(r.status).toBe(3);
    expect(count(wt)).toBe(before);
    expect(existsSync(logPath(root))).toBe(false);
  });

  it("verify 失敗時は終了コード 4 でコミットは作られている", { timeout: 20000 }, () => {
    const { root, wt } = setup();
    addFile(wt, "src/a.ts");
    const before = count(wt);
    const r = run(root, "foo", { STUB_VERIFY: "fail" });
    expect(r.status).toBe(4);
    expect(count(wt)).toBe(before + 1);
    expect(lastMsg(wt)).toBe("T-999: foo");
  });

  it("変更なしでも終了コード 0 で verify.log が作られる", { timeout: 20000 }, () => {
    const { root, wt } = setup();
    const before = count(wt);
    const r = run(root, "foo");
    expect(r.status, r.stderr).toBe(0);
    expect(count(wt)).toBe(before);
    expect(existsSync(logPath(root))).toBe(true);
  });
});
