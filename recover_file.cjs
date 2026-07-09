const fs = require("fs");
const lines = fs
  .readFileSync(
    "C:/Users/luda/.claude/projects/d--AI---shubao/3f7b47c5-026e-4db1-bce5-2e0414cb0932.jsonl",
    "utf8"
  )
  .split("\n");

// Find the largest line that has regenLoading (the advanced version)
// and does NOT have "backupFileName" (which would be a backup metadata)
let bestLine = null;
let bestLen = 0;

for (let n = 0; n < lines.length; n++) {
  const line = lines[n];
  if (line.includes("regenLoading") && line.length > 50000) {
    if (line.length > bestLen) {
      bestLen = line.length;
      bestLine = line;
    }
  }
}

if (!bestLine) {
  console.log("No matching line found");
  process.exit(1);
}

console.log("Best line length:", bestLen);

// Find the actual content between "content":" and the next JSON key
const contentStart = bestLine.indexOf('"content":"');
if (contentStart < 0) { console.log("content field not found"); process.exit(1); }

// Move past "content":"
const contentBodyStart = contentStart + 11; // length of '"content":"'

// Find the end of this content field - look for the pattern: "," followed by a known key
// The content field ends with \", followed by "is_error" or "tool_use_id"
let contentEnd = -1;
const endKeys = ['","is_error"', '","tool_use_id"', '","role"', '","type"'];
for (const key of endKeys) {
  const pos = bestLine.indexOf(key, contentBodyStart);
  if (pos >= 0) {
    if (contentEnd < 0 || pos < contentEnd) contentEnd = pos;
  }
}

if (contentEnd < 0) { console.log("content end not found"); process.exit(1); }

let rawContent = bestLine.slice(contentBodyStart, contentEnd);
console.log("Raw content length:", rawContent.length);

// Unescape JSON
rawContent = rawContent.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

// Remove Read tool line numbers
const cleaned = rawContent.replace(/^\d+:/gm, "").trim();

if (cleaned.includes("export default function App")) {
  fs.writeFileSync("recovered.jsx", cleaned, "utf8");
  console.log("SAVED to recovered.jsx - size:", cleaned.length);
  console.log("Has R:", cleaned.includes("const R="));
  console.log("Has regenLoading:", cleaned.includes("regenLoading"));
  console.log("Has textRegen:", cleaned.includes("textRegen"));
  console.log("Has URL images:", cleaned.includes("new URL(v,"));
  console.log("Has left-image-right-text:", cleaned.includes("maxWidth:1000"));
  console.log("Has hydrateWork:", cleaned.includes("hydrateWork"));
  console.log("Starts with:", cleaned.slice(0, 60));
} else {
  console.log("Not a valid JSX file - missing App function");
  console.log("Contains:", cleaned.includes("function App") ? "function App" : "no App");
  console.log("First 200 chars:", cleaned.slice(0, 200));
}
