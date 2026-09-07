#!/usr/bin/env python3
"""Exercise the actual service sandbox without opening a service listener."""
import subprocess
from sandbox import command

probe = '''
import errno
from pathlib import Path
home = Path.home()
for path in [home / '.ssh', home / 'financial-dashboard', home / 'home-dashboard',
             Path('/run/user/1000/bus'), Path('/root')]:
    assert not path.exists(), str(path) + ' is visible'
repo = home / 'bonk-club'
try:
    with (repo / '.sandbox-write-check').open('x'):
        pass
except OSError as error:
    assert error.errno in [errno.EROFS, errno.EACCES]
else:
    (repo / '.sandbox-write-check').unlink()
    raise AssertionError('Game code is writable')
assert (repo / 'server/index.js').is_file()
assert (Path('/tmp') / 'isolated-write').write_text('check') == 5
'''
for role in ['room', 'https', 'turn']:
    args, _ = command(role)
    subprocess.run(args + ['--', '/usr/bin/python3', '-c', probe], check=True)
    print(f'PASS {role}: household files and user service socket hidden; game code read-only.')
