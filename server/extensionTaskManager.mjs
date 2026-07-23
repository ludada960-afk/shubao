/**
 * 薯包AI 插件后端 - 任务管理器
 *
 * 管理扩展端发起的「采集→下载→分析→生成」全链路任务
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = path.resolve(__dirname, 'extension_tasks');

if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });

/* ── 内存中的任务缓存（加速读取） ── */
const taskCache = new Map();

function taskFile(taskId) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(taskId))) return null;
  return path.join(TASKS_DIR, `${taskId}.json`);
}

function persistTask(task) {
  const filePath = taskFile(task.taskId);
  if (!filePath) throw new Error('invalid task id');
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(task, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

/* ── 任务状态枚举 ── */
export const TASK_STATUS = {
  PENDING:       'pending',       // 已接收，等待处理
  DOWNLOADING:   'downloading',    // 正在下载原图
  DOWNLOADED:    'downloaded',     // 原图下载完成
  ANALYZING:     'analyzing',      // AI 视觉分析中
  ANALYZED:      'analyzed',       // 分析完成，等待用户操作
  GENERATING:    'generating',     // 用户提交替换信息，生成中
  COMPLETED:     'completed',      // 所有图片生成完毕
  FAILED:        'failed',         // 失败
};

/* ── 创建任务 ── */
export function createTask(data) {
  const taskId = `ext_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const task = {
    taskId,
    status: TASK_STATUS.PENDING,
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    // 来自扩展的输入
    images: data.images || [],       // 图片 URL 数组
    title: data.title || '',         // 商品标题
    platform: data.platform || '',   // 来源平台
    pageUrl: data.pageUrl || '',     // 原始页面 URL
    ratios: data.ratios || [],       // 图片比例

    // 下载后的本地路径
    downloadedImages: [],             // [{ url, localPath, width, height }]
    downloadErrors: [],               // 下载失败的 URL

    // AI 分析结果
    analysis: null,                   // { images: [{ url, index, subject, layout, lighting, background, colors, text }] }

    // 用户替换信息
    userProduct: null,                // { productName, category, sellingPoints, referenceImages }

    // 生成结果
    generatedImages: [],              // [{ role, style, url, group }]

    // 错误信息
    error: null,
  };

  persistTask(task);
  taskCache.set(taskId, task);
  return taskId;
}

/* ── 获取任务 ── */
export function getTask(taskId) {
  if (taskCache.has(taskId)) return taskCache.get(taskId);

  const filePath = taskFile(taskId);
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    taskCache.set(taskId, data);
    return data;
  } catch {
    return null;
  }
}

/* ── 更新任务 ── */
export function updateTask(taskId, updates) {
  const task = getTask(taskId);
  if (!task) return;

  Object.assign(task, updates, { updatedAt: Date.now() });
  persistTask(task);
  taskCache.set(taskId, task);
  return task;
}

/* ── 获取下一个待处理任务 ── */
export function getNextPendingTask(status = TASK_STATUS.PENDING) {
  const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const task = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8'));
      if (task.status === status) return task;
    } catch { /* skip corrupt files */ }
  }
  return null;
}

/* ── 清理过期任务（>24h） ── */
export function cleanExpiredTasks() {
  const now = Date.now();
  const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(TASKS_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        const task = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // 清理下载的临时图片
        if (task.downloadedImages) {
          for (const img of task.downloadedImages) {
            if (img.localPath && fs.existsSync(img.localPath)) {
              fs.unlinkSync(img.localPath);
            }
          }
        }
        fs.unlinkSync(filePath);
        taskCache.delete(task.taskId);
      }
    } catch { /* skip */ }
  }
}

// 进程异常退出后，避免任务永久停留在“处理中”。下次启动将其标记为可重试失败。
export function recoverStaleTasks(maxAgeMs = 30 * 60 * 1000) {
  const now = Date.now();
  const active = new Set([
    TASK_STATUS.DOWNLOADING,
    TASK_STATUS.ANALYZING,
    TASK_STATUS.GENERATING,
  ]);
  for (const file of fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const filePath = path.join(TASKS_DIR, file);
      const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (active.has(task.status) && now - (task.updatedAt || 0) > maxAgeMs) {
        updateTask(task.taskId, {
          status: TASK_STATUS.FAILED,
          error: '任务所在进程异常退出，请重新提交',
        });
      }
    } catch { /* 损坏任务由后续清理流程处理 */ }
  }
}

recoverStaleTasks();
const taskCleanupTimer = setInterval(() => {
  recoverStaleTasks();
  cleanExpiredTasks();
}, 60 * 60 * 1000);
taskCleanupTimer.unref();
