import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { fork } from "node:child_process";
import { createHmac } from "node:crypto";
import WebSocket from "ws";
import { credentials, rateLimiter, validateConfig } from "../app.js";
const config = {
  hostname: "rooms.example",
  origins: ["https://game.example"],
  turnSecret: "a".repeat(64),
};

test("relay credentials expire, are unique, and match coturn REST authentication", () => {
  const result = credentials(config, 1000000);
  const turn = result.iceServers[1];
  assert.equal(result.expiresAt, 4600);
  assert.equal(turn.username.split(":")[0], "4600");
  assert.equal(
    turn.credential,
    createHmac("sha1", config.turnSecret)
      .update(turn.username)
      .digest("base64"),
  );
  assert.notEqual(
    turn.username,
    credentials(config, 1000000).iceServers[1].username,
  );
  assert.equal(JSON.stringify(result).includes(config.turnSecret), false);
  assert.equal(turn.urls.length, 3);
  assert.throws(() => validateConfig({ ...config, turnSecret: "" }));
});

test("rate limits bound per-client traffic and memory, then recover", () => {
  let now = 0;
  const allow = rateLimiter({
    limit: 2,
    windowMs: 100,
    maxEntries: 2,
    clock: () => now,
  });
  assert.equal(allow("a"), true);
  assert.equal(allow("a"), true);
  assert.equal(allow("a"), false);
  assert.equal(allow("b"), true);
  assert.equal(allow("c"), false);
  now = 101;
  assert.equal(allow("c"), true);
  assert.equal(allow("a"), true);
});

test("real room service exchanges offers, answers and candidates without handling game state", async (t) => {
  const child = fork(new URL("./fixture.js", import.meta.url), {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  t.after(() => child.kill());
  const [port] = await once(child, "message");
  const base = `http://127.0.0.1:${port}`;
  const headers = { Origin: "https://game.example" };
  assert.deepEqual(await (await fetch(base + "/healthz")).json(), {
    status: "ok",
    revision: "test-revision",
  });
  assert.equal((await fetch(base + "/ice")).status, 403);
  assert.equal(
    (
      await fetch(base + "/ice", {
        headers: { Origin: "https://other.example" },
      })
    ).status,
    403,
  );
  const ice = await fetch(base + "/ice", { headers });
  assert.equal(ice.headers.get("cache-control"), "no-store");
  assert.equal(ice.headers.get("access-control-allow-origin"), headers.Origin);
  assert.equal((await ice.json()).iceServers.length, 2);
  assert.equal(
    (await fetch(base + "/peerjs/peerjs/peers", { headers })).status,
    401,
  );
  const connect = async (id) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/peerjs/peerjs?key=peerjs&id=${id}&token=test`,
      { headers },
    );
    t.after(() => ws.terminate());
    const [message] = await once(ws, "message");
    assert.equal(JSON.parse(message).type, "OPEN");
    return ws;
  };
  const host = await connect("bonkclub-v9-ABC234"),
    guest = await connect("guest-test");
  for (const [from, to, dst, type] of [
    [guest, host, "bonkclub-v9-ABC234", "OFFER"],
    [host, guest, "guest-test", "ANSWER"],
    [guest, host, "bonkclub-v9-ABC234", "CANDIDATE"],
  ]) {
    const incoming = once(to, "message");
    from.send(
      JSON.stringify({
        type,
        dst,
        payload: { connectionId: "test", type: "data", value: type },
      }),
    );
    assert.equal(JSON.parse((await incoming)[0]).payload.value, type);
  }
  const denied = new WebSocket(
    `ws://127.0.0.1:${port}/peerjs/peerjs?key=peerjs&id=bad&token=test`,
    { origin: "https://other.example" },
  );
  assert.match(String((await once(denied, "error"))[0]), /401/);
});
