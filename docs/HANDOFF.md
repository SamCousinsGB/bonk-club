# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Source release: `origin/main` at `e6af58b` (v0.44.0 Car Wash pass).
- Game version: v0.44.0, protocol 67. Refresh every player tab before creating or
  joining a room.
- Cargo Plane Hold has a smooth riveted cutaway, recessed cabin structure, warm
  overhead lights, tapered wings, swept-blade turbofans and layered clouds.
  Interior area is 10.7% larger, with wider walkways and cargo floor. The whole
  aircraft banks and shifts; input aiming compensates for its displayed pose.
  Hull destruction opens local outward pressure jets affecting fighters, cargo,
  weapons, bodies, fragments and fluids, including through guest prediction.
- Car Wash now has a tiled hall, suspended service decks, cloth brush cylinders,
  rinse arch and twin dryer fans. The seven contiguous belts start on the first
  combat tick and reverse every eight seconds after an amber warning. The shaped
  physical car stays in play between breakable end stops. Steel floor/decks resist
  bullets and retain circular blast cuts; removed contacts cannot drive the car.
  Individual brush/rinse/dryer mounts disable their matching art and effects.
- Local source-browser checks passed actual host/guest controls, immediate car
  movement, rinse, reversed belts, changed-world hot join, round reset, small
  viewport and reduced motion with no browser errors. Focused car-wash simulation
  passed bot combat and sustained four-player input.
- Release run [35534186478](https://github.com/SamCousinsGB/bonk-club/actions/runs/35534186478)
  passed 1,087 game tests, three server tests, all six arena-stress shards,
  Windows/Linux desktop checks, release consistency and Pages. The full local
  76-case stress run also completed successfully; final integrated Car Wash
  stress and the full game suite passed after incorporating the aircraft release.
- All 17 public files match the exact CI artifact. An unmodified public v0.44.0
  browser session passed map selection, host/guest movement and jumping, ongoing
  bot combat, a third player's hot join and a small viewport, with no page or
  console errors. Public snapshots were observed through normal gameplay;
  deliberate changed-world/reset assertions were performed in the source build.

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
