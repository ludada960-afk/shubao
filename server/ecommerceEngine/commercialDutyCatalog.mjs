function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalDutySegment(value) {
  return cleanString(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function commercialDutyIdFor(role, dutyKey) {
  const roleKey = canonicalDutySegment(role) || 'asset';
  const normalizedDutyKey = canonicalDutySegment(dutyKey);
  if (!normalizedDutyKey) throw new TypeError(`commercial duty key is required for ${roleKey}`);
  return `${roleKey}:${normalizedDutyKey}`;
}

export const HERO_DUTIES = Object.freeze([
  Object.freeze({ key: 'productrecognition', goal: 'Establish immediate complete-product recognition.', purpose: 'Product identity and recognition hero: show one unmistakable complete product.' }),
  Object.freeze({ key: 'primarybenefit', goal: 'Communicate one primary buyer benefit supported by Product Truth.', purpose: 'Primary feature or benefit hero: visualize one evidence-supported buying reason while keeping the product dominant.' }),
  Object.freeze({ key: 'usagecontext', goal: 'Clarify credible use context without inventing product facts.', purpose: 'Usage or context hero: show one credible setting that helps the buyer understand the product without unsupported claims.' }),
  Object.freeze({ key: 'structureunderstanding', goal: 'Explain evidence-supported visible exterior structure.', purpose: 'Structural hero: explain a visible exterior relationship without inventing hidden components.' }),
  Object.freeze({ key: 'materialcraft', goal: 'Demonstrate visible material and craftsmanship quality.', purpose: 'Material and craftsmanship hero: focus on one premium visible finish without becoming a multi-panel detail sheet.' }),
]);

export const LEGACY_HERO_DUTIES = Object.freeze([
  ...HERO_DUTIES,
  Object.freeze({ key: 'visibleoperation', goal: 'Make visible controls and handling points easy to understand.', purpose: 'Visible operation hero: clarify evidence-supported controls or handling points without exposing hidden structure.' }),
]);

export const WHITE_BACKGROUND_DUTIES = Object.freeze([
  Object.freeze({ key: 'catalogrecognition', goal: 'Provide marketplace-ready complete-product catalog recognition on white.', purpose: 'Marketplace-compliant hero isolation: center the complete product on pure white for primary catalog recognition.' }),
  Object.freeze({ key: 'shapeverification', goal: 'Verify the complete exterior shape and silhouette on white.', purpose: 'Evidence-safe alternate-angle isolation: show the complete exterior on pure white for shape verification.' }),
  Object.freeze({ key: 'featureinspection', goal: 'Make visible exterior controls and features easy to inspect on white.', purpose: 'White-background feature inspection: keep one complete product isolated while making visible exterior features legible.' }),
  Object.freeze({ key: 'finishinspection', goal: 'Support inspection of visible material and finish on white.', purpose: 'White-background finish inspection: isolate one complete product and preserve visible material evidence.' }),
]);

export const TRANSPARENT_DUTIES = Object.freeze([
  Object.freeze({ key: 'reusableidentity', goal: 'Provide a reusable transparent complete-product identity asset.', purpose: 'Primary transparent cutout: isolate the complete recognition view for reusable PNG placement.' }),
  Object.freeze({ key: 'layoutflexibility', goal: 'Provide a transparent complete-product asset for flexible campaign placement.', purpose: 'Alternate-angle transparent cutout: isolate a complete evidence-supported exterior for layout flexibility.' }),
  Object.freeze({ key: 'featurecallout', goal: 'Support isolated exterior-feature communication in downstream layouts.', purpose: 'Transparent feature cutout: preserve one complete product while supporting an exterior-feature callout.' }),
  Object.freeze({ key: 'channelreuse', goal: 'Provide a transparent complete-product asset for cross-channel reuse.', purpose: 'Transparent channel cutout: isolate one complete product for safe reuse across approved placements.' }),
]);
