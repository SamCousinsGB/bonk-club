# Bonk Club

A browser physics brawler for 1–4 people. Original stick-figure artwork and arenas, inspired by the feel of party fighting games including Stick Fight: The Game. Not affiliated with Landfall.

## Play

Choose **Single player** to start immediately against three AI opponents. **Online multiplayer** creates a pregame lobby and immediately displays a six-character invite code, with copy-code and copy-link buttons. Friends join the lobby; the host presses **Start match** once, without ready checks. Friends can also join during play and replace an AI in the current round. Each device controls one player with keyboard, controller or touch. Both modes have four fighters, with AI filling unused slots. Use **Arenas** on the main menu or in the host lobby to choose the map rotation. Set your name, one of eight colours and one of six hairstyles in the lobby or **Character** menu. Choices are saved on your device, shown to other players, and carried across rounds. Human players reserve distinct colours; AI use the remaining colours. Changing appearance does not reset scores or combat state.

| Action                            | Keyboard / mouse | Standard controller |
| --------------------------------- | ---------------- | ------------------- |
| Move                              | A / D            | Left stick / D-pad  |
| Aim                               | Mouse            | Right stick         |
| Double jump                       | W / Space        | A / cross           |
| Punch / fire                      | Left mouse / E   | X / square or RT    |
| Block with fists / alternate fire | Right mouse / G  | B / circle or LT    |
| Lie down                          | Hold S           | LB or D-pad down    |
| Throw weapon                      | F                | Y / triangle        |

Weapons are picked up automatically when an unarmed player walks close enough. Throw the held weapon to free the slot; a thrown weapon can hit another player and retains its ammunition.

On phones, use **Online multiplayer** with one player per device. Single player supports the same touch controls against three AI opponents.

| Touch area    | Gesture                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Left          | Drag left/right to move; release to stop                                                       |
| Left          | Swipe up to jump, then swipe up again for the second jump                                      |
| Left          | Drag down and hold to lie down                                                                 |
| Right         | Drag to aim and fire, or hold to fire in the current direction                                 |
| Right         | Double-tap to throw the held weapon without firing first                                       |
| Action button | Block with fists, double shot with shotgun, charged shot with plasma; hidden for other weapons |

Portrait uses a camera that follows the local player, an arena overview, and a separate thumb-control area. Landscape shows the full arena with transparent thumb controls. Gestures reset on opening a menu, focus loss, cancellation and viewport changes. Touch menus respect phone cutouts and keep form controls large enough to use without zooming.

Escape opens or closes the game menu. The simulation continues while menus are open, while another tab is visible, and after focus loss. A dedicated worker clock drives simulation and network sends independently of rendering. Closing the browser or the operating system suspending/discarding the tab still stops its execution.

## Combat

