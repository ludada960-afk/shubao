const fs = require("fs");
const c = fs.readFileSync(
  "C:/Users/luda/.claude/projects/d--AI---shubao/3f7b47c5-026e-4db1-bce5-2e0414cb0932.jsonl",
  "utf8"
);

const patterns = [
  "new URL(v,import.meta.url)",
  "textRegenLoading",
  "setResult(await hydrateWork(w))",
  "cover_url?[result.cover_url"
];
console.log("Searching", c.length, "chars of transcript...");
for (const p of patterns) {
  const idx = c.indexOf(p);
  console.log(p + ": " + (idx >= 0 ? "FOUND at " + idx : "NOT FOUND"));
}
