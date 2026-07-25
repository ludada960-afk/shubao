export async function consumeSseJson(reader, onEvent = () => {}) {
  if (!reader?.read) throw new Error('SSE reader is unavailable');
  const decoder = new TextDecoder();
  let buffer = '';
  let eventCount = 0;

  const consumeLines = async (text, flush = false) => {
    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = flush ? '' : (lines.pop() || '');
    if (!flush && lines.length === 0) return;
    if (flush && lines.length === 1 && !lines[0]) return;
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let event;
      try { event = JSON.parse(raw); } catch (error) {
        throw new Error(`SSE 数据格式错误：${error.message}`);
      }
      await onEvent(event);
      eventCount += 1;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await consumeLines(decoder.decode(value, { stream: true }));
  }
  await consumeLines(decoder.decode(), true);
  return eventCount;
}
