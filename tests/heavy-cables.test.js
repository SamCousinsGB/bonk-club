import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS, STEP, cleanInput } from "../src/engine.js";
import { createCables, updateCables, blastCables, stepCable, cableSnapshot } from "../src/heavy-cables.js";
import { cableLayout, TOWER_MOUNTS } from "../src/cable-layout.js";
import { cableRuns } from "../src/cable-art.js";
import { carveExplosion } from "../src/terrain.js";
import { updateHazards } from "../src/hazards.js";
import { validSnapshot } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { firePhaser } from "../src/phaser.js";
import { GuestPrediction } from "../src/guest-prediction.js";

const arena = kind => {
  const w = new World({ arena: ARENAS.findIndex(a => a[kind]), players: [0,1], shuffle: false, random: () => .4 });
  w.phase = "fight"; w.botIds.clear(); w.weaponTimer = 999;
  return w;
};
const run = (w, seconds) => { for (let i = 0; i < Math.round(seconds / STEP); i++) {
  w.time += STEP; updateHazards(w, STEP); updateCables(w, STEP);
} };
const bounded = w => {
  assert.ok(validSnapshot(w.snapshot()));
  for (const c of w.cables) for (let i = 0; i < c.links.length; i++) if (c.links[i]) {
    const p = c.points[i], q = c.points[i + 1];
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < c.lengths[i] * 1.15, `${c.id} segment ${i} stretched`);
  }
};

test("tower endpoints hang below insulators; intact wires support feet and cut wires do not block", () => {
  const w = arena("transmission");
  for (const [i, cable] of w.cables.entries()) for (const [j, point] of [cable.points[0], cable.points.at(-1)].entries()) {
    const end = TOWER_MOUNTS[i][j];
    assert.equal(point.x, end.x); assert.equal(point.y, end.supportY + 70);
  }
  assert.ok(w.solids().some(s => s.material === "cable"));
  assert.ok(!w.platforms.some(s => s.x < 1280 && s.x + s.w > 1280), "no replacement centre platforms");
  const p = w.players[0], wire = w.cables[0].points[12];
  Object.assign(p, { x: wire.x, y: wire.y - 55, vx: 0, vy: 100, ground: false, rig: null });
  for (let i = 0; i < 60; i++) w.move(p, cleanInput({}), STEP);
  assert.ok(Math.abs(p.y + 30 - wire.y) < 6, `${p.y}/${wire.y}`);
  assert.ok(p.ground && p.support.startsWith("tower0:wire"));
  blastCables(w, {...w.cables[0].points[8],radius:25});
  assert.equal(p.ground,false); assert.equal(p.support,null);
  assert.ok(!w.solids().some(s => s.id.startsWith("tower0:wire")));
  for (let i = 0; i < 35; i++) w.move(p, cleanInput({}), STEP);
  assert.ok(p.y > wire.y + 30, `${p.y}/${wire.y}`);
});

test("guest movement supports intact wires and releases support on a received cut", () => {
  const w = arena("transmission"), p=w.players[0], wire=w.cables[0].points[12];
  Object.assign(p,{x:wire.x,y:wire.y-55,vx:0,vy:100,ground:false,rig:null});
  const encoder=new RenderSnapshots(), snapshot=()=>({...encoder.make(w.snapshot()),inputAcks:[0,0,0,0]});
  const prediction=new GuestPrediction();prediction.receive(snapshot(),0,0);
  for(let i=0;i<40;i++)prediction.step(cleanInput({}));
  assert.ok(prediction.player.ground && prediction.player.support.startsWith("tower0:wire"));
  Object.assign(p,{x:prediction.player.x,y:prediction.player.y,ground:true,support:prediction.player.support});
  blastCables(w,{...w.cables[0].points[8],radius:25});w.time+=STEP;
  prediction.receive(snapshot(),0,16);
  for(let i=0;i<20;i++)prediction.step(cleanInput({}));
  assert.ok(prediction.player.y>wire.y+30);assert.equal(prediction.player.ground,false);
});

for (const kind of ["furnace", "transmission"]) test(`${kind}: powered motion is subtle and local impulses rapidly damp`, () => {
  const idle = createCables({ [kind]: true })[0], live = structuredClone(idle), kick = structuredClone(idle);
  kick.points[12].px -= 65 * STEP;
  let motion = 0, far = 0, peak = 0;
  for (let i = 0; i < 720; i++) {
    stepCable(idle, i * STEP, 0, []); stepCable(live, i * STEP, 1, []); stepCable(kick, i * STEP, 0, []);
    for (let n = 1; n < 24; n++) {
      const d = Math.hypot(live.points[n].x - idle.points[n].x, live.points[n].y - idle.points[n].y);
      peak = Math.max(peak, d); if (i > 600) motion += d;
      if (n < 4 || n > 20) far = Math.max(far, Math.hypot(kick.points[n].x - idle.points[n].x, kick.points[n].y - idle.points[n].y));
    }
  }
  assert.ok(peak < 5, `electrical displacement ${peak}`);
  assert.ok(motion > 1, "powered cable should visibly move");
  assert.ok(far < 3, `remote impulse displacement ${far}`);
  const residual = Math.hypot(kick.points[12].x - idle.points[12].x, kick.points[12].y - idle.points[12].y);
  assert.ok(residual < .6, `residual ${residual}`);
});

