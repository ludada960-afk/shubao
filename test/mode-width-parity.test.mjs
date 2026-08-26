import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// 四创作板块主区宽度一致性契约（2026-08 用户反馈：电商板块比其余三个窄）。
// 实测基准（vw=1288，修复前）：电商 ec-main-card=1168 / 小红书 xhs-main-card=1168 /
// 自由创作 visual-creation=1200 / AI视频 video-composer=1240（越出宿主容器）。
// 归一原则：消除残留约束（卡片侧边距、嵌入态 100vw 越界），不做粗暴加宽；
// 四板块主区一律以 surface-card-inner（min(1240px,100%)）为唯一宽度基准。
const ecMode = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const showcaseCss = await readFile(new URL('../src/pages/Home/CreationShowcase.css', import.meta.url), 'utf8');
const videoCss = await readFile(new URL('../src/pages/VideoStudio/VideoStudio.css', import.meta.url), 'utf8');
const visualCss = await readFile(new URL('../src/pages/Home/VisualCreationMode.css', import.meta.url), 'utf8');

test('ecommerce main card fills the shared workbench shell without legacy side margins', () => {
  // 内嵌 rail 时代的残留约束已清：ec-main-card 不再自带 margin: 0 16px。
  assert.doesNotMatch(ecMode, /margin:\s*'0 16px'/);
  assert.doesNotMatch(ecMode, /className="ec-mode-columns"/);
});

test('xhs main card shares the same width baseline as ecommerce', () => {
  const rule = showcaseCss.match(/\.xhs-main-card\s*\{[^}]*\}/)?.[0] || '';
  assert.match(rule, /margin:\s*0;/);
  assert.doesNotMatch(rule, /margin:\s*0\s+16px/);
});

test('embedded video studio no longer escapes its host container via viewport units', () => {
  // 桌面布局规则 = 同时声明 width 与 margin:0 auto 的那条 .is-embedded 规则；
  // ≤820px 的移动端整宽补偿（共享独立页选择器）不在本契约范围。
  const embeddedRules = [...videoCss.matchAll(/\.video-studio-page\.is-embedded\s*\{([^}]*)\}/g)].map(m => m[1]);
  const layoutRule = embeddedRules.find(rule => /width:/.test(rule) && /margin:\s*0 auto;/.test(rule));
  assert.ok(layoutRule, 'desktop .is-embedded layout rule not found');
  assert.match(layoutRule, /width:\s*min\(1240px,\s*100%\)/);
  // 桌面布局规则不得再用视口单位越出宿主容器
  assert.doesNotMatch(layoutRule, /calc\(100vw/);
});

test('visual creation keeps the shared min(1240px, 100%) baseline', () => {
  const rule = visualCss.match(/\.visual-creation\s*\{[^}]*\}/)?.[0] || '';
  assert.match(rule, /width:\s*min\(1240px,\s*100%\)/);
});
