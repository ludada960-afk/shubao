/* ═══ 门禁：「关掉弹窗不丢方案」+「离开子页面要问一声」（2026-09-26 批 BX）══════════════════════
   用户口径（逐字）：
   「怎么还有「重新生成方案」的按钮啊，我觉得不是只有哪些**一键解析**的按钮才能重新生成吗，
    生成预览方案和生成脚本这种**弹窗形式**的，应该是用户可以**关掉这个弹窗**，但是
    **再点一次这个按钮可以回到这个弹窗里面**啊，用户**退出这个子页面时提示他确定退出吗**，
    这个方案或脚本会丢失。」

   这一组守四件事：
     ① 弹窗里**不再有「重新生成方案」**（重新生成 = 改完需求再点入口按钮，那是另一份方案）；
     ② 关掉弹窗**不卸载**组件（方案与用户在步①/②/③ 改过的东西都留着），再点入口就回来；
     ③ 输入签名只算**弹窗外**的东西（需求 / 素材 / skill / 表面）—— 用户在里面调的档位、
        改的解析条目不算，否则"自己改一下就变成另一份"，与这条口径正好相反；
     ④ 真要走人（返回 / 侧边栏 / 刷新）时问一声，且**只有手上真有没应用的方案**才问。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { isLeavingSubpage, planInputSignature } from '../src/components/plan-preview/planPreviewModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');

test('① 弹窗里不再有「重新生成方案」；关掉是「关闭」而不是「取消」', () => {
  const dialog = read('src/components/plan-preview/PlanPreviewDialog.jsx');
  const jsx = dialog.replace(/\/\*[\s\S]*?\*\//g, '');   // 注释里会引用用户原话，判据只看代码
  assert.doesNotMatch(jsx, /重新生成方案/, '弹窗里又出现了「重新生成方案」按钮（用户点名要去掉）');
  assert.match(jsx, /step === 0 \? '关闭' : '上一步'/, '步① 左边那颗应当是「关闭」（这里没有"取消掉这份方案"这个动作）');
  /* ⚠️ 2026-09-26 批 BY：**不许再往用户眼前放"内部口吻"的说明**（用户口径，逐字）：
     「这句去掉，不要让用户看到这种话啊」「这个也不要展示出来，用户不知道最好」。
     被点掉的三句各记一条 —— 它们分别是"解释我们怎么实现的""教用户怎么用"的那种话：
       · 「这些档位就是这条技能工作台里的档位，已经按默认值选好」（步② 顶部）
       · 「关掉不会丢，再点一次入口按钮就能回到这里」（步① 底部）
       · 「按这条技能自己的解析方案」+「（可以改、可以删、可以加）」（解析卡右上角/标题） */
  for (const banned of ['这些档位就是', '关掉不会丢', '按这条技能自己的解析方案', '可以改、可以删、可以加']) {
    assert.ok(!jsx.includes(banned), '这句是内部口吻、用户不该看到，又回来了：' + banned);
  }
});

