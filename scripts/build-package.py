#!/usr/bin/env python3
"""Build a complete, versioned source package from an immutable clean commit."""
import argparse
import hashlib
import io
import json
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def build(output=None):
    if git('status', '--porcelain').strip():
        raise SystemExit('Commit or preserve outstanding changes before building an immutable source package.')
    commit = git('rev-parse', 'HEAD').decode().strip()
    version = git('show', 'HEAD:VERSION').decode().strip()
    if not version or any(c not in '0123456789.' for c in version):
        raise SystemExit('VERSION must contain a numeric release version.')
    prefix = f'tft-{version}/'
    archive = git('archive', '--format=zip', f'--prefix={prefix}', commit)
    allowed_roots = {'public', 'src', 'config', 'docs', 'tests', 'scripts', 'deploy', '.github'}
    allowed_files = {'README.md', 'CHANGELOG.md', 'VERSION', 'Makefile', 'package.json', 'package-lock.json', '.gitignore'}
    manifest = {'version': version, 'sourceCommit': commit, 'files': {}}
    entries = []
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        for info in source.infolist():
            if info.is_dir(): continue
            relative = PurePosixPath(info.filename).relative_to(prefix)
            if relative.parts[0] not in allowed_roots and str(relative) not in allowed_files:
                raise SystemExit(f'Unclassified tracked file, review package policy: {relative}')
            if relative.suffix.lower() in {'.sqlite', '.zip', '.log', '.pem', '.key', '.pwd'} or any(part in {'var', 'node_modules', '.env', '.git', 'dist'} for part in relative.parts):
                raise SystemExit(f'Private runtime or generated file cannot be packaged: {relative}')
            content = source.read(info)
            manifest['files'][str(relative)] = {'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}
            entries.append((info, content))
    required = {'public/index.html', 'public/settings.html', 'public/api.php', 'src/Workflow.php', 'src/Http.php', 'src/PublicDemo.php', 'deploy/hostinger/api.php', 'config/demo-tickets.json', 'tests/ui.mjs', 'package-lock.json', 'docs/api.md', 'docs/UPGRADING.md'}
    if not required.issubset(manifest['files']):
        raise SystemExit('Source package is missing required runtime, test or upgrade files.')
    output = Path(output) if output else ROOT / 'dist' / f'tft-{version}-source.zip'
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix('.tmp')
    with zipfile.ZipFile(temp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for info, content in entries:
            info.compress_type = zipfile.ZIP_DEFLATED
            target.writestr(info, content)
        metadata = zipfile.ZipInfo(prefix + 'PACKAGE-MANIFEST.json', date_time=entries[0][0].date_time)
        metadata.compress_type = zipfile.ZIP_DEFLATED
        target.writestr(metadata, json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    temp.replace(output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.sha256').write_text(f'{digest}  {output.name}\n')
    print(f'Built {output.name}: {len(entries)} source files, commit {commit[:12]}')
    return output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    build(parser.parse_args().output)
