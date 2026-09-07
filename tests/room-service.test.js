import test from "node:test";
import assert from "node:assert/strict";
import { roomServiceOptions } from "../src/room-service.js";

test("a configured room service uses secure signaling and preserves its path", () => {
  assert.deepEqual(roomServiceOptions("https://rooms.example/peerjs/"), {
    host: "rooms.example",
    port: 443,
    path: "/peerjs",
    secure: true,
  });
  assert.equal(
    roomServiceOptions("https://rooms.example:8443/peerjs").port,
    8443,
  );
  assert.deepEqual(roomServiceOptions(), {});
  for (const endpoint of [
    "http://rooms.example",
    "https://user:password@rooms.example",
    "https://rooms.example?token=x",
    "https://rooms.example#path",
  ])
    assert.throws(() => roomServiceOptions(endpoint));
});
