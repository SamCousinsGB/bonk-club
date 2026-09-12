# Bonk Club — Project Constitution

This is the standing development contract for **Bonk Club**. Read it before
changing this repository. Read `docs/HANDOFF.md` next for unfinished work and the
last verified release, then inspect the relevant code and tests. Sam's latest
explicit instructions take precedence; older requests must not undo later ones.
Keep this constitution for durable rules and the handoff for current work.

## Identity and scope

- Product name: **Bonk Club**. Repository/package slug: `bonk-club`.
- Repository: `https://github.com/SamCousinsGB/bonk-club`.
- Public game: `https://samcousinsgb.github.io/bonk-club/`.
- Current working checkout: `C:\Users\SamCo\Documents\ChatGPT\bonk.club`.
  Use this checkout; the earlier dated Codex output directory is historical.
- Build an original two-dimensional physics brawler for browsers and installed
  Windows/Linux Steam releases,
  inspired by the feel of Stick Fight: The Game. Keep its own artwork and name.
- Put the effort into responsive combat, physical consequences, readable action,
  varied maps and good online play. Do not build a marketing page around the game.

- The menu background shows sticks actually fighting with physics and varied
  weapons. Keep autonomous combat, movement and pickups; do not replace it with
  scripted weapon-effect vignettes or a slideshow.

## Interface and writing: no AI filler

- Never add unsolicited slogans, taglines, quips, forced banter, faux-edgy humour,
  marketing copy, ornamental badges, invented version labels or decorative prose.
- Use concise functional names, controls, instructions, status and errors. If text
  does not help someone use or understand the game, omit it. Empty space is fine.
- Prohibited examples include “Friendship is a contact sport”, “Zero dignity”,
  “Small sticks. Big grudges”, “Tonight's bad idea”, “Bring fists to a rocket
  fight”, “Headphones encouraged”, “Physics prototype / 01”, “Take a breather”
  and “Reconsider your friendships”. Do not replace them with similar filler.
- Use direct labels such as Play, Customise, Ready up, Start match and Leave room.
  Express personality through play and art. Settings and Controls menus are removed.
- Bots may occasionally use terse trash talk after spectacular kills, as Sam
  explicitly requested. Keep it lowercase, sparse and tied to the actual killer.
  Retire spoken lines and avoid nearby synonymous phrases.
- Review new user-visible strings before delivery. An explicit creative-writing
  request is the exception; a request for polish or a fun game is not.
- Sam explicitly requested a latest-update line on the main menu. Display
  `vMAJOR.MINOR.PATCH` and a concise description of the latest release. Read both
  from `package.json` (`version` and `releaseNotes`); keep `package-lock.json` in
  sync. Update these for each gameplay release: minor for added features, patch
  for fixes, major for breaking changes. This display version is separate from
  the multiplayer wire protocol. Do not replace the real release note with filler.

## Modes, rooms and continuity

- Support solo play against AI and online multiplayer for up to four fighters.
  **Local/couch multiplayer is removed.** Earlier “no single player” requirements
  were superseded and must not be restored.
- Play combines solo and online into one pregame lobby. Online rooms always show
  an invite code and shareable link, including when all opponents are bots.
  Keep desktop/offline bot play available with an honest unavailable-invite status.
- Guests open Customise separately and must ready up before the host starts.
  The host owns readiness and match options; option/slot changes clear readiness.
  Allow hot joining during play. Do not embed the character editor in the lobby.
- The host chooses weapon and map pools (all selected by default) and AI difficulty.
  Apply those pools to opening and later pickups and every subsequent round.
- Preserve slot modes: Player / bot, Bots only, Players only and Closed. The host controls
  them in the lobby. Joining replaces AI only where the chosen slot allows it.
- Let players set their name, colour and hairstyle. Preserve saved preferences,
  validate profiles, and keep identities consistent between lobby and gameplay.
