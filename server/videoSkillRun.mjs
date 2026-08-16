const MAX_JSON_BYTES = 32_000;
const MAX_STEPS = 32;
const MAX_CHECKPOINTS = 16;
const MAX_ID = 128;

function coded(message) {
  return Object.assign(new Error(message), { code: 'INVALID_SKILL_RUN' });
}

function stateError(message) {
  return Object.assign(new Error(message), { code: 'INVALID_SKILL_RUN_STATE' });
}

function boundedJson(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw coded(`${label} must be an object`);
  let parsed;
  try { parsed = JSON.parse(JSON.stringify(value)); } catch { throw coded(`${label} is not serializable`); }
  if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > MAX_JSON_BYTES) throw coded(`${label} is too large`);
  return parsed;
}

function boundedText(value, label, max = MAX_ID) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw coded(`${label} is invalid`);
  return text;
}

export function normalizeSkillRunSpec(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw coded('skill spec must be an object');
  const skillId = boundedText(spec.skillId, 'skillId');
  const skillVersion = Number(spec.skillVersion);
  if (!Number.isSafeInteger(skillVersion) || skillVersion < 1) throw coded('skillVersion is invalid');
  const input = boundedJson(spec.input, 'input');
  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  if (steps.length > MAX_STEPS) throw coded('too many skill steps');
  const normalizedSteps = steps.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw coded(`step ${index} is invalid`);
    const id = boundedText(step.id, `step ${index} id`);
    const kind = boundedText(step.kind, `step ${index} kind`, 64);
    const label = boundedText(step.label, `step ${index} label`, 240);
    const requires = Array.isArray(step.requires) ? step.requires.map(value => boundedText(value, 'step dependency', MAX_ID)) : [];
    if (new Set(requires).size !== requires.length) throw coded(`step ${index} has duplicate dependencies`);
    return { id, kind, label, requires };
  });
  if (new Set(normalizedSteps.map(step => step.id)).size !== normalizedSteps.length) throw coded('skill steps must have unique ids');
  const stepIds = new Set(normalizedSteps.map(step => step.id));
  if (normalizedSteps.some(step => step.requires.some(id => !stepIds.has(id)))) throw coded('skill step dependency is missing');
  const byId = new Map(normalizedSteps.map(step => [step.id, step]));
  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) throw coded('skill step dependency contains a cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).requires) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const step of normalizedSteps) visit(step.id);
  const checkpoints = Array.isArray(spec.checkpoints) ? spec.checkpoints : [];
  if (checkpoints.length > MAX_CHECKPOINTS) throw coded('too many skill checkpoints');
  const normalizedCheckpoints = checkpoints.map((checkpoint, index) => {
    if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) throw coded(`checkpoint ${index} is invalid`);
    return {
      id: boundedText(checkpoint.id, `checkpoint ${index} id`),
      label: boundedText(checkpoint.label, `checkpoint ${index} label`, 240),
    };
  });
  if (new Set(normalizedCheckpoints.map(checkpoint => checkpoint.id)).size !== normalizedCheckpoints.length) {
    throw coded('skill checkpoints must have unique ids');
  }
  return {
    skillId,
    skillVersion,
    input,
    steps: normalizedSteps,
    checkpoints: normalizedCheckpoints,
    modelPolicy: boundedJson(spec.modelPolicy, 'modelPolicy'),
    outputContract: boundedJson(spec.outputContract, 'outputContract'),
  };
}

export function buildSkillRunExecutionPlan(spec, { completedStepIds = [] } = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw stateError('skill run spec is invalid');
  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  const stepIds = new Set(steps.map(step => step?.id));
  if (!Array.isArray(completedStepIds)) throw stateError('completedStepIds must be an array');
  const completed = new Set();
  for (const id of completedStepIds) {
    if (typeof id !== 'string' || !stepIds.has(id) || completed.has(id)) throw stateError('completed step is invalid');
    completed.add(id);
  }
  const readyStepIds = [];
  const blockedStepIds = [];
  for (const step of steps) {
    if (completed.has(step.id)) continue;
    if (step.requires.every(dependency => completed.has(dependency))) readyStepIds.push(step.id);
    else blockedStepIds.push(step.id);
  }
  return {
    completedStepIds: steps.filter(step => completed.has(step.id)).map(step => step.id),
    readyStepIds,
    blockedStepIds,
    status: completed.size === steps.length ? 'complete' : readyStepIds.length ? 'ready' : 'blocked',
  };
}
