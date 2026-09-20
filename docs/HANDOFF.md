# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Source release: `origin/main` at `8bc62c9`.
- Game version: v0.42.0, protocol 65. Refresh every player tab before creating or
  joining a room.
- Cargo Plane Hold is an oval cutaway with wings and exposed turbines. The whole
  aircraft banks and shifts; input aiming compensates for its displayed pose.
  Hull destruction opens local outward pressure jets affecting fighters, cargo,
  weapons, bodies, fragments and fluids, including through guest prediction.
  Car Wash has a slippery conveyor
  floor, a heavy physical car, striking brushes, finite rinse water and an opposing
  dryer. Both preserve authoritative hazard and prop state through reset and hot join.
- Release run [35530173579](https://github.com/SamCousinsGB/bonk-club/actions/runs/35530173579)
  passed 1,079 game tests, three server tests, all six arena-stress shards,
  Windows/Linux desktop checks, release consistency and Pages. The full local
  76-case arena stress run also passed. All 17 public files match the CI artifact.
- Source browser checks verified whole-plane motion, actual roof/side holes and
  upward/outward ejection. A real guest joined a damaged plane and retained the
  existing breaches, jets and displaced cargo. The same changed-world hot join
  passed on the public v0.42.0 build; host and guest consoles had no errors.

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
