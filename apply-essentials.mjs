import fs from 'fs';

// ============ 1. Update white_bg prompt ============
let e = fs.readFileSync('server/ecommercePromptEngine.mjs', 'utf8');

const start = e.indexOf("    case 'white_bg':");
const end = e.indexOf("    case 'main_text':");

const wbPrompt =
"    case 'white_bg':\n" +
"      return (\n" +
"        'E-commerce white background product photo. ' +\n" +
"        'Product: ' + productName + '. ' + cat.materials + '. ' + cat.texture + '. ' +\n" +
"        'Composition: Product centered, front view, eye level. ' +\n" +
"        'Lighting: ' + cat.lighting + '. ' +\n" +
"        'KEEP product exactly as shown in reference. EXTRACT product from its background. ' +\n" +
"        'DISCARD original background. NEW background: pure white #FFFFFF studio. ' +\n" +
"        'No gradient, no texture on background. Only soft floor shadow under product. ' +\n" +
"        'NO new text added: no prices, no badges, no labels, no Chinese or English overlay text. ' +\n" +
"        'Product original printed text (brand name on product) is preserved from reference. ' +\n" +
"        'Style: Commercial catalog photo. 8K sharp focus. ' +\n" +
"        'ASPECT RATIO: 1:1 square. Final output: ' + sizeInfo + '. ' +\n" +
"        'This is a white background product image. No decorations, no people, no hands.'\n" +
"      );\n\n";

e = e.substring(0, start) + wbPrompt + e.substring(end);

// ============ 2. Add consistency rule at end of buildECPrompt ============
const retIdx = e.lastIndexOf('\n  return prompt;\n}');
const consistency = '\n' +
'  // 全图集一致性规则：所有图片使用相同产品信息，不编造价格\n' +
"  prompt = 'ALL IMAGES SAME PRODUCT: ' + productName + '. Do NOT add prices or amounts. ' +\n" +
"    'If no price is given in the request, do not invent one. ' +\n" +
"    'Keep product identity consistent across all images in this set.\\n\\n' + prompt;\n";

e = e.substring(0, retIdx) + consistency + e.substring(retIdx);

fs.writeFileSync('server/ecommercePromptEngine.mjs', e);
console.log('Prompt engine updated');

// ============ 3. Add /api/auto-generate endpoint ============
let s = fs.readFileSync('server/index.mjs', 'utf8');

const listenIdx = s.lastIndexOf('app.listen(PORT');
const route =
"\n" +
"// ── 一键出图 ──\n" +
"app.post('/api/auto-generate', async (req, res) => {\n" +
"  const { platform, input } = req.body || {};\n" +
"  if (!input?.trim()) return res.status(400).json({ error: '请输入商品描述' });\n" +
"  try {\n" +
"    const prompt = 'Product photo of ' + input.slice(0, 100) + '. Clean white background. Studio lighting. 1:1 square.';\n" +
"    const url = await generateImage(prompt, '其他', false, null, null, null);\n" +
"    res.json({ images: url ? { '商品图': url } : {}, product_name: input.slice(0, 30) });\n" +
"  } catch (err) {\n" +
"    res.status(500).json({ error: err.message });\n" +
"  }\n" +
"});\n\n";

s = s.substring(0, listenIdx) + route + s.substring(listenIdx);
fs.writeFileSync('server/index.mjs', s);
console.log('Server updated');

// Verify
import('child_process').then(cp => {
  const r1 = cp.execSync('node -c server/ecommercePromptEngine.mjs', { encoding:'utf8', cwd:'.' });
  const r2 = cp.execSync('node -c server/index.mjs', { encoding:'utf8', cwd:'.' });
  console.log('Both files syntax OK');
}).catch(e => console.error(e.message));
