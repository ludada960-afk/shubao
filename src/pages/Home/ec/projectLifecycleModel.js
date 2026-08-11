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
  abilityRecipe: null,
  personMode: 'smart',
  roleImages: Object.freeze({ items: Object.freeze([]), person: Object.freeze([]), scene: Object.freeze([]) }),
  unmappedImages: Object.freeze([]),
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
  if (source.ability_recipe && typeof source.ability_recipe === 'object' && !Array.isArray(source.ability_recipe)) {
    editor.abilityRecipe = clone(source.ability_recipe);
  } else if (source.abilityRecipe && typeof source.abilityRecipe === 'object' && !Array.isArray(source.abilityRecipe)) {
    editor.abilityRecipe = clone(source.abilityRecipe);
  }
  if (source.person_mode === 'reference' || source.personMode === 'reference') {
    editor.personMode = 'reference';
  }
  if (source.roleImages && typeof source.roleImages === 'object' && !Array.isArray(source.roleImages)) {
    editor.roleImages = {
      items: Array.isArray(source.roleImages.items) ? clone(source.roleImages.items) : [],
      person: Array.isArray(source.roleImages.person) ? clone(source.roleImages.person) : [],
      scene: Array.isArray(source.roleImages.scene) ? clone(source.roleImages.scene) : [],
    };
  } else if (source.assets && typeof source.assets === 'object' && !Array.isArray(source.assets)) {
    editor.roleImages = {
      items: Array.isArray(source.assets.items) ? clone(source.assets.items) : [],
      person: Array.isArray(source.assets.person) ? clone(source.assets.person) : [],
      scene: Array.isArray(source.assets.scene) ? clone(source.assets.scene) : [],
    };
  }
  if (Array.isArray(source.unmappedImages)) editor.unmappedImages = clone(source.unmappedImages);
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
