const RUNTIME_PREFIXES = [
  'cache_img/',
  'cache_overlay/',
  'uploads/',
  'generated-assets/',
  'extension_downloads/',
  'extension_tasks/',
  'prompts/',
];

const RUNTIME_FILES = new Set([
  'works.db',
  'works.json',
  'users.json',
  'bookmarklet_store.json',
]);

export function normalizeRuntimePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\/+/, '');
}

export function isRuntimePathIgnored(value) {
  const path = normalizeRuntimePath(value);
  return RUNTIME_FILES.has(path) || RUNTIME_PREFIXES.some((prefix) => path.startsWith(prefix));
}
