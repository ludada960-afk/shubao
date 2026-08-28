# ModLens "(modlens vision)" 孪生项诊断与修复（只解决孪生项）

> 适用症状：modlens 插件装好、cordis.patch.yml 写好了、模型选择器里却看不到任何带 "(modlens vision)" 后缀的项。

## 0. 孪生项到底怎么生成的（看代码就清楚）

关键代码在 `node_modules/@liustack/modlens/dsh/index.js`：

- L558: `const families = config.families || ['deepseek', 'glm']` —— **读你 patch.yml 里的 families**
- L567: `if (!families.some((family) => id.startsWith(family) || bare.startsWith(family))) return false` —— 模型 id 或 bare 名字必须**以** family 字符串**开头**
- L620: `name: ${model.name ?? model.id} (modlens vision)` —— 孪生项的命名规则，固定以 " (modlens vision)" 后缀
- L618: `models.filter(shouldWrap).map((model) => ({...}))` —— 只对通过 shouldWrap 的模型生成孪生
- L635: `wrapping a model that reads images itself` —— **已有原生视觉能力的模型被跳过**（如 qwen3-vl-plus 本身不会生成孪生）

## 1. 五步诊断（按顺序做）

### Step 1：确认 modlens 插件真的被加载

在 DSH 启动日志里搜 modlens：
```bash
grep -i modlens ~/.dsh/logs/*.log | head -20
# 或者看 profile 的 dist 里：
ls -la ~/.dsh/profiles/web/node_modules/@liustack/modlens/
```
期望：`dist/main.js` + `dsh/index.js` 两个文件都在。

### Step 2：确认 cordis.patch.yml 已被应用

读取并验证文件：
```bash
cat ~/.dsh/profiles/web/cordis.patch.yml
```
期望内容（**注意顶头是数组项，不是裸 map**）：
```yaml
- id: modlens
  config:
    pasteToPath: false
    families: [deepseek, glm, gpt, x-preview]
```
**常见错误**：
- 写成 `id: modlens:\n  config: ...`（少一个 dash 顶头）→ 整个 yml 解析为 map，patch 不生效
- 缩进差 1 空格 → yaml 解析失败
- 文件位置错（写到了 `~/.dsh/cordis.patch.yml` 而不是 `~/.dsh/profiles/web/cordis.patch.yml`）→ 未被加载

验证 DSH 是否认这个 patch：看 DSH 启动日志，应有类似：
```
[modlens] applying patch from cordis.patch.yml
# 或者
modlens config: families=[deepseek, glm, gpt, x-preview] pasteToPath=false
```
如果完全没有 modlens 日志，说明 patch 没被加载，回到 Step 1/2 检查。

### Step 3：列出 DSH 实际注册的模型 id 是什么

这是**最关键的一步**。孪生项只对 families 列表前缀匹配的模型生成，所以你必须知道 DSH 当前的模型 id 长什么样。

在 DSH 打开浏览器 DevTools（Ctrl+Shift+I），在 Console 里跑：
```javascript
(async () => {
  const dsh = window.dsh || window.deepseekHarness || globalThis;
  // 列出所有 provider 与其 models
  const out = [];
  if (typeof dsh.listProviders === 'function') {
    for (const p of dsh.listProviders()) {
      const ms = p.models || (p.listModels && (await p.listModels())) || [];
      out.push({ provider: p.id || p.name, models: ms.map(m => m.id || m.name) });
    }
  }
  return out;
})().then(console.log).catch(console.error);
```

如果 `window.dsh` 不存在，找 DSH 当前版本暴露的模型列表 API（不同 DSH 版本接口位置不同）：
```javascript
// 备选 1：直接抓模型选择器的 DOM
const opts = Array.from(document.querySelectorAll('option, [role=option], li'))
  .map(e => e.textContent.trim()).filter(Boolean);
console.log('selector options:', opts);

// 备选 2：抓 model-store 全局
const stores = Object.keys(window).filter(k => /model|provider/i.test(k));
console.log('stores:', stores);
```

把拿到的模型 id 列表发出来对照。

### Step 4：根据真实 id 修正 families 列表

假设你拿到的真实 id 是：
```
ox-alpha-free, ox-preview, gpt-4-turbo, qwen3-vl-plus
```
对应匹配：
- `x-preview` 家族（任意以 x-preview 开头）—— 但你的 id 是 `ox-alpha-free` 或 `ox-preview`，**不以 x-preview 开头**！
- `gpt` 家族（任意以 gpt 开头）—— `gpt-4-turbo` ✓
- `qwen3-vl-plus` 是原生视觉模型，**本身已被 modlens 跳过**（不需要孪生）

所以正确做法：**把 patch.yml 改成实际存在的 family 前缀**：
```yaml
- id: modlens
  config:
    pasteToPath: false
    families: [ox, gpt, deepseek, glm, qwen]
```
注意是**前缀匹配**（L567: `id.startsWith(family)`），不是子串匹配，也不是正则。

改完保存（无需重启 DSH——cordis patch 是热加载的，但保险起见可以刷新页面或者发 `curl -X POST http://127.0.0.1:3080/dsh-market/restart` 重启 host）。