test('② 关掉弹窗不卸载组件：两个页面都用受控 open，且会话对象留着', () => {
  const image = read('src/pages/MediaCreation/index.jsx');
  const video = read('src/pages/VideoStudio/index.jsx');
  for (const [name, source, openFlag] of [['图片侧', image, 'planSession.opened'], ['视频侧', video, 'daweiOpen']]) {
    assert.match(source, new RegExp('open=\\{' + openFlag.replace('.', '\\.') + '\\}'), name + '：弹窗的 open 应当是受控的（不是硬编码 open）');
    assert.doesNotMatch(source, /onClose=\{\(\) => setPlanPreview\(null\)\}/, name + '：关闭不许把会话对象丢掉');
  }
  assert.match(image, /const closePlanPreview = \(\) => setPlanSession\(current => \(current \? \{ \.\.\.current, opened: false \} : null\)\)/,
    '图片侧：关闭 = 只把 opened 置 false（方案留着）');
  assert.match(video, /onClose=\{\(\) => setDaweiOpen\(false\)\}/, '视频侧：关闭 = 只把 open 置 false（脚本留着）');
  /* 弹窗自己要知道"这份是按哪份输入生成的" */
  const dialog = read('src/components/plan-preview/PlanPreviewDialog.jsx');
  assert.match(dialog, /signatureRef\.current = inputSignature/, '生成成功时要记住这份方案的输入签名');
  assert.match(dialog, /if \(plan && signatureRef\.current === inputSignature\) \{[\s\S]{0,120}setStage\('ready'\)/,
    '输入没变就要把上一份方案摆回来（不重新请求）');
});

test('③ 输入签名只算弹窗外的东西（用户在里面调的档位不算"另一份方案"）', () => {
  const base = { surface: 'image', skillId: 'image.concept_set', skillName: '概念视觉方案', prompt: '秋天的无花果香', materials: [{ id: 'm1' }] };
  const same = { ...base, direction: { theme: 'x' }, items: [{ key: 'subject', value: '改过的' }] };
  assert.equal(planInputSignature(base), planInputSignature(same), '用户在里面选档位/改条目**不该**算成另一份方案');
  assert.notEqual(planInputSignature(base), planInputSignature({ ...base, prompt: '夏天的' }), '需求变了 = 另一份方案');
  assert.notEqual(planInputSignature(base), planInputSignature({ ...base, materials: [{ id: 'm2' }] }), '素材换了 = 另一份方案');
  assert.notEqual(planInputSignature(base), planInputSignature({ ...base, skillId: 'image.aplus' }), '换了 skill = 另一份方案');
  assert.notEqual(planInputSignature(base), planInputSignature({ ...base, surface: 'video' }), '换了表面 = 另一份方案');
  /* 自证：把签名改成"连内部状态一起算"，第二条断言必须红 */
  const broken = input => JSON.stringify(input);
  assert.notEqual(broken(base), broken(same), '如果签名把 direction/items 也算进去，上面第一条就不成立了 ⇒ 这条判据不是空转');
});

test('④ 离开子页面要拦一下：返回 / 侧边栏 / 刷新，且只在"手上有没应用的方案"时拦', () => {
  const guard = read('src/components/plan-preview/usePlanLeaveGuard.js');
  const model = read('src/components/plan-preview/planPreviewModel.js');
  /* 判据（结构与文案）在纯函数那一份里 —— hook 文件 import 了 JSX 组件，node 起不来 */
  assert.match(model, /target\.closest\('\.topbar-back'\)/, '顶栏「返回」要认出来');
  assert.match(model, /target\.closest\('\.app-sidebar'\)/, '左侧导航要认出来');
  assert.match(model, /confirmLabel: '仍然离开'/, '两个选项要语义明确（用户被问的是"要不要走"）');
  assert.match(model, /就不会留在工作台里了/, '说明要讲清后果');
  /* 判据用**结构**而不是按钮文案：改文案不该让这条失效（与"假悬停"那批同一教训） */
  assert.doesNotMatch(model.slice(model.indexOf('isLeavingSubpage'), model.indexOf('isLeavingSubpage') + 600),
    /textContent|'返回'|'首页'/, '判据不许绑按钮文字');
  /* hook：挂事件 + 只在该拦的时候拦 */
  assert.match(guard, /addEventListener\('click', handleCapture, true\)/, '要在**捕获阶段**拦点击，才来得及挡下导航');
  assert.match(guard, /addEventListener\('beforeunload'/, '刷新 / 关标签页也要拦');
  assert.match(guard, /if \(bypassRef\.current \|\| !activeRef\.current \|\| confirmingRef\.current\) return/,
    '没有没应用的方案时**不许打扰**（也不许把确认框弹两次）');
  assert.match(guard, /dialog\.confirm\(\{ \.\.\.PLAN_LEAVE_CONFIRM/, '要走那个全站共用的确认框');
  /* 两个页面都接上了 */
  assert.match(read('src/pages/MediaCreation/index.jsx'), /usePlanLeaveGuard\(planUnapplied\)/, '图片侧漏接');
  assert.match(read('src/pages/VideoStudio/index.jsx'), /usePlanLeaveGuard\(daweiUnapplied\)/, '视频侧漏接');
  /* 而且必须挂在**提前返回之前**（这个仓被"少调了一个 hook"整页搞崩过）。
     ⚠️ 锚点要写全：文件里还有别的 `if (!skill)`（子组件里也有），只写前半截会锚到别处
        —— 本门禁第一次就是这么红的（guardAt 在 1257 行、"命中"的却在 457 行）。 */
  const image = read('src/pages/MediaCreation/index.jsx');
  const guardAt = image.indexOf('usePlanLeaveGuard(planUnapplied)');
  const earlyReturnAt = image.indexOf('if (!skill) return <div className="media-creation"');
  assert.ok(guardAt > 0, '图片侧没接 usePlanLeaveGuard');
  assert.ok(earlyReturnAt > 0, '找不到主组件的提前返回（锚点失效了？这条断言要跟着改，别让它空转）');
  assert.ok(guardAt < earlyReturnAt,
    'usePlanLeaveGuard 必须在主组件的 `if (!skill) return …` 之前调用，否则切换视图时 hook 数量会变');
});

test('⑤ 判据函数的边界（真元素才认；菜单/弹窗按钮不许误判）', () => {
  const fake = matches => ({ closest: selector => (matches.includes(selector) ? { tag: selector } : null) });
  assert.equal(isLeavingSubpage(fake(['.topbar-back'])), true, '顶栏返回 = 离开');
  assert.equal(isLeavingSubpage(fake(['.app-sidebar'])), true, '侧边栏 = 离开');
  assert.equal(isLeavingSubpage(fake([])), false, '工作台里的按钮不是离开');
  assert.equal(isLeavingSubpage(fake(['.plan-preview-actions'])), false, '弹窗自己的按钮不是离开');
  assert.equal(isLeavingSubpage(null), false, '拿不到元素时不拦（宁可放过，不可误伤）');
});
