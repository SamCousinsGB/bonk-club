import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, cleanInput } from "../src/engine.js";
import { makeRig, JOINTS } from "../src/puppet.js";
import { steer } from "../src/navigation.js";
import { validSnapshot } from "../src/network.js";

function floor(y = 1320, bot = false, dir = 1) {
  const w = new World({ players: [0, 1], bots: bot ? [1] : [], shuffle: false, random: () => 0.45 });
  w.phase = "fight";
  w.cover = []; w.drops = []; w.hazards = []; w.weaponTimer = 999;
  w.arena = { ...w.arena, spikes: [] };
  w.platforms = [{ id: "floor", x: 20, y, w: 2520, h: 30, baseX: 20, baseY: y, dx: 0, dy: 0 }];
  for (const p of w.players) {
    Object.assign(p, { x: p.id === 1 ? (dir > 0 ? 300 : 2260) : (dir > 0 ? 2260 : 300),
      y: y - 30, vx: 0, vy: 0, ground: true, support: "floor", facing: dir });
    p.rig = makeRig(p);
  }
  return w;
}
function advance(w, seconds, input = {}, observe = () => {}) {
  for (let n = 0; n < seconds / STEP; n++) { w.step(STEP, { 1: input }); observe(w.players[1], n); }
}

for (const y of [540, 1320]) for (const dir of [-1, 1]) {
  test(`AI sustains a normal run on the ${y === 1320 ? "bottom" : "upper"} floor toward ${dir}`, () => {
    const w = floor(y, true, dir), speeds = [];
    advance(w, 2, {}, (p, n) => { if (n > 40) speeds.push(p.vx * dir); assert.equal(p.prone, false); });
    assert.ok(Math.min(...speeds) >= 230, `cruise fell to ${Math.min(...speeds)}`);
    assert.ok(Math.max(...speeds) <= 240, "AI has the same run cap as a human");
  });
}

test("steering brakes into a takeoff position instead of oscillating around it", () => {
  const w = floor(), p = w.players[1];
  p.vx = 240;
  for (let n = 0; n < 240; n++) w.move(p, cleanInput(steer(p, 500)), STEP);
  assert.ok(Math.abs(p.x - 500) < 8, `stopped at ${p.x}`);
  assert.ok(Math.abs(p.vx) < 25, `still moving at ${p.vx}`);
});

for (const dir of [-1, 1]) test(`running ${dir} has alternating lifted steps and an upright physical body`, () => {
  const w = floor(1320, false, dir), p = w.players[1], feet = [[], []];
  advance(w, 0.5, { left: dir < 0, right: dir > 0 });
  advance(w, 1, { left: dir < 0, right: dir > 0 }, p => {
    for (const [i, index] of [8, 10].entries()) feet[i].push({ x: p.rig[index].x - p.x, y: p.rig[index].y - p.y });
    assert.ok(p.rig[0].y < p.rig[2].y - 30, "running must not become crouch walking");
    for (const [a, b, len] of JOINTS)
      assert.ok(Math.abs(Math.hypot(p.rig[a].x-p.rig[b].x, p.rig[a].y-p.rig[b].y)-len) < 9);
  });
  for (const points of feet) {
    assert.ok(Math.min(...points.map(q=>q.y)) < 13, "each foot must clearly leave the ground");
    assert.ok(Math.max(...points.map(q=>q.x)) > 14 && Math.min(...points.map(q=>q.x)) < -14, "both legs must stride past the body");
    assert.ok(Math.max(...points.map(q=>q.y)) <= 27.1, "feet must not penetrate the floor");
  }
  assert.ok(validSnapshot(w.snapshot()));
});

test("a blocked runner does not keep walking in place", () => {
  const w = floor(), p = w.players[1];
  w.platforms.push({ id: "wall", x: 500, y: 1100, w: 50, h: 220 });
  advance(w, 1.5, { right: true });
  const walk = p.walk;
  advance(w, 0.5, { right: true });
  assert.ok(Math.abs(p.walk - walk) < 0.05);
});

test("jump and fall poses leave the running cycle until landing, then recover", () => {
  const w = floor(), p = w.players[1];
  advance(w, 0.5, { right: true });
  advance(w, STEP, { right: true, jump: true });
  const walk = p.walk, rising = p.rig.map(q=>({x:q.x-p.x,y:q.y-p.y}));
  advance(w, 0.25, { right: true });
  assert.equal(p.ground, false);
  assert.equal(p.walk, walk, "airborne legs must not pedal through the ground run cycle");
  advance(w, 0.65);
  assert.equal(p.ground, true);
  assert.ok(p.rig.some((q,i)=>Math.abs(q.y-p.y-rising[i].y)>5));
  advance(w, 0.5);
  assert.ok(Math.abs(p.bodyAngle) < 0.2);
  assert.ok(p.rig[0].y < p.rig[2].y - 35);
});

test("standing riders keep their pose on moving platforms without walking or dragging behind", () => {
  const still = floor(), moving = floor();
  Object.assign(moving.platforms[0], { x: 0, baseX: 0, move: 100, speed: 2, travel: -160 });
  advance(still, 0.5); advance(moving, 0.5);
  for (let n = 0; n < 120; n++) {
    still.step(STEP); moving.step(STEP);
    const p = moving.players[1], q = still.players[1];
    assert.equal(p.support, "floor");
    assert.equal(p.walk, 0);
    assert.ok(Math.abs(p.rig[0].x-p.x-(q.rig[0].x-q.x)) < 1, "the head must travel with the lift");
    assert.ok(Math.abs(p.rig[0].y-p.y-(q.rig[0].y-q.y)) < 1);
  }
});

test("upper and bottom floor runs have the same pose and travel", () => {
  const upper = floor(540), lower = floor(1320);
  for (let n = 0; n < 180; n++) {
    upper.step(STEP, {1:{right:true}}); lower.step(STEP, {1:{right:true}});
    const a = upper.players[1], b = lower.players[1];
    assert.equal(a.x, b.x);
    for (let i = 0; i < 11; i++) {
      assert.ok(Math.abs(a.rig[i].x-b.rig[i].x)<0.01);
      assert.ok(Math.abs(a.rig[i].y+780-b.rig[i].y)<0.01);
    }
  }
});

test("an AI carried off a takeoff uses its remaining jump toward a reachable landing", () => {
  const w = floor(1320, true), p = w.players[1];
  w.platforms = [
    {id:"left",x:740,y:1170,w:370,h:28},
    {id:"right",x:1350,y:1130,w:400,h:28},
  ];
  Object.assign(w.players[0], {x:1600,y:1100,ground:true,support:"right"});
  Object.assign(p, {x:1300,y:1108,vx:-360,vy:130,ground:false,support:null,jumps:1,coyote:0});
  p.rig = makeRig(p);
  let landed = false, jumped = false;
  advance(w, 1.2, {}, p => {landed ||= p.ground && p.support === "left"; jumped ||= p.jumps === 2;});
  assert.ok(jumped, "use the ordinary remaining air jump");
  assert.ok(landed, "land in the direction of momentum instead of missing the ledge behind");
  assert.equal(p.alive, true);
});
