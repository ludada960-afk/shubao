const COMPLETE_DATA_URL = /data:[a-z][a-z0-9.+-]*\/[a-z0-9.+-]+(?:;[^,\s"'<>]+)*,[^\s"'<>]+/i;
const COMPLETE_BLOB_URL = /blob:(?:https?:\/\/)?[^\s"'<>]+/i;
const BASE64_TEXT = /^[a-z0-9+/_-]+={0,2}$/i;

function startsWith(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes, offset, value) {
  if (bytes.length < offset + value.length) return false;
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function hasImageMagic(bytes) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return true;
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) return true;
  if (asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')) return true;
  if (startsWith(bytes, [0x42, 0x4d])) return true;
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return true;
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return true;
  return asciiAt(bytes, 4, 'ftyp')
    && ['avif', 'avis', 'heic', 'heix', 'mif1'].some(brand => asciiAt(bytes, 8, brand));
}

function decodedImageMagic(value) {
  const compact = value.replace(/\s+/g, '');
  if (!compact || !BASE64_TEXT.test(compact) || compact.length % 4 === 1) return false;
  const normalized = compact.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const decoded = globalThis.atob?.(padded.slice(0, 64));
    if (typeof decoded !== 'string') return false;
    return hasImageMagic(Uint8Array.from(decoded, character => character.charCodeAt(0)));
  } catch {
    return false;
  }
}

export function containsUnsafeImagePayload(value) {
  if (typeof value !== 'string') return false;
  return COMPLETE_DATA_URL.test(value)
    || COMPLETE_BLOB_URL.test(value)
    || decodedImageMagic(value);
}
