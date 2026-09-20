# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Source release: `origin/main` at `d90551a` (v0.45.0 aircraft wing failure).
- Game version: v0.45.0, protocol 68. Refresh every player tab before creating or
  joining a room.
- Cargo Plane Hold has a smooth riveted cutaway, recessed cabin structure, warm
  overhead lights, swept-blade turbofans and layered clouds. Wings now extend
  well beyond both screen edges, with four engines and thicker structural spars.
  Interior area is 10.7% larger, with wider walkways and cargo floor. The whole
  aircraft banks and shifts; input aiming compensates for its displayed pose.
  Hull destruction opens local outward pressure jets affecting fighters, cargo,
  weapons, bodies, fragments and fluids, including through guest prediction.
- Actual loss of wing/fuselage connectivity latches a roll toward the broken side
  and a sustained spiral. Dents retain the connection; isolated hull plating does
  not count as an anchor. Detached sections keep falling collision and engines
  until leaving the arena. Shared host/guest gravity follows the roll, pointer and
  controller aim follows the displayed pose, and the cabin stays inside the frame.
  Offscreen wings are excluded from weapon and late-join spawn selection.
- Plane bot flight searches yield every eight traces and prioritise playable decks.
  Hull texture and breach-ray caches reuse unchanged geometry across snapshots.
  `node scripts/plane-profile.mjs` reduced the largest navigation stall from 248 ms
  to around 4–6 ms on the development machine. Sustained source-browser drawing
  measured roughly 1.7–2.1 ms p95; these are local CPU timings, not internet latency.
- Car Wash now has a tiled hall, suspended service decks, cloth brush cylinders,
  rinse arch and twin dryer fans. The seven contiguous belts start on the first
  combat tick and reverse every eight seconds after an amber warning. The shaped
  physical car stays in play between breakable end stops. Steel floor/decks resist
  bullets and retain circular blast cuts; removed contacts cannot drive the car.
  Individual brush/rinse/dryer mounts disable their matching art and effects.
- Source-browser checks passed left/right wing loss, inverted and sustained rolls,
  reduced-motion framing, actual host/guest replication, a late join after wing
  failure and aircraft restoration. Temporary blast/inspection controls were removed.
- Release run [35535896441](https://github.com/SamCousinsGB/bonk-club/actions/runs/35535896441)
  passed 1,094 game tests, three server tests, all six arena-stress shards,
  Windows/Linux desktop checks, release consistency and Pages. The full local
  76-case stress run and both focused Cargo Plane stress cases passed too.
- All 17 public files match the exact CI artifact. Unmodified public v0.45.0
  passed plane map selection, host/guest joining, ready/start and ongoing bot combat
  through the next round, with clean browser logs. Deliberate structural failure,
  changed-world hot join and reset assertions were performed in the source build.

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
