// test/canvas-material-works-0912.test.mjs
// 9-11 二轮用户批注契约: 素材/作品逻辑、画布交互、标注工具、技能分域与技能库、首页套图面板。
import test from 'node:test';
import { CANVAS_TRANSIENT_SURFACES } from '../src/pages/EcCanvas/canvasSurfaceDismiss.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(root, p), 'utf8');

import { filterCanvasSkills, applyCanvasSkill, CANVAS_SKILLS } from '../src/pages/EcCanvas/canvasStudioModel.js';
import { deriveEffectiveSmartOverrides, createSmartConfiguration } from '../src/pages/Home/ec/workbenchState.js';

test('⑥ 技能按能力域分域: 生图技能进生图节点, 视频技能进视频生成器', () => {
  const image = filterCanvasSkills('image').map(item => item.slug);
  const video = filterCanvasSkills('video').map(item => item.slug);
  assert.deepEqual(image, ['white-bg-main', 'model-try-on', 'scene-detail']);
  assert.deepEqual(video, ['outfit-video', 'voiceover']);
  assert.equal(image.length + video.length, CANVAS_SKILLS.length, '分域不丢技能');
});

/* 2026-09-16 判据更新（用户批注图5-①）：「技能库里面我点击使用，他并没有把技能带入到输入框
   这边呀。」—— 旧行为是「prompt 非空就什么都不做」，用户点完看不到任何反应。
   新行为：空则填入、非空则**追加**（仍然绝不覆盖）。判据（不覆盖用户已写内容）未变。 */
test('⑥ applyCanvasSkill: 空 prompt 预填、非空追加（绝不覆盖）; 用户技能 (skillBody) 同样可落节点', () => {
  const empty = applyCanvasSkill({ prompt: '', skill: 'scene-detail' });
  assert.equal(empty.skill, 'scene-detail');
  assert.match(empty.prompt, /真实生活场景/);
  const kept = applyCanvasSkill({ prompt: '我写好的要求', skill: 'scene-detail' });
  /* 追加语义：原有内容一字不动地留在开头，技能正文接在后面（绝不覆盖）。 */
  assert.ok(kept.prompt.startsWith('我写好的要求'), '已有 prompt 必须完整保留');
  assert.ok(kept.prompt.length > '我写好的要求'.length, '技能正文必须真的写进输入框（用户批注图5-①）');
  const userSkill = applyCanvasSkill({ prompt: '', skill: '我的主图技能', skillBody: '用户自定义正文' });
  assert.equal(userSkill.skill, '我的主图技能');
  assert.equal(userSkill.prompt, '用户自定义正文');
  assert.equal(userSkill.skillLabel, '我的主图技能');
});

test('⑦ 切换目标语言不再触发「生成设置已调整」(语言属商业上下文, 非生成配置)', () => {
  const base = createSmartConfiguration();
  const none = deriveEffectiveSmartOverrides(base);
  assert.equal(none.settings, false);
  const lang = deriveEffectiveSmartOverrides({ ...base, commerceContext: { ...base.commerceContext, targetLanguage: 'ko-KR' } });
  assert.equal(lang.settings, false, '语言切换不该打 已调整 徽标');
  const res = deriveEffectiveSmartOverrides({ ...base, genSettings: { resolution: '4K', negativePrompt: '' } });
  assert.equal(res.settings, true, '分辨率/负向词仍算生成配置调整');
});

test('① 素材/作品: 上传与替换不再自动归档, 资产库只收用户显式收藏; 生成物仍自动归集', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  const uploadBlock = canvas.match(/canvasImportId: `upload-\$\{uploadStartedAt\}`[\s\S]*?已加入 \$\{uploadedNodes\.length\} 张图片[\s\S]*?图片上传失败，请重试/)?.[0] || '';
  assert.ok(uploadBlock.length > 0);
  assert.doesNotMatch(uploadBlock, /importCanvasImageAssets|ensureCanvasMediaProject\(files\[0\]|enqueuePendingProjectAssetImports|正在后台保存原图/);
  const replaceBlock = canvas.match(/if \(mediaReplaceTargetRef\.current\) \{[\s\S]*?素材已替换[\s\S]*?\r?\n      return;\r?\n    \}/)?.[0] || '';
  assert.ok(replaceBlock.length > 0);
  assert.doesNotMatch(replaceBlock, /importCanvasImageAssets|正在后台保存原图/);
  assert.match(replaceBlock, /fitW/, '节点框随新素材宽高比自适应');
  assert.match(canvas, /handler === 'save-to-assets'/, '用户显式收藏入口');
  assert.match(canvas, /registerGeneratedAssetToProject/, '生成物自动归集保留');
  /* 重试扫描: 连续失败 2 次的记录移出清单, 不再卡死 */
  assert.match(canvas, /attempts >= 2/, '死记录 2 次失败即移除');
});

