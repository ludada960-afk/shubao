#!/usr/bin/env python3
import re

with open('d:/AI网站/shubao/server/index.mjs', 'r', encoding='utf-8') as f:
    c = f.read()

changes = 0

# 1. Add cluster + os imports
if "import cluster from 'cluster';" not in c:
    c = c.replace(
        "import sharp from 'sharp';",
        "import sharp from 'sharp';\nimport cluster from 'cluster';\nimport os from 'os';"
    )
    changes += 1
    print('1. Added cluster/os imports')

# 2. Remove the "通用" field and add fetch timeout
old_general = '"通用": `视觉风格：小红书信息图风格，干净明亮的浅色背景\n每页内容：标题+核心信息点+配图，图文结合\n布局：封面标题+主视觉，P2-P7按内容逻辑排列（清单/步骤/对比/场景），P8总结\n配色：根据内容氛围选色，保持柔和\n禁止：❌文字堆砌 ❌无配图 ❌版面太空`,\n    };'
if old_general in c:
    c = c.replace(old_general, '};')
    changes += 1
    print('2. Removed 通用 field')

    # Now add fetch timeout
    old_fetch = 'const res = await fetch(url, {\n        method: \'POST\',\n        headers: { \'Content-Type\': \'application/json\', \'Authorization\': `Bearer ${LLM_KEY}` },\n        body: JSON.stringify(body),\n      });\n      if (res.ok) {'
    new_fetch = 'let res;\n      try {\n        const controller = new AbortController();\n        const timeout = setTimeout(() => controller.abort(), 30000);\n        try {\n          res = await fetch(url, {\n            method: \'POST\',\n            headers: { \'Content-Type\': \'application/json\', \'Authorization\': `Bearer ${LLM_KEY}` },\n            body: JSON.stringify(body),\n            signal: controller.signal,\n          });\n        } finally { clearTimeout(timeout); }\n      } catch(e) { errors.push(`LLM网络错误: ${e.message}`); }\n      if (res && res.ok) {'
    if old_fetch in c:
        c = c.replace(old_fetch, new_fetch)
        changes += 1
        print('3. Added fetch timeout')
    else:
        print('WARN: fetch pattern not found')
else:
    print('WARN: 通用 field not found')

# 3. Reduce allPrompts to 5
old_prompts = "...vPrompts.map(p => ({ id: 'p' + p.page_id, prompt: p.prompt, category: analysis.category })),"
new_prompts = "...vPrompts.slice(0, 4).map(p => ({ id: 'p' + p.page_id, prompt: p.prompt, category: analysis.category })),"
if old_prompts in c:
    c = c.replace(old_prompts, new_prompts)
    changes += 1
    print('4. Reduced images to 5')
else:
    print('WARN: allPrompts pattern not found')

# 4. Replace startup with cluster mode
old_start = 'app.listen(PORT, () => {\n  console.log(`\\n🧩 薯包AI 后端服务运行中`);\n  console.log(`   LLM: ${LLM_BASE ? LLM_BASE + \'/v1/chat/completions\' : \'未配置\'} (${LLM_MODEL})`);\n  console.log(`   Image: ${IMG_BASE}/v1/images/generations`);\n  console.log(`   Anthropic 备用: ${process.env.ANTHROPIC_API_KEY ? \'已配置\' : \'未配置\'}`);\n  console.log(`   API: http://localhost:${PORT}/api/generate`);\n  console.log(\'\');\n});'

# Build new_start carefully with proper escaping
new_start = '''const CLUSTER_ENABLED = !process.env.CLUSTER_DISABLED && !cluster.isWorker;

if (CLUSTER_ENABLED && cluster.isPrimary) {
  const cpuCount = Math.min(os.availableParallelism?.() || os.cpus().length, 4);
  console.log(`🦩 薯包AI 主进程 (PID ${process.pid}) 启动 ${cpuCount} 个工作进程`);
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
    console.log(`\\n🦩 薯包AI 后端服务运行中${cluster.isWorker ? ` (worker #${cluster.worker.id}, PID ${process.pid})` : ''}`);
    console.log(`   LLM: ${LLM_BASE ? LLM_BASE + '/v1/chat/completions' : '未配置'} (${LLM_MODEL})`);
    console.log(`   Image: ${IMG_BASE}/v1/images/generations`);
    console.log(`   Anthropic 备用: ${process.env.ANTHROPIC_API_KEY ? '已配置' : '未配置'}`);
    console.log(`   API: http://localhost:${PORT}/api/generate`);
    console.log('');
  });
}'''

if old_start in c:
    c = c.replace(old_start, new_start)
    changes += 1
    print('5. Added cluster mode startup')
else:
    print('WARN: old_start not found - checking actual ending...')
    idx = c.rfind('app.listen(PORT')
    if idx > 0:
        print(f'  Actual ending at {idx}:')
        print(c[idx:idx+800])

with open('d:/AI网站/shubao/server/index.mjs', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'\nDone: {changes} changes applied')
