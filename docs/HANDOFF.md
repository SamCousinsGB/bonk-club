# Bonk Club — next chat

Updated 20 September 2026. Read the root `AGENTS.md` first. This file is deliberately
short; completed release history through v0.40.0 is preserved in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Current source: `origin/main` at `9323960cefe54e20abc856419b964641cfac9832`.
- Game version: v0.40.1, protocol 63. Refresh every player's tab and create a new room.
- Bullet Train now consists of eight independently weighted carriage bodies with
  bogie support, articulated breakable couplers, coach collision and per-carriage
  destruction. Derailing coaches tumble, damage the arena and retain lethal physical
  interaction. Guests receive bounded, validated and interpolated carriage state for
  hot joins.
- PR #3 integrated the checked worker commit. Release run
  [35520338415](https://github.com/SamCousinsGB/bonk-club/actions/runs/35520338415)
  passed 1,061 game tests, three server tests, all six arena-stress shards, Windows
  and Linux desktop checks, release consistency and Pages in about three minutes.
  Public build metadata reports v0.40.1 at the exact merged revision above.
- A deterministic 1600 x 900 source render was inspected with no page errors before
  integration; focused train, render-state and network tests and the production build
  were repeated after rebasing.

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
