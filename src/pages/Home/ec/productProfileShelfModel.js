import {
  applyProductProfileToEditor,
  buildProductProfileDraft,
} from './productProfileModel.js';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function editorPayload(editor = {}) {
  return {
    description: editor.description,
    productName: editor.productName,
    product_name: editor.product_name,
    category: editor.category,
    productParams: editor.productParams,
    skus: editor.skus,
    copywriting: editor.copywriting,
    productImages: editor.productImages,
    referenceImages: editor.referenceImages,
    roleImages: editor.roleImages,
  };
}

export function buildProductProfileSaveRequest({ draftId, editor, saveNonce = 0 } = {}) {
  const draft = buildProductProfileDraft(editorPayload(editor));
  const normalizedDraftId = text(draftId).slice(0, 120) || 'new';
  const keyName = text(draft.name).slice(0, 160) || '未命名商品';
  const normalizedNonce = Number.isSafeInteger(saveNonce) && saveNonce > 0 ? `:${saveNonce}` : '';
  return {
    ...draft,
    idempotencyKey: `product-profile:${normalizedDraftId}:${keyName}${normalizedNonce}`.slice(0, 200),
  };
}

export function applyProductProfileToEcState(profile, editor = {}) {
  const next = applyProductProfileToEditor(profile, editorPayload(editor));
  return {
    ...editor,
    description: next.description,
    productParams: next.productParams,
    skus: next.skus,
    copywriting: next.copywriting || editor.copywriting,
  };
}

export function profileStatusLabel(status) {
  if (status === 'active') return '使用中';
  if (status === 'archived') return '已归档';
  return '状态未知';
}
