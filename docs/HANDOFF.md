# Bonk Club — current handoff

## Suspension Bridge rebuild (v0.58.0 / protocol 80)

- Rebuilt the harbour, water, skyline and dock scenery; riveted red tower
  cutaways have lit rooms, service equipment and recessed road portals. Road
  girders and asphalt, rear railings, suspension clamps and gantries replace
  the generic platform art. Foreground surfaces use the shared destruction clip.
- Wider tower interiors and upper balconies give four starts above traffic.
  Three suspended maintenance bays follow the damaged road, retain blast cuts,
  and fall out of the world when both actual hanger attachments are removed.
  Removed the unrelated steam traps and added physical maintenance cargo.
- Cars face their travel direction in both art and collision. Corrected
  left-bound downhill acceleration. Broken tiles cannot draw connecting beams
  across the middle expansion joint or between crater fragments.
- Focused mechanics, route checks, desktop intact/collapsed renders and a
  changed-world host/guest/late-join comparison passed. Full release verification
  is in progress. Refresh all players together for protocol 80.

## Colossus (v0.57.0 / protocol 79)

- A tiny square-headed ancient mech stands on the remote horizon with torso and
  limbs visible through layered mountain mist. This follows Sam's latest request
  for a much more distant, creepier figure. Original generated matte artwork,
  art direction and generation prompts are recorded in `docs/COLOSSUS.md`.
- Low connected stone terraces preserve the skyline and offer escape routes.
  Eyes follow the living fighters with a slow cascaded delay. Every forty seconds
  an alternating eye charges for ten seconds and sweeps a laser for 4.5 seconds.
  Perspective tapers the beam from the distant aperture into the foreground.
- Host-owned damage, warning geometry, live terrain cuts and lighting agree.
  Cuts persist through validated compact snapshots and hot joins; local weapons
  cannot remove the remote controller. Bots escape through ordinary movement.
  Audio seeks correctly when joining or unmuting; effects respect reduced motion.
