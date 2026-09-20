# Netcode and performance verification

The host owns simulation, damage, inventory, destruction and scores. Guests
predict their own movement and attack presentation, reconcile applied controls,
and interpolate other actors. Browser discovery/transport is WebRTC; the shared
room protocol is also the boundary for the future Steam adapter. See
[`PLATFORMS.md`](PLATFORMS.md) for the unimplemented Steam/account work.

## v0.46.1 changes

- Motion and world state have independent encoding jobs **and workers**. A
  blocked world encode/reconstruction cannot occupy the actor worker. Each lane
  allows one host generation at a time; guests keep only the active decode and
  the newest replacement. No backlog of old simulation snapshots is replayed.
- Recipients sharing a baseline share both the delta tree walk and compression.
  The two bounded streams captured in one tick can share a channel enqueue
  opportunity. Later generations wait for queue clearance, and pressure is
  checked again after asynchronous encoding.
- Codec requests have a one-second deadline. Invalid results and overload are
  rejected rather than retried on the render thread. A crashed/stalled worker is
  terminated and recreated for the next frame. Room closure cancels work and
  decoders. Environments without worker support retain the bounded local codec.
  A blocked browser event loop can delay any JavaScript deadline; this is not a
  hard realtime guarantee.
- Reliable controls remain accepted during asymmetric channel failure. One
  shared sequence check rejects duplicates/reordered inputs on both paths.
- A repeated tap that still needs a release tick is not acknowledged before its
  press reaches simulation. Hitstop still defers consumption. Guests cannot
  provide positions, health or other authoritative state through controls.
- Prediction reuses collision strips within each immutable world snapshot.
  Moving platforms retain live references; removed falling wings invalidate the
  cache. New world state and render lookahead get independent caches. Exact cached/uncached movement and pose comparisons
  cover every arena, moving supports and destroyed terrain.
- Remote knockdown/freeze/transformation transitions use their authoritative pose
  immediately. The warp shader skips inactive sources without changing its
  geometry, amplitude, reduced-motion behaviour or physics.

The wire shape remains protocol **69**. World and motion histories are separate,
retain at most 32 snapshots, and deltas use only acknowledged baselines. Missing
baselines request a full state. Compressed frames are limited to 250 KB and
decompression to 1 MB. Each stream assembler retains at most two partial frames.
Existing per-recipient pacing is 60 KB/s for world state and 28 KB/s for actors;
these are application budgets, not a claim about available network bandwidth.

## Reproduce the checks

- `npm test`: protocol, validation, delta recovery, worker faults, stalled world
  compression, asymmetric fallback, queue bounds, prediction and gameplay.
- `npm run test:stress`: all arena combat simulations.
- `npm run benchmark:netcode`: alternating cached/uncached replay against
  identical snapshots. Every pair must produce exactly the same fighter state.
  Report timings; do not make machine-dependent timings a flaky CI assertion.
- After installing `desktop/` dependencies, run
  `node desktop/tests/netcode-browser.mjs` with the repository-configured public
  `VITE_ROOM_SERVICE_URL` and `VITE_TURN_CREDENTIALS_URL`. It starts and closes its
  own source server. `BONK_QA_ROOT` selects a baseline checkout;
  `BONK_QA_LABEL` names outputs in ignored `desktop/test-results/`.
- The source harness uses four isolated browser contexts and real relay/relay
  routes. It exercises guest controls, settled destroyed-terrain IDs on hot join,
  reset, 10% packet loss, 45–69 ms added one-way delay, periodic extra delay,
  duplication/reordering, a 1.2-second guest stall and 4x guest CPU throttling.
- `node desktop/tests/browser-online.mjs` checks the production bundle through
  real TURN, including readiness, options, controls, hot join and host departure.
  Add `--public` after Pages deployment to check the published assets.

## Measurements on 20 September 2026

Edge, 1280 x 720, one Windows QA machine, source builds, three remote guests.
Baseline: v0.44.0 (`b614d61`). These samples are local CPU/render/delivery
measurements, **not** cross-ISP latency or hardware certification. Short samples
vary with operating-system scheduling, rendering and actual relay conditions.
The comparison was recorded before integrating the parallel v0.45.0 aircraft
release; none of the measured scenarios uses the aircraft arena.

| Measurement (95th percentile) | v0.44.0 | v0.46.1 |
| --- | ---: | ---: |
| Guest reconciliation, two black holes | 3.0 ms | 1.8 ms |
| Guest reconciliation, impaired link and 4x CPU throttle | 26.7 ms | 14.8 ms |
| Guest frame interval, impaired link and 4x CPU throttle | 48.7 ms | 34.8 ms |
| Guest frame interval, two black holes, one rendered viewport | 14.0 ms | 14.0 ms |
| Guest update gap, ordinary Platforms | 40.9 ms | 39.7 ms |
| Guest update gap, impaired link | 63.2 ms | 83.5 ms |

The impaired-link sample's maximum update gap was 103.3 ms after the changes;
there were no reversed authoritative updates or page errors. Delivery timing
did not improve in every sample. The CPU benchmark with 96 physical props
reduced median replay time from 2.87 to 2.53 ms (about 12%) while matching every
fighter field in 160 comparisons. Ordinary and heavy fixtures together perform
320 exact replay comparisons.

Rendering four simultaneous two-black-hole arenas on the same GPU produced a
55.6 ms frame interval at p95 in both builds. With the other three renderers
disabled but their simulation/networking continuing, the measured guest was
14.0 ms. This distinguishes shared-GPU test saturation from network delivery.
The source harness's cold-start and deliberate-stall maxima are recorded
separately from each scenario's timing window.

## Remaining qualification

This release fixes demonstrated faults and adds repeatable regression coverage;
it does not establish a "perfect" or industry-leading comparison. Before a Steam
release, run sustained four-player sessions on separate ISPs, target Windows and
Linux hardware, high latency/loss, bandwidth contention and suspend/reconnect.
Prove the actual native Steam lobby/transport adapter and its queue diagnostics.
Host migration and competitive hit-rewind policy are separate unimplemented
features, not capabilities supplied automatically by matchmaking or relay.

Transport references: [W3C RTCDataChannel](https://www.w3.org/TR/webrtc/#rtcdatachannel)
defines ordered delivery, retransmission and buffering behaviour;
[Valve networking](https://partner.steamgames.com/doc/features/multiplayer/networking)
describes the modern Steam networking APIs. Neither replaces client prediction,
bounded work, simulation performance or real player-network testing.