再去看模型选择器，**应该出现形如** `ox-alpha-free (modlens vision)` 之类的项。

### Step 5：如果是 API Key 还没配，孪生项也不会出现

L835 附近的 `registerWrapper` 会调用 provider 列出模型；如果 provider 的 listModels 因为缺 key 抛错，整个家族就没有孪生。

检查：
```bash
grep -i 'api.key\|key.*missing\|auth.*fail' ~/.dsh/logs/*.log | tail -10
```
如果看到相关错误，去 DSH 设置里给对应 provider 配 API key。

## 2. 完整验证脚本（5 分钟跑完确认孪生项就绪）

```bash
#!/bin/bash
set -e
PROFILE=~/.dsh/profiles/web

# 1. patch.yml 存在且形态正确
test -f $PROFILE/cordis.patch.yml || (echo "FAIL: cordis.patch.yml missing at $PROFILE/cordis.patch.yml"; exit 1)
grep -q "^- id: modlens$" $PROFILE/cordis.patch.yml || (echo "FAIL: top-level array item missing"; exit 1)
grep -q "families:" $PROFILE/cordis.patch.yml || (echo "FAIL: families key missing"; exit 1)
echo "OK: patch.yml present and shaped correctly"

# 2. modlens dist + dsh shim 都在
test -f $PROFILE/node_modules/@liustack/modlens/dist/main.js || (echo "FAIL: modlens dist missing"; exit 1)
test -f $PROFILE/node_modules/@liustack/modlens/dsh/index.js || (echo "FAIL: modlens dsh shim missing"; exit 1)
echo "OK: modlens installed"

# 3. modlens 源码里能搜到 (modlens vision) 字面量
grep -c "(modlens vision)" $PROFILE/node_modules/@liustack/modlens/dsh/index.js | grep -q "^[1-9]" || (echo "FAIL: modlens dsh shim has no (modlens vision) template"; exit 1)
echo "OK: modlens dsh shim has (modlens vision) template"

# 4. 列出 families 配置的 family
echo "Configured families:"
grep -A 5 "^- id: modlens" $PROFILE/cordis.patch.yml | grep families

# 5. modlens 有没有过 token 错误
grep -i 'modlens\|vision' ~/.dsh/logs/*.log 2>/dev/null | tail -5 || echo "(no modlens log lines, check DSH started correctly)"

echo ""
echo "Next: open DSH model selector in browser. If you still don't see '(modlens vision)' entries, paste the output above to your AI helper for further diagnosis."
```

## 3. 仍然没出现孪生项的 6 种情况速查表

| 症状 | 原因 | 解决 |
| --- | --- | --- |
patch.yml 在但 modlens 启动日志说没加载 | 文件被放到错误的 profile 目录，或 yml 顶头不是 `-` | 把 yml 放进当前激活的 profile 目录；确认顶头是数组 |
families 写对但模型 id 完全不以前缀开头 | DSH 实际的模型 id 与 families 列表对不上 | 用 DevTools 列真实 id，按真实 id 改 families |
模型 id 里有视觉模型自己 | 视觉模型被 shouldWrap 跳过（L635） | 删掉原生视觉模型（直接用就行），只用 text-only 跑孪生 |
provider 列出模型失败（缺 key） | 401/403 在 L835 registerWrapper 阶段 | 配 API key |
重写 plugin 注册时序 | DSH 启动后 provider 还没就绪就扫描了 | 重启 DSH，或刷新后等几秒 |
base 模型本身被 cordis patch disable 掉 | 某个 `- id: <provider>\n  disable: true` 屏蔽了 | 查 `grep disable $PROFILE/cordis.patch.yml` 移除 |

## 4. 复制即可用的 cordis.patch.yml 模板

下面这个版本**几乎所有常见 DSH 部署都覆盖**（按需裁剪）：
```yaml
- id: modlens
  config:
    pasteToPath: false
    # 覆盖 ox-alpha / ox-preview / GPT 家族 / DeepSeek 家族 / 智谱 / Qwen 文本家族
    families: [ox, gpt, deepseek, glm, qwen, opencode, zai, anthropic]
```

**重点**：family 字符串是**前缀**，不是完整 id 也不是正则。如果你的模型 id 是 `ox-alpha-free`，则 `ox` family 匹配；如果是 `my-company-x-preview`，你得写 `my-company-x` family。

## 5. 验证孪生项真的可用（不只是出现）

孪生项出现后还要发一张图测试它真的能看：
```javascript
// 在 DSH Console 跑：
const ta = document.querySelector('textarea');
ta.value = '看看这张图';
ta.dispatchEvent(new Event('input', {bubbles: true}));
// 然后粘贴一张图（用真实 Ctrl+V 触发 File 事件）
// 发出去后，模型选择器里选 "X (modlens vision)" 那个项
// 如果正常回复，孪生项就完全可用；如果模型说"看不到图"，回去看 modlens 引擎配置
```

## 6. 一句话总结

孪生项生成是**前缀匹配 + 模型列表可枚举 + provider 不报错**三件事都满足的结果。先列出真实模型 id，再倒推 family 前缀，再写进 patch.yml。绝大多数"孪生项不出现"的根因是 families 列表里的字符串和实际模型 id 对不上。