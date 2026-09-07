#!/usr/bin/env python3
"""Limit public processes to game files, private scratch space and their own PIDs.

Network access is retained for WebRTC. This is filesystem/process containment,
not a separate machine or a guarantee against a kernel exploit.
"""
import os
from pathlib import Path
import sys


def command(role):
    home = Path.home()
    repo = home / 'bonk-club'
    private = home / '.config/bonk-club'
    runtime = home / '.local/lib/bonk-club'
    args = ['/usr/bin/bwrap', '--die-with-parent', '--new-session',
            '--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts',
            '--cap-drop', 'ALL', '--clearenv',
            '--setenv', 'HOME', str(home), '--setenv', 'PATH', '/usr/bin:/bin',
            '--setenv', 'LANG', 'C.UTF-8',
            '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
            '--symlink', 'usr/sbin', '/sbin', '--symlink', 'usr/lib', '/lib',
            '--ro-bind', '/etc', '/etc', '--proc', '/proc', '--dev', '/dev',
            '--tmpfs', '/tmp', '--tmpfs', '/run',
            '--dir', str(home), '--dir', str(private),
            '--ro-bind', str(repo), str(repo), '--chdir', str(repo)]
    if role == 'room':
        node = home / '.local/node/bin/node'
        args += ['--ro-bind', str(node), str(node),
                 '--ro-bind', str(private / 'server.json'), str(private / 'server.json')]
        program = [str(node), str(repo / 'server/index.js'), str(private / 'server.json')]
    elif role == 'https':
        (private / 'caddy').mkdir(exist_ok=True, mode=0o700)
        args += ['--ro-bind', str(private / 'Caddyfile'), str(private / 'Caddyfile'),
                 '--bind', str(private / 'caddy'), str(private / 'caddy')]
        program = ['/usr/bin/caddy', 'run', '--config', str(private / 'Caddyfile'),
                   '--adapter', 'caddyfile']
    elif role == 'turn':
        args += ['--ro-bind', str(runtime), str(runtime),
                 '--bind', str(private / 'turn-state'), str(private / 'turn-state')]
        for filename in ['turnserver.conf', 'turn.crt', 'turn.key']:
            file = private / filename
            if file.exists():
                args += ['--ro-bind', str(file), str(file)]
        program = ['/usr/bin/python3', str(repo / 'server/pi/run-turn.py')]
    else:
        raise ValueError('Unknown game service')
    return args, program


if __name__ == '__main__':
    args, program = command(sys.argv[1])
    os.execv(args[0], args + ['--'] + program)
