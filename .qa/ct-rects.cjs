// 逐页打印"关键 rect"（人读，用来定位差在哪一层）
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('docs/design/data/quantv-parity-ours.json', 'utf8'));
const re = new RegExp(process.argv[2] || '.');
for (const p of j.pages) {
  if (!re.test(p.label)) continue;
  console.log('== ' + p.label);
  console.log('  left=' + JSON.stringify(p.left));
  console.log('  groupTitle=' + JSON.stringify(p.groupTitle));
  console.log('  cta=' + (p.cta ? p.cta.r.w + 'x' + p.cta.r.h + ' @' + p.cta.r.x + ',' + p.cta.r.y + ' wrap=' + JSON.stringify(p.cta.wrap) : '-'));
  for (const f of (p.fields || []).slice(0, 3)) {
    console.log('  field @' + f.rect.x + ',' + f.rect.y + ' ' + f.rect.w + 'x' + f.rect.h
      + ' | ctrl=' + (f.ctrl ? f.ctrl.kind.slice(0, 20) + ' @' + f.ctrl.r.x + ',' + f.ctrl.r.y + ' ' + f.ctrl.r.w + 'x' + f.ctrl.r.h + ' pad=' + f.ctrl.pad : '-')
      + ' | chips=' + (f.chips ? f.chips.n + '颗 ' + f.chips.first.w + 'x' + f.chips.first.h + ' gap=' + f.chips.gap + ' cols=' + f.chips.cols : '-'));
  }
}
