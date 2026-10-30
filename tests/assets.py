"""Check the shipped HTML, module and stylesheet dependency closure."""
import json
import hashlib
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'

def check(source, target):
    url = urlsplit(target)
    if url.scheme or url.netloc or not url.path: return
    path = (source.parent / unquote(url.path)).resolve()
    assert path.is_relative_to(PUBLIC), (source, target, 'reference leaves public root')
    assert path.is_file(), (source, target, 'missing asset')

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.source = source; self.ids = set()
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if 'id' in values:
            assert values['id'] not in self.ids, (self.source, 'duplicate id', values['id'])
            self.ids.add(values['id'])
        for attr in ('src', 'href'):
            if attr in values: check(self.source, values[attr])

for path in PUBLIC.glob('*.html'):
    Page(path).feed(path.read_text())
for path in PUBLIC.rglob('*.js'):
    subprocess.run(['node', '--check', str(path)], check=True, capture_output=True)
    text = path.read_text()
    for target in re.findall(r'''(?:from\s+|new URL\(\s*)["']([^"']+)["']''', text):
        if target.startswith('.'): check(path, target)
for path in PUBLIC.rglob('*.css'):
    for target in re.findall(r'''url\(["']?([^)'"\s]+)''', path.read_text()): check(path, target)
for path in (ROOT / 'src').glob('*.php'):
    subprocess.run(['php', '-l', str(path)], check=True, capture_output=True)
for record in json.loads((ROOT / 'docs/asset-provenance.json').read_text()):
    target = ROOT / Path(record['target']).relative_to('tft')
    assert hashlib.sha256(target.read_bytes()).hexdigest() == record['sha256'], ('Asset provenance digest changed', target)
assert (ROOT / 'VERSION').read_text().strip() == json.loads((ROOT / 'package.json').read_text())['version']
print('PASS shipped asset closure, unique HTML IDs, JavaScript/PHP syntax and package version agreement')
