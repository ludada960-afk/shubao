// test/plan-preview-0919.test.mjs
// 批 K-C / K-D：三步方案预览（图片侧「预览」与视频侧「代为撰写」同源）
// 权威原文：docs/design/62-batch-K-annotations.md §3（用户原话）与 §二（定价 0.5 积分/次）
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PLAN_PREVIEW_DIRECTIONS,
  PLAN_PREVIEW_SURFACES,
  buildLocalPlanPreview,
  buildPlanPreviewRequest,
  createPlanPreviewService,
  normalizePlanPreview,
  normalizeSurface,
  planPreviewDirections,
} from '../server/planPreview.mjs';
import { FEATURE_SKUS, pointsFaceAnchorCny, quoteFeature } from '../server/billing/catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');

test('两个表面都有三个维度的档位结构（照知渔的业务场景 / 内容类型 / 拍摄方式）', () => {
  assert.deepEqual([...PLAN_PREVIEW_SURFACES], ['image', 'video']);
  for (const surface of PLAN_PREVIEW_SURFACES) {
    const dimensions = planPreviewDirections(surface);
    assert.equal(dimensions.length, 3, surface + ' 必须是三个维度');
    assert.deepEqual(dimensions.map(item => item.key), ['business', 'content', 'shot']);
    for (const dimension of dimensions) {
      assert.ok(dimension.label, surface + ' 的维度要有中文名');
      assert.ok(dimension.options.length >= 4, surface + ' 的 ' + dimension.key + ' 档位太少');
      for (const option of dimension.options) {
        assert.ok(option.value && option.label && option.prompt, '每个档位都要有 value/label/prompt');
      }
    }
  }
  /* 视频侧的档位是**他们线上 config 的真实选项**，不是我编的（docs/design/61 §5 抄录）。 */
  const video = planPreviewDirections('video');
  assert.deepEqual(video[0].options.map(item => item.label), ['电商带货', '同城到店', '上门服务', '教育培训']);
  assert.deepEqual(video[1].options.map(item => item.label), ['带货', '种草', '卖点钩子', '剧情演绎', '生活记录']);
  assert.deepEqual(video[2].options.map(item => item.label), ['桌拍开箱', '真人口播', '一镜到底', '运动跟拍', '品牌TVC']);
  assert.equal(Object.isFrozen(PLAN_PREVIEW_DIRECTIONS), true);
  assert.equal(normalizeSurface('VIDEO'), 'video');
  assert.equal(normalizeSurface('乱写'), 'image');
});

test('请求体把用户选的方向翻成提示词，且不把原图塞进请求', () => {
  const request = buildPlanPreviewRequest({
    surface: 'video',
    prompt: '给这款保温杯做一支短视频',
    skillName: '智能成片',
    direction: { business: 'local_store', content: 'hook', shot: 'tabletop' },
    materials: [{ id: 'a1', name: '主图.jpg', url: 'https://shuimg.cn/x.jpg' }],
  });
  assert.match(request.systemPrompt, /materials/);
  assert.match(request.systemPrompt, /plan/);
  assert.match(request.userPrompt, /同城专属福利/);
  assert.match(request.userPrompt, /开场一秒抛最强卖点钩子/);
  assert.match(request.userPrompt, /桌拍、开箱、细节特写/);
  assert.match(request.userPrompt, /id=a1 name=主图\.jpg/);
  assert.equal(request.surface, 'video');
});

test('归一化：字段名对得上就照抄，对不上就补结构，绝不把 undefined 漏给前端', () => {
  const normalized = normalizePlanPreview({
    materials: [{ id: 'm1', name: '图1', understanding: '这是商品正面白底图' }],
    plan: {
      title: '保温杯种草短片',
      summary: '一句话讲清保温时长',
      promptText: '镜头一：……',
      steps: [{ title: '开场', detail: '特写' }, '中段'],
      notes: ['不要出现价格'],
    },
  }, { surface: 'video' });
  assert.equal(normalized.materials.length, 1);
  assert.equal(normalized.plan.steps.length, 2);
  assert.equal(normalized.plan.steps[1].title, '中段');
  assert.equal(normalized.plan.notes[0], '不要出现价格');
  assert.equal(normalized.degraded, false);
});

test('降级：模型不可用时**如实说没分析过**，不假装、也不扣费', async () => {
  const service = createPlanPreviewService({ completeText: async () => { throw new Error('模型超时'); } });
  const composed = await service.compose({ surface: 'image', prompt: '做一套主图', materials: [{ id: 'm1', name: '主图.jpg' }] });
  assert.equal(composed.degraded, true);
  assert.match(composed.reason, /模型超时/);
  assert.match(composed.materials[0].understanding, /还没有真正读过这张素材/);
  assert.equal(composed.plan.promptText, '');
  assert.match(composed.plan.notes.join(' '), /失败不扣积分/);
  const local = buildLocalPlanPreview({ surface: 'image' }, '');
  assert.equal(local.degraded, true);
});

test('模型返回非 JSON 也走降级，不抛异常', async () => {
  const service = createPlanPreviewService({ completeText: async () => '抱歉，我无法完成。' });
  const composed = await service.compose({ surface: 'image', prompt: 'x' });
  assert.equal(composed.degraded, true);
  assert.match(composed.reason, /无法解析/);
});

