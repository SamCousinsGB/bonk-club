import test from "node:test";
import assert from "node:assert/strict";
import { RenderSnapshots, GuestFrames, interpolateStates } from "../src/render-state.js";
import { World, STEP } from "../src/engine.js";
import { validSnapshot, encodeState } from "../src/network.js";

test("render snapshots reduce transmitted bytes without mutating authoritative physics", async () => {
  const w = new World({players:[0,1,2,3],arena:21,random:()=>.45});
  for (let i=0;i<120;i++) w.step(STEP);
  const state = w.snapshot(), saved = structuredClone(state), encoder = new RenderSnapshots();
  const rendered = encoder.make(state);
  assert.ok(validSnapshot(rendered));
  assert.deepEqual(state,saved);
  assert.equal(rendered.players[0].cooldown,undefined);
  assert.ok(Math.abs(rendered.players[0].x-state.players[0].x)<=.0051);
  const before = await encodeState(state), after = await encodeState(rendered);
  assert.ok(after.length < before.length*.75, `${before.length} -> ${after.length}`);
  assert.equal(encoder.make(state).drops[0].netId,rendered.drops[0].netId);
});

test("moving objects interpolate by stable identity even when a projectile is removed", () => {
  const w=new World(), encoder=new RenderSnapshots();
  w.projectiles=[{x:0,y:10,vx:100,vy:0,life:1,r:3,kind:"bullet"},{x:50,y:20,vx:100,vy:0,life:1,r:3,kind:"bullet"}];
  const a=encoder.make(w.snapshot());
  w.projectiles.shift();w.projectiles[0].x=70;
  w.drops[0].x+=40;
  const b=encoder.make(w.snapshot()), middle=interpolateStates(a,b,.5);
  assert.equal(middle.projectiles.length,1);
  assert.equal(middle.projectiles[0].x,60);
  assert.ok(Math.abs(middle.drops[0].x-(a.drops[0].x+20))<1e-8);
  b.players[0].occupant++;
  b.players[0].x+=100;
  assert.equal(interpolateStates(a,b,.5).players[0].x,b.players[0].x);
  b.round++;
  assert.equal(interpolateStates(a,b,.5),b);
});

test("guest history handles delivery jitter, duplicate frames, stalls and round changes", () => {
  const w=new World(), encoder=new RenderSnapshots(), frames=new GuestFrames();
  for (let i=0;i<8;i++) {
    w.time=i/30;w.players[0].x=i*10;
    frames.push(encoder.make(w.snapshot()),1000+i*1000/30+(i%2)*8);
  }
  const samples=[1180,1187,1194,1201,1208,1215].map(t=>frames.sample(t).players[0].x);
  for(let i=1;i<samples.length;i++) assert.ok(samples[i]>samples[i-1],samples.join(","));
  const latest=frames.frames.at(-1);
  frames.push(latest,1400);
  assert.equal(frames.sample(2000).players[0].x,70);
  assert.equal(frames.sample(2000), latest);
  assert.equal(frames.sample(2016), latest);
  w.round++;w.time=1;w.players[0].x=900;
  frames.push(encoder.make(w.snapshot()),2100);
  assert.equal(frames.sample(2100).players[0].x,900);
  frames.reset();assert.equal(frames.sample(2200),null);
});

test("adaptive buffering changes playback speed gradually while arrival jitter changes", () => {
  const w = new World(), encoder = new RenderSnapshots(), frames = new GuestFrames();
  const arrivals = [];
  for (let i = 0; i < 180; i++) {
    w.time = i / 30; w.players[0].x = w.time * 240;
    arrivals.push({ at: 1000 + i * 1000 / 30 + (i > 30 && i < 110 ? (i % 4) * 12 : 0), state: encoder.make(w.snapshot()) });
  }
  arrivals.sort((a, b) => a.at - b.at);
  let last = null, advances = 0;
  for (let now = 1000; now < 6500; now += 8) {
    while (arrivals.length && arrivals[0].at <= now) { const frame = arrivals.shift(); frames.push(frame.state, frame.at); }
    const view = frames.sample(now);
    if (last !== null) {
      const delta = view.time - last;
      assert.ok(delta >= -1e-9 && delta <= .00881, `bounded playback speed ${delta}`);
      if (delta > .006) advances++;
    }
    last = view.time;
  }
  assert.ok(advances > 600, `continuous display samples: ${advances}`);
});