- Rounds continue indefinitely. No best-of-five or winning-score match end.
  Track the current leader. Scores belong to the current occupant and reset when
  that occupant leaves or is replaced, not when an unrelated player joins.
- Round results show the winner and a message based on the final elimination.
  Sam explicitly requested creative victory lines, including nuclear apocalypse
  and commanding the forces of space and time. Keep this exception in the result
  banner; preserve actual death causes, draws, guest consistency and round reset.
- Escape opens/closes a menu, never pauses. Focus loss, alt-tab and background
  rendering must not intentionally pause simulation or networking. Clear held
  controls on blur. Do not claim to defeat browser/OS suspension or tab discard.

## Movement, controls and combat

- Keep the large, zoomed-out cat-and-mouse scale. Current baseline: 2560 × 1440
  world units and 240 units/second running speed. Impulses may exceed run speed.
- Fighters use procedural poses and physical bodies. Avoid static stick sprites,
  permanent crouch-walking, rigid canned animation and purely cosmetic knockback.
- Preserve keyboard/mouse, controller and usable mobile touch controls. Left click
  punches/fires or throws a carried object, S lies down, F throws. Weapon pickups
  are automatic. Right-click/G picks up the nearest reachable physical prop or
  fragment in front of the fighter, setting down the current weapon with its ammo.
  Right-click again drops the object; with no pickup available it parries or uses
  alternate fire. Keep the original body's weight, collision, damage and reactions
  active while carried; heavy objects slow movement and throw less far. Knockdown,
  death, destruction, slot replacement and round reset release the grip. Controller
  secondary action and the contextual touch button share pickup/drop behaviour.
  Touch uses movement
  drags, jump swipes, aim/fire gestures and double-tap to throw. Keep only compact
  Jump and contextual Pick up/Drop/Parry/Alt fire buttons; no Throw or Lie down buttons. Use
  light joystick guides that hide, including their labels, while held and return
  on release. Preserve generous invisible touch areas, simultaneous movement and
  firing, and dragging down to lie down.
  Mobile play uses landscape. Request fullscreen and landscape locking from Join
  and Start taps; show a rotate-phone prompt when locking is unavailable. Keep the
  game menu reachable in portrait and prevent page drag. Browser refusal must never
  prevent a room connection or pause the simulation.
- Empty hands alone can parry: one short window, one stopped hit/reflected shot,
  then a cooldown. Holding does not repeat it. Weapons, including melee weapons,
  cannot block. Some weapons may have explicit alternate fire instead.
- Melee must be a viable aggressive strategy: punch, kick, spinning finisher,
  forward/directional lunge, bass impact, brief shake and rewards for connecting.
  Preserve counters, bounded air lunges and contact-based rewards.
- Recoil and explosions affect grounded, prone and airborne fighters. Downward
  shooting can propel the shooter upward. Only explicitly deployed heavy weapons
  are braced; do not erase knockback with the normal movement speed clamp.
- Grenades must be controllable: roughly half an arena maximum unassisted throw,
  not the earlier extremely fast full-map launch. Current normal/nuclear baseline
  is 450 horizontal speed, upward toss and a 2.8-second fuse.
- Fired projectiles have no travel-distance or flight-time expiry. Keep shots
  moving until collision, capture, a boomerang catch or round reset. Grenades
  retain their deliberate fuses. Fireworks, ducks and black-hole seeds activate
  on contact; preserve their bounce behavior. Distant shots may be omitted from
  rendering/transport while their host-side flight continues. Bound concurrent
  nearby shots at admission without deleting shots that are already flying.

## Maps, AI and weapon effects

- Survival arenas are deliberate exceptions to the tall, heavily armed layouts.
  Cargo Conveyor, Press Floor and Ice Sweep use broad floors, unarmed starts and
  sparse contested weapons. Preserve the Survival arenas setting, physical cargo,
  machinery warnings, ordinary-control AI dodges, destruction and hot join.

- Maintain varied themes and layouts: jungle, desert, homes, hospitals, industrial
  sites, ice, volcanoes and skyscrapers. Do not turn every arena into a tower.
