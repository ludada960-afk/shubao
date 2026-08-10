const VISUAL_SKILL_IDS = new Set(['free', 'poster', 'social-cover', 'brand-kv']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCreationIntent(value) {
  return cleanString(value).toLowerCase() === 'visual' ? 'visual' : 'ecommerce';
}

export function normalizeVisualSkillId(value) {
  const normalized = cleanString(value).toLowerCase();
  return VISUAL_SKILL_IDS.has(normalized) ? normalized : 'free';
}

const VISUAL_SKILL_INSTRUCTIONS = Object.freeze({
  free: 'Create an original, polished visual that follows the requested subject, relationship, mood, composition, and constraints. Make every choice intentional and coherent.',
  poster: 'Create a polished poster composition with clear visual hierarchy, one intentional focal point, balanced negative space, and readable zones for any requested text. Do not invent extra copy or brand claims.',
  'social-cover': 'Create a high-impact social media cover that remains immediately understandable at mobile thumbnail size. Keep a strong focal point and a safe, readable title area without inventing extra copy.',
  'brand-kv': 'Create a refined brand key visual with a coherent and extendable system of composition, materials, lighting, palette, and atmosphere. Preserve supplied brand and subject identity exactly.',
});

export function buildCanvasGenerationPrompt({
  creationIntent,
  skillId,
  userPrompt,
  hasImageInputs,
  referenceNote = '',
  mentionNote = '',
} = {}) {
  const prompt = cleanString(userPrompt);
  if (normalizeCreationIntent(creationIntent) !== 'visual') {
    return hasImageInputs
      ? `Create a polished ecommerce product visual. Preserve the supplied product identity and structure.${referenceNote}${mentionNote} ${prompt}`
      : `Create a polished ecommerce visual from the user's instructions. ${prompt}`;
  }

  const normalizedSkillId = normalizeVisualSkillId(skillId);
  const sourceInstruction = hasImageInputs
    ? 'Preserve the recognizable identity, defining structure, and user-specified relationships of the supplied subjects. Treat references as evidence, not permission to replace or distort them.'
    : 'Construct every subject from the user instructions without adding unsupported brand, product, or factual claims.';
  return [
    `Visual creation recipe: ${normalizedSkillId}.`,
    sourceInstruction,
    cleanString(referenceNote),
    cleanString(mentionNote),
    VISUAL_SKILL_INSTRUCTIONS[normalizedSkillId],
    `User request: ${prompt}`,
  ].filter(Boolean).join(' ');
}
