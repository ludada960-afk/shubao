/* ═══ 创作台里的两个「融合控件」：运镜 / 只改一个元素 ══════════════════════════════
   为什么单独一个文件：声明源里的 video.camera_move（运镜控制）与 video.scene_edit（画面修改）
   **不是独立玩法**，而是创作台里的一个控制项。用户 9-17 口径：
   「有些 skill 其实是辅助作用的……融合在一些主 skill 里面，你自己要先深度思考他们的作用呀。」
   所以它们的归宿是这里：控件选项 ↔ 写进提示词的那一句话，一一对应。
   声明源里 fuses.note 说的「见 VideoStudio/cameraMoves.js」就是这份表。

   ⚠️ 两条纪律：
     ① 控件只往**提示词末尾追加一句明确的中文指令**（不悄悄改用户的提示词结构）；
     ② 追加发生在**下发请求时**（composeVideoPrompt），不在面板上改写用户输入的内容 ——
        用户看得见自己写了什么，也看得见"额外追加了什么"（界面照实显示这一句）。 */

/* 运镜：对着上游官方用例的写法收成六档 —— 说清"镜头怎么动"，不说"电影感"这种空话。 */
export const CAMERA_MOVES = [
  { value: '', label: '自动', instruction: '' },
  { value: 'push', label: '推近', instruction: '镜头缓慢推近主体' },
  { value: 'pull', label: '拉远', instruction: '镜头缓慢拉远露出环境' },
  { value: 'orbit', label: '环绕', instruction: '镜头绕主体环绕一周' },
  { value: 'pan', label: '平移', instruction: '镜头横向平移展示侧面' },
  { value: 'static', label: '固定机位', instruction: '机位固定不动，由主体动作带节奏' },
];

/* 只改一个元素：这一类编辑动作的输入永远是"已有的成片"，所以指令必须强调**其余不动**，
   否则模型会顺手把整段重拍（这是画面修改最常翻的车）。 */
export const SCENE_EDITS = [
  { value: '', label: '不指定', instruction: '' },
  { value: 'hair', label: '换发色', instruction: '只把人物的发色换掉，脸型、妆容、动作与背景一律不动' },
  { value: 'prop', label: '加背景物', instruction: '只在背景增加一个指定物体，主体、动作与镜头一律不动' },
  { value: 'clean', label: '去杂物', instruction: '只去掉画面里的指定杂物并补全背景，其余内容一律不动' },
];

/* 批 N：知渔「内容替换」页的两颗胶囊（换模特 / 换产品）—— 同一套「控件 ↔ 一句指令」的机制。
   他们的页面把这两颗放在素材块下面，选中后整条链路就按这个对象替换；
   我们照同一条逻辑：选中后往提示词追加一句明确的替换指令，其余内容不动。 */
export const SWAP_TARGETS = [
  { value: 'model', label: '换模特', instruction: '把原片里的人物替换成我上传的人物图片，动作、镜头与背景保持与原片一致' },
  { value: 'product', label: '换产品', instruction: '把原片里的商品替换成我上传的商品图片，人物、动作、镜头与背景保持与原片一致' },
];

function instructionOf(list, value) {
  const hit = list.find(item => item.value === String(value || ''));
  return hit ? hit.instruction : '';
}

export function cameraInstruction(value) {
  return instructionOf(CAMERA_MOVES, value);
}

export function sceneEditInstruction(value) {
  return instructionOf(SCENE_EDITS, value);
}

export function swapInstruction(value) {
  return instructionOf(SWAP_TARGETS, value);
}

function tidy(value) {
  return String(value || '').trim().replace(/[。；;，,\s]+$/, '');
}

/* 组装真正下发的提示词：用户（或方案分析）的原话在前，融合控件追加的镜头/编辑指令在后。
   ⚠️ 这一步是**纯函数**，所以门禁可以直接断言"追加了什么、顺序对不对"，
      不必去跑视频。幂等键与请求体都用它的结果，两处不同源就会出现"键一样、内容不一样"的重放事故。 */
export function composeVideoPrompt(prompt, instructions = []) {
  const parts = [tidy(prompt), ...instructions.map(tidy)].filter(Boolean);
  return parts.length ? parts.join('。') + '。' : '';
}

/* ═══ 追加指令的**唯一组装点**（批 S）═══════════════════════════════════════════════════
   修的是一个**真 bug**（用户没选过的指令被塞进提示词）：原来这一步把三条指令无条件拼在一起，
   而替换对象的初始值是 'model'（照知渔 /content-replace 那一页的默认选中档），于是
   **每一个**视频页面 —— 包括根本没有"替换对象"控件的「视频创作 / 爆款复刻 / 探店视频」——
   下发的提示词末尾都带着「把原片里的人物替换成我上传的人物图片…」，界面上也照实写着
   「将追加到提示词：…」。用户从没选过这条指令，那几页也没有"原片"可换。

   判据（只有这一页真的渲染了那个控件，它的值才允许进提示词）：
     · 运镜 / 只改一个元素 —— 创作台恒定渲染的两个控件，选了就追加（默认空值 = 不追加）；
     · 替换对象 —— 只有声明了 bind:'swapMode' 的工作台才有那一格（知渔 31 个子页面里只有
       /content-replace 有），所以它的指令必须**由 blocks 派生**，不能按状态默认值拼。
   ⚠️ 依赖数组必须含 blocks / swapTarget：漏掉 swapTarget 会让用户点了「换产品」而提示词
      还是「换模特」（同一类静默不一致，本批次一并修掉）。 */
export function workbenchExtraInstructions({ blocks = [], cameraMove = '', sceneEdit = '', swapTarget = '' } = {}) {
  const list = Array.isArray(blocks) ? blocks : [];
  const hasSwapControl = list.some(block => block && block.bind === 'swapMode');
  return [
    cameraInstruction(cameraMove),
    sceneEditInstruction(sceneEdit),
    hasSwapControl ? swapInstruction(swapTarget) : '',
  ].filter(Boolean);
}
