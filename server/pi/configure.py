#!/usr/bin/env python3
"""Prepare private runtime configuration; never print relay secrets."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('--hostname', required=True)
parser.add_argument('--public-ip', required=True)
parser.add_argument('--lan-ip', default='192.168.0.96')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*[a-z0-9]', args.hostname):
    parser.error('Invalid hostname')
if not ipaddress.IPv4Address(args.public_ip).is_global:
    parser.error('A public IPv4 address is required')
ipaddress.IPv4Address(args.lan_ip)
os.umask(0o077)
private = Path.home() / '.config/bonk-club'
private.mkdir(parents=True, exist_ok=True, mode=0o700)
turn_state = private / 'turn-state'
turn_state.mkdir(exist_ok=True, mode=0o700)
config_path = private / 'server.json'
previous = json.loads(config_path.read_text()) if config_path.exists() else {}
config = {
    'hostname': args.hostname,
    'publicIp': args.public_ip,
    'lanIp': args.lan_ip,
    'origins': ['https://samcousinsgb.github.io'],
    'turnSecret': previous.get('turnSecret') or secrets.token_hex(32),
}
config_path.write_text(json.dumps(config, indent=2) + '\n')
config_path.chmod(0o600)
(private / 'Caddyfile').write_text('''{
    admin off
    https_port 8443
    auto_https disable_redirects
    storage file_system {
        root PRIVATE/caddy
    }
    servers {
        protocols h1 h2
    }
}
HOSTNAME {
    bind LAN_IP
    tls {
        issuer acme {
            dir https://acme-v02.api.letsencrypt.org/directory
            disable_http_challenge
        }
    }
    request_body {
        max_size 64KB
    }
    @api path /healthz /ice /peerjs/*
    handle @api {
        reverse_proxy 127.0.0.1:8787
    }
    respond 404
}
'''.replace('PRIVATE', str(private)).replace('HOSTNAME', args.hostname).replace('LAN_IP', args.lan_ip))

# Private and special-use addresses must never be accessible through TURN.
denied = [
    '0.0.0.0-0.255.255.255', '10.0.0.0-10.255.255.255',
    '100.64.0.0-100.127.255.255', '127.0.0.0-127.255.255.255',
    '169.254.0.0-169.254.255.255', '172.16.0.0-172.31.255.255',
    '192.0.0.0-192.0.0.255', '192.0.2.0-192.0.2.255',
    '192.168.0.0-192.168.255.255', '198.18.0.0-198.19.255.255',
    '198.51.100.0-198.51.100.255', '203.0.113.0-203.0.113.255',
    '224.0.0.0-255.255.255.255', '::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
]
turn = f'''listening-ip={args.lan_ip}
relay-ip={args.lan_ip}
external-ip={args.public_ip}/{args.lan_ip}
listening-port=3478
tls-listening-port=5349
min-port=49160
max-port=49223
realm={args.hostname}
server-name={args.hostname}
fingerprint
use-auth-secret
static-auth-secret={config['turnSecret']}
userdb={turn_state}/turn.sqlite
cert={private}/turn.crt
pkey={private}/turn.key
no-tlsv1
no-tlsv1_1
no-dtls
no-tcp-relay
no-multicast-peers
no-software-attribute
no-rfc5780
no-stun-backward-compatibility
response-origin-only-with-rfc5780
stale-nonce=600
user-quota=16
total-quota=32
max-allocate-lifetime=120
max-allocate-timeout=20
max-bps=131072
bps-capacity=4194304
relay-threads=2
pidfile={turn_state}/turn.pid
log-file=stdout
simple-log
'''
turn += ''.join(f'denied-peer-ip={address}\n' for address in denied)
(private / 'turnserver.conf').write_text(turn)
schema = Path('/usr/share/coturn/schema.sql')
if schema.exists():
    previous_db = private / 'turn.sqlite'
    current_db = turn_state / 'turn.sqlite'
    if previous_db.exists() and not current_db.exists():
        with sqlite3.connect(previous_db) as source, sqlite3.connect(current_db) as destination:
            source.backup(destination)
    with sqlite3.connect(current_db) as database:
        initialized = database.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='turnusers_lt'").fetchone()
        if not initialized:
            database.executescript(schema.read_text())
print('Private room, HTTPS and TURN configuration prepared.')
