# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Published v0.48.0 / protocol 71 unifies liquid simulation. Gameplay revision:
  `056aa6c7cb5068942363e7a31c784568cefa86a1`. Refresh every player tab before
  creating or joining a room.
- Water, oil, glue, tar and molten metal use `src/liquid.js` for finite admission,
  gravity, momentum, deep pools, wall/ceiling collision, overflow, dam breaks and
  forces on fighters, props, loose weapons and death bodies. Material viscosity,
  burning, stickiness, freezing and conductivity remain distinct. The shared
  budget is 384 parcels, with depth bounded at 640; rejected volume stays in its
  source. The old spill solver and analytic molten-stream damage are removed.
- Falling liquid artwork, wetting and electrical contact share volume-preserving
  stretched bounds. Thin films participate in the circuit; fast crossings use
  swept wire contact. Tail length cannot extend above its source, and positive
  microscopic volume survives network quantization. Breaking a source/contact
  removes power on the next reaction tick. Oil, glue and tar remain insulating.
- The host randomises water-tank and oil/glue/tar barrel sizes each round across
  the map rotation, with capacity and mass following size. Resize checks preserve
  spawn and terrain clearance. Transmission retains eight finite tanks, existing
  crossings and the shifted inner-tank centres that preserve traversal. Tank
  capacity is up to 1,200, rather than a fixed amount in every casing.
- Foundry ladles hold finite 3,000-unit supplies. Furnace breaches emit at their
  actual openings and stop below the melt level; emitted metal keeps moving.
  Molten pits have physical retaining walls and drain through damaged floors or
  walls. Molten contact is swept so fast jets cannot skip a fighter. Ladles stop
  and look empty when drained. Host snapshots, compression, guest interpolation
  and reset carry shared fluid state and container dimensions/capacities.
- Pools use joined curved surfaces and material palettes; touching falling
  parcels form sheets. Render-only liquid leak dots were removed so artwork
  cannot imply an electrical connection absent from the fluid simulation.
- Ocean Liner remains included: five flood compartments, through-hull pressure
  flow, bulkheads, listing/sinking, aim-directed swimming, twelve-second oxygen,
  host-owned drowning, guest prediction and changed-world hot join. Its large
  reservoirs use the shared engine's conservative volume exchange, admission and
  drag, retaining their geometry and bounded pressure. Free water joins flood
  mass on reaching the hull floor or an existing water surface. Flooded rooms
  join the same electrical circuit as streams and metal, with contacts clipped
  to the actual tilted water polygon. Empty rooms cannot retain electrical power.
- The v0.47.1 lifeboat artwork fix remains included: davits, bracing, footplates
  and suspension cables follow the ship frame and surviving deck mounts.
- Release proof: 1,164 compact tests, all 78 arena stress checks and the production
  build passed locally. [Release run 35540739011](https://github.com/SamCousinsGB/bonk-club/actions/runs/35540739011)
  passed game/server checks, all stress groups, Windows/Linux packaging and smoke
  checks, release fingerprints and Pages. All 17 public files match its exact
  browser artifact. Artifact and public browsers passed three-player Tower and
  Ocean Liner controls, jumping, mid-match joining and small-screen rendering,
  with no browser errors.
- Source checks passed mixed liquids, powered streams, changed-world hot join
  parity, randomized capacities and reset. Four-player relay ship checks covered
  flooding, mouse/touch swimming, oxygen, electrically charged floodwater and
  damaged-hull hot join. Foundry pouring, furnace breaches, smooth pools and
  falling wire contact were visually checked. Evidence: `bonk-club-qa/shared-*`.
- v0.46.1's multiplayer scheduling and guest replay improvements remain included:
  separate bounded motion/world workers, sequenced controls, reliable fallback,
  cached prediction geometry and immediate disabled poses. See
  [`NETCODE.md`](NETCODE.md) for measurements and qualification limits. These
  browser checks are on one machine; separate-ISP and native Steam qualification
  remain open.

## Development and release

- `npm test` is the compact fast suite. `npm run test:stress` runs exhaustive arena
  simulations; CI splits them across six shards. `npm run test:release` runs both.
- Start from current `origin/main`, use focused tests during development, and run
  relevant full checks before integration. Preserve unrelated local work.
- Gameplay/art changes require source browser interaction and visual QA.
  Networking and persistent world changes require host/guest/hot-join checks.
- Keep GitHub `main`, public Pages assets and this short handoff consistent.
  Exact CI artifacts are the release parity source; do not claim pending work live.
