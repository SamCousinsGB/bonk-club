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
- Build an original, entirely browser-based, two-dimensional physics brawler,
  inspired by the feel of Stick Fight: The Game. Keep its own artwork and name.
- Put the effort into responsive combat, physical consequences, readable action,
  varied maps and good online play. Do not build a marketing page around the game.

## Interface and writing: no AI filler

- Never add unsolicited slogans, taglines, quips, forced banter, faux-edgy humour,
  marketing copy, ornamental badges, invented version labels or decorative prose.
- Use concise functional names, controls, instructions, status and errors. If text
  does not help someone use or understand the game, omit it. Empty space is fine.
- Prohibited examples include “Friendship is a contact sport”, “Zero dignity”,
  “Small sticks. Big grudges”, “Tonight's bad idea”, “Bring fists to a rocket
  fight”, “Headphones encouraged”, “Physics prototype / 01”, “Take a breather”
  and “Reconsider your friendships”. Do not replace them with similar filler.
- Use direct labels such as Single player, Online multiplayer, Start match,
  Character, Settings and Leave room. Express personality through play and art.
- Review new user-visible strings before delivery. An explicit creative-writing
  request is the exception; a request for polish or a fun game is not.

## Modes, rooms and continuity

- Support solo play against AI and online multiplayer for up to four fighters.
  **Local/couch multiplayer is removed.** Earlier “no single player” requirements
  were superseded and must not be restored.
- Clicking Online creates a pregame lobby with an invite code and shareable link.
  The host starts once; no individual ready checks. Allow hot joining during play.
- Preserve slot modes: AI/Player, AI only, Player only and Closed. The host controls
  them in the lobby. Joining replaces AI only where the chosen slot allows it.
- Let players set their name, colour and hairstyle. Preserve saved preferences,
  validate profiles, and keep identities consistent between lobby and gameplay.
- Rounds continue indefinitely. No best-of-five or winning-score match end.
  Track the current leader. Scores belong to the current occupant and reset when
  that occupant leaves or is replaced, not when an unrelated player joins.
- Escape opens/closes a menu, never pauses. Focus loss, alt-tab and background
  rendering must not intentionally pause simulation or networking. Clear held
  controls on blur. Do not claim to defeat browser/OS suspension or tab discard.

## Movement, controls and combat

- Keep the large, zoomed-out cat-and-mouse scale. Current baseline: 2560 × 1440
  world units and 240 units/second running speed. Impulses may exceed run speed.
- Fighters use procedural poses and physical bodies. Avoid static stick sprites,
  permanent crouch-walking, rigid canned animation and purely cosmetic knockback.
- Preserve keyboard/mouse, controller and usable mobile touch controls. Left click
  punches/fires, S lies down, F throws. Pickups are automatic. Touch uses movement
  drags, jump swipes, aim/fire gestures and double-tap to throw; keep simultaneous
  movement and firing possible. Support portrait and landscape without page drag.
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

## Maps, AI and weapon effects

- Maintain varied themes and layouts: jungle, desert, homes, hospitals, industrial
  sites, ice, volcanoes and skyscrapers. Do not turn every arena into a tower.
- Give traversal headroom and clear takeoffs. Meaningful gaps should use double
  jumps, with alternate routes and elevators; avoid tightly stacked head traps.
- Support both routes around structural platforms and marked breakable panels.
  Keep cover useful and destructible. Destruction must update real collision,
  navigation and guest state, not just hide artwork.
- Hazards are physical map fixtures: vents, conveyors, spike balls, crushers,
  saw rails and electrical traps. They may cycle unpredictably with readable
  warnings. Do not restore arbitrary randomly appearing hazard zones.
- AI defaults to Easy with imperfect aim, reactions and firing discipline. Use
  the same controls, health, ammunition and physics as humans. Improve navigation
  without making bots accurate, tireless terminators.
- Unarmed and melee-weapon bots close distance or seek a reachable ranged upgrade.
  They must not stand at range attempting to shoot a bat or endlessly jump into a
  ceiling. Detect failed routes/stalemates and choose another action.
- Give weapons distinct, forceful effects. Sawblades and railguns cut in one
  unblocked hit; plasma/Tesla expose skeletons; ice freezes and can shatter; fire
  chars. Preserve weapon identities rather than using one generic explosion.
- Sam explicitly wants stylized stick-figure blood, impalement and dismemberment.
  Implement these as readable game effects with bounded particles and physical
  consequences. Their latest requested extensions are pending in the handoff.
- Powerful and strange weapons should be rare but actually appear during short
  rounds. Preserve featured weapon rotation and regular nuclear pickups.
- Nuclear destruction is localized to at most half the map's width (current
  radius 640). Keep the background, remove affected physical terrain/props and
  use a circular flash and skeleton-to-ash deaths. Fallout is visual only and
  should smoke away, not leave an opaque disk or permanent damage zone.
- **Black holes must stay visibly and physically 2D.** Bodies should stretch into
  curved strands through differential forces/constraints. Fragments should orbit
  and gradually spiral inward. Do not fake this with CSS-like scale transforms,
  flattened perspective ellipses or rigid prefab spinning. Actual wreckage and
  consumed terrain must agree with collision and remain changed until round reset.
- Do not assume the latest requested effects already exist; use the handoff to
  distinguish implemented behavior from requested changes.

## Architecture, security and performance

- This is a Vite/JavaScript Canvas game. GitHub Pages hosts static assets; it does
  not run the room service or relay. Preserve relative asset paths for `/bonk-club/`.
- The host browser is authoritative. Guests send bounded controls, not trusted
  health, position, inventory, damage, score or destruction. Validate snapshots.
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
