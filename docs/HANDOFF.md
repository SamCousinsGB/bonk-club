# Bonk Club — next chat

Updated 11 September 2026. Read the root `AGENTS.md` first.

## Connected elemental reactions — 11 September 2026

Worktree: `bonk-club-systems`, branch `codex/systemic-reactions`. The canonical
checkout's unfinished arena work is preserved. This branch includes the newer
real menu fights and textured weapon audio from main.

The five additions share host-authoritative rules in `src/reactions.js`:

- Finite water from damaged blue tanks lands on surviving floors, spreads and
  drains through actual destruction. It extinguishes fighters and burning props,
  including recovering knockdowns. Wet fighters temporarily resist re-ignition.
- Tesla shots, damaged generators and active electrical fixtures energise connected
  water and metal.
  Rotated prop contacts use their physical polygons. Removing a connection or
  switching off the source removes downstream power. Shock intervals are bounded;
  wet fighters take more damage. Electrical arcs can ignite nearby leaked gas.
- Fire spreads through wooden/upholstered props and their physical fragments;
  fuel expires and water or cryo extinguishes it. Burning debris can melt ice and
  ignite cylinders or gas. Wood panels also burn down under sustained heat.
- Flame/sparks cut local ice using the actual circular terrain geometry and leave
  meltwater. Frost/cryo freezes settled water into slippery collision for seven
  seconds; flame thaws it. Destroyed ice cannot recreate terrain or duplicate water.
- Red cylinders rupture on hits, retain a short fuse, and tumble under off-centre
  thrust while leaving gas. Ignition accelerates the fuse; cold temporarily seals
  leaks and pauses the countdown. Gas chains have finite volume and delayed bursts.
  Hissing, pressure gauges, jets and a final flashing outline provide warning.

Containers are placed on suitable existing landings away from spawn bodies and
trap machinery. Bots use normal controls to escape nearby electrical/fire/cylinder
danger. Last-elimination scoring waits for armed cylinders and ignited gas.
Nukes and PHASER consume liquids; black holes retain fluid/vapour samples and counts
in the existing planar matter flow. All transient state resets each round.

Rendering is in `src/reaction-art.js`. Water is capped at 192 parcels, gas at 24;
simulation runs at 20 Hz alongside the existing physics clock. Render snapshots
interpolate stable parcel identities and validate numeric bounds and duplicates.
Protocol **30** requires both players to refresh and create a new room. Display
release: **v0.8.0**. No dependencies or Pi infrastructure changes.

Focused verification: 31 reaction regressions passed; all 64 combined reaction,
terrain-fixture and arena checks passed after integrating the new arenas.
Real Edge host/guest and a third hot joiner received all five systems through
selected TURN relay candidates. Real guest mouse fire ruptured a host-authoritative
cylinder. Hot join matched melted platform IDs and frozen water. Actual gameplay
screenshots were inspected, with no page errors. These browsers ran on the QA
machine; this is not a new cross-ISP test. Helpers/logs/screenshots are outside Git
under `bonk-club-qa/systems-*`. All hooks are confined to that external harness.
Before the arena merge, all 563 gameplay/network tests and the production build
passed. The production bundle passed the three-browser room lifecycle check.
The newly published arena release is now integrated; final verification follows.

## Second audio pass — 11 September 2026

Sam requested a better death sound, less crackle, thudding footsteps, more bass
in gunshots and the nuclear siren, while retaining the SMG's character.

- Death now uses one deep physical impact with a soft air/cloth tail. Removed the
  four pitched oscillator notes and duplicate weapon discharge on lethal hits.
  Every death cause still has the same recognizable cue and burst coalescing.
- Grounded stride crossings produce quiet alternating footstep thuds; landings
  produce a heavier contact. Existing validated gait/ground/occupant state drives
  them locally on hosts and guests. No footsteps while idle, prone, airborne,
  frozen, knocked down or carried by a lift. New rooms, rounds, occupants and
  stalled snapshots reset tracking without playing a backlog. No wire change.
- Added low body resonance to guns and lower rotor layers to the timed siren.
  Kept the SMG attack/cadence and approximately its prior loudness. Softened the
  upper crack on other ballistic weapons. Siren phase and glow timing are intact.
- Replaced the always-distorting output curve with a transparent normal range,
  a wider safety range and oversampling. Source endings fade to zero. A real
  OfflineAudioContext comparison reduced added harmonics on a clean test tone
  from 1.13% to below 0.001%, without a material level change. That isolates a
  distortion source; it is not a measurement of Sam's speakers or hardware.
- Work remains in `bonk-club-audio` / `codex/weapon-audio`, preserving concurrent
  arena and other work. Release version is **0.7.0**, incorporating the concurrent
  v0.6.0 arena update, restored live menu fights and v0.6.1 frozen-body/black-hole
  changes. Protocol remains 29 from v0.6.1; refresh all tabs and start a new room.
- Source checks rendered all 49 audio profiles and a 48-voice stress mix in real
  Web Audio. Peak was 0.898, with all voices released and silent tails. The SMG
  stays within 2% of its previous RMS level; the 180 Hz low-pass energy proportion
  rises from 4.6% to 7.6%. The siren rises from 1.9% to 9.1% on that same measure.
  These are signal measurements, not a subjective listening test or perceived
  loudness claims. Real host/guest mouse firing covered twelve weapon families.
  Guest running produced five footfalls in 1.3 seconds; prone/jump stayed silent,
  landing produced one heavier thud and a death produced one new impact.
- Three real Edge browsers connected through selected TURN relay candidates.
  Mid-fuse hot join, remaining-fuse correction during network stalls, mute/resume,
  early removal and detonation passed without browser errors. No new Pi setup.
  QA helpers/results and preview WAVs are in `bonk-club-qa/audio2-*`. Final combined
  test count, exact build and public verification record follows after deployment.

## Frozen bodies and smaller black holes — 11 September 2026

Gameplay **v0.6.1**. Protocol **29** because field and retained-rift validation
now use the smaller radius. Refresh every player's tab and create a new room.

- `src/frozen-art.js` replaces the bounding polygon with translucent, bevelled
  crystals following the actual head and each bone. Bright edges, shaded facets,
  branching cracks and small crystal tips remain readable in standing, prone and
  airborne poses. Living freeze and ice deaths share the artwork; existing thaw,
  cooldown, frozen-pose physics and timed shattering are preserved.
- Black-hole pull/destruction radius is **465**, exactly 25% below 620. Weapon
  targeting metadata agrees, and the lens scales down by the same proportion.
  Captured fighters retain their stretched physical bodies during orbit. On final
  compression each shows only a coloured head, drawn after rubble to stay visible.
  Matter counts, the persistent collidable ball, outer wreckage and resets remain.
- A regression covers players, pickups and terrain on either side of the new
  boundary, validated transport, invalid radii, collapse counts and round reset.
  Real Edge source host/guest and a third hot joiner verified frost-shot freezing,
  thaw, ice death, live orbital strands, collapsed matter and matching collision.
  Selected connections for that completed check were direct on the QA machine;
  this is not a cross-ISP or new TURN-infrastructure test. No browser errors.
- Rendered gameplay and enlarged standing/prone/airborne/shatter/head frames were
  inspected. External helpers/captures: `bonk-club-qa/frozen-visual.cjs`,
  `frozen-online.cjs`, `frozen-release.cjs`, and `frozen-*.png`. Test hooks stay
  outside production. No dependencies or Pi changes. Release verification follows.


## Arena, scenery and fairness pass — 11 September 2026

Gameplay version **0.6.0**, protocol **28**. Refresh all players' tabs and create
a new room. Implemented on `codex/arena-pass` in the canonical checkout, including
the restored live menu fights, 36 weapons, persistent shots and v0.5.0 audio release.

- Refreshed all 24 existing arenas and added **Radiology**, **Production Hall**
  and **Geothermal Terraces**, bringing the rotation to **27**. Cached scenery
  includes clinical monitors/radiographs/curtain tracks, industrial machinery and
  pipework, home wall details, port fittings, vines, strata and basalt cracks.
  Trolleys, generators, planters and pallets are real moving, breakable props with
  distinct material/mass and physical rubble. Placement leaves takeoffs, headroom,
  fixture sweeps and opening weapon runs clear.
- Added X-ray scanners (damage and skeleton exposure), magnetic scanners (pull
  armed fighters, weapons and metal props), hot geysers (damage and upward impulse),
  coolant vents (damage and chill), and spore plants. Each uses existing warning,
  cycle, mounting-floor destruction and reset behavior. Walls/floors shield
  exposure. Production Hall has opposing belts feeding a saw and press, with
  outer lifts and upper catwalks as alternate routes. Theme sets are shared by
  the existing hospital, factory, volcano, ice, jungle and other arenas.
- Four equal first pickups sit 100 units inward from each spawn, with equal full
  ammunition. The shared starter rotates between pistol, SMG, shotgun and burst
  rifle. Premium pickups stay in contested interior locations, at least 300 units
  from starts; featured exotic rotation and regular nuclear pickups remain.
  Reinforcements avoid fixture footprints, destroyed floors and immediate pickup
  in a living fighter's hand. Reduced saw/rail/ricochet ammunition and rate of fire,
  slowed heavy machine gun/burst fire, and slightly improved pistol firing rate.
  One-hit weapon identities remain; this is an initial tuning pass, not a measured
  claim that every weapon has identical win rates.
- Repaired unreachable upper perches, head traps and overlapping ledges. Lift
  shafts now stay clear through intermediate landings. Abandoned Factory has
  lower upper side floors; Volcanic Quarry has recovery ledges that prevent the
  previously observed stranded-bot stalemate. Real collision-traced routes connect
  every opening pickup to every spawn. Standing/prone lift round trips pass.
- Validation: **557 gameplay/network tests pass** after integration. Tests cover
  actual opening movement/pickups for all 27 arenas and four starter rotations,
  navigation, hazards/shielding, magnetic movement, invalid snapshots, fixture
  destruction, physical props, rubble and reset. Actual Canvas renders of all
  arenas and enlarged new fixture art were inspected. Real Edge host/guest/hot
  join received all five hazard effects, moving trolleys, destroyed floors and
  material rubble; guest keyboard control and reset passed. All three browsers
  selected TURN relay candidates and reported no errors. This is one QA machine,
  not cross-ISP or physical mobile verification. No Pi infrastructure changes.
- QA scripts, logs, gallery and screenshots live outside Git at `bonk-club-qa/arena-*`.
  No debug hooks ship. Published revision:
  `2395bdd4819c4c21dccca8564e0a69fe7f656932`. Pages run **34615250256** passed
  **557 gameplay/network tests**, **3 server tests**, build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34615250256.
  All **15 public files** match the exact committed LF-source production build
  byte for byte. JS: `index-C2XiE5D6.js`; CSS: `index-DB2pWx_1.css`. Exact build:
  `bonk-club-qa/arena-release-2395bdd`; checker: `verify-arena-live.cjs`.
  The clean release copy separately passes all 557 tests. Final source host/guest
  checks, fixture closeups and all 27 rendered arenas passed after integrating
  the restored menu fight. The production bundle passes the three-browser room
  lifecycle and selected TURN relay checks. Public v0.6.0 menu, Controls, solo
  start/return and update-line visibility pass at 1440x900, 390x844, 568x320 and
  320x568, with no browser errors or clipping.
  The public game also passes real three-browser lobby/start/hot join/departure,
  mute, small viewport and host-disconnect checks through selected TURN relay
  candidates (`arena-live-browser.cjs`, pinned to `?release=2395bdd`). One source
  hot-join attempt and one public rejoin attempt timed out; repeat runs passed
  without game changes. These are observed successful runs, not a connection
  reliability or cross-ISP benchmark.
- The stale canonical checkout was fast-forwarded before this work. Its three
  pre-existing modified files were saved in the stash named `Preserved pre-existing
  canonical edits before arena pass`; the two substantive validator lines were
  already present upstream. Keep that backup; do not reapply it over current code.
  A separate frozen-body/black-hole task subsequently began editing the canonical
  checkout; it is outside this release. Final release evidence is recorded from
  a small isolated documentation worktree to preserve that task's in-progress work.

