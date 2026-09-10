# Bonk Club — next chat

Updated 10 September 2026. Read the root `AGENTS.md` first.

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
- Release revision, CI and public asset parity are recorded below after deployment.

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
  helper. Release verification is recorded below after integration and publishing.

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
