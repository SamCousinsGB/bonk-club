import test from "node:test";
import assert from "node:assert/strict";
import { RoomPresence } from "../src/room-presence.js";
import { Sound } from "../src/audio.js";

const host = { id: 0, name: "Sam" };
const guest = { id: 1, name: "Alex" };

test("initial rosters are silent, then hosts and guests see each new human once", () => {
  for (const id of [0, 1]) {
    const presence = new RoomPresence(), room = { id };
    const roster = [host, guest];
    assert.deepEqual(presence.update(room, roster), []);
    // Hosts append to the existing array before publishing it.
    roster.push({ id: 2, name: "Taylor" });
    assert.deepEqual(presence.update(room, roster), [{ type: "join", name: "Taylor" }]);
    assert.deepEqual(presence.update(room, roster), []);
  }
});

test("profile edits are silent and departures use the latest name", () => {
  const presence = new RoomPresence(), room = { id: 0 };
  const roster = [{ ...host }, { ...guest }];
  presence.update(room, roster);
  roster[1].name = "New name";
  roster[1].color = "#ffffff";
  assert.deepEqual(presence.update(room, roster), []);
  assert.deepEqual(presence.update(room, [host]), [{ type: "leave", name: "New name" }]);
  assert.deepEqual(presence.update(room, [host]), []);
  assert.deepEqual(presence.update(room, [host, guest]), [{ type: "join", name: "Alex" }]);
});

test("room changes, resets and own departure do not announce existing occupants", () => {
  const presence = new RoomPresence(), first = { id: 1 }, second = { id: 1 };
  presence.update(first, [host, guest]);
  assert.deepEqual(presence.update(first, [host]), []);
  assert.deepEqual(presence.update(second, [host, guest, { id: 2, name: "Taylor" }]), []);
  presence.reset();
  assert.deepEqual(presence.update(second, [host, guest]), []);
});

test("several departures and joins are reported independently without profile false positives", () => {
  const presence = new RoomPresence(), room = { id: 0 };
  presence.update(room, [host, guest, { id: 2, name: "Taylor" }]);
  assert.deepEqual(presence.update(room, [host, { id: 3, name: "Morgan" }]), [
    { type: "leave", name: "Alex" },
    { type: "leave", name: "Taylor" },
    { type: "join", name: "Morgan" },
  ]);
});

function soundFixture() {
  const sound = new Sound(), tones = [];
  sound.context = { state: "running", currentTime: 10 };
  sound.master = {};
  sound.tone = (...args) => tones.push(args);
  return { sound, tones };
}

test("arrival chimes rise and departure chimes fall within half a second", () => {
  for (const type of ["player-join", "player-leave"]) {
    const { sound, tones } = soundFixture();
    sound.active = 32; // Remain audible during ordinary combat voice saturation.
    sound.play(type);
    assert.equal(tones.length, 2);
    assert.equal(tones[0][0] < tones[1][0], type === "player-join");
    assert.ok(tones[1][5] > 0);
    assert.ok(tones[1][5] + tones[1][2] < 0.5);
  }
});

test("presence audio respects mute, browser suspension and voice limits without noisy bursts", () => {
  const { sound, tones } = soundFixture();
  sound.muted = true;
  sound.play("player-join");
  sound.muted = false;
  sound.context.state = "suspended";
  sound.play("player-join");
  sound.context.state = "running";
  sound.active = 45;
  sound.play("player-join");
  assert.equal(tones.length, 0);
  sound.active = 0;
  sound.play("player-join");
  sound.play("player-join");
  assert.equal(tones.length, 2);
  sound.play("player-leave");
  assert.equal(tones.length, 4, "a quick departure still gets its distinct negative cue");
  sound.context.currentTime += 0.5;
  sound.play("player-leave");
  assert.equal(tones.length, 6);
});
