import fs from 'fs';
let c = fs.readFileSync('server/ecommercePromptEngine.mjs', 'utf8');

// Find the white_bg case from its switch label to the end of its return
const startMark = "    case 'white_bg':";
const endMark = "    case 'main_text':";

// Find the exact boundaries
const startIdx = c.indexOf(startMark);
const endIdx = c.indexOf(endMark);
if (startIdx < 0 || endIdx < 0) { console.log('Boundaries not found'); process.exit(1); }

// The white_bg case is everything from startMark to just before endMark
const oldWhiteBg = c.substring(startIdx, endIdx);

const newWhiteBg = `    case 'white_bg':
      return (
        `PROFESSIONAL E-COMMERCE WHITE BACKGROUND PRODUCT PHOTO OF \${productName}. ` +
        `PRODUCT: \${productName}, \${category}. Material: \${cat.materials}. Texture: \${cat.texture}. ` +
        `BACKGROUND RULE: THE ENTIRE BACKGROUND MUST BE SOLID PURE WHITE RGB #FFFFFF. ` +
        `Absolutely NO gradient, no color tint, no shadow on background, no texture. ` +
        `No background elements of any kind. White from edge to edge. ` +
        `The ONLY visible shadow allowed is a small soft drop shadow on the floor directly under the product. ` +
        `COMPOSITION: \${shotAngle || 'Product centered, from eye level'}. Product occupies 60-75% of frame. ` +
        `LIGHTING: \${cat.lighting}. Even, diffused, professional studio lighting. No harsh shadows. ` +
        `STYLE: Commercial product catalog photography. 8K hyper-realistic. Razor sharp focus. ` +
        `CONSTRAINTS: NO PEOPLE. No hands, no models. PRODUCT ONLY. NO decorative props. ` +
        `Product labels, brand names, logos, text, patterns MUST be clearly visible and accurate. ` +
        `ASPECT RATIO: 1:1 square. Final output: \${sizeInfo}. ` +
        `PLATFORM: \${platformVisual}`
      );

`;

if (oldWhiteBg !== newWhiteBg) {
  c = c.replace(oldWhiteBg, newWhiteBg);
  fs.writeFileSync('server/ecommercePromptEngine.mjs', c);
  console.log('White bg case rewritten');
} else {
  console.log('No change needed');
}
