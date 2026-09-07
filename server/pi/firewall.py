#!/usr/bin/env python3
"""Add only the game ports to the existing IPv4 LAN firewall; preserve all other rules."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

if os.geteuid() != 0:
    sys.exit('Firewall setup requires local administrator authorization.')
config = Path('/etc/nftables.conf')
original = config.read_text()
rules = [
    'ip daddr 192.168.0.96 tcp dport { 8443, 3478, 5349 } ct state { new, established } accept comment "bonk-club-tcp"',
    'ip daddr 192.168.0.96 udp dport { 3478, 49160-49223 } ct state { new, established } accept comment "bonk-club-udp"',
]
live = json.loads(subprocess.check_output(['nft', '-j', 'list', 'chain', 'inet', 'lan_only', 'input']))
chain = next(item['chain'] for item in live['nftables'] if 'chain' in item)
if chain.get('hook') != 'input' or chain.get('policy') != 'drop':
    sys.exit('Unexpected firewall structure; no changes made.')
header = re.search(r'(chain\s+input\s*\{\s*type\s+filter\s+hook\s+input\s+priority\s+[^;]+;\s*policy\s+drop;)', original)
if not header or 'table inet lan_only' not in original:
    sys.exit('Unexpected persistent firewall structure; no changes made.')
existing = {item['rule'].get('comment') for item in live['nftables'] if 'rule' in item}
missing = [rule for rule in rules if rule.split('comment "')[1][:-1] not in existing]
new_text = original
if 'bonk-club-tcp' not in original and 'bonk-club-udp' not in original:
    new_text = original[:header.end()] + '\n        ' + '\n        '.join(rules) + original[header.end():]
elif any(marker not in original for marker in ['bonk-club-tcp', 'bonk-club-udp']):
    sys.exit('Partial game firewall configuration; no changes made.')
os.umask(0o077)
with tempfile.NamedTemporaryFile(mode='w', dir='/etc', prefix='.bonk-nft-', delete=False) as staged:
    staged.write(new_text)
try:
    subprocess.run(['nft', '--check', '--file', staged.name], check=True)
    backup = Path('/var/backups') / ('bonk-nftables-' + time.strftime('%Y%m%d-%H%M%S') + '.conf')
    backup.write_text(original)
    backup.chmod(0o600)
    if missing:
        batch = '\n'.join('insert rule inet lan_only input ' + rule for rule in missing) + '\n'
        subprocess.run(['nft', '--check', '--file', '-'], input=batch, text=True, check=True)
        subprocess.run(['nft', '--file', '-'], input=batch, text=True, check=True)
    Path(staged.name).replace(config)
    print('Game-only IPv4 ports added. Existing household and SSH rules preserved.')
    print('Firewall backup:', backup)
finally:
    Path(staged.name).unlink(missing_ok=True)
