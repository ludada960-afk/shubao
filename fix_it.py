import re
with open("shubao-final.jsx", "r", encoding="utf-8") as f:
    c = f.read()

idx = c.find('const txt=(result.title||"")+')
if idx >= 0:
    end = c.find(";", idx) + 1
    broken = c[idx:end]
    clean = 'const txt=(result.title||"")+"\n\n"+(result.body_text||"")+"\n\n"+(result.hashtags||[]).join(" ");'
    c = c[:idx] + clean + c[end:]
    with open("shubao-final.jsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("OK: fixed")
else:
    print("FAIL: not found")
