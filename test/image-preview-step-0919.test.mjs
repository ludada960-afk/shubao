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

test('J-⑭ ① 预览型技能在声明源里标记 previewStep（页面不写死 id）', () => {
  const flagged = [...skills.matchAll(/id: '(image\.[a-z_]+)'[\s\S]{0,400}?previewStep: true/g)].map(m => m[1]);
  /* ═══ 2026-09-25 批 BP：判据从三条 → 四条，属**用户改口径**（不是事实变了、更不是放宽）═══════
     用户原话（针对新做的那个工作台）：
       「我们现在所有的 skill 子页面有一些是**下一步要给出预览页**的……
         那个你做了没有，做了的话**里面不就看得见吗**？」
     以及：「你要不就直接做个这种子页面出来……**定制一个专门为我这个账号风格和审美服务的工作台**」。
     ⇒ 新技能 `image.concept_set` 按用户要求带上预览步：他要的就是"**里面看得见**"
       （三步预览第三步的「方案正文」可看可改）。**原判据守的那件事没变** ——
       "预览型技能必须逐条在声明源里显式标记、页面不许写死一串 id、其余技能不许带这个标记"，
       所以这里仍然逐个列出 id 做全等比对，加一条也要在这里显式写出来。 */
  assert.deepEqual(flagged.sort(), ['image.aplus', 'image.concept_set', 'image.detail_page', 'image.product_suite'],
    '预览型技能必须逐条列在这里（前三条是竞品对应页 CTA 原文「生成预览」；concept_set 是用户点名要的工作台）');
  /* 未标记的技能**不许**带这个标记：它们点下去就是直出（用户：「有些 skill 是直接生成图片」）
     ⚠️ 这条是**原文计数**（数整个声明文件里出现的次数，含注释）——
        所以**注释里不要写出它的字面量**，否则会被算进来把这条打红（批 BP 实测踩过一次）。
        真要解释，就写"previewStep"这几个字，别带上冒号和 true。 */
  assert.equal((skills.match(/previewStep: true/g) || []).length, 4,
    '带预览步的只能是上面列出的那四条 —— 多一条就必须同时改这里，不许悄悄冒出来');
});

test('J-⑭ ② + K-C：主按钮先出预览，而预览现在**就是**三步方案预览（0.5 积分/次，先确认后扣）', () => {
  /* ⚠️ suite（套图）**不叠这一层**：它自己就是「先出方案 + 报价、确认后才跑」，再叠一层
     就是让用户连点两次确认（这条是 e2e 当场拦下来的）。 */
  assert.match(page, /const previewStep = Boolean\(skill\?\.previewStep\) && !handoff && !suite;/);
  /* ⚠️ 2026-09-26 批 BX：锚点从 `setPlanPreview({` 改成 `setPlanSession(` ——
     属**换锚点、不换判据**：这条守的仍是"预览型技能点主按钮要打开三步方案预览"，
     而"带上了素材与需求"由紧跟着的两条（collectPlanMaterials / collectPlanPrompt）钉住。
     改名的原因见 test/plan-preview-session-0926：关掉弹窗不再把会话对象丢掉
     （用户口径「再点一次这个按钮可以回到这个弹窗里面」），它从"一次性打开"变成"一份会话"，
     写入时也从 `setPlanSession({…})` 变成 `setPlanSession(current => ({…}))`（要保留上一轮）。 */
  assert.match(page, /setPlanSession\(/, "预览型技能点主按钮要打开三步方案预览");
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
