// 右栏导演检查器纯模型（P2）：决策卡队列 + 任务事件流按镜分组 + 改稿对话。
// 决策卡未确认不写入提示词、不产生任何扣费任务；确认后仅作为提示词片段
// 参与既有审批门下的生成链。不触碰 provider 底座 / 队列 / 账务。

export const DECISION_CARDS = Object.freeze([
  Object.freeze({
    id: 'perspective', title: '视角', hint: '镜头看待主体的角度',
    options: Object.freeze([
      ['eye_level', '平视'], ['high_angle', '俯拍'], ['low_angle', '仰拍'], ['close_up', '特写'],
    ]),
  }),
  Object.freeze({
    id: 'style', title: '风格', hint: '画面质感与调性',
    options: Object.freeze([
      ['realistic', '写实电商'], ['cinematic', '电影感'], ['minimal', '极简白底'], ['vivid', '高饱和种草'],
    ]),
  }),
  Object.freeze({
    id: 'pace', title: '节奏', hint: '剪辑与镜头推进速度',
    options: Object.freeze([
      ['standard', '标准'], ['fast_cut', '快切'], ['slow_burn', '舒缓'],
    ]),
  }),
  Object.freeze({
    id: 'weight', title: '镜权重', hint: '标注主推镜，规划参考不扣费',
    options: Object.freeze([
      ['normal', '常规镜'], ['hero', '主推镜'],
    ]),
  }),
]);

export function emptyDecisionState() {
  const state = {};
  DECISION_CARDS.forEach(card => { state[card.id] = ''; });
  return { values: state, confirmed: {} };
}

// 决策卡队列：每张卡显示当前选项与确认态。
export function decisionQueueItems(decisionState = emptyDecisionState()) {
  const values = decisionState?.values || {};
  const confirmed = decisionState?.confirmed || {};
  return DECISION_CARDS.map(card => ({
    id: card.id,
    title: card.title,
    hint: card.hint,
    options: card.options,
    value: values[card.id] || '',
    valueLabel: (card.options.find(option => option[0] === values[card.id]) || ['', ''])[1],
    confirmed: Boolean(confirmed[card.id]),
  }));
}

// 只有已确认且非空的决策才进入生成提示词（未确认不扣费的契约面）。
export function confirmedDecisionPromptParts(decisionState = emptyDecisionState()) {
  const items = decisionQueueItems(decisionState);
  const labels = { perspective: '视角', style: '风格', pace: '节奏', weight: '镜权重' };
  return items
    .filter(item => item.confirmed && item.value)
    .map(item => labels[item.id] + '：' + item.valueLabel)
    .filter(Boolean);
}

const FINAL_JOB_STATES = new Set(['completed', 'failed', 'needs_review']);

// 任务事件流按镜分组：trackedJobs（画布轮询）+ 方案每镜成本 → 按镜头序分组。
export function shotEventGroups({ shots = [], trackedJobs = {}, planShots = [] } = {}) {
  const byShot = new Map();
  const ensure = shotId => {
    if (!byShot.has(shotId)) {
      const index = shots.findIndex(shot => shot.id === shotId);
      byShot.set(shotId, {
        shotId,
        index,
        label: '镜头 ' + String(index + 1).padStart(2, '0'),
        purpose: shots[index]?.purpose || '',
        points: Number(planShots.find(item => item?.id === shotId)?.cost?.points) || null,
        events: [],
      });
    }
    return byShot.get(shotId);
  };
  Object.values(trackedJobs || {}).forEach(entry => {
    if (!entry?.shotId || !entry?.jobId) return;
    const group = ensure(entry.shotId);
    const done = FINAL_JOB_STATES.has(entry.status);
    group.events.push({
      jobId: entry.jobId,
      tone: entry.status === 'completed' ? 'done' : entry.status === 'processing' ? 'running' : done ? 'failed' : 'queued',
      text: entry.status === 'completed' ? '成片已交付，候选已回挂'
        : entry.status === 'failed' ? (entry.error || '生成未交付')
        : entry.status === 'needs_review' ? '受理结果确认中'
        : '排队生成中 ' + (entry.progress || 2) + '%',
      progress: Number(entry.progress) || 0,
      retryable: entry.status === 'failed',
    });
  });
  const groups = [...byShot.values()];
  groups.sort((left, right) => (left.index < 0 ? 1 : left.index) - (right.index < 0 ? 1 : right.index));
  groups.forEach(group => group.events.reverse()); // 新事件在上
  return groups;
}

// 改稿对话快捷 chips：与画布生成条同一组运镜词。
export const CHAT_TWEAK_CHIPS = Object.freeze([
  ['static', '固定'], ['pan', '横摇'], ['tilt', '纵摇'], ['dolly_in', '推进'],
  ['dolly_out', '拉远'], ['tracking', '跟拍'], ['orbit', '环绕'],
]);

// 改稿对话 chip 图标映射: lucide-react 已有, 简单 icon 名 + 占位 (VideoCanvasWorkbench 那边按需 import 真实组件)
// 我们用字符串 icon name, 让 Workbench 按 name 渲染 lucide 图标
export const CHAT_TWEAK_ICONS = Object.freeze({
  static: 'Square',
  pan: 'MoveHorizontal',
  tilt: 'MoveVertical',
  dolly_in: 'ZoomIn',
  dolly_out: 'ZoomOut',
  tracking: 'Crosshair',
  orbit: 'RotateCw',
});

// 改稿指令合成：运镜词 chips + 自然语言微调 → 新的镜头提示词。
export function composeTweakPrompt({ basePrompt = '', instruction = '', chipIds = [] } = {}) {
  const chipLabels = (Array.isArray(chipIds) ? chipIds : [])
    .map(id => CHAT_TWEAK_CHIPS.find(chip => chip[0] === id)?.[1])
    .filter(Boolean);
  const parts = [
    String(basePrompt || '').trim(),
    chipLabels.length ? '运镜：' + chipLabels.join('→') : '',
    String(instruction || '').trim().slice(0, 600),
  ].filter(Boolean);
  return parts.join('。');
}

// 改稿是否真的会触发重生成：需要非空结果 + 已批准方案（调用方再叠加 PLANNING 判断）。
export function tweakRegenerationReady({ prompt = '', gatePhase = '' } = {}) {
  if (!String(prompt).trim()) return { ok: false, reason: '改稿内容为空' };
  if (gatePhase !== 'approved') return { ok: false, reason: '请先在左栏批准生成方案，改稿重生成才会创建扣费任务' };
  return { ok: true, reason: '' };
}