- Active ragdolls with 11 independently simulated particles, 10 bone constraints, pose springs, inertia and platform contacts. Knockouts preserve the current body pose and velocity.
- Impulse combat, landing compression, flailing limbs, recoil, double jumps, stamina-limited guard and a 180 ms parry window. Blocking and parrying require empty hands. Holding any weapon, including a bat or sword, disables both. Timed unarmed blocks can reflect bullets.
- Holding down makes a fighter lie flat and lowers their collision shape. Release to stand when there is headroom.
- Twenty-four arenas. The default rotation cycles through all maps before repeating. Choose skyscrapers only or a fixed map through Arenas on the main menu. Twelve new maps cover jungle canopies and temples, desert canyons and ruins, garden houses and a mansion, hospital wards and an atrium, an arctic station, a volcanic quarry, a cargo port and an abandoned factory. Each has a distinct layout, scenery, terrain materials and cover.
- Arenas span 2560 × 1440 world units, with the full arena visible in landscape. Fighters keep their physical size, so they appear half as tall at the same display size. Running is limited to 240 units/second; hit and recoil impulses can still exceed that speed.
- Tall skyscraper rooms with 320 units between main floors (previously 180), separate elevator shafts, outside climbing routes, bridges and longer sightlines. Elevators carry standing or prone players and loose weapons in both directions.
- Tables, crates, logs, rocks, sofas, hospital beds, cabinets and barrels block movement, melee and projectiles. Damage cracks cover, then breaks it into simulated fragments. Concrete floors stop shots and explosions between storeys.
- 23 weapons: bat, sword, pistol, shotgun, rocket launcher, grenade, minigun, railgun, plasma cannon, triple rocket launcher, SMG, burst rifle, flamethrower, freeze ray, ricochet gun, sawblade launcher, Tesla gun, homing launcher, cluster launcher, heavy machine gun, repulsor, black hole generator and nuclear grenade. Fire burns after contact; ice temporarily slows; saws pierce and bounce; lightning chains across nearby opponents with a clear line of sight; homing rockets turn toward visible targets; cluster grenades scatter six smaller bombs; repulsors launch fighters and redirect shots; black holes pull in everyone and loose items, including their owner. The heavy machine gun only fires while prone on a floor.
- Each round opens with two featured rare/exotic pickups, rotating through that arsenal across rounds. Round 1 and every third round after it feature a nuclear grenade. Other pickups use 40% common, 32% uncommon, 20% rare and 8% exotic weighting before duplicate avoidance; the nuke has double weight inside the exotic tier (4% when all weapons are available). Non-featured spawns avoid types already on the map when possible. Further weapons arrive every 3–5 seconds. Rare and exotic pickups have blue and purple glows respectively.
- Holding attack while unarmed chains punch (25 damage), kick (32), and spinning finisher (43). The first two strikes keep opponents close; the finisher hits around the fighter, launches opponents and drains held guards. Each connected strike restores 4 health and 12 stamina, capped at 100. Parries and solid cover still counter melee. Directed attacks lunge, with one extra air lunge before landing and bounded horizontal boost. A brief unarmed lunge reduces incoming projectile damage and hit stun. Missing does not heal. A gap of 0.95 seconds or a heavy interruption resets the combo.
- Swept projectile collisions stop fast rounds at the first obstacle and prevent shots skipping thin cover.
- Eight environmental hazards: falling rocks and cargo, lightning, wind gusts, gas leaks, steam vents, electrical faults and lava vents. The host randomly chooses a suitable surface and hazard for the map. Each has a two-second marked warning and sound cue, followed by a short active period. Wind pushes players (less while prone); vents launch them; other hazards damage them. Solid floors contain hazards to their own storey. No hazards run during countdown or after a round ends.
- Continuous rounds with no winning score or match end. Each round win adds one point. The HUD marks the current leader or tied leaders. Scores persist across maps, but a slot starts at zero when a human replaces its AI or leaves and is replaced by AI.
- AI plans routes using the standing body, acceleration, single/double jumps, solid ceilings, furniture, moving lifts and spikes. Bots check takeoffs before jumping, remember failed routes and choose alternatives. They can wait on an elevator travelling toward their destination.
- Bots prefer reachable targets, seek useful weapon upgrades, lead moving targets, maintain weapon-specific distance, account for recoil near edges, avoid firing explosives into nearby cover, and predict incoming projectiles before guarding or ducking. Unarmed bots commit to close fights and follow up with combos, rather than abandoning a nearby opponent for a distant pickup. Heavy-gun bots deploy to fire and get up to relocate. They use the same controls, health, ammunition and physics as human players.
- Heavy weapons impart sustained recoil to their shooter on the ground and in the air. Movement can counter it gradually. Only the deployed heavy machine gun is braced without kickback. Shotgun alternate fire consumes two shells for a double shot; plasma alternate fire consumes two rounds for a larger charged orb. Alternate and primary fire share a cooldown.
- Grenades launch at 1900 units/second with an upward toss and a 2.8-second fuse, allowing throws across the 2560-unit arena where the arc is clear. The single-use nuclear grenade is thrown with attack or the throw-weapon action, has a 620-unit blast radius, and creates an expanding 1050-unit shockwave. Both can hurt the shooter; solid structures block blast damage. Grenades that leave the arena also detonate. The nuclear effect finishes animating even when its blast ends the round.
- Each arena includes marked wooden or glass floor panels. Shots, punches and explosions can break them; fighters, unsupported furniture and loose weapons then fall through the gap. Structural floors, stairs and elevators remain solid. Panels reset each round. AI can shoot a panel under an opponent or open a route through a breakable ceiling, then replan around the changed terrain.
- Shuffled or fixed arenas; sudden death after 120 seconds.
- Procedural sound effects, hitstop, particles and optional screen shake. Reduced-motion preferences disable screen shake.

## Online architecture and prototype limits

