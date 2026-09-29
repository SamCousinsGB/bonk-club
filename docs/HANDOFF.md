# Bonk Club — current handoff

## Lower Colossus head (v0.64.6 / protocol 99)

- Lowers the head by 12 rig units (6 world units, about 4 pixels at 1600px)
  to shorten the visible neck. Head size, shoulders, still pose and cinematic
  beam artwork remain. The shared eye/beam origins follow the adjustment.
- Refresh all tabs for protocol 99 to prevent mixed eye origins in one room.
  Includes the fluid hanging update below. Thirty focused checks, the full
  regular suite, Colossus stress shard and browser build pass. Desktop poses
  were inspected; the release bundle passed relay host/guest controls, twin
  beams, repeats, late join, reduced motion, resizing and host departure without
  page errors. Confirm CI/Pages and exact public parity before calling this live.
  Evidence: `bonk-club-qa/colossus-neck/`.

## Fluid hanging and pull-ups (v0.64.5 / protocol 98)

- S/down eases from standing through a short seated pose into a hang; W/jump
  now pulls up through sitting to standing over 0.95 seconds instead of
  teleporting onto the support. Reversing an unfinished drop stays continuous.
- The head and shoulders follow a level path during hand-over-hand movement,
  with no vertical bob or head tilt. The waist and legs retain gravity, inertia,
  collisions and release momentum. Knees retain enough flexion to avoid locking.
- Entry and climb progress plus the support-relative shoulder position travel
  with host state. The shared solver preserves guest prediction and late joins
  during lowering, a reach or a pull-up. Refresh all tabs for protocol 98.
- All 55 focused checks, the full integrated regular suite and desktop pose
  inspection pass. The local full stress run passed before the renderer-only
  Colossus integration; all six final CI stress groups pass. Source relay QA
  measured zero head bob/tilt while the waist swung, checked pull-ups on both
  peers, changed-world joins and support break/release. Includes v0.64.4 below.
