import re
with open('d:/AI网站/shubao/server/index.mjs', 'r', encoding='utf-8') as f:
    c = f.read()
c = re.sub(
    r'      "通用": `[^`]+`,\n    };',
    '    };',
    c,
    count=1
)
with open('d:/AI网站/shubao/server/index.mjs', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
