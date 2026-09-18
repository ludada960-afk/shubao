import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/* ═══ 批 J-⑭：图片侧「预览」步（用户批注 image#1，本轮最重的一条）══════════════════════════
   用户原话：
     「它里面有一个叫**代为撰写**的功能。这个功能它实际上就是**我们图片生成那边的板块里面的
       那个预览的功能**。只是图片的话，他在生成的配置做好之后**进行预览，然后再去生成**，
       这样的流程会更合理一些……**但他们的内在逻辑其实是一样的。**
       你照抄他的思路去做就对了，**整个UI和设计你也要跟他一样去做**。」
   契约（这一轮真正落地的三件事）：
     ① 三条预览型技能在**声明源**里带 previewStep（不是页面里写死一串 id）；
     ② 点主按钮**先出预览**，确认后才走生成函数 —— 且**不额外收费**（生成仍按原价扣）；
     ③ 按钮文案在这三页写「生成预览」——**因为现在真的有预览步**，这句话才是真的。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const skills = read('src/skills/imageSkills.js');
const page = read('src/pages/MediaCreation/index.jsx');
const dialog = read('src/components/ui/DialogProvider.jsx');

test('J-⑭ ① 三条预览型技能在声明源里标记 previewStep（页面不写死 id）', () => {
  const flagged = [...skills.matchAll(/id: '(image\.[a-z_]+)'[\s\S]{0,400}?previewStep: true/g)].map(m => m[1]);
  assert.deepEqual(flagged.sort(), ['image.aplus', 'image.detail_page', 'image.product_suite'],
    '预览型技能必须是这三条（竞品对应页面 CTA 原文也是「生成预览」）');
  /* 其余技能**不许**带这个标记：它们点下去就是直出（用户：「有些 skill 是直接生成图片」） */
  assert.equal((skills.match(/previewStep: true/g) || []).length, 3, '只有三条');
});

test('J-⑭ ② + K-C：主按钮先出预览，而预览现在**就是**三步方案预览（0.5 积分/次，先确认后扣）', () => {
  /* ⚠️ suite（套图）**不叠这一层**：它自己就是「先出方案 + 报价、确认后才跑」，再叠一层
     就是让用户连点两次确认（这条是 e2e 当场拦下来的）。 */
  assert.match(page, /const previewStep = Boolean\(skill\?\.previewStep\) && !handoff && !suite;/);
  assert.match(page, /setPlanPreview\(\{/, "预览型技能点主按钮要打开三步方案预览");
  assert.match(page, /collectPlanMaterials\(effectiveValues, skill\)/, "要把用户上传的素材带进方案预览");
  assert.match(page, /collectPlanPrompt\(effectiveValues, skill\)/, "要把用户填的需求带进方案预览");
  assert.match(page, /<PlanPreviewDialog/, "用共用的三步对话框（与视频侧「代为撰写」同一份）");
  assert.match(page, /onApply=\{applyPlanPreview\}/);
  assert.match(page, /onSkip=\{skipPlanPreview\}/, "降级时要有出口，不能是死胡同");
  assert.match(page, /const \[planApplied, setPlanApplied\] = useState\(false\);/,
    "方案应用之后要记住，否则用户再点生成会又弹一次方案预览（实测踩到的真 bug）");
  assert.match(page, /const key = planPreviewTargetKey\(skill\);/, "确认并应用要写回配置里的文字字段");
  /* ⚠️ 批 K-C 改判：批 J-⑭ 那条「预览这一步不许有任何计费动作」**已作废** ——
     那时预览只是把配置摊开看一眼；现在它会真的调用模型（素材理解 + 方案生成），
     所以按用户拍板的 0.5 积分/次收费。计费动作在**对话框内部**，仍然先报价后扣、失败不扣。 */
  const planDialog = read("src/components/plan-preview/PlanPreviewDialog.jsx");
  assert.match(planDialog, /quotePlanPreview/);
  assert.match(planDialog, /继续生成/);
  assert.match(planDialog, /失败不扣积分/);
  assert.match(planDialog, /跳过方案，直接生成/, "降级出口（模型不可用时方案是空的）");
  const previewBlock = page.slice(page.indexOf("const previewStep"), page.indexOf("const runGenerate"));
  assert.ok(!/quoteBillingAction|composePlanPreview/.test(previewBlock),
    "页面本体不许自己发起计费或请求，一律交给对话框");
});

test('J-⑭ ③ 按钮文案：预览型写「生成预览」（有预览步才敢这么写）', () => {
  assert.match(page, /skill\.previewStep \? '生成预览' : \(skill\.ctaLabel \|\| '生成图片'\)/);
});

test('J-⑭ ④ 对话框支持富文本体，且不传 body 时行为不变', () => {
  assert.match(dialog, /\{dialog\.body && <div style=\{\{ marginTop: 14 \}\}>\{dialog\.body\}<\/div>\}/);
});
