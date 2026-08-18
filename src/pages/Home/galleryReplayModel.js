const cleanText = value => typeof value === 'string' ? value.trim() : '';

export function mergeGalleryReplayPrompts(items = [], promptEntries = []) {
  const promptsById = new Map(
    (Array.isArray(promptEntries) ? promptEntries : [])
      .map(entry => [cleanText(entry?.id), cleanText(entry?.prompt)])
      .filter(([id, prompt]) => id && prompt),
  );

  return (Array.isArray(items) ? items : []).map(item => {
    const prompt = promptsById.get(cleanText(item?.id));
    return prompt ? { ...item, prompt, promptOnlyReplay: true } : item;
  });
}
