/**
 * 薯包AI · 弹窗交互
 *
 * 策略：
 *  1. 先尝试用 scripting.executeScript 主动注入 content_bundle.js
 *  2. 然后 ping 确认它在线
 *  3. 都好了才显示提取按钮
 */
const $ = id => document.getElementById(id);
const API_BASE = 'http://localhost:3099';

const PLATFORMS = [
  { match: /taobao\.com|tmall\.com/, name: '淘宝 / 天猫' },
  { match: /1688\.com/,               name: '1688'       },
  { match: /jd\.com/,                 name: '京东'       },
  { match: /amazon\./,                name: 'Amazon'     },
  { match: /myshopify\.com|shopify\.com/, name: 'Shopify 独立站' },
  { match: /pinduoduo\.com|yangkeduo\.com/, name: '拼多多' },
  { match: /shopee\./,                name: 'Shopee'     },
];

let currentTab = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentTab = await getCurrentTab();
  if (!currentTab) return showStatus('无法获取当前标签页', 'error');

  const supported = detectPlatform(currentTab.url);
  if (!supported) return;

  // 阶段 1：注入 content script（如果还没注入）
  await injectContentScript();

  // 阶段 2：ping 确认它在线（带重试）
  const alive = await waitForPing(5); // 最多试 5 次，间隔 500ms
  if (alive) {
    $('extractSection').style.display = 'block';
    $('injectSection').style.display = 'none';
    $('extractBtn').disabled = false;
    $('extractBtn').innerHTML = '🔍 一键提取商品图片<span class="sub">自动采集高清主图、细节图、场景图</span>';
  } else {
    // 注入了但 ping 不到 → 可能脚本有运行时错误
    $('extractSection').style.display = 'none';
    $('injectSection').style.display = 'block';
    document.querySelector('#injectSection .icon').textContent = '❌';
    document.querySelector('#injectSection .title').textContent = '注入失败';
    document.querySelector('#injectSection .desc').innerHTML =
      '已尝试注入提取脚本但没有响应。<br>' +
      '请按 <b>F12</b> 打开开发者工具 → 控制台(Console)，<br>' +
      '看看有没有 <b>[shubao]</b> 开头的错误信息，截图给我看。';
  }
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function detectPlatform(url) {
  for (const p of PLATFORMS) {
    if (p.match.test(url)) {
      $('platformName').textContent = p.name;
      $('platformInfo').className = 'platform-info supported';
      return true;
    }
  }
  $('platformName').textContent = '当前页面';
  $('platformInfo').className = 'platform-info unsupported';
  return false;
}

/* ── 主动注入 content script ── */
async function injectContentScript() {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content_bundle.js'],
    });
    console.log('[shubao] injected via executeScript');
  } catch (err) {
    // 可能已经注入了，DUPLICATE 是正常的
    console.log('[shubao] inject result:', err.message);
  }
}

/* ── 等待 content script 回应 ping ── */
async function waitForPing(maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
      if (resp?.pong === true) return true;
    } catch {}
    // 等 500ms 再试
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

/* ── 提取按钮 ── */
$('extractBtn').addEventListener('click', async () => {
  const btn = $('extractBtn');
  btn.disabled = true;
  btn.classList.add('extracting');
  btn.innerHTML = '⏳ 正在提取图片...<span class="sub">解析页面 DOM 中</span>';
  hideStatus();
  $('goBtn').style.display = 'none';

  try {
    const data = await chrome.tabs.sendMessage(currentTab.id, { action: 'extract' });

    if (!data || !data.images?.length) {
      showStatus('未找到商品图片，请确认当前页面是商品详情页', 'error');
      resetBtn();
      return;
    }

    await chrome.storage.local.set({ lastExtraction: { ...data, pageUrl: currentTab.url } });
    renderResult(data);

    const subRes = await chrome.runtime.sendMessage({
      action: 'submitExtraction',
      payload: {
        images: data.images,
        title: data.title,
        platform: data.platform,
        pageUrl: currentTab.url,
        ratios: data.ratios,
      },
    });

    if (subRes?.ok) {
      btn.classList.remove('extracting');
      btn.classList.add('done');
      btn.innerHTML = '✅ 提取成功！已提交到云端';
      showStatus(
        `已采集 ${data.images.length} 张图片，任务编号：<span class="em">${subRes.taskId}</span>`,
        'success'
      );
      $('goBtn').style.display = 'block';
      $('goBtn').onclick = () => {
        chrome.runtime.sendMessage({
          action: 'openRemakePage',
          payload: { taskId: subRes.taskId },
        });
      };
    } else {
      resetBtn();
      showStatus(`提交失败：${subRes?.error || '未知错误'}`, 'error');
    }
  } catch (err) {
    resetBtn();
    showStatus(`提取失败：${err.message}`, 'error');
  }
});

function renderResult(data) {
  $('stats').classList.add('show');
  $('statCount').textContent = data.images.length;
  $('statTitle').textContent = data.title || '—';
}

function showStatus(msg, type) {
  const el = $('status');
  el.className = `status show ${type}`;
  el.innerHTML = msg;
}
function hideStatus() { $('status').className = 'status'; }

function resetBtn() {
  const btn = $('extractBtn');
  btn.disabled = false;
  btn.classList.remove('extracting', 'done');
  btn.innerHTML = '🔍 一键提取商品图片<span class="sub">自动采集高清主图、细节图、场景图</span>';
}
