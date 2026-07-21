#!/usr/bin/env python3
"""Extract missing exports from old api.js and append to new one."""
import subprocess, re, sys

result = subprocess.run(['git', 'show', '120de36~1:src/services/api.js'],
                        capture_output=True, text=True, cwd='f:/da/shubao')
if result.returncode != 0:
    result = subprocess.run(['git', 'show', 'a63873a:src/services/api.js'],
                            capture_output=True, text=True, cwd='f:/da/shubao')

old = result.stdout
with open('src/services/api.js', 'r', encoding='utf-8') as f:
    new = f.read()

# Extract all exported functions from old
blocks = re.split(r'(?=\nexport (?:async )?function )', '\n' + old)
count = 0
with open('src/services/api.js', 'a', encoding='utf-8') as f:
    for block in blocks:
        m = re.match(r'\nexport (?:async )?function (\w+)', block)
        if m:
            name = m.group(1)
            # Skip if already in new file
            if name in new:
                continue
            # Skip functions that should only use new version
            if name in ('proxyImg', 'uploadECTempImages', 'reversePrompt', 'removeBg', 'polishECText'):
                continue
            f.write(block + '\n\n')
            count += 1
            print(f"  + {name}")

print(f"\nRestored {count} missing exports")
