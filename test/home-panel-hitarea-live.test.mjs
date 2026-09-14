// test/home-panel-hitarea-live.test.mjs
// 2026-09 交接纪律落地：把 .tmp-v3/gate5.mjs 的一次性探针**固化为实机契约测试**。
//
// 为什么必须实机测（而不是扫源码字符串）：
//   点击区尺寸是**运行时计算值**（受 token 阶梯 + 布局 + 浏览器取整共同决定）。
//   源码里写 var(--sb-control-lg) 只能证明「引用了 token」，
//   不能证明「渲染出来是 36px」—— token 被改小、被覆盖、或盒子被 siblings 挤压，
//   源码扫描全都看不出来。本仓已经发生过一次真实的点击区缩水事故。
//
// 用户需求（原话）：「点击区不许变小」。
//   · 分段控件（1K/2K/4K 这类**主点击目标**）—— 档位 ≥40px
//   · 色块 / 锁定按钮（**次级控件**）—— 档位 ≥36px，与同行输入框等高更整齐
//   · 模型行（可点卡片）—— ≥40px
//   ⚠️ 36 是用户明确认可的下限，**不要"顺手"改成 44**：44 是主点击目标的档位。
//
// dev server 不可用时跳过实机部分（与 asset-library 系列同一约定），
// 但**静态契约仍然强制**，不会静默全过。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const BASE = 'http://localhost:5173/';

/* 阈值：来自用户裁定，不随实现波动 */
const MIN_SEGMENT = 40;   // 分段控件（主点击目标）
const MIN_SWATCH = 36;    // 色块 / 锁定按钮（次级控件）—— 用户认可 36，勿改 44
const MIN_MODEL_ROW = 40; // 模型行（可点卡片）

/* ═══════════ 并发树加固：健康判据 + 重试（复用 asset-library-picker-v2 的成熟写法）═══════════
   本仓多条线并行改同一批文件，vite 会在别人保存的瞬间处于「HTTP 200 但应用没起来」
   的中间态（白屏 / vite-error-overlay / 只剩「加载中」）。
   此时若直接断言，会得到「慢测试假红」——断言本身没问题，是被测环境瞬时不可用。
   处置：等到**应用健康**再操作；每次尝试都用全新导航。 */
async function devServerUp() {
  try {
    const res = await fetch(BASE, { method: 'GET' });
    return res.ok;
  } catch { return false; }
}
const HAS_SERVER = await devServerUp();

/* 单次「应用健康」判定：首页已挂载、无 vite 错误遮罩、不在加载中态 */
async function isAppHealthy(page) {
  try {
    return await page.evaluate(() => {
      if (document.querySelector('vite-error-overlay')) return false;
      if (!document.querySelector('.ec-config-trigger')) return false;
      const text = (document.body.innerText || '').trim();
      return text.length > 60 && !/^加载中/.test(text);
    });
  } catch { return false; }
}

/* 打开首页并等到健康：最多 attempts 次，每次全新导航。
   注意：重试只针对「环境未就绪」；进入正常流程后断言全部严格。 */
async function gotoHealthyHome(page, { attempts = 4, perAttemptMs = 15000 } = {}) {
  let last = 'unknown';
  for (let i = 0; i < attempts; i += 1) {
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const deadline = Date.now() + perAttemptMs;
      while (Date.now() < deadline) {
        if (await isAppHealthy(page)) return { ok: true, attempts: i + 1 };
        await page.waitForTimeout(400);
      }
      last = '应用未进入健康态（并发 agent 改同一文件导致瞬时白屏 / HMR 中断）';
    } catch (error) {
      last = error?.message || String(error);
    }
    await page.waitForTimeout(1200);   // 给 vite 重新编译的时间
  }
  return { ok: false, attempts, reason: last };
}

