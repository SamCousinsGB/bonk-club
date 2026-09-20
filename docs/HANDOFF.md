# Bonk Club — next chat

Updated 20 September 2026. Read the root `AGENTS.md` first. This file is deliberately
short; completed release history through v0.40.0 is preserved in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Current source: `origin/main` at `f85b099c73ae580039782c5943da8ba4624c54ef`.
- Game version: v0.40.0, protocol 62.
- Latest gameplay change: Bullet Train can derail at carved track, retain physical
  momentum and collision, damage the arena and preserve its state for guests and
  hot joins.
- Release run 35517996996 passed 1,061 game tests, three server tests, Windows and
  Linux desktop checks, release consistency and Pages. All 17 public files matched
  the exact CI artifact, and the published v0.40.0 game passed browser checks.

## Current infrastructure work

- Exhaustive bot and finite-combat simulations are being moved out of the normal
  test suite without reducing coverage. CI divides all 29 arenas across six jobs.
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
