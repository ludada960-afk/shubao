export function shouldShowNoteModal({ page, result } = {}) {
  if (!result || result._ecResult) return false;
  return page !== 'ec-canvas';
}
