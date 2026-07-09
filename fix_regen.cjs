const fs = require("fs");
const c = fs.readFileSync("shubao-final.jsx", "utf8");

// Remove the old innerHTML assignments and add confirm dialog
const old = `                  e.currentTarget.innerHTML='⟳';e.currentTarget.style.background='rgba(255,71,87,0.8)';`;
const repl = `                  if(!confirm('重新生成这张图将消耗一次额度，确定继续吗？'))return;
                  e.currentTarget.style.background='rgba(255,71,87,0.8)';`;

if (c.includes(old)) {
  let result = c.replace(old, repl);
  // Also remove the final innerHTML reset
  const old2 = `                  e.currentTarget.innerHTML='↻';e.currentTarget.style.background='rgba(0,0,0,0.45)';`;
  const repl2 = `                  e.currentTarget.style.background='rgba(0,0,0,0.45)';`;
  if (result.includes(old2)) {
    result = result.replace(old2, repl2);
  }
  fs.writeFileSync("shubao-final.jsx", result, "utf8");
  console.log("Fixed regen button - added confirm, removed garbled text");
} else {
  console.log("Pattern not found");
  // Debug: show the actual text around that area
  const idx = c.indexOf("e.currentTarget.innerHTML");
  if (idx >= 0) console.log("Found:", c.slice(idx, idx + 80));
}