test('计费：ec_plan_preview = 0.5 积分/次，先报价后扣的 SKU 口径与用户拍板一致', () => {
  const feature = FEATURE_SKUS.ec_plan_preview;
  assert.ok(feature, 'SKU ec_plan_preview 必须存在');
  assert.equal(feature.units, 500, '0.5 积分 = 500 units');
  assert.equal(quoteFeature('ec_plan_preview', 1).totalUnits, 500);
  assert.equal(feature.providerCostCny, 0.03);
  /* 全局 70% 地板：成本不得超过面值的 27% */
  const face = 500 * pointsFaceAnchorCny();
  assert.ok(feature.providerCostCny <= face * 0.27, '成本口径过不了 70% 毛利地板');
  assert.ok(face >= 0.13, '面值要盖住 0.5 积分的现金锚');
});

test('一个组件两个入口：图片侧「生成预览」与视频侧「代为撰写」用同一份对话框', () => {
  const imageSide = read('src/pages/MediaCreation/index.jsx');
  assert.match(imageSide, /components\/plan-preview\/PlanPreviewDialog\.jsx/, '图片侧必须引用共用对话框');
  /* ⚠️ 2026-09-26 批 BX：锚点 `setPlanPreview({` → `setPlanSession(`（换锚点、不换判据）——
     关掉弹窗不再丢掉会话对象（用户口径「再点一次这个按钮可以回到这个弹窗里面」），
     所以写入变成了 `setPlanSession(current => ({…}))`；"带上了素材"由下一条钉住。 */
  assert.match(imageSide, /setPlanSession\(/, '图片侧的「生成预览」要打开三步方案预览');
  assert.match(imageSide, /collectPlanMaterials/, '要把用户上传的素材带进方案预览');
  assert.match(imageSide, /onSkip=\{/, '降级时要有出口（模型不可用时方案是空的，不能堵死主流程）');
  /* ── 批 K-D：视频侧「代为撰写」入口（提示词框旁，同一份组件）── */
  const videoSide = read('src/pages/VideoStudio/index.jsx');
  assert.match(videoSide, /components\/plan-preview\/PlanPreviewDialog\.jsx/, '视频侧必须引用**同一份**对话框');
  assert.match(videoSide, /surface="video"/, '视频侧的 surface 必须是 video（服务端按它选档位与权限）');
  assert.match(videoSide, /video-dawei-entry/, '入口按钮要有自己的类名（样式与图片侧一样是纯文字按钮）');
  assert.match(videoSide, /setPrompt\(String\(text \|\| ''\)\.slice\(0, VIDEO_PROMPT_MAX_LENGTH\)\)/,
    '「确认脚本并应用」要把方案正文写回脚本输入框');
  /* 空输入时照知渔实测：只给一句提示、**不发任何请求**（他们 0 次网络请求、0 积分）。 */
  const dawei = videoSide.slice(videoSide.indexOf('const runDawei'), videoSide.indexOf('const applyDaweiPreview'));
  assert.match(dawei, /请先上传参考元素或简单描述脚本。/);
  assert.ok(dawei.indexOf('请先上传参考元素或简单描述脚本。') < dawei.indexOf('uploadVideoAsset'),
    '空输入的拦截必须发生在任何上传/请求之前');
  const videoCss = read('src/pages/VideoStudio/VideoStudio.css');
  assert.match(videoCss, /\.video-dawei-entry \{/);
  assert.match(videoCss, /background: transparent;/, '照知渔的克制口径：不加胶囊底色');
  const dialog = read('src/components/plan-preview/PlanPreviewDialog.jsx');
  /* 三步的标题两套文案都在同一个组件里（用户明说「文案表述可以不一样」） */
  assert.match(dialog, /分析素材/);
  assert.match(dialog, /素材理解/);
  assert.match(dialog, /确认脚本并应用/);
  assert.match(dialog, /确认方案并应用/);
  /* 计费确认弹窗的四件套：价格 / 明细 / 说明 / 两个按钮（照他们弹窗的信息层级） */
  assert.match(dialog, /预计消耗积分/);
  assert.match(dialog, /计费明细/);
  assert.match(dialog, /失败不扣积分/);
  assert.match(dialog, /取消/);
  assert.match(dialog, /继续生成/);
  assert.match(dialog, /0\.5 积分/);
});

test('服务端只有一条流水线：图片侧与视频侧共用 /api/plan-preview', () => {
  const server = read('server/index.mjs');
  assert.match(server, /app\.post\('\/api\/plan-preview'/, '必须有统一的方案预览端点');
  assert.match(server, /sku: 'ec_plan_preview'/);
  assert.match(server, /PLAN_PREVIEW_PROMPT_REQUIRED/, '空需求必须在建 hold 之前拒绝（不许为无效请求扣费）');
  assert.match(server, /DEGRADED_LOCAL_PLAN/, '兜底不收费');
  /* SSRF 闸：素材地址只允许本站 host */
  assert.match(server, /planPreviewAssetUrl/);
  assert.match(server, /url\.host !== host/);
});
