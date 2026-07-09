/**
 * Prompt 热加载器
 * 从 prompts/ 目录读取 Markdown 文件，支持运行时热更新
 * 修改 prompt 文件后无需重启服务器
 */
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, 'prompts');

// 缓存 + 文件修改时间检测
const cache = {};

/**
 * 读取 prompt 文件，自动检测修改并热更新
 * @param {string} name - 文件名（不含路径，如 'content-analysis-system.md'）
 * @returns {string} prompt 内容
 */
export function loadPrompt(name) {
  const filePath = resolve(PROMPTS_DIR, name);

  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;

    // 缓存命中且未修改
    if (cache[name] && cache[name].mtime === mtime) {
      return cache[name].content;
    }

    // 读取并缓存
    const content = fs.readFileSync(filePath, 'utf8').trim();
    cache[name] = { content, mtime };

    if (cache[name]?.mtime !== mtime) {
      console.log(`[prompt] 🔄 已加载: ${name} (${content.length} chars)`);
    }

    return content;
  } catch (e) {
    console.error(`[prompt] ❌ 读取失败: ${name}`, e.message);
    // 如果有缓存则降级返回旧内容
    if (cache[name]) {
      console.warn(`[prompt] ⚠️ 降级使用缓存: ${name}`);
      return cache[name].content;
    }
    return '';
  }
}

/**
 * 便捷方法：读取 prompt 并替换变量
 * @param {string} name - 文件名
 * @param {Object} vars - 变量替换 { key: value }，替换 {{key}}
 */
export function loadPromptWithVars(name, vars = {}) {
  let content = loadPrompt(name);
  for (const [key, val] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
  }
  return content;
}

/**
 * 列出所有可用的 prompt 文件
 */
export function listPrompts() {
  try {
    return fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/**
 * 清除缓存（强制下次读取时重新加载文件）
 */
export function clearPromptCache() {
  Object.keys(cache).forEach(k => delete cache[k]);
  console.log('[prompt] 缓存已清除');
}
