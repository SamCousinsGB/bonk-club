# Bonk Club

A browser physics brawler for 2–4 people. Original stick-figure artwork and arenas, inspired by the feel of party fighting games including Stick Fight: The Game. Not affiliated with Landfall.

## Play

Choose **Local multiplayer**, assign a separate control set to each player, and start a match. Two players can share a keyboard; connect controllers for three or four players. There is no playable single-player mode. The title screen runs a non-interactive physics demonstration.

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

Escape pauses local play. A host pause pauses the online simulation. Guests can open their menu but the online match continues. Public rooms require at least two real players and have no bots.

## Combat

- Active ragdolls with 11 independently simulated particles, 10 bone constraints, pose springs, inertia and platform contacts. Knockouts preserve the current body pose and velocity.
- Impulse combat, landing compression, flailing limbs, recoil, double jumps, stamina-limited guard and a 180 ms parry window. Timed blocks can reflect bullets.
- Holding down makes a fighter lie flat and lowers their collision shape. Release to stand when there is headroom.
- Twelve arenas. The default rotation uses four skyscraper maps: Office Tower, Twin Towers, Construction Site and Skybridge. Choose all arenas or a fixed map in the lobby.
- Multiple floors, balconies, gaps and moving elevators. Elevators carry standing or prone players and loose weapons in both directions.
- Breakable tables block movement, melee and projectiles. Crouching reduces exposure; damage cracks the tables, then breaks them into simulated fragments. Concrete floors stop shots and explosions between storeys.
- Ten weapons: bat, sword, pistol, shotgun, rocket launcher, grenade, minigun, railgun, plasma cannon and triple rocket launcher. The railgun penetrates wooden cover and players; plasma bounces off solid surfaces; the triple launcher fires three rockets with strong recoil. Explosions can hurt their owner.
- Swept projectile collisions stop fast rounds at the first obstacle and prevent shots skipping thin cover.
- First to 3, 5 or 10 wins; shuffled or fixed arenas; sudden death after 45 seconds; rematches.
- Procedural sound effects, hitstop, particles and optional screen shake. Reduced-motion preferences disable screen shake.

## Online architecture and prototype limits

The **game and assets are static files hosted on GitHub Pages**. The host's browser runs the authoritative 120 Hz simulation. Guests send only bounded controls at 30 Hz, receive state snapshots, and interpolate player skeletons and moving platforms. Cover health, debris, thrown weapons and new projectiles are included in validated snapshots. Room protocol v2 separates this release from older clients. A guest cannot submit health, weapon, position or score changes. A trusted host can still modify the simulation: this is not an anti-cheat system.

Online rooms use PeerJS and its public signaling service to connect browsers over WebRTC. This is an external dependency; GitHub Pages cannot run a signaling service. Connections use the library's default STUN/TURN settings. Availability and connectivity on restrictive networks are not guaranteed. There is no voice/video capture, user account, analytics, or gameplay database.

**Quick match** searches eight fixed public tables using unique peer-ID claims. The first visitor becomes host; later visitors join that table. When at least two players are ready, the host starts the match automatically after a short wait. Full or running tables are skipped. This is a small public queue, not region-aware or skill-based global matchmaking. If nobody else is online, the room waits. No fake players or population counts are shown.

The host must keep the game open and visible. Host migration, rollback netcode, reconnecting to a running round, durable leaderboards, and mobile couch multiplayer are not implemented. Any participant disconnecting returns the remaining players to the lobby for a fresh match. The free room service may fail; local play does not depend on it.

## Development

Node.js 24 is used in CI.

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` contains the deployable static game. Relative asset paths support a GitHub Pages repository subpath. Fonts are bundled locally. No keys or environment variables are required. The GitHub Actions workflow tests, builds, and publishes changes on `main`.

Tests cover all arena spawns, full elevator return trips with standing/prone passengers and loose weapons, automatic pickup, thrown-weapon damage and ammo retention, cover destruction, projectile occlusion and penetration, plasma bounces, blast shielding, input/state validation, combat, parries, round transitions, active-ragdoll constraints, prone collision, mouse aiming, four-peer room lifecycle, and disconnect handling. Transport tests with fake peers do not establish cross-network WebRTC reliability.
