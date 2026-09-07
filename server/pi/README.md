# Raspberry Pi networking

GitHub Pages serves the game. The Pi runs PeerJS signaling, an HTTPS credential
endpoint and coturn fallback. The host browser owns simulation, scores, slot
assignment and input validation. The Pi forwards encrypted WebRTC packets when
a direct browser connection cannot be established; it does not simulate matches.

## Installation

Use `/home/cnet/bonk-club`, checked out from GitHub `main`. Node is provided by
`/home/cnet/.local/node/bin/node`. Runtime secrets and certificates live only in
`~/.config/bonk-club/`, with private file permissions. Never commit that directory
or copy its contents into a diagnostic report.

1. Run `configure.py --hostname HOSTNAME --public-ip WAN_ADDRESS` as cnet.
   The default Pi address is `192.168.0.96`; reserve that address on the router.
2. Review and locally authorize `scripts/install-pi-network.sh`. It installs
   Debian Caddy/coturn, masks their unused system services, and adds two input rules
   and a relay egress restriction to the existing `inet lan_only` firewall. It does not expose SSH,
   port 80, or the household application ports. A root-only firewall backup
   is saved under `/var/backups/bonk-nftables-*.conf`.
3. Run `bash ~/bonk-club/scripts/update-pi.sh` as cnet. Routine deployments use
   this script without sudo. Services run under `systemctl --user`.
4. Forward only the following router ports to `192.168.0.96`:

   | Internet port | Protocol | Pi port | Purpose |
   | --- | --- | --- | --- |
   | 443 | TCP | 8443 | HTTPS signaling, credentials and certificate renewal |
   | 3478 | TCP and UDP | 3478 | STUN and TURN |
   | 5349 | TCP | 5349 | TURN over TLS |
   | 49160–49223 | UDP | 49160–49223 | TURN relay allocations |

   Do not forward port 80 or enable DMZ. Relay range ports must retain their
   numbers. Router WAN IPv4 must match the public IPv4; upstream NAT needs its
   own forwarding. No global IPv6 is used by this setup.
5. Caddy obtains and renews a Let's Encrypt certificate using the TLS challenge
   on public port 443. TURN serves UDP/TCP while waiting for that certificate;
   a timer copies new/renewed certificates and restarts TURN to enable TLS.
6. Verify HTTPS health, authenticated relay candidates and a real data channel
   forced through TURN, then join a running match from a different network.
   Only then set repository Actions variables `ROOM_SERVICE_URL` to
   `https://HOSTNAME/peerjs` and `TURN_CREDENTIALS_URL` to `https://HOSTNAME/ice`,
   and publish Pages. Both players must refresh after the switch.

## Limits and operation

The credential endpoint issues one-hour HMAC credentials; the long-lived secret
never reaches browsers. Rooms refresh credentials every twenty minutes for
new connections, so late arrivals do not inherit expired host credentials.
Allowed origins restrict ordinary browser access, but
are not authentication against arbitrary clients. Limits are 64 signaling
clients, 32 TURN allocations total, 8 per temporary username, 512 KiB/s per
allocation and 4 MiB/s aggregate. TURN cannot reach private, loopback, multicast
or IPv6 peer addresses. Coturn exempts its own mapped address from its IP deny
list; an output firewall rule confines traffic from its relay sockets back to
the Pi to the relay port range, protecting other local UDP services. TCP peer
relaying is disabled. Coturn and Caddy are resource-limited user services.

Use `systemctl --user status bonk-room bonk-https bonk-turn` and
`curl http://127.0.0.1:8787/healthz`. Do not publish raw TURN logs: they can contain
client addresses. `/healthz` verifies the room process and revision, not relay
reachability. A relay allocation alone does not prove packet delivery.

A free IP-based `sslip.io` hostname does not follow a changed home WAN address.
If the WAN address changes, regenerate configuration with the new hostname/IP,
restart HTTPS and TURN, verify it, update both repository variables and publish.
A stable dynamic-DNS hostname can later replace it without changing the game.

## Rollback

Unset the two repository variables and republish to restore PeerJS cloud/direct
connections. Stop/disable only the `bonk-*` user services and timer. Remove only
the `bonk-club-tcp`, `bonk-club-udp` and `bonk-club-relay-local` firewall rules and corresponding persistent
lines with local administrator authorization. Remove the router forwards.
Do not replace a newer household firewall wholesale with an old backup.
