# Bonk Club — working contract

Read `docs/HANDOFF.md` after this file. Sam's latest request overrides older notes.
Start new work from current `origin/main` in one clean worktree.

## Product and interface

- Bonk Club is an original 2D physics brawler for browsers and eventual Windows /
  Linux Steam releases. Keep the shared Vite/Canvas game and original artwork.
- Prioritise responsive combat, physical consequences, readable action, varied maps
  and reliable online play. Do not build a marketing page around the game.
- No unsolicited slogans, jokes, decorative copy, badges or invented claims. Use
  concise functional labels, status and errors. Sparse lowercase bot reactions are
  allowed only after spectacular kills and must name the actual killer correctly.
- The menu background is a real autonomous physics fight with movement, pickups and
  varied weapons, not a scripted vignette or slideshow.
- The main menu shows `vMAJOR.MINOR.PATCH` and a concise latest-update line from
  `package.json` (`version` and `releaseNotes`). Keep the lockfile in sync. Gameplay
  features use minor versions, fixes patch versions, and breaking changes major.

## Modes, identity and rounds

- Support solo AI and online multiplayer for up to four fighters. Local/couch mode,
  separate Settings and separate Controls menus remain removed.
- Play uses one pregame lobby. Online rooms always show an invite code/link, even
  with only bots; offline desktop play reports invites unavailable honestly.
- Guests customise separately and ready up. The host owns slots and match options;
  changes clear readiness. Preserve Player/bot, Bots only, Players only and Closed
  slots, hot joining, saved validated profiles and occupant-owned scores.
- The host may start a one-player test match when every opponent slot is empty or
  Closed. Normal populated lobbies retain their existing readiness rules.
- The host selects weapon/map pools and Easy-by-default AI. Pools apply to all
  rounds and refills. Rounds continue indefinitely and show the current leader.
- Preserve truthful death causes, draws and creative result-banner victory lines.
- Escape toggles a non-pausing menu. Blur clears held controls but must not
  intentionally pause simulation or networking.

## Controls and combat

- Baseline world: 2560 x 1440; run speed: 240 units/second. Impulses may exceed run
  speed. Do not clamp away recoil, blasts or death momentum.
- Keep procedural physical fighters and usable keyboard/mouse, controller and touch
  controls. Left click attacks or throws a carried object, S lies down, F throws,
  and weapon pickups are automatic. Right-click/G or the secondary action picks up,
  drops or throws a reachable prop/fragment; with none available it parries or uses
  alternate fire. Carried bodies keep their weight, collision, damage and reactions;
  heavy objects slow movement and throw less far. Knockdown, death, destruction,
  replacement and reset release the grip. Touch uses the same contextual action.
- Touch uses movement drags, jump swipes, aim/fire, double-tap throw, drag-down prone,
  and only compact Jump plus contextual Parry/Alt fire buttons. Guides and labels
  hide while held. Preserve simultaneous movement/fire and generous touch regions.
- Mobile gameplay is landscape. Join/Start requests fullscreen and orientation lock;
  refusal never blocks joining or pauses simulation. Keep the menu reachable in
  portrait and prevent page drag.
- Empty hands alone can parry once during a short window, then cool down. Holding
  does not repeat. Weapons cannot block unless they explicitly provide alternate fire.
- Melee needs directional lunges, forceful contact, feedback and bounded air use.
  Thrown weapons cause recoverable physical knockdowns based on mass.
- Shots persist until collision, capture, catch or round reset; only grenades retain
  fuses. Bound admission/render/transport without deleting shots already in flight.
- Grenade baseline: 450 horizontal speed, upward toss, 2.8-second fuse. All fighters
  start unarmed. Standard refills start after six seconds, then 6–8 seconds; grenade
  rolls keep separate 2-second then 3–5-second clocks. One nuke appears only on every
  third standard round and never in random refills.

## World and effects invariants

