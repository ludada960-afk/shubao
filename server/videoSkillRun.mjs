const MAX_JSON_BYTES = 32_000;
const MAX_STEPS = 32;
const MAX_CHECKPOINTS = 16;
const MAX_GUARDS = 32;
const MAX_RETRY_KINDS = 12;
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

function normalizeExecutionPolicies(spec) {
  const output = {};
  if (spec.budgetPolicy !== undefined) {
    const policy = spec.budgetPolicy;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw coded('budgetPolicy must be an object');
    if (policy.currency !== 'ai_points') throw coded('budgetPolicy currency is invalid');
    const maxPoints = Number(policy.maxPoints);
    if (!Number.isSafeInteger(maxPoints) || maxPoints < 1 || maxPoints > 1_000_000) throw coded('budgetPolicy maxPoints is invalid');
    const reserveMode = policy.reserveMode === undefined ? 'approved_cap' : policy.reserveMode;
    if (!['approved_cap', 'per_step'].includes(reserveMode)) throw coded('budgetPolicy reserveMode is invalid');
    output.budgetPolicy = { currency: 'ai_points', maxPoints, reserveMode };
  }
  if (spec.retryPolicy !== undefined) {
    const policy = spec.retryPolicy;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw coded('retryPolicy must be an object');
    const maxAttemptsPerStep = policy.maxAttemptsPerStep === undefined ? 1 : Number(policy.maxAttemptsPerStep);
    if (!Number.isSafeInteger(maxAttemptsPerStep) || maxAttemptsPerStep < 1 || maxAttemptsPerStep > 3) throw coded('retryPolicy maxAttemptsPerStep is invalid');
    const retryableKinds = policy.retryableKinds === undefined ? [] : policy.retryableKinds;
    if (!Array.isArray(retryableKinds) || retryableKinds.length > MAX_RETRY_KINDS) throw coded('retryPolicy retryableKinds is invalid');
    const normalizedKinds = retryableKinds.map(value => boundedText(value, 'retryable kind', 64));
    if (new Set(normalizedKinds).size !== normalizedKinds.length) throw coded('retryPolicy retryableKinds must be unique');
    output.retryPolicy = { maxAttemptsPerStep, retryableKinds: normalizedKinds };
  }
  let guards = [];
  if (spec.guards !== undefined) {
    if (!Array.isArray(spec.guards) || spec.guards.length > MAX_GUARDS) throw coded('guards are invalid');
    guards = spec.guards.map((guard, index) => {
      if (!guard || typeof guard !== 'object' || Array.isArray(guard)) throw coded(`guard ${index} is invalid`);
      return {
        id: boundedText(guard.id, `guard ${index} id`),
        kind: boundedText(guard.kind, `guard ${index} kind`, 64),
        label: boundedText(guard.label, `guard ${index} label`, 240),
      };
    });
    if (new Set(guards.map(guard => guard.id)).size !== guards.length) throw coded('guards must have unique ids');
    output.guards = guards;
  }
  if (spec.compensation !== undefined) {
    const policy = spec.compensation;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw coded('compensation must be an object');
    const onProviderFailure = policy.onProviderFailure === undefined ? 'release_hold' : policy.onProviderFailure;
    const onPersistenceFailure = policy.onPersistenceFailure === undefined ? 'reconcile' : policy.onPersistenceFailure;
    if (!['release_hold', 'retry_or_release'].includes(onProviderFailure)) throw coded('compensation provider policy is invalid');
    if (!['reconcile', 'release_hold'].includes(onPersistenceFailure)) throw coded('compensation persistence policy is invalid');
    output.compensation = { onProviderFailure, onPersistenceFailure };
  }
  return { output, guardIds: new Set(guards.map(guard => guard.id)) };
}

