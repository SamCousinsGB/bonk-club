#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/bonk-club"
export PATH="$HOME/.local/node/bin:$PATH"
test -z "$(git status --porcelain)" || { echo 'Pi checkout has local changes; update stopped.'; exit 1; }
git fetch origin main
git merge --ff-only origin/main
npm ci --prefix server --omit=dev --ignore-scripts
npm test --prefix server
bash scripts/build-pi-turn.sh
python3 server/pi/check-certificate.py
umask 077
mkdir -p "$HOME/.local/state/bonk-club/backups"
backup=$(mktemp -d "$HOME/.local/state/bonk-club/backups/deploy-XXXXXXXX")
tar -czf "$backup/private-config.tar.gz" -C "$HOME/.config" bonk-club
# Preserve the local secret and addresses while updating generated configuration.
python3 - <<'PY'
import json
from pathlib import Path
import subprocess
c = json.loads((Path.home() / '.config/bonk-club/server.json').read_text())
subprocess.run(['python3', 'server/pi/configure.py', '--hostname', c['hostname'],
                '--public-ip', c['publicIp'], '--lan-ip', c['lanIp']], check=True)
PY
python3 server/pi/check-sandbox.py
mkdir -p "$HOME/.config/systemd/user"
for unit in server/pi/*.service server/pi/*.timer; do
  install -m 0644 "$unit" "$HOME/.config/systemd/user/$(basename "$unit")"
done
systemctl --user daemon-reload
systemctl --user enable --now bonk-room.service
systemctl --user restart bonk-room.service
if command -v caddy >/dev/null && command -v turnserver >/dev/null; then
  caddy validate --config "$HOME/.config/bonk-club/Caddyfile" --adapter caddyfile
  systemctl --user enable --now bonk-https.service bonk-turn.service bonk-certificate.timer
  systemctl --user restart bonk-https.service bonk-turn.service
fi
for attempt in 1 2 3 4 5; do
  if curl --fail --silent http://127.0.0.1:8787/healthz; then printf '\n'; exit 0; fi
  sleep 1
done
echo 'Room service did not become healthy.'
exit 1
