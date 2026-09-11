import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { RenderSnapshots, GuestFrames } from "../src/render-state.js";
import { GuestPrediction } from "../src/guest-prediction.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { prepareProp } from "../src/props.js";

function fixture() {
  const w = new World({ players: [0, 1], random: () => .5 });
  w.phase = "fight"; w.time = 1; w.cover = []; w.chunks = [];
  w.platforms = [{ ...w.platforms[0], id: "floor", x: 0, y: 500, w: 2560, h: 40, dx: 0, dy: 0 }];
  w.spikes = () => [];
  Object.assign(w.players[1], { x: 400, y: 470, vx: 0, vy: 0, ground: true,
    support: "floor", rig: null });
  const encoder = new RenderSnapshots(), prediction = new GuestPrediction();
  const snapshot = (ack = 0) => ({ ...encoder.make(w.snapshot()), inputAcks: [0, ack, 0, 0] });
  const s = snapshot(); prediction.receive(s, 1, 1000);
  return { w, snapshot, prediction, s };
}
const advance = (p, input, seq, now = 1000 + seq * 1000 / 60) => p.advance(cleanInput(input), seq, now);

test("prediction carries a fighter on a moving lift using the same support motion", () => {
  const { w, snapshot, prediction } = fixture();
  Object.assign(w.platforms[0], { baseX: 0, baseY: 500, travel: 100, speed: 1 });
  w.movePlatforms(); w.players[1].y = w.platforms[0].y - 30;
  w.time += 1 / 30; prediction.receive(snapshot(), 1, 1001);
  for (let i = 1; i <= 8; i++) {
    advance(prediction, {}, i);
    for (let tick = 0; tick < 2; tick++) { w.time += STEP; w.movePlatforms(); w.move(w.players[1], cleanInput({}), STEP); }
  }
  assert.ok(Math.abs(prediction.player.y - w.players[1].y) < .5);
  assert.equal(prediction.player.ground, true);
});

test("held prop artwork follows predicted movement without changing ownership or the received world", () => {
  const { w, snapshot, prediction } = fixture();
  w.cover = [prepareProp({ id: "held", kind: "crate", x: 425, y: 420, w: 40, h: 40, hp: 80, maxHp: 80 })];
  Object.assign(w.players[1], { carryId: "held", carryPoint: { x: 440, y: 440 } });
  w.time += 1 / 30; const s = snapshot(), saved = structuredClone(s); prediction.receive(s, 1, 1001);
  for (let seq = 1; seq <= 8; seq++) advance(prediction, { right: true, attack: true }, seq);
  const view = prediction.sample(s, 1140), dx = view.players[1].x - s.players[1].x;
  assert.ok(dx > 0); assert.ok(Math.abs(view.cover[0].x - s.cover[0].x - dx) < .001);
  assert.equal(view.players[1].carryId, "held"); assert.equal(view.players[1].swing, 0);
  assert.deepEqual(s, saved);
});

test("guest movement, jump and aim respond before a host round trip without changing received state", () => {
  const { s, prediction } = fixture(), saved = structuredClone(s);
  advance(prediction, { right: true, jump: true, aim: -.5 }, 1);
  const view = prediction.sample(s, 1017).players[1];
  assert.ok(view.x > 400); assert.ok(view.y < 465); assert.ok(view.vy < 0);
  assert.equal(view.aimAngle, -.5);
  assert.deepEqual(s, saved);
  assert.equal(view.hp, s.players[1].hp);
  assert.deepEqual(prediction.sample(s, 1017).scores, s.scores);
  assert.equal(prediction.sample(s, 1017).players[0], s.players[0]);
});

test("host corrections replay only unacknowledged input and preserve a held jump", () => {
  const { w, prediction, snapshot, s } = fixture();
  const input = cleanInput({ jump: true, right: true });
  for (let seq = 1; seq <= 6; seq++) advance(prediction, input, seq);
  for (let tick = 0; tick < 6; tick++) { w.time += STEP; w.move(w.players[1], input, STEP); }
  const updated = snapshot(3);
  prediction.receive(updated, 1, 1100);
  assert.deepEqual(prediction.pending.map(p => p.seq), [4, 5, 6]);
  for (let tick = 0; tick < 6; tick++) { w.time += STEP; w.move(w.players[1], input, STEP); }
  assert.ok(Math.abs(prediction.player.x - w.players[1].x) < .02);
  assert.ok(Math.abs(prediction.player.y - w.players[1].y) < .02);
  assert.equal(prediction.player.jumps, 1, "holding jump does not create a second jump during replay");
  const before = prediction.player.x;
  prediction.receive(s, 1, 1101);
  assert.equal(prediction.player.x, before, "older snapshots cannot rewind prediction");
});

