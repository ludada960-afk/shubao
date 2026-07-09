const fs = require("fs");
const c = fs.readFileSync("shubao-final.jsx", "utf8");
const lines = c.split("\n");

const Q = ['"', "'", "`"];

let depth = 0, inStr = false, esc = false;
const changes = [];

for (let n = 0; n < lines.length; n++) {
  const before = depth;
  const line = lines[n];
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (Q.includes(ch) && (!inStr || inStr === ch)) {
      inStr = inStr ? false : ch;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}") depth--;
  }
  if (depth !== before) {
    changes.push({ line: n + 1, before, after: depth, text: line.trim().slice(0, 80) });
  }
}

console.log("Final depth:", depth);
console.log("\nLast 15 depth changes:");
changes.slice(-15).forEach(c => console.log("L" + c.line + ": " + c.before + " -> " + c.after + " | " + c.text));
