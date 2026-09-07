#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run after local administrator authorization.'; exit 1; }
repo=/home/cnet/bonk-club
test -f "$repo/server/pi/firewall.py"
# Distribution defaults use system services and port 80. This deployment uses
# separate cnet user services on 8443/3478/5349 instead.
for unit in caddy.service coturn.service; do
  if systemctl is-active --quiet "$unit"; then
    echo "$unit already active; inspect before proceeding."
    exit 1
  fi
done
systemctl mask caddy.service coturn.service
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  caddy coturn bubblewrap cmake gcc g++ make pkg-config libssl-dev libevent-dev libsqlite3-dev libmicrohttpd-dev
python3 "$repo/server/pi/firewall.py"
echo 'Networking dependencies and game firewall rules installed.'
echo 'Run bash ~/bonk-club/scripts/update-pi.sh as cnet to start the user services.'