- Transmission Towers has two large steel pylons and two heavy physical wire
  crossings. Do not add bridge platforms across the centre. Wires hang from
  the lower insulator clamps; their mounts and artwork share the same coordinates.
  Both circuits alternate seven seconds safe and seven seconds live, with a safe
  one-second amber warning before activation. Live wires use Tesla arcs and
  host-owned electrical contact damage. Intact wires support walking; cutting a
  cable or losing either mounting removes all player support from that span.
  Surviving runs connected to either mount retain the seven-second cycle; fully
  detached runs have no timed supply. Contact between upper and lower wires
  creates constant heavy arcing and live contact damage regardless of the timer,
  provided the touching circuit retains at least one mount. Separating the wires
  restores their existing cycle. Water conducts from powered wire contacts.
  Put one finite physical water jug on each of the eight pylon cross-arms.
  Keep the four centre weapon ledges at y=590/1070 removed; climb within pylons.
  Nukes remove affected tower and wire sections, never re-create missing wire.
  Both tower and furnace cables use host-owned gravity, length constraints and
  strong damping, with only a subtle powered wiggle. Furnace cables and broken
  tower wires are pass-through; intact tower wires provide a thin walking top.
  Broken spans fall, drape over surviving structure and remain attached only at
  surviving mounts. Keep cable cuts, attachments and moving geometry in validated
  guest snapshots and hot joins; never clear all wires when a machine breaks.
- TURBINE HALL has six continuously running rotors spanning the bottom, narrow
  staggered double-jump routes and two pass-through high-voltage cable spans.
  Blade contact blends living fighters and fallen bodies into moving physical
  pieces. Preserve the enclosed concrete sump and side boundaries: destroyed
  rotors leave contained pits, never a bottom ring-out. Cable cuts, fallen tails,
  mount-dependent seven-second power cycles and guest/hot-join state persist
  until round reset. Bots must not route onto intact turbine beds.
- CAR ASSEMBLY uses a host-owned production clock and conveyor: stamp body panels,
  weld the cabin, fit wheels and finish the car. Cars are solid moving cover and
  jumping surfaces. Preserve safe press warnings, physical machine contacts,
  alternate overhead routes, permanent car/station cuts, stopped pallets at broken
  rails, bounded feed queues, validated hot joins and full round reset. Do not
  replace production with decorative car animation or rebuild damaged bodywork.
- Give traversal headroom and clear takeoffs. Meaningful gaps should use double
  jumps, with alternate routes and elevators; avoid tightly stacked head traps.
- Every platform, including walls, stairs, panels and lifts, can be deformed by
  circular explosion cuts. Successive blasts dig further into the remaining
  terrain. Bullets damage marked wood/glass panels and warped wreckage; structural
  supports and lifts resist bullets. Keep cover useful and destructible.
  Destruction must update collision, navigation and guest state, including hot
  join and spikes. Restore the original terrain at the next round.
- ARC FURNACE uses six pass-through physical cable simulations, a central grated
  crossing and a 16-second cycle (nine open, two warning, five active). Keep
  its overhead arcs/smoke/electrodes as scenery, never platforms. Active arcs
  block the whole centre, the grate cools over 2.5 seconds, and molten metal
  remains dangerous below. Preserve host-only damage and destruction/reset.
  Warn through caged amber beacons, electrode glow and rising transformer strain;
  never restore countdown screens or status signs. Live arcs have sustained
  electrical roar/cracks and a cooling tail, tied to the existing hazard phase.
- Hazards are physical map fixtures: vents, conveyors, spike balls, crushers,
  saw rails and electrical traps. They may cycle unpredictably with readable
  warnings. Do not restore arbitrary randomly appearing hazard zones.
  Broken fixtures shatter into brief casing fragments and dust, then clear
  completely. Do not retain faded shells, persistent hazard rubble or let later
  black holes recreate cleared fixtures as physical wreckage.
