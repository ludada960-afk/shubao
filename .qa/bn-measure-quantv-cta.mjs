/* 批 BN：把知渔截图左下角（按钮+提示）逐行逐列的**色带**打出来，定位按钮真实矩形与配色。
   上一版用"同色连续段"在文字行上被白字截断，这一版直接打印色带（run-length），人眼可判。 */
import sharp from 'sharp';

const SRC = process.argv[2];
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const px = (x, y) => { const i = (y * width + x) * channels; return [data[i], data[i + 1], data[i + 2]]; };
const hex = p => '#' + p.map(v => v.toString(16).padStart(2, '0')).join('');
const key = p => p[0] + ',' + p[1] + ',' + p[2];

const runs = (values) => {
  const out = [];
  let start = 0;
  for (let i = 1; i <= values.length; i += 1) {
    if (i === values.length || values[i] !== values[start]) {
      out.push({ from: start, to: i - 1, len: i - start, color: values[start] });
      start = i;
    }
  }
  return out;
};

/* ① 垂直扫一遍：取 x=200（按钮左侧，避开文字），y 从 1050 到 1279 */
for (const x of [140, 200, 760, 800]) {
  const col = [];
  for (let y = 1040; y < height; y += 1) col.push(hex(px(x, y)));
  const r = runs(col).filter(item => item.len >= 4).map(item => ({ y: 1040 + item.from + '→' + (1040 + item.to), len: item.len, color: item.color }));
  console.log('列 x=' + x + '：', JSON.stringify(r));
}

/* ② 水平扫一遍：在按钮竖直中段那一行（先用 1175..1250 之间的若干行试） */
for (const y of [1150, 1180, 1210, 1240, 1260]) {
  const row = [];
  for (let x = 0; x < 1000; x += 1) row.push(hex(px(x, y)));
  const r = runs(row).filter(item => item.len >= 6).map(item => ({ x: item.from + '→' + item.to, len: item.len, color: item.color }));
  console.log('行 y=' + y + '：', JSON.stringify(r.slice(0, 14)));
}
