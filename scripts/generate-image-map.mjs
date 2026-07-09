const fs = require('fs');
const path = require('path');

const srcDir = 'D:/AI网站/shubao/薯包形象包/shubao 抠图';
const outJs = 'D:/AI网站/shubao/src/images.js';

const mapping = {
  'cropped.png': 'appicon',
  'cropped (2).png': 'logo',
  'cropped (8).png': 'wave',
  'cropped (9).png': 'stand',
  'cropped (10).png': 'excited',
  'cropped (11).png': 'happy',
  'cropped (12).png': 'welcome',
  'cropped (13).png': 's1',
  'cropped (14).png': 's2',
  'cropped (15).png': 's3',
  'cropped (16).png': 's4',
  'cropped (17).png': 's5',
  'cropped (18).png': 'think',
  'cropped (19).png': 'upgrade',
  'cropped (20).png': 'loading',
  'cropped (21).png': 'result',
  'cropped (22).png': 'publish',
  'cropped (23).png': 'tip',
  'cropped (24).png': 'banner',
  'cropped (25).png': 'idea',
  'cropped (26).png': 'success',
  'cropped (27).png': 'protect',
  'cropped (1).png': 'scene',
  'cropped (3).png': 'bg',
  'cropped (4).png': 'card1',
  'cropped (5).png': 'card2',
  'cropped (6).png': 'card3',
  'cropped (7).png': 'card4',
};

const lines = ['// Auto-generated cutout images with transparent backgrounds'];
lines.push('const I = {');

for (const [file, name] of Object.entries(mapping)) {
  const filePath = path.join(srcDir, file);
  const imgData = fs.readFileSync(filePath);
  const base64 = imgData.toString('base64');
  const dataUrl = 'data:image/png;base64,' + base64;
  lines.push(`  ${name}: "${dataUrl}",`);
}

lines.push('};');
lines.push('export default I;');

fs.writeFileSync(outJs, lines.join('\n'));
console.log('Written', Object.keys(mapping).length, 'images to', outJs);