- Furniture, crates, logs, barrels and rocks are moving physical bodies with
  mass, friction and rotational inertia. Fighters, shots, throws, explosions,
  ragdolls and fixtures transfer momentum to them. Keep heavy stone harder to
  move than light furniture; do not restore fixed prop colliders.
- Broken props leave physical material pieces with stable identities and matching
  rotating collision. Keep wood, metal, stone and upholstery recognizable. Rubble
  can hit fighters and move again, persists until consumed or round reset, and is
  capped at 96 pieces. Preserve it through guest snapshots and hot join. Nukes
  and PHASER consume affected pieces; black holes bend their existing artwork.
- Explosive barrels warn through their own flashing/swelling casing and a countdown
  on the label, never a surrounding warning box. TNT explodes after a short fuse;
  gas cylinders leak flammable gas. Oil spills are slippery and flammable, glue
  grips briefly, and tar slows movement and burns longer. Preserve finite contents,
  distinct artwork, physical casing fragments, floor drainage and guest/hot-join state.
- Living fighters burn for three seconds after their last exposure, including while
  knocked down or captured. Repeated exposure refreshes this bounded timer; water
  and ice extinguish immediately. Never restore fire that lasts until death.
- AI defaults to Easy with imperfect aim, reactions and firing discipline. Use
  the same controls, health, ammunition and physics as humans. Improve navigation
  without making bots accurate, tireless terminators.
- Unarmed bots prioritise reachable weapons, including melee pickups, over chasing
  opponents. Fists are a fallback when no usable weapon is reachable, or for an
  opponent blocking the route or attacking at close range. Armed melee bots seek
  reachable ranged upgrades. Do not waste short-range attacks across a gap.
- Bots must not deliberately jump or lunge into fatal drops to end a stalemate.
  Validate traversal and dodge landings, brake at edges and allow for recoil.
  Retry safe routes or wait for a reachable pickup. A last-ditch unsafe escape is
  reserved for imminent lethal danger with no safe route, never boredom or low HP.
- Bots carrying explosive weapons or black-hole generators create safe firing distance,
  using reachable retreat platforms when needed. Keep separation during stalemates,
  retain the weapon, and never use an unchecked fatal jump to gain clearance.
- Tesla is a held electrical cast from the physical muzzle, with bounded chains
  through fighters, props and connected unfrozen water. Release ends the arc;
  charge drains during use. Preserve cover blocking, short shocks, electrical
  skeleton deaths and immediate display-only guest casting. Never restore Tesla
  single-shot projectiles.
- Give weapons distinct, forceful effects. Sawblades and railguns cut in one
  unblocked hit; plasma/Tesla expose skeletons; ice freezes and can shatter; fire
  chars. Preserve weapon identities rather than using one generic explosion.
- Power fist punches launch a curled physical ragdoll in the aimed direction.
  Its swept body contacts carve terrain and smash props, fixtures and cables
  only when reached. Preserve gravity, momentum, living recovery, lethal-body
  flight, host authority and hot-join destruction; never carve a beam in advance.
- Bubble shots lift for 2.4 seconds. Expiry, heavy hits and capture/transformation
  bursts deal 32 additional damage once. Lethal pops scatter the head, torso,
  arms and legs with continuous gravity and solid contacts. Keep pop damage
  host-authoritative and wait for the last fighter's bubble before scoring.
- Sam explicitly wants stylized stick-figure blood, impalement and dismemberment.
  Implement these as readable game effects with bounded particles and physical
  consequences. Spikes hold bodies at their contact point; heavy ballistic kills
  separate limbs. Thrown weapons cause living, recovering physical knockdowns,
  with more impulse and recovery time for heavier weapons.
- Powerful and strange weapons should be rare but actually appear during short
  rounds. Preserve the contested featured weapon rotation. All fighters start
  unarmed, with no weapons beside their starting positions. Standard weapon
  refill rolls wait six seconds initially, then 6–8 seconds. Independent grenade
  rolls keep their original two-second first delay and 3–5-second repeat delay
  and weighted selection chances; neither clock may spawn the other category. Survival arenas keep
  their existing scarce pickups. One nuclear pickup appears only on every third
  standard round (3, 6, 9, ...); random refills must never include nukes.
