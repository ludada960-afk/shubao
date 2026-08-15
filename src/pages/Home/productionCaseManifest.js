const clean = value => typeof value === 'string' ? value.trim() : '';

function requiredText(value, path) {
  const normalized = clean(value);
  if (!normalized) throw new Error(`${path} is required`);
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function validateProductionCaseManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest is required');

  requiredText(manifest.id, 'id');
  requiredText(manifest.title, 'title');
  requiredText(manifest.category, 'category');
  requiredText(manifest.prompt, 'prompt');

  if (!Array.isArray(manifest.sourceAssets)) throw new Error('sourceAssets must be an array');
  manifest.sourceAssets.forEach((source, index) => {
    requiredText(source?.role, `sourceAssets[${index}].role`);
    requiredText(source?.url, `sourceAssets[${index}].url`);
    requiredText(source?.name, `sourceAssets[${index}].name`);
  });

  if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
    throw new Error('outputs must contain at least one image');
  }
  manifest.outputs.forEach((output, index) => {
    requiredText(output?.id, `outputs[${index}].id`);
    requiredText(output?.role, `outputs[${index}].role`);
    requiredText(output?.title, `outputs[${index}].title`);
    requiredText(output?.prompt, `outputs[${index}].prompt`);
    requiredText(output?.url, `outputs[${index}].url`);
    requiredText(output?.taskId, `outputs[${index}].taskId`);
    requiredText(output?.requestKey, `outputs[${index}].requestKey`);
    requiredText(output?.ratio, `outputs[${index}].ratio`);
  });

  if (!manifest.cover || !['mosaic', 'single', 'auto'].includes(manifest.cover.strategy)) {
    throw new Error('cover.strategy must be mosaic, single, or auto');
  }
  if (!Array.isArray(manifest.cover.outputIds)) throw new Error('cover.outputIds must be an array');

  requiredText(manifest.remix?.mode, 'remix.mode');
  requiredText(manifest.remix?.prompt, 'remix.prompt');
  if (!Array.isArray(manifest.remix?.sourceAssetRoles)) {
    throw new Error('remix.sourceAssetRoles must be an array');
  }

  return deepFreeze(manifest);
}

export function manifestOutputsToGalleryImages(manifest) {
  return validateProductionCaseManifest(manifest).outputs.map(output => ({
    ...output,
    label: output.label || output.title,
    src: output.src || output.url,
    provenance: output.provenance || 'production',
  }));
}
