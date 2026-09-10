# Bonk Club — next chat

Updated 10 September 2026. Read the root `AGENTS.md` first.

## Start here

Work in `C:\Users\SamCo\Documents\ChatGPT\bonk.club`. This is the actual game
repository, fetched from `SamCousinsGB/bonk-club`; it replaces the earlier working
location under the dated Codex outputs folder. Do not create a new game or another
GitHub repository. The display name is **Bonk Club**.

Sam ended the previous chat to establish this constitution and continue in a new
chat. **The five requests below are authorized but not implemented.** The handoff
and constitution are documentation, not evidence that those effects have shipped.

Suggested next-chat instruction: “Read AGENTS.md and docs/HANDOFF.md, then implement
the five pending effects requests, test them online, and publish.”

## Pending effects pass — Sam's latest request

1. **Spikes should be hard objects that impale and hold the body, with blood.**
   Current spikes kill, but do not deliver the requested solid impalement behavior.
   Keep the body attached at the contact point rather than falling through the
   spike artwork. Make visible geometry, collision and the attachment agree. The
   effect and any surviving attachment need to render correctly for guests.

2. **Heavy-calibre weapons should cause dismemberment and blood.**
   Existing saw/rail cuts and energy/ice/fire deaths are already distinct. Add
   appropriate heavy ballistic limb separation and blood without replacing those
   identities with a generic effect. Choose the affected weapons from the actual
   arsenal, keep the classification explicit, and use bounded physical fragments.

3. **A thrown weapon hitting someone should ragdoll them; bigger weapons cause a
   stronger ragdoll.** This means a living fighter can be physically knocked down
   and recover, not merely a death animation or a static hit-stun timer. Scale
   impulse/tumble/recovery reasonably by weapon size or mass. Preserve thrown
   weapon ammo, pickup behavior, collision, health and host authority. Avoid
   permanent prone/stun locks and ensure recovery works on platforms and slopes.

4. **Nuclear fallout should smoke off and dissipate.** Keep the existing background
   and destroyed physical terrain. Let the remaining visible smoke, particles and
   tint disperse and clear instead of persisting as a fixed circular filter until
   the next round. This remains a visual aftermath, not a new radiation damage
   mechanic. Preserve the localized half-map blast and skeleton-to-ash deaths.

5. **Replace the current black-hole stretching with convincing 2D spaghetti and
   orbital motion.** Sam dislikes the CSS-transform-like appearance. The current
   implementation contains a rotated/scaled head ellipse and rotates rigid chunks
   around prescribed paths; these are the specific approaches to replace. Stretch
   bodies into curved 2D strands using the actual points/constraints and different
   forces along the body. Platforms, traps and props should also orbit, deform or
   fragment and gradually spiral inward. Do not use perspective flattening or
   merely scale a whole fighter/prefab. Preserve the strong pull, consumption and
   permanent damage to the map; remaining wreckage must have matching collision.
   Decide implementation details autonomously, keeping the result readable and fast.

Verify live-player knockdown recovery, grounded impacts, collisions with spikes
and moving fragments, death-effect combinations, round resets, reduced motion,
bounded particles/audio, guest interpolation, and hot joining an already damaged
map. In particular, avoid rebuilding a huge navigation graph in a single tick.

## Last completed gameplay release

- Commit: `86b159ab67bc01fb5ab893942ed3ccfbd0bbbd96`
  (`Add weapon-specific deaths and destructive black holes`).
- Pages deployment: `https://github.com/SamCousinsGB/bonk-club/actions/runs/34429700083`.
- Site: `https://samcousinsgb.github.io/bonk-club/`.
- Wire protocol: **16**; PeerJS **1.5.5**. Discovery IDs remain stable.
- Last verified frontend bundle: `index-CDuq1yx1.js`; CSS: `index-jjUrK9is.css`.
- Evidence recorded in the previous chat: **279 tests passed**, production build,
  successful GitHub build/server tests/deploy, and public HTML/linked asset hashes
  matched the build. Real browsers through the Pi TURN relay received saw/rail
  cuts, plasma/Tesla skeletons, ice freeze/shatter, flame and explosive deaths,
  black-hole stretching, rotating collision wreckage and late-join state. Public
  lobby/slot/hot-join/leave/rejoin and mobile viewport checks passed without browser
  errors. These are dated results; rerun the checks relevant to the new changes.
