# Bonk Club — next chat

Updated 20 September 2026. Read the root `AGENTS.md` first. This file is deliberately
short; completed release history through v0.40.0 is preserved in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Pending integration: articulated Bullet Train carriages

- Candidate v0.40.1, protocol 63. Refresh every player's tab and create a new room.
- The derail is eight independent weighted carriage bodies rather than one 3,200-unit
  rectangle. Each coach owns position, velocity, angle, spin, bogie support and collision.
- Physical couplers propagate loads through the consist. Severe stretching or jackknifing
  breaks links; coach-to-coach collision prevents bodies passing through one another.
- Intact bogies stay supported until they reach missing rail. Unsupported coaches fall,
  articulate, tumble, carve platforms and retain lethal fighter, ragdoll, prop, debris,
  weapon and projectile impacts.
- Guests interpolate stable carriage identities. Carriage motion, support and coupler
  topology are bounded and validated through compact snapshots and hot joins.
- All 1,061 tests, production build and diff check passed before rebasing. A deterministic
  1600 x 900 source render was inspected with no page errors. Evidence is outside Git at
  `../physical-train-carriages.png` and `../physical-train-visual.mjs`.
- Worktree: `../bonk-club-qa/physical-bullet-train`; branch
  `codex/physical-bullet-train`. Re-run the current fast suite/build after integration;
  release verification remains outstanding.

## Current release

- Current source: `origin/main` at `f85b099c73ae580039782c5943da8ba4624c54ef`.
- Game version: v0.40.0, protocol 62.
- Latest gameplay change: Bullet Train can derail at carved track, retain physical
  momentum and collision, damage the arena and preserve its state for guests and
  hot joins.
- Release run 35517996996 passed 1,061 game tests, three server tests, Windows and
  Linux desktop checks, release consistency and Pages. All 17 public files matched
  the exact CI artifact, and the published v0.40.0 game passed browser checks.

## Test and release pipeline

- PR #2 merged as `58c39d7a055d51877664e39c966f5e3d9ed454e8`. Release run
  [35519218539](https://github.com/SamCousinsGB/bonk-club/actions/runs/35519218539)
  passed and deployed in 3 minutes 46 seconds; the comparable prior release took
  14 minutes. Public build metadata reports the exact merged revision.
- Exhaustive bot and finite-combat simulations retain all coverage. CI divides all
  29 arenas across six jobs; the slowest production shard took 2 minutes 45 seconds.
- The fast suite plus server tests took 2 minutes 7 seconds, browser build 14 seconds,
  Linux desktop 1 minute 4 seconds and Windows desktop 1 minute 16 seconds. These ran
  concurrently. Release consistency took 7 seconds and Pages deployment 9 seconds.
- `npm test` is the compact fast suite. `npm run test:stress` runs every exhaustive
  arena simulation locally. `npm run test:release` runs both.
- Pull requests cancel superseded runs. Browser building and main-release desktop
  packaging run alongside validation. Only one integration/release chat should
  merge and publish a batch of parallel worker commits.

## Parallel-chat contract

1. Start each task in a clean worktree from current `origin/main`.
2. Run focused tests while developing, then `npm test` and the relevant build.
3. Commit the focused change, but do not independently publish from every chat.
4. Give the commit to the designated integration/release chat.
5. The release chat integrates once, relies on the sharded mandatory CI gates,
   verifies the published artifacts and live game, then updates this file.
6. Remove clean completed task worktrees after integration. Never remove a dirty or
   unidentified worktree merely to reduce the count.

## Release checks

- Main CI must pass the fast suite, all six arena-stress shards, three server tests,
  browser build, Windows/Linux desktop tests and smoke/package checks, release
  metadata consistency and Pages deployment.
- Gameplay changes still require relevant source browser interaction and visual QA.
  Networking changes still require real host/guest and hot-join checks, including
  selected relay evidence when TURN behaviour is in scope.
- Keep the public game, GitHub `main` and this handoff consistent. Do not append old
  release narratives here; archive them.
