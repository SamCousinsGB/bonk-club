# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Source release: `origin/main` at `5dab657`.
- Game version: v0.43.0, protocol 66. Refresh every player tab before creating or
  joining a room.
- Cargo Plane Hold has a smooth riveted cutaway, recessed cabin structure, warm
  overhead lights, tapered wings, swept-blade turbofans and layered clouds.
  Interior area is 10.7% larger, with wider walkways and cargo floor. The whole
  aircraft banks and shifts; input aiming compensates for its displayed pose.
  Hull destruction opens local outward pressure jets affecting fighters, cargo,
  weapons, bodies, fragments and fluids, including through guest prediction.
  Car Wash has a slippery conveyor
  floor, a heavy physical car, striking brushes, finite rinse water and an opposing
  dryer. Both preserve authoritative hazard and prop state through reset and hot join.
- Release run [35533717480](https://github.com/SamCousinsGB/bonk-club/actions/runs/35533717480)
  passed 1,083 game tests, three server tests, all six arena-stress shards,
  Windows/Linux desktop checks, release consistency and Pages. The full local
  76-case stress run also passed; all 17 public files match the release artifact.
- Source browser checks verified intact/breached artwork, complete engine breakup,
  bot combat and reduced motion. Cabin artwork is cached; turbulence and
  decompression strength are unchanged. Public rendered gameplay and a real
  changed-world hot join passed, retaining missing platform sections and displaced
  cargo. Both production clients had clean consoles.

## Reconciled WIP

- The old `codex/survival-arenas` checkout was based on v0.24-era source. Its twelve
  failures came from incomplete Transmission Towers, black-hole pickup, hazard and
  menu-fight integration that current `main` had already superseded.
- A normalized file comparison confirmed that later `main` releases contain the
  relevant gameplay, networking, arena, desktop and test implementations. No old
  gameplay file was carried over current source.
- Rechecking current `main` passed the compact game suite, three server tests and
  production build. The obsolete dirty checkout and finished task worktrees can be
  removed after this branch is integrated.

## Development and release

- `npm test` is the compact fast suite. `npm run test:stress` runs exhaustive arena
  simulations; CI splits them across six shards. `npm run test:release` runs both.
- Start from current `origin/main`, use focused tests during development, and run the
  relevant full checks before integration.
- Gameplay/art changes require source browser interaction and visual QA. Networking
  changes require real host/guest/hot-join checks and relay evidence when TURN is in
  scope.
- Keep GitHub `main`, public Pages assets and this short handoff consistent. Do not
  append historical release narratives here.