- Revision `bbf0ca3` passed [release workflow 36497329379](https://github.com/SamCousinsGB/bonk-club/actions/runs/36497329379),
  including shared/server tests, Windows/Linux executable checks, release
  verification and Pages. All 19 local, CI and public files match exactly.
  Final-bundle and public relay host/guest lowering, hand steps, continuous
  pull-ups, late joins, reduced motion, desktop resizing and host departure
  passed without page errors. The task preview is stopped.
- Evidence and motion clip: `bonk-club-qa/fluid-hanging/drop-hang-pull-up.webm`.

## Colossus beam optics (v0.64.4 / protocol 97 unchanged)

- Replaces the opaque patterned beam with an emissive warm core, translucent
  copper/red penumbra and soft atmospheric bloom. Cached density variation and
  travelling haze add depth without wires, green pigment or a hard cone border.
- A bounded scene capture refracts only the air beside each shaft. The eyes
  receive restrained optical flare; no body aura or get-up animation returns.
- Light catches surviving stone around the actual cut, with local vapor and
  sparks. Neighbouring collision slices share one impact, and covered internal
  faces do not become illuminated stripes. The old repeated slab shadows are
  removed. Reduced motion keeps steady light and disables refraction/sparks.
- Art only: authoritative beam paths, damage, holy fire, result timing and wire
  protocol stay unchanged. Thirty focused checks, the full regular suite and
  browser build pass. Desktop pose/motion inspection and the release bundle's
  real relay host/guest controls, both beams, repeats, changed-world late join,
  reduced motion, resizing and host departure pass without page errors.
- Revision `520c71d` passed [release workflow 36496593063](https://github.com/SamCousinsGB/bonk-club/actions/runs/36496593063),
  including all six arena stress groups, shared/server tests, Windows/Linux
  executable checks, release verification and Pages. All 19 local, CI and
  public files match exactly. Public desktop relay controls, twin beams,
  repeated attacks, changed-world late join, reduced motion, window resizing
  and host departure pass without page errors; screenshots were inspected.
- A separate public relay join during holy fire saw the blistering victim;
  the result waited through ash and appeared 5.09 seconds after ignition.
  The task preview is stopped. Evidence and 20-second gameplay clip:
  `bonk-club-qa/colossus-cinematic/`.

## Stationary Colossus and copper beams (v0.64.3 / protocol 97)

- Sam removed the get-up animation entirely: the creature is present at full
  height from countdown and reset, with no rise, planted ridge grips, breathing
  loop or discharge recoil. Small host-driven gaze turns remain.
- Shoulder attachments sit inside the painted deltoids below the neck. Each
  continuous arm plate replaces the split elbow assembly; the torso conceals
  the attachment and forearms/open hands remain visible beside the thighs.
- Recessed copper eye light, rust-red warning margins and a cached mottled
  red/copper beam replace the blue/white light. Dark oxide pits, green patina,
  broken seams and moving flecks stay inside the same damaging cone. Reduced
  motion freezes the texture movement. Holy fire and the full terminal wait remain.
- Shared eye origins changed, so refresh all tabs for protocol 97. No snapshot
  fields were added. Thirty focused checks, the integrated full regular suite,
  Colossus stress shard and browser build pass. Desktop initial/charge/fire
  poses and motion were inspected, including reduced motion. The final bundle
  passed real relay host/guest controls, both copper beams, repeated attacks,
  changed-world late join, resizing and host departure without page errors.
  Includes the steady hanging head fix below.
- Revision `0075d88` passed [release workflow 36495126682](https://github.com/SamCousinsGB/bonk-club/actions/runs/36495126682),
  including all six arena stress groups, shared/server tests, Windows/Linux
  executable checks, release verification and Pages. All 19 local, CI and
  public files match exactly. Public desktop relay host/guest controls, both
  textured beams, repeat attacks, changed-world late join, reduced motion,
  resizing and host departure passed without page errors. Frame samples show
  no rise; a small gaze turn moves the painted eye vertically by only 0.12px.
- A separate public relay check joined during holy fire, saw the blistering
  victim and waited through ash; the result appeared after 5.21 seconds.
  The task-owned preview is stopped. Evidence and 20-second gameplay clip:
  `bonk-club-qa/colossus-copper/`.

## Steadier hanging head (v0.64.2 / protocol 96)

- The physical neck now holds the head upright relative to gravity and damps
  movement relative to the shoulders. Changing grips no longer amplifies the
  torso swing into a whipping, bobbing head. The seated entry, alternating
  grips, loose body and legs, collisions and release momentum remain intact.
- The shared host/prediction solver uses the existing transported rig state;
  no new fields are needed. Refresh all tabs for protocol 96 so both sides
  use the same neck response.
- All 53 focused hanging/prediction checks and the full regular suite pass, including
  a regression covering head tilt, vertical bob, reversals and retained body
  swing. The full local stress run and all six CI stress groups pass. Desktop
  pose inspection and source relay host/guest/late-join checks pass.
- Revision `40b02c2` passed [release workflow 36494647923](https://github.com/SamCousinsGB/bonk-club/actions/runs/36494647923),
  including shared/server tests, Windows/Linux executable checks, release
  verification and Pages. All 19 local, CI and public files match exactly.
  Final-bundle and public relay host/guest hanging, hand steps, late joins,
  reduced motion, desktop resizing and host departure passed without page
  errors. The public seated pause stayed still before the gradual drop.
- The task preview is stopped. Evidence and motion clip:
  `bonk-club-qa/steady-hanging-head/`.

## Alternating hanging grips and seated entry (v0.64.1 / protocol 95)

- Pressing S/down now lowers the fighter into a bent-knee seated pose, pauses
  briefly on the support, then releases the hips into the physical hang.
  The torso and legs keep their existing loose gravity-driven motion.
- Sideways travel alternates hands: one stays planted relative to the moving
  support while the other releases, swings below the edge and catches ahead.
  The supporting elbow flexes and the body follows. Stopping finishes the
  current reach; reversals swap direction and obstructed reaches can return.
- The seated phase, individual grips and active reach travel with host state.
  Prediction copies this state, preserving independent limb velocities and
  late joins during either sitting or reaching. Refresh all tabs for protocol 95.
- All 52 focused checks and the final full regular suite pass. The local full
  stress run passed before integration; the final integrated source passed
  all six CI stress groups. Desktop pose inspection confirms sitting, both
  reaching directions, reversals and loose limbs. Includes v0.64.0 below.
- Revision `0462894` passed [release workflow 36493414226](https://github.com/SamCousinsGB/bonk-club/actions/runs/36493414226),
  including shared/server tests, Windows/Linux executable checks, release
  verification and Pages. All 19 local, CI and public files match exactly.
  Final-bundle and public relay host/guest controls, hanging, hand steps,
  late join, reduced motion, desktop resizing and host departure passed
  without page errors. Frame samples confirm the brief stationary sit.
  Source relay QA also checked broken support release and changed-world joins.
  The task preview is stopped. Evidence and motion clip:
  `bonk-club-qa/hanging-handsteps/`.

## Colossus posture and holy fire (v0.64.0 / protocol 94)

- Sam corrected the first distant-pose pass: the head needed more size, the
  climb still looked wrong, and the arms appeared behind the back during fire.
  Head art is now 29% wider and 25% taller than v0.63.7. A continuous heave
  replaces alternating lateral pulls; hands establish the grips before the
  chest rises and legs extend. Both relaxed arms draw in front of the torso.
- Laser contact now starts a distinct 5.2-second holy-fire death: white/gold
  flame, swelling, raised blisters, ruptures, physical contractions and heat
  lift, followed by falling ash. It preserves initial momentum and swept
  collision; swelling has matching body radii, then joints release into ash.
- The host keeps the fight active through the full sweep and the final burn,
  including all-dead draws and wholly escaped bodies. A later victim extends
  the wait. Scores and result appear once the terminal sequence finishes.
- Holy effect age/points and the hazard's deathUntil deadline are validated
  and transported for interpolation/late join, and clear on round reset.
  Refresh every client for protocol 94.
- Focused tests, the integrated full regular suite, Colossus stress shard
  and browser build pass. Desktop staged host/guest checks cover movement,
  both beams, repeats, reduced motion, a guest joining mid-burn and the result
  appearing 5.15 seconds after ignition. Includes the natural hanging update below.
- Revision `88ee682` passed [release workflow 36492875598](https://github.com/SamCousinsGB/bonk-club/actions/runs/36492875598):
  all six arena stress groups, shared/server tests, Windows/Linux executable
  checks, release verification and Pages. All 19 local, CI and public files
  match exactly. Public desktop relay host/guest play passed movement, twin
  beams, repeated attacks, changed-world late join, reduced motion, window
  resizing and host departure without page errors.
- A dedicated public relay check confirmed a third player joining mid-burn
  sees the swollen, blistering victim; the result appeared 5.11 seconds after
  ignition, after ash. The first attempt timed out joining; the next loaded
  after the short effect ended. Preloading the invite page before ignition
  made the timing-specific check pass without game changes. The staged check
  also passed twice. Evidence and a 20-second gameplay clip:
  `bonk-club-qa/colossus-holy/`. Both task-owned previews are stopped.

## Natural hanging (v0.63.8 / protocol 93)

- A fresh S/down press lowers the existing pose under gravity while the hands
  reach the platform or wire. Weighted body joints replace the instantaneous
  relocation and fixed hip/leg pose. The torso, knees and feet swing freely;
  shimmying and moving supports drive real inertia, with solid-body collisions.
- The body position follows the physical hips, and dropping retains swing
  momentum. Independent limb velocities and grip position travel with host
  state so guest prediction and late joins continue the same movement.
  Existing climb, second-press drop, weapon restrictions and grip loss remain.
  Refresh all tabs for protocol 93.
- Six new physics/transport regressions, the existing hanging/prediction checks
  and full regular suite pass. The local full stress run passed before the
  concurrent Colossus integration; final CI must validate the integrated source.
  Desktop pose inspection and real relay host/guest play covered shimmying,
  dropping, broken supports and a third player joining a damaged hanging scene.
- Includes the concurrent Colossus distant-presence update below. Revision
  `8ad96d0` passed [release workflow 36491667334](https://github.com/SamCousinsGB/bonk-club/actions/runs/36491667334):
  all six arena stress groups, shared/server tests, Windows/Linux executable
  checks, release verification and Pages. All 19 local, CI and public files
  match exactly. The final bundle and public site passed real relay host/guest
  hanging and shimmying, a third-player late join, reduced motion, desktop
  window resizing and host departure without page errors. Public frame samples
  showed a continuous drop; a close-up motion clip is saved with the evidence.
  The task-owned preview is stopped. Evidence: `bonk-club-qa/natural-hanging/`.

## Colossus distant presence (v0.63.7 / protocol 92)

- Replaces the mechanical bronze atlas with continuous weathered anatomy,
  relaxed open hands, a smaller head, sloping uneven shoulders and full thighs.
  The lower legs sit behind the ridge; stronger landscape airlight and broad
  valley haze place the creature farther away. Art provenance/prompt:
  `docs/art/colossus-weathered.md`.
- Removes the literal aura, corona strands, hand halos, body-light paths and
  rising energy motes. Eye warnings and physical twin beams remain. Planted
  climbing grips give way to a weighted, nearly still pose, shallow breathing
  and small deliberate gaze turns, without arm spreading during charge.
- Shared rig landmarks keep painted eyes, host damage and late-join poses in
  agreement. Refresh every tab for protocol 92. No snapshot shape changes.
- Revision 1b13fa9 passed release workflow 36490781520 and Pages. All 19 local
  and CI files matched exactly; its release bundle passed desktop relay
  host/guest, late join, both beams and repeat attacks. Sam's further posture
  corrections above arrived before the separate public browser pass.
  Evidence: `bonk-club-qa/colossus-presence/`.

## Colossus climb and awakening (v0.63.6 / protocol 91)

- Replaces the vertical statue reveal with staggered ridge grips, bent elbows,
  shoulder pulls and tucked legs that extend as the creature climbs out. Planted
  hands stay on the painted ridge; only gripping knuckles draw in front of it.
- After emerging, he cocks his attached head, follows fighters, shifts weight and
  moves his arms between attacks. Charging spreads the arms and lights the bronze,
  with a flowing blue aura, hand glows, rising motes and dust from the ridge grips.
  Discharge adds recoil, then smoothly releases into recovery. Reduced motion
  keeps steady energy cues without flowing particles or corona animation.
- Shared age-derived articulation supplies both painted eyes and host-owned beam
  origins. Existing four-second warnings, targeted twin sweeps, damage, terrain
  cuts and irregular repeats remain. Refresh all tabs for protocol 91.
- Focused regressions cover actual stationary grips, joint movement, head tilt,
  continuous discharge/recovery, late-join pose reconstruction and round reset.
  All 39 focused checks, the full regular suite, the Colossus stress shard and
  browser build passed. Desktop pose inspection and the release bundle passed
  host/guest controls, twin firing, irregular repeat, relay late join, reduced
  motion and host departure without page errors.
- Revision 8ede2cf passed [release workflow 36357973586](https://github.com/SamCousinsGB/bonk-club/actions/runs/36357973586),
  including all six stress groups, shared/server tests, Windows/Linux checks,
  release verification and Pages. All 19 local, CI and public files match exactly.
  Public host/guest movement, first and repeat twin attacks, a relay late join,
  reduced motion and host departure passed without page errors. The first public
  route-statistics probe returned no active pair; a complete retry passed without
  source changes. Evidence and the 17-second motion clip: bonk-club-qa/colossus-climb.
  The task-owned preview is stopped.

## Colossus upright emergence and attached neck (v0.63.5 / protocol 90)

- Removed the fixed-foot frontal squat and its outward knee solver. The whole
  upright figure emerges vertically from behind the foreground ridge, with
  straight parallel legs beneath the hips, then remains upright. The crown
  starts below the ridge, so there is no visible crouched or splayed pose.
- Narrowed the torso and shoulder spacing further, slimmed limbs and relaxed
  the arms. The head now pivots at the torso's neck collar, with no independent
  sideways neck translation or exaggerated tilt. Eye light and physical beams
  share the newly anchored facial landmarks. Refresh all tabs for protocol 90.
- Regression checks cover every rise/standing pose, straight knees, close leg
  alignment, hidden initial crown and an attached neck at both gaze extremes.
  All 37 focused checks, the regular suite and the Colossus stress shard passed.
- Desktop rise/standing/eye/fire poses were inspected. The final bundle passed
  host/guest movement, both eye beams, irregular repeats, relay late join into
  destroyed terrain, reduced motion and host departure without browser errors.
- Revision 69e0130 passed workflow 36356990860, including all six stress groups,
  shared/server tests, Windows/Linux checks, release verification and Pages.
  All 19 local, CI and public files match exactly. Additional public gameplay
  was omitted as previously requested. Task preview is stopped.
  Evidence: bonk-club-qa/colossus-upright.


## Colossus natural proportions (v0.63.4 / protocol 89)

- Sam requested a normal tall, slender ratio. Narrowed the torso and shoulder
  spacing, slimmed each articulated limb, lengthened the legs relative to the
  torso, balanced the head size and brought the stance and arms inward.
  Original bronze atlas, valley integration, rise and targeted attacks remain.
- Eye lighting and beam origins use the adjusted face landmarks; all clients
  must refresh for protocol 89. No snapshot shape changed.
- The bot regression now checks both fighters reposition and combat resumes.
  Requiring both to fire was invalid once the new beam angle left different
  routes: the first shooter could pursue and punch its opponent before another
  safe explosive shot. The original idle-pair regression is still covered.
- All 37 focused checks, the full regular suite and the Colossus stress shard
  passed. Desktop gameplay and every rise/eye/fire pose were inspected. The
  final bundle passed host/guest controls, both eye beams, an irregular repeat,
  relay late join, reduced motion and host departure without browser errors.
- Revision 59ca064 passed workflow 36356314415, including all six arena stress
  groups, shared/server tests, Windows/Linux checks, release verification and
  Pages. All 19 local, CI and public files match exactly. Additional public
  gameplay was omitted as previously requested. Task preview is stopped.
  Evidence: bonk-club-qa/colossus-proportions.


## Colossus bronze automaton (v0.63.3 / protocol 88)

- Sam requested a creepy Colossus of Rhodes: a stern Greek statue face, solar
  diadem, broad cast-bronze torso, verdigris, cracks and exposed ancient gears.
  A transparent six-part atlas supplies dedicated head, torso, arms and legs.
  Joint landmarks preserve articulation; source colours retain bronze/patina
  under the same valley airlight and opaque foreground ridge.
- Keeps the heavier proportions, full rise, blue eye opening and individually
  targeted irregular twin attacks. Eye light and physical beams share the new
  sculpted eye landmarks. Refresh all clients for protocol 88.
- Built-in image generation prompt and asset provenance are saved in
  docs/art/colossus-bronze.md. All 37 focused tests, the full regular suite and
  the Colossus stress shard pass. Desktop poses and the final release bundle
  were visually inspected. Host/guest controls, first and repeat twin firing,
  relay-only late join, reduced motion and host departure pass without browser
  errors. The observed repeat interval was 15.01 seconds.
- Revision 6c7e2be passed workflow 36355693945: all six stress groups,
  shared/server tests, Windows/Linux checks, release verification and Pages.
  All 19 local, CI and public files match exactly. Additional public gameplay
  checks were omitted following Sam's earlier request; the final bundle was
  tested before publishing. The task-owned preview is stopped.
  Evidence: bonk-club-qa/colossus-bronze.

## Colossus full standing pose and individual targets (v0.63.2 / protocol 87)

- The mech rises through its hips and articulated armoured legs, standing fully
  upright over the ridge. Sam's proportion correction gives it shorter, thicker
  legs, a broader chest and shoulders, and heavier arms. Original weathered
  metal surfaces, scene airlight and mountain overlap keep it in the landscape.
- Each charge selects a living fighter, including idle humans and bots, and
  projects through their height. It no longer averages the group or clamps aim
  to the centre. Aim locks for the four-second warning; later cycles rotate
  through survivors. Off-screen endpoints remain bounded and transported.
  Refresh for protocol 87. The rise, opening eyes and irregular rests remain.
- Focused targeting checks cover upper and outer ledges, repeat selection,
  warning locks and compact hot joins. The bot combat regression isolates one
  actual destructive sweep so a repeat attack cannot kill the pair before
  measuring their firing decisions. All 37 focused tests, the full regular
  suite and the Colossus stress shard passed. Final-bundle host/guest movement,
  first and repeat twin fire, relay late join and reduced motion passed without
  browser errors. Release c35cbc7 passed workflow 36355120792, including six
  stress groups, Windows/Linux validation and Pages. All 19 local, CI and public
  files match exactly. Additional public gameplay was omitted as requested.
  Evidence: bonk-club-qa/colossus-full-height.


## Platform and wire hanging (v0.63.1 / protocol 86)

- For human fighters on thin platforms and intact transmission wires, a fresh
  S/down press moves them to a hand grip below the actual support. Releasing and
  pressing S/down again drops; W/jump climbs back when there is headroom.
  A/D shimmies along a deck. Solid floors keep their usual lie-down control.
- Hanging uses the real support ID and follows its movement. Breakage, hits,
  knockdown and death release the grip. Attacks, throws and prop grabs are
  disabled while both hands hold on; an equipped weapon draws at the belt.
  A held Tesla arc also stops when the grip begins.
  Bots retain their existing drop-through behaviour.
- New hang state and the S press latch are transported for host authority,
  guest prediction and hot joins. All clients must refresh for protocol 86.
- Focused hanging, cable, climb, headroom, support loss, prediction and
  hot-join tests and the full regular suite pass. Full local arena stress
  passed before the Tesla fix; the final release ran all six CI stress shards.
  [Release workflow 36354777278](https://github.com/SamCousinsGB/bonk-club/actions/runs/36354777278)
  passed all six stress shards, shared/server validation, Windows/Linux
  executable smoke, release verification and Pages on its second attempt.
  Linux controller-menu smoke missed a checkbox toggle once; the rerun passed
  without a source change. All 19 local, CI and public browser files match
  byte for byte. A fresh public v0.63.1 host and late-joining guest rendered
  an Ocean Liner match with no page errors. Gameplay revision: `15562f0`.

## Arena roster (v0.62.0 / protocol 85)

- Match selection and rotation contain only Transmission Towers, Arc Furnace,
  Car Assembly, Turbine Hall, Bullet Train, Scrap Foundry, Cargo Plane Hold,
  Car Wash, Ocean Liner, Waterworks, Suspension Bridge and Colossus.
  Press Floor and Ice Sweep are removed, along with all other earlier arenas.
- Removed the old arena definitions and their themed scenery from the browser
  source. Existing room clients must refresh because map indexes changed.
- The regular suite, full arena stress run and production browser build passed
  locally. A desktop source browser showed all twelve map choices; a Car Wash
  match rendered for the host and a guest joining mid-round. Merge commit
  `7d5ac79` passed release workflow `36353764689`, including six stress shards,
  desktop checks and Pages deployment. All 19 published files matched the CI
  browser artifact exactly. The public v0.62.0 browser showed the twelve-map
  picker and a Car Assembly match for a host and a mid-round guest join.

## Colossus rise and irregular repeat attacks (v0.61.0 / protocol 84)

- The opening sequence is 5.5 seconds rising from behind the ridge, 2.5 seconds
  opening the blue eyes, then four seconds charging before the first shot at
  twelve seconds. He stays upright with open eyes after that first sequence.
- Both beams sweep for three seconds. The host samples a fresh 3.5–9.5-second
  rest after each sweep, then warns for four seconds before the next attack.
  Shared chargeAt/nextChargeAt timestamps govern rendering, sound and hot joins;
  snapshot validation and interpolation preserve schedule boundaries. Reset
  restores the crouch, closed eyes and initial schedule. Refresh for protocol 84.
- Thirty-five focused mechanics, sound and bot tests pass, including varied
  host-chosen intervals and exact late-join schedule transport. Desktop visuals
  cover the rise, eye opening, first discharge and an upright reversed attack.
  The full regular suite and the local Colossus stress shard (plus train service
  coverage) pass. The production bundle passed host/guest movement, natural
  first and repeat twin discharge, relay-only late join, reduced motion and
  host departure without browser errors. The observed repeat interval was
  13.14 seconds.
- Revision dfb5b88 passed release workflow 36353479238, including all six arena
  groups, shared/server validation, Windows/Linux checks, release verification
  and Pages publishing. All 19 local, CI and public files match exactly.
  Additional public gameplay checks were omitted following Sam's earlier
  request; final-bundle browser checks and exact public parity passed.
  The task-owned preview is stopped. Refresh all players for protocol 84.
  Evidence: bonk-club-qa/colossus-standing.

## Colossus waking eyes and bot firing stalls (v0.60.3 / protocol 83)

- The eye shutters gradually open during the first ten seconds, revealing faint
  blue light between attacks. The shoulder spacing and arm poses expose both
  armpits while retaining the distant scale, ridge cover and independent motion.
  Both charging apertures and beams keep their existing shared head landmarks.
- Fixed two reproduced AI stalls: a recoil guard repeatedly cancelled an
  already-selected route, and spacing preferred cheap unusable positions over
  reachable positions with safe firing clearance. Unsafe shots still stop;
  checked traversal and viable firing positions now take priority.
- Regression scenarios cover crowded rocket carriers and black-hole carriers
  after a Colossus sweep changes the terrain. The rocket pair previously failed
  to fire for thirty seconds; it now fires within four seconds. The black-hole
  pair previously held fire for seventy seconds; both now fire within thirty.
- Focused bot/Colossus tests, the full regular suite and desktop artwork checks
  pass. The production bundle passed host/guest movement, natural twin firing,
  relay-only late join and reduced motion without browser errors. Actual desktop
  simulation also showed the stalled bot pair separating and engaging. Rendered
  head travel remains 14.11px at a 1600px viewport.
- Revision d12320d passed release workflow 36340593364: all six arena stress
  groups, shared/server validation, Windows/Linux checks, release verification
  and Pages publishing. All 19 local, CI and public files match exactly.
  The redundant local serial stress run was stopped after all six release
  shards passed the same source. No local full-stress success is claimed.
  Additional public gameplay checks were omitted following Sam's earlier
  request; final-bundle browser checks and exact public parity passed.
  The task-owned preview server is stopped. Refresh for v0.60.3.
  Evidence: bonk-club-qa/colossus-awake. No snapshot or protocol change.

## Colossus mountain overlap and lighting (v0.60.2 / protocol 83)

- Replaced the horizontal foreground fade with an opaque layer traced along
  the painted mountain ridge. The lower body now disappears behind terrain.
- Broad landscape colours supply the figure's atmospheric lighting, matching
  the warm horizon and cooler valley. Parts remain opaque beneath this grade.
  Rig scale, independent movement, shared eye origins and attack timing remain.
- Seventeen focused mechanics/audio tests, the full regular suite and desktop
  source visuals pass. The production bundle passed host/guest movement,
  natural twin discharge, relay-only late join and reduced motion without
  browser errors. Rendered head travel remains 14.15px at a 1600px viewport.
- Across three changed poses, thousands of upper-body pixels moved while all
  12,000 sampled mountain pixels below the ridge stayed identical. Rendering
  measured 0.4ms median / 0.6ms p95 locally.
- Revision 99db895 passed release workflow 36338848536, including all six
  arena groups, shared/server validation, Windows/Linux checks and Pages.
  All 19 local, CI and public files match exactly. Additional public gameplay
  checks were omitted following Sam's earlier request to publish without
  further checks. The task-owned preview is stopped. Refresh for v0.60.2;
  protocol 83 and gameplay state are unchanged.
  Evidence: bonk-club-qa/colossus-ridgeline.

## Colossus distance and compositing (v0.60.1 / protocol 83)

- Reduced the rig by 17%, preserving its position behind the distant ridge.
  Texture contrast now matches the far mountains. Parts assemble opaquely into
  one bounded layer before receiving consistent haze and slight edge softness,
  eliminating doubled seams and the sharp pasted-on appearance.
- Independent motion, metallic eye slits and both shared laser origins remain.
  Seventeen focused mechanics/audio tests, the full regular suite, both local
  Colossus stress cases and desktop gameplay visuals pass. The production bundle
  passed host/guest controls, natural twin discharge, late join and reduced motion.
- Revision 9d466ce passed release workflow 36337861244, including all six arena
  groups, shared/server validation, Windows/Linux checks and Pages publishing.
  All 19 local, CI and public files match exactly. Rendered head travel remains
  14.18px over the opening sixteen seconds at a 1600px desktop viewport.
  Additional public gameplay checks were omitted following Sam's request to
  publish without further checks. The task-owned preview server is stopped.
  Evidence: bonk-club-qa/colossus-depth. Refresh all tabs for protocol 83.

## Articulated distant Colossus (v0.60.0 / protocol 82)

- Replaced the painted mesh with separate weathered metal parts on a shared
  skeleton. The head, torso, shoulders and elbows visibly move. Both beams use
  the actual moving head landmarks. Black dot eyes are removed.
- Sam rejected the larger geometric figure: keep the final small, heavy,
  textured silhouette, original cinematic landscape and legs hidden behind
  mountains. Do not restore the clean toy-like body or exposed legs.
- The landscape now contains no painted mech. Its empty plate, transparent
  parts atlas and built-in image tool prompts are recorded in COLOSSUS.md.
- Revision `9ad75f4` passed release workflow 36337094988 and was confirmed on
  the public metadata as v0.60.0. All 19 local/CI files matched. Source and
  production-bundle multiplayer, natural twin discharge and animation passed;
  Sam asked to skip additional public checks and publish immediately.
  Evidence: `bonk-club-qa/colossus-rig`.

## Suspension Bridge readability and traffic (v0.59.1 / protocol 81)

- Open steel tower bracing replaces the repeated enclosed rooms. Continuous
  recessed legs, attached outer service platforms and correctly rooted brackets
  make the support structure readable; quieter road joints form a continuous deck.
  Existing service doorways, cable damage, suspended bays and blast cuts remain.
- Cars start wholly beyond either screen edge on real extended approaches. The
  single physical lane alternates direction only after the previous car clears;
  stalled cars hold incoming traffic. Shared rotated-body cleanup handles exits.
  Road contact powers upright cars; maintenance bays and freefall do not.
- Random containers use visible service platforms instead of traffic approaches.
  No new snapshot fields or protocol change. Refresh to load the updated artwork.
- All 1,222 regular tests, 85 local stress cases and the production build pass.
  Desktop intact/collapsed visuals, traffic in both directions and exact damaged
  cable/deck/car state on a guest and late join were verified.
- Published revision `b25b7df` passed [release workflow 36336839530](https://github.com/SamCousinsGB/bonk-club/actions/runs/36336839530):
  shared/server validation, all six stress shards, Windows/Linux executable checks,
  common-revision verification and Pages deployment. All 18 local, CI and public
  files matched byte for byte. Fresh public desktop host/guest movement, jumping,
  relay-only late join, resizing/reduced motion and host departure passed without
  browser errors. Evidence: `bonk-club-qa/bridge-traffic`. This is one-machine relay
  verification. The task-owned preview is stopped and the worktree is clean.

## Colossus animation and twin lasers (v0.59.0 / protocol 81)

- Animated the original distant painting with slow independent head, shoulder
  and arm movement. A bounded local mesh keeps the feet and valley fixed, and
  both optical apertures and damaging rays share the animated head pose.
- Both eyes now charge and fire together, cutting distinct paths 320 units apart
  at the foreground endpoint. Successive attacks reverse the pair's direction.
  Shared geometry drives both warnings, damage, terrain cuts and bot avoidance.
  The original landscape, distance, ten-second charge and quiet timing remain.
- Seventeen focused mechanics/audio tests and desktop visual checks pass,
  including separate lethal paths, intact space between the beams, slow bounded
  motion, fixed surrounding art and both eye positions after compact hot join.
- Full regular tests, all six local stress shards and the browser build pass.
  [Release workflow 36334861057](https://github.com/SamCousinsGB/bonk-club/actions/runs/36334861057)
  passed shared/server validation, six stress shards, Windows/Linux executable
  checks, revision verification and Pages deployment for `f87014c`.
- All 18 local, CI and public files match byte for byte. Public desktop gameplay
  measured 4.32 pixels of painted head travel over the opening sixteen seconds
  and both distinct laser origins in the same frame. Host/guest controls,
  relay-only late join after cuts, resizing/reduced motion and host departure
  passed without browser errors. Source checks also compared exact damaged
  terrain/eye state, reversed firing, mute/seek and reset. Evidence is in
  `bonk-club-qa/colossus-motion`; this is one-machine TURN verification.
  The task-owned development server was stopped. Refresh for protocol 81.

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
- Focused mechanics, the full regular suite, bridge/monorail stress cases,
  desktop intact/collapsed renders and an exact changed-world host/guest/late-join
  comparison passed. Service doorways have an actual bot pickup regression test.
- Revision `afbc9de` passed [release workflow 36334032593](https://github.com/SamCousinsGB/bonk-club/actions/runs/36334032593):
  validation, all six arena stress shards, Windows/Linux executable checks,
  common-revision verification and Pages deployment. All 18 local, CI and public
  files match byte for byte. Fresh public desktop browsers passed measured
  host/guest movement, guest jumping, relay-only late join, resizing/reduced motion
  and host departure without page errors. Evidence is in `bonk-club-qa/bridge-art`;
  this is one-machine relay QA, not cross-ISP or Steam validation. The task-owned
  development server is stopped. Refresh all players together for protocol 80.

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