export function normalizeSkillRunSpec(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw coded('skill spec must be an object');
  const skillId = boundedText(spec.skillId, 'skillId');
  const skillVersion = Number(spec.skillVersion);
  if (!Number.isSafeInteger(skillVersion) || skillVersion < 1) throw coded('skillVersion is invalid');
  const templateId = spec.templateId === undefined ? '' : boundedText(spec.templateId, 'templateId');
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
    const guards = step.guards === undefined ? [] : step.guards;
    if (!Array.isArray(guards) || guards.length > MAX_GUARDS) throw coded(`step ${index} guards are invalid`);
    const normalizedGuards = guards.map(value => boundedText(value, `step ${index} guard`, MAX_ID));
    if (new Set(normalizedGuards).size !== normalizedGuards.length) throw coded(`step ${index} has duplicate guards`);
    return { id, kind, label, requires, ...(step.guards === undefined ? {} : { guards: normalizedGuards }) };
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
  const policies = normalizeExecutionPolicies(spec);
  if (normalizedSteps.some(step => (step.guards || []).some(id => !policies.guardIds.has(id)))) {
    throw coded('step guard is not declared');
  }
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
    ...(templateId ? { templateId } : {}),
    input,
    steps: normalizedSteps,
    checkpoints: normalizedCheckpoints,
    modelPolicy: boundedJson(spec.modelPolicy, 'modelPolicy'),
    outputContract: boundedJson(spec.outputContract, 'outputContract'),
    ...policies.output,
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

export function buildSkillRunExecutionPreview(spec, {
  completedStepIds = [],
  satisfiedGuardIds = [],
  stepCosts = {},
} = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw stateError('skill run spec is invalid');
  if (!stepCosts || typeof stepCosts !== 'object' || Array.isArray(stepCosts)) throw stateError('stepCosts must be an object');
  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  const plan = buildSkillRunExecutionPlan(spec, { completedStepIds });
  if (!Array.isArray(satisfiedGuardIds) || satisfiedGuardIds.some(id => typeof id !== 'string')) {
    throw stateError('satisfiedGuardIds must be an array of strings');
  }
  const guardIds = new Set((Array.isArray(spec.guards) ? spec.guards : []).map(guard => guard.id));
  const satisfied = new Set(satisfiedGuardIds);
  if (satisfied.size !== satisfiedGuardIds.length || [...satisfied].some(id => !guardIds.has(id))) {
    throw stateError('satisfied guard is invalid');
  }
  for (const id of Object.keys(stepCosts)) {
    if (!steps.some(step => step.id === id)) throw stateError('step cost is not declared');
    const cost = Number(stepCosts[id]);
    if (!Number.isSafeInteger(cost) || cost < 0 || cost > 1_000_000) throw stateError('step cost is invalid');
  }
  const completed = new Set(plan.completedStepIds);
  const guardBlockedStepIds = [];
  const readyStepIds = [];
  const blockedStepIds = [];
  for (const step of steps) {
    if (completed.has(step.id)) continue;
    const missingGuard = (step.guards || []).some(id => !satisfied.has(id));
    if (missingGuard) guardBlockedStepIds.push(step.id);
    const dependenciesReady = step.requires.every(dependency => completed.has(dependency));
    if (!missingGuard && dependenciesReady) readyStepIds.push(step.id);
    if (!dependenciesReady) blockedStepIds.push(step.id);
  }
  const remainingSteps = steps.filter(step => !completed.has(step.id));
  const baseEstimatedPoints = remainingSteps
    .reduce((total, step) => total + (Number(stepCosts[step.id]) || 0), 0);
  const retryPolicy = spec.retryPolicy;
  const retryableKinds = Array.isArray(retryPolicy?.retryableKinds) ? [...retryPolicy.retryableKinds] : [];
  const maxAttemptsPerStep = Number.isSafeInteger(retryPolicy?.maxAttemptsPerStep)
    ? retryPolicy.maxAttemptsPerStep : 1;
  const retryEnabled = retryableKinds.length > 0 && maxAttemptsPerStep > 1;
  const retryAllowancePoints = retryEnabled
    ? baseEstimatedPoints * (maxAttemptsPerStep - 1)
    : 0;
  const estimatedPoints = baseEstimatedPoints + retryAllowancePoints;
  const maxPoints = Number.isSafeInteger(spec.budgetPolicy?.maxPoints) ? spec.budgetPolicy.maxPoints : null;
  const withinLimit = maxPoints === null || estimatedPoints <= maxPoints;
  const remainingPoints = maxPoints === null ? null : Math.max(0, maxPoints - estimatedPoints);
  const status = completed.size === steps.length ? 'complete' : readyStepIds.length && withinLimit ? 'ready' : 'blocked';
  const preview = {
    completedStepIds: plan.completedStepIds,
    readyStepIds,
    blockedStepIds,
    guardBlockedStepIds,
    estimatedPoints,
    budget: { maxPoints, remainingPoints, withinLimit },
    status,
  };
  if (spec.retryPolicy !== undefined || spec.compensation !== undefined) {
    preview.baseEstimatedPoints = baseEstimatedPoints;
    preview.retryAllowancePoints = retryAllowancePoints;
    preview.executionPolicy = {
      retry: {
        enabled: retryEnabled,
        maxAttemptsPerStep,
        retryableKinds,
        appliesToStepIds: retryEnabled ? remainingSteps.map(step => step.id) : [],
      },
      compensation: {
        onProviderFailure: spec.compensation?.onProviderFailure || 'release_hold',
        onPersistenceFailure: spec.compensation?.onPersistenceFailure || 'reconcile',
      },
    };
  }
  return preview;
}
