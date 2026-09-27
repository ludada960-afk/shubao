// 把知渔实采（docs/design/data/quantv-video-pages.json）里每个控件的 rect 摊开看，设计"逐页对表"的抽取口径
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('docs/design/data/quantv-video-pages.json', 'utf8'));
const pick = process.argv[2] ? j.pages.filter(p => p.url.includes(process.argv[2])) : j.pages.slice(0, 3);
for (const p of pick) {
  console.log('\n==== ' + p.kind + ' · ' + p.title + ' · ' + p.url);
  console.log('panelRect=' + JSON.stringify(p.panelRect) + '  ctaRect=' + JSON.stringify(p.ctaRect));
  console.log('cta="' + (p.cta || '') + '"');
  console.log('buttons:');
  for (const b of (p.panelButtons || [])) {
    console.log('   "' + b.t + '"  @' + b.r.x + ',' + b.r.y + '  ' + b.r.w + '×' + b.r.h);
  }
  console.log('inputs=' + JSON.stringify(p.panelInputs));
  console.log('heads=' + JSON.stringify((p.heads || []).map(h => h.t + '@' + h.r.x + ',' + h.r.y + ' ' + h.r.w + '×' + h.r.h)));
  console.log('rightText=' + JSON.stringify((p.rightText || '').slice(0, 60)));
  console.log('panelText=' + JSON.stringify((p.panelText || '').slice(0, 400)));
}
