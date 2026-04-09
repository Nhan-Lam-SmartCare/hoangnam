import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, "reports");
const docsDir = path.join(rootDir, "docs");

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const raw = execSync("npm run -s lint:json", {
  cwd: rootDir,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

const results = JSON.parse(raw);
const allMessages = results.flatMap((file) =>
  (file.messages || []).map((msg) => ({
    filePath: path.relative(rootDir, file.filePath || ""),
    ruleId: msg.ruleId || "unknown",
    severity: msg.severity,
    line: msg.line || 0,
    message: msg.message || "",
  }))
);

const warnings = allMessages.filter((m) => m.severity === 1);
const errors = allMessages.filter((m) => m.severity === 2);

const byRule = new Map();
for (const item of warnings) {
  byRule.set(item.ruleId, (byRule.get(item.ruleId) || 0) + 1);
}

const byFile = new Map();
for (const item of warnings) {
  byFile.set(item.filePath, (byFile.get(item.filePath) || 0) + 1);
}

const topRules = [...byRule.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

const topFiles = [...byFile.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

const now = new Date();
const date = now.toISOString().slice(0, 10);

const markdown = [
  "# Maintainability Baseline",
  "",
  `Date: ${date}`,
  "",
  "## Summary",
  "",
  `- Total lint warnings: ${warnings.length}`,
  `- Total lint errors: ${errors.length}`,
  `- Files with warnings: ${byFile.size}`,
  "",
  "## Top Warning Rules",
  "",
  "| Rule | Count |",
  "| --- | ---: |",
  ...topRules.map(([rule, count]) => `| ${rule} | ${count} |`),
  "",
  "## Top Files By Warning Count",
  "",
  "| File | Count |",
  "| --- | ---: |",
  ...topFiles.map(([file, count]) => `| ${file} | ${count} |`),
  "",
  "## Notes",
  "",
  "- This baseline is used to track weekly warning reduction.",
  "- Focus first on complexity, max-lines, and hook dependency warnings in core domains.",
  "",
].join("\n");

fs.writeFileSync(path.join(reportsDir, "lint-baseline.json"), raw, "utf8");
fs.writeFileSync(
  path.join(docsDir, `MAINTAINABILITY_BASELINE_${date}.md`),
  markdown,
  "utf8"
);

console.log(`Baseline generated for ${date}`);
console.log(`Warnings: ${warnings.length}, Errors: ${errors.length}`);
