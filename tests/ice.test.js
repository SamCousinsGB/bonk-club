import test from "node:test";
import assert from "node:assert/strict";
import { loadIceConfig, hasRelay, connectionFailure } from "../src/ice.js";

const endpoint = "https://relay.example/ice";
const relay = {
  urls: ["turn:relay.example:3478", "turns:relay.example:443?transport=tcp"],
  username: "test-only-user",
  credential: "test-only-credential",
};

test("a join timeout distinguishes an open data channel from an ICE route that connected", () => {
  assert.match(
    connectionFailure({}, { open: true }),
    /room response did not arrive/,
  );
  for (const iceConnectionState of ["connected", "completed"])
    assert.match(
      connectionFailure({}, { peerConnection: { iceConnectionState } }),
      /game data channel did not open/,
    );
  assert.match(
    connectionFailure(
      {},
      { peerConnection: { iceConnectionState: "checking" } },
    ),
    /cause is not yet known/,
  );
});

test("without a relay endpoint, direct connections remain available and failures identify the missing service", async () => {
  const config = await loadIceConfig("", () => assert.fail("no fetch needed"));
  assert.equal(hasRelay(config), false);
  assert.ok(
    config.iceServers.every((server) => server.urls.startsWith("stun:")),
  );
  assert.match(connectionFailure(config), /cause is not yet known/);
});

test("provider credentials reach the browser configuration with UDP and TLS/TCP fallbacks", async () => {
  for (const body of [[relay], { iceServers: [relay] }]) {
    const config = await loadIceConfig(endpoint, async (url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options.cache, "no-store");
      assert.equal(options.credentials, "omit");
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: true, json: async () => body };
    });
    assert.equal(hasRelay(config), true);
    assert.deepEqual(config.iceServers.at(-1), relay);
    assert.match(connectionFailure(config), /A relay is configured/);
  }
});

test("invalid or unauthenticated relay responses do not silently degrade to direct-only networking", async () => {
  for (const body of [
    null,
    [],
    [{ urls: "stun:stun.example:3478" }],
    [{ urls: "turn:relay.example:443" }],
    [{ ...relay, urls: "https://relay.example" }],
    Array.from({ length: 17 }, () => relay),
  ]) {
    await assert.rejects(
      loadIceConfig(endpoint, async () => ({
        ok: true,
        json: async () => body,
      })),
      /relay service is unavailable/,
    );
  }
});

test("provider outages and response errors give a safe retry message without exposing credentials", async () => {
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => {
      throw new Error("private-provider-detail");
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("private-provider-detail");
      },
    }),
  ]) {
    await assert.rejects(
      loadIceConfig(endpoint, fetcher),
      (error) =>
        error.message ===
        "The game's relay service is unavailable. Try again shortly.",
    );
  }
});

test("relay endpoints require HTTPS and reject account-secret query parameters before fetching", async () => {
  for (const url of [
    "http://relay.example/ice",
    "https://user:password@relay.example/ice",
    "https://relay.example/ice?secretKey=not-a-real-secret",
  ])
    await assert.rejects(
      loadIceConfig(url, () => assert.fail("must not fetch")),
      /relay service is unavailable/,
    );
});
