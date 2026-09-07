#!/usr/bin/env python3
"""Copy renewed Caddy certificates for coturn, restarting only when changed."""
import json
import os
from pathlib import Path
import subprocess
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
for original, name in [(cert, 'turn.crt'), (key, 'turn.key')]:
    destination = private / name
    content = original.read_bytes()
    if not destination.exists() or destination.read_bytes() != content:
        temp = destination.with_suffix('.new')
        temp.write_bytes(content)
        temp.chmod(0o600)
        temp.replace(destination)
        changed = True
if '--restart' in sys.argv and changed:
    subprocess.run(['systemctl', '--user', 'restart', 'bonk-turn.service'], check=True)
print('TURN certificate current.')
