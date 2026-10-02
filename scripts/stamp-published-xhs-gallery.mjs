/* 薯包出品/ 隐式标识回填。
 *
 * 背景：这 118 张 PNG **已经带 C2PA 凭证**（Trufly CA 签发，内含
 *   softwareAgent=gpt-image、digitalSourceType=.../trainedAlgorithmicMedia）。
 *   也就是说「这是 AI 生成的」已经有行业标准凭证声明了。
 *
 * 那为什么还要加？因为《标识办法》第五条要的三要素里有一项 C2PA 没有：
 *   生成合成内容属性信息 ✓（C2PA 有）
 *   内容编号             ✓（C2PA 有 instanceID）
 *   **服务提供者名称或编码** ✗ —— C2PA 里写的是 "gpt-image"，没有「薯包AI」。
 * 我们是对用户交付生成服务的一方，这一条只有我们自己写得出。
 *
 * ⚠️ 已知且无法本地消除的风险：C2PA 清单含 c2pa.hash.data（对图像数据的哈希）。
 *    插入 iTXt chunk 会改变文件字节布局，**有可能让已签名的 C2PA 校验不再通过**。
 *    仓里没有 C2PA 验证器，我无法在本地证伪或证实这一点 —— 只能保证：
 *      · PNG 结构仍合法（chunk 链完整、可解码）
 *      · **像素逐字节不变**（iTXt 是零重编码路径）
 *      · 原有 caBX chunk 原样保留、未被改动
 *    完整签名校验需要官方 c2patool，属上线后应补做的一次性核验。
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { stampImage, contentIdFor } from '../server/aigcStamp.mjs';

const ROOT = '薯包出品';
const DRY = process.argv.includes('--dry-run');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

function pngChunkTypes(buf) {
  const out = [];
  let o = 8;
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const t = buf.toString('latin1', o + 4, o + 8);
    out.push(t);
    if (t === 'IEND') break;
    o += 12 + len;
  }
  return out;
}

const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter(e => e.isDirectory());
let stamped = 0, skipped = 0, failed = 0, done = 0;
const problems = [];

for (const d of dirs) {
  const dp = path.join(ROOT, d.name);
  for (const f of fs.readdirSync(dp)) {
    if (!f.toLowerCase().endsWith('.png')) continue;
    if (done >= LIMIT) break;
    done++;
    const fp = path.join(dp, f);
    const before = fs.readFileSync(fp);

    if (before.includes(Buffer.from('AIGCContentId', 'latin1'))) { skipped++; continue; }

    try {
      const after = await stampImage(before, {
        contentType: 'image/png',
        contentId: contentIdFor('gallery:' + d.name, f),
      });
      if (Buffer.compare(before, after) === 0) { problems.push(f + '：写入后字节未变'); failed++; continue; }

      /* 安全自检：像素必须逐字节不变，且 caBX 必须还在 */
      const rawB = await sharp(before).raw().toBuffer();
      const rawA = await sharp(after).raw().toBuffer();
      if (Buffer.compare(rawB, rawA) !== 0) { problems.push(f + '：像素被改动'); failed++; continue; }
      const types = pngChunkTypes(after);
      if (!types.includes('caBX')) { problems.push(f + '：caBX 丢失'); failed++; continue; }
      if (!types.includes('IEND')) { problems.push(f + '：PNG 结构损坏'); failed++; continue; }
      const meta = await sharp(after).metadata();
      if (meta.format !== 'png') { problems.push(f + '：写入后不再是合法 PNG'); failed++; continue; }

      if (!DRY) fs.writeFileSync(fp, after);
      stamped++;
    } catch (e) {
      problems.push(f + '：' + e.message);
      failed++;
    }
  }
  if (done >= LIMIT) break;
}

console.log((DRY ? '[试运行] ' : '') + '处理 ' + done + ' 张 → 已打标 ' + stamped + '，跳过 ' + skipped + '，失败 ' + failed);
if (problems.length) {
  console.log('\n问题:');
  problems.slice(0, 20).forEach(p => console.log('  ! ' + p));
  process.exitCode = 1;
}