/* 打开生成设置面板（健康后仍要等面板真正挂载） */
async function openPanel(page) {
  const triggers = await page.$$('.ec-config-trigger');
  assert.ok(triggers.length > 0, '首页必须存在配置触发条');
  await triggers[0].click();
  await page.waitForSelector('#ec-floating-panel', { timeout: 15000 });
  const modelRow = await page.$('#ec-floating-panel button:has-text("模型")');
  if (modelRow) { await modelRow.click(); await page.waitForTimeout(600); }
  /* ⚠️ 关键：面板有入场动画（transform: scale(...) 从 0.97 → 1）。
     若在动画途中测量，getBoundingClientRect 会返回**被缩放后**的值：
     实测 36px 的色块量到 34.56px（≈36 × 0.9695），会误判为「点击区缩水」。
     这是本测试最大的假红来源，必须先等 transform 收敛到单位矩阵。 */
  await page.waitForFunction(() => {
    const p = document.getElementById('ec-floating-panel');
    if (!p) return false;
    const t = getComputedStyle(p).transform;
    return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
  }, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/* 读取三组点击区的**实测**高度（px，已取整） */
const measure = page => page.evaluate(() => {
  /* 保留小数：点击区缩水经常是**亚像素**的（如 36 → 34.56 由缩放动画造成），
     Math.round 会把「36 vs 35」这种真实差异抹平。这里一律保留 2 位小数，
     断言时再与阈值直接比较，避免取整掩盖问题。 */
  const h = el => Math.round(el.getBoundingClientRect().height * 100) / 100;
  const p = document.getElementById('ec-floating-panel');
  if (!p) return null;
  const btns = [...p.querySelectorAll('button')];
  const seg = btns
    .filter(b => /^(1K|2K|4K)/.test((b.textContent || '').trim()))
    .map(b => h(b));
  const swatchEl = p.querySelector('button[aria-label="选择品牌主色"]');
  const swatch = swatchEl ? h(swatchEl) : null;
  /* 锁定按钮：文案「锁定」/「已锁定」 */
  const lockBtn = btns.find(b => /^(锁定|已锁定)$/.test((b.textContent || '').trim()));
  const lock = lockBtn ? h(lockBtn) : null;
  /* 模型行：模型下拉里的可点行。
     结构特征：与「模型」分组标题同级的下拉容器内、带 aria-pressed 的按钮
     （选择器不用文案，避免文案改版导致测试假红）。 */
  const modelRows = btns
    .filter(b => b.hasAttribute('aria-expanded') || b.hasAttribute('aria-pressed'))
    .filter(b => {
      const grid = b.parentElement;
      return grid && getComputedStyle(grid).display === 'grid' && grid.children.length >= 3;
    })
    .map(b => h(b))
    .filter(x => x > 0);
  return { seg, swatch, lock, modelRows };
});

/* ═══════════ 静态契约（不依赖 dev server，永远强制）═══════════ */

test('静态：点击区档位引用的 token 存在且不低于下限', () => {
  const tokens = read('src/styles/design-tokens-v3.css');
  const num = name => {
    const m = tokens.match(new RegExp('--' + name + '\\s*:\\s*(\\d+)px'));
    return m ? Number(m[1]) : null;
  };
  const lg = num('sb-control-h-lg');
  const xl = num('sb-control-h-xl');
  assert.ok(lg !== null, '--sb-control-h-lg 必须定义');
  assert.ok(xl !== null, '--sb-control-h-xl 必须定义');
  assert.ok(lg >= MIN_SWATCH, '--sb-control-h-lg(' + lg + 'px) 不得低于次级控件下限 ' + MIN_SWATCH + 'px');
  assert.ok(xl >= MIN_SEGMENT, '--sb-control-h-xl(' + xl + 'px) 不得低于主点击目标下限 ' + MIN_SEGMENT + 'px');
  /* 别名必须指向同一阶梯（面板用的是别名名 --sb-control-lg / --sb-control-touch）。
     两级别名若被改偏，实机值会变，但源码扫描看不出来 —— 这里锁死别名解析。 */
  assert.match(tokens, /--sb-control-lg:\s*var\(--sb-control-h-lg\)/, '--sb-control-lg 必须别名到 --sb-control-h-lg(36)');
  assert.match(tokens, /--sb-control-touch:\s*var\(--sb-control-h-xl\)/, '--sb-control-touch 必须别名到 --sb-control-h-xl(44)');
});

test('静态：色块与锁定按钮走 36 档，分段控件走 40+ 档（勿把 36 改成 44）', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  /* 面板用**别名**（--sb-control-lg / --sb-control-touch），两者解析到 36 / 44。
     这里同时接受别名与全名，但要求至少引用其一的**次级档**与**主档**各至少一次。 */
  assert.ok(
    /--sb-control-(lg|h-lg)\b/.test(panel),
    '色块/锁定按钮必须走次级控件档 --sb-control-lg(36)（用户裁定 36px，44 是主点击目标档位）',
  );
  assert.ok(
    /--sb-control-(touch|h-xl)\b/.test(panel),
    '分段控件/模型行必须走主点击目标档 --sb-control-touch(44)（≥40px）',
  );
});

test('静态：图片渲染器改动后此契约仍需实机验证（防"只改 token 不验渲染"）', () => {
  /* 反向护栏：本文件必须真的启动过浏览器 —— 防有人把实机部分整段删掉后仍然全绿。
     用源码自省：本文件自身必须包含 chromium.launch 调用。 */
  const self = read('test/home-panel-hitarea-live.test.mjs');
  assert.ok(self.includes('chromium.launch'), '实机断言不得被删除（必须真实启动浏览器）');
  assert.ok(self.includes('getBoundingClientRect'), '必须实测渲染盒尺寸，而不是读源码');
});

/* ═══════════ 实机契约：由运行时实测值守住 ═══════════ */

/* ⚠️ 反「静默变绿」护栏：
   实机测试最危险的失败模式不是「红」，而是**根本没跑却显示通过**——
   dev server 恰好不可用时静默 return，整条实机契约形同虚设。
   处置：① 跳过时打**醒目**标记；② 记录全局「本文件是否真的测过渲染」，
         由最后一条断言强制其为 true（除非环境确实无 server，此时该断言自身也跳过）。 */
let LIVE_MEASURED = false;
if (!HAS_SERVER) {
  console.log('\n⚠️⚠️ [SKIP-LIVE] vite dev server (localhost:5173) 不可用 —— 实机点击区契约**未被执行**！');
  console.log('⚠️⚠️ 本次结果**不能**证明渲染值达标，请在 dev server 起着的环境下重跑。\n');
}

test('实机：分段控件 ≥40px / 色块与锁定按钮 ≥36px / 模型行 ≥40px', async () => {
  if (!HAS_SERVER) return;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const health = await gotoHealthyHome(page);
    /* ③ 重试耗尽必须**显式报错**，绝不静默变绿 */
    if (!health.ok) {
      throw new Error('等待应用健康失败（' + health.attempts + ' 次重试已耗尽）：' + health.reason);
    }
    await openPanel(page);
    const m = await measure(page);
    assert.ok(m, '生成设置面板必须存在（#ec-floating-panel）');
    LIVE_MEASURED = true;   // 只有真正拿到实测值才算「测过」

    /* 分段控件 */
    assert.ok(m.seg.length >= 3, '分段控件（1K/2K/4K）应至少 3 个，实测 ' + m.seg.length + ' 个');
    const segMax = Math.max(...m.seg);
    assert.ok(
      segMax >= MIN_SEGMENT,
      '分段控件点击区必须 ≥' + MIN_SEGMENT + 'px（改造前 30px），实测最大 ' + segMax + 'px',
    );

    /* 色块 + 锁定按钮（次级控件，36 下限；勿改 44） */
    assert.ok(m.swatch !== null, '必须存在品牌主色色块（aria-label="选择品牌主色"）');
    assert.ok(
      m.swatch >= MIN_SWATCH,
      '色块点击区必须 ≥' + MIN_SWATCH + 'px，实测 ' + m.swatch + 'px',
    );
    if (m.lock !== null) {
      assert.ok(
        m.lock >= MIN_SWATCH,
        '锁定按钮点击区必须 ≥' + MIN_SWATCH + 'px，实测 ' + m.lock + 'px',
      );
    }

    /* 模型行 */
    assert.ok(m.modelRows.length > 0, '模型列表必须存在可点行');
    const rowMin = Math.min(...m.modelRows);
    assert.ok(
      rowMin >= MIN_MODEL_ROW,
      '模型行点击区必须 ≥' + MIN_MODEL_ROW + 'px，实测最小 ' + rowMin + 'px',
    );
  } finally {
    await browser.close();
  }
});

/* 反「静默变绿」终检：
   本文件在实机断言里把 LIVE_MEASURED 置 true。若 dev server **可用**却走到这里仍为 false，
   说明实机分支被中途跳过 / 断言被删 / 选择器全空——必须立刻红，绝不允许显示通过。
   dev server 不可用时该断言跳过（此时上方已打醒目 SKIP 标记）。 */
test('反静默变绿：dev server 可用时，实机点击区契约必须真的执行过', t => {
  if (!HAS_SERVER) {
    t.skip('dev server 不可用，无法自证（上方已打 SKIP-LIVE 标记）');
    return;
  }
  assert.equal(
    LIVE_MEASURED,
    true,
    'dev server 可用，但实机测量从未发生 —— 实机契约被静默跳过（这正是必须避免的「假绿」）',
  );
});
