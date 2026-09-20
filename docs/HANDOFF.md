# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- v0.46.1 / protocol 69 hardens multiplayer scheduling and guest replay.
  Published gameplay revision: `955667b5b68562ae3fc186b89e4970e71f2391c6`.
  Refresh every player tab before creating or joining a room.
- Motion and world encoding/reconstruction have separate bounded workers and
  jobs. Codec errors do not retry on the render thread; worker stalls recover.
  Reliable fallback keeps its four-frame acknowledgement window during long
  guest stalls, and asymmetric channel failure retains sequenced controls.
  Rapid taps are acknowledged only after their press reaches simulation.
- Guest prediction reuses collision geometry with exact replay comparisons on
  every arena; falling wing removal invalidates the cache. Disabled-pose changes
  apply immediately, and the warp shader skips inactive sources. See
  [`NETCODE.md`](NETCODE.md) for measurements, reproduction and qualification limits.
- Water retains finite volume and horizontal momentum, forms deep pools, drains
  through destroyed supports and overtops low barriers. Side walls and ceilings
  stop jets. Currents apply mass-sensitive drag and buoyancy to fighters, loose
  props, weapon drops and death bodies; strong flows cause recoverable knockdowns.
- Fast falling water uses swept contact against the actual powered wire segments.
  Connected water and metal platforms share the host-owned electrical circuit;
  separating or draining the contact removes power on the next reaction tick.
- Transmission Towers retains eight tanks and its existing wire crossings. The
  tanks now hold 1,200 units each (previously 210). Larger tanks elsewhere hold
  960. Ruptures release compact outward-moving water; punctures produce finite
  pressure jets. The inner tower tanks are positioned to preserve every spawn
  and opening-pickup route. Larger tanks are heavier; visible gauges track contents.
- Joined curved pool surfaces, shaded depth, merged falling sheets and impact
  splashes follow the liquid geometry. Reduced motion suppresses surface shimmer.
  Water is bounded at 384 parcels and 640 depth; this is a foundation for future
  flooding arenas, not a shipped ship arena or a full fluid-dynamics solver.
- All 1,124 game tests, three server tests and the production build passed.
  The local 76-case stress run passed; final integrated release run
  [35537511009](https://github.com/SamCousinsGB/bonk-club/actions/runs/35537511009)
  passed shared/server tests, all six stress groups, Windows/Linux desktop checks,
  release consistency and Pages. All 17 public files match its exact CI artifact.
  The exact CI artifact and unmodified public v0.46.1 both passed real relay/relay
  controls, readiness/options, hot join and host departure with no page errors.
- Four-player source-browser checks passed matching destroyed-terrain IDs on
  hot join, round reset, 10% packet loss, delay, duplicate/reordered packets,
  a 1.2-second guest stall and 4x CPU throttling. These are one-machine checks;
  separate-ISP endurance and native Steam transport qualification remain open.
- The preceding v0.45.0 aircraft release remains included: larger four-engine
  wings, structural disconnection causing a shared aircraft spiral, falling wing
  collision and reduced hull/navigation work. Car Wash retains immediate belt
  drive, eight-second reversal, physical car and individually breakable machinery.

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
