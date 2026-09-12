# Platforms, networking and account progression

Decision: 12 September 2026. Sam chose a shared browser/desktop game, Steam
networking for desktop, WebRTC for browsers, and a managed progression backend
later. The eventual commercial product is the Steam desktop game; browser
retirement is a future release decision, not part of this change.

## Shared development and release

Gameplay, physics, AI, art, controls and balance live in `src/`. There is no
desktop copy of the game. A single release workflow runs the shared gameplay
and browser service tests, then builds the browser and both native desktop
packages from the same Git revision. Pages publication waits for all three
targets. Desktop packaging remains native to Windows and Linux.

Both targets emit `build-metadata.json` with version, revision, dirty status and
the same `gameSourceHash`. Text line endings are normalized for this source hash;
packaged file hashes still verify the exact bytes. The two bundles differ by
their platform import. Removing the future browser build/deploy jobs must leave
the shared validation and desktop jobs intact.

`vite.config.js` resolves `#bonk-platform` at build time:

| Target | Platform module | Connection infrastructure |
| --- | --- | --- |
| Browser | `src/platform/browser.js` | Existing PeerJS, signalling and TURN |
| Desktop | `src/platform/steam.js` | Steam integration pending; no WebRTC fallback |

The desktop bundle excludes PeerJS and browser connection modules. Its renderer
cannot contact external HTTP/WebSocket endpoints. Building it needs no Pi URLs.
`STEAM_APP_ID` is an optional, non-secret build setting until the real app exists.
Supplying an ID does not enable networking or establish an authenticated user.

## Implemented boundary and remaining Steam work

`src/room-session.js` owns the shared protocol: slots, profiles, admission,
validated controls, compression, acknowledgements, motion/world streams, chat,
hot join and disconnection cleanup. `src/network.js` owns browser room codes,
PeerJS lifecycle, ICE credential renewal, retry and connection diagnostics.

A future Steam room uses the same `RoomSession`, with these platform operations:

- `create`/`join`: Steam lobby creation/discovery and a connection to its host.
  Browser room codes and URLs do not identify Steam lobbies. Keep platform invite
  handling inside the adapter and support launch-time and in-game invites.
- `accept(connection)`/`joinConnection(connection)`: attach a connection with
  bounded metadata and reliable `open`, `data`, `close` and `error` events.
- `openRealtimeChannel(connection)`: supply a disposable channel for sequenced
  inputs and independently budgeted actor/world messages. Expose actual queue
  pressure; preserve bounded assembly, dropped stale updates and acknowledged
  baseline recovery. Map delivery semantics to the native API rather than
  sending every update through a reliable ordered queue.
- `transportReport`, `roomServiceState`, `closeTransport`: sanitized diagnostics,
  truthful state and complete native handle cleanup, including renderer crashes.

Implement the modern `ISteamNetworkingSockets` or `ISteamNetworkingMessages`
API through a maintained native binding in the Electron main process. The
reviewed `steamworks.js` declaration currently exposes the deprecated
`SendP2PPacket` family; do not mistake that for the modern interface. Do not follow
examples that disable renderer isolation or enable Node integration.

**Current status:** no native binding, Steam lobby connection or SDR route has
been implemented or verified. No Steamworks app exists yet. Desktop online play
therefore reports that it is not configured; bundled solo play remains usable.
This is platform preparation, not a completed Steam networking release. Browser
multiplayer continues using its existing services; the Pi has not been retired.

After onboarding, prove a two-account lobby/message exchange on Windows and
Linux before wiring the full room flow. Verify actual Steam relay diagnostics,
separate ISPs, restrictive networks, version/full-room errors, hot join, packet
loss, jitter, suspend/reconnect and four-player gameplay. Steam lobby ownership
alone does not migrate the simulation; host migration remains separate work.

## Progression authority

The client is an untrusted presentation and input device, including the PC
hosting a P2P match. Steam identity authenticates an account; it does not prove
that the reported kills, wins, playtime or XP are genuine. Local files, Steam
Cloud saves, client-set Steam stats and host-signed reports cannot be the
authority for earned rewards.

