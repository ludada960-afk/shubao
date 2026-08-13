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
  free: 'Create an original, polished visual that follows the requested subject, relationship, mood, composition, and constraints. Establish a clear focal hierarchy, believable spatial depth, deliberate lighting, and a coherent palette. Make every choice intentional and avoid generic filler.',
  poster: 'Create a publication-ready poster with one intentional focal point, decisive visual hierarchy, disciplined typography, balanced negative space, and a clear reading order. Render every requested title or short text exactly as supplied and keep it legible. Do not invent extra copy, dates, prices, logos, or brand claims.',
  'social-cover': 'Create a high-impact platform-aware social media cover that remains immediately understandable at mobile thumbnail size. Use a strong focal point, compact composition, and safe title zones appropriate to the requested platform. Render requested title text exactly as supplied and legibly; never omit it or invent extra copy.',
  'brand-kv': 'Create a refined campaign system, not an isolated decorative image: use coherent composition, materials, lighting, palette, and graphic rhythm that can extend across formats. Preserve supplied brand identity, product geometry, proportions, labels, colors, and defining details exactly while building a distinctive brand world around them.',
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
