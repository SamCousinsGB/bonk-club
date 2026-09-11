import test from "node:test";
import assert from "node:assert/strict";
import { SnapshotHistory, SNAPSHOT_HISTORY, snapshotPatch } from "../src/snapshot-delta.js";
import { World, STEP } from "../src/engine.js";
import { RenderSnapshots } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { blackholeField } from "../src/blackhole.js";
const json = value => JSON.parse(JSON.stringify(value));

test("acknowledged delta snapshots exactly preserve changing physics through loss, reordering and resets", async () => {
  const w = new World({ players: [0, 1, 2, 3], bots: [2, 3], arena: 18, random: () => .45 });
  const host = new SnapshotHistory(), guest = new SnapshotHistory(), renderer = new RenderSnapshots();
  let ack = 0, last = 0; const delivered = [];
  for (let seq = 1; seq <= 110; seq++) {
    if (seq === 20) w.fields.push(blackholeField(w, { x: 1150, y: 800, owner: 0 }));
    if (seq === 80) w.startRound();
    for (let i = 0; i < 4; i++) w.step(STEP, { 0: { right: true, jump: seq % 30 < 2, attack: true } });
    const state = compactSnapshot(renderer.make(w.snapshot()));
    const packet = json(host.encode(state, ack)); host.remember(seq, state);
    if (seq % 5 === 0) continue;
    const restored = guest.decode(packet, seq);
    assert.deepEqual(restored, json(state), `exact state ${seq}`);
    assert.ok(validSnapshot(expandSnapshot(restored, validSnapshot)));
    guest.remember(seq, restored); delivered.push(seq); last = seq;
    if (delivered.length > 3) ack = delivered.at(-3);
    assert.ok(host.states.size <= SNAPSHOT_HISTORY); assert.ok(guest.states.size <= SNAPSHOT_HISTORY);
  }
  assert.ok(last > 100);
  const wire = await encodeState(host.encode(host.states.get(last), last));
  assert.deepEqual(guest.decode(await decodeState(wire), last + 1), json(host.states.get(last)));
});

test("static destroyed terrain does not consume every movement update's bandwidth", async () => {
  const w = new World({ arena: 18, players: [0, 1, 2, 3], random: () => .45 });
  w.fields = [blackholeField(w, { x: 1150, y: 800, owner: 0 })];
  for (let n = 0; n < 140; n++) w.step(STEP);
  const renderer = new RenderSnapshots(), history = new SnapshotHistory();
  const a = compactSnapshot(renderer.make(w.snapshot())); history.remember(1, a);
  w.time += 1 / 30; w.players[0].x += 5;
  const b = compactSnapshot(renderer.make(w.snapshot()));
  const full = await encodeState(history.encode(b)), delta = await encodeState(history.encode(b, 1));
  assert.ok(delta.length < full.length * .15, `${full.length} -> ${delta.length}`);
});

test("late joins, evicted baselines and missing bases recover with full validated snapshots", () => {
  const host = new SnapshotHistory(), guest = new SnapshotHistory();
  for (let seq = 1; seq <= 80; seq++) host.remember(seq, { round: 1, arenaIndex: 0, time: seq });
  const state = { round: 1, arenaIndex: 0, time: 81 };
  assert.equal(host.encode(state, 1).base, 0);
  assert.equal(host.encode({ ...state, round: 2 }, 80).base, 0);
  assert.equal(guest.decode(host.encode(state, 80), 81), null);
  assert.deepEqual(guest.decode(host.encode(state, 0), 81), state);
});

test("patches preserve deletion, list reordering, resizing and immutable reference sharing", () => {
  const history = new SnapshotHistory();
  const a = { round: 1, arenaIndex: 0, list: [{ id: 1, x: 5 }, { id: 2, x: 9 }], fixed: [1, 2], old: true };
  const b = { round: 1, arenaIndex: 0, list: [{ id: 2, x: 10 }], fixed: [1, 2], new: true };
  history.remember(1, a);
  const out = history.decode(json(history.encode(b, 1)), 2);
  assert.deepEqual(out, b); assert.equal(out.fixed, a.fixed); assert.equal(a.old, true);
  assert.equal(snapshotPatch(a, a), null);
});

test("malformed deltas cannot allocate giant lists, add prototypes, make holes or grow recursive trees", () => {
  const h = new SnapshotHistory(); h.remember(1, { list: [1], obj: { n: 2 } });
  for (const patch of [
    { list: [1000000000, {}] }, { list: [2, {}] }, { list: [1, { '-1': [8] }] },
    JSON.parse('{"__proto__":[{"polluted":true}]}'), { obj: [JSON.parse('{"constructor":{}}')] },
    { obj: [Infinity] }, { obj: [[...Array(4097)].fill(0)] }, { obj: 3 },
  ]) assert.throws(() => h.decode({ base: 1, patch }, 2));
  let nested = {}; for (let i = 0; i < 30; i++) nested = { next: nested };
  assert.throws(() => h.decode({ base: 0, state: nested }, 2));
  assert.throws(() => h.decode({ base: 2, patch: null }, 2));
  assert.equal({}.polluted, undefined);
});
