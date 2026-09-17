#!/usr/bin/env node
/* ═══ 刷新「技能配方快照」════════════════════════════════════════════════════════
   用户 9-17 的要求：「全部都要把它们的来源记录下来，以便我们后续可以找到这些 skill 的来源
   去跟踪他们的情况。」
   这个脚本做三件事：
     ① 按渠道清单把上游的配方库拉到 .tmp/recipes/（不入库）；
     ② 按 skillSources.js 里登记的 ref **严格匹配**到具体 case（库+文件+编号，找不到就空着，
        绝不张冠李戴 —— 曾经因为只按编号匹配，把「海报设计」配成了 Döner 美食配方）；
     ③ 写出 docs/design/skill-recipe-library.json（入库的可追踪快照：原文提示词 + 自带素材链接）。
   用法：node scripts/refresh-skill-recipes.mjs   （然后跑 npm run build:skill-doc 重新出文档）
   ══════════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { SKILL_SOURCES } from '../src/skills/skillSources.js';

const DIR = '.tmp/recipes';
const FENCE = String.fromCharCode(96).repeat(3);
const NL = String.fromCharCode(10);
const GPT = 'https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/cases/';
const SD = 'https://raw.githubusercontent.com/EvoLinkAI/awesome-seedance-2.5-guide/main/use-cases/zh-CN/';
const ZL = 'https://raw.githubusercontent.com/ZeroLu/awesome-seedance/main/prompts/';
const FILES = [
  ['ecommerce.md', GPT + 'ecommerce_zh-CN.md'],
  ['ad-creative.md', GPT + 'ad-creative_zh-CN.md'],
  ['poster.md', GPT + 'poster_zh-CN.md'],
  ['portrait.md', GPT + 'portrait_zh-CN.md'],
  ['seedance-commercial.md', ZL + 'commercial-use-cases.md'],
  ['sd-01-consistency.md', SD + '01-consistency.md'],
  ['sd-02-camera-movement.md', SD + '02-camera-movement.md'],
  ['sd-03-creative-effects.md', SD + '03-creative-effects.md'],
  ['sd-04-story-completion.md', SD + '04-story-completion.md'],
  ['sd-05-video-extension.md', SD + '05-video-extension.md'],
  ['sd-06-audio-voice.md', SD + '06-audio-voice.md'],
  ['sd-07-continuity.md', SD + '07-continuity.md'],
  ['sd-08-video-editing.md', SD + '08-video-editing.md'],
  ['sd-09-music-sync.md', SD + '09-music-sync.md'],
  ['sd-10-emotion.md', SD + '10-emotion.md'],
];
mkdirSync(DIR, { recursive: true });
for (const [name, url] of FILES) {
  try { execFileSync('curl.exe', ['-sL', '-m', '90', url, '-o', DIR + '/' + name], { stdio: 'ignore' }); }
  catch { try { execFileSync('curl', ['-sL', '-m', '90', url, '-o', DIR + '/' + name], { stdio: 'ignore' }); } catch { console.warn('拉取失败（保留旧快照）：' + name); } }
}

const assetsOf = block => [...new Set(block.split(/[\s\"'<>()\[\]]+/).filter(t => t.startsWith('http') && /\.(png|jpg|jpeg|webp|mp4)$/i.test(t)))];
const cases = [];
const read = name => { try { return readFileSync(DIR + '/' + name, 'utf8'); } catch { return ''; } };
/* 官方 use-cases：'## Case <id> · <title>' */
for (const [name] of FILES.filter(f => f[0].startsWith('sd-'))) {
  const text = read(name);
  for (const block of text.split(NL + '## Case ').slice(1)) {
    const titleLine = block.slice(0, block.indexOf(NL)).trim();
    const s = block.indexOf(FENCE); const e = s >= 0 ? block.indexOf(FENCE, s + 3) : -1;
    if (s < 0 || e < 0) continue;
    const parts = titleLine.split('·');
    cases.push({ lib: 'seedance-official', file: name, id: parts[0].trim(), title: parts.slice(1).join('·').trim() || titleLine, prompt: block.slice(s + 3, e).split(NL).map(x => x.trim()).filter(Boolean).join(' '), assets: assetsOf(block).slice(0, 12) });
  }
}
/* 商用玩法：'## N. 标题' */
for (const block of read('seedance-commercial.md').split(NL + '## ').slice(1)) {
  const title = block.slice(0, block.indexOf(NL)).trim();
  if (!/^[0-9]+[.、]?\s/.test(title)) continue;
  const s = block.indexOf(FENCE); const e = s >= 0 ? block.indexOf(FENCE, s + 3) : -1;
  if (s < 0 || e < 0) continue;
  cases.push({ lib: 'seedance-commercial', file: 'seedance-commercial.md', id: title.split(' ')[0].replace(/[.、]$/, ''), title, prompt: block.slice(s + 3, e).split(NL).map(x => x.trim()).filter(Boolean).join(' '), assets: [] });
}
/* 图片库：'### Case N: [title](url)' */
for (const [name, lib] of [['ecommerce.md', 'gpt-image2-ecommerce'], ['ad-creative.md', 'gpt-image2-ad'], ['poster.md', 'gpt-image2-poster'], ['portrait.md', 'gpt-image2-portrait']]) {
  const text = read(name);
  for (const block of text.split('### Case ').slice(1)) {
    const line = block.slice(0, block.indexOf(NL));
    const lb = line.indexOf('['); const rb = line.indexOf(']('); const rp = line.indexOf(')', rb + 2);
    if (lb < 0 || rb < 0 || rp < 0) continue;
    const s = block.indexOf(FENCE); const e = s >= 0 ? block.indexOf(FENCE, s + 3) : -1;
    if (s < 0 || e < 0) continue;
    cases.push({ lib, file: name, id: line.slice(0, line.indexOf(':')).trim(), title: line.slice(lb + 1, rb).trim(), ref: line.slice(rb + 2, rp).trim(), prompt: block.slice(s + 3, e).split(NL).map(x => x.trim()).filter(Boolean).join(' '), assets: assetsOf(block).slice(0, 6) });
  }
}

