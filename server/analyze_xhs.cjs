const fs = require("fs");
const html = fs.readFileSync("/tmp/xhs.html", "utf-8");

// Find key layout patterns in the XHS page
const patterns = ["note_detail","note-container","image-container","note-image","interact","note-title","note-content","note-author","carousel"];
patterns.forEach(p => {
  const count = (html.match(new RegExp(p, "gi")) || []).length;
  if (count > 0) console.log(p + ":", count);
});

// Page title
const m = html.match(/<title>([^<]*)<\/title>/);
if (m) console.log("\nPage title:", m[1]);

// Look for the note content structure
// XHS uses specific CSS properties for layout
const layoutHints = html.match(/class="[^"]*reds[^"]*"[^>]*/g);
if (layoutHints) {
  console.log("\nLayout hints found:", Math.min(layoutHints.length, 5));
  layoutHints.slice(0,3).forEach(h => console.log(h.substring(0,200)));
}

// Find the note interaction/action bar structure
const actions = html.match(/interact[^}]*}/g);
if (actions) console.log("\nAction patterns:", actions.length);

console.log("\nTotal HTML size:", html.length);
