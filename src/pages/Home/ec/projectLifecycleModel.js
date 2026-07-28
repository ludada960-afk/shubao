const EMPTY_PRODUCT_PARAMS = Object.freeze({
  category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '',
});

export const EMPTY_ECOMMERCE_EDITOR = Object.freeze({
  description: '',
  platform: 'smart',
  sizing: Object.freeze({ smart: true, images: Object.freeze([]) }),
  styleSkill: 'smart',
  customColors: null,
  productParams: EMPTY_PRODUCT_PARAMS,
  skus: Object.freeze([]),
  copywriting: Object.freeze({ plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' }),
  genSettings: Object.freeze({ resolution: '2K', negativePrompt: '' }),
  productImages: Object.freeze([]),
  referenceImages: Object.freeze([]),
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function freshEditorState() {
  return clone(EMPTY_ECOMMERCE_EDITOR);
}

export function selectInitialEditor() {
  return freshEditorState();
}

function checkpointSnapshot(checkpoint) {
  const value = checkpoint?.version?.inputSnapshot
    || checkpoint?.inputSnapshot
    || checkpoint?.payload
    || {};
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function restoreCheckpointIntoEditor(checkpoint) {
  const source = checkpointSnapshot(checkpoint);
  const editor = freshEditorState();
  const scalarFields = ['description', 'platform', 'styleSkill'];
  scalarFields.forEach(key => {
    if (typeof source[key] === 'string') editor[key] = source[key];
  });
  const objectFields = ['sizing', 'productParams', 'copywriting', 'genSettings'];
  objectFields.forEach(key => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      editor[key] = clone(source[key]);
    }
  });
  if (Array.isArray(source.skus)) editor.skus = clone(source.skus);
  if (Array.isArray(source.productImages)) editor.productImages = clone(source.productImages);
  if (Array.isArray(source.referenceImages)) editor.referenceImages = clone(source.referenceImages);
  if (Array.isArray(source.customColors) || source.customColors === null) editor.customColors = clone(source.customColors);
  return editor;
}

export async function beginDurableProject({
  kind,
  title,
  inputSnapshot,
  planSnapshot = {},
  idempotencyKey,
  createProject,
  createVersion,
} = {}) {
  if (typeof createProject !== 'function' || typeof createVersion !== 'function') {
    throw new TypeError('project clients are required');
  }
  const created = await createProject({ kind, title, idempotencyKey });
  const project = created?.project || created;
  if (!project?.id) throw new Error('项目创建失败，请稍后重试');
  const versionResult = await createVersion(project.id, {
    reason: 'generation',
    inputSnapshot: clone(inputSnapshot || {}),
    planSnapshot: clone(planSnapshot || {}),
  });
  const version = versionResult?.version || versionResult;
  if (!version?.id) throw new Error('项目版本创建失败，请稍后重试');
  return { project, version };
}

export async function discardLegacyDraftState(cleanups = []) {
  const results = await Promise.allSettled(
    (Array.isArray(cleanups) ? cleanups : []).filter(item => typeof item === 'function').map(item => item()),
  );
  return {
    cleared: results.filter(item => item.status === 'fulfilled').length,
    failed: results.filter(item => item.status === 'rejected').length,
  };
}

export async function completeCreationCycle({ output, archiveOutput, clearRecovery } = {}) {
  if (typeof archiveOutput === 'function') await archiveOutput(output);
  if (typeof clearRecovery === 'function') await clearRecovery();
  return { editor: freshEditorState() };
}
