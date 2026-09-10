import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { blackholeField } from "../src/blackhole.js";
import { updateFields } from "../src/specials.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";

test("bent furniture and lifts retain their artwork identity through transport and another field", async () => {
  const w = new World({ players: [0, 1], shuffle: false });
  w.phase = "fight";
  w.cover = [{ x: 900, y: 620, w: 120, h: 54, kind: "sofa", hp: 75, maxHp: 75 }];
  w.hazards = [];
  w.platforms = [{ x: 900, y: 750, w: 110, h: 18, elevator: true, material: "metal" }];
  w.fields = [blackholeField(w, { x: 1100, y: 800, owner: 0 })];
  for (let t = 0; t < .5; t += STEP) { w.time += STEP; updateFields(w, STEP); }
  const sofa = w.wreckage.find(p => p.kind === "prop");
  const lift = w.wreckage.find(p => p.kind === "platform");
  assert.equal(sofa.sourceKind, "sofa");
  assert.equal(lift.elevator, true);
  assert.equal(lift.material, "metal");
  assert.ok(sofa.outline && lift.outline);
  const state = await decodeState(await encodeState(w.snapshot()));
  assert.equal(validSnapshot(state), true);
  assert.deepEqual(state.wreckage.map(p => [p.sourceKind, p.elevator]),
    w.wreckage.map(p => [p.sourceKind, p.elevator]));
  const other = blackholeField(w, { x: sofa.x, y: sofa.y, owner: 0 });
  other.age = .4; w.fields.push(other); updateFields(w, STEP);
  assert.equal(sofa.fieldId, other.riftId);
  assert.equal(sofa.sourceKind, "sofa");
  w.startRound();
  assert.equal(w.wreckage.length, 0);
});

test("wreck artwork metadata rejects malformed values and accepts older snapshots", () => {
  const w = new World({ players: [0, 1], shuffle: false });
  const state = w.snapshot();
  state.wreckage = [{ id: 1, x: 100, y: 100, w: 100, h: 20, angle: 0, hp: 120, kind: "prop" }];
  assert.equal(validSnapshot(state), true);
  state.wreckage[0].sourceKind = { kind: "sofa" };
  assert.equal(validSnapshot(state), false);
  state.wreckage[0].sourceKind = "sofa";
  state.wreckage[0].elevator = "yes";
  assert.equal(validSnapshot(state), false);
  state.wreckage[0].elevator = false;
  assert.equal(validSnapshot(state), true);
});
