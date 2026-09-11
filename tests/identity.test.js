import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS } from "../src/engine.js";
import {
  cleanProfile,
  validProfile,
  PALETTE,
  HAIRSTYLES,
  HAIR_COLOURS,
  FACIAL_HAIR,
  ACCESSORIES,
  defaultProfile,
  availableProfile,
  randomProfile,
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
    { ...defaultProfile(), name: "Sam Smith", color: PALETTE[5].value, hair: "Mohawk" },
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

test("old saved profiles gain cosmetic defaults without losing existing choices", () => {
  const old = {name: "Sam", color: "#ff7393", hair: "Ponytail"};
  const profile = cleanProfile(old, old);
  assert.deepEqual(profile, {...defaultProfile(), ...old});
  assert.ok(validProfile(profile));
  assert.ok(validProfile(cleanProfile(null, {name: "Player", color: "#55baff", hair: "None"})));
});

test("new appearance choices survive edits, death, round reset and wire validation", () => {
  const w = new World({players: [0]});
  const look = {...defaultProfile(), name: "Sam", color: PALETTE.at(-1).value,
    hair: "Space buns", hairColor: HAIR_COLOURS[9].value, facialHair: "Full beard", accessory: "Goggles"};
  w.setProfiles([{id: 0, ...look}]);
  w.scores[0] = 12;
  w.players[0].hp = 37;
  w.players[0].weapon = "railgun";
  for (const [field, choices] of Object.entries({hair: HAIRSTYLES, hairColor: HAIR_COLOURS.map(c => c.value), facialHair: FACIAL_HAIR, accessory: ACCESSORIES, color: PALETTE.map(c => c.value)})) {
    for (const choice of choices) {
      w.setProfiles([{id: 0, ...look, [field]: choice}]);
      assert.equal(w.players[0][field], choice);
      assert.equal(w.players[0].hp, 37);
      assert.equal(w.players[0].weapon, "railgun");
      assert.equal(w.scores[0], 12);
      assert.ok(validSnapshot(w.snapshot()), `${field}: ${choice}`);
    }
  }
  w.setProfiles([{id: 0, ...look}]);
  w.step(1 / 120);
  w.kill(w.players[0]);
  for (const key of ["color", "hair", "hairColor", "facialHair", "accessory"]) assert.equal(w.ragdolls[0][key], look[key]);
  assert.ok(validSnapshot(w.snapshot()));
  w.startRound();
  assert.equal(w.ragdolls.length, 0);
  assert.deepEqual(cleanProfile(w.players[0]), look);
  assert.equal(w.scores[0], 12);
});

test("malformed cosmetic metadata is cleaned locally and rejected on the wire, including bodies", () => {
  const profile = {...defaultProfile(), hairColor: HAIR_COLOURS[5].value, accessory: "Glasses"};
  for (const field of ["hair", "hairColor", "facialHair", "accessory"]) {
    for (const invalid of ["url(secret)", "x".repeat(10000), {}, [], null, 7, undefined]) {
      assert.equal(cleanProfile({...profile, [field]: invalid}, profile)[field], profile[field]);
      assert.equal(validProfile({...profile, [field]: invalid}), false);
      const w = new World();
      w.players[0][field] = invalid;
      assert.equal(validSnapshot(w.snapshot()), false);
      w.players[0][field] = profile[field];
      w.kill(w.players[0]);
      w.ragdolls[0][field] = invalid;
      assert.equal(validSnapshot(w.snapshot()), false);
    }
  }
});

test("random appearance preserves the name and avoids reserved colours; conflicts retain cosmetics", () => {
  const others = PALETTE.slice(0,-1).map(c => ({color: c.value}));
  for (const random of [() => 0, () => .5, () => .999999]) {
    const p = randomProfile({...defaultProfile(), name: "Sam"}, others, random);
    assert.ok(validProfile(p));
    assert.equal(p.name, "Sam");
    assert.equal(p.color, PALETTE.at(-1).value);
  }
  const profile = {...defaultProfile(), hair: "Braids", hairColor: HAIR_COLOURS[5].value, accessory: "Headband", facialHair: "Goatee"};
  const assigned = availableProfile(profile, [defaultProfile()]);
  assert.notEqual(assigned.color, profile.color);
  assert.deepEqual({...assigned, color: profile.color}, profile);
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
  assert.match(w.players[1].name, / \(BOT\)$/);
  assert.ok(validProfile(w.players[1]));
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
  const featured = Object.entries(WEAPONS).filter(([type,w]) => type !== "nuke" && ["rare", "exotic"].includes(w.rarity)).length;
  // Two featured slots per round, with one reserved for a nuke every third round.
  for (let round = 1; round <= Math.ceil(featured * 3 / 5); round++) {
    const opening = rotation.opening(round);
    opening.forEach((w) => seen.add(w));
    if (round % 3 === 1) assert.equal(opening[0], "nuke");
    assert.notEqual(opening[0], opening[1]);
  }
  for (const [type, w] of Object.entries(WEAPONS))
    if (["rare", "exotic"].includes(w.rarity)) assert.ok(seen.has(type), type);
});
