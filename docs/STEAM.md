# Bonk Club: Steam production and release

Updated 11 September 2026. Target: Windows x64 and native Linux x64, with Steam
Deck hardware validation before claiming compatibility. Sam has no Steamworks
account or App ID yet. This is a working desktop build and release pipeline;
it is not a Steam-approved commercial release.

## Implementation decision

Keep the existing Vite/Canvas simulation and authoritative multiplayer protocol.
Electron provides the installed runtime. All game assets and fonts are included,
so solo play has no website or login dependency. Windows and Linux use the same
game code and remain compatible with the browser release when protocols match.
Steam supplies installation and updates; there is no second auto-updater.

An engine port to Unity/Godot would be a separate project with substantial physics,
rendering and networking regression risk. It is not required to ship this game.
The Steamworks SDK's gameplay integrations are optional for distribution;
SteamPipe is the upload path. [Valve SDK overview](https://partner.steamgames.com/doc/sdk)

## What is implemented

| Area | Implementation | Limit |
| --- | --- | --- |
| Installed game | Windows/Linux packaging; bundled assets; application icon; executable named BonkClub | Linux and Windows are built on their own CI runners |
| Runtime boundary | Sandboxed renderer, context isolation, no Node integration, narrow validated IPC, restrictive CSP, no popups/downloads/remote game code | Keep Electron patched as part of regular releases |
| Saves | Bounded, validated, atomically replaced JSON; corrupt-file recovery copy; browser preference migration | Local OS profile, not yet separated by Steam account |
| Desktop controls | Fullscreen, F11/Alt+Enter, Quit, single instance, saved window size, renderer-crash recovery | No Steam overlay integration yet |
| Controller menus | Directional navigation, A accept, B back, Start menu, on-screen name/code keyboard | Standard gamepad mapping tested by emulation; physical devices remain a release gate |
| Settings | Character, AI difficulty, arena selection, mute and reduced motion persist | No achievements or persistent campaign progression |
| Online play | Existing browser-compatible room codes, invites, public room discovery and TURN fallback | Existing host disconnect ends the room |
| Release checks | Behaviour tests, desktop smoke, separate OS packages, licence notices, SHA-256 manifests, source/asset freshness checks | No code-signing identity or Steam account configured |
| SteamPipe | Two-depot preparation; validates IDs, matching clean revisions and every packaged file; preview by default | Generates scripts only; never logs in, uploads or publishes |

The app-private Electron session intercepts the game's existing HTTPS publisher
URL and serves that path from the bundle. It never falls back to downloading game
HTML or scripts. Only configured signalling/temporary TURN HTTPS endpoints pass
through to the network; navigation, TLS verification and web security remain
enabled. This preserves the service's existing origin checks and shareable web
links without modifying household infrastructure.
[Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol),
[Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

## Build and run

Use Node 24. Install root and desktop dependencies separately; the browser build
does not acquire Electron dependencies.

```powershell
npm ci
npm ci --prefix desktop
$env:VITE_ROOM_SERVICE_URL = 'https://bonk-club.82-28-16-193.sslip.io/peerjs'
$env:VITE_TURN_CREDENTIALS_URL = 'https://bonk-club.82-28-16-193.sslip.io/ice'
npm run desktop:build
npm start --prefix desktop
```

These are existing public service URLs, not secrets. GitHub Actions reads the
corresponding repository variables. Missing or malformed URLs fail the desktop
build instead of silently using an unrelated public signalling provider.

```powershell
npm test
npm test --prefix desktop
npm run smoke --prefix desktop
node desktop/tests/online.mjs
npm run desktop:package -- --platform=win32
```

`online.mjs` is an explicit live-service check. It creates temporary rooms and
forces actual relay candidates in an external test harness. It requires Edge on
Windows, or Playwright Chromium on Linux. It does not add production debug hooks.
The normal smoke has no online-service dependency and tests offline solo, settings
across restart, the sandbox boundary, controller menus and on-screen entry.

On Linux use the same commands with shell-appropriate environment variables and
`--platform=linux`. CI uses `xvfb-run` for graphical smoke tests. Do not add
`--no-sandbox` to solve distribution failures; test with the Steam Linux Runtime
and correct target OS dependencies. Linux depots use tar.gz to preserve executable
permissions. Steam launch options must select `BonkClub.exe` for Windows and
`BonkClub` for Linux; working directory is the install root. `--fullscreen` is
supported and is the intended Deck launch option.

Packages are in `release/BonkClub-win32-x64` and `release/BonkClub-linux-x64`.
Distribute the entire folder, not just the executable. The `Build desktop game`
workflow uploads archives named with the exact Git revision. Keep a copy of the
last accepted archives and manifests for rollback. Steam branch changes, not
in-place edits, should promote or roll back releases.

## Steamworks work Sam needs to complete

1. Create the Steamworks partner account and complete Valve's identity, banking,
   tax and distribution-agreement steps privately. An individual can onboard;
   an incorporated company is not a prerequisite. Do not put those details in Git
   or chat.
2. Pay the **US$100 or local equivalent app fee**, obtain the App ID, and create
   one Windows and one Linux depot. Send only these three IDs to continue setup.
3. Choose the publisher display name, support contact, price and territories.
   Decide how the currently free browser build relates to the paid desktop game.
   No price, storefront claim or restriction has been invented here.
4. Complete the store content survey, including the stylised blood, dismemberment,
   impalement, nuclear effects and any applicable AI content disclosures. Audit
   actual shipped content and its provenance; do not assume all assisted
   development has the same disclosure treatment.

For the first release, Valve specifies a **30-day wait after the app fee** and
at least **two weeks with a public Coming Soon page**. These periods can overlap.
[Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding),
[Content survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)

## SteamPipe and private testing

Download matching clean Windows and Linux archives from one workflow revision and
extract them into `release`. Once the real IDs exist:

```text
npm run steam:prepare -- --app-id=YOUR_APP_ID --windows-depot=YOUR_WINDOWS_DEPOT --linux-depot=YOUR_LINUX_DEPOT
```

This validates the packages and writes `steam-build/app_ID.vdf` and depot VDFs.
The first script is a preview (`Preview 1`). Test it using Steamworks' downloaded
ContentBuilder/SteamCMD from an interactive terminal:

```text
steamcmd
login YOUR_BUILD_ACCOUNT
run_app_build C:/path/to/bonk.club/steam-build/app_ID.vdf
quit
```

Authenticate privately when prompted; do not place a password or Steam Guard code
in a command or script. For an actual upload configuration, repeat preparation
with `--upload=true`, inspect the resulting VDF, then run it interactively. No
`SetLive` is emitted. Assign the uploaded build to a private test branch in
Steamworks after the upload completes. Verify the installed build on two Steam
accounts and both OSes before choosing any public branch.
[Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading)

Store presence and game builds undergo separate Valve reviews. Allow at least
seven business days for each review and corrections; Valve describes normal
reviews as roughly three to five business days. Review is not a guarantee of
commercial quality or a substitute for our own tests.
[Review process](https://partner.steamgames.com/doc/store/review_process)

## Steam integration still to implement and verify

These are explicit follow-up deliverables after the App ID and test accounts
exist. No UI pretends they already work.

- **Steam identity, friend invites and rich presence.** Add a maintained native
  Steamworks bridge in the main process, keeping the renderer sandboxed. Validate
  a lobby/room token and protocol on invite acceptance; handle invites received
  before startup and during a round. Keep user character preferences and guest
  authority rules. Test with two different owning accounts, offline Steam, overlay
  open/close and version mismatch. Never accept health/position from Steam lobby
  metadata.
- **Account-specific saves and Steam Cloud.** Resolve the active Steam user and
  separate that account's profile. Configure/test Cloud only after that boundary
  is in place. Current paths are `%APPDATA%/BonkClub/saves/preferences.json` on
  Windows and `${XDG_CONFIG_HOME:-~/.config}/BonkClub/saves/preferences.json` on
  Linux. These are local saves, not an enabled Cloud feature. Keep `window.json`,
  Chromium storage, connection state and recovery copies out of Cloud. Test
  Windows-to-Linux transfer, two local Steam accounts and conflict recovery.
  [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- **Steam networking decision.** Recommended desktop direction: Steam lobbies
  plus Steam Networking/SDR, preserving the host simulation and bounded snapshot
  channel. Browser interoperability would still require the existing WebRTC path
  or a deliberately designed bridge. Steam does not automatically relay existing
  PeerJS traffic. If shared WebRTC remains the launch transport, move its public
  service to separately operated infrastructure and measure relay capacity and
  costs before accepting paying users. No new hosting bill is authorised by this
  document. [Steam Networking](https://partner.steamgames.com/doc/features/multiplayer/networking)
- **Achievements** are optional, lower priority than reliable joining and good
  controls. Design real gameplay achievements, persist/account-scope events and
  test unlocks before adding store feature flags.

## Commercial launch acceptance gates

| Gate | Required evidence before release | Present status |
| --- | --- | --- |
| Windows distribution | Clean install under standard user, Steam install/update/uninstall, signature/reputation decision, executable smoke | CI archive built and all 74 file hashes verified; runtime smoke passes; packaged EXE launch was blocked by automatic approval review; Steam installation untested |
| Linux distribution | Native package smoke, actual Linux desktop, Steam Linux Runtime compatibility, clean permissions and sandbox | Linux CI runtime smoke and packaging pass; all 73 file hashes and archive executable permissions verified; packaged Steam runtime and physical desktop validation pending |
| Steam Deck | Real device at 1280×800/720, all menus/gameplay with controls alone, text entry, suspend/resume/reconnect, audio and readable HUD | No hardware test; do not claim Verified or full controller support yet |
| Performance | Host and guests measured separately; frame-time percentiles, input feel, network bandwidth and 60-minute four-player soak across arenas and extreme effects | Existing regressions are useful, but not retail hardware certification |
| Networking | Two accounts on separate ISPs; direct and selected relay routes, hot join, packet loss/jitter, host loss, full/version-mismatch rooms and service outage recovery | Desktop host, browser guest and hot join pass through selected public TURN relay candidates on one QA machine; broader launch test matrix pending |
| Operations | Owned durable endpoint, certificate renewal, service uptime/alerting, relay load/bandwidth budget, abuse limits, backups and rollback runbook | Current Pi service retained; household services unchanged |
| Controls/accessibility | Physical Xbox/PlayStation/Deck controllers, disconnect/reconnect, remapping plan, reduced motion, colour/readability and keyboard-only flow | Standard mapping and menu support implemented; device QA pending |
| Rights/content | Ownership/licences for every asset and library, content survey, age ratings, appropriate support/privacy wording | Bundled notices generated; publisher sign-off pending |
| Store | Accurate copy, supported language list, measured minimum specs, screenshots/trailer/capsules, support contact and price | Draft brief in STEAM-STORE.md; public listing not created |
| Release | Matching depots, private Steam branch, Valve approvals, Coming Soon and waiting periods satisfied | Blocked on Steamworks onboarding |

Steam Deck compatibility is determined through Valve's process. A Linux build or
desktop screenshot is insufficient evidence of handheld compatibility.
[Compatibility review](https://partner.steamgames.com/doc/steamhardware/compat)

## Shipping order

Finish account setup while testing the desktop builds. Next, integrate and test
Steam identity/invites and account saves on a private branch, resolve multiplayer
service ownership, and test the actual Deck. Then create accurate store assets
from the verified build, publish Coming Soon, run a private playtest, and submit
the final build for review. Publish only when the acceptance gates above have
evidence. Keep the current browser release available throughout.
