# Bonk Club

A browser physics brawler for 1–4 people. Original stick-figure artwork and arenas, inspired by the feel of party fighting games including Stick Fight: The Game. Not affiliated with Landfall.

## Play

Choose **Single player** to start immediately against three AI opponents. **Online multiplayer → Create a room** starts a game with AI filling empty slots; copy the invite link during play and friends join directly into the current round. **Local multiplayer** supports two people sharing a keyboard and additional controllers. All modes have four fighters, with AI filling unused slots.

| Action          | Player 1 / online | Player 2                | Standard controller |
| --------------- | ----------------- | ----------------------- | ------------------- |
| Move            | A / D             | Left / right arrows     | Left stick / D-pad  |
| Aim             | Mouse             | Face movement direction | Right stick         |
| Double jump     | W / Space         | Up arrow                | A / cross           |
| Punch / fire    | Left mouse / E    | K                       | X / square or RT    |
| Block / parry   | Right mouse / G   | L                       | B / circle or LT    |
| Flop / lie down | Hold S            | Hold down arrow         | LB or D-pad down    |
| Throw weapon    | F                 | O                       | Y / triangle        |

Weapons are picked up automatically when an unarmed player walks close enough. Throw the held weapon to free the slot; a thrown weapon can hit another player and retains its ammunition.

On phones, use **Online multiplayer** with one player per device. A phone can also provide one touch player in a local match alongside connected controllers. Single player supports the same touch controls against three AI opponents.

| Touch area   | Gesture                                                        |
| ------------ | -------------------------------------------------------------- |
| Left         | Drag left/right to move; release to stop                       |
| Left         | Swipe up to jump, then swipe up again for the second jump      |
| Left         | Drag down and hold to lie down                                 |
| Right        | Drag to aim and fire, or hold to fire in the current direction |
| Right        | Double-tap to throw the held weapon without firing first       |
| Block button | Hold to guard; tap just before a hit to parry                  |

Portrait uses a camera that follows the local player, an arena overview, and a separate thumb-control area. Landscape shows the full arena with transparent thumb controls. Gestures reset on opening a menu, focus loss, cancellation and viewport changes. Touch menus respect phone cutouts and keep form controls large enough to use without zooming.

Escape opens or closes the game menu. The simulation continues while menus are open, while another tab is visible, and after focus loss. A dedicated worker clock drives simulation and network sends independently of rendering. Closing the browser or the operating system suspending/discarding the tab still stops its execution.

## Combat

- Active ragdolls with 11 independently simulated particles, 10 bone constraints, pose springs, inertia and platform contacts. Knockouts preserve the current body pose and velocity.
- Impulse combat, landing compression, flailing limbs, recoil, double jumps, stamina-limited guard and a 180 ms parry window. Timed blocks can reflect bullets.
- Holding down makes a fighter lie flat and lowers their collision shape. Release to stand when there is headroom.
- Twenty-four arenas. The default rotation cycles through all maps before repeating. Choose the skyscrapers only or a fixed map in the lobby. Twelve new maps cover jungle canopies and temples, desert canyons and ruins, garden houses and a mansion, hospital wards and an atrium, an arctic station, a volcanic quarry, a cargo port and an abandoned factory. Each has a distinct layout, scenery, terrain materials and cover.
- Arenas span 2560 × 1440 world units, with the full arena visible in landscape. Fighters keep their physical size, so they appear half as tall at the same display size. Running is limited to 240 units/second; hit and recoil impulses can still exceed that speed.
- Tall skyscraper rooms with 320 units between main floors (previously 180), separate elevator shafts, outside climbing routes, bridges and longer sightlines. Elevators carry standing or prone players and loose weapons in both directions.
- Tables, crates, logs, rocks, sofas, hospital beds, cabinets and barrels block movement, melee and projectiles. Damage cracks cover, then breaks it into simulated fragments. Concrete floors stop shots and explosions between storeys.
- Ten weapons: bat, sword, pistol, shotgun, rocket launcher, grenade, minigun, railgun, plasma cannon and triple rocket launcher. The railgun penetrates wooden cover and players; plasma bounces off solid surfaces; the triple launcher fires three rockets with strong recoil. Explosions can hurt their owner.
- Swept projectile collisions stop fast rounds at the first obstacle and prevent shots skipping thin cover.
- Eight environmental hazards: falling rocks and cargo, lightning, wind gusts, gas leaks, steam vents, electrical faults and lava vents. The host randomly chooses a suitable surface and hazard for the map. Each has a two-second marked warning and sound cue, followed by a short active period. Wind pushes players (less while prone); vents launch them; other hazards damage them. Solid floors contain hazards to their own storey. No hazards run during countdown or after a round ends.
- Continuous rounds with no winning score or match end. Each round win adds one point. The HUD marks the current leader or tied leaders. Scores persist across maps, but a slot starts at zero when a human replaces its AI or leaves and is replaced by AI.
- AI routes trace jump and double-jump trajectories against the arena platforms and ceilings. Bots seek weapons, aim with imperfect target leading, attack cover, guard against incoming attacks and move out of marked hazards. They use the same controls and physics as human players.
- Shuffled or fixed arenas; sudden death after 120 seconds.
- Procedural sound effects, hitstop, particles and optional screen shake. Reduced-motion preferences disable screen shake.

## Online architecture and prototype limits

The **game and assets are static files hosted on GitHub Pages**. The host's browser runs the authoritative 120 Hz simulation. Guests send only bounded controls at 30 Hz, receive state snapshots, and interpolate player skeletons, moving platforms and falling hazards. Hazard warnings and activation, cover health, debris, thrown weapons and projectiles are included in validated snapshots. Room protocol v5 separates this release from older clients. A guest cannot submit health, weapon, position or score changes. A trusted host can still modify the simulation: this is not an anti-cheat system.

Online rooms use PeerJS and its public signaling service to connect browsers over WebRTC. This is an external dependency; GitHub Pages cannot run a signaling service. Connections use the library's default STUN/TURN settings. Availability and connectivity on restrictive networks are not guaranteed. There is no voice/video capture, user account, analytics, or gameplay database.

**Quick match** searches eight fixed public tables using unique peer-ID claims. The first visitor becomes host; later visitors join that table. Every room starts immediately with AI in empty slots. Joining players replace bots in the running game; full rooms are skipped. This is a small public queue, not region-aware or skill-based global matchmaking. AI slots are explicitly labelled in the scoreboard.

The host must keep the game open; it can run in a background tab. Joining or leaving affects only that slot, and other scores and the current round are preserved. A living fighter is taken over in place with its health and weapon; if an incoming player replaces an eliminated bot during combat, they spawn on a clear platform. Returning through the link is a new player and starts at zero. A stale disconnected peer cannot send controls into a reused slot. Host migration, rollback netcode, durable leaderboards, and multiple touch players sharing one screen are not implemented. Closing the host ends the room. The free room service may fail; single player and local play do not depend on it.

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
