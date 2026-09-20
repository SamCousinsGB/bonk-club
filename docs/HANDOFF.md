# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current work

- Ocean Liner candidate: v0.47.0 / protocol 70. All players must refresh before
  creating or joining a room. Last verified public release remains v0.46.1 until
  this candidate completes CI, Pages and public artifact/browser verification.
- New cutaway ocean vessel has five finite flood compartments. Collision-derived
  hull openings admit or drain water according to pressure head; dents remain
  sealed. Intact bulkheads retain water until overtopped or physically breached.
  Flood weight changes draft and list and can exhaust reserve buoyancy. Water
  free surfaces follow world gravity while the ship moves in its own frame.
- Primary action aims swimming strokes when immersed. Oxygen above submerged
  heads lasts twelve seconds, restores in air and then causes drowning damage.
  The shared movement code gives guests the same swimming, with host-only
  oxygen, damage, flood volume and buoyancy authority. Bots swim around decks
  toward air. Water floats cargo, drags loose objects and extinguishes fire.
- Original Canvas art includes a glazed bridge, lifeboats, funnel/rigging,
  illuminated cutaway rooms, pumps, marine engines, storage, continuous hull
  trim, sunset ocean, compartment water, bubbles and actual breach jets. Broken
  shell/deck/bulkhead artwork follows surviving collision. Physics is a bounded
  hydrostatic compartment model, not a full ocean fluid-dynamics solver.
- Focused physics checks cover sealing, single side plates, pressure flow,
  volume conservation, overtopping, list/sinking, oxygen/drowning, swim controls,
  cargo/death bodies, guest prediction, validation, aim transforms and reset.
  All 1,142 compact tests and the production build passed.
  Both Ocean Liner stress cases passed. The full arena stress run is in progress.
- Source-browser checks passed real relay/relay host/guest controls, ship map
  selection, guest mouse-directed and real touch swimming, oxygen use, exact damaged-world
  hot-join parity, small viewport/reduced motion and restored rounds, with no
  page errors. QA artifacts are in the adjacent `bonk-club-qa/ship-*` files.
- Existing v0.46.1 scheduling/replay improvements and finite parcel water remain
  intact; see `docs/NETCODE.md`. Previous aircraft and machinery arenas remain.

## Development and release

- `npm test` is the compact fast suite. `npm run test:stress` runs exhaustive arena
  simulations; CI splits them across six shards. `npm run test:release` runs both.
- Start from current `origin/main`, use focused tests during development, and run
  relevant full checks before integration. Preserve unrelated local work.
- Gameplay/art changes require source browser interaction and visual QA.
  Networking and persistent world changes require host/guest/hot-join checks.
- Keep GitHub `main`, public Pages assets and this short handoff consistent.
  Exact CI artifacts are the release parity source; do not claim pending work live.
