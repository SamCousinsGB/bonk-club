# Bonk Club — current handoff

Updated 27 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Desktop-only scope

Sam's direction on 27 September 2026: PC/Desktop only. Do not design, build,
emulate, test or check phone/mobile/tablet support. This overrides all historical
mobile notes, including archived release evidence. Desktop browsers, Windows/Linux
builds, keyboard/mouse, controllers, window resizing and fullscreen remain in scope.

## Train crash update

- v0.54.0 / protocol 75 makes derailments brake sharply, jackknife and pile up.
  Carriages compress their physical and drawn bodies, rupture once on sufficient
  damage, and discharge finite four-second electrical arcs. Crashes still strike
  fighters, props, weapons, debris and other terrain; surviving track is exempt
  from carriage impact cuts and train power-pack explosions. Signals remain visible
  after a wreck leaves the arena, without a false fixture-shattering effect.
- Focused crash/fixture tests, full regular suite and both Bullet Train stress cases
  pass on the integrated source. Desktop browser host/guest movement, an actual
  crash and changed-world hot join show identical carriage and terrain state.
  Evidence: `bonk-club-qa/train-crash/`. Full release CI/Pages and public parity
  must pass before this update is described as live. Refresh all player tabs.
- Includes the concurrent desktop-only, Waterworks, Foundry, status and Ocean Liner
  changes below. Does not change their scope or restore phone support.

## Previous desktop release

- v0.53.1 / protocol 74 removes touch gestures and buttons, phone menus, rotate
  prompts, orientation locking, automatic fullscreen on joining/starting, portrait
  camera tracking, the phone overview and phone-specific CSS. Fullscreen is explicit.
- Removed mobile test suites and phone-size checks from the browser multiplayer
  harness. Desktop aiming tests cover 16:9, 16:10 and ultrawide letterboxing.
- Local shared tests, desktop unit tests, Windows executable smoke and desktop
  browser host/guest/hot-join checks passed before integration. The desktop menu
  and actual gameplay were visually inspected. No mobile checks were performed.
- Published with v0.53.2 / revision `ddba2a8` after the concurrent Waterworks fix.
  [Release workflow 36322939163](https://github.com/SamCousinsGB/bonk-club/actions/runs/36322939163)
  passed shared/server tests, all six stress shards, Windows/Linux executable
  checks and packaging, release verification and Pages. All 17 local, CI and public
  files matched byte for byte. Public desktop host/guest controls, hot join and host
  departure passed with relay routes and no page errors. Desktop menu/gameplay
  were visually verified. Evidence: `bonk-club-qa/desktop-only-parity.json` and
  `bonk-club-qa/desktop-only-public.json`. No mobile checks or builds were run.

## Previous gameplay update

- v0.53.0 / protocol 74 adds bottom-centred status icons for the local living
  fighter: Frozen, Chilled, Burning, Glued, Flammable, Wet, Bubbled, Jelly, Gold,
  Tangled and remaining air/Drowning. Countdown text comes from actor state;
  glue is untimed and oil/tar or water contact hides continuously refreshed timers.
  Ordinary hit stun is omitted. Round end, death and leaving play clear the row.
- Oil/tar adds bounded pose-attached coating and drips. Status icons preserve
  animation while timers update and respect reduced motion. No gameplay balance, wire protocol or persistent state changed.
- Focused effect/reaction tests, full tests and browser build pass. Source-browser
  checks cover timed expiry, untimed glue, death clearing, desktop/mobile layout,
  reduced motion and existing snapshot round trips. Evidence: `bonk-club-qa/status-*`.
  Confirm the release workflow and exact public artifact parity before claiming
  this revision live; the final verification record is `status-release.json` there.

## Included Scrap Foundry update

- v0.52.0 / protocol 74: Scrap Foundry ladles share the rotated spout position
  between art, molten emission and AI warnings. Opposite tilts pour inward; the
  shared solver preserves finite contents and real travel/contact damage.
- Two blocked-outlet-aware scrap feeders supply bounded physical metal to the
  immediately running inward belts. New lower slatted crossings pass molten
  streams through to the pits; upper routes remain available. Either broken
  ladle attachment stops emission, and destroyed crossings persist until reset.
- Focused tests cover mirrored lips, warnings, grating drainage, bounded scrap,
  attachment destruction and compact changed-world hot join/reset. Source browser
  checks confirmed both pours, scrap motion, cut geometry and a guest joining a
  damaged ongoing round without console errors. Release CI and public parity must
  finish before this revision is described as live.
- Preserves the v0.51.0 Ocean Liner changes and v0.50.3 round-result fix below.

## Earlier updates

- v0.51.0 / protocol 73 enlarges Ocean Liner: the hold is 540 units deep (20%
  deeper), the ship frame renders at full scale instead of 0.9, and lower ledges
  retain normal double-jump exits. Refresh all player tabs before joining.
- Quiet recessed rooms replace decorative pipes, engines, racks, ribs and stairs.
  Muted superstructure and sparse railings leave actual platforms, fighters,
  pickups, hull openings and flood surfaces readable. Physical cargo remains.
- Shared hull depth drives collision, flood capacity, shell art, water clipping,
  submerged openings and transported state. Lower side-plate flooding and real
  double-jump landings in all five compartments are covered by regression tests.
- Source browser checks cover movement, a flooded damaged-hull snapshot round
  trip, rendering at 1600x900 and 844x390, and reduced motion. Production browser
  checks cover host/guest movement, real lobby map selection and a third player
  joining the active round, with no browser errors. Evidence:
  `bonk-club-qa/ocean-readability-*`.
- Published gameplay revision `3d55d84` passed 1,187 regular tests, all six arena
  stress shards, Windows/Linux checks and Pages deployment in
  [release workflow 36322244912](https://github.com/SamCousinsGB/bonk-club/actions/runs/36322244912).
  All 17 local, CI and public browser files matched byte for byte. Fresh public
  v0.51.0 host/guest movement, map selection and a third-player hot join passed
  with no browser errors. Later releases above include this verified update.

## Included prior fix

- v0.50.3 / protocol 72 fixes a round-end deadlock: submerged/frozen leaking
  explosive containers have suspended fuses and no longer prevent a survivor win.
  Active fuses still delay scoring and can turn that survivor into a draw.
- Regression coverage includes four-player drowning with both explosive container
  types, exactly one awarded point, the next round, valid result snapshots,
  simultaneous drowning and a final active barrel explosion. Source-browser QA
  confirms drowning result and next-round progression with no browser errors.
  Evidence: `bonk-club-qa/drowning-round-*`. Verify this revision's release workflow
  and public artifact parity before claiming it live.
- Earlier v0.50.x updates preserve fixed-height exterior seawater, sinking escape
  checks, all-dead draws and the Arc Furnace molten breach correction.

## Previous full release verification

- v0.49.1 / protocol 72, gameplay revision `310cad6`. Refresh all player tabs
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
- Gameplay/art changes require desktop source browser interaction and visual QA.
  Networking and persistent world changes require host/guest/hot-join checks.
- Keep GitHub `main`, public Pages assets and this short handoff consistent.
  Exact CI artifacts are the release parity source; do not claim pending work live.
