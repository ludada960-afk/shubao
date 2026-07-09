/**
 * 精确地在 server/index.mjs 中添加扩展路由
 * 使用行号定位，避免重复匹配
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'server', 'index.mjs');

const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

// 1) 在第 14 行后添加 import（第 14 行是 import sharp from 'sharp'）
const importLine = "import extensionRouter from './extensionRoutes.mjs';";
if (lines[13].includes("import sharp from 'sharp'")) {
  lines.splice(14, 0, importLine);
  console.log(`✅ 在第 14 行后添加 import`);
} else {
  console.error(`❌ 期望第 14 行是 import sharp，实际是: ${lines[13]}`);
  process.exit(1);
}

// 2) 在 // ===== 启动 前面添加路由挂载
// 寻找倒数第 15 行附近的 "// ===== 启动" 标记
const startMarker = '// ============================================================\n// 启动\n// ============================================================';
const markerIndex = lines.findIndex((l, i) =>
  i > lines.length - 25 && l.includes('// 启动')
);

if (markerIndex >= 0) {
  const mountLines = [
    '',
    '// ============================================================',
    '// 扩展端 API 路由',
    '// ============================================================',
    "app.use('/api/extension', extensionRouter);",
    '',
    '// 清理过期扩展任务（每小时）',
    'setInterval(async () => {',
    "  try { const { cleanExpiredTasks } = await import('./extensionTaskManager.mjs'); cleanExpiredTasks?.(); } catch {}",
    '}, 3600000);',
    '',
  ];
  lines.splice(markerIndex - 2, 0, ...mountLines);
  console.log(`✅ 在 ${markerIndex - 2} 行前添加路由挂载`);
} else {
  console.error(`❌ 未找到启动标记`);
  process.exit(1);
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log('✅ 写入完成');