test("prediction collides with floors and walls, respects prone headroom and accepts newly destroyed terrain", () => {
  const { w, prediction, snapshot } = fixture();
  w.platforms.push({ id: "wall", x: 417, y: 380, w: 30, h: 120 });
  w.time += STEP; const blocked = snapshot(); prediction.receive(blocked, 1, 1001);
  for (let i = 1; i <= 10; i++) advance(prediction, { right: true }, i);
  assert.ok(prediction.player.x <= 402); assert.equal(prediction.player.y, 470);
  assert.ok(prediction.sample(blocked, 1170).players[1].x <= 402);
  w.platforms.pop(); w.time += STEP; prediction.receive(snapshot(), 1, 1171);
  assert.ok(prediction.player.x > 402, "replayed inputs use the destroyed map");
  Object.assign(w.players[1], { x: 500, y: 490, prone: true });
  w.platforms.push({ id: "ceiling", x: 460, y: 460, w: 90, h: 12 });
  w.time += 1 / 30; prediction.receive(snapshot(10), 1, 1172);
  advance(prediction, {}, 11, 1189);
  assert.equal(prediction.player.prone, true);
  assert.equal(prediction.player.y, 490);
});

test("authoritative knockdowns, freezing, deaths, occupant replacement and round reset override local controls", () => {
  for (const condition of [{ knockdown: 1 }, { freeze: 1 }, { alive: false, hp: 0 }]) {
    const { w, prediction, snapshot, s } = fixture();
    advance(prediction, { right: true, jump: true }, 1);
    Object.assign(w.players[1], condition, { x: 650 }); w.time += STEP;
    const updated = snapshot(); prediction.receive(updated, 1, 1020);
    advance(prediction, { right: true, jump: true }, 2, 1030);
    assert.equal(prediction.sample(s, 1030).players[1].x, 650);
    assert.equal(prediction.pending.length, 0);
  }
  for (const reset of [w => w.round++, w => w.players[1].occupant++]) {
    const { w, prediction, snapshot } = fixture();
    advance(prediction, { right: true }, 1); reset(w); w.time += STEP;
    const next = snapshot(); prediction.receive(next, 1, 1020);
    assert.equal(prediction.pending.length, 0); assert.equal(prediction.player.x, 400);
  }
});

test("authoritative recoil is preserved; predicted attacks do not create damage, projectiles or terrain cuts", () => {
  for (const weapon of [null, "shotgun", "phaser", "sword"]) {
    const { w, prediction, snapshot } = fixture();
    Object.assign(w.players[1], { weapon, ammo: 10, vx: 700, impactTime: .3 });
    w.time += STEP; const s = snapshot(), saved = structuredClone(s);
    prediction.receive(s, 1, 1001); advance(prediction, { attack: true, aim: -Math.PI / 2 }, 1);
    const view = prediction.sample(s, 1017).players[1];
    assert.ok(view.vx > 240); assert.ok(view.swing > 0, String(weapon));
    assert.equal(view.weapon, weapon); assert.equal(view.ammo, 10);
    assert.equal(prediction.context.projectiles.length, 0);
    assert.deepEqual(s, saved);
    assert.deepEqual(prediction.context.platforms, s.platforms);
  }
});

test("prediction stops on a stalled connection and resumes from fresh authority with bounded history", () => {
  const { w, prediction, snapshot, s } = fixture();
  for (let i = 1; i < 100; i++) advance(prediction, { right: true }, i, 1001);
  assert.equal(prediction.pending.length, 30);
  assert.equal(prediction.sample(s, 1500).players[1].x, 400);
  w.time += 1; Object.assign(w.players[1], { x: 600 });
  prediction.receive(snapshot(), 1, 2000);
  assert.equal(prediction.pending.length, 0); assert.equal(prediction.player.x, 600);
  advance(prediction, { left: true }, 100, 2017); assert.ok(prediction.player.x < 600);
  prediction.reset(); assert.equal(prediction.sample(null, 2020), null);
});

test("movement replay state survives the compressed wire and malformed acknowledgements/state are rejected", async () => {
  const { s } = fixture();
  assert.ok(validSnapshot(s));
  const received = expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))), validSnapshot);
  assert.deepEqual(received.players[1].motion, s.players[1].motion);
  for (const value of [-1, Infinity, 1.2, "1"]) {
    const bad = structuredClone(s); bad.inputAcks[1] = value;
    assert.equal(validSnapshot(bad), false);
  }
  for (const value of [NaN, Infinity, "0", 10001]) {
    const bad = structuredClone(s); bad.players[1].motion.stun = value;
    assert.equal(validSnapshot(bad), false);
  }
});

test("local fighter bypasses remote interpolation while other fighters stay on its buffered timeline", () => {
  const { w, prediction, snapshot } = fixture(), frames = new GuestFrames();
  for (let i = 0; i < 8; i++) {
    w.time = 1 + i / 30; w.players[0].x = 100 + i * 10;
    const s = snapshot(); frames.push(s, 1000 + i * 1000 / 30);
    prediction.receive(s, 1, 1000 + i * 1000 / 30);
  }
  advance(prediction, { jump: true }, 1, 1240);
  const buffered = frames.sample(1240), view = prediction.sample(buffered, 1240);
  assert.equal(view.players[0], buffered.players[0]);
  assert.ok(view.players[0].x < w.players[0].x);
  assert.ok(view.players[1].y < buffered.players[1].y);
});