test('① 资产库动作: 工具条「加入资产库」注册在 selection 表面', () => {
  const registry = read('src/pages/EcCanvas/canvasActionRegistry.js');
  assert.match(registry, /action\('save-to-assets', '加入资产库', \['selection'\]/);
  /* 9-12 用户批注：这个动作挪到「裁剪/导出」那一组，并带语义明确的高亮说明 */
  assert.match(registry, /加入后按钮高亮/);
  const cropIndex = registry.indexOf("action('crop', '裁剪'");
  const assetIndex = registry.indexOf("action('save-to-assets', '加入资产库'");
  assert.ok(assetIndex > 0 && cropIndex > 0 && assetIndex < cropIndex, '加入资产库应紧邻裁剪之前（同属尾部图标组）');
});

test('② 点画布空白: 顶栏与右栏 (派生菜单/图片编辑器) 同时收起', () => {
  /* ═══ 2026-09-29 批 CY-⑭：判据的**位置**变了，**要求一个字没松** ══════════════════════════════════════
     改前这里逐字断言 `setConnectionPicker(null); … setConnectionDraft(null);` 必须出现在
     handlePointerDown 里。事故恰恰出在这个写法上：它只在 `else`(pan) 分支里，而默认 select 工具
     点空白返回的是 'marquee'（见 canvasState.getCanvasPointerIntent）——**那两行永远执行不到**，
     于是「点画布空白收起派生菜单」这条需求实际上从来没生效过（用户 2026-09-29 再次报了一遍）。
     ⇒ 现在两条 setter 都收进 canvasSurfaceDismiss 的**统一仲裁**，点空白一次全关。
       判据改成：① handler 在 if/else **之前**就调用了仲裁；② 仲裁的登记册里确实有这两个 key。 */
  const canvas = read('src/pages/EcCanvas/index.jsx');
  const down = canvas.match(/const handlePointerDown = useCallback\(\(e\) => \{[\s\S]*?\}, \[activeTool/)?.[0] || '';
  assert.ok(down.length > 0);
  assert.match(down, /setSelected\(null\);/);
  assert.match(down, /dismissAllCanvasSurfaces\('blank'\);[\s\S]*?setConnectionDraft\(null\);/,
    '点空白必须先走统一仲裁（挂在 pan 分支上 = 默认框选工具永远走不到，那正是这次的事故）');
  assert.match(down, /dismissAllCanvasSurfaces\('blank'\);/);

  for (const key of ['connectionPicker', 'connectionDraft']) {
    assert.ok(CANVAS_TRANSIENT_SURFACES[key], key + ' 必须登记在册');
  }
  assert.equal(CANVAS_TRANSIENT_SURFACES.connectionPicker.blank, true, '派生菜单必须跟随点空白收起');
  assert.equal(CANVAS_TRANSIENT_SURFACES.connectionPicker.escape, true, '派生菜单必须跟随 Esc 收起');
});

test('③ 加号与连线端点完全重叠: 统一节点垂直中心, 不再有 media 节点 -17px 偏移', () => {
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  assert.doesNotMatch(css, /calc\(50% - 17px\)/, 'media 节点加号偏移已移除');
  const portRule = css.match(/\.ec-canvas-node-port \{[^}]*\}/)?.[0] || '';
  assert.match(portRule, /top: 50%/);
  assert.match(portRule, /translateY\(-50%\)/);
});

test('④ 替换后不空白: 本地预览兜底直到持久图解码成功', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.match(studio, /node\.localPreviewUrl \|\| node\.url/, '节点渲染本地预览优先');
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.match(canvas, /handleImagePreviewReady/, '解码成功才清本地预览');
  assert.match(canvas, /onImageReady\(node\.id\)|onImageReady=\{handleImagePreviewReady\}/);
});

test('⑤ 标注工具: 箭尾用 V 形手算 (不依赖不支持的 marker context-stroke) + 粗细滑块带实时值', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.doesNotMatch(studio, /context-stroke/);
  assert.match(studio, /Math\.atan2\(by - ay, bx - ax\)/, '箭尾角度手算');
  assert.match(studio, /<output>\{options\.annotationWidth \|\| 3\}px<\/output>/, '粗细滑块实时值');
});

test('⑥ 技能按钮进既有技能库管理界面 (SkillLibraryModal 同源), 按域 initialKind', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.match(canvas, /import SkillLibraryModal from '\.\.\/Home\/ec\/SkillLibraryModal\.jsx';/);
  assert.match(canvas, /onOpenSkillLibrary=\{\(\) => openSkillLibrary\(selectedNode\.id, 'image'\)\}/);
  assert.match(canvas, /onOpenSkillLibrary=\{\(\) => openSkillLibrary\(selectedNode\.id, 'video'\)\}/);
  assert.match(canvas, /initialKind=\{skillLibraryTarget\?\.domain === 'video' \? 'video' : 'image'\}/);
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  /* 9-13：技能入口抽成 CanvasSkillControl（四个框共用），域过滤按 domain 传参 */
  assert.match(studio, /function CanvasSkillControl\(/);
  assert.match(studio, /filterCanvasSkills\(domain\)/);
  assert.match(studio, /<CanvasSkillControl[^>]*domain="image"/);
  assert.match(studio, /<CanvasSkillControl[^>]*domain="video"/);
});

test('⑦ 首页: 面板滚动隔离 + 双发射按钮合并为同款紧凑组', () => {
  const css = read('src/pages/Home/Home.css');
  const panel = css.match(/\.ec-config-panel \{[^}]*\}/)?.[0] || '';
  assert.match(panel, /overscroll-behavior: contain/);
  assert.match(panel, /max-height/);
  const ec = read('src/pages/Home/EcMode.jsx');
  const submitIndex = ec.indexOf('ec-workbench-submit-actions');
  assert.ok(submitIndex > 0, '提交按钮组存在');
  const submitBlock = ec.slice(Math.max(0, submitIndex - 500), submitIndex + 2600);
  /* 9-14 用户决策: 电商生图 + 万物上身统一默认带设计方案 ——
     二选一浮层删除, 「下一步」点击即进「生成设计方案 → 进画布」。 */
  assert.match(submitBlock, /下一步/);
  assert.doesNotMatch(submitBlock, /ec-mode-chooser/);
  assert.doesNotMatch(submitBlock, /带设计方案/);
  assert.doesNotMatch(submitBlock, /快速生成/);
  assert.match(submitBlock, /handleNext\(\)/);
  assert.doesNotMatch(submitBlock, /handleNext\(true\)/);
  assert.doesNotMatch(submitBlock, /ec-workbench-quick/);
});