## Actual menu fights restored — 11 September 2026

Sam rejected the scripted effects montage and requested the earlier fighting
demo with more variety and different weapons. The montage module and its tests
are removed. `src/menu-fight.js` now runs three real Easy bots in a small physical
arena, using the same World, controls, ammunition, pickups, knockback, melee,
destruction and death effects as gameplay. There are no staged deaths, effect
slides, fades between scenes or camera cuts. Natural round results leave a short
aftermath before the next fight; weapon bags and spawn order vary across rounds.

Seventeen ranged weapons and four melee/unarmed choices rotate through opening
loadouts and falling pickups. Broad side supports retain real recoil inside the
visible arena; the central wooden platform and furniture can be destroyed.
Each new round restores the arena. Off-screen projectile history expires after
15 seconds in menu play only, pickups are capped at eight, and the fixed-step
clock allows at most six ticks per render. Reduced motion holds the initial
fight still. The menu simulation stops advancing during actual gameplay.

`Renderer` uses a separate effects instance for the menu, while sharing the
normal fighter/projectile/status/death drawing code. Menu effects and event IDs
cannot leak into a started match. There is no room or sound output from the demo.
The responsive control layouts remain, with the live fight beside/above them.
Worktree: `bonk-club-menu`, branch `codex/menu-live-fight`; the canonical checkout
contains separate arena work and was left untouched.

Three seeded 50-second behavior runs verify real hit/shoot/melee/jump/pickup/KO
events, multiple completed rounds and at least eight weapons per run. Fixed-step,
reduced-motion and world-isolation checks pass. Real Edge source checks confirm
continuous fighting, responsive framing, Character/Settings, solo start/return,
no menu simulation during play and a pixel-identical reduced-motion frame.
QA helpers/screenshots: `bonk-club-qa/menu-fight-*`.

Published as **0.5.1**, revision `af53323eaba23723a430d3f8969dd85d2e1994a8`.
Pages run `34614831482` passed its build job (**536 gameplay/network tests**,
**3 server tests** and production build), then successfully completed the Publish
step. The overall run was cancelled after publication when the concurrent arena
release began. All **15 public files matched byte for byte** against an exact
LF checkout/build of this revision. Live Edge checks passed at 1440×900, 390×844,
568×320 and 320×568: visible controls/release note, menu actions, solo start/return
and no browser errors. Actual rendered live fighting was visually inspected.
Three real Edge contexts also passed host/guest/hot-join, departure, mute and
disconnect checks over selected TURN relay candidates. These ran on one QA
machine, not separate ISPs or physical mobile devices. An initial menu sizing
race found during production QA was fixed before release. The subsequent arena
integration at `2395bdd` includes this correction and advances the game to 0.6.0.

## Weapon audio and nuclear siren — 11 September 2026

Implemented in `bonk-club-audio`, branch `codex/weapon-audio`, while the canonical
checkout is used by the arena task. Preserve that task's changes.

- Replaced combat pitch sweeps with original layered PCM recordings synthesized
  locally: pressure cracks, low body resonance, mechanical action, turbulent
  exhaust, electrical crackle, ice/metal/wood impacts and short reflections.
  All 36 weapons map to appropriate profiles; repeat shots rotate three variants,
  including the concurrently released Jelly, Midas and Tangle guns.
  No downloaded audio, new dependency or proprietary game recording is used.
- Nuclear grenades have a dual-rotor air-raid siren: two rise/fall cycles over the
  actual 2.8-second fuse. The warning glow uses the same cycle. The live projectile
  drives seeking, early cancellation, combat-hitstop retiming, mute/unmute, round
  reset and hot join. Multiple grenades share the soonest countdown. Audio remains
  scheduled when rendering stops; stale copies of a snapshot cannot extend it.
- Samples warm incrementally and are cached. Normal combat uses at most 36 voices,
  with a reserve for essential cues and a hard 48-voice sample ceiling. Stereo
  placement follows the arena, combat leaves room for the siren, and the existing
  compressor/final output bound remains. Mute fades already-playing tails too.
  The previously requested death and room-arrival chimes are preserved.
- Gunfire emits brief warm sparks and drifting muzzle smoke, instead of a dozen
  long-lived particles. Muzzle events now use the actual launch point. Sword and
  hammer handling use their own textures. Combat events use the already optional
  timestamp, so hot join does not replay historic gunfire/explosions. Protocol
  is **27** after incorporating the concurrent weapon release; this audio pass
  adds no required wire state or Pi configuration change.
- Source QA: all 46 profiles rendered in real OfflineAudioContext, fade fully and
  release voices. A 48-voice stress mix stayed below 0.9 peak. Real Edge host,
  guest and hot join used selected TURN relay candidates. Mouse firing delivered
  twelve weapon families; the normal siren ended at host detonation and within 70 ms
  on guests. Hot join sought 0.87–1.03 seconds into the countdown. Mute, resume and early
  removal passed. Actual gameplay screenshots were inspected; no browser errors.
  This is a single QA machine using real TURN, not a cross-ISP or physical mobile
  test. Samples/reports/scripts are outside Git at `bonk-club-qa/audio-*`.
- Gameplay version **0.5.0**, following the concurrent v0.4.0 weapon release.
  Published revision: `e8d55b66dc1af7dab5927579ace4c57ff755dce9`.
  Pages run `34613386463` passed **536 gameplay/network tests**, **3 server tests**,
  production build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34613386463.
- All **15 public files** matched the exact committed production build byte for
  byte. JS: `index-C6_cHeVO.js`; CSS: `index-DB2pWx_1.css`. Exact LF archive/build:
  `bonk-club-qa/audio-release-e8d55b6`; checker: `verify-audio-live.cjs`.
  The unmodified production bundle and public game both passed three-browser
  lobby, start, hot join, departure, mute, small viewport and disconnect checks
  through selected TURN relay candidates, without browser errors. Audio-specific
  source checks are in `audio-browser.cjs`; rendering/mix checks and WAV previews
  are in `audio-render.cjs` and `audio-*.wav`. Complete warmed PCM cache: about
  11 MiB, with one normal playback source per sound. No debug hooks ship.
## Jelly, Midas, Tangle and persistent shots — 11 September 2026

Worktree: `bonk-club-quirky`, branch `codex/quirky-weapons`, started from `755ede5`
and merged the newer menu montage. The canonical checkout's network/nuclear/terrain
WIP is preserved. The arsenal now contains **36 weapons**:

- Jelly Gun: elastic living ragdolls rebound from floors, walls and props. Lethal
  shots produce independently colliding jelly pieces.
- Midas Gun: physical constraints preserve the victim's pose as a heavy gold
  statue. Lethal statues fall, then scatter colliding coins after 1.15 seconds.
- Tangle Gun: yarn constrains wrists and ankles, drawing a living fighter into a
  rolling knot. Lethal knots unravel into separate curling strands.

All three have distinct held/pickup/projectile art, firing sounds, throw masses
and result causes. Living transformations last 1.6 seconds and use existing safe
knockdown recovery. They cannot stack their duration. Empty-hand parries reflect
them; cover stops them. Ice replaces the transformation and black holes restore
their usual stretched-body capture. Death pieces clear within four seconds.
Rare/exotic featured rotation includes all three; nuclear frequency is unchanged.

Every airborne projectile now keeps flying past its old lifetime and the arena
boundary. Grenades keep intentional fuses; fireworks and black-hole seeds activate
on contact, ducks after their permitted bounces/contact, and boomerangs still return
and can be caught. Firework sparks persist too. Bots use the new flight reach.
The host retains distant flight but omits it from drawing and transport. Nearby
shots have a 512-shot admission limit; reaching it preserves existing shots and
does not spend ammunition. An off-map singularity no longer prevents round scoring.

Gameplay is in `src/transmutation.js` and `src/projectile-flight.js`; art is in
`src/transmutation-art.js`. Protocol **27** validates the new state and IDs.
Both players must refresh and create a new room. The display release is **v0.4.0**.
No Pi infrastructure changes. QA helpers, logs and screenshots: `bonk-club-qa/quirky-*`.

Published revision: `7d88765571db94a6837956079b22e939bc6e6db0`. Pages run
`34612958119` passed **525 gameplay/network tests**, **3 server tests**, production
build and deployment: https://github.com/SamCousinsGB/bonk-club/actions/runs/34612958119.
All **15 public files** matched the exact committed LF-source build byte for byte.
JS: `index-CDqmsxgy.js`; CSS: `index-DB2pWx_1.css`. Exact archive/build:
`bonk-club-qa/quirky-release-7d88765`; checker: `verify-quirky-live.cjs`.

Source Edge host/guest tests verified all three living transformations and death
effects over selected TURN relay candidates, hot joining bound limbs, and real
guest mouse input firing at the host. The exact production build passed the
three-browser room lifecycle/relay check. Guest effect drawing cost was 0.6 ms
at p95 on this QA machine, a CPU measurement rather than FPS or internet latency.
Weapon art, physical poses, fragments and actual guest gameplay were inspected.
Release-note/menu checks passed at 1440×900, 390×844, 568×320 and 320×568.

The unmodified public v0.4.0 game was also checked in the in-app browser: host
creation, guest lobby connection, match start, third-player hot join, continuing
rounds and rendered guest gameplay all passed with no browser errors. A cached
v0.3.0 page cleared with `?release=7d88765`; hard-refresh old tabs before reconnecting.
These checks use real browsers on one QA machine, not a cross-ISP test. Temporary
QA rooms and this task's Vite server were closed. The isolated worktree is clean;
the canonical checkout's independently changing WIP remains untouched.

## Main-menu effects montage — 11 September 2026

The menu now runs six Canvas vignettes: Tesla electrocution, acid melting,
freeze/shatter, plasma skeleton-to-ash, incineration and railgun dismemberment.
Each lasts roughly seven to eight seconds, with a shuffled rotation, no adjacent
repeat, varied colours and scenery, and short fades through a dark background.
This replaces the repeating three-fighter demo World. It does not run physics,
bots, audio or networking, and it stops advancing while a match is being drawn.
The acid sequence is menu artwork, not a new gameplay weapon or hazard.
Reduced-motion preference uses a fixed, visible electrocution/skeleton frame.

The montage and scheduling live in `src/menu-montage.js`. `Renderer.resize`
records the display dimensions so the menu fills the screen without distorting
the figures; gameplay retains its existing arena aspect ratio. Phone portrait
puts the montage above the controls; short landscape keeps compact controls on
the left and the scene on the right. The requested release note is now
**v0.3.0 — New main-menu effects montage**. Wire protocol stays **26**.

Worktree: `bonk-club-menu`, branch `codex/menu-montage`, based on `755ede5`.
The canonical checkout's unfinished network/nuclear/terrain edits were preserved.
All **509 tests passed**, including montage rotation, bounded clock and reduced
motion; production build passed. Real Edge source and production checks cover
all six scenes, intermediate transformations, responsive bounds, menu actions
and solo start/return. Staged host/guest/hot-join checks passed through selected
TURN relay candidates without browser errors. No Pi configuration changed.
QA helpers and screenshots are in `bonk-club-qa`: `montage-visual.cjs`,
`montage-lifecycle.cjs`, `montage-smoke.cjs` and `presence-browser.cjs`.
Published revision: `b191ad40fab88da71a620824a551096f919587e2`.
Pages run `34612361348` passed all **509 game tests**, **3 server tests**, build
and deployment: https://github.com/SamCousinsGB/bonk-club/actions/runs/34612361348.
All **15 public files** match the exact committed build byte for byte. Archive:
`bonk-club-qa/montage-release-b191ad4`; checker: `verify-montage-live.cjs`.
JS: `index-BemlW_Vn.js`; CSS: `index-DB2pWx_1.css`.
The public menu passed at 1440×900, 390×844, 568×320 and 320×568, including
Controls and solo start/return, without clipped buttons or release notes.
Public host/guest/hot-join/disconnect checks also passed with selected TURN
relay candidates and no browser errors. These are real browser contexts on
the QA machine, not a new cross-ISP measurement. Live screenshots were inspected.
Source lifecycle checks proved automatic cuts, Character/Settings access,
no montage advancement during play and a pixel-identical reduced-motion still.

