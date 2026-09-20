# Bonk Club — current handoff

Updated 20 September 2026. Read the root `AGENTS.md` first. Completed release
history through v0.40.0 is archived in
[`archive/release-history-through-v0.40.0.md`](archive/release-history-through-v0.40.0.md).

## Current release

- Source before this documentation cleanup: `origin/main` at `5d9fa69`.
- Game version: v0.40.2, protocol 63. Refresh the host tab before creating a room.
- Hosts may start a one-player test match when all opponent slots are empty or
  Closed. Normal hot-join, death/reset and populated-lobby rules remain.
- Release run [35521310427](https://github.com/SamCousinsGB/bonk-club/actions/runs/35521310427)
  passed 1,061 game tests, three server tests, all six arena-stress shards,
  Windows/Linux desktop checks, release consistency and Pages. All 17 public files
  matched the CI browser artifact; public one-player control QA passed without errors.

## Reconciled WIP

- The old `codex/survival-arenas` checkout was based on v0.24-era source. Its twelve
  failures came from incomplete Transmission Towers, black-hole pickup, hazard and
  menu-fight integration that current `main` had already superseded.
- A normalized file comparison confirmed that later `main` releases contain the
  relevant gameplay, networking, arena, desktop and test implementations. No old
  gameplay file was carried over current source.
- Rechecking current `main` passed the compact game suite, three server tests and
  production build. The obsolete dirty checkout and finished task worktrees can be
  removed after this branch is integrated.

## Development and release

- `npm test` is the compact fast suite. `npm run test:stress` runs exhaustive arena
  simulations; CI splits them across six shards. `npm run test:release` runs both.
- Start from current `origin/main`, use focused tests during development, and run the
  relevant full checks before integration.
- Gameplay/art changes require source browser interaction and visual QA. Networking
  changes require real host/guest/hot-join checks and relay evidence when TURN is in
  scope.
- Keep GitHub `main`, public Pages assets and this short handoff consistent. Do not
  append historical release narratives here.
