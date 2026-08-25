// VID-R4: creative-quality self-check gate for the six-column shot table.
// Adapted from the MiniMax-H3 STEP-5.5 hard gate: the same six checks run
// here as advisory findings so planning stays friction-free while making
// quality gaps visible before any paid generation. (H3 wording preserved.)

const STRONG_HOOKS = new Set(['visual-joke', 'reversal', 'reveal', 'suspense', 'tender']);
 const CHAIN_HOOKS = new Set(['reveal', 'reversal', 'callback']);
export const MAX_SHOT_DURATION_MS = 15000;
const MAX_WINDOW = 3;

function clean(value) {
  return String(value ?? '').trim();
}

function issue(code, severity, detail, shotIds = []) {
  return { code, severity, detail: clean(detail).slice(0, 320), shotIds: shotIds.filter(Boolean) };
}

/**
 * @param {Array} shots normalized storyboard shots (direction already normalized)
 * @returns {{passed: boolean, checkedAt: string, issues: Array}} passed=true when no finding at all
 */
export function reviewShotTable(shots = []) {
  const ordered = (Array.isArray(shots) ? shots : [])
    .map((shot, index) => ({ shot, index }))
    .sort((left, right) => (Number(left.shot?.position) || left.index) - (Number(right.shot?.position) || right.index))
    .map(({ shot }) => shot);
  const issues = [];
  if (!ordered.length) {
    return { passed: false, checkedAt: '', issues: [issue('SHOT_TABLE_EMPTY', 'advisory', '分镜表为空，先用导演技能拆出镜头再跑自检。')] };
  }

  // Rule 1 — hook coverage: every shot carries a hook; every window of 3
  // consecutive shots contains at least one chain hook (reveal/reversal/callback).
  const missingHook = ordered.filter(shot => !clean(shot?.direction?.hookType));
  if (missingHook.length) {
    issues.push(issue('HOOK_MISSING', 'advisory', `${missingHook.length} 个镜头未设置 Hook 类型（受控词表八选一）。`, missingHook.map(s => s.id)));
  }
  for (let start = 0; start + MAX_WINDOW <= ordered.length; start += 1) {
    const window = ordered.slice(start, start + MAX_WINDOW);
    if (!window.some(shot => CHAIN_HOOKS.has(clean(shot?.direction?.hookType)))) {
      issues.push(issue('HOOK_DENSITY_LOW', 'advisory', `镜头 ${start + 1}-${start + MAX_WINDOW} 连续窗口缺少 reveal/reversal/callback 类钩子，节奏可能偏平。`, window.map(s => s.id)));
      break; // one window finding is enough to flag the rhythm
    }
  }
  const firstHook = clean(ordered[0]?.direction?.hookType);
  const lastHook = clean(ordered[ordered.length - 1]?.direction?.hookType);
  if (ordered.length >= 2 && (!STRONG_HOOKS.has(firstHook) || !STRONG_HOOKS.has(lastHook))) {
    issues.push(issue('BOOKEND_HOOK_WEAK', 'advisory', '开场镜或收尾镜建议使用强钩子（visual-joke/reversal/reveal/suspense/tender）。', [ordered[0].id, ordered[ordered.length - 1].id]));
  }

  // Rule 2 — single-shot duration cap.
  const overlong = ordered.filter(shot => Number(shot?.durationMs) > MAX_SHOT_DURATION_MS);
  if (overlong.length) {
    issues.push(issue('SHOT_TOO_LONG', 'advisory', `单镜时长超过 ${MAX_SHOT_DURATION_MS / 1000}s 上限的镜头有 ${overlong.length} 个，节拍需要更长请拆镜。`, overlong.map(s => s.id)));
  }

  // Rule 3 — spatial anchor inheritance: same landmark must persist across
  // consecutive shots unless the link declares a hard cut / scene jump.
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = clean(objectOf(ordered[index - 1]).refs.landmark);
    const current = clean(objectOf(ordered[index]).refs.landmark);
    const link = clean(objectOf(ordered[index]).continuityLink);
    if (previous && current && previous !== current && !/hard cut|时间跳|场景切换/i.test(link)) {
      issues.push(issue('LANDMARK_BREAK', 'advisory', `镜头 ${index} → ${index + 1} 固定地标变化但连续性衔接未声明 HARD CUT/时间跳。`, [ordered[index - 1].id, ordered[index].id]));
    }
  }

  // Rule 4 — per-second directive coverage where the creator started using them.
  for (let index = 0; index < ordered.length; index += 1) {
    const list = objectOf(ordered[index]).perSecond || [];
    if (!list.length) continue;
    if (!clean(list[0].t) || !/^0/.test(clean(list[0].t))) {
      issues.push(issue('PER_SECOND_START_MISSING', 'advisory', `镜头 ${index + 1} 的每秒指令未从 0s 起步。`, [ordered[index].id]));
    }
  }

  // Rule 5 — continuity chain: non-opening shots should state their link.
  const unlinked = ordered.slice(1).filter(shot => !clean(objectOf(shot).continuityLink));
  if (unlinked.length) {
    issues.push(issue('CONTINUITY_CHAIN_GAP', 'advisory', `${unlinked.length} 个非开场镜头未填写连续性衔接，逐行链会断。`, unlinked.map(s => s.id)));
  }

  // Rule 6 — audio track presence: at least one field or an explicit silent note.
  const silentAudio = ordered.filter(shot => {
    const track = objectOf(shot).audioTrack || {};
    return ['narration', 'dialogue', 'sfx', 'performanceNotes'].every(key => !clean(track[key]));
  });
  if (silentAudio.length) {
    issues.push(issue('AUDIO_TRACK_ABSENT', 'advisory', `${silentAudio.length} 个镜头音轨四项全空——有意静默请在表演备注写 silent。`, silentAudio.map(s => s.id)));
  }

  return { passed: issues.length === 0, checkedAt: '', issues };
}

function objectOf(shot) {
  return shot?.direction && typeof shot.direction === 'object' ? shot.direction : {};
}
