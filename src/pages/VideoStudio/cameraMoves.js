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
