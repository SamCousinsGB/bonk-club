# Bonk Club — next chat

Updated 20 September 2026. Read the root `AGENTS.md` first. This file is deliberately
short; completed release history through v0.40.0 is preserved in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Current source: `origin/main` at `74aedcfb92378119f2e43cfcb6f0e6d00f300f91`.
- Game version: v0.40.2, protocol 63. Refresh the host tab before creating a room.
- A host can set every opponent slot to Players only or Closed and start with one
  fighter. The lobby reports `1 / 1 players` and `Ready to start alone`; gameplay has
  no waiting overlay and does not apply sudden-death drain while only one fighter is
  active. Death still resets the round, and later player joins retain the existing
  hot-join rules.
- PR #4 integrated the checked implementation. Release run
  [35521310427](https://github.com/SamCousinsGB/bonk-club/actions/runs/35521310427)
  passed 1,061 game tests, three server tests, all six arena-stress shards, Windows
  and Linux desktop checks, executable smoke/package checks, release consistency and
  Pages. All 17 public files match the exact CI browser artifact by SHA-256.
- Source and public browser QA both started a room with three Closed slots and one
  live controllable fighter. The match remained in Round 1 without a waiting banner;
  the public page reported one active player and no browser errors.

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