const LIB_BY_FILE = { 'poster_zh-CN': 'gpt-image2-poster', poster: 'gpt-image2-poster', 'portrait_zh-CN': 'gpt-image2-portrait', portrait: 'gpt-image2-portrait', ecommerce: 'gpt-image2-ecommerce', 'ad-creative': 'gpt-image2-ad', 'commercial-use-cases': 'seedance-commercial' };
const matchOne = source => {
  const ref = String(source.ref || '');
  const hash = ref.indexOf('#');
  if (hash < 0) return null;
  const before = ref.slice(0, hash);
  const key = ref.slice(hash + 1).trim();
  const idMatch = key.match(/^(?:Case)?\s*([0-9]+(?:-[0-9]+)*)/i);
  const wantId = idMatch ? idMatch[1] : '';
  const fileKey = before.split('/').pop().replace('.md', '');
  const wantLib = LIB_BY_FILE[fileKey] || (before.includes('use-cases/') ? 'seedance-official' : '');
  if (!wantLib) return null;
  const pool = cases.filter(c => c.lib === wantLib);
  const titleKey = key.split(' ').slice(1).join(' ').trim();
  return pool.find(c => wantId && String(c.id) === wantId && (!titleKey || c.title.includes(titleKey.split('（')[0].trim())))
    || pool.find(c => wantId && String(c.id) === wantId)
    || (titleKey ? pool.find(c => c.title.includes(titleKey)) : null)
    || null;
};

const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];
const snapshot = {
  note: '技能配方的可追踪快照：每条 = 我们引用的那个上游 case 的原文提示词 + 自带素材链接。刷新：node scripts/refresh-skill-recipes.mjs；出文档：node scripts/build-skill-source-doc.mjs',
  generatedFrom: FILES.map(f => f[1]),
  bySkill: {},
};
let matched = 0;
for (const skill of ALL) {
  const source = SKILL_SOURCES[skill.id];
  if (!source) continue;
  /* 主来源是官方/高星库 → 直接匹配那条 case；
     主来源是自研/竞品（没有公开配方）→ 退到 reference（"参考效果"，用来对标最佳效果出案例）。 */
  const primary = ['official', 'repo'].includes(source.kind) ? source : null;
  const fallback = !primary && source.reference ? source.reference : null;
  const hit = primary ? matchOne(primary) : (fallback ? matchOne(fallback) : null);
  if (primary && !hit) { console.warn('匹配不上（引用写错了？）：' + skill.id + ' ← ' + primary.ref); continue; }
  if (!hit) continue;
  snapshot.bySkill[skill.id] = {
    lib: hit.lib,
    file: hit.file,
    caseId: hit.id,
    title: hit.title,
    sourceLink: hit.ref || '',
    prompt: hit.prompt,
    assets: hit.assets,
    via: primary ? 'primary' : 'reference',
  };
  matched += 1;
}
writeFileSync(new URL('../docs/design/skill-recipe-library.json', import.meta.url), JSON.stringify(snapshot, null, 1));
console.log('技能 ' + ALL.length + ' 条，其中可追溯配方 ' + matched + ' 条已写入 docs/design/skill-recipe-library.json');