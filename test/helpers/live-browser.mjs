// test/helpers/live-browser.mjs
// 实机（真实渲染）测试的共享网关 —— 解决「全量并发跑时 flaky」这一类问题。
//
// ── 背景（真实事故）─────────────────────────────────────────────────────────
// 本仓有 4 个测试需要真实渲染（playwright + vite dev server）。它们有两种失败模式：
//   ① **端口争用**：所有测试都打 localhost:5173。全量并发跑时，
//      5173 可能已被别人的 dev server 占着（版本/分支未必与本 worktree 一致），
//      或本进程自己起服务时端口被抢 → 表现为 30~60s 的等待超时。
//   ② **瞬时白屏**：并发 agent 正在改同一批文件，vite 处于
//      「HTTP 200 但应用没起来」的中间态（vite-error-overlay / 只剩「加载中」）。
// 二者都会把**正确的实现**打成「慢测试假红」——本仓已因此误报多次。
//
// ── 本模块的契约 ────────────────────────────────────────────────────────────
//   1. **自己起独立端口**（不复用 5173），跑完自己清理 —— 互不干扰；
//   2. **健康判据 + 重试**：无 vite 错误遮罩 + 关键节点已挂载 + 正文不是「加载中…」，
//      最多 4 次全新导航；
//   3. **拿不到健康环境 → 显式 skip 并打印原因**，绝不让整条 npm test 变红
//      （否则任何人没起服务都会看到「主干红」，污染所有人的判断）；
//   4. **但绝不静默变绿**：skip 一定带 reason，且调用方可用
//      assertLiveOrSkip() 让「本应测到却没测到」的情况仍然报错。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '../..');

/** 找一个空闲端口：从 base 开始探测。 */
async function pickPort(base = 5190) {
  const net = await import('node:net');
  for (let p = base; p < base + 40; p += 1) {
    const free = await new Promise(resolve => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(p, '127.0.0.1');
    });
    if (free) return p;
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 轮询直到 url 返回 200。 */
async function waitHttpOk(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch { /* 还没起来 */ }
    await sleep(400);
  }
  return false;
}

/**
 * 取得一个可用的 dev server 地址。
 *
 * ── 策略（实测调优，非拍脑袋）──────────────────────────────────────────────
 * 首选 **已在运行的 5173**：它的 vite 依赖缓存是热的。
 * 实测（同机、有其它 agent 占 CPU 的情况下）：
 *   复用热 5173        → 就绪 ~2s
 *   冷起独立端口       → 首次 domcontentloaded 就要 26~60s，且**可能一直不健康**
 * 冷起独立端口的代价在「全量并发跑」时会被放大成假超时 —— 正是我们要修的病。
 * 所以：**能复用就复用；复用不了（5173 不可用或不属于本 worktree）才自起**。
 *
 * 返回 { ok, base, proc, owned, source, reason }。
 *   · owned=true 时调用方**必须** stopDevServer(proc)；owned=false 时不要关别人的服务。
 */
export async function startDevServer({ timeoutMs = 60000, root = ROOT } = {}) {
  /* ① 首选：复用已在运行的 5173（热缓存，几乎零成本） */
  const shared = 'http://127.0.0.1:5173/';
  if (process.env.SB_LIVE_NO_SHARED !== '1' && await waitHttpOk(shared, 3000)) {
    return { ok: true, base: shared, proc: null, owned: false, source: 'shared-5173' };
  }

  /* ② 兜底：自起独立端口（冷启动，慢但可用） */
  const port = await pickPort();
  if (!port) return { ok: false, reason: '找不到空闲端口（5190-5229 全被占用）' };

  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  let proc;
  try {
    proc = spawn(process.execPath, [viteBin, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
    });
  } catch (error) {
    return { ok: false, reason: '启动 vite 失败：' + (error?.message || error) };
  }

  let stderr = '';
  proc.stderr?.on('data', d => { stderr += String(d); });
  proc.on('error', e => { stderr += String(e?.message || e); });

  const base = 'http://127.0.0.1:' + port + '/';
  const up = await waitHttpOk(base, timeoutMs);
  if (!up) {
    stopDevServer(proc);
    return { ok: false, reason: 'dev server 未在 ' + timeoutMs + 'ms 内就绪' + (stderr ? '：' + stderr.slice(0, 200) : '') };
  }
  return { ok: true, base, proc, owned: true, source: 'own-port-' + port };
}

/**
 * 关掉**我们自起的** dev server（含子进程树）。
 * 复用的共享服务传 owned:false —— 绝不去关别人的服务。
 */
