import fs from 'fs';

// =============================================
// 1. Add /api/auto-generate endpoint
// =============================================
let c = fs.readFileSync('server/index.mjs', 'utf8');

const routeCode = `

// ── 一键出图（极简模式）──
app.post('/api/auto-generate', async (req, res) => {
  const { platform, input, refImages } = req.body || {};
  if (!input?.trim()) return res.status(400).json({ error: '请输入商品描述' });
  try {
    // 使用 generateECShop 或直接复用 generateImage
    // 简化版：直接调 generateImage + 简单 prompt
    const prompt = `Professional e-commerce product photo of ${input.slice(0, 100)}. ` +
      `Platform: ${platform || '淘宝'}. White or clean background. Studio lighting. ` +
      `Commercial product photography, 8K, hyper-realistic. 1:1 square.`;
    const url = await generateImage(prompt, '其他', false, null, null, null);
    const images = {};
    if (url) images['商品图'] = url;
    res.json({ images, product_name: input.slice(0, 30) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;
// Insert before the extension routes mounting or at end before listen
const listenIdx = c.lastIndexOf("app.listen(PORT,");
c = c.substring(0, listenIdx) + routeCode + c.substring(listenIdx);
fs.writeFileSync('server/index.mjs', c);
console.log('Added /api/auto-generate endpoint');

// =============================================
// 2. Add randomness to prompt generation
// =============================================
let e = fs.readFileSync('server/ecommercePromptEngine.mjs', 'utf8');

// Add a random style modifier to buildECPrompt's output
// Find the return statement of buildECPrompt
const returnIdx = e.lastIndexOf('return prompt;');
if (returnIdx < 0) { console.log('return not found'); process.exit(1); }

// Add a randomizer before return
const randomMod = `
  // 每张图加入随机风格微调，避免每次生成一模一样
  const randStyles = [
    'Slight warm color temperature.',
    'Slightly cool color temperature.',
    'High contrast studio lighting.',
    'Soft diffused natural lighting.',
    'Editorial commercial style.',
    'Clean minimalist commercial style.',
    'Dramatic product spotlight style.',
    'Bright airy commercial style.',
  ];
  const styleSeed = (productName ? productName.length : 0) + (roleKey ? roleKey.charCodeAt(0) || 0 : 0) + (shotInstance || 1);
  prompt += '\\n\\nStyle modifier: ' + randStyles[styleSeed % randStyles.length] + ' Generate with slightly different mood.';
`;

e = e.substring(0, returnIdx) + randomMod + '\n\n' + e.substring(returnIdx);
fs.writeFileSync('server/ecommercePromptEngine.mjs', e);
console.log('Added generation randomness');
