孪生项不出现的根本原因只有三个：

1. **families 列表里的字符串跟你 DSH 实际模型 id 对不上**（最常见）
2. modlens 插件根本没被加载
3. provider 列模型失败（缺 key）

完整诊断文档在我机器的这里（含具体代码引用、验证脚本、6 种情况速查表）：

  F:\da\shubao\.tmp-anno-verify\handoff\MODLENS-TWIN-TROUBLESHOOTING.md

**只看最关键的两件事**就能解决 90% 的问题：

**A. 列出 DSH 实际注册的所有模型 id 是什么**（不是「我以为它叫什么」，是「DSH 真在用什么 id」）

在 DSH 浏览器 DevTools Console 里跑：
```javascript
const opts = Array.from(document.querySelectorAll('option, [role=option]'))
  .map(e => e.textContent.trim()).filter(Boolean);
console.log('selector options:', opts);
```

或者 grep 服务端日志：
```bash
grep -i 'model.*register\|provider.*list\|registerWrapper' ~/.dsh/logs/*.log | tail -30
```

**B. 孪生项是「前缀匹配」生成的**（看 modlens/dsh/index.js L567: id.startsWith(family)），不是子串匹配也不是正则匹配。**families 列表里写的字符串必须是模型 id 真正的开头几个字符**。

例如你模型 id 是 ox-alpha-free，则 ox 写进 families 就匹配；如果你写 x-preview 它就匹配不到（因为没以 x-preview 开头）。

把 families 改成你真实模型 id 的前缀后保存 patch.yml（路径是 ~/.dsh/profiles/web/cordis.patch.yml，顶头必须是 -），刷新 DSH 页面或 POST /dsh-market/restart。

如果还不行，把诊断文档 §1 五步诊断的每步输出贴出来，帮你看。