## Main-menu release note — 11 September 2026

The menu displays **v0.2.0 — 6 new weapons added**. The version and short release
summary come from `package.json` (`version` and `releaseNotes`), with the root
lockfile version kept in sync. `AGENTS.md` now records Sam's explicit request
and the major/minor/patch convention for future releases. The multiplayer
protocol remains **26**; its number is separate from the displayed version.

The note sits below the menu buttons on desktop/portrait and beneath the title
in the other column on short landscape screens. It hides with the menu during
play and returns on leaving a match. The production build and staged real Edge
checks passed at 1440×900, 390×844, 568×320 and 320×568, including visible bounds,
no overlap, Controls, solo start/return and no browser errors. Screenshots were
inspected. Helper: `bonk-club-qa/menu-release-browser.cjs`.
Release verification follows after publishing.

## Six more weapons — 11 September 2026

Worktree: `bonk-club-arsenal`, branch `codex/arsenal-expansion`, based on
`ad56cef`. The canonical checkout's existing network/nuclear/terrain WIP was
left alone. This adds six weapons, bringing the arsenal to **33**:

- Sledgehammer: 68 damage, strong launch, a slower physical sweep and longer
  recovery. Its final use completes the visible swing. It can be parried.
- Crossbow: 58-damage bolts pierce fighters once each and pass through panels
  only when the hit breaks them. Structural cover still stops them.
- Harpoon gun: a successful hit pulls a living opponent toward the living
  shooter, with physical momentum and a brief cable. Intervening cover stops
  the pull; parries transfer projectile ownership.
- Shrapnel cannon: eight fragments per shell, two wall bounces, strong recoil,
  bleeding and limb separation on lethal hits. One parry stops one fragment.
- Firework launcher: rockets burst on impact or after 1.15 seconds into ten
  damaging sparks. The small initial blast carves real terrain. Children cannot
  burst recursively and all projectiles expire within the existing caps.
- Cryo grenade: the normal 450-speed upward toss and 2.8-second fuse, followed
  by a 210-radius freeze burst. Cover shields fighters, the owner can be frozen,
  and terrain is preserved. Existing thaw cooldown and shatter behavior apply.

Each has distinct held/pickup/projectile art, appropriate sounds and throw mass.
Easy bots use regular controls/ammunition. Existing nuclear frequency and tier
weights remain intact; the larger featured bag persists across short rounds.
Protocol is **26** because older guests cannot decode the new weapon/projectile
and field identifiers. Both players must refresh and create a new room.

Source QA: the new behavior tests and extended hammer swing tests pass, including
all six weapons used by Easy bots, ammo preservation, cover, recoil, parries,
resets, malformed snapshots and interpolation. Real Edge host/guest browsers
received all six weapons through selected TURN relay candidates. A third browser
hot joined terrain cut by a firework; platform IDs matched. Real guest mouse
input fired a harpoon at the authoritative host. Gameplay and weapon silhouettes
were visually inspected without browser errors. Hooks are confined to the QA
helper at `bonk-club-qa/arsenal-browser.cjs`; screenshots use `arsenal-*.png`.

Published gameplay revision: `77852da22cd396930c9579666f3175f0c8a6c274`.
Pages run `34547505565` passed **506 gameplay/network tests**, **3 server
tests**, production build and deployment:
https://github.com/SamCousinsGB/bonk-club/actions/runs/34547505565.
The local complete run passed 495 tests; the subsequent additional bot and
hammer cases passed in the focused 36-test run, then all 506 passed together
in CI. No Pi settings or services changed.

All **15 public files** matched the exact committed production build byte for
byte. JS: `index-CZTnBftX.js`; CSS: `index-Cn7ksyh0.css`;
worker: `clock-worker-CSNsw-OA.js`. Archive/build:
`bonk-club-qa/arsenal-release-77852da`, exported with `git archive` for LF parity.
Checker: `bonk-club-qa/verify-arsenal-live.cjs`.
The unmodified production bundle and public game both passed three-browser
lobby, start, hot join, departure/rejoin, sound, small-viewport and disconnect
checks through selected TURN relay candidates, without browser errors. This is
real WebRTC/TURN on one QA machine, not a cross-ISP test. Gameplay screenshots
were inspected. Reusable production check: `presence-browser.cjs`, setting
`BONK_PRESENCE_DIST` to the exact build for staging, then running with `--live`.

## Guest freezes and black-hole bandwidth — 10 September 2026

Worktree: `bonk-club-performance`, branch `codex/performance-network`.
Sam reported that the guest froze then fast-forwarded while the host stayed smooth.
The host uses Wi-Fi; the guest uses a wired connection.

- Reproduced through real Edge host/guest browsers with selected TURN relay
  candidates. In a four-second held black-hole scene, one hole delivered only
  18 guest updates with a 1.257-second maximum gap; two delivered 12 with a
  1.274-second gap. Host rendering remained smooth. These are delivery gaps,
  not renderer CPU timing or measurements on Sam's friend's PC.
- Verified the live game TURN allocation limit is 131072 bytes/second. The old
  overlapping-field snapshots reached about 35 KB each at a requested 30 Hz,
  substantially exceeding that limit. No Pi settings or services were changed.
- Gameplay now uses a negotiated unordered, zero-retransmission RTC stream on
  the existing peer connection. PeerJS retains reliable room/lobby messages.
  Both ends announce stream readiness; bounded reliable fallback remains.
  Controls are sequenced and validated; full independent snapshots use bounded
  12 KB packets, two incomplete assemblies maximum, and one active decode plus
  one newest replacement. Old frames cannot build a playback queue.
- Send pacing reserves headroom below the relay cap at 90000 payload bytes/s
  per guest. Snapshot frequency varies with size, up to 30 Hz; drawing remains
  independently interpolated. Busy overlapping effects are around 10 updates/s
  in the tested fixture, not a claimed 30 Hz under every possible load.
- Wreck outlines use 0.1-world-unit precision and reconstruct their spines and
  invisible collision strips at the guest. Five small strip-count hints preserve
  stable collision IDs despite rounding. Host physics is unchanged. Full map,
  persistent destruction, hot join and round reset remain self-contained.
  The two-hole fixture fell from roughly 35 KB to 8.2 KB per snapshot.
- Guest playback resets its clock after a stall and cannot reverse as jitter
  estimates change. Interpolation avoids copying invisible collision strips and
  uses indexed matter items. Simulation catch-up is capped at eight fixed steps;
  its worker permits one outstanding tick instead of accumulating timer messages.
  Black-hole lens canvases/textures allocate once at 256 px and reuse texture
  storage. The field, deforming matter and destruction effects are preserved.
- Connection details now includes transport, queued bytes, received/skipped
  updates, update gaps and encoding duration. Reports still omit addresses,
  room codes and credentials. These measurements are local to each browser.
- Protocol is **25**. Both players must refresh and use a new room after release.
- Staged real relay checks: one-hole maximum update gap about 96 ms, two-hole
  116 ms; hot-join collision IDs matched, real guest key controls arrived.
  Deliberate loss/reordering produced no reverse playback or queued input;
  recovery after a deliberately blocked 1.2-second guest event loop was within
  0.21 seconds of host time after 0.6 seconds. Moving fields were also exercised
  with guest CPU throttled fourfold. Gameplay screenshots were inspected.
- QA scripts/results are outside Git in `bonk-club-qa/performance-*`.
  `performance-browser.cjs stress` routes public-origin assets to local port 5197
  while using the real relay; hooks and injected loss exist only in the harness.
  This is real WebRTC/TURN evidence on one machine, not a cross-ISP test or proof
  of the friend's hardware/Wi-Fi environment. Release verification follows below.
- Final local verification: **481 gameplay/network tests passed**, production
  build passed, and `git diff --check` passed. New tests cover packet loss,
  reordering/duplicates, bounded decoding, pacing, negotiation/fallback, invalid
  controls/ribbons, all 24 arenas with overlapping fields and round reset.
- Published gameplay revision: `ca056123404d54a75d8e55039e5604dab0da44d9`.
  Pages run `34516969530` succeeded with **481 game/network tests and 3 server
  tests**, production build and deployment:
  `https://github.com/SamCousinsGB/bonk-club/actions/runs/34516969530`.
- All **15 public files matched the exact committed build byte for byte**.
  JS: `index-BUzRUMlv.js`; CSS: `index-Cn7ksyh0.css`;
  worker: `clock-worker-CSNsw-OA.js`. Export/build in
  `bonk-club-qa/performance-release-ca05612`, made with `git archive` for LF parity.
- The production bundle passed staged and live four-player checks through
  selected relay candidates. All connections used negotiated unordered streams
  with zero retransmissions. Guests continuously received updates; controls,
  Connection details, leave and hot rejoin worked without browser errors.
  Maximum normal-play update gap in the public fixture was 66 ms. This does not
  supersede the overlapping-field measurements or claim the friend's ISP tested.

## Player join and leave notifications — 10 September 2026

Implemented in `bonk-club-notifications`, branch `codex/player-notifications`,
preserving the canonical checkout's concurrent terrain changes.

- Human arrivals and departures show a compact named notification in the lobby
  and gameplay. Up to three notices stack, then expire after four seconds. They
  do not intercept controls, names are inserted as text, and reduced motion is
  respected. Host connection loss has a departure tone and room-disconnect notice.
- Arrivals have a soft rising two-note chime; departures have a lower falling
  chime. They use the existing sound toggle and limiter, with bounded voices and
  same-type burst coalescing. Opening or joining a room unlocks lobby audio;
  automatically opened invites resume suspended audio on the first user gesture.
- `src/room-presence.js` compares copied human rosters per room. Initial rosters,
  duplicate updates, profile/slot edits and AI replacements do not produce false
  alerts. Leaving/changing rooms clears notices. No wire or Pi changes.
- 473 gameplay/network tests passed, including six new presence/audio cases.
  Final targeted presence tests passed after browser-driven audio adjustments.
  Production build and whitespace checks passed.
- Three real Edge contexts verified host/guest notifications through selected
  TURN relay candidates: lobby joins, renamed departures, hot join, in-game leave,
  mute, expiry, room reset and host disconnect. Web Audio oscillator scheduling
  confirmed both chimes. Rendered gameplay and a 568 x 320 viewport were inspected;
  no browser errors. QA helper: `bonk-club-qa/presence-browser.cjs`.
- Live gameplay revision: `a1889f3fd5295d618172bdf08178a46864c5d7a9`.
  Pages run `34514514304` passed 473 game/network tests, three server tests,
  build and deployment: https://github.com/SamCousinsGB/bonk-club/actions/runs/34514514304.
  All 15 public files match the exact committed production build byte for byte.
  JS: `index-3wh8c88d.js`; CSS: `index-Cn7ksyh0.css`. The full three-browser
  presence check above also passed against the public site, without asset routing.
  Exact archive/build: `bonk-club-qa/presence-release-a1889f3`.
- Offline Web Audio rendering passed: join/leave peaks 0.231/0.224, both fade to
  silence and release all voices. Samples: `bonk-club-qa/player-join.wav` and
  `player-leave.wav`; helper: `presence-audio.cjs`. No QA hooks ship in the game.

## Current release: death feedback — 10 September 2026

Implemented in `bonk-club-death-cue`, branch `codex/death-cue`, preserving the
canonical checkout's concurrent terrain work. Live gameplay revision:
`6fe14971b2e23cf548f01e47926345908c3c2eb5`.

- Every death has a drawn ivory skull with the fighter's colour around its edge.
  It pops in above the body, follows its motion, rises gently and fades completely
  after 1.1 seconds. Reduced motion removes the pop/rise. Falls keep the marker
  inside the arena edge; consumed bodies retain a marker at their last location.
- A short impact and descending two-note chime accompany every death. Existing
  weapon death sounds remain layered underneath. Death cues have priority during
  busy combat, a bounded voice count, simultaneous-death coalescing and mute support.
