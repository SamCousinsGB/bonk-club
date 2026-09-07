#!/usr/bin/env python3
"""Copy renewed Caddy certificates for coturn, restarting only when changed."""
import json
import os
from pathlib import Path
import subprocess
import stat
import sys

os.umask(0o077)
private = Path.home() / '.config/bonk-club'
hostname = json.loads((private / 'server.json').read_text())['hostname']
source = private / 'caddy/certificates/acme-v02.api.letsencrypt.org-directory' / hostname
cert, key = source / (hostname + '.crt'), source / (hostname + '.key')
if not cert.exists() or not key.exists():
    print('Waiting for the public HTTPS certificate.')
    sys.exit(1)
changed = False

def read_certificate(name):
    # Caddy can write its own storage, but cannot use certificate copying to
    # follow a symlink out into another application's files. Open each component
    # relative to its checked parent to avoid symlink races.
    fd = os.open(private, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for component in ['caddy', 'certificates', 'acme-v02.api.letsencrypt.org-directory', hostname]:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
        file = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=fd)
        with os.fdopen(file, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > 65536:
                raise ValueError('Invalid certificate file')
            return stream.read(65537)
    finally:
        os.close(fd)

for original, name in [(cert, 'turn.crt'), (key, 'turn.key')]:
    destination = private / name
    content = read_certificate(original.name)
    if not destination.exists() or destination.read_bytes() != content:
        temp = destination.with_suffix('.new')
        temp.write_bytes(content)
        temp.chmod(0o600)
        temp.replace(destination)
        changed = True
if '--restart' in sys.argv and changed:
    subprocess.run(['systemctl', '--user', 'restart', 'bonk-turn.service'], check=True)
print('TURN certificate current.')
