const fs = require('fs');
const path = require('path');

const srcDir = 'D:/AI网站/shubao/薯包形象包/shubao 抠图';
const outDir = 'D:/AI网站/shubao/public/images';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const mapping = {
  'cropped.png': 'appicon.png',
  'cropped (2).png': 'logo.png',
  'cropped (8).png': 'wave.png',
  'cropped (9).png': 'stand.png',
  'cropped (10).png': 'excited.png',
  'cropped (11).png': 'happy.png',
  'cropped (12).png': 'welcome.png',
  'cropped (13).png': 's1.png',
  'cropped (14).png': 's2.png',
  'cropped (15).png': 's3.png',
  'cropped (16).png': 's4.png',
  'cropped (17).png': 's5.png',
  'cropped (18).png': 'think.png',
  'cropped (19).png': 'upgrade.png',
  'cropped (20).png': 'loading.png',
  'cropped (21).png': 'result.png',
  'cropped (22).png': 'publish.png',
  'cropped (23).png': 'tip.png',
  'cropped (24).png': 'banner.png',
  'cropped (25).png': 'idea.png',
  'cropped (26).png': 'success.png',
  'cropped (27).png': 'protect.png',
  'cropped (1).png': 'scene.png',
  'cropped (3).png': 'bg.png',
  'cropped (4).png': 'card1.png',
  'cropped (5).png': 'card2.png',
  'cropped (6).png': 'card3.png',
  'cropped (7).png': 'card4.png',
};

for (const [srcFile, dstFile] of Object.entries(mapping)) {
  const src = path.join(srcDir, srcFile);
  const dst = path.join(outDir, dstFile);
  fs.copyFileSync(src, dst);
  const size = fs.statSync(dst).size;
  console.log(`${dstFile} (${(size/1024).toFixed(0)}KB) <- ${srcFile}`);
}

console.log('\nDone!', Object.keys(mapping).length, 'images copied to', outDir);