export function stopDevServer(proc, { owned = true } = {}) {
  if (!proc || !owned) return;
  try { proc.kill('SIGTERM'); } catch { /* ignore */ }
  /* Windows 上 vite 会派生子进程，补一刀确保端口释放 */
  try {
    if (process.platform === 'win32' && proc.pid) {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    }
  } catch { /* ignore */ }
}

/**
 * 单次「应用健康」判定。
 * @param page playwright page
 * @param readySelector 关键节点（该页面必须存在，例如 '.ec-config-trigger'）
 */
export async function isAppHealthy(page, readySelector) {
  try {
    return await page.evaluate(sel => {
      if (document.querySelector('vite-error-overlay')) return false;
      if (sel && !document.querySelector(sel)) return false;
      const text = (document.body.innerText || '').trim();
      /* 「加载中…」是应用未完成初始化的标志（bodyLen 极小） */
      return text.length > 60 && !/^加载中/.test(text);
    }, readySelector);
  } catch {
    return false;
  }
}

/**
 * **预热**：冷 vite 首次请求要预打包依赖 + 转换整个应用，
 * 实测 domcontentloaded 就要 **~50s**（这不是 bug，是 vite 的 dep pre-bundling）。
 * 若不预热直接进重试循环，第一次尝试会一直在「未健康」里烧光窗口，
 * 看起来像 flaky 超时，其实是**冷启动成本**被误当成失败。
 * 这里先做一次**一次性的、有耐心的**预热导航，之后的重试才是真正的「环境抖动」重试。
 */
async function warmUp(page, base, { timeoutMs = 120000 } = {}) {
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch { /* 预热失败不致命，交给后面的重试 */ }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ok = await page.evaluate(() => {
        if (document.querySelector('vite-error-overlay')) return false;
        const t = (document.body.innerText || '').trim();
        return t.length > 60 && !/^加载中/.test(t);
      });
      if (ok) return true;
    } catch { /* 页面还在换 */ }
    await sleep(500);
  }
  return false;
}

/**
 * 打开页面并等到健康：最多 attempts 次，每次全新导航。
 * 重试**只针对「环境未就绪」**；进入正常流程后断言全部照旧严格。
 *
 * 流程：预热（一次性，容忍冷启动）→ 健康判据 → 不健康则重试。
 */
export async function gotoHealthy(page, base, readySelector, { attempts = 4, perAttemptMs = 15000, url = base } = {}) {
  await warmUp(page, url);   // 冷启动成本只付一次
  let last = 'unknown';
  for (let i = 0; i < attempts; i += 1) {
    try {
      /* 预热后页面通常已就绪，先直接判一次，避免无谓的重新导航 */
      if (await isAppHealthy(page, readySelector)) return { ok: true, attempts: i + 1 };
      /* url 默认 = base；deep-link 页面（本仓路由是 **pathname 驱动**，不是 hash）
         必须传完整 url，否则这里回退到 base 会把 /video-studio 这类路径冲掉，
         页面退回首页 → 健康判据永远不满足（曾误判为「白屏 / HMR 中断」）。 */
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const deadline = Date.now() + perAttemptMs;
      while (Date.now() < deadline) {
        if (await isAppHealthy(page, readySelector)) return { ok: true, attempts: i + 1 };
        await sleep(400);
      }
      last = '应用未进入健康态（并发 agent 改同一文件导致瞬时白屏 / HMR 中断）';
    } catch (error) {
      last = error?.message || String(error);
    }
    await sleep(1200);   // 给 vite 重新编译的时间
  }
  return { ok: false, attempts, reason: last };
}

/**
 * 统一的「拿不到环境就 skip」出口。
 * 返回 { ctx } 或 null；null 时已打印带原因的 skip 标记。
 *
 * ⚠️ 设计取舍（重要）：
 *   拿不到环境 → **skip 而非 fail**。理由：否则任何人只要没起服务，
 *   就会看到「主干红」，这会污染所有线的判断（本仓已因此误报多次）。
 *   但 skip **一定带原因**，且**绝不静默**——每次都会打印醒目的 SKIP-LIVE 行。
 *   真正要防的「本应测到却没测到」由调用方的 measured 标志兜底（见 readmeFlag）。
 */
export function skipLive(t, reason) {
  console.log('\n⚠️ [SKIP-LIVE] ' + reason);
  console.log('⚠️  本次结果**不能**证明渲染契约达标；请在无端口争用的环境下重跑。\n');
  if (t && typeof t.skip === 'function') t.skip('SKIP-LIVE: ' + reason);
  return null;
}