The **game and assets are static files hosted on GitHub Pages**. The host's browser runs the authoritative 120 Hz simulation. Guests send only bounded controls at 30 Hz, receive state snapshots, and interpolate player skeletons, moving platforms and falling hazards. Hazard warnings and activation, cover health, debris, thrown weapons, melee poses, burning/freezing effects, black holes, chain lightning and projectiles are included in validated snapshots. Room discovery IDs remain stable while protocol 10 is negotiated explicitly; incompatible clients get an instruction to refresh both tabs. Compatible browsers deflate snapshots once on the host and decode them on guests. Ordered binary transport supports chunking. Per-guest acknowledgements and buffered-amount checks prevent a slow guest accumulating an unlimited queue of old snapshots; the host sends a current state after acknowledgement. Compression falls back to plain binary snapshots when unavailable. A guest cannot submit health, weapon, position or score changes. A trusted host can still modify the simulation: this is not an anti-cheat system.

Online rooms use PeerJS and its public signaling service to connect browsers over WebRTC. This is an external dependency; GitHub Pages cannot run a signaling service. Connections explicitly use Google and Cloudflare STUN services instead of the defunct TURN addresses bundled in PeerJS 1.5.5. A disconnected signaling socket reconnects automatically without ending existing data channels. Joining has longer negotiation windows, one automatic retry, and separate errors for a host that did not answer, incompatible versions, and a host that answered but could not connect. No working TURN account is configured: networks that cannot connect directly still require a separate relay service. The old pre-hot-join build used the same discontinued PeerJS TURN fallback, so that fallback alone does not establish the cause of a particular failed invite. See the [PeerJS discontinuation notice](https://github.com/orgs/peers/discussions/1172). There is no voice/video capture, user account, analytics, or gameplay database.

**Quick match** searches eight fixed public tables using unique peer-ID claims. The first visitor becomes host; later visitors join that table. The host starts from the lobby with AI in empty slots. Joining players enter the lobby before start, or replace bots if the game is running; full rooms are skipped. This is a small public queue, not region-aware or skill-based global matchmaking. AI slots are explicitly labelled in the scoreboard.

The host must keep the game open; it can run in a background tab. Joining or leaving affects only that slot, and other scores and the current round are preserved. A living fighter is taken over in place with its health and weapon; if an incoming player replaces an eliminated bot during combat, they spawn on a clear platform. Returning through the link is a new player and starts at zero. A stale disconnected peer cannot send controls into a reused slot. Host migration, rollback netcode, durable leaderboards are not implemented. Closing the host ends the room. The free room service may fail; single player does not depend on it.

## Development

Node.js 24 is used in CI.

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` contains the deployable static game. Relative asset paths support a GitHub Pages repository subpath. Fonts are bundled locally. No keys or environment variables are required. The GitHub Actions workflow tests, builds, and publishes changes on `main`.

Tests cover movement speed limits, preserved knockback, arena crossing time, climbing both outside routes through the taller rooms, long-range shots, extended round timing, all arena spawns, full elevator return trips with standing/prone passengers and loose weapons, automatic pickup, thrown-weapon damage and ammo retention, cover destruction, projectile occlusion and penetration, plasma bounces, blast shielding, input/state validation, combat, parries, round transitions, active-ragdoll constraints, prone collision, mouse aiming, four-peer room lifecycle, and disconnect handling. Touch tests cover simultaneous pointers, swipes, double-tap disambiguation, button activation, cancellation, physics integration, and portrait/landscape coordinate mapping. Transport tests with fake peers do not establish cross-network WebRTC reliability.

Hazard tests cover warning periods, damage and impulse effects, avoiding marked zones, cover intercepting falling objects, floor shielding, phase changes, random scheduling, bounded snapshots and network validation. Map tests check all 24 spawns, unique themed layouts, physical cover and a complete map rotation before repeats.

Tactical regression tests exercise wide ceilings at several heights, reachable target selection, weapon upgrades, projectile defence, furniture obstruction, shooting out an opponent's floor, falling furniture/weapons, blast destruction and round resets.

Combat and arsenal regressions cover chained melee with real movement, contact-only healing, parries and wall occlusion, bounded air lunges, bot melee commitment, standing recovery in both directions, grounded heavy-gun deployment, burn/chill expiry, ricochets and saw penetration, blocked lightning chains, homing and cluster shots, self-threatening black holes, projectile repulsion, rarity distribution including initial pickups, and validated snapshots for all weapons.

Lobby and identity tests cover host-only start, profile validation and colour reservation, live appearance changes without resetting scores, identity persistence and departing-player cleanup. Connection tests cover explicit version rejection, compressed snapshots over the real binary encoding, acknowledgement backpressure and room-service reconnection. Weapon tests verify an opening nuke on all 24 maps and rare-weapon rotation across short rounds.
