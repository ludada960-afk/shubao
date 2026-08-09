import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const ROLE_RULES = [
  { pattern: /白底|纯白/, label: '白底图', description: '展示商品完整外观与识别细节' },
  { pattern: /透明|png素材/i, label: '透明素材', description: '用于后续排版与二次设计' },
  { pattern: /sku|规格|颜色|款式/i, label: 'SKU规格图', description: '说明可选规格、颜色或款式差异' },
  { pattern: /尺寸|参数|数据/, label: '尺寸参数图', description: '说明尺寸、容量或关键规格' },
  { pattern: /模特|场景|使用|上身/, label: '使用场景图', description: '展示商品在真实场景中的使用效果' },
  { pattern: /材质|细节|特写|工艺/, label: '材质细节图', description: '突出材质、结构与工艺细节' },
  { pattern: /对比|前后|vs/i, label: '效果对比图', description: '在统一尺度和视角下展示差异' },
  { pattern: /主图|首图|封面/, label: '商品主图', description: '传达商品识别与核心卖点' },
  { pattern: /详情/, label: '详情图', description: '承接卖点、场景与购买信息' },
];

export function inferImageRole(fileName, index = 0) {
  return ROLE_RULES.find(rule => rule.pattern.test(fileName)) || {
    label: '商品展示图 ' + (index + 1),
    description: '展示本套方案中的商品视觉内容',
  };
}

const COVER_EXCLUDE = /白底|透明|png素材|抠图|去背/i;
const COVER_PRIORITY = [
  /主图|首图|封面|核心卖点/i,
  /场景|使用|模特|上身|实拍/i,
  /材质|细节|工艺|结构|尺寸|参数|对比/i,
  /详情/i,
];

export function selectCoverImages(images, limit = 7) {
  return images
    .map((image, index) => {
      const text = `${image?.sourceFile || ''} ${image?.label || ''} ${image?.description || ''}`;
      const priority = COVER_PRIORITY.findIndex(pattern => pattern.test(text));
      return { image, index, text, score: priority < 0 ? 1 : COVER_PRIORITY.length - priority + 1 };
    })
    .filter(entry => !COVER_EXCLUDE.test(entry.text))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(1, Math.min(7, Number(limit) || 7)))
    .map(entry => entry.image);
}

