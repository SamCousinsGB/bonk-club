#!/usr/bin/env python3
"""Serve UDP/TCP immediately, enabling TLS once the public certificate exists."""
import os
from pathlib import Path

private = Path.home() / '.config/bonk-club'
ready = (private / 'turn.crt').is_file() and (private / 'turn.key').is_file()
binary = Path.home() / '.local/lib/bonk-club/coturn-4.17.2/bin/turnserver'
arguments = [str(binary), '-c', str(private / 'turnserver.conf')]
if not ready:
    arguments.append('--no-tls')
    print('TURN UDP/TCP starting; TLS will start after certificate issuance.', flush=True)
os.execv(arguments[0], arguments)