- Optional `ko.at` and ragdoll `deathId` fields share the host clock and link the
  marker to its body. Validation rejects malformed metadata. The required wire
  shape is unchanged and older snapshots remain accepted: protocol stays **24**.
  Four markers maximum; duplicate events cannot restart them; round/room changes
  clear them; hot join and background catch-up skip expired death cues.
- Ten new regressions cover death variants, body following, lifetime, consumption,
  simultaneous deaths, event churn, resets, transport/interpolation, invalid wire
  values, audio priority/mute/caps and stale audio suppression.
- Source-build real Edge host/guest checks passed through selected TURN relay
  candidates, with one cue per death, matching corpse attachment, expiry and
  third-browser late join without old sounds/skulls. Actual rendered gameplay
  was inspected. Offline Web Audio output peaked at 0.379, faded to silence,
  and released all voices. No browser errors, new dependencies or Pi changes.
- QA helper and screenshots: `bonk-club-qa/death-cue-browser.cjs`,
  `death-cue-host.png`, `death-cue-guest.png`, `death-cue-expired.png`; audio:
  `death-cue.wav`. Browser hooks exist only in the QA helper.
- All **467 gameplay/network tests** passed locally. Pages run **34512804095**
  passed gameplay tests, server tests, production build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34512804095.
- All **15 public files** matched the exact committed production build byte for
  byte. JS: `index-ypyCS4FE.js`; CSS: `index-P_ztR8EB.css`. Archive/build:
  `bonk-club-qa/death-cue-release`; checker: `verify-death-cue-live.cjs`.
- The unmodified staged production bundle and public game both passed real
  host/guest lobby, match and ordinary keyboard gameplay checks. Actual deaths
  rendered skulls and scheduled the new chime on both browsers, without errors.
  Helper: `death-cue-production.cjs`; screenshots: `death-cue-staged.png` and
  `death-cue-live.png`. Source checks above forced TURN; production used normal ICE.
- The task's development server on port 5201 was stopped. Refresh game tabs to
  load the new visual and sound. No production debug hooks were added.

## Previous release: phase beam, fire and three new weapons

- Live gameplay revision: `6a9cfeb75c5b36f832b9c1a44988e5187da669d2`, including
  weapon implementation `6e6fafa` and concurrent violent-black-hole update
  `701aa59`. The phase beam now grows from the physical muzzle through a triangle
  into its full width, with matching collision/destruction. Fire reaches about
  800 units and burns persistently at 18 HP/second until char death. Bubble gun,
  returning boomerang and bouncing explosive rubber duck launcher are included.
  Detailed mechanics and source QA are recorded in the weapons section below.
- **Current protocol is 24; all players must refresh their tabs.** Older sections
  below describe their own release protocols.
- All **457 gameplay/network tests** passed on the exact combined committed
  archive. Pages run **34490871282** passed those tests, all **3 server tests**,
  production build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34490871282.
- All **15 public files** matched that production build byte for byte. JS:
  `index-C9hyXMi9.js`; CSS: `index-P_ztR8EB.css`. Archive/build:
  `bonk-club-qa/weapons-release-6a9cfeb`; checker: `verify-weapons-live.cjs`.
- Combined-source effects checks passed again after merging: real Edge host,
  guest and third-browser hot join through selected TURN relay candidates,
  receiving burn deaths, bubbles, boomerangs, ducks and matching phase-cut terrain.
  Actual rendered gameplay and aimed/prone beams were inspected without errors.
- The unmodified production build passed in-app browser gameplay and controls
  checks. The public site passed host/guest lobby, match start and rendered
  gameplay checks, including visible bubble pickups, without console errors.
  Source effects checks forced relay; public in-app checks used normal ICE.
- Development/preview servers started by this task on ports 5198 and 5199 were
  stopped. The canonical checkout's concurrent edits were preserved. No Pi changes,
  dependencies or production debug hooks were added.

## Violent black-hole orbits — 10 September 2026

Implemented in `bonk-club-violent-orbit`, branch `codex/violent-blackhole`, from
current main while preserving the canonical checkout's unfinished terrain edits.

- Replaced continuous steering toward an orbital velocity with softened central
  gravity, retained momentum, weak drag and uneven radial/tangential forces.
  Capture preserves translation and spin; close passes rebound through a soft
  pressure region instead of settling on a prescribed radius.
- Body strands have elastic tension and local eddies that make arms/legs fold,
  whip and recoil independently. Existing swept limb collision and control
  suppression remain. The visible orbit sits outside the lens until compression.
- Weapons and other collected samples keep orbiting and tumbling until the final
  1.1 seconds. Samples caught exactly at the centre also enter the active flow.
  The persistent compressed ball, all contents counts, outer warped artwork,
  collision, host authority, hot join and round reset remain intact.
- Six new regressions cover capture momentum, rapid eccentric body motion, joint
  bending, a hand impulse, loose-matter movement/transport, inherited prop spin
  and exact-centre capture. No required wire shape changed; protocol remains 23.
- Final source-build Edge host/guest and third-browser hot-join checks passed
  through verified selected TURN relay candidates, including the live strands,
  packing, final contents and matching outer collision. No browser errors.
  Guest drawing CPU p95 was 1.6 ms over 786 samples, not FPS or internet latency.
- Actual rendered gameplay inspected at six points through capture and collapse.
  QA helpers/screenshots: `bonk-club-qa/violent-visual.cjs`, `violent-online.cjs`
  and `violent-*.png`. No production hooks, new dependencies or Pi changes.
- Released gameplay revision: `701aa591a67a5790fb32b28929d733c0074d165b`.
  All **442 gameplay/network tests**, the production build and `git diff --check`
  passed locally. Pages run **34490314084** passed game/server tests, build and
  deployment: https://github.com/SamCousinsGB/bonk-club/actions/runs/34490314084.
- All **15 public files** matched the exact committed archive/build byte for
  byte. JS: `index-Buxs9vaL.js`; CSS: `index-P_ztR8EB.css`. Both staged production
  and public browsers passed host/guest lobby, slots, hot join, departure/rejoin,
  mobile layout and selected TURN relay checks without browser errors.
  Archive/build: `bonk-club-qa/violent-release`; helpers: `violent-production.cjs`
  and `verify-violent-live.cjs`. Refresh game tabs to load the release.
- Actual gameplay clip: `bonk-club-qa/violent-orbit.webm`. The task's port 5197
  development server was stopped; other tasks' servers and work remain intact.

## Clear mobile controls — 10 September 2026

Sam requested less obstruction, no Lie down/Throw buttons, and joysticks that
hide while held. This supersedes the older visible-button requirement below.

- Removed those two buttons and the permanent gesture hints. Retained gesture
  throws (double-tap right) and prone movement (drag down on the left).
- Joysticks are small, unfilled guides near the bottom corners. Each guide and
  label fades out while its pointer is held and returns on release/cancellation.
  Only the artwork hides: the original large touch zones and pointer capture
  remain active. Removed per-frame layout reads for invisible joystick artwork.
- Jump and contextual Parry/Alt fire are translucent 64 x 48 targets at the
  bottom edges, leaving the arena centre clear. No game/world/wire changes.
- 436 gameplay/network tests and the production build passed after integrating
  the subsequent bot identity and black-hole releases. Real Chromium touch events verified
  independent guide visibility, simultaneous movement/fire, two jumps, prone
  drag/cancellation, gesture throws preserving ammo, rotation/menu recovery,
  and desktop-host/mobile-guest control delivery, release and hot rejoin.
- Visually inspected actual gameplay at 568 x 320, 667 x 375, 844 x 390 and
  1024 x 768. All remaining button targets are at least 44 pixels, with no
  overlap or page scrolling. These are emulated phone/tablet browsers, not
  physical iOS/Android hardware tests. No TURN configuration changed.
- Isolated worktree: `bonk-club-mobile-clear`, branch `codex/mobile-clear-view`.
  The original checkout's unfinished edits were preserved. QA helper/screenshots:
  `bonk-club-qa/mobile-clear-browser.cjs` and `mobile-clear-source/`.
- Live gameplay revision: `e031499e1a90df9cb02e54178423939274f2cf7f`;
  mobile implementation: `c408aed`. Pages run `34487368851` passed tests, build
  and deployment: `https://github.com/SamCousinsGB/bonk-club/actions/runs/34487368851`.
  The first publishing attempt hit a GitHub ID-token request timeout; retrying
  only the failed publish job succeeded using the same tested build.
- All 15 public files matched the exact committed archive/build byte for byte.
  JS: `index-C5-1pa9d.js`; CSS: `index-P_ztR8EB.css`. Archive/build:
  `bonk-club-qa/mobile-clear-release`; production and public QA screenshots:
  `mobile-clear-staged/` and `mobile-clear-live/`. The public bundle passed the
  four-size layout/real-touch checks and real desktop-host/mobile-guest lobby,
  gameplay, leave and hot rejoin checks without browser errors. Internal host
  control-state assertions used the source build; public checks used the
  unmodified bundle. Protocol remains **23**. Refresh players' tabs.

## Black-hole capture and collapse — 10 September 2026

Implemented in `bonk-club-collapse` on `codex/blackhole-collapse`, based on current
GitHub main while preserving concurrent work in the canonical checkout.

- Living fighters become passive, connected particle strands. Differential forces
  stretch and curve each limb; intermediate particles sweep against platforms and
  moving wreckage. Controls remain suppressed until compression or release. Even
  a fighter caught at the centre gets a visible orbit before closing.
- The last 1.1 seconds compress the collected matter. Fighters are consumed during
  that closing phase, retaining their colour and carried weapon in the final ball.
  Dead bodies, weapons, props, traps, projectiles, debris and blood also contribute.
  Captured ammunition becomes inert matter. All source counts are retained with
  at most 96 visual samples per core, including rare contents among common rubble.
- The dense ball persists as breakable wreckage with 14 circular collision strips.
  The outer twisted platforms keep their existing textured art and collision.
  The ball follows the existing damage, nuke, transport and round-reset paths.
- **Protocol 23: all players must refresh their tabs.** Live strands, forming cores
  and settled matter are validated and interpolated; sample identities are stable.
  No production debug hooks, new dependencies or Pi changes.
- Real Edge host/guest browsers verified live stretched fighters, visible packing
  and the final mixed ball through selected TURN relay candidates. A third browser
  hot joined and received matching core contents and outer wreck collision.
  No page errors. Guest renderer CPU cost was 2.3 ms at the 95th percentile over
  796 samples; this is drawing cost, not FPS or internet latency.
- QA scripts/screenshots: `bonk-club-qa/collapse-visual.cjs`, `collapse-online.cjs`
  and `collapse-*.png`.
- Verified live in `e031499e1a90df9cb02e54178423939274f2cf7f`, including black-hole
  release `888d4c6` and the subsequent mobile clear-view update. Pages run
  `34487368851` passed **436 gameplay/network tests**, **3 server tests**, build
  and deployment. A transient GitHub deployment ID-token timeout was resolved by
  retrying the deploy job; workflow permissions and application code were unchanged.
- All **15 public files** matched the exact committed production archive byte for
  byte: `index-C5-1pa9d.js`, `index-P_ztR8EB.css`. The public game passed actual
  host/guest lobby, slots, hot join, departure/rejoin and mobile viewport checks
  through selected TURN relay candidates without page errors. The exact build is
  in `bonk-club-qa/collapse-release-e031499`; verification helpers are
  `verify-collapse-live.cjs` and `collapse-production.cjs`. The task's port 5189
  development server was stopped. The canonical checkout's unfinished edits were
  left intact.

## Fullscreen and UI fit — 10 September 2026

