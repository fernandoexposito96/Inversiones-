from pathlib import Path
import re

path=Path('index.html')
text=path.read_text(encoding='utf-8')

if '<script src="core.js"></script>' in text and '<script src="app.js"></script>' in text:
    print('index.html already hardened')
    raise SystemExit(0)

blocks=list(re.finditer(r'<script>.*?</script>',text,flags=re.S))
if len(blocks)!=1:
    raise SystemExit(f'Expected exactly one inline script block, found {len(blocks)}')

start,end=blocks[0].span()
replacement='<script src="core.js"></script>\n<script src="app.js"></script>'
text=text[:start]+replacement+text[end:]
path.write_text(text,encoding='utf-8')
print('Inline JavaScript replaced; visual markup and CSS left untouched')
