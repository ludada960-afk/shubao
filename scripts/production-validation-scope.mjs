import { pathToFileURL } from 'node:url';

const FRONTEND_ONLY_PATTERNS = Object.freeze([
  /^src\/App\.jsx$/,
  /^src\/components\/layout\//,
  /^src\/components\/ui\//,
  /^src\/styles\//,
  /^src\/constants\//,
  /^public\/images\//,
  /^test\//,
  /^docs\//,
]);

const FULL_GATE_PATTERNS = Object.freeze([
  /^server\//,
  /^shared\//,
  /^scripts\//,
  /^src\/services\//,
  /^src\/store\//,
  /^src\/pages\/EcCanvas\//,
  /^src\/pages\/VideoStudio\//,
  /^src\/pages\/Plog\//,
  /^src\/pages\/Remake\//,
  /^src\/pages\/Home\/EcMode\.jsx$/,
  /^src\/pages\/Home\/ec\//,
  /^src\/pages\/Home\/XhsContentMode\.jsx$/,
  /^src\/pages\/Home\/VisualCreationMode\.jsx$/,
  /^src\/pages\/Home\/visualCreationModel\.js$/,
  /^src\/pages\/Home\/index\.jsx$/,
  /^package(?:-lock)?\.json$/,
  /^ecosystem(?:\.production)?\.config\.cjs$/,
  /^vite\.config\.js$/,
]);

function normalizePath(file) {
  return String(file || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

export function classifyProductionValidation(files = []) {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))];
  if (!normalized.length) return 'full';
  if (normalized.some(file => FULL_GATE_PATTERNS.some(pattern => pattern.test(file)))) return 'full';
  if (normalized.every(file => FRONTEND_ONLY_PATTERNS.some(pattern => pattern.test(file)))) return 'frontend';
  return 'full';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const marker = process.argv.indexOf('--files');
  const files = marker >= 0 ? process.argv.slice(marker + 1) : [];
  process.stdout.write(`${classifyProductionValidation(files)}\n`);
}