Implemented on `codex/fullscreen-ui` in
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-fullscreen`, preserving the canonical
checkout's concurrent gameplay changes.

- The stage fills the viewport in menus and gameplay, without the former outer
  margins, maximum width, rounded frame, header row or footer row. The complete
  arena retains its aspect ratio. Scores and menu controls stay inside safe areas.
- Start, Online, Quick match and Join request fullscreen immediately on desktop
  and touch. Invite links show Join room on both to provide browser activation.
  Only touch requests landscape locking. Refusal leaves a usable viewport game.
- Removed the question-mark help icon. Controls remain available in the menus.
  Sound and fullscreen toggles are available from Game menu during play. Desktop
  Back to game respects an intentional fullscreen exit.
- Short landscape menus use two columns. Dialogs fit the viewport and scroll
  internally, with a reachable sticky close button and no horizontal overflow.
- Browser checks cover eight sizes from 320 x 568 portrait and 568 x 320 landscape
  to 2560 x 1080, actual desktop fullscreen entry/exit/re-entry, denied APIs,
  character/settings/controls panels and real simultaneous touch drags/releases.
  Real host/guest staged production browsers passed lobby, slot controls, hot join,
  departure/rejoin and selected TURN relay checks without browser errors.
- QA helpers/screenshots: `bonk-club-qa/fullscreen-ui.cjs`, `fullscreen-online.cjs`
  and `fullscreen-ui/`. No production debug hooks or Pi configuration changes.
- Fullscreen implementation: `a23cbd0`; the combined published revision is
  `e031499e1a90df9cb02e54178423939274f2cf7f`. It includes the later mobile-control
  cleanup and other concurrent gameplay changes. Preserve those updates.
- Pages run `34487368851` passed **436 gameplay/network tests**, **3 server
  tests**, production build and deployment. The initial publish step hit a GitHub
  OIDC request timeout; the deployment-only retry succeeded:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34487368851.
- All **15 public files** match the exact committed production build byte for
  byte. Archive/build: `bonk-club-qa/fullscreen-release-e031499`; JS:
  `index-C5-1pa9d.js`; CSS: `index-P_ztR8EB.css`.
- Public-site checks passed all eight viewport sizes, actual desktop fullscreen
  Start/exit/re-entry, denied fullscreen/orientation fallback, scrolling panels,
  sound toggles and simultaneous touch drags/releases. Live host/guest lobby,
  hot join, departure/rejoin and selected TURN relay checks passed without page
  errors. Rendered gameplay was inspected. Phone checks use browser emulation;
  physical iOS/Android fullscreen and orientation locking remain device-dependent.
- This task's development server on port 5194 was stopped.

## Victory messages — 10 September 2026

Implemented in `bonk-club-victory` on `codex/victory-messages`, based on current
GitHub main while preserving the canonical checkout's unfinished terrain work.

- Results show `SAM WON` with a second line based on the final elimination.
  Nuclear: `By nuclear apocalypse`. Black hole: `By commanding the forces of
  space and time`. There are 25 finish messages covering weapons, melee, fire,
  ice, traps, props, throws, falls and sudden death. This creative copy was
  explicitly requested; the general ban on unsolicited filler still applies.
- The authoritative engine records lethal causes independently of expiring
  events/ragdolls. Later deaths overwrite earlier ones, dangerous special fields
  still delay scoring, and draws/new rounds clear the result. A departure does
  not reuse an earlier kill. Weapon identity comes from the hit, including the
  final round of ammunition; shattering ice takes precedence over the weapon.
- `src/victory.js` owns the bounded cause identifiers and copy. `victoryCause`
  is validated in snapshots and survives compression, interpolation and hot join.
  This change introduced protocol 22; the combined black-hole release now uses
  **protocol 23: all players must refresh their tabs.** No Pi changes.
- Added 21 regression tests covering real lethal attacks, nuclear/black-hole
  sequencing, fall ordering, draws, resets, departures and malformed wire values.
- Real Edge host/mobile guest and a late joiner received nuclear and black-hole
  messages through selected TURN relay candidates without browser errors. Actual
  rendered gameplay was inspected at desktop, 844 × 390 and 568 × 320 sizes.
  Long names scale down to keep the title readable. QA helper and screenshots:
  `bonk-club-qa/victory-browser.cjs` and `victory-*.png`, outside production.
- Published in combined revision `e031499e1a90df9cb02e54178423939274f2cf7f`,
  including the later panel, fullscreen, bot-identity, black-hole capture and
  mobile-clear-view updates. Victory implementation: `bb3cb47`.
- Pages run `34487368851` passed **436 gameplay/network tests**, **3 server
  tests**, production build and deployment. The first deployment attempt hit a
  transient GitHub OIDC request timeout; the deployment retry succeeded:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34487368851.
- All **15 live files** match the exact committed archive build byte for byte:
  `bonk-club-qa/victory-release-e031499/dist`. JS: `index-C5-1pa9d.js`;
  CSS: `index-P_ztR8EB.css`. Earlier release runs were superseded by concurrent
  main updates; their unfinished deployments were not claimed as live.
- The staged production bundle and public game both passed a normal two-player
  round driven with browser keyboard events. The guest fell out of the arena;
  both screens showed `SAM WON` / `By trusting gravity to finish the job`, then
  cleared it on the next round. Both selected TURN relay candidates, with no
  page errors. Helper: `victory-release-browser.cjs`; live-file checker:
  `verify-victory-live.cjs` (set `VICTORY_REVISION=e031499`). Final screenshots:
  `victory-live-host.png`, `victory-live-guest.png` under `bonk-club-qa`.
- The task's development server on port 5193 was stopped. Canonical checkout
  changes were preserved; this worktree is clean after the release-note commit.

## Restore bullet damage to marked panels — 10 September 2026

Sam's latest request restores shooting out destructible platforms. This supersedes
the earlier explosion-pass rule that made all terrain immune to bullets.

- Fixed both exclusions: marked wood/glass panels are breakable again, and
  projectile impacts can damage breakable platforms. Structural supports/lifts
  still resist bullets. Circular blast carving, physical props and grenade fuses
  retain their current behavior. Bots can shoot a marked panel under an opponent.
- Existing damage, collision removal, navigation invalidation, debris and snapshot
  paths handle the result. Surviving blast-cut panels and warped wreckage can also
  be shot out. No wire shape or protocol change; protocol remains **21**.
- Added 13 regressions: pistol hits from all four sides, other projectile weapons,
  falling fighters/props/pickups, blast remnants, wreck collision, every arena's
  panels, transport/interpolation and round restoration. The new tests reproduced
  the regression before the fix. Updated obsolete bullet-immunity expectations.
- All **404 gameplay/network tests** and the production build passed. Real Edge
  host/guest browsers used mouse firing to damage and destroy both materials;
  the guest fell through and a third browser hot joined the destroyed map.
  All three selected TURN relay candidates; no page errors. Inspected damaged
  panels and the cleared opening in gameplay screenshots.
- Worktree: `C:\Users\SamCo\Documents\ChatGPT\bonk-club-panel-fix`, branch
  `codex/restore-panel-bullets`, based on `d51781d`. The canonical checkout's
  unfinished edits were preserved. QA helper/screenshots use `panel-` under
  `bonk-club-qa`; hooks are external and never enter production.
- Fix commit: `10880829a0946431a11621cc471a6d96de8cfb35`, included in published
  revision `e031499e1a90df9cb02e54178423939274f2cf7f` with the later main changes.
  Pages run `34487368851` passed **436 gameplay/network tests**, **3 server tests**,
  build and deployment: https://github.com/SamCousinsGB/bonk-club/actions/runs/34487368851.
- All **15 public files** matched the exact committed archive/build byte for byte.
  Archive: `bonk-club-qa/panel-release-e031499`. JS: `index-C5-1pa9d.js`;
  CSS: `index-P_ztR8EB.css`. The production bundle and public game passed real
  host/guest play, slot controls, hot join, departure/rejoin and mobile viewport
  checks through selected TURN relay candidates, without page errors.
- The panel tests passed again after integrating subsequent gameplay changes,
  alongside the affected identity, black-hole, physical-effects and wire tests.
  Current combined protocol is **23**; all players should refresh. Helpers:
  `panel-release-browser.cjs` and `verify-panel-live.cjs`. This task's development
  server on port 5187 is stopped; the canonical unfinished edits remain intact.

## Random NPC identities — 10 September 2026

- NPCs receive a random first name ending in ` (BOT)` and a random body colour,
  hairstyle, hair colour, facial hair and accessory from the character editor's
  supported choices. Active bots have distinct names and colours.
- Identities belong to the occupant and persist through rounds and roster/profile
  refreshes. Human arrivals replace the bot; departures and reopened bot slots
  generate a new identity. A human colour choice only recolours the conflicting
  bot, preserving its name and remaining cosmetics. Other bots keep their scores.
- The name itself includes the suffix throughout gameplay; redundant AI labels
  were removed from the scoreboard and leader line. The existing snapshot profile
  fields carry all choices to guests and hot joiners, with no protocol change.
- Implemented on `codex/random-bot-identities` in `bonk-club-bot-identities`, based
  on current main, preserving the canonical checkout's unfinished terrain work.
- 396 gameplay/network tests passed. Real Edge host/guest browsers verified solo
  and online identities, every appearance field, round persistence and surviving
  bot identity through hot join/departure/rejoin. Selected TURN relay candidates
  were verified, rendered gameplay inspected, and no browser errors occurred.
- QA helper and screenshots: `bonk-club-qa/bot-identities-browser.cjs` and
  `bot-identities-*.png`. Browser hooks exist only in the external QA helper.
- Published in combined revision `e031499e1a90df9cb02e54178423939274f2cf7f`;
  NPC implementation commit `bec0002`. Pages run `34487368851` succeeded on its
  second deployment attempt after a transient OIDC token error. All **436 game
  tests and 3 server tests passed**. Earlier NPC runs were superseded by other
  concurrent releases; all of their changes are preserved in this revision.
- All **15 public files** matched the exact committed archive build byte for
  byte. Public solo and real host/guest checks passed, including hot join,
  departure/rejoin, stable bot names, selected TURN relay candidates and no page
  errors. Live gameplay screenshots were inspected. JS: `index-C5-1pa9d.js`;
  CSS: `index-P_ztR8EB.css`. Archive/build: `bonk-club-qa/bot-identities-release`.
  This task's development server on port 5192 was stopped.

## Movement and animation pass — 10 September 2026

Implemented on `codex/movement-pass` in
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-movement`, starting from current main
and preserving the canonical checkout's unfinished terrain edits. The mouse
release fix from main is included.

- Fixed digital AI steering releasing movement at cruising speed. On a clear
  floor the old bot repeatedly slowed from 240 to about 46 units/second; it now
  holds the same 240-unit running speed as a human, on upper and bottom floors.
- Reworked the procedural gait around actual travel after collision: alternating
  planted/lifted steps, suitable leg reach, a small body bounce and both unarmed
  arms swinging. Starts, stops and reversals blend through the physical rig.
  Blocked movement, passive sliding and lift travel do not advance the run cycle.
- Airborne legs tuck on ascent and extend on descent. Landing compression,
  prone/standing recovery, weapon poses, recoil and passive knockdowns remain
  physical. Moving supports carry the rig along with the gameplay body.
- Air recovery now considers existing horizontal momentum when choosing a ledge.
  This fixes a quarry case where a prop-clearing lunge overshot a takeoff and the
  bot tried to return to a ledge it could no longer reach before falling past it.
- `gaitSpeed` is simulation-only; guests still receive the actual physical rig.
  Movement adds no required wire changes. The integrated character-customisation
  release from main uses **protocol 21**; both players must refresh. No Pi changes.
- Twelve new movement regressions cover both running directions and floor levels,
  braking, leg lift/reach, wall stops, jump/landing recovery, lift riders, identical
  poses across floor heights, and recovery after overshooting a takeoff.
- Real Edge host/guest browsers passed through selected TURN relay candidates.
  The guest measured a steady 240-unit AI run, saw lifted steps, and controlled
  reversing, both jumps, landing, prone/recovery and departure without page errors.
  Rendered pose sequences and normal gameplay in Garden Houses, Hillside Mansion
  and Volcanic Quarry were inspected. Helpers/screenshots use the `movement-`
  prefix in `bonk-club-qa`, outside the repository; no production debug hooks.
