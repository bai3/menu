#!/usr/bin/env python3
"""Bump the Service Worker cache version in the index before a commit."""
import re
import subprocess
import sys
from pathlib import Path


def git(*args, input=None):
    return subprocess.run(['git', *args], input=input, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout


def main():
    # Do not create a commit just because the hook changed a file.
    if subprocess.run(['git', 'diff', '--cached', '--quiet', '--exit-code']).returncode == 0:
        return
    root = Path(git('rev-parse', '--show-toplevel').decode().strip())
    path = root / 'sw.js'
    staged = git('show', ':sw.js').decode('utf-8')
    working = path.read_text(encoding='utf-8')
    pattern = re.compile(r"(?m)^(const VERSION = ['\"]v)(\d+)(['\"];)$")
    staged_matches = list(pattern.finditer(staged))
    working_matches = list(pattern.finditer(working))
    if len(staged_matches) != 1 or len(working_matches) != 1:
        raise ValueError('sw.js must contain exactly one numeric VERSION, e.g. v33')
    version = max(int(staged_matches[0][2]), int(working_matches[0][2])) + 1
    def bump(content):
        return pattern.sub(lambda match: f'{match[1]}{version}{match[3]}', content, count=1)
    new_staged = bump(staged)
    new_working = bump(working)
    entry = git('ls-files', '--stage', '--', 'sw.js').decode().strip().split()
    if len(entry) != 4 or entry[2] != '0':
        raise ValueError('sw.js has an unresolved index entry')
    oid = git('hash-object', '-w', '--stdin', input=new_staged.encode()).decode().strip()
    git('update-index', '--cacheinfo', f'{entry[0]},{oid},sw.js')
    path.write_text(new_working, encoding='utf-8')
    print(f'Service Worker cache version updated to v{version}.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Could not update Service Worker version: {error}', file=sys.stderr)
        sys.exit(1)