| Data | Authority | Client responsibility |
| --- | --- | --- |
| Sound, controls, preferred name and existing free appearance options | Editable local preferences | Save preferences |
| Authenticated account identity | Steam ticket verified by the backend | Request authentication; never supply a trusted account ID |
| XP, level, earned statistics and achievement eligibility | Managed backend ledger | Read results; never set or increment authoritative values |
| Cosmetic ownership | Steam Inventory or backend entitlement ledger | Request a permitted equipped item |
| Match outcomes eligible for rewards | Trusted simulation or a deliberately designed trusted verifier | Submit bounded inputs/evidence, never a trusted result |

`src/progression.js` is the future client interface: read progression and request
an equipped cosmetic. It has no award, set-XP, unlock or set-owned API. Until a
service is connected, progression is unavailable and equip requests fail. It
never substitutes localStorage or preference files as an account authority.
This interface and field validation are not anti-cheat enforcement.

The later managed backend must:

1. Verify an app-specific Steam authentication ticket itself. Derive account
   identity from verification; keep tickets transient and publisher keys off
   every player device, repository, game bundle and log.
2. Own an account ledger keyed by verified Steam identity. Compute levels and
   unlock eligibility from canonical XP and a versioned rule set. Keep editable
   settings outside that ledger, including after account switching or offline play.
3. Issue match/session identifiers and accept reward events only from trusted
   execution. A function that accepts an authenticated player's claimed result
   is still insecure. A P2P host is not a trusted dedicated server. Rate limits,
   plausible numbers and agreement by several clients do not establish truth.
4. Award each accepted event once, atomically, using a unique match/round/event
   identifier scoped to the account and rules version. Reject duplicate, expired,
   cross-account and conflicting submissions. Queue transient failures without
   freezing gameplay; do not replay old requests as new rewards.
5. Validate cosmetic ownership on equip and on every honest recipient. A proof
   must bind the app, account, item, revision and validity period; copying another
   user's proof must not work. A local modified client can still draw arbitrary
   artwork on its own screen, but must not gain canonical ownership or make honest
   peers accept it.
6. Plan account recovery, backups, retention, rule migration, abuse limits and
   tests for forged results, replay, refunds/revocation and account switching
   before enabling rewards. Do not promise that all gameplay cheating is impossible.

A managed function/datastore can handle authentication and the ledger without a
machine Sam administers. Reliable win/kill-based progression additionally needs
trusted match execution or a properly designed verification service. That costs
infrastructure and is not supplied by SDR. Keep account reads and reward commits
off the latency-critical input/snapshot path. Service selection, accounts, billing
and deployment are future work; none has been created by this change.

Steam Inventory can manage ownership, purchases and constrained playtime drops
without a custom game server. Specific gameplay-earned grants require trusted
game-state authority. Publishing stats to Steam can mirror backend results; it
must not turn client-writable Steam stats into unlock eligibility.

## Verification and release gates

- Automated tests build both actual target bundles and inspect module inclusion
  and matching source metadata; existing room/physics tests cover the extraction.
- Desktop executable smoke proves isolation, explicit Steam setup status, zero
  external browser service requests, offline solo and preference persistence.
- `node desktop/tests/browser-online.mjs` runs three isolated browser contexts
  against the local production build and real signalling/TURN. Add `--public`
  after release to test the published files. It checks selected relay routes,
  controls, hot join and host departure. It is not Steam or cross-ISP evidence.
- Steam real-account networking, account-specific saves and managed progression
  verification remain required before advertising those features or awarding XP.

Sources reviewed 12 September 2026:

- [Valve networking](https://partner.steamgames.com/doc/features/multiplayer/networking)
- [Valve SDR](https://partner.steamgames.com/doc/features/multiplayer/steamdatagramrelay)
- [Steam Inventory authority](https://partner.steamgames.com/doc/features/inventory)
- [Stats and achievements](https://partner.steamgames.com/doc/features/achievements)
- [Valve anti-cheat guidance](https://partner.steamgames.com/doc/features/anticheat)
- [Reviewed JavaScript binding API](https://github.com/ceifa/steamworks.js/blob/main/client.d.ts)
