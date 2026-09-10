import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine.js";
import { cleanProfile, defaultProfile, randomBotProfile, validProfile } from "../src/identity.js";
import { validSnapshot } from "../src/network.js";
import { defaultSlots } from "../src/slots.js";

const profiles = world => world.players.map(clean => cleanProfile(clean));
const seededRandom = () => {
  let state = 2718;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
};

test("bot names carry the suffix and every appearance field varies within supported choices", () => {
  const random = seededRandom(), generated = [];
  for (let i = 0; i < 100; i++) {
    const p = randomBotProfile([], random);
    assert.match(p.name, /^[A-Za-z]+ \(BOT\)$/);
    assert.ok(validProfile(p));
    generated.push(p);
  }
  for (const key of Object.keys(defaultProfile()))
    assert.ok(new Set(generated.map(p => p[key])).size > 1, key);
  const others = [defaultProfile()];
  for (let i = 0; i < 4; i++) {
    const p = randomBotProfile(others, () => 0);
    assert.ok(!others.some(other => other.name === p.name || other.color === p.color));
    others.push(p);
  }
});

test("solo bots have unique names and colours at creation, then keep identities and scores across rounds", () => {
  const w = new World({ players: [0], random: seededRandom() });
  const initial = profiles(w);
  assert.equal(new Set(initial.map(p => p.name)).size, 4);
  assert.equal(new Set(initial.map(p => p.color)).size, 4);
  w.players.filter(p => p.bot).forEach(p => assert.match(p.name, / \(BOT\)$/));
  w.scores = [3, 7, 2, 5];
  w.startRound();
  assert.deepEqual(profiles(w), initial);
  assert.deepEqual(w.scores, [3, 7, 2, 5]);
  assert.ok(validSnapshot(w.snapshot()));
});

test("profile refreshes preserve bot cosmetics and only move a colour that a human claims", () => {
  const w = new World({ players: [0], random: seededRandom() });
  const before = profiles(w), host = { id: 0, ...defaultProfile(), name: "Host" };
  w.setProfiles([host]);
  w.setProfiles([host]);
  assert.deepEqual(profiles(w).slice(1), before.slice(1));
  w.setProfiles([{ ...host, color: before[1].color }]);
  const after = profiles(w);
  assert.notEqual(after[1].color, before[1].color);
  assert.deepEqual({ ...after[1], color: before[1].color }, before[1]);
  assert.deepEqual(after.slice(2), before.slice(2));
  assert.equal(new Set(after.map(p => p.color)).size, 4);
});

test("hot join, departure and reopening slots create bot identities only for the new occupant", () => {
  const w = new World({ players: [0], random: seededRandom() });
  const host = { id: 0, ...defaultProfile(), name: "Host" };
  w.setProfiles([host]);
  const original = profiles(w);
  w.scores = [4, 2, 8, 3];
  w.phase = "fight";
  w.platforms[0].hp = 0;
  const terrain = w.platforms;
  const guest = { id: 1, ...defaultProfile(1), name: "Guest" };
  w.syncSlots(defaultSlots(), [host, guest]);
  assert.equal(w.players[1].name, "Guest");
  assert.deepEqual(profiles(w).slice(2), original.slice(2));
  assert.deepEqual(w.scores, [4, 0, 8, 3]);
  w.syncSlots(defaultSlots(), [host]);
  assert.match(w.players[1].name, / \(BOT\)$/);
  const replacement = cleanProfile(w.players[1]);
  assert.notDeepEqual(replacement, original[1]);
  assert.deepEqual(profiles(w).slice(2), original.slice(2));
  w.syncSlots(defaultSlots(), [host]);
  assert.deepEqual(cleanProfile(w.players[1]), replacement);
  w.syncSlots(["player", "closed", "mixed", "mixed"], [host]);
  w.syncSlots(defaultSlots(), [host]);
  assert.match(w.players[1].name, / \(BOT\)$/);
  assert.equal(w.platforms, terrain);
  assert.equal(w.platforms[0].hp, 0);
  assert.equal(new Set(w.players.map(p => p.name)).size, 4);
  assert.equal(new Set(w.players.map(p => p.color)).size, 4);
  const wire = JSON.parse(JSON.stringify(w.snapshot()));
  assert.ok(validSnapshot(wire));
  assert.deepEqual(wire.players.map(p => cleanProfile(p)), profiles(w));
});

test("bot death bodies retain the randomly assigned appearance", () => {
  const w = new World({ players: [0], random: seededRandom() });
  const bot = w.players[1], before = cleanProfile(bot);
  w.step(1 / 120);
  w.kill(bot);
  for (const key of ["color", "hair", "hairColor", "facialHair", "accessory"])
    assert.equal(w.ragdolls[0][key], before[key]);
  assert.ok(validSnapshot(w.snapshot()));
  w.startRound();
  assert.deepEqual(cleanProfile(w.players[1]), before);
});
