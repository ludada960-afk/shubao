// test/gen-settings-panel-model-copy-0914.test.mjs
// 2026-09-14 用户批注（首页生成设置面板）：
//  ① 模型列表太长 → 默认折叠成「当前模型」+ 展开行高 ≤44px，一屏看全（生图模型+清晰度+其它配置）
//  ② 面板下部信息看不到 → 压缩纵向间距（配合 ①）
//  ③ 「锁定品牌主色调」默认不锁定（brandLocked=false），用户点了才锁
//  ④ 套图方案面板宽度收窄（>=360, <=520）
//  ⑤ 画布里模型没有描述 → 目录给每个模型补一行 shortDescription（<=22 字），首页面板已展示
//  ⑥ 描述与积分口径自相矛盾 → 描述/徽标不再自称「成本最低/性价比」，只讲能力差异；对照表见测试输出
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IMAGE_MODELS,
  SELECTABLE_IMAGE_MODELS,
  generationUnits,
  imageModelResolutions,
} from '../src/services/imageModelCatalog.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* ── ⑤ shortDescription：8 个模型都有、非空、一行 ≤22 字 ── */
test('8 个可选模型都有非空 shortDescription（一行 ≤22 字）', () => {
  assert.equal(IMAGE_MODELS.length, 8, '目录应有 8 个模型');
  assert.equal(SELECTABLE_IMAGE_MODELS.length, 8, '8 个模型都应已上线可选');
  for (const model of IMAGE_MODELS) {
    const short = (model.shortDescription || '').trim();
    assert.ok(short.length > 0, model.id + ' 缺 shortDescription');
    assert.ok(short.length <= 22, model.id + ' shortDescription 超过一行（>22 字）：' + short);
  }
});

test('首页生成设置面板展示 shortDescription（一行短描述）', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes('shortDescription'), '模型行必须渲染 shortDescription');
  assert.ok(panel.includes("model.shortDescription || model.description"), 'shortDescription 缺失时回落完整描述，不白屏');
});

/* ── ⑥ 描述/徽标不再自带价格卖点（与积分口径一致） ── */
test('徽标与描述不再自称「成本最低/性价比」（mdkj 1K/2K 与 image2 同价 1000 units）', () => {
  const PRICE_CLAIM = /性价比|成本最低|低价|最便宜|省钱|最低成本/;
  for (const model of IMAGE_MODELS) {
    const copy = [model.badge, model.description, model.shortDescription].join(' ');
    assert.ok(!PRICE_CLAIM.test(copy), model.id + ' 仍含价格卖点文案: ' + copy);
  }
  const mdkj = IMAGE_MODELS.find(m => m.id === 'mdkj-super');
  assert.equal(mdkj.badge, '高频铺量');
  assert.equal(generationUnits('mdkj-super', '2K'), 1000);
  assert.equal(generationUnits('image2', '2K'), 1000);
});

test('积分对照表：模型 / units / 积分 / 描述 全部可解析且与档位一致', () => {
  const rows = [];
  for (const model of SELECTABLE_IMAGE_MODELS) {
    const resolutions = imageModelResolutions(model.id);
    for (const res of resolutions) {
      const units = generationUnits(model.id, res);
      assert.ok(Number.isFinite(units) && units > 0, model.id + ' ' + res + ' 的 units 缺失');
      rows.push({ model: model.id, label: model.label, res, units, points: units / 1000, desc: model.shortDescription });
    }
  }
  assert.equal(generationUnits('image2', '2K'), 1000);
  assert.equal(generationUnits('mdkj-super', '4K'), 1500);
  assert.equal(generationUnits('image2-5-sunburst', '2K'), 1500);
  assert.equal(generationUnits('gemini-3-image', '4K'), 3000);
  assert.equal(generationUnits('midjourney', '2K'), 3500);
  assert.deepEqual(imageModelResolutions('midjourney'), ['1K', '2K'], 'Midjourney 只给 1K/2K');
  console.log('对照表: 模型 / 清晰度 / units / 积分 / 描述');
  console.log(rows.map(r => [r.model, r.res, r.units, r.points + ' 积分', r.desc].join('\t')).join('\n'));
});

/* ── ① 默认折叠 + ③ 默认不锁定 ── */
test('面板默认折叠模型列表，行高压缩到 ≤44px（配合一屏看全）', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes('const [modelListOpen, setModelListOpen] = useState(false)'), '模型列表默认折叠');
  assert.ok(panel.includes('aria-expanded={modelListOpen}'), '折叠按钮暴露展开状态');
  /* ⚠️ 2026-09-15 更新：判据是「展开后每一个已上线档位都能选到」。
     当前已选的那一个改由正上方的触发按钮承担（用户批注图6-⑨ 要求不要重复显示同一项），
     其余档位逐个列出，并保留「过滤后为空则退回完整清单」的兜底。 */
  assert.ok(panel.includes('const otherModels = SELECTABLE_IMAGE_MODELS.filter'), '展开清单派生自已上线档位');
  assert.ok(panel.includes('listModels.map'), '展开后列出清单里的每一档');
  assert.ok(panel.includes('otherModels.length > 0 ? otherModels : SELECTABLE_IMAGE_MODELS'),
    '兜底：过滤后为空必须退回完整清单（不能点开一个空面板）');
  /* 2026-09-15 V3 二次更新：行高改由 --sb-control-touch(44) 统一约束（仍 ≤44px），
     间距走 --sb-* token，不再写死 '2px 9px' 这类碎档。 */
  assert.ok(panel.includes("minHeight: 'var(--sb-control-touch)'"), '扩展行高度走统一控件高度 token（44px ≤ 44px）');
  assert.ok(panel.includes('var(--sb-space-2)'), '行内间距走统一间距 token');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(panel), '面板内不得再有硬编码色值');
});

test('锁定品牌主色调默认不锁定，锁定态只由外部 brandColors 推导', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes('brandColors = null'), '默认参数 brandColors=null（不锁定）');
  assert.ok(panel.includes('Array.isArray(brandColors) && brandColors.length > 0'), '锁定只来自外部传入色值');
  assert.ok(panel.includes("from 'react-colorful'"), '取色器已正确引入（锁定时不再白屏）');
});

/* ── ④ 面板宽度：2026-09-15 起升级为「六面板统一宽度」 ──
   用户批注：「你这些面板最好宽度都是统一的，不能太宽，太宽信息会被分散掉。
   但也不能粗暴地匹配到一致 —— 里面还有很多按钮逻辑、内容逻辑，要相应适配。」
   故统一值 480 落在原 [360, 520] 口径内，且六个面板共用同一个解析函数。 */
test('六个参数面板宽度统一为 480（沿用 [360, 520] 口径并收紧到单值）', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  const spec = read('src/pages/Home/ec/panelVisualLanguage.js');
  assert.ok(spec.includes('standard: 480'), '统一宽度值 480');
  assert.ok(ecMode.includes('resolvePanelWidth(vw)'), '两处定位都走统一解析（含窄屏兜底）');
  const calls = [...ecMode.matchAll(/resolvePanelWidth\(vw\)/g)];
  assert.ok(calls.length >= 2, '两处定位映射都要用统一宽度');
  for (const stale of ['sizing: 480,', 'sku: 540,', 'copy: 620,', 'settings: 460,']) {
    assert.ok(!ecMode.includes(stale), '不得再残留按内容类型定宽的映射：' + stale);
  }
});
