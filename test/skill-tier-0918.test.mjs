import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { FUSE_SLOTS, canCarryResultAsInput, featuredSkills, fuseActionsOf } from '../src/skills/skillDirectory.js';

/* ═══ 技能分层：主技能 vs 辅助能力（2026-09-17 用户口径）══════════════════════════
   用户原话：「有些功能我觉得不一定是真正给用户单独用的，你要知道，有些 skill 其实是**辅助作用**的，
   真正能解决用户实际需求的 skill 才是我们要做成子页面工作台给他们直接使用的，
   有些辅助类的 skill 其实是**融合在一些主 skill 里面**的呀，你自己要先深度思考他们的作用呀。」

   判据（写下来，免得下次又靠感觉）：
     · 主技能（tier 为空 / 'primary'）：用户带着一个「活儿」进来，能独立交付一个完整结果
       → 给它独立的子页面工作台，进首页精选与 Hub 主档；
     · 辅助能力（tier === 'assistant'）：它的输入往往是**已有成片/已有图**，
       或者它只是主技能里的**一种运行方式 / 一个控制项**（批量、相似图、提质感、延长、改画面、运镜）
       → 不占入口，融进主技能，必要时可直达（放在 Hub 的「辅助能力」组里并说明用途）。

   这一条守：辅助能力必须写明归属主技能、不许进精选推荐、也不许出现在 Hub 的正常分类里。 */

const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('① 辅助能力必须写明归属哪个主技能，且归属必须真实存在', () => {
  const assistants = ALL.filter(skill => skill.tier === 'assistant');
  assert.ok(assistants.length >= 5, '辅助能力至少 5 条（批量/相似图/提质感/延长/改画面/运镜），实际 ' + assistants.length);
  for (const skill of assistants) {
    const owner = ALL.find(item => item.id === skill.belongsTo);
    assert.ok(owner, skill.id + ' 的 belongsTo 指向了不存在的技能：' + skill.belongsTo);
    assert.notEqual(owner.tier, 'assistant', skill.id + ' 不能挂在另一条辅助能力下面（辅助要挂在主技能上）');
  }
});

test('② 辅助能力不许进精选推荐（首页那一排只放能独立干完活儿的）', () => {
  for (const board of ['image', 'video']) {
    const list = featuredSkills({ board, limit: 99 });
    const leaked = list.filter(skill => skill.tier === 'assistant').map(skill => skill.id);
    assert.deepEqual(leaked, [], board + ' 板块的精选里混进了辅助能力：' + leaked.join(', '));
  }
  const home = featuredSkills({ limit: 99 });
  assert.equal(home.some(skill => skill.tier === 'assistant'), false, '全量精选里也不许有辅助能力');
});

test('③ Hub 把辅助能力单独成组并说明用途（不许混进正常分类）', () => {
  const hub = read('src/pages/Home/MediaHub.jsx');
  assert.match(hub, /skill\.tier === 'assistant'/);
  assert.match(hub, /category: '辅助能力'/);
  assert.match(hub, /不是独立入口/);
  assert.match(hub, /assistantGroup/);
});

test('④ 自证：每条辅助能力都能说清「它属于哪一步」', () => {
  /* 判据不靠感觉：辅助能力的输入要么是已有成片/已有图，要么是一种运行方式/控制项。
     这里用一句话自证：它的 summary 或 brief 里必须能看出「加工/批量/再生成/控制」的语义。 */
  const KEYWORDS = ['沿用', '再来', '再生成', '批量', '延长', '改', '修', '提升', '指定', '参考图', '已有'];
  for (const skill of ALL.filter(item => item.tier === 'assistant')) {
    const text = String(skill.summary || '') + String(skill.brief || '');
    assert.ok(KEYWORDS.some(word => text.includes(word)), skill.id + ' 看不出它是辅助能力（summary/brief 里没有加工或运行方式的语义）');
  }
});

/* ═══ 融合：辅助能力必须真的"长在主技能身上"（2026-09-18 用户口径）═════════════════
   用户原话：「有些 skill 其实是辅助作用的……融合在一些主 skill 里面，
   你自己要先深度思考他们的作用呀。」只写一句 belongsTo 不算融合 ——
   下面这几条守的就是"融合必须落到界面上的一个真实控件/按钮，而且不许偷偷扣费"。 */