export function createMosaicLayout(count, width = 1200, height = 1600, gap = 8) {
  const safeCount = Math.max(0, Math.min(7, Number(count) || 0));
  if (!safeCount) return [];
  if (safeCount === 1) return [{ x: 0, y: 0, width, height }];
  const leftWidth = Math.round((width - gap) * 0.64);
  const rightWidth = width - gap - leftWidth;
  if (safeCount === 2) return [
    { x: 0, y: 0, width: leftWidth, height },
    { x: leftWidth + gap, y: 0, width: rightWidth, height },
  ];
  if (safeCount === 3) {
    const topHeight = Math.floor((height - gap) / 2);
    return [
      { x: 0, y: 0, width: leftWidth, height },
      { x: leftWidth + gap, y: 0, width: rightWidth, height: topHeight },
      { x: leftWidth + gap, y: topHeight + gap, width: rightWidth, height: height - topHeight - gap },
    ];
  }
  const upperHeight = Math.round((height - gap) * 0.58);
  const rightTopHeight = Math.floor((upperHeight - gap) / 2);
  const layout = [
    { x: 0, y: 0, width: leftWidth, height: upperHeight },
    { x: leftWidth + gap, y: 0, width: rightWidth, height: rightTopHeight },
    { x: leftWidth + gap, y: rightTopHeight + gap, width: rightWidth, height: upperHeight - rightTopHeight - gap },
  ];
  const bottomCount = safeCount - 3;
  const bottomY = upperHeight + gap;
  const bottomHeight = height - bottomY;
  const baseWidth = Math.floor((width - gap * (bottomCount - 1)) / bottomCount);
  for (let index = 0; index < bottomCount; index += 1) {
    const x = index * (baseWidth + gap);
    layout.push({ x, y: bottomY, width: index === bottomCount - 1 ? width - x : baseWidth, height: bottomHeight });
  }
  return layout;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    args[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function safeId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

async function readOptionalMetadata(inputDir) {
  try { return JSON.parse(await readFile(join(inputDir, 'case.json'), 'utf8')); } catch { return {}; }
}

async function buildCover(files, outputPath) {
  const layout = createMosaicLayout(files.length);
  const composites = await Promise.all(layout.map(async (tile, index) => ({
    input: await sharp(files[index]).rotate().resize(tile.width, tile.height, { fit: 'cover', position: 'attention' }).webp({ quality: 90 }).toBuffer(),
    left: tile.x,
    top: tile.y,
  })));
  await sharp({ create: { width: 1200, height: 1600, channels: 4, background: '#ffffff' } })
    .composite(composites).webp({ quality: 90, effort: 5 }).toFile(outputPath);
}

async function importCase(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.input) throw new Error('缺少 --input，请传入一套电商图片所在的文件夹。');
  const inputDir = resolve(args.input);
  const outputRoot = resolve(args.output || 'public/gallery/ecommerce');
  const metadata = await readOptionalMetadata(inputDir);
  const sourceFiles = (await readdir(inputDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
  if (!sourceFiles.length) throw new Error('输入文件夹中没有可用的 PNG、JPG、WebP 或 AVIF 图片。');
  const title = args.title || metadata.title || basename(inputDir);
  const generatedId = createHash('sha1').update(inputDir + '|' + title).digest('hex').slice(0, 12);
  const id = safeId(args.id || metadata.id) || generatedId;
  const caseDir = join(outputRoot, id);
  await mkdir(caseDir, { recursive: true });
  const declaredImages = new Map((metadata.images || []).map(image => [image.file, image]));
  const imported = [];
  for (let index = 0; index < sourceFiles.length; index += 1) {
    const file = sourceFiles[index];
    const outputName = String(index + 1).padStart(2, '0') + '.webp';
    const output = join(caseDir, outputName);
    await sharp(join(inputDir, file)).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 }).toFile(output);
    const dimensions = await sharp(output).metadata();
    const declared = declaredImages.get(file) || {};
    const inferred = inferImageRole(file, index);
    imported.push({
      url: '/gallery/ecommerce/' + id + '/' + outputName,
      label: declared.label || inferred.label,
      description: declared.description || inferred.description,
      width: dimensions.width || 0,
      height: dimensions.height || 0,
      sourceFile: file,
    });
  }
  const coverSelection = selectCoverImages(imported);
  const coverInputs = (coverSelection.length ? coverSelection : imported.slice(0, 7))
    .map(image => join(caseDir, image.url.split('/').pop()));
  await buildCover(coverInputs, join(caseDir, 'cover.webp'));
  const entry = {
    id, type: 'ecommerce', title,
    category: args.category || metadata.category || '电商套图',
    platform: args.platform || metadata.platform || '淘宝/天猫',
    hint: args.hint || metadata.hint || title,
    cover_url: '/gallery/ecommerce/' + id + '/cover.webp',
    cover_mosaic_url: '/gallery/ecommerce/' + id + '/cover.webp',
    images: imported,
  };
  await writeFile(join(caseDir, 'case.json'), JSON.stringify(entry, null, 2) + '\n', 'utf8');
  const indexPath = join(outputRoot, 'cases.json');
  let cases = [];
  try { cases = JSON.parse(await readFile(indexPath, 'utf8')); } catch {}
  await writeFile(indexPath, JSON.stringify([entry, ...cases.filter(item => item.id !== id)], null, 2) + '\n', 'utf8');
  return entry;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) importCase().then(entry => {
  process.stdout.write('已导入电商案例：' + entry.title + '（' + entry.images.length + ' 张）\n');
}).catch(error => {
  process.stderr.write((error?.message || String(error)) + '\n');
  process.exitCode = 1;
});
