#!/usr/bin/env python3
"""Serve UDP/TCP immediately, enabling TLS once the public certificate exists."""
import os
from pathlib import Path
import subprocess

private = Path.home() / '.config/bonk-club'
sync = Path(__file__).with_name('sync-certificate.py')
ready = subprocess.run(['/usr/bin/python3', str(sync)], check=False).returncode == 0
arguments = ['/usr/bin/turnserver', '-c', str(private / 'turnserver.conf')]
if not ready:
    arguments.append('--no-tls')
    print('TURN UDP/TCP starting; TLS will start after certificate issuance.', flush=True)
os.execv(arguments[0], arguments)
