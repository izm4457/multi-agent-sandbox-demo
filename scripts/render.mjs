// テンプレート内の {{KEY}} を環境変数で置換して stdout に出す。未定義のキーはエラーにする。
import { readFileSync } from "node:fs";

const [, , file] = process.argv;
const src = readFileSync(file, "utf8");
const missing = new Set();
const out = src.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
  const value = process.env[key];
  if (value === undefined) {
    missing.add(key);
    return "";
  }
  return value;
});
if (missing.size > 0) {
  process.stderr.write(`render: undefined variables: ${[...missing].join(", ")}\n`);
  process.exit(1);
}
process.stdout.write(out);