test("furnace destruction releases electrode ends but preserves heavy wires hanging from the wall", () => {
  const w = arena("furnace"); run(w, 1);
  const ends = w.cables.map(c => ({...c.points.at(-1)}));
  carveExplosion(w, { x: 1280, y: 1000, radius: 100 }); run(w, 4);
  assert.ok(w.hazards[0].done);
  for (const [i, c] of w.cables.entries()) {
    assert.deepEqual(c.attached, [true, false]); assert.ok(c.links.every(Boolean));
    assert.ok(c.points.at(-1).y > ends[i].y + 100);
    assert.equal(c.points[0].x, cableLayout(c.id).a.x);
  }
  bounded(w);
});

test("lost pylon mount drops its end while the other insulator holds; losing both drops the span", () => {
  const w = arena("transmission"), c = w.cables[0], spec = cableLayout(c.id);
  carveExplosion(w, { x: spec.a.x, y: spec.a.supportY, radius: 36 }); run(w, 3);
  assert.deepEqual(c.attached, [false, true]); assert.equal(w.hazards[0].done,false);
  assert.ok(c.points[0].y > spec.a.y + 100); assert.equal(c.points.at(-1).y, spec.b.y);
  bounded(w);
  carveExplosion(w, { x: spec.b.x, y: spec.b.supportY, radius: 36 }); run(w, 4);
  assert.deepEqual(c.attached, [false, false]); assert.ok(c.points.at(-1).y > spec.b.y + 100);
  bounded(w);
});

test("a cut creates two independent hanging tails with no rendered bridge across the gap", () => {
  const w = arena("transmission"), c = w.cables[0], point = {...c.points[12]};
  blastCables(w, { ...point, radius: 35 }); run(w, 5);
  assert.deepEqual(c.attached, [true,true]); assert.equal(w.hazards[0].done,false);
  const runs = cableRuns(c); assert.equal(runs.length, 2);
  assert.ok(runs[0].at(-1).y > point.y + 150); assert.ok(runs[1][0].y > point.y + 150);
  bounded(w);
});

test("phaser removes intersecting conductor sections and surviving mounts still hold", () => {
  const w = arena("transmission"), p = w.players[0];
  Object.assign(p, { x: 1280, y: 250, weapon: "phaser", aimAngle: Math.PI / 2, rig: null });
  firePhaser(w, p, 0, 1); run(w, 1);
  assert.ok(w.cables.every(c => c.links.some(v => !v)));
  assert.ok(w.cables.every(c => c.attached.every(Boolean)));
  bounded(w);
});

test("prediction cannot cut or move cables; physical fall continues through results and resets next round", () => {
  const w = arena("furnace"); w.prediction = true;
  const before = cableSnapshot(w.cables); blastCables(w, {x: 70,y:210,radius:500}); updateCables(w, .1);
  assert.deepEqual(cableSnapshot(w.cables), before); w.prediction = false;
  carveExplosion(w, {x:1280,y:1000,radius:100}); w.phase="result"; w.phaseTime=100;
  const y=w.cables[0].points.at(-1).y;
  for(let i=0;i<120;i++)w.step(STEP);
  assert.ok(w.cables[0].points.at(-1).y>y+30);
  w.startRound(); assert.ok(w.cables.every(c=>c.attached.every(Boolean)&&c.links.every(Boolean)));
  bounded(w);
});

test("hot join carries exact falling cable geometry, interpolates positions and validates bounded topology", () => {
  const w = arena("furnace"); carveExplosion(w,{x:1280,y:1000,radius:100}); run(w, 1);
  const s = new RenderSnapshots().make(w.snapshot());
  const received = expandSnapshot(JSON.parse(JSON.stringify(compactSnapshot(s))), validSnapshot);
  assert.deepEqual(received.cables, s.cables);
  run(w, .1); const next = new RenderSnapshots().make(w.snapshot());
  const view = interpolateStates(s, next, .5);
  assert.equal(view.cables[0].points[12].y, (s.cables[0].points[12].y + next.cables[0].points[12].y) / 2);
  assert.deepEqual(view.cables[0].attached, next.cables[0].attached);
  for (const mutate of [c=>c.points.push({x:0,y:0}), c=>c.points[3].x=Infinity,
    c=>c.links[3]=1, c=>c.attached[0]="yes", c=>c.points[0].y+=10, c=>c.id="furnace9"]) {
    const bad=structuredClone(s); mutate(bad.cables[0]); assert.equal(validSnapshot(bad), false);
  }
  const duplicate=structuredClone(s); duplicate.cables[1]=duplicate.cables[0]; assert.equal(validSnapshot(duplicate),false);
  const missing=structuredClone(s); delete missing.cables; assert.equal(validSnapshot(missing),false);
});
