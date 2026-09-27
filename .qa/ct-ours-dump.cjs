// 打印我们这一侧（图片/视频）逐页的测量值，人读用
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('docs/design/data/quantv-parity-ours.json', 'utf8'));
const only = process.argv[2];
for (const p of j.pages) {
  if (only && !String(p.label).includes(only)) continue;
  console.log('== ' + p.label + '  left=' + JSON.stringify(p.left) + '  组头=' + (p.groupTitle ? p.groupTitle.t + ' ' + p.groupTitle.r.w + '×' + p.groupTitle.r.h : '无'));
  console.log('   head=' + (p.head ? p.head.t + ' ' + p.head.font : '-') + '   cta=' + (p.cta ? p.cta.r.w + '×' + p.cta.r.h + ' 「' + p.cta.t + '」 @y' + p.cta.r.y : '-'));
  for (const f of p.fields) {
    console.log('   - ' + (f.label || '(无标题)').slice(0, 26) + ' | ' + f.rect.w + '×' + f.rect.h + ' @' + f.rect.x + ',' + f.rect.y
      + ' | 标题字号 ' + (f.labelFont || '-')
      + ' | 控件 ' + (f.ctrl ? f.ctrl.kind.slice(0, 24) + ' ' + f.ctrl.r.w + '×' + f.ctrl.r.h + ' 圆角' + f.ctrl.radius : '-')
      + ' | 胶囊 ' + (f.chips ? f.chips.n + '颗 ' + f.chips.first.w + '×' + f.chips.first.h + ' gap' + f.chips.gap + ' 列' + f.chips.cols : '-'));
  }
}
