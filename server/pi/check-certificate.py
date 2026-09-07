#!/usr/bin/env python3
"""Check certificate rotation and rejection of links outside Caddy storage."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

script = Path(__file__).with_name('sync-certificate.py')
with tempfile.TemporaryDirectory() as folder:
    home = Path(folder)
    private = home / '.config/bonk-club'
    source = private / 'caddy/certificates/acme-v02.api.letsencrypt.org-directory/test.example'
    source.mkdir(parents=True)
    (private / 'server.json').write_text(json.dumps({'hostname': 'test.example'}))
    cert, key = source / 'test.example.crt', source / 'test.example.key'
    cert.write_text('test certificate')
    key.write_text('test key')
    env = {**os.environ, 'HOME': str(home)}
    subprocess.run(['python3', str(script)], env=env, capture_output=True, check=True)
    assert (private / 'turn.key').read_text() == 'test key'
    assert (private / 'turn.key').stat().st_mode & 0o777 == 0o600
    outside = home / 'unrelated-private-file'
    outside.write_text('must remain inaccessible')
    key.unlink()
    key.symlink_to(outside)
    rejected = subprocess.run(['python3', str(script)], env=env, capture_output=True)
    assert rejected.returncode != 0
    assert (private / 'turn.key').read_text() == 'test key'
    # Also reject a linked parent directory, not just a linked certificate.
    key.unlink()
    key.write_text('test key')
    moved = source.with_name('moved')
    source.rename(moved)
    source.symlink_to(moved, target_is_directory=True)
    rejected = subprocess.run(['python3', str(script)], env=env, capture_output=True)
    assert rejected.returncode != 0
print('PASS certificate copy: rotation, private permissions, file and parent symlink rejection.')
