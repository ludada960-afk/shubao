/* 批 CT：从知渔实采里按**同一口径**抽出可比较的那几件（面板/CTA/胶囊/上传格/页签/动作），
   逐页打印，用来人工核对抽取口径对不对（先看数据再生成表）。
   用法：node .qa/ct-extract.cjs [关键词] */
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('docs/design/data/quantv-video-pages.json', 'utf8'));

const isCta = t => /立即生成|生成视频|开始生成|生成$/.test(t) && !/生成脚本|代为撰写/.test(t);
const isUpload = t => /选择文件|点击或拖拽|选择图片|上传图片|上传视频|上传原视频|从资产库选择|添加/.test(t);
const isTab = t => /作品示例|我的作品|教学示例|示例|历史/.test(t) || /爆款|广场/.test(t);
const isAction = t => /AI分析|素材分析|代为撰写|生成脚本|分析|一键/.test(t);

function extract(p) {
  const btns = (p.panelButtons || []).filter(b => b.r.w > 20 && b.r.h > 16);
  const cta = btns.filter(b => isCta(b.t)).sort((a, b) => b.r.w - a.r.w)[0] || null;
  /* 胶囊行：同一 y（±2）、同高（±2）、宽 ≥ 80 的成组按钮（≥2 颗） */
  const groups = [];
  for (const b of btns) {
    if (isCta(b.t)) continue;
    let g = groups.find(x => Math.abs(x.y - b.r.y) <= 2 && Math.abs(x.h - b.r.h) <= 2 && x.w === b.r.w);
    if (!g) { g = { y: b.r.y, h: b.r.h, w: b.r.w, items: [] }; groups.push(g); }
    g.items.push(b);
  }
  const chipsRows = groups.filter(g => g.items.length >= 2 && g.w >= 80 && g.h <= 60 && !isTab(g.items[0].t) && !isUpload(g.items[0].t))
    .map(g => ({ y: g.y, item: g.w + '×' + g.h, n: g.items.length, texts: g.items.map(i => i.t).join('/'), gap: g.items.length > 1 ? g.items[1].r.x - g.items[0].r.x - g.w : null, rowGap: null }))
    .sort((a, b) => a.y - b.y);
  /* 行距：同一列宽组的相邻两行的 y 差 */
  for (let i = 1; i < chipsRows.length; i += 1) {
    const prev = chipsRows[i - 1], cur = chipsRows[i];
    if (prev.item === cur.item) cur.rowGap = cur.y - prev.y;
  }
  const uploads = btns.filter(b => isUpload(b.t));
  const tabs = btns.filter(b => isTab(b.t) && b.r.y < (p.panelRect?.y ?? 0) + 400);
  const actions = btns.filter(b => isAction(b.t));
  const panelText = p.panelText || '';
  const hasParamGroup = /参数配置/.test(panelText);
  const contentLeft = Math.min(...btns.map(b => b.r.x).filter(x => x > (p.panelRect?.x ?? 0) + 20));
  return { page: p, cta, chipsRows, uploads, tabs, actions, hasParamGroup, contentLeft };
}

const filter = process.argv[2];
const list = filter ? j.pages.filter(p => (p.url + p.title).includes(filter)) : j.pages;
for (const p of list) {
  const e = extract(p);
  console.log('\n==== ' + p.title + '  [' + p.url.replace('https://laoyu.quantv.com', '') + ']');
  console.log('  面板 ' + JSON.stringify(p.panelRect) + '  内容左缘 ' + e.contentLeft + '  参数配置组头 ' + (e.hasParamGroup ? '有' : '无'));
  console.log('  CTA ' + (e.cta ? '"' + e.cta.t + '" ' + e.cta.r.w + '×' + e.cta.r.h + ' @y' + e.cta.r.y : '(无)'));
  console.log('  上传格 ' + (e.uploads.length ? e.uploads.map(u => '"' + u.t + '" ' + u.r.w + '×' + u.r.h).join(' + ') : '(无)'));
  console.log('  胶囊行 ' + (e.chipsRows.length ? e.chipsRows.map(r => `y${r.y} ${r.n}颗 ${r.item} 间距${r.gap ?? '-'} 行距${r.rowGap ?? '-'} 「${r.texts}」`).join(' | ') : '(无)'));
  console.log('  动作 ' + (e.actions.length ? e.actions.map(a => '"' + a.t + '" ' + a.r.w + '×' + a.r.h + '@y' + a.r.y).join(' | ') : '(无)'));
  console.log('  页签 ' + (e.tabs.length ? e.tabs.map(t => '"' + t.t + '" ' + t.r.w + '×' + t.r.h + '@y' + t.r.y).join(' | ') : '(无)'));
}