- Cargo Conveyor, Press Floor and Ice Sweep are deliberate Survival exceptions:
  broad floors, unarmed starts and sparse contested weapons. Preserve the setting,
  physical cargo, machinery warnings, ordinary-control AI dodges, destruction and
  hot join rather than turning them into normal heavily armed tower layouts.
- Maps must vary in theme and topology. Preserve traversal headroom, clear takeoffs,
  double-jump routes, alternatives and elevators; avoid tower repetition and head traps.
- Explosions deform every platform type with successive circular cuts. Marked wood/
  glass and wreckage take bullet damage; structural supports/lifts resist bullets.
  Destruction updates collision, navigation, snapshots and hot joins, then resets.
- Props and rubble are physical bodies with material-appropriate mass, friction,
  rotation, art and collision. Rubble persists until consumed/reset, capped at 96.
- Hazard fixtures warn readably, own damage on the host and clear broken fragments
  completely. Do not add arbitrary warning zones or persistent faded shells.
- Barrels and spills keep finite, distinct contents and physical casing fragments.
  Living fighters burn for three seconds after last exposure; re-exposure refreshes,
  while water/ice extinguish immediately.
- AI uses human controls, health, ammo and physics. Easy aim/reactions remain imperfect.
  Bots seek reachable weapons, avoid attacks across gaps and never jump into fatal
  drops from boredom. Explosive/black-hole users first create safe firing distance.
- Preserve distinct weapon behavior: held Tesla arcs, cutting rail/saw hits, plasma/
  Tesla skeletons, ice shatter, fire char, bubble lift/pop, and host-authoritative
  damage. Do not collapse effects into generic explosions.
- Power-fist hits launch a curled physical ragdoll whose swept body carves or breaks
  only what it actually reaches. Preserve gravity, recovery/death, host authority
  and resulting hot-join destruction; never substitute a pre-carved beam.
- Blood, impalement and dismemberment are intentional but bounded. Death bodies,
  skeletons, char, ice and pieces retain momentum, gravity and collision immediately.
- Nuclear radius is 480. Destruction is local; fallout is visual and clears after
  12 seconds while terrain damage remains.
- Black holes remain visibly and physically 2D: differential forces, curved strands,
  eccentric orbits, loose tumbling and local collision. Field radius is 465. Captured
  matter forms a persistent colliding singularity; compressed fighters show only
  recognisable customised heads. Global spacetime warp is visual-only, eased and
  cleared on closure/reset, with readable HUD and reduced-motion support.

### Arena-specific rules

- **Cargo Plane Hold:** a compact oval cutaway fuselage with wings and exposed
  turbines on both sides. The whole aircraft banks and shifts together; aiming
  follows that frame. Through-hull damage creates local outward decompression,
  pulling fighters, cargo, weapons, fragments, bodies and fluids through actual
  openings. Preserve the pressure controller through destructive weapons, guest
  prediction, changed-world hot joins and round reset.
- **Transmission Towers:** two pylons, two physical wire crossings, no centre bridge
  ledges. Wires attach at matching lower clamps, alternate 7 seconds safe / 7 live
  with 1-second amber warning, conduct through water, support walking only while
  intact, and fall/drape when cut. Crossed powered circuits arc continuously. Keep
  eight finite water jugs, host-owned wire physics/damage and persistent hot-join state.
- **Turbine Hall:** six continuous rotors over an open machinery void; no floor,
  trough, lower platform or bottom collision. Living and dead bodies become tumbling
  physical pieces. Bots avoid intact turbine beds.
- **Car Assembly:** a host-owned continuous conveyor stamps, welds, fits two fetched
  wheels separately and paints in a booth. Cars are heavy damageable rotating props.
  Belt motion requires surviving contact; holes and outfeed drop cars physically.
  Parts/paint remain independent and partial, later stations never repair earlier
  damage, empty stations park, broken stations fault red, and crushers hurt only
  below a descending lower face.