- Death effects retain body momentum, gravity and solid contacts from the first
  tick. Nuclear and energy skeletons fall and then crumble into physical pieces;
  charred bodies and ice shards keep moving too. Never hold an airborne death
  pose in place. Preserve intentional spike anchors and black-hole capture.
- Nuclear destruction is localized to at most half the map's width (current
  radius 480, reduced 25% from 640). Keep the background, remove affected physical
  terrain/props and use a circular flash, a rising mushroom cloud and skeleton-to-ash
  deaths. Fallout is visual only and clears completely after 12 seconds; terrain
  remains destroyed. Do not leave an opaque disk or permanent damage zone.
- **Black holes must stay visibly and physically 2D.** Bodies should stretch into
  curved strands through differential forces/constraints. Fragments should orbit
  and gradually spiral inward. Do not fake this with CSS-like scale transforms,
  flattened perspective ellipses or rigid prefab spinning. Actual wreckage and
  consumed terrain must agree with collision and remain changed until round reset.
  Captured living fighters go limp and orbit with colliding, stretched limbs before
  compression. The field radius is 465 units (25% down from 620), with the lens
  reduced to match. Compressed fighters show only their coloured head in the final
  ball, never a miniature stick body. Preserve their hair, hair colour, facial
  hair and accessories so each head remains recognisable. The completed mass
  is a shiny circular singularity with visible objects inside; touching it kills
  living fighters and adds their heads and held weapons to its contents.
  On closing, collected fighters, weapons,
  props, traps, projectiles, debris and blood become a persistent dense ball with real collision. Keep the
  outer twisted platforms and their existing artwork. Captured matter must not
  simply disappear at the core; bound visual samples while retaining all counts.
  Keep capture violent: retain incoming momentum, fast eccentric orbits, elastic
  strands and independent limb flailing. Loose matter tumbles until compression;
  do not restore continuous steering to a fixed orbital speed or early packing.
- Each black-hole generator pickup carries one shot; firing consumes the generator
  while its launched seed continues until contact and completes the normal effect.
- Active black holes heavily distort the entire rendered arena and background with
  animated spacetime refraction. This global warp is visual only: it adds no damage,
  forces or collision changes outside the existing local effect. Ease it in/out
  with field lifetime, clear it on closure/reset, keep the HUD readable and respect
  reduced motion. Retain the stronger circular local lens and physical capture.
- Do not assume the latest requested effects already exist; use the handoff to
  distinguish implemented behavior from requested changes.

## Architecture, security and performance

- One shared game and release pipeline produces browser and desktop builds.
  Desktop networking is Steam-only; browsers use WebRTC. Do not silently fall
  back from desktop to the Pi or build browser/Steam cross-play. The eventual
  product is a paid Steam desktop release; retire the browser only when Sam asks.
  Follow `docs/PLATFORMS.md` for the implemented boundary and remaining Steam gates.
- Future progression, levels, earned stats and cosmetic ownership use a managed
  backend or Steam Inventory authority. Local settings, client-set Steam stats,
  player-hosted results and lobby metadata cannot award trusted XP or unlocks.
  Keep identity/preferences separate from account entitlements. No client or
  P2P host may hold publisher/signing keys or submit trusted reward totals.

- This is a Vite/JavaScript Canvas game. GitHub Pages hosts static assets; it does
  not run the room service or relay. Preserve relative asset paths for `/bonk-club/`.
- The host browser is authoritative. Guests send bounded controls, not trusted
  health, position, inventory, damage, score or destruction. Validate snapshots.
- Guests predict their own movement, aim and attack motion with the shared host
  physics, then reconcile using host movement state and applied-input sequences.
  Keep other fighters interpolated, pending input bounded, and authoritative
  death/knockdown/reset immediate. Prediction must never apply damage or world edits.