test('⑥ 每条辅助能力都必须声明融合形态；没有能力的必须写明原因（不许假装有）', () => {
  for (const skill of ALL.filter(item => item.tier === 'assistant')) {
    const fuses = skill.fuses;
    assert.ok(fuses && typeof fuses === 'object', skill.id + ' 缺少 fuses：辅助能力必须说清它长在哪、以什么形态出现');
    assert.ok(FUSE_SLOTS.includes(fuses.slot), skill.id + ' 的 fuses.slot 非法：' + fuses.slot);
    assert.ok(String(fuses.label || '').trim(), skill.id + ' 的 fuses 缺少 label（界面上按钮/控件叫什么）');
    const into = Array.isArray(fuses.into) ? fuses.into : [];
    if (fuses.slot === 'none') {
      /* 没有能力就不放按钮 —— 但必须写明为什么，否则下一个人会以为只是忘了接 */
      assert.equal(into.length, 0, skill.id + ' 标了 none 就不该再声明 into');
      assert.ok(String(fuses.reason || '').trim().length >= 20, skill.id + ' 标了 none 必须写明原因（至少 20 字）');
      assert.equal(skill.availability, 'blocked', skill.id + ' 既然没有能力，availability 必须是 blocked（不许写成 ready）');
    } else {
      assert.ok(into.length > 0, skill.id + ' 的 fuses.into 为空：融合关系必须写清长在谁身上');
    }
  }
});

test('⑦ 融合的落点必须是真实存在的主技能（辅助不许挂辅助、也不许指向不存在的 id）', () => {
  for (const skill of ALL.filter(item => item.tier === 'assistant')) {
    const fuses = skill.fuses || {};
    const into = Array.isArray(fuses.into) ? fuses.into : [];
    for (const target of into) {
      if (target === '*') continue;
      const owner = ALL.find(item => item.id === target);
      assert.ok(owner, skill.id + ' 的 fuses.into 指向了不存在的技能：' + target);
      assert.notEqual(owner.tier, 'assistant', skill.id + ' 不能融进另一条辅助能力：' + target);
      assert.equal(owner.board, skill.board, skill.id + ' 跨板块融合了（' + owner.board + '）：' + target);
    }
    /* belongsTo 必须落在融合落点里，否则会出现"文档说属于 A、界面长在 B" */
    if (fuses.slot !== 'none' && !into.includes('*')) {
      assert.ok(into.includes(skill.belongsTo), skill.id + ' 的 belongsTo（' + skill.belongsTo + '）不在 fuses.into 里');
    }
  }
  /* '*' 只允许给"与内容无关"的那几条（运行方式/控制项）—— 结果类动作必须点名 */
  const wildcard = ALL.filter(skill => skill.tier === 'assistant' && (skill.fuses?.into || []).includes('*'));
  assert.deepEqual(wildcard.map(skill => skill.id).sort(),
    ['image.batch', 'image.similar', 'video.camera_move'],
    "into '*' 只给与内容无关的辅助能力（数量/相似图/运镜），其余必须点名到具体主技能");
});

