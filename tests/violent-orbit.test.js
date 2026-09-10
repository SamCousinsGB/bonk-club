import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP } from "../src/engine.js";
import { makeRig } from "../src/puppet.js";
import { blackholeField, updateWreckage } from "../src/blackhole.js";
import { captureFighter, moveCaptured } from "../src/singularity-body.js";
import { collectMatter, packMatter } from "../src/accretion.js";
import { seedOrbit } from "../src/orbit.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { encodeState, decodeState, validSnapshot } from "../src/network.js";

function fixture() {
  const w = new World({ players: [0, 1], shuffle: false, random: () => .4 });
  w.platforms = []; w.cover = []; w.chunks = []; w.hazards = [];
  const f = blackholeField(w, { x: 1100, y: 700, owner: 1 });
  f.torn = true; f.age = .4; w.fields = [f]; w.phase = "fight";
  const p = w.players[0];
  Object.assign(p, { x: 850, y: 600, vx: 0, vy: 0 });
  p.rig = makeRig(p); captureFighter(p, f);
  return { w, p, f };
}
const angleDelta = (a, b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));

test("capture preserves incoming linear momentum instead of replacing it with the same orbit", () => {
  const center = { x: 0, y: 0 }, a = { x: 300, y: 100, vx: 400, vy: -200 },
    b = { x: 300, y: 100, vx: -250, vy: 350 };
  seedOrbit(a, center); seedOrbit(b, center);
  assert.ok(Math.abs((b.px-a.px)*120 - 650) < .001);
  assert.ok(Math.abs((b.py-a.py)*120 + 550) < .001);
});

test("captured bodies make fast eccentric passes with changing limb bends", () => {
  const { w, p, f } = fixture();
  let angle = Math.atan2(p.y-f.y, p.x-f.x), turn = 0, bendTurn = 0, bend = 0;
  const radii = [], bends = [];
  for (let n = 0; n < 360; n++) {
    f.age += STEP; moveCaptured(p, w, [], STEP);
    const a = Math.atan2(p.y-f.y, p.x-f.x);
    turn += angleDelta(a, angle); angle = a;
    const [shoulder, elbow, hand] = [p.rig[1], p.rig[3], p.rig[4]],
      b = angleDelta(Math.atan2(hand.y-elbow.y, hand.x-elbow.x),
        Math.atan2(elbow.y-shoulder.y, elbow.x-shoulder.x));
    if (n) bendTurn += angleDelta(b, bend);
    bend = b; bends.push(bendTurn);
    radii.push(Math.hypot(p.x-f.x, p.y-f.y));
  }
  assert.ok(turn > 9, `swept ${turn} radians in three seconds`);
  assert.ok(Math.max(...radii)-Math.min(...radii) > 70, "radius must change during orbit");
  assert.ok(Math.max(...bends)-Math.min(...bends) > 2, `elbow bend range ${Math.max(...bends)-Math.min(...bends)}`);
  assert.ok(p.alive && p.strands.length === 10);
});

test("an impulse to a captured hand changes its path relative to the torso", () => {
  const { w, p, f } = fixture();
  for (let n = 0; n < 90; n++) { f.age += STEP; moveCaptured(p,w,[],STEP); }
  const kicked = structuredClone(p);
  kicked.rig[4].px -= 7; kicked.rig[4].py += 4;
  let relativeDeflection = 0;
  for (let n = 0; n < 60; n++) {
    f.age += STEP; moveCaptured(p,w,[],STEP); moveCaptured(kicked,w,[],STEP);
    relativeDeflection = Math.max(relativeDeflection, Math.hypot(
      (kicked.rig[4].x-kicked.rig[2].x)-(p.rig[4].x-p.rig[2].x),
      (kicked.rig[4].y-kicked.rig[2].y)-(p.rig[4].y-p.rig[2].y)));
  }
  assert.ok(relativeDeflection > 12, `hand deflection ${relativeDeflection}`);
  assert.ok(kicked.rig.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));
});

test("loose matter keeps orbiting and tumbling near the core until closing", async () => {
  const { w, f } = fixture();
  collectMatter(w,f,{ x: f.x+45, y: f.y, type: "bat", vx: 250, vy: -80 },"weapon");
  const q = f.matter.items[0], startAngle = q.angle;
  for (let n = 0; n < 180; n++) { f.age += STEP; packMatter(f,STEP); }
  const before = new RenderSnapshots().make(w.snapshot()), x = q.x, y = q.y;
  for (let n = 0; n < 60; n++) { f.age += STEP; packMatter(f,STEP); }
  assert.ok(Math.hypot(q.x-x,q.y-y) > 40, "early collection must not fix a sample to the core");
  assert.ok(Math.abs(q.angle-startAngle) > 3, "captured weapons must tumble");
  assert.equal(f.matter.packing,0);
  const after = await decodeState(await encodeState(new RenderSnapshots().make(w.snapshot())));
  assert.ok(validSnapshot(after)); assert.ok(validSnapshot(interpolateStates(before,after,.5)));
  assert.equal(after.fields[0].matter.items[0].id,q.id);
  f.life=0; packMatter(f,STEP);
  assert.equal(f.matter.packing,1);
  assert.ok(Math.hypot(q.x-f.x,q.y-f.y) < f.matter.w/2);
});

test("moving wreckage retains translation and rotational motion when becoming a strand", () => {
  function sample(vx, spin) {
    const { w, f } = fixture();
    const piece = { id:1, kind:"prop", x:800, y:700, w:90, h:30,
      angle:0, hp:120, vx, vy:0, spin, fieldId:f.riftId };
    w.wreckage=[piece]; updateWreckage(w,STEP);
    return piece;
  }
  const still=sample(0,0), moving=sample(600,0), tumbling=sample(0,8);
  assert.ok(moving.x-still.x > 4);
  const slope=p=>Math.atan2(p.spine.at(-1).y-p.spine[0].y,p.spine.at(-1).x-p.spine[0].x);
  assert.ok(Math.abs(slope(tumbling)-slope(still)) > .04);
});

test("matter captured exactly at the centre can move out into the active orbit", () => {
  const {w,f} = fixture();
  collectMatter(w,f,{x:f.x,y:f.y,type:"bat"},"weapon");
  const q = f.matter.items[0];
  for (let n=0;n<120;n++) { f.age+=STEP; packMatter(f,STEP); }
  assert.ok(Math.hypot(q.x-f.x,q.y-f.y)>90);
});