- The Raspberry Pi provides PeerJS signaling and authenticated TURN fallback.
  Prefer direct WebRTC where possible. Same-LAN success or failed ICE checks alone
  do not prove a TURN problem: inspect both ends and compare the last working code.
- Preserve stable room discovery IDs, explicit protocol negotiation, clear version
  mismatch errors, refreshed temporary relay credentials, reconnect handling,
  compressed bounded state queues and guest interpolation.
- New gameplay state must survive host/guest transport, round reset and hot join.
  Use stable entity identities. Change the protocol if the required wire shape
  changes, with an instruction to refresh both players' tabs.
- Keep the simulation clock separate from rendering. Bound particles, fragments,
  lights and audio output. Cache static scenery and repeated pickup art/labels.
  Spread expensive bot route rebuilding across ticks, especially after destruction.
- Test guest performance separately from host performance. A powerful guest PC
  can still stutter due to transport bursts or interpolation. Do not label a
  renderer CPU timing measurement as actual FPS or internet latency.
- Gameplay work does not authorize changes to unrelated Pi household services.
  Follow `server/pi/README.md` and Sam's global Pi rules for infrastructure work.
  Preserve the explicit public game-service exception and the LAN-only household
  boundary. Never print or commit credentials or ask for passwords in chat.

## Working and release discipline

- Steam targets are Windows x64 and Linux x64, including planned Steam Deck
  support. Keep the Vite/Canvas game shared with the browser build. Follow
  `docs/STEAM.md` for desktop packaging and remaining release gates. No Steamworks
  account/App ID existed at the start of this work; never use placeholder IDs or
  imply Steam features, approval or Deck compatibility have been verified.
- Keep the Electron renderer sandboxed and isolated, with no Node integration or
  raw IPC exposure. Bundle game assets, preserve offline solo play, and let Steam
  manage desktop updates. Keep desktop dependencies separate from browser builds.
- Run desktop unit and executable smoke tests for desktop changes. Build each
  target on its own OS, keep exact revision/hash manifests and licence notices,
  and preserve Linux execute bits. Never package credentials or steam_appid.txt.

- Inspect the current branch, dirty changes, code and relevant tests first.
  Preserve user changes. Use GitHub `main` as the shared source of truth.
- Make routine reversible decisions and complete authorized work without repeated
  permission questions. Do not create another task or delegate to agents unless
  Sam explicitly asks. Do not add unsolicited dependencies or architecture rewrites.
- Use `npm ci` in a fresh checkout. Run `npm test` for gameplay/network changes and
  `npm run build` for a release. Run the server tests when changing server code.
  Docs-only work needs link/content review and `git diff --check`, not gameplay tests.
- Test behavior, not copies of implementation. Cover collision, live ragdoll
  recovery, death effects, destruction, resets and invalid wire data as relevant.
- Visually inspect actual rendered gameplay for animation/art changes. Use real
  host/guest browsers and verify a selected relay candidate when checking TURN.
  Fake peers and local screenshots alone are not proof of online functionality.
- Check mobile controls with real browser touch events when touch behavior changes.
  Check hot join into an already changed map when adding persistent world state.
- Established gameplay delivery includes committing, pushing and verifying the
  Pages release unless Sam requests local-only work. Never claim an unshipped change
  is live. Docs-only updates can use `[skip ci]` to avoid republishing unchanged assets.
- Production builds use `VITE_ROOM_SERVICE_URL` and `VITE_TURN_CREDENTIALS_URL`;
  see the workflow and handoff for the public endpoint configuration. No secrets
  belong in the frontend bundle. Wait for successful CI/deployment and compare the
  published files with the tested build; then check the public game in-browser.
- Stop only development servers started for the current task. Do not leave debug
  hooks in production. Keep the working tree and next-chat handoff understandable.
- Report what changed, what was tested, what is live and any remaining work plainly.
