/* 批 CT：逐页对表生成器 —— 知渔那一侧的实采（2026-09-20 CDP，含每个控件 rect）
   × 我们这一侧的现量（.qa/ct-ours-capture.mjs 产出）
   输出：.tmp/ct-table.md（markdown 表格，人读） + 控制台差异摘要
   用法：node .qa/ct-parity-table.mjs  */
import { readFileSync, writeFileSync } from 'node:fs';
const quantv = JSON.parse(readFileSync('docs/design/data/quantv-video-pages.json', 'utf8'));
const ours = JSON.parse(readFileSync('docs/design/data/quantv-parity-ours.json', 'utf8'));

/* ── 知渔那一侧：抽"可比较的那几件"（口径与 .qa/ct-extract.cjs 同一份） ───────────────── */
const isCta = t => /立即生成|生成视频|开始生成/.test(t) && !/生成脚本|代为撰写|生成方案/.test(t);
const isUpload = t => /选择文件|点击或拖拽|选择图片|上传图片|上传视频|上传原视频|从资产库选择|添加/.test(t);
const isTab = t => /作品示例|我的作品|教学示例|示例|历史/.test(t);
function theirs(p) {
  const btns = (p.panelButtons || []).filter(b => b.r.w > 20 && b.r.h > 16);
  const cta = btns.filter(b => isCta(b.t)).sort((a, b) => b.r.w - a.r.w)[0] || null;
  const groups = [];
  for (const b of btns) {
    if (isCta(b.t) || isTab(b.t) || isUpload(b.t)) continue;
    let g = groups.find(x => Math.abs(x.y - b.r.y) <= 2 && Math.abs(x.h - b.r.h) <= 2 && x.w === b.r.w);
    if (!g) { g = { y: b.r.y, h: b.r.h, w: b.r.w, items: [] }; groups.push(g); }
    g.items.push(b);
  }
  const rows = groups.filter(g => g.items.length >= 2 && g.w >= 80 && g.h <= 60).sort((a, b) => a.y - b.y);
  const chips = rows.length ? { size: rows[0].w + '×' + rows[0].h, perRow: rows[0].items.length, gap: rows.length > 1 ? rows[1].items[0].r.x - rows[0].items[0].r.x - rows[0].w : null, texts: rows.map(r => r.items.map(i => i.t).join('/')).join(' , ') } : null;
  const uploads = btns.filter(b => isUpload(b.t));
  return {
    panel: p.panelRect, cta: cta ? { t: cta.t, w: cta.r.w, h: cta.r.h, y: cta.r.y } : null,
    chips, upload: uploads.length ? uploads[0].r.w + '×' + uploads[0].r.h : null,
    paramGroup: /参数配置/.test(p.panelText || ''),
    tabs: btns.filter(b => isTab(b.t) && b.r.y < 400).map(b => b.r.w + '×' + b.r.h),
  };
}
/* 我们这一侧：从现量的 DOM 里抽同一批件 */
function us(page) {
  if (!page || !page.ok) return null;
  const chipBlock = page.fields.map(f => f.chips).filter(Boolean).sort((a, b) => b.n - a.n)[0] || null;
  const uploadBlock = page.fields.find(f => f.ctrl && /upload/.test(f.ctrl.kind)) || null;
  const labelFonts = [...new Set(page.fields.map(f => f.labelFont).filter(Boolean))];
  return {
    left: page.left, cta: page.cta, chips: chipBlock, upload: uploadBlock ? uploadBlock.ctrl.r.w + '×' + uploadBlock.ctrl.r.h : null,
    paramGroup: !!page.groupTitle, labelFonts, fieldCount: page.fields.length,
  };
}

/* url → 技能 id 的映射（用对照表里的 counterpart） */
const mapping = [];
for (const line of readFileSync('src/skills/quantvVideoParity.js', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*'([\w.]+)':\s*\{\s*counterpart:\s*(QUANTV_VIDEO_BASE \+ '[^']+'|null)/);
  if (m) mapping.push([m[1], m[2] === 'null' ? null : 'https://laoyu.quantv.com' + m[2].match(/'([^']+)'/)[1]]);
}
const ourBySkill = new Map(ours.pages.map(p => [String(p.label).replace('视频侧 ', '').replace('图片侧 ', ''), p]));
const quantvByUrl = new Map(quantv.pages.map(p => [p.url, p]));

const lines = [];
const diffs = [];
for (const [skill, url] of mapping) {
  if (!url) continue;
  const q = quantvByUrl.get(url);
  const o = ourBySkill.get(skill);
  if (!q && !o) continue;
  const t = q ? theirs(q) : null;
  const m = us(o);
  const row = [];
  row.push(skill);
  row.push(q ? q.title : '?');
  row.push(t ? `${t.panel.x}/${t.panel.w}×${t.panel.h}` : '未采');
  row.push(t && t.chips ? `${t.chips.size} ×${t.chips.perRow}/行` : (t ? '—' : '未采'));
  row.push(t && t.upload ? t.upload : (t ? '—' : '未采'));
  row.push(t && t.cta ? `${t.cta.w}×${t.cta.h}` : '—');
  row.push(t ? (t.paramGroup ? '有' : '无') : '未采');
  row.push(m ? `${m.left ? m.left.x + '..' + (m.left.x + m.left.w) : '?'}` : '未量');
  row.push(m && m.chips ? `${m.chips.first.w}×${m.chips.first.h} ×${m.chips.n}颗` : '—');
  row.push(m && m.upload ? m.upload : '—');
  row.push(m && m.cta ? `${m.cta.r.w}×${m.cta.r.h}` : '—');
  row.push(m ? (m.paramGroup ? '有' : '无') : '未量');
  row.push(m && m.labelFonts.length ? m.labelFonts.join(' ') : '—');
  lines.push('| ' + row.join(' | ') + ' |');

  /* 差异判定（只对"两侧都量到"的项） */
  if (t && m) {
    if (t.chips && m.chips) {
      const [qw, qh] = t.chips.size.split('×').map(Number);
      if (qw !== m.chips.first.w || qh !== m.chips.first.h) diffs.push(`${skill}：胶囊 ${t.chips.size}（知渔）vs ${m.chips.first.w}×${m.chips.first.h}（我们）`);
    }
    if (t.paramGroup !== m.paramGroup) diffs.push(`${skill}：「参数配置」组头 知渔=${t.paramGroup ? '有' : '无'} vs 我们=${m.paramGroup ? '有' : '无'}`);
    if (t.cta && m.cta) {
      if (t.cta.w !== m.cta.r.w || t.cta.h !== m.cta.r.h) diffs.push(`${skill}：CTA ${t.cta.w}×${t.cta.h}（知渔）vs ${m.cta.r.w}×${m.cta.r.h}（我们）`);
    }
  }
}
const header = '| 技能 | 知渔页 | 知渔面板 x/宽×高 | 知渔胶囊 | 知渔上传格 | 知渔CTA | 知渔组头 | 我们左栏 x..x | 我们胶囊 | 我们上传格 | 我们CTA | 我们组头 | 我们字段标题字号 |';
const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|---|';
writeFileSync('.tmp/ct-table.md', [header, sep, ...lines].join('\n') + '\n');
console.log('行数 = ' + lines.length + '，已写 .tmp/ct-table.md');
console.log('\n=== 差异（两侧都量到的项）===');
console.log(diffs.length ? diffs.join('\n') : '（无）');
