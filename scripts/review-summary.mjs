// レビュー JSON を短く要約してオーケストレーターに返す。差分本体は返さない（コンテキスト節約）。
// 終了コード：0=approve / 2=request_changes
import { readFileSync } from "node:fs";

const review = JSON.parse(readFileSync(process.argv[2], "utf8"));
const count = (s) => review.findings.filter((f) => f.severity === s).length;
const blocking = count("blocker") + count("major");
const effective = blocking > 0 ? "request_changes" : review.verdict;

const lines = [
  `REVIEW: ${effective.toUpperCase()}  (blocker ${count("blocker")} / major ${count("major")} / minor ${count("minor")})`,
  `summary: ${review.summary}`,
  ...review.findings.map(
    (f) => `- [${f.severity}] ${f.id} ${f.file}${f.line ? `:${f.line}` : ""} — ${f.title}`,
  ),
];
if (effective !== review.verdict) {
  lines.push(`note: Codex の verdict は ${review.verdict} だが blocker/major があるため request_changes と判定`);
}
process.stdout.write(lines.join("\n") + "\n");
process.exit(effective === "approve" ? 0 : 2);
