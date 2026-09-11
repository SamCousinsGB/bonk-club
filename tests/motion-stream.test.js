import test from "node:test";
import assert from "node:assert/strict";
import { motionState, mergeMotion, completeMotion } from "../src/motion-stream.js";
import { FrameAssembler, framePackets, motionPacket } from "../src/realtime.js";
import { World } from "../src/engine.js";
import { RenderSnapshots } from "../src/render-state.js";

test("actor updates preserve world destruction and newer outcomes cannot be undone by delayed world state", () => {
  const w = new World(), snapshots = new RenderSnapshots();
  const world = { ...snapshots.make(w.snapshot()), inputAcks: [0, 0, 0, 0] };
  w.time += .1; w.players[1].alive = false; w.players[1].hp = 0;
  const actors = motionState({ ...snapshots.make(w.snapshot()), inputAcks: [0, 8, 0, 0] });
  assert.ok(completeMotion(actors));
  const state = mergeMotion(world, actors);
  assert.equal(state.players[1].alive, false); assert.equal(state.time, actors.time);
  assert.equal(state.platforms, world.platforms); assert.equal(state.wreckage, world.wreckage);
  const destroyed = { ...world, platforms: [], time: world.time + .05 };
  const withDestruction = mergeMotion(destroyed, actors);
  assert.equal(withDestruction.players[1].alive, false); assert.deepEqual(withDestruction.platforms, []);
  assert.equal(mergeMotion({ ...world, round: 2 }, actors).round, 2);
  assert.equal(mergeMotion({ ...world, time: actors.time + .1 }, actors).players[1].alive, true);
  assert.equal(mergeMotion({ ...world, time: actors.time + .1 }, actors, true).players[1].alive, false,
    "render sampling keeps the actor's continuous timeline when the two jitter buffers differ slightly");
  assert.equal(completeMotion({ ...actors, platforms: [] }), false);
  const missing = { ...actors }; delete missing.players;
  assert.equal(completeMotion(missing), false);
});

test("interleaved actor packets cannot discard an incomplete larger terrain frame", () => {
  const world = new FrameAssembler(), actors = new FrameAssembler();
  const full = new Uint8Array(20000).fill(7), quick = new Uint8Array(300).fill(2);
  const a = framePackets(full, 1), b = framePackets(quick, 2, true);
  assert.equal(world.push(a[0].buffer, 0), null); assert.equal(motionPacket(a[0].buffer), false);
  assert.equal(motionPacket(b[0].buffer), true);
  assert.deepEqual(actors.push(b[0].buffer, 1), { t: "frame", seq: 2, bytes: quick, motion: true });
  assert.deepEqual(world.push(a[1].buffer, 2), { t: "frame", seq: 1, bytes: full });
});
