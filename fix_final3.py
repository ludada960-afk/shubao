#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix server/index.mjs - apply all necessary patches."""
import re

with open('d:/AI网站/shubao/server/index.mjs', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add cluster/os imports (already done via Edit tool)
# 2. Remove "通用" field and add fetch timeout
# Use a regex to find and replace the body definition pattern
# The 通用 field is: '"通用": `...`,' with a template spanning multiple lines
c = re.sub(
    r'      "通用": `[^`]+`,\n    };',
    '    };',
    c
)

# Add fetch timeout: wrap the fetch(url, {...}) with AbortController
old_fetch = '''      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {'''

new_fetch = '''      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }
      if (res && res.ok) {'''

assert old_fetch in c, 'ERROR: fetch pattern not found'
c = c.replace(old_fetch, new_fetch)

# 3. reduce images
c = c.replace(
    '...imagePrompts.map(p => ({ id: `p${p.page_id}`, prompt: p.prompt })),',
    '...imagePrompts.slice(0, 4).map(p => ({ id: `p${p.page_id}`, prompt: p.prompt })),'
)

# 4. Replace ending app.listen with cluster mode
old_end = '''// ============================================================
// 启动
// ============================================================
app.listen(PORT, () => {
  console.log(`\\n🧩 薯包AI 后端服务运行中`);
  console.log(`   LLM: ${LLM_BASE ? LLM_BASE + '/v1/chat/completions' : '未配置'} (${LLM_MODEL})`);
  console.log(`   Image: ${IMG_BASE}/v1/images/generations`);
  console.log(`   Anthropic 备用: ${process.env.ANTHROPIC_API_KEY ? '已配置' : '未配置'}`);
  console.log(`   API: http://localhost:${PORT}/api/generate`);
  console.log('');
});'''

new_end = '''const CLUSTER_ENABLED = !process.env.CLUSTER_DISABLED && !cluster.isWorker;

if (CLUSTER_ENABLED && cluster.isPrimary) {
  const cpuCount = Math.min(os.availableParallelism?.() || os.cpus().length, 4);
  console.log(`\\U0001f9a9 薯包AI 主进程 (PID ${process.pid}) 启动 ${cpuCount} 个工作进程`);
  cluster.setupPrimary({ exec: fileURLToPath(import.meta.url) });
  for (let i = 0; i < cpuCount; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.log(`[cluster] 工作进程 ${worker.process.pid} 退出 (${signal || code})，正在重启...`);
    cluster.fork();
  });
} else {
  initDB();
  if (!cluster.isWorker || cluster.worker.id === 1) startJSONBackup();

  app.listen(PORT, () => {
    console.log(`\\n\\U0001f9a9 薯包AI 后端服务运行中${cluster.isWorker ? ` (worker #${cluster.worker.id}, PID ${process.pid})` : ''}`);
    console.log(`   LLM: ${LLM_BASE ? LLM_BASE + '/v1/chat/completions' : '未配置'} (${LLM_MODEL})`);
    console.log(`   Image: ${IMG_BASE}/v1/images/generations`);
    console.log(`   Anthropic 备用: ${process.env.ANTHROPIC_API_KEY ? '已配置' : '未配置'}`);
    console.log(`   API: http://localhost:${PORT}/api/generate`);
    console.log('');
  });
}'''

assert old_end in c, 'ERROR: ending pattern not found'
c = c.replace(old_end, new_end)

# 5. Fix db.mjs
with open('d:/AI网站/shubao/server/db.mjs', 'r', encoding='utf-8') as f:
    db = f.read()
db = db.replace('ORDER BY created_at DESC', 'ORDER BY id DESC')
with open('d:/AI网站/shubao/server/db.mjs', 'w', encoding='utf-8') as f:
    f.write(db)

with open('d:/AI网站/shubao/server/index.mjs', 'w', encoding='utf-8') as f:
    f.write(c)

print('All fixes applied')
