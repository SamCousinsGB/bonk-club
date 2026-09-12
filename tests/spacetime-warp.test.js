import test from "node:test";
import assert from "node:assert/strict";
import { spacetimeSources, drawSpacetimeWarp } from "../src/spacetime-warp.js";
import { World } from "../src/engine.js";
import { blackholeField } from "../src/blackhole.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";

const camera = { a: .75, b: 0, c: 0, d: .75, e: 0, f: 0 };
const field = { kind: "blackhole", x: 1280, y: 720, age: 2, life: 3.5 };
const sources = (fields, reduced = false) => spacetimeSources(fields, camera, 1920, 1080, reduced);

test("whole-scene warp grows smoothly, persists beyond activation, and settles before closure", () => {
  assert.deepEqual(sources([{ ...field, age: 0 }]), []);
  const opening = [.001, .15, .45, .85].map(age => sources([{ ...field, age }])[0].strength);
  assert.ok(opening[0] < .00001 && opening.at(-1) === 1);
  assert.ok(opening.every((s, i) => i === 0 || s > opening[i - 1]));
  assert.equal(sources([field])[0].strength, 1);
  const closing = [1.1, .75, .35, .001].map(life => sources([{ ...field, life }])[0].strength);
  assert.ok(closing.every((s, i) => i === 0 || s < closing[i - 1]));
  assert.ok(closing.at(-1) < .00001);
  assert.deepEqual(sources([{ ...field, life: 0 }]), []);
  assert.deepEqual(sources([{ ...field, kind: "matter" }]), [], "closed singularities do not keep the screen bent");
});

test("warp coordinates follow viewport scaling, translation and menu camera", () => {
  const base = sources([field])[0];
  assert.equal(base.x, 1920 / 1080 / 2);
  assert.equal(base.y, .5);
  const scaled = spacetimeSources([field], { ...camera, a: .375, d: .375 }, 960, 540)[0];
  assert.deepEqual(scaled, base, "resizing does not change apparent strength or centre");
  const moved = spacetimeSources([field], { ...camera, e: 108, f: 216 }, 1920, 1080)[0];
  assert.ok(Math.abs(moved.x - base.x - .1) < 1e-12);
  assert.ok(Math.abs(moved.y - base.y + .2) < 1e-12);
});

test("overlap selection is bounded and independent of snapshot array order", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ ...field, x: i * 100, life: .2 + i / 50 }));
  const original = structuredClone(many);
  assert.equal(sources(many).length, 4);
  assert.deepEqual(sources(many), sources([...many].reverse()));
  assert.deepEqual(many, original, "rendering cannot sort or modify authoritative fields");
});

test("reduced motion keeps a gentler static bend but retains the closing fade", () => {
  const quiet = sources([field], true)[0];
  assert.equal(quiet.strength, .25);
  assert.equal(quiet.time, 0);
  assert.deepEqual(sources([{ ...field, age: 3, life: 2.5 }], true)[0], quiet);
  assert.ok(sources([{ ...field, life: .1 }], true)[0].strength < quiet.strength);
});

test("no active black hole means no GPU allocation, drawing or canvas changes", () => {
  const renderer = { ctx: { canvas: { width: 1920, height: 1080 }, getTransform: () => camera } };
  assert.equal(drawSpacetimeWarp(renderer, []), false);
  assert.equal(drawSpacetimeWarp(renderer, [{ ...field, life: 0 }]), false);
  assert.equal(renderer.spacetimeWarp, undefined);
});

test("existing transport, interpolation and hot join preserve the visual envelope without changing physics", async () => {
  const world = new World({ players: [0, 1], shuffle: false, random: () => .4 });
  const hole = blackholeField(world, { x: 1200, y: 600, owner: 0 });
  Object.assign(hole, { age: 2, life: 3.5 });
  world.fields = [hole];
  const snapshots = new RenderSnapshots(), a = snapshots.make(world.snapshot());
  const before = structuredClone(a);
  const guest = expandSnapshot(await decodeState(await encodeState(compactSnapshot(a))), validSnapshot);
  assert.ok(validSnapshot(guest));
  assert.deepEqual(sources(guest.fields), sources(a.fields));
  assert.deepEqual(a, before);
  world.time += .1; hole.age += .1; hole.life -= .1;
  const b = snapshots.make(world.snapshot());
  const between = interpolateStates(a, b, .5);
  const drawn = sources(between.fields)[0];
  assert.ok(drawn.time >= 2 && drawn.time <= 2.1);
  assert.equal(drawn.strength, 1);
  world.startRound();
  assert.deepEqual(sources(world.snapshot().fields), [], "round reset clears the entire visual effect");
});
