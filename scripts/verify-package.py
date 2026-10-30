#!/usr/bin/env python3
"""Verify package integrity and run the complete test suite from its extracted source."""
import argparse
import hashlib
import json
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]

def verify(archive):
    with tempfile.TemporaryDirectory(prefix='tft-package-') as directory:
        destination = Path(directory)
        with zipfile.ZipFile(archive) as package:
            names = package.namelist()
            if len(names) != len(set(names)): raise SystemExit('Duplicate package paths.')
            roots = {PurePosixPath(name).parts[0] for name in names}
            if len(roots) != 1: raise SystemExit('Use one package root.')
            root = next(iter(roots))
            for info in package.infolist():
                path = PurePosixPath(info.filename)
                if '\\' in info.filename or ':' in info.filename or path.is_absolute() or '..' in path.parts or stat.S_ISLNK(info.external_attr >> 16): raise SystemExit('Unsafe package entry.')
            manifest = json.loads(package.read(root + '/PACKAGE-MANIFEST.json'))
            expected = {root + '/' + name for name in manifest['files']} | {root + '/PACKAGE-MANIFEST.json'}
            if expected != set(names): raise SystemExit('Manifest and source archive differ.')
            for name, record in manifest['files'].items():
                data = package.read(root + '/' + name)
                if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']: raise SystemExit('Package digest mismatch: ' + name)
            package.extractall(destination)
        project = destination / root
        print('Manifest verified. Installing locked test dependencies in the extracted copy.', flush=True)
        subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=project, check=True)
        subprocess.run(['make', 'test'], cwd=project, check=True)
        print(f'PASS extracted package {manifest["version"]}, source commit {manifest["sourceCommit"][:12]}, {len(manifest["files"])} verified source files')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path, nargs='?')
    args = parser.parse_args()
    if args.archive is None:
        spec = spec_from_file_location('build_package', ROOT / 'scripts/build-package.py')
        builder = module_from_spec(spec); spec.loader.exec_module(builder)
        archive = builder.build()
    else: archive = args.archive
    verify(archive)