- Fifteen focused mechanics/audio tests, the full regular suite, all six local
  stress shards, the browser build and desktop visual inspection pass. Release
  [workflow 36333073131](https://github.com/SamCousinsGB/bonk-club/actions/runs/36333073131)
  passed validation, all six CI stress shards, Windows/Linux executable checks,
  common-revision verification and Pages deployment for `05e2865`.
- All 18 local, CI and public browser files match byte for byte. Public v0.57.0
  desktop play passes measured host/guest movement, natural charge/discharge,
  relay-only late join after laser cuts, resizing/reduced motion and host
  departure with no browser errors. Source testing additionally compared exact
  damaged terrain/eye state, second-eye firing, mute/seek and round reset.
  Evidence is in `bonk-club-qa/colossus`; this is one-machine TURN verification,
  not cross-ISP latency or Steam connectivity proof. Players must refresh for
  protocol 79. Both task-owned development servers were stopped.

## Suspension Bridge (v0.56.0 / protocol 78)

- Added a desktop arena with two suspended road spans, tower interiors and lower
  maintenance gantries. Both main cables are physical segmented strands. Gunfire,
  beams and blasts sever links; surviving hanger runs determine deck support.
- Each deck panel follows a damped articulated collapse toward its tower. A
  severed half folds toward vertical, carries fighters while moving, and drops
  physical traffic when support is lost. Cars enter alternately, drive only
  while supported by surviving road, collide with fighters and one another,
  take damage and leave the arena when they fall or drive out.
- Cable, deck and vehicle state are host owned and validated in snapshots for
  reset and changed-world joins. Focused and full regular tests, the bridge
  stress cases, and desktop visual checks passed. A source browser host, guest
  and late joiner received matching cut cables, blasted panels and moving cars.
- Gameplay revision `07e7164` passed [release workflow 36331864179](https://github.com/SamCousinsGB/bonk-club/actions/runs/36331864179):
  validation, all six stress shards, Windows and Linux desktop builds, release
  verification and Pages deployment. All 17 local, CI and public browser files
  matched byte for byte. Fresh public desktop host, guest and late-join controls
  passed with relay routes and no page errors. These browser checks ran on one
  machine and do not establish cross-ISP or native Steam performance.

Updated 27 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Chilled visual fix

- v0.54.5 replaces the fixed blue chilled rectangle with a light outline that
  follows the fighter's joints. Frozen crystal art remains pose-attached.
- Focused effect tests, the full regular suite, the browser build and desktop
  visual comparison of chilled and frozen poses passed locally. Release
  [workflow 36330072700](https://github.com/SamCousinsGB/bonk-club/actions/runs/36330072700)
  passed validation, all six arena stress shards, Windows and Linux desktop
  checks, release verification and Pages deployment. All 17 public files match
  the CI browser artifact byte for byte; the public menu reports v0.54.5.

## Desktop-only scope

Sam's direction on 27 September 2026: PC/Desktop only. Do not design, build,
emulate, test or check phone/mobile/tablet support. This overrides all historical
mobile notes, including archived release evidence. Desktop browsers, Windows/Linux
builds, keyboard/mouse, controllers, window resizing and fullscreen remain in scope.

## Bottom monorail arena

- v0.55.0 / protocol 77 moves the guideway to y=1380, reduces train speed by
  exactly 20% to 5120, and removes both rectangular motion smears. Elevated
  concourses, staggered service grates and balconies share the normal navigation,
  jump-through and destruction rules. All spawns can reach both opening weapons.
- A persistent service clock continues two-second signals and alternating trains
  every eleven seconds after approach damage or derailment. Previous articulated
  wrecks retain distinct IDs and collide with later services; escaped wrecks clear.
  Up to six archived sets remain articulated; older sets enter the existing bounded
  physical metal-rubble system. Black holes cannot delete the service controller.
- Keeps the prior mechanical crash artwork, braking, torn metal, contact sparks
  and finite dust. Crashes preserve surviving guideway and fixed signals.
- Focused coverage includes double-jump clearance, rotated collision, repeated
  service after damage, bounded long rounds and compact hot joins. Desktop visual
  and release evidence lives in `bonk-club-qa/monorail`.
- Live revision `6faf3ac` passed regular tests, all six arena stress shards,
  Windows/Linux executable checks and Pages deployment in
  [release workflow 36330935989](https://github.com/SamCousinsGB/bonk-club/actions/runs/36330935989).
  All 17 local, CI and public files match byte for byte. Public v0.55.0 host/guest
  movement, third-player hot join and host departure passed through real TURN
  without browser errors. Damaged-world testing also compared the exact track,
  articulated wreck and subsequent opposite-direction train between host and guest.
- Local regular/focused tests and the Bullet Train bot/seeded arena stress tests
  passed. The redundant unsharded local stress run was stopped after the complete
  six-shard CI run passed; its incomplete log is not a separate passing result.

## Ocean Liner background cargo

- v0.54.3 / protocol 75 adds seven simple wooden crates in four sparse groups
  along the back of the hold. Muted colours and minimal plank/bracing detail
  separate the cached background artwork from brighter physical cargo and actors.
  Hull clipping, ship tilt and foreground floodwater also apply to this artwork.
- Includes the cabin seam fix below. Desktop renders cover level, both tilt
  directions and partial flooding; collision and simulation are unchanged.
  Evidence: `bonk-club-qa/ocean-cabin-*`.
- Live revision `f768961` passed 1,181 regular tests, all six stress shards,
  Windows/Linux checks and Pages deployment in
  [release workflow 36324389457](https://github.com/SamCousinsGB/bonk-club/actions/runs/36324389457).
  All 17 local, CI and public browser files match byte for byte. Fresh public
  v0.54.3 desktop host/guest movement, Ocean Liner selection and third-player
  hot join passed with no browser errors. The cabin seam remains closed in
  level, opposite tilted and flooded source renders; actors remain readable
  directly in front of the background crates.

## Black-hole status icon

- v0.54.2 adds the requested untimed `Spaghetti-fied` status and a stretched-fighter
  icon while the local living fighter is captured by an active black hole.
  Uses the existing capture ID and field state, including guests. It clears on
  release, hole closure, death or round reset; proximity alone never triggers it.
- Regression coverage checks real capture, snapshot transport, release and reset.
  Desktop visual evidence and final release verification: `bonk-club-qa/spaghetti-*`.
  Verify CI/Pages and public artifact parity before describing this revision as live.

## Ocean Liner cabin seam

- v0.54.1 / protocol 75 extends the cabin background to the shared hull-top
  coordinate with a one-unit overlap. The central passage meets the same edge,
  preventing a sky/water strip when the ship lists. Collision and flooding are
  unchanged. Evidence: `bonk-club-qa/ocean-cabin-*`.
- Included in the verified v0.54.3 public release above.

## Train crash art revision

- v0.54.4 / protocol 76 replaces repeated electrical auras and automatic carriage
  blasts with contact-driven glass, rail grinding sparks and dusty equipment tears.
  Detailed running gear, broken glazing, buckled seams, abrasion and torn side panels
  follow the compressed carriage bodies. Deterministic damage artwork persists for
  hot join. Bounded renderer debris fades, cannot replay on stale snapshots, and is
  disabled for reduced motion. Sparks require surviving terrain contact and speed.
- Lower angular impulses and inelastic, torque-aware rail contact make carriages
  settle under their weight. Track and signal preservation remain. Train passing
  audio stops on derailment; a finite layered metal crash replaces the electrical
  buzzing and repeated explosions. Nearby fighters no longer take aura damage.
- Focused collision/art/audio tests, the full regular suite and the Bullet Train
  stress shard pass. Desktop gameplay was inspected during impact and after settling,
  in both directions. Source host/guest and changed-world hot join agree on all
  carriage and terrain state, with no browser errors. Reduced motion clears debris.
- Live revision `0cce2e6` passed the full suite, all six stress shards, Windows/Linux
  packaging, release verification and Pages in
  [workflow 36327443053](https://github.com/SamCousinsGB/bonk-club/actions/runs/36327443053).
  All 17 local, CI and public files match byte for byte. Fresh public host/guest
  controls, Bullet Train selection, third-player hot join and host departure pass
  through real relay routes with no errors. This is one-machine browser verification.
  Evidence: `bonk-club-qa/train-art/`. Refresh all player tabs.

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
  Evidence: `bonk-club-qa/train-crash/`. Refresh all player tabs.
- Live gameplay revision `b9790f5` passed the full regular suite, all six arena
  stress shards, Windows/Linux packaging, release verification and Pages in
  [release workflow 36322978777](https://github.com/SamCousinsGB/bonk-club/actions/runs/36322978777).
  All 17 local, CI and public browser files match byte for byte. Fresh public
  v0.54.0 host/guest controls, Bullet Train selection, third-player hot join and
  host departure passed with selected real relay routes and no browser errors.
  These browser checks use one machine, not separate ISPs or native Steam.
- Includes the concurrent desktop-only, Waterworks, Foundry, status and Ocean Liner
  changes below. Does not change their scope or restore phone support.

## Verified Waterworks fix

- v0.53.2 / protocol 74, gameplay revision `ddba2a8`, was deployed and verified
  publicly on 27 September. Generators alternate in two stable banks six seconds
  apart, retaining 7 seconds off / 1 amber warning / 4 live. Both start safe;
  movement, destruction and hot join cannot reorder the banks. Destroyed casing
  fragments never become timed power sources. Connected water can still carry
  electricity between banks while a source is live.
- Falling liquid retains volume, stays broad during lateral outflow and turns
  downward with gravity. Trace droplets no longer stretch into long needles.
  Shared fills remove repeated bead outlines and overlapping electrical glow.
  Electrical contact searches skip distant bodies; falling arc detail is bounded.
- 84 focused tests, the full regular suite, eight relevant arena stress cases,
  production build and source host/guest swimming, destruction, hot join and reset
  passed. A local flooded/breached benchmark reduced median reaction time from
  2.6 ms to 1.3 ms; this measures simulation work, not internet latency or total FPS.
- [Release 36322939163](https://github.com/SamCousinsGB/bonk-club/actions/runs/36322939163)
  passed all six full stress shards, shared/server validation, Windows/Linux builds
  and smoke checks, release verification and Pages. All 17 public files matched
  the exact successful CI artifact. Fresh public browsers passed Waterworks lobby,
  host/guest movement and a third player joining the active match without errors.
  Evidence: `bonk-club-qa/waterworks-flow-*`, particularly `parity.json`,
  `performance.json`, `public.json`, `browser.json` and `ci.log` with that prefix.

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
