import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS } from "../src/engine.js";
import {
  cleanProfile,
  validProfile,
  PALETTE,
  HAIRSTYLES,
} from "../src/identity.js";
import { validSnapshot } from "../src/network.js";
import { WEAPONS, WeaponRotation } from "../src/arsenal.js";

test("player names and appearance are bounded and accept only supported choices", () => {
  assert.deepEqual(
    cleanProfile({
      name: "  Sam\n  Smith  ",
      color: PALETTE[5].value,
      hair: "Mohawk",
    }),
    { name: "Sam Smith", color: PALETTE[5].value, hair: "Mohawk" },
  );
  assert.equal(
    Array.from(cleanProfile({ name: "😀".repeat(50) }).name).length,
    20,
  );
  assert.equal(cleanProfile({ name: "\u202eFriend" }).name, "Friend");
  assert.equal(
    validProfile({ name: "Friend", color: "url(secret)", hair: "None" }),
    false,
  );
  assert.equal(
    validProfile({ name: "Friend", color: PALETTE[0].value, hair: "unknown" }),
    false,
  );
});

test("character edits preserve combat state and scores and persist into the next round", () => {
  const w = new World({ players: [0] });
  w.scores[0] = 9;
  w.players[0].hp = 37;
  w.players[0].weapon = "railgun";
  w.setProfiles([
    { id: 0, name: "Sam", color: PALETTE[1].value, hair: "Ponytail" },
  ]);
  assert.equal(w.players[0].hp, 37);
  assert.equal(w.scores[0], 9);
  assert.equal(w.players[0].weapon, "railgun");
  assert.equal(new Set(w.players.map((p) => p.color)).size, 4);
  w.startRound();
  assert.equal(w.players[0].name, "Sam");
  assert.equal(w.players[0].hair, "Ponytail");
  assert.equal(w.scores[0], 9);
  assert.ok(validSnapshot(w.snapshot()));
});

test("a departing human leaves a normal AI identity and knockouts retain hair and colour", () => {
  const w = new World({ players: [0] });
  w.replacePlayer(1, false);
  w.setProfiles([
    { id: 0, name: "Sam", color: PALETTE[0].value, hair: "None" },
    { id: 1, name: "Friend", color: PALETTE[5].value, hair: "Afro" },
  ]);
  w.step(1 / 120);
  w.kill(w.players[1]);
  assert.equal(w.ragdolls[0].hair, "Afro");
  assert.equal(w.ragdolls[0].color, PALETTE[5].value);
  w.replacePlayer(1, true);
  w.setProfiles([
    { id: 0, name: "Sam", color: PALETTE[0].value, hair: "None" },
  ]);
  assert.notEqual(w.players[1].name, "Friend");
  assert.equal(w.players[1].hair, "None");
});

test("all hairstyles survive the wire snapshot and unsupported player metadata is rejected", () => {
  const w = new World();
  for (const hair of HAIRSTYLES) {
    w.players[0].hair = hair;
    assert.ok(validSnapshot(w.snapshot()));
  }
  w.players[0].name = "x".repeat(100);
  assert.equal(validSnapshot(w.snapshot()), false);
});

test("every arena opens with a nuke and another unusual weapon on the first round", () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    const w = new World({ arena, random: () => 0.3 });
    assert.equal(w.drops[0]?.type, "nuke", ARENAS[arena].name);
    assert.ok(["rare", "exotic"].includes(WEAPONS[w.drops[1]?.type]?.rarity));
  }
});

test("short rounds rotate the rare arsenal instead of resetting weapon variety", () => {
  const rotation = new WeaponRotation(() => 0.45),
    seen = new Set();
  for (let round = 1; round <= 9; round++) {
    const opening = rotation.opening(round);
    opening.forEach((w) => seen.add(w));
    if (round % 3 === 1) assert.equal(opening[0], "nuke");
    assert.notEqual(opening[0], opening[1]);
  }
  for (const [type, w] of Object.entries(WEAPONS))
    if (["rare", "exotic"].includes(w.rarity)) assert.ok(seen.has(type), type);
});