- **Bullet Train:** 3,200-unit train at 6,400 units/second after two seconds of signal/
  horn warning, alternating direction, with swept contacts, cover, upper bypasses,
  motion blur and stereo wind. Rail damage derails eight independently weighted
  carriage bodies with bogie support, breakable articulated couplers, matching
  collision, arena damage and validated guest/hot-join state; never restore one
  rigid whole-train body.
- **Scrap Foundry:** two breakable tilting ladles, lethal molten streams, inward
  conveyors, a central press and upper catwalks with amber warnings.
- **Arc Furnace:** six pass-through physical cables and a 16-second 9-open / 2-warning /
  5-active cycle that may become irregular after damage. Active arcs block the centre;
  the grate cools over 2.5 seconds and scenery is never collision. Bullets, beams and
  blasts carve actual surviving furnace geometry; breaches pour finite host-owned
  molten flows from their openings. Cut powered cables fall and remain dangerous,
  isolated runs go dead, and render/collision/snapshots/hot joins must agree.
- Thin slatted platforms and intact transmission wires permit jump-through and
  S/down drop-through with release grace, guest prediction and distinct art.

## Networking, platforms and security

- The host is authoritative. Guests send bounded controls, never trusted health,
  position, inventory, damage, score or destruction. Validate all snapshots.
- New gameplay state must support reset, transport and hot join with stable IDs.
  Change the wire protocol when shape changes and tell all players to refresh.
- Preserve stable discovery IDs, explicit negotiation/version errors, rotating TURN
  credentials, reconnects, acknowledged-baseline deltas, bounded queues and guest
  interpolation. Unknown/evicted delta baselines require a full validated snapshot.
- Guests may predict only their own movement, aim and attack motion with shared
  physics, reconciling against host state and applied-input sequences. Other fighters
  stay interpolated; death, knockdown and reset are immediate, and prediction never
  applies damage, pickups, inventory, scoring or world edits.
- Separate simulation from rendering; bound particles, fragments, lights, audio and
  route rebuilds. Renderer timings are not internet latency. Test guests separately.
- GitHub Pages is static. Browser online uses WebRTC/PeerJS plus TURN. Desktop network
  is Steam-only with no browser cross-play or silent Pi fallback. Read
  `docs/PLATFORMS.md` or `docs/STEAM.md` only when that scope is involved.
- Electron stays sandboxed and isolated: no Node integration/raw IPC, restricted
  preload/CSP, bundled assets, and offline solo. Never invent Steam IDs, claims,
  approvals or Deck verification; never package secrets or `steam_appid.txt`.
- Future progression/ownership needs managed or Steam authority. Clients/P2P hosts
  cannot award trusted XP, unlocks or hold publisher keys.
- Gameplay work does not authorise unrelated Pi changes. If infrastructure is truly
  required, follow `server/pi/README.md`; keep secrets out of chat, files and bundles.

## Work and release discipline

- Inspect branch, status, dirty changes, current code and relevant tests first.
  Preserve user work. GitHub `main` is shared truth.
- Do not create tasks or delegate unless Sam explicitly asks. Do not add unsolicited
  dependencies or architecture rewrites.
- Fresh checkout: `npm ci`. Run focused tests, then `npm test`; run
  `npm run test:stress` when simulation coverage is relevant and `npm run build` for
  browser releases. Server changes require server install/tests. Desktop changes
  require unit and executable smoke tests on each target OS.
- Visually inspect actual gameplay for art/animation changes. Test real touch events
  for touch changes and changed-world hot joins for persistent world state.
- Established gameplay delivery includes commit, push, successful CI/Pages, exact
  artifact parity and public browser verification unless Sam requests local-only work.
  Never claim unshipped work is live.
- Production uses repository-configured `VITE_ROOM_SERVICE_URL` and
  `VITE_TURN_CREDENTIALS_URL`; no frontend secrets. Stop only servers started for the
  task and leave the tree plus short handoff understandable.