- The last release also split expensive navigation traces into batches after a
  black hole. Preserve that fix. Do not claim the rejected visual treatment is
  already satisfactory just because its mechanics and tests passed.

## Code map

| Area | Files |
| --- | --- |
| Authoritative physics, hits, throws, ragdolls, scoring | `src/engine.js`, `src/puppet.js`, `src/collision.js`, `src/impact.js` |
| Weapon definitions and special behavior | `src/arsenal.js`, `src/specials.js`, `src/melee.js` |
| Death simulation and drawing | `src/death-effects.js`, `src/death-art.js` |
| Black holes and collision wreckage | `src/blackhole.js`, `src/blackhole-art.js` |
| Nuclear destruction, ash and fallout | `src/nuclear.js`, `src/nuclear-art.js` |
| Map traps and spikes | `src/hazards.js`, `src/arena-traps.js`, `src/trap-art.js`, `src/engine.js` |
| Rendering, effects and sound | `src/renderer.js`, `src/arsenal-art.js`, `src/audio.js` |
| Bots and route budgets | `src/bots.js`, `src/navigation.js`, `src/bot-difficulty.js` |
| Wire validation and guest interpolation | `src/network.js`, `src/render-state.js` |
| Menus, online lifecycle, controls | `src/main.js`, `src/slots.js`, `src/identity.js`, `src/touch.js` |

Start with `tests/weapon-effects.test.js`, `tests/hazards.test.js`,
`tests/puppet.test.js`, `tests/skyscrapers.test.js`, `tests/nuclear.test.js`,
`tests/network.test.js` and `tests/render-state.test.js` as relevant. Read actual
code before fixing a suspected behavior; do not infer implementation from this table.

## Development and release

The fresh checkout has no installed dependencies. Run `npm ci` before local work.
Node 24 is used in CI. Development: `npm run dev`; tests: `npm test`; production:
`npm run build`. Server changes also need `npm ci --prefix server --ignore-scripts`
and `npm test --prefix server`.

For a local production build matching the deployed service configuration, set
these **public endpoint addresses** in the current PowerShell process:

```powershell
$env:VITE_ROOM_SERVICE_URL = 'https://bonk-club.82-28-16-193.sslip.io/peerjs'
$env:VITE_TURN_CREDENTIALS_URL = 'https://bonk-club.82-28-16-193.sslip.io/ice'
npm run build
```

The workflow `.github/workflows/pages.yml` takes the same endpoints from repository
variables `ROOM_SERVICE_URL` and `TURN_CREDENTIALS_URL`. Actual credentials stay
off-repository; the Pi supplies temporary client TURN credentials. Gameplay work
should not need changes to the Pi. If it does, read `server/pi/README.md` and the
global infrastructure rules before taking action.

Previous local QA helpers/screenshots are under
`C:\Users\SamCo\Documents\Codex\2026-09-06\i-wa\work`, notably
`effects-online.cjs`, `effects-visual.cjs`, `effects-audio.cjs`,
`blackhole-cost.mjs`, `slots-browser.cjs` and `verify-scale-live.py`. They are
scratch tools outside Git, with old checkout paths and a machine-specific browser
dependency. Inspect and adapt them to this checkout before reuse; do not depend
on their presence in CI. Never ship their debug hooks in the game.

When the effects pass is complete, update this handoff with the actual outcomes,
remaining limitations, verified revision and checks. Do not silently turn pending
requests into claims of implemented behavior.
