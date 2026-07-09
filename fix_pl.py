import re

with open("shubao-final.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# The broken section spans multiple lines with actual newlines in the strings
# Fix: replace multi-line broken pattern with single-line proper pattern
old = '''              const txt=(result.title||"")+
"+(result.body_text||"")+
"+(result.hashtags||[]).join(" ");'''
# Note: the old pattern has TWO blank lines between the + and " characters
# Let me try a different approach: find the exact text
idx = c.find('const txt=(result.title||"")+')
if idx >= 0:
    end = c.find(";", idx) + 1
    broken = c[idx:end]
    # Replace any actual newlines within this string with \n escape sequences
    # But only those that are inside concatenated string literals
    import re

    # The clean version
    clean = 'const txt=(result.title||"")+"\\n\\n"+(result.body_text||"")+"\\n\\n"+(result.hashtags||[]).join(" ");'

    c = c[:idx] + clean + c[end:]
    with open("shubao-final.jsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("Fixed! Broken was:", repr(broken))
else:
    # Try to find the line numbers
    for i, line in enumerate(c.split('\n'), 1):
        if 'const txt=(result.title' in line:
            print(f"Found at line {i}: {repr(line)}")
            print(f"Line {i+1}: {repr(c.split(chr(10))[i] if i < len(c.split(chr(10))) else 'EOF')}")