test('⑧ 融合不许只是声明：结果区按钮与控件都必须有真实消费点', () => {
  /* 结果区动作：主技能出完图后，工作台要真的把动作取出来并渲染成按钮 */
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /fuseActionsOf\(board, skill\.id, 'result'\)/, '结果区动作没有从 skillDirectory.fuseActionsOf 取（可能又写了一套判据）');
  assert.match(page, /<RunPanel[^>]*fuseActions=\{fuseActions\}/, '取值了但没交给 RunPanel 渲染');
  assert.match(page, /className="media-run-next-btn"/, 'RunPanel 里没有渲染这个按钮');
  assert.match(page, /canCarryResultAsInput\(carryUrl\)/, '没有做"地址能不能被下一步读回"的把关');
  /* 控件类：视频侧两个控件必须有真实实现（cameraMoves.js）并被创作台引入 */
  const moves = read('src/pages/VideoStudio/cameraMoves.js');
  assert.match(moves, /export const CAMERA_MOVES/);
  assert.match(moves, /export const SCENE_EDITS/);
  assert.match(moves, /export function composeVideoPrompt/);
  const studio = read('src/pages/VideoStudio/index.jsx');
  assert.match(studio, /from '\.\/cameraMoves\.js'/, 'VideoStudio 没引入融合控件模块');
  /* ═══ 批 W（2026-09-21）：这条断言**按用户原话改判**（不是放宽）════════════════════════════
     上一版要求创作台渲染 `.video-fuse-row`（运镜 / 只改一个元素两个融合控件）。
     用户本轮原话（逐字）：「第 4 条**运镜这个没必要啊，这个没有什么意思，去掉**。」
     ⇒ 那一行整组下线（知渔 31 个子页面里本来一个都没有）。
     判据的**意图没变**（"辅助能力必须有真实实现、且它的值真的进请求体"）：
       ① 模块与纯函数仍在（上一条断言）；② 控件的值仍走 composedPrompt 进请求体与幂等键（下面两条）。
     所以这里把"必须渲染控件行"换成"**控件行不得再渲染**"（负向断言，更严）。 */
  assert.doesNotMatch(studio, /className="video-fuse-row"/, '运镜/只改一个元素已按用户口径下线，不许再渲染');
  assert.match(studio, /prompt: composedPrompt/, '融合控件的指令没有进入下发的请求体');
  assert.match(studio, /composedPrompt,/, '幂等键没有用同一份 composedPrompt（两处不同源会造成重放事故）');
  /* ═══ 数量（image.batch 的融合形态）：主技能里必须真有「数量」控件 ═══════════════════════
     这条守的是**机制**：批量不是一个只写在声明里的概念，而是真的以「数量」控件长在主技能工作台上，
     并且有真实消费点（skillRun 把它算进 generationSettings 的 count，报价与出图张数同源）。
     ═══ 2026-09-19 批 O-⑥：阈值 10 → 8，**依据是用户哪一句原话** ═════════════════════════
     用户第 19 轮原话：「我希望你这个图片生成这边，你也要**全部去把这些子页面 1:1 的去把它们抄过来**。」
     以及「你**抄的完全就没有对上**」。
     本批按知渔的 inputConfigs 逐条核对后发现：**知渔那 7 个页面上根本没有「数量/张数」这一档**
     （装修风格转换 / 日夜气候切换 / 一键软硬装替换 / 效果图质感提升 / 室内3D模型渲染 /
       人物姿势参考 / 海报设计 —— 实测字段都只有 上传图片 + 一句指令 + 比例 + 分辨率 四格），
     我们却给它们各自加了一个「数量」。按 1:1 的口径把这些**多出来的**删掉之后，
     带「数量」控件的主技能从 16 降到 9。
     ⇒ 改的是**事实数字**，不是判据：这条要守的"数量控件必须真实存在于主技能里"一个字没动，
        而且还**补强**了下半段（断言这个控件真的进了 generationSettings.count，见下方新增断言）。
        ⚠️ 以后若再删「数量」，请先确认知渔对应页确实没有这一档 —— 不许为了让断言过而删功能。 */
  /* ═══ 2026-09-19 批 R：下限 8 → 7（**判据未变，事实变了**）═══════════════════════════════
     用户第 21 轮口径仍然是"照他们抄"，本批把「图片复刻」页的「生成数量」删掉了 ——
     依据是知渔 ?tool=image-clone 的实采（docs/design/data/quantv-image-builtin-pages.json）：
     他们的字段是 上传商品图 / 核心卖点 / 上传参考图 / 复刻程度 / 统一复刻要求 / 目标市场 /
     目标平台 / 文案语言 / 模型选择 / 分辨率 / 比例 —— **没有张数档**，
     一次出几张由他们按钮那一档定（CTA 写着「消耗 0.60 积分」，与它 6 条交付清单对得上）。
     判据一个字没动：这条守的仍是"「数量」控件必须真的长在主技能上、且真的进 generationSettings.count"。
     ⚠️ 我们这一页**仍然是一次出一张**（count 缺省 1）：把默认张数改成 6 会让一次点击的
        扣费从 1 积分变成 6 积分，那是钱路上的变更，没有用户明确批准不许动（已记进待办）。 */
  const withCount = IMAGE_SKILLS.filter(skill => skill.tier !== 'assistant'
    && (skill.fields || []).some(field => field.key === 'count' && field.kind === 'stepper'));
  assert.ok(withCount.length >= 7, '批量（数量控件）在主技能里只剩 ' + withCount.length + ' 条，太少了');
  /* 补强：数量控件必须**有真实消费点** —— 进 generationSettings 的 count（张数与报价同源） */
  const skillRunSrc = read('src/skills/skillRun.js');
  assert.match(skillRunSrc, /values\.count/, '数量控件的值没有被 skillRun 消费（那就只是画了一个控件）');
  assert.match(skillRunSrc, /Math\.max\(1, Math\.min\(16, Number\.parseInt\(values\.count/, '数量必须进 generationSettings.count（张数与报价的唯一真源）');
});

test('⑨ 自证：结果地址白名单与服务端同源（服务端读不回来的地址不许带给下一步）', () => {
  /* 这一条是"自证"而不是复述：直接读服务端解析图片输入的那三个正则，
     再用同样的样本比对**客户端判据的结论**，两边不一致就说明有人改了服务端没改前端。 */
  const server = read('server/imageInput.mjs');
  assert.match(server, /const GENERATED_ASSET_RE = \/\^\\\/api\\\/generated-assets/);
  assert.match(server, /const TEMP_IMAGE_RE = \/\^\\\/api\\\/ec-temp-img/);
  assert.match(server, /const DATA_IMAGE_RE = \/\^data:/);
  assert.match(server, /if \(!\['http:', 'https:'\]\.includes\(parsed\.protocol\)\) throw new Error\('图片地址无效'\)/);

  const stable = '/api/generated-assets/' + 'b'.repeat(64) + '.png';
  const cases = [
    [stable, true, '稳定作品地址（服务端按 hash 读本地文件）'],
    ['/api/ec-temp-img/abc-1_2.webp', true, '临时上传地址'],
    ['data:image/png;base64,iVBORw0KGgo=', true, 'data URL'],
    ['https://cdn.example.com/a.jpg', true, '外链'],
    ['', false, '空地址'],
    ['/api/generated-assets/notahash.png', false, '形状不对的资产地址'],
    ['blob:http://localhost/xxx', false, 'blob 地址（服务端不认）'],
    ['javascript:alert(1)', false, '非图片协议'],
  ];
  for (const [url, expected, why] of cases) {
    assert.equal(canCarryResultAsInput(url), expected, why + '：' + url);
  }
});

test('⑩ 融合动作不许偷偷扣费（点它只是把结果带过去，生成仍要用户再点一次）', () => {
  const page = read('src/pages/MediaCreation/index.jsx');
  /* 取出 fuseFromResult 这个函数体，断言里面没有任何生成/扣费调用 */
  const start = page.indexOf('function fuseFromResult');
  assert.ok(start > 0, '找不到 fuseFromResult');
  const body = page.slice(start, page.indexOf('\n  }', start));
  for (const banned of ['regenerateCanvasImage', 'generateEcommerce', 'await ']) {
    assert.equal(body.includes(banned), false, 'fuseFromResult 里出现了 ' + banned + '（融合动作不许触发生成/扣费）');
  }
  assert.match(body, /openSkill\(target\.id/, 'fuseFromResult 应当只是切到目标技能并预填素材位');
  assert.match(body, /会重新计费/, '必须告诉用户下一步点生成会重新计费');
});

test('⑪ 视频融合控件是纯函数：追加顺序、标点、空值都不许飘', async () => {
  /* 这一条守的是"钱"：幂等键与请求体都取 composeVideoPrompt 的结果，
     拼装不稳定的后果是"同一份素材+同一句话"算出两个键 → 服务端认不出是同一次 → 重复扣费。 */
  const { CAMERA_MOVES, SCENE_EDITS, cameraInstruction, composeVideoPrompt, sceneEditInstruction } = await import('../src/pages/VideoStudio/cameraMoves.js');
  assert.equal(CAMERA_MOVES[0].value, '', '第一项必须是"自动"（默认不干预用户的提示词）');
  assert.equal(cameraInstruction(''), '', '自动档不追加任何字');
  assert.equal(cameraInstruction('push'), '镜头缓慢推近主体');
  assert.equal(sceneEditInstruction(''), '');
  assert.match(sceneEditInstruction('hair'), /一律不动/, '编辑指令必须强调"其余一律不动"（否则模型会把整段重拍）');
  assert.ok(SCENE_EDITS.length >= 4, '编辑意图至少四档（不指定 + 三个具体动作）');

  assert.equal(composeVideoPrompt('', []), '', '空提示词 + 无追加 = 空');
  assert.equal(composeVideoPrompt('主体转动', ['镜头推近']), '主体转动。镜头推近。', '原话在前、追加在后，中间补句号');
  assert.equal(composeVideoPrompt('主体转动。', ['镜头推近']), '主体转动。镜头推近。', '原话末尾已有句号时不重复');
  assert.equal(composeVideoPrompt('', ['镜头推近']), '镜头推近。', '只有追加句时不留前导标点');
  /* 确定性：同样的输入连算两次必须一模一样（幂等键的前提） */
  const first = composeVideoPrompt('主体转动', ['镜头推近', '只去掉杂物']);
  assert.equal(composeVideoPrompt('主体转动', ['镜头推近', '只去掉杂物']), first, '同样的输入必须得到同样的字符串');
});

test('⑤ 装饰：图片技能里「成品类」的仍然是主技能（不许把能独立交付的降级）', () => {
  for (const id of ['image.white_bg', 'image.remove_bg', 'image.multi_angle', 'image.try_on', 'image.callout_diagram']) {
    assert.notEqual(getImageSkill(id).tier, 'assistant', id + ' 能独立交付成品，不该被降级为辅助');
  }
  const videoPrimary = VIDEO_SKILLS.filter(skill => skill.tier !== 'assistant').map(skill => skill.id);
  for (const id of ['video.smart', 'video.frame', 'video.product_placement', 'video.content_swap']) {
    assert.ok(videoPrimary.includes(id), id + ' 是主技能，不该被降级');
  }
});