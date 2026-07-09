const fs = require("fs");
let c = fs.readFileSync("index.mjs", "utf8");

// Find the regenerate-image endpoint
const marker = "app.post('/api/regenerate-image'";
const start = c.indexOf(marker);
if (start < 0) { console.log("marker not found"); process.exit(1); }

// Find where the route handler function closes - look for the 3rd '});' after our start
let braceCount = 0;
let parenCount = 0;
let inStr = false;
let esc = false;
let endIdx = -1;

for (let i = start; i < c.length; i++) {
  const ch = c[i];
  if (esc) { esc = false; continue; }
  if (ch === '\\' && inStr) { esc = true; continue; }
  if (ch === '"' || ch === "'" || ch === "`") {
    if (!inStr) { inStr = ch; continue; }
    if (inStr === ch) { inStr = false; continue; }
  }
  if (inStr) continue;
  if (ch === '{') braceCount++;
  if (ch === '}') braceCount--;
  if (ch === '(') parenCount++;
  if (ch === ')') parenCount--;
  if (ch === ';' && braceCount === 0 && parenCount === 0) {
    endIdx = i + 1;
    break;
  }
}

if (endIdx < 0) { console.log("end not found"); process.exit(1); }

const newRoute = `
app.post('/api/regenerate-text', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  try {
    const analysis = await contentAnalysis(text);
    res.json({
      title: analysis.title || '',
      body_text: analysis.body_text || '',
      hashtags: analysis.hashtags || [],
      category: analysis.category || '',
      pages: analysis.pages || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

c = c.slice(0, endIdx) + newRoute + c.slice(endIdx);
fs.writeFileSync("index.mjs", c, "utf8");
console.log("✓ Added /api/regenerate-text endpoint");