- Local verification: all 387 movement/mouse gameplay and network tests passed.
  After integrating the current character release, 53 targeted movement,
  identity, network, interpolation and physical-effects tests passed.
- Published gameplay revision: `bcfe475a906ad03c9e63ce20a36ce8d019c0cdbf`.
  Pages run `34483731287` passed **391 gameplay/network tests**, **3 server
  tests**, the production build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34483731287.
- All **15 public files** match the exact committed archive build byte for byte.
  Archive/build: `bonk-club-qa/movement-release-bcfe475`.
  JS: `index-CSGEfSYG.js`; CSS: `index-Cr1OqD9M.css`.
- The combined production bundle and the public game passed host/guest play,
  lobby slots, hot join, departure/rejoin, mobile viewport/menu recovery and
  selected TURN relay checks without browser errors. Helpers:
  `movement-release-browser.cjs` and `verify-movement-live.cjs`.
  The movement worktree is clean after the release-note commit; this task's
  development server on port 5186 was stopped.

## Character customisation — 10 September 2026

Implemented on `codex/character-customisation` in
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-customisation`. The canonical
checkout's unfinished explosion edits were preserved. This release includes
the weighted props, black-hole lens and mouse-button fixes from GitHub main.

- Expanded from 6 to 18 hairstyle choices and from 8 to 24 body colours.
  Added 16 independent hair colours, 6 facial-hair choices and 8 accessory
  choices (counts include None). New hairstyles include braids, curls, buns,
  dreadlocks, pigtails, long hair, a quiff, a side part and shorter cuts.
- Accessories: glasses, sunglasses, goggles, visor, eyepatch, headband and
  headphones. Facial hair uses the selected hair colour. Cosmetic choices do
  not change collision, health, equipment or scores.
- Larger character preview, labelled colour swatches, randomise without
  changing the player's name, mobile layout and lobby character portraits.
  Reserved body colours remain unavailable; hair colours can be shared.
- Existing saved names, body colours and hairstyles migrate with default new
  fields. Appearance persists through the lobby, live edits, hot join, death
  ragdolls and round reset. Guest controls reflect host-accepted profiles.
- `src/identity.js` owns the bounded choices, profile migration/validation and
  shared head drawing. The engine copies cosmetics into physical death bodies;
  the normal and death renderers use the same artwork. No new dependencies.
- **Protocol 21: all players must refresh their tabs.** New profile fields are
  `hairColor`, `facialHair` and `accessory`. Both player and ragdoll snapshots
  reject unsupported cosmetic values. No Pi service configuration changed.
- Verification: **379 gameplay/network tests passed**, including profile
  migration, every cosmetic choice, malformed metadata, colour reservations,
  combat-state preservation and death/round persistence. The production build
  passed with the published room-service and temporary TURN-credential endpoints.
- Actual Edge host, mobile guest and late joiner verified appearance through
  selected TURN relay candidates. Browser checks covered saved-profile reloads,
  randomise, real touch selection, lobby reservations, live edits, hot join,
  ragdolls and round reset, without page errors. Artwork/contact sheets and
  rendered gameplay were visually reviewed. Mobile checks use browser emulation.
- The exact committed production archive also passed character-editor and
  host/guest relay checks. QA helpers/screenshots are in `bonk-club-qa`:
  `character-browser.cjs`, `character-*.png`, `verify-character-live.py`, and
  `character-release/dist`. Hooks remain outside production source.
- Gameplay revision: `427a629b339bb14a9aa5d0ca923110797e899344`.
  Pages run `34482965248` passed gameplay/network tests, server tests,
  production build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34482965248.
  All **15 public files** matched the exact committed build byte for byte.
  JS: `index-CvCzE-OO.js`; CSS: `index-Cr1OqD9M.css`.
  The public game passed saved-profile migration/reload, randomise, mobile touch
  selection, reserved colours, online start and in-game appearance editing,
  with selected TURN relay candidates and no page errors. The task's development
  server on port 5191 was stopped. The customisation worktree is clean after
  this release-note commit; the canonical checkout's unrelated edits remain.

## Stuck mouse buttons - 10 September 2026

Implemented in `bonk-club-mouse` on `codex/mouse-release-fix`, starting from
current main and preserving unrelated changes in the canonical checkout.

- Reproduced with real Edge mouse events: left down, right down, left up, right
  up left attack held. Intermediate button changes arrive as `pointermove`, so
  the old per-button `pointerdown`/`pointerup` flags missed presses and releases.
- `src/mouse.js` now reads the complete `buttons` mask for the active pointer.
  Window events handle release outside the canvas. Capture loss, cancellation,
  blur, menu, visibility and resize resets clear both buttons and require a fresh
  press. Mouse movement cannot restart a cancelled hold. Touch events are ignored;
  the touch/controller mappings and wire protocol 20 are unchanged.
- Added 14 input regressions. All 375 gameplay/network tests passed locally.
  Real Edge checks covered all four chord orders, outside releases, actual capture
  loss, focus/menu/resize resets, and no further attack calls after release during
  active simulation. Separate host/guest browsers verified each release reaching
  the host through the existing room service. This was not a new TURN audit.
- The exact production bundle passed active solo gameplay, overlapping clicks,
  movement/jump and menu recovery checks without browser errors. QA hooks remain
  outside production in `bonk-club-qa/mouse-browser.cjs`.
- Gameplay revision: `59c4a95745ac6860c14f0ab50122fc8ca633ae19`. The exact archive
  build is `bonk-club-qa/mouse-release-59c4a95/dist`; production smoke checks are
  in `mouse-release-browser.cjs`, with parity checks in `verify-mouse-live.cjs`.
- Pages run `34482244296` passed gameplay tests, server tests, production build
  and deployment: https://github.com/SamCousinsGB/bonk-club/actions/runs/34482244296.
  All 15 public files matched that exact archive build byte for byte. JavaScript:
  `index-iSNUfu0-.js`; CSS: `index-CUMQZt1D.css`. The public game passed active
  solo gameplay, overlapping clicks, movement/jump and menu release/resume without
  browser errors. This task's development server was stopped. Refresh the game
  to load the fix; no Pi changes or protocol change were required.

## Black-hole lens and continuous player artwork — 10 September 2026

Implemented in the existing `bonk-club-bend-art` worktree on
`codex/blackhole-lensing`, preserving the other tasks in the canonical checkout.

- The core now has a gold-white photon ring, flowing accretion filaments and an
  equatorial stream. A localized shader warps the current rendered scene around
  the core. The ring and physics remain planar; there are no perspective ellipses.
- The shader uses one reusable surface capped at 384 pixels per side, warms while
  idle, and avoids CPU pixel readback. A Canvas ring/stream fallback handles
  missing WebGL and context loss. Reduced motion freezes the gas and lens motion.
- Black holes composite after the scene's bodies, projectiles and particles, so
  the central shadow remains black as objects are consumed.
- Spaghettified players use smoothly tapered curves and a single compound body
  fill over a single outline. Per-limb borders and repeated overlap alpha no
  longer create seams. Existing strand physics and the terrain artwork fix remain.
- No new gameplay or wire state is introduced. The isolated release passed all
  340 gameplay/network tests and a production build. Browser pixel checks verified
  continuous player colour at joins, actual displacement of the scene, a black
  core even over bright projectiles/particles, clearing, reduced motion, screen
  edges, missing WebGL and context-loss fallback. Shader errors: zero.
- Real host, mobile guest and a late joiner passed through the Pi relay with
  matching warped terrain and player colour. Two simultaneous holes rendered
  without page errors; guest drawing CPU time was 2.4 ms at the 95th percentile
  on the QA machine, not a GPU completion or FPS measurement.
- QA helpers and screenshots are in `bonk-club-qa` with the `lens-` prefix.
  Combined validation after integrating weighted props: all **361 tests** and
  the production build passed, followed by repeated real relay, pixel, fallback
  and body-join checks. In a separate run after the test workload ended, guest
  drawing CPU time with two holes was 2.3 ms at the 95th percentile. Guest rAF
  callback intervals were 13.9 ms median / 14 ms p95 with two holes, 13.8 / 13.9 ms
  with one, and 7 / 14 ms without a hole. These are QA-machine scheduling and CPU
  measurements, not a guarantee of displayed frame rate on another device.
  Published gameplay revision: `ea170c08f065c5044ac314592fec669405ff3338`.
  Pages run `34481478107` passed tests, server tests, build and deployment:
  https://github.com/SamCousinsGB/bonk-club/actions/runs/34481478107.
  All 15 published files matched `bonk-club-qa/lens-release/dist` from the exact
  committed source archive. JS: `index-BGZi4lyb.js`; CSS: `index-CUMQZt1D.css`.
  The public game passed solo start, movement, jumping and menu checks without
  page errors. The task's development server was stopped. Protocol remains 20;
  refresh all players to see the same new artwork.

## Weighted props - 10 September 2026

Implemented on `codex/weighted-props` in
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-props`. The canonical checkout had
concurrent terrain, melee and bot edits; they were preserved. This branch includes
the subsequent melee arcs, original black-hole artwork, blast carving, nuclear
visuals and PHASER releases from main.

- All eight prop types have mass, friction, restitution and rotational inertia.
  Tables weigh 28, crates 36, barrels 48, cabinets 58, logs 65, beds 70, sofas 85
  and stones 180, relative to a 55-unit fighter. These are gameplay masses.
- Props slide, tumble, tip off ledges, stack, ride lifts, settle and wake after
  support removal. Collision transfers momentum between props, fighters and
  ragdolls. Fast heavy objects can damage and knock down living fighters.
- Melee, shots, thrown weapons, explosions, conveyors, crushers and saws move
  props. Tracer speed does not determine bullet impulse. Grenades bump furniture
  before their fuse; rockets apply blast damage with cover still present.
- Breakage creates recognizable rails, legs, mattress/cushion pieces, wood and
  stone chunks. Pieces retain their own mass, rotation and collision, can be shot
  or blasted again, and persist until consumed, culled by the 96-piece budget or
  round reset. Nukes/PHASER consume them; black holes preserve their material art.
- `src/props.js` owns the convex contact solver and fracture pieces;
  `src/prop-art.js` draws the pieces. Small collision strips follow rotated
  silhouettes for bullets, feet and ragdolls. Host authority is unchanged.
  New snapshot fields are validated, quantized and interpolated with stable IDs.
  **Protocol 20: all players must refresh their tabs.** No Pi changes.
- Bots ignore tiny rubble as melee-clearing targets, finish batched route
  rebuilding, and use their normal remaining air jump when a prop pushes them off
  a takeoff. Hazard avoidance retains priority. Difficulty and aim are unchanged.
- Local verification: 360 gameplay/network tests passed, followed by the 32-test
  special-weapon/prop suite after the final PHASER and artwork integration. The
  production build passed. There are 21 new prop tests, including all 24 maps,
  stacks/lifts, thin walls, impulses, destruction, malformed data and hot join.
- Real Edge host, guest and third hot joiner connected through selected TURN
  relay candidates. The guest saw different weighted motion, all four material
  families, 36 persistent chunks, later blast impulses and black-hole conversion.
  Hot join received the same chunk IDs and destroyed source props. Gameplay
  screenshots were inspected; browser errors: zero. Guest drawing CPU p95 was
  0.5 ms for ordinary rubble and 2.9 ms in the run including bent black-hole art.
  These are QA-PC drawing times, not internet latency or hardware-phone FPS.
- QA helper and screenshots: `bonk-club-qa/props-online.cjs` and `props-*.png`.
  Hooks exist only in the external test helper.
- Published revision: `3fdc00f54124ddff0873e3da1432e63e8413e399`. Pages run
  `34480155003` passed **361 gameplay/network tests**, **3 server tests**, the
  production build and deployment:
  `https://github.com/SamCousinsGB/bonk-club/actions/runs/34480155003`.
- All **15 public files** matched the exact committed archive build byte for
  byte. JavaScript: `index-BaI1obsq.js`; CSS: `index-CUMQZt1D.css`. The archive
  and build are in `bonk-club-qa/props-release-3fdc00f`.
