import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine.js";
import { DeathCues, DEATH_CUE_DURATION } from "../src/death-cue.js";
import { Sound } from "../src/audio.js";
import { Renderer } from "../src/renderer.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { validSnapshot } from "../src/network.js";

function fixture() {
  const world = new World({ players: [0, 1, 2, 3], shuffle: false, random: () => 0.4 });
  world.time = 10;
  return world;
}

test("every death gets one timed skull, including ash and all weapon effects", () => {
  for (const effect of [null, "slice", "gib", "plasma", "phaser", "tesla", "ice", "burn", "blast", "singularity"]) {
    const world = fixture(), cues = new DeathCues();
    world.kill(world.players[0], { effect, ash: !effect || ["plasma", "phaser", "tesla", "burn"].includes(effect) });
    world.kill(world.players[0]);
    const [cue] = cues.update(world.snapshot());
    assert.equal(cues.items.length, 1, effect);
    assert.equal(cue.age, 0);
    assert.equal(cue.id, world.ragdolls[0].deathId);
    assert.equal(cue.color, world.players[0].color);
    assert.equal(cues.update(world.snapshot()).length, 1, "duplicate snapshots cannot duplicate a skull");
  }
});

test("skulls follow their own moving corpse and expire on simulation time", () => {
  const world = fixture(), cues = new DeathCues();
  world.kill(world.players[0]); world.kill(world.players[1]);
  const before = cues.update(world.snapshot());
  world.ragdolls[0].points.forEach(p => { p.x += 170; p.y += 40; });
  world.time += 0.5;
  const after = cues.update(world.snapshot());
  assert.equal(after[0].x, before[0].x + 170);
  assert.equal(after[0].y, before[0].y + 40);
  assert.equal(after[1].x, before[1].x);
  assert.equal(after[0].age, 0.5);
  world.time += DEATH_CUE_DURATION;
  assert.equal(cues.update(world.snapshot()).length, 0);
  assert.equal(cues.update(world.snapshot()).length, 0);
});

test("consumed bodies still show the cue and retained events cannot replay it on hot join", () => {
  const world = fixture(), cues = new DeathCues();
  world.kill(world.players[0], { effect: "singularity" });
  world.ragdolls = [];
  assert.equal(cues.update(world.snapshot()).length, 1);
  world.time += 0.6;
  assert.ok(Math.abs(new DeathCues().update(world.snapshot())[0].age - 0.6) < 1e-10);
  world.time += 2;
  assert.equal(new DeathCues().update(world.snapshot()).length, 0);
});

test("cue survives event queue churn but resets with rounds, rooms and null scenes", () => {
  const world = fixture(), cues = new DeathCues();
  world.kill(world.players[0]);
  cues.update(world.snapshot());
  for (let i = 0; i < 50; i++) world.event("shoot", { x: 500, y: 500 });
  assert.equal(cues.update(world.snapshot()).length, 1);
  world.round++; world.startRound();
  assert.equal(cues.update(world.snapshot()).length, 0);
  world.kill(world.players[0]);
  assert.equal(cues.update(world.snapshot()).length, 1);
  assert.equal(cues.update(null).length, 0);
  const replacement = fixture();
  replacement.kill(replacement.players[0]);
  assert.equal(cues.update(replacement.snapshot()).length, 1);
});

test("simultaneous and replacement deaths keep at most four visible markers", () => {
  const world = fixture(), cues = new DeathCues();
  for (const player of world.players) world.kill(player);
  assert.equal(cues.update(world.snapshot()).length, 4);
  const oldId = cues.items[0].id;
  world.event("ko", { x: 1000, y: 1000, at: world.time });
  assert.equal(cues.update(world.snapshot()).length, 4);
  assert.ok(cues.items.every(cue => cue.id !== oldId));
});

test("transport and guest interpolation preserve body identity and cue age", () => {
  const world = fixture(), wire = new RenderSnapshots();
  world.kill(world.players[1]);
  const a = wire.make(world.snapshot());
  world.time += 0.5;
  world.ragdolls[0].points.forEach(p => { p.x += 100; });
  const b = wire.make(world.snapshot()), guest = interpolateStates(a, b, 0.5);
  assert.ok(validSnapshot(a)); assert.ok(validSnapshot(b));
  const [cue] = new DeathCues().update(guest);
  assert.equal(cue.age, 0.25);
  assert.equal(cue.x, (a.ragdolls[0].points[1].x + a.ragdolls[0].points[2].x) / 2 + 50);
  assert.equal(cue.id, a.events.find(e => e.type === "ko").id);
});

test("wire rejects invalid cue timestamps and corpse identities; older snapshots remain valid", () => {
  const world = fixture(); world.kill(world.players[0]);
  const snapshot = new RenderSnapshots().make(world.snapshot());
  for (const value of [-1, NaN, Infinity, "10", 10000001]) {
    const bad = structuredClone(snapshot); bad.ragdolls[0].deathId = value;
    assert.equal(validSnapshot(bad), false);
  }
  for (const value of [-1, NaN, Infinity, "10", 10000000]) {
    const bad = structuredClone(snapshot); bad.events.at(-1).at = value;
    assert.equal(validSnapshot(bad), false);
  }
  delete snapshot.ragdolls[0].deathId; delete snapshot.events.at(-1).at;
  assert.ok(validSnapshot(snapshot));
});

function soundFixture() {
  const sound = new Sound(), notes = [];
  sound.context = { state: "running", currentTime: 10 };
  sound.master = {};
  sound.tone = (...args) => { notes.push(args); sound.active++; };
  sound.rumble = () => { sound.active++; };
  return { sound, notes };
}

test("all death causes share a two-note cue, including under busy combat audio", () => {
  const baseline = soundFixture(); baseline.sound.play("ko");
  for (const effect of [null, "ice", "slice", "tesla", "plasma", "singularity", "burn", "phaser"]) {
    const { sound, notes } = soundFixture(); sound.active = 30;
    sound.play("ko", { effect });
    assert.deepEqual(notes.slice(0, baseline.notes.length), baseline.notes);
    assert.ok(sound.active <= 36);
  }
});

test("death audio respects mute and voice ceiling, and coalesces simultaneous deaths", () => {
  const { sound, notes } = soundFixture();
  sound.muted = true; sound.play("ko"); assert.equal(notes.length, 0);
  sound.muted = false; sound.active = 45; sound.play("ko"); assert.equal(notes.length, 0);
  sound.context.currentTime += 1; sound.active = 0;
  sound.play("ko"); const count = notes.length;
  sound.play("ko"); sound.play("ko"); assert.equal(notes.length, count);
  sound.context.currentTime += 0.2; sound.play("ko"); assert.equal(notes.length, count * 2);
});

test("renderer plays each death once and skips old death audio on late join", () => {
  const { sound, notes } = soundFixture();
  const renderer = { lastEvent: 0, particles: [], impacts: [], shake: 0 };
  const events = [{ id: 1, type: "ko", x: 400, y: 500, at: 8 }, { id: 2, type: "ko", x: 800, y: 500, at: 10 }];
  Renderer.prototype.events.call(renderer, events, sound, 10);
  const count = notes.length;
  assert.ok(count > 0);
  assert.equal(renderer.particles.length, 28, "only the fresh death produces particles");
  Renderer.prototype.events.call(renderer, events, sound, 10);
  assert.equal(notes.length, count);
});
