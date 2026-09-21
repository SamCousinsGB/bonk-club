# Bonk Club — current handoff

Updated 21 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Live: v0.49.1 / protocol 72, gameplay revision `310cad6`. Refresh all player tabs
  before joining.
- Six breakable mains feed a 1,216-unit central basin with shared finite-volume
  water, overflow and drainage through actual blast cuts. Eight movable generators
  cycle 7 seconds off / 1 amber warning / 4 live. Only connected water and metal
  conduct; destroying a generator removes its source. Upper catwalks and submerged
  exit ledges preserve traversal. The pool uses shared swimming, twelve-second
  oxygen, host-owned drowning and guest prediction.
- Slatted catwalks pass water through. Shared pool pressure uses the wetted face
  for lateral flow, so continuous mains level and overflow instead of forming tall
  columns. A 63-second source-browser soak stabilised at depth 434; a bottom breach
  reduced maximum depth to 182 after two more seconds. Lights clear the HUD.
- Pipe throat identity and geometry drive emission and clipped artwork. Destroyed
  throats stop; released water continues falling. No new unbounded liquid budget.
  Source state, water, geometry, generators and reset survive changed-world hot join.
- Wholly escaped props, chunks and death bodies are removed from the world and
  snapshots. Escaped projectiles are removed without remote explosions or fields;
  returning weapons, high arcs and in-arena projectiles retain their flight rules.
  Occupant/score records remain so falling deaths still resolve rounds correctly.
- Local verification: 1,177 regular tests, focused Waterworks and cleanup tests,
  the two Waterworks stress cases and the production build passed. Source browsers
  passed real lobby selection, host/guest movement, guest swimming, powered water,
  damaged pipe/basin hot-join parity, small-screen/reduced-motion drawing and reset.
  Evidence: `bonk-club-qa/waterworks-*`.
- [Release workflow 35551871352](https://github.com/SamCousinsGB/bonk-club/actions/runs/35551871352)
  passed the full 80-case arena stress suite, validation, Windows/Linux desktop
  checks, release verification and Pages deployment. All 17 CI browser files
  matched the clean tested local build and the public site byte for byte.
- Fresh public v0.49.1 browsers passed host/guest readiness and match start, then
  a third player hot joined the running flooded round with damaged scenery and
  live electrical effects. All three tabs reported no console errors. Evidence:
  `bonk-club-qa/waterworks-patch-parity.json` and `waterworks-public-v0.49.1.md`.
- Existing v0.48.0 shared-liquid, Ocean Liner, aircraft and networking behaviour
  remains. See the relevant source/tests and `NETCODE.md`; the browser checks above
  run on one machine and do not constitute separate-ISP or native Steam qualification.

## Development and release

- `npm test` is the compact fast suite. `npm run test:stress` runs exhaustive arena
  simulations; CI splits them across six shards. `npm run test:release` runs both.
- Start from current `origin/main`, use focused tests during development, and run
  relevant full checks before integration. Preserve unrelated local work.
- Gameplay/art changes require source browser interaction and visual QA.
  Networking and persistent world changes require host/guest/hot-join checks.
- Keep GitHub `main`, public Pages assets and this short handoff consistent.
  Exact CI artifacts are the release parity source; do not claim pending work live.