- The exact production bundle and then the public site passed real host/guest
  lobby, occupied-slot removal, slot-mode changes, hot join, departure/rejoin and
  mobile viewport checks with selected relay candidates and no browser errors.
  The helper is `bonk-club-qa/props-release-browser.cjs`.
- The canonical checkout still contains unrelated uncommitted changes in
  `src/network.js`, `src/nuclear.js` and `src/terrain.js`; they were not overwritten.
  Start from current main or this clean prop worktree for the completed release.

## Explosion terrain and nuclear visuals - 10 September 2026

Current pass: `codex/terrain-craters` in
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-terrain`. It was isolated when
concurrent melee and black-hole-art work appeared in the canonical checkout.
Those changes and the PHASER cannon were preserved from GitHub main in this release.

- Every platform is carved by circular ordinary explosions as well as nukes.
  Repeated blasts excavate the remaining material, including structural walls,
  stairs, wood/glass sections and lifts. Bullets and nonexplosive projectiles do
  not damage terrain; ordinary furniture keeps its existing breakable behavior.
- Collision, navigation invalidation, supported fighters, traps and spikes follow
  destruction. Cut lifts become fixed pieces. Exploded warped wreckage is removed
  from both its artwork and its collider source so it cannot regenerate next tick.
- Fragment identities stay short and unique through repeated cuts. The original
  surface identity groups rendering, avoiding repeated trim on collision strips.
  Snapshots carry surviving spike geometry. **Protocol 19: refresh all players.**
- Replaced the fixed mushroom artwork and crater tint with a spherical pressure
  front, an incandescent rising fireball and separately rolling, textured smoke
  billows. No persistent glowing rim or radiation disk. The original 480 radius,
  skeleton/ash deaths and 12-second total clearing time remain unchanged.
  Seven cached textures warm individually during idle time before combat.
- Added tests for every platform in all 24 arenas, 160 repeated blasts per arena,
  bullet immunity, cumulative cuts, lifts/support, trap/spike removal, warped
  wreckage, wire validation, hot-join geometry, resets and cloud progression.
  The isolated pass passed 318 gameplay/network tests and a production build.
- Real Edge host, mobile guest and a third hot joiner received identical surviving
  geometry after overlapping explosions. All selected WebRTC candidates used the
  real Pi relay. Nuclear growth and 12-second clearing were checked in rendered
  gameplay; browser errors: zero. After idle texture preparation, guest drawing
  cost was 0.4 ms at the 95th percentile and 0.7 ms maximum during this check.
  These are drawing CPU times on the QA PC, not FPS or physical-phone performance.
- QA helpers/screenshots: `bonk-club-qa/terrain-visual.cjs`, `terrain-online.cjs`,
  `terrain-nuke-*.png`, `terrain-online-*.png`, `terrain-craters.png`.
  Hooks exist only in the external QA scripts. No Pi infrastructure changed.
- Published gameplay revision: `25a684a8cf2b01a2b5110e819f29439c23824c16`.
  Includes the concurrent melee, original-art black-hole and PHASER releases.
  Final combined validation: **340 gameplay/network tests**, CI server tests,
  production build and real three-browser relay checks all passed. In the final
  combined browser run, guest draw CPU time was 0.8 ms at the 95th percentile.
- Pages run `34478453160` succeeded:
  `https://github.com/SamCousinsGB/bonk-club/actions/runs/34478453160`.
  All **15 public files** matched the exact committed build byte for byte.
  JS: `index-DurcXg25.js`; CSS: `index-CUMQZt1D.css`.
  Exact source archive/build: `bonk-club-qa/terrain-release-25a684a`.
- The published game passed host/guest lobby, slot changes, hot join, leave/rejoin,
  mobile viewport and selected TURN-relay checks without browser errors.
  `terrain-public.cjs` checks the public bundle without source hooks;
  `verify-terrain-live.py` verifies all published files. The temporary Vite server
  for this pass was stopped. The isolated branch is clean after recording this release.

## Black-hole artwork correction — 10 September 2026

Bent wreckage now reuses the normal platform, furniture and hazard renderers.
The previous grey/purple fill, pale outline, centre line and bend-point crossbars
are removed. Cached artwork follows the existing physical ribbon; material
colours, glass transparency, foliage and lift details remain recognizable.
Triangle coverage is combined before compositing each piece to avoid visible
mesh seams. The material cache is capped at 120 entries and one reusable drawing
buffer at 1024 pixels per side. Physics and collision geometry are unchanged.

Torn props retain their original furniture kind and platforms retain their lift
flag. These optional, validated snapshot fields preserve compatibility with
protocol 17. Refresh all players for consistent new artwork.

The correction was isolated in `bonk-club-bend-art`, branch
`codex/bend-original-art`, after concurrent tasks changed overlapping files and
the branch in the canonical checkout. Only this correction's files were moved;
the other tasks' edits were preserved.

Verification: 312 gameplay/network tests passed for the isolated fix, then 323
passed after integrating the latest melee release from main. Production builds passed.
Browser pixel comparisons covered nine materials including glass; actual
gameplay screenshots covered jungle, temple, desert, houses, hospital and volcano
maps. Real host, mobile guest and late-joining browsers received matching warped
geometry and furniture/lift identities through the Pi relay with no page errors.
Guest drawing CPU time was 2.7 ms at the 95th percentile on the QA machine; this
is not FPS or internet latency. QA helpers and screenshots are in the existing
`bonk-club-qa` directory with the `bend-` prefix.

Published revision: `62fccd27283351e8501c4c7adb1a6bd967bb23cb`. Pages run
`34477944690` passed gameplay tests, server tests, build and deployment:
https://github.com/SamCousinsGB/bonk-club/actions/runs/34477944690.
All 15 public files matched the exact committed build in
`bonk-club-qa/bend-release/dist`; JS is `index-BY5fGDJW.js`. The public game
passed browser checks for solo start, movement, jumping and the game menu with
no page errors. The task's local Vite server was stopped. Later main releases
may supersede these asset names; retain this correction when integrating them.

## PHASER cannon — 10 September 2026

Implemented in `bonk-club-phaser`, branch `codex/phaser-cannon`, to preserve the
concurrent terrain and melee changes in the canonical checkout.

- New exotic PHASER CANNON pickup, included in the featured weapon rotation.
  Two shots, 1.8-second cooldown, 144-unit-wide directional beam to the arena edge.
- Each discharge hits each living opponent once for 38 damage, with a brief
  skeleton reveal, modest knockback and 45 ms stun. Low-health kills leave an
  energy skeleton. The 0.42-second visual does not repeatedly damage players.
  Jumping above the beam avoids it; a hit fighter can air-jump and land below.
- The beam carves actual platforms at any angle, including structural terrain
  and elevators, and consumes intersected props, traps, spike teeth, loose
  weapons, projectiles, corpses and warped wreckage. Remaining terrain is drawn
  from the same rectangles used by collision; cuts persist until round reset.
  Distant scenery remains. Bots can fire through obstructing terrain.
- `src/phaser.js` owns beam geometry and authoritative destruction;
  `src/phaser-art.js` draws the beam. Spike geometry is included in snapshots.
  Protocol **19** reserves compatibility separately from the concurrent terrain
  work's protocol 18. Both players must refresh after this release.
- Initial verification: 319 gameplay/network tests passed, production build
  passed, and three real Edge pages connected through selected TURN relay
  candidates. Actual host mouse fire and guest keyboard jump/landing passed;
  the guest saw 62 HP, the low-HP death, beam and skeleton effect. A third browser
  hot joined with identical surviving terrain and spikes. Screenshots inspected.
- QA helper and captures: `../bonk-club-qa/phaser-online.cjs`, `phaser-host.png`,
  `phaser-guest.png`, `phaser-survivor.png`. Hooks exist only in the external QA
  helper.
- PHASER implementation published as `d70de9c65af1d98e512b25548e80c371574d9a17`;
  Pages run `34478247676` passed. The subsequent combined terrain release
  `25a684a8cf2b01a2b5110e819f29439c23824c16` preserves it and passed **340 game
  tests and 3 server tests**, build and deployment in run `34478453160`.
- Rechecked all nine PHASER regressions and the real three-browser PHASER scenario
  on that combined release: guest upward jump velocity, landing alive at 62 HP,
  low-HP skeleton death, and identical late-join terrain all passed. Selected
  relay candidates were verified for all three pages; no browser errors.
- All 15 public files matched an archive/build of `25a684a` byte for byte:
  JS `index-DurcXg25.js`, CSS `index-CUMQZt1D.css`. The public build also passed
  host/guest lobby, start and gameplay through selected TURN relay candidates.
  `phaser-public.cjs` checks the unmodified public bundle;
  `verify-phaser-live.cjs` compares assets. Archive/build: `bonk-club-qa/phaser-release`.

## Sword and bat swings — 10 September 2026

- Swords and bats now use a two-handed overhead wind-up, a 3.2-radian forward
  sweep and a follow-through. The bat takes 0.44 seconds and the sword 0.34;
  their existing attack cooldowns, damage and ammunition counts are preserved.
- `src/melee-pose.js` shares weapon angles and lengths between the procedural
  arm motors, renderer and authoritative blade contact checks. Contacts sweep
  between simulation frames, wait for the wind-up, stop during recovery, and
  respect solid cover. Each opponent and cover object is hit once per swing.
  Parrying or throwing cancels the remaining held-weapon contacts.
- The final weapon use stays visible through the animation before returning to
  fists. Zero remaining uses cannot produce another attack or a thrown weapon.
  Guest snapshots interpolate an ongoing swing without blending into a new one.
  The existing wire shape and protocol **17** are unchanged. Refresh both tabs
  to see the updated animation consistently.
- All **321 gameplay/network tests passed** on an isolated source export,
  including 11 new swing tests. Production build passed with the published
  room and TURN endpoints. Actual rendered frames were inspected for both
  weapons facing both directions. Two real Edge browsers verified each final
  weapon swing, its full arc, exactly one hit and eventual removal through the
  Pi relay; selected relay candidates were checked at both ends, with no errors.
- Gameplay commit: `842241e57457a1f2817d79543f49f71cca59755b`.
  Published in combined revision `62fccd27283351e8501c4c7adb1a6bd967bb23cb`,
  which also contains the separately completed black-hole artwork changes.
  Pages run `34477944690` passed **323 game tests, 3 server tests**, build and
  deployment: `https://github.com/SamCousinsGB/bonk-club/actions/runs/34477944690`.
  All **15 public files matched the tested CI artifact byte for byte**;
  JavaScript: `index-BY5fGDJW.js`, CSS: `index-CUMQZt1D.css`. Public host/guest
  gameplay, lobby slots, hot join, leave/rejoin and mobile viewport checks passed
  through verified relay candidates without browser errors. The CI artifact is
  in `bonk-club-qa/melee-ci-62fccd2`; the earlier melee-only build was superseded
  by this combined deployment after its own CI tests and build passed.
- QA scripts and screenshots are outside Git in `bonk-club-qa`:
  `melee-visual.cjs`, `melee-online.cjs`, `melee-swing-poses.png`,
  `melee-online-guest.png` and `verify-melee-live.cjs`. The tested source/build
  export is `melee-release-20260910`. No production debug hooks were added.
- Separate explosion/terrain work was in progress in the canonical checkout.
  Its `src/network.js`, `src/nuclear.js` and `src/terrain.js` edits were preserved
  and excluded from this gameplay commit. Release notes use the separate
  `bonk-club-qa/melee-notes` worktree; inspect current Git status before continuing.

## Start here

