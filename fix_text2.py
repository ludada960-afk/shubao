import re

with open("shubao-final.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# Fix the broken string literal
old = "const txt=(result.title||'')+'" + "\n\n" + "'+(result.body_text||'')+" + "\n\n" + "'+(result.hashtags||[]).join(' ');"
new = "const txt=(result.title||'')+'\\n\\n'+(result.body_text||'')+'\\n\\n'+(result.hashtags||[]).join(' ');"

if old in c:
    c = c.replace(old, new)
    with open("shubao-final.jsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("FIXED")
else:
    print("NOT FOUND")
    # Debug: print surrounding context
    idx = c.find("const txt=(result.title")
    if idx >= 0:
        print(repr(c[idx:idx+200]))