The canonical checkout is `C:\Users\SamCo\Documents\ChatGPT\bonk.club`.
This effects pass was completed in the isolated worktree
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-effects`, branch
`codex/effects-pass`, because separate mobile and bot tasks were editing the
canonical checkout concurrently. Preserve their work. Inspect Git status and
GitHub `main` before starting; do not copy an older checkout over newer changes.
The repository and product remain **Bonk Club** / `SamCousinsGB/bonk-club`.

## Completed effects pass

All five requests from the previous handoff are implemented. Sam also requested
a mushroom cloud and a 25% smaller nuke radius; both are included.

1. Ground spikes now have solid bases. Contact kills and attaches the physical
   ragdoll at a spike tooth, with bleeding and surface stains. The body remains
   attached for its lifetime; destroying that spike releases it.
2. Minigun, heavy machine gun and shotgun impacts bleed. Lethal hits detach an
   arm and leg. Existing saw/rail cuts, energy skeletons, freeze/shatter, fire
   and explosive deaths retain their own behavior.
3. Thrown weapons knock living fighters into a passive physical ragdoll.
   Explicit weapon mass controls launch strength and recovery duration. Controls
   and pickups are suppressed during the knockdown, then recover into clear
   space, including low ceilings and moving platforms. Parried throws do not
   cause knockdown. Weapon ammunition is preserved.
4. The nuke radius is **480**, down from 640: exactly 25% smaller, with a diameter
   of 960 in a 2560-unit-wide arena. The circular flash exposes skeletons and
   melts physical terrain while keeping the background. A glowing mushroom cloud
   rises, cools and disperses; all fallout smoke/tint clears after 12 seconds.
   The destroyed terrain remains. Fallout has no lingering damage mechanic.
5. Black holes use actual planar particle flow. Each body bone becomes a
   six-point curved strand. Wreckage has a six-point deformable spine and a
   twelve-point outline; differential orbital speed curls it as it sinks inward.
   There are no scaled heads or perspective ellipses. Consumed pieces disappear,
   and surviving warped pieces retain matching breakable collision after the
   field ends. Guests and hot joiners receive that same geometry.

Particles and collision are bounded: 144 blood particles, four death ragdolls,
60 wreck fragments and at most 15 collision strips per ribbon. The platform wire
limit is 1536 to accommodate overlapping fields plus surviving map fragments.
Consumed fragments stop invalidating navigation every tick. Blood expires within
seven seconds, and all transient state resets each round.

Wire protocol is **17**; PeerJS remains **1.5.5**. Both players must refresh after
updating. Discovery IDs and host authority are unchanged. New state is validated
and interpolated with stable entity identities. No Pi configuration changed.

## Verification and release record

- 310 gameplay/network tests passed on the combined effects, mobile and bot
  revision, including new physical effects, low-ceiling
  and elevator recovery, two overlapping black holes on all 24 arenas, blood
  limits/expiry, bent debris crossing a nuke boundary, and malformed snapshots.
- Production build passed with the published room and TURN credential endpoints.
- Real host and guest Edge browsers connected through the Pi TURN service, with
  selected relay candidates verified. The guest received cuts, all energy/fire
  effects, heavy-gun limb separation, blood, living knockdown/recovery, attached
  spike bodies, the 480-radius blast, mushroom cloud and dissipated aftermath.
- A third browser hot joined the already destroyed map. Its platform IDs and
  deformed wreck outlines matched the host and existing guest.
- Actual gameplay screenshots were inspected, including black-hole motion,
  mushroom growth/clearing, spike attachment and mobile guest rendering.
- Production bundle checks covered lobby slots, occupied-slot removal, Easy
  default, AI-only/Closed/Player-only behavior, hot join, leave/rejoin and mobile
  viewport layout through forced TURN, without browser errors.
- Guest black-hole drawing CPU time was 0.7 ms at the 95th percentile on the QA
  machine. This is drawing cost, not FPS or a measurement on Sam's friend's PC.
  Host simulation can still have occasional navigation-building spikes; preserve
  batched route rebuilding rather than restoring synchronous rebuilds.
- Published gameplay revision: `6c7c40d9cd387aa7c989986605f862ffb2ef3f70`.
  The effects implementation is `3393f93`; the following commit reduces collision
  and navigation work during overlapping effects. Existing mobile and bot updates
  are included. Later documentation commits do not alter the published game.
- Pages run `34475899263` passed gameplay tests, server tests, production build
  and deployment: `https://github.com/SamCousinsGB/bonk-club/actions/runs/34475899263`.
- All 15 public files matched the exact committed production build byte for byte.
  JS: `index-CLwvnpTF.js`; CSS: `index-CUMQZt1D.css`. Public host/guest lobby,
  slot changes, hot join, departure/rejoin and mobile viewport checks passed
  through the Pi relay without browser errors.
- For exact build parity, archive the committed source with
  `git -c core.autocrlf=false archive <revision>` before building. A Windows
  working copy can have different HTML/favicon hashes because of CRLF conversion.
  The verified archive/build is in `bonk-club-qa/ci-release`, outside the repository.

## Mobile controls release verification — 10 September 2026

- Verified mobile revision: `cefb9fc0db43e7f7d6e0c9f91875b35e323a623c`. Mobile changes began
  in `da9e8fb`; the release also includes the separately committed bot improvements
  `ff8cf7a` and `8f660c8` from main.
- Successful Pages run: `https://github.com/SamCousinsGB/bonk-club/actions/runs/34475589220`.
- Mobile Join/Start/Quick match requests fullscreen immediately from the user tap,
  then attempts landscape locking. Mobile invite links present a Join room button
  to supply browser activation. Missing or denied browser APIs do not block joining.
- Mobile gameplay now requires landscape, with a rotate-phone prompt and game-menu
  access in portrait. Simulation and networking continue; rotation clears held input.
  Explicit fullscreen retries are available from the game menu where supported.
- Larger twin sticks and visible Jump, Throw, Lie down and contextual Parry/Alt fire
  buttons. Movement/fire can be held together; jump swipes, prone drag and double-tap
  throws remain available. Buttons show press feedback; Throw disables when unarmed.
- CI: **300 game tests and 3 server tests passed**, plus production build/deploy.
  Real Chromium touch events verified movement/fire, both jumps, throw ammo,
  cancellation, portrait/menu recovery and layouts down to 568 × 320. Separate
  desktop host/mobile guest browsers verified invite/lobby start, control delivery
  and release at the host, departure and hot rejoin. The staged build and public
  site passed browser checks without page errors. Missing/refused fullscreen and
  orientation APIs were exercised explicitly. This is mobile browser emulation;
  physical iOS/Android orientation locking remains device-dependent and was not
  tested on hardware. No new TURN configuration or cross-network claim is involved.
- All **15 public files matched the release build byte for byte**. JS:
  `index-CGMXDIi6.js`; CSS: `index-CUMQZt1D.css`. That mobile revision used protocol **16**; the subsequent effects pass above updates it to **17**.
- QA files and screenshots: `%TEMP%\bonk-mobile-20260910`. The source under `release`
  is an export of the exact committed revision, excluding other unfinished changes.
  Export with `git -c core.autocrlf=false archive <revision>` for Linux CI parity:
  Windows automatic CRLF conversion otherwise changes HTML and favicon hashes.
- New screen API handling is in `src/mobile-screen.js`, with tests in
  `tests/mobile-screen.test.js`; touch behavior tests remain in `tests/touch.test.js`.

## Code map

| Area | Files |
| --- | --- |
| Authoritative physics, hits, throws and scoring | `src/engine.js`, `src/puppet.js`, `src/collision.js`, `src/impact.js` |
| Passive body contacts and recovering knockdowns | `src/body-physics.js`, `src/knockdown.js` |
| Impalement, bleeding and surface stains | `src/gore.js` |
| Weapon classification and special behavior | `src/arsenal.js`, `src/specials.js`, `src/melee.js` |
| Death simulation and drawing | `src/death-effects.js`, `src/death-art.js` |
| Planar flow, deformed wreckage and collision | `src/orbit.js`, `src/blackhole.js`, `src/blackhole-art.js` |
| Nuclear destruction, mushroom cloud and ash | `src/nuclear.js`, `src/nuclear-art.js` |
| Bots and route budgets | `src/bots.js`, `src/navigation.js`, `src/bot-difficulty.js` |
| Wire validation and guest interpolation | `src/network.js`, `src/render-state.js` |
| Menus, online lifecycle and controls | `src/main.js`, `src/slots.js`, `src/identity.js`, `src/touch.js` |

Start effects regressions with `tests/physical-effects.test.js`,
`tests/weapon-effects.test.js`, `tests/nuclear.test.js`, `tests/network.test.js`
and `tests/render-state.test.js`. Read actual code before inferring behavior.

## Development and release

Use `npm ci` for a fresh worktree. CI uses Node 24. Development: `npm run dev`;
tests: `npm test`; production: `npm run build`. Server changes also require
`npm ci --prefix server --ignore-scripts` and `npm test --prefix server`.

For the production service configuration, these are public addresses:

```powershell
$env:VITE_ROOM_SERVICE_URL = 'https://bonk-club.82-28-16-193.sslip.io/peerjs'
$env:VITE_TURN_CREDENTIALS_URL = 'https://bonk-club.82-28-16-193.sslip.io/ice'
npm run build
```

`.github/workflows/pages.yml` uses repository variables `ROOM_SERVICE_URL` and
`TURN_CREDENTIALS_URL`. Credentials remain on the Pi; clients receive temporary
TURN credentials. Gameplay work should not require Pi changes. If it does,
read `server/pi/README.md` and the global infrastructure rules first.

Current local QA helpers and screenshots are outside Git in
`C:\Users\SamCo\Documents\ChatGPT\bonk-club-qa`: `effects-online.cjs`,
`effects-visual.cjs`, `blackhole-cost.mjs`, `slots-browser.cjs` and
`verify-effects-live.py`. They have machine-specific browser/runtime paths.
The online helper routes the public game origin to local Vite assets while
using the real Pi relay. Debug hooks stay in the QA helper, never production.
The original dated QA directory is historical. Review paths before reuse.

Publish tested commits to GitHub `main`, wait for successful CI/deployment,
compare live asset hashes with the exact build, and check the public game in
real browsers. Update this record after later changes; do not report old tests
or old release hashes as verification of new code.

## Phase muzzle, persistent fire and new weapons - 10 September 2026

Implemented in `bonk-club-weapons` on `codex/strange-weapons` from current main,
preserving the canonical checkout's concurrent edits.

- Phase cannon fires from the actual gun tip. A 150-unit triangular flare grows
  into the existing 144-unit-wide beam. Player hits and terrain carving use that
  same footprint. Its brief afterglow follows the recoiling hand, and the final
  ammo use retains the gun until the discharge finishes.
- Flamethrower reach is about 800 units (950 speed, 0.85-second lifetime), up from
  about 280. Direct damage is 10, up from 7. A hit ignites persistent 18 HP/second
  burning until death, including during knockdowns/black-hole capture. Living
  bodies char under pose-following flames; deaths leave the existing char/ember
  remains. Cover blocks ignition. Fire resets with the round.
- Bubble gun: buoyant shots lift opponents for 2.4 seconds while preserving
  controls and world collision. Hits of 20+ damage pop the bubble; repeated
  bubble shots do not extend an active lift. Black-hole capture pops it.
- Boomerang: a spinning projectile curves back toward its living owner, can hit
  once on each leg, bounces off cover and is caught without hurting its owner.
  It expires if it cannot return. Rubber duck launcher: bouncing explosive ducks
  with a 2.2-second fuse and 175-unit blast radius; fighter contact detonates them.
- All three new weapons have distinctive pickup/held/projectile art and sounds,
  explicit throw masses, AI handling and featured pickup rotation. There are now
  27 weapons. Existing nuclear rotation and rare pickup weighting remain intact.
- Protocol **24**: all players must refresh. Bubble state, the beam flare and new
  projectiles are validated. New state follows existing snapshot/interpolation,
  hot join, destruction and round-reset paths. No dependencies or Pi changes.
- Source browser QA passed with real Edge host/guest and a third hot joiner through
  selected TURN relay candidates. Verified burning to char death, bubble lift and
  expiry, returning boomerangs, duck explosions and matching phase-cut terrain.
  Rendered gameplay, flame streams and reversed/prone/diagonal beams were inspected.
  No page errors. QA helpers/screenshots: `bonk-club-qa/weapons-visual.cjs`,
  `weapons-online.cjs` and `weapons-*.png`. These helpers keep hooks outside the
  repository; production has no debug hooks. Final release verification follows.
