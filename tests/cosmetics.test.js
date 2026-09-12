import test from "node:test";
import assert from "node:assert/strict";
import { CosmeticMotion, TRAIL_LIMIT, TRAIL_LIFE } from "../src/cosmetics.js";
import { defaultProfile, cleanProfile } from "../src/identity.js";
import { previewFighter } from "../src/cosmetic-preview.js";
import { World } from "../src/engine.js";
import { collectMatter } from "../src/accretion.js";
import { validSnapshot } from "../src/network.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { blend } from "../src/render-state.js";

const look = { ...defaultProfile(), finish: "Iridescent", cape: "Royal", trail: "Ion", aura: "Runes", accessory: "Crown" };
const scene = (time = 0, profile = look) => ({ round: 1, time, players: [previewFighter(profile,"Run",time)] });

test("cosmetic motion is bounded, expires after stopping and never mutates game state", () => {
  const motion = new CosmeticMotion();
  for(let i=0;i<900;i++) {
    const state=scene(i/60),before=structuredClone(state);
    motion.update(state,1/60);assert.deepEqual(state,before);
    const e=motion.entries.get(0);assert.ok(e.trail.length<=TRAIL_LIMIT);assert.equal(e.cloth.length,9);
    for(const q of e.cloth) {assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y));assert.ok(Math.hypot(q.x-e.x,q.y-e.y)<70);}
  }
  assert.ok(motion.entries.get(0).trail.length>3);
  const state=scene(15);
  for(let i=0;i<60;i++){state.time+=1/60;motion.update(state,1/60);}
  assert.equal(motion.entries.get(0).trail.length,0);
  assert.ok(TRAIL_LIFE<1);
});

test("cloth trails behind acceleration and stays attached through prone and knockdown poses", () => {
  const motion=new CosmeticMotion(),state=scene();
  for(let i=0;i<120;i++) {
    const p=state.players[0];p.x+=3;p.vx=360;
    for(const q of p.rig){q.x+=3; q.px+=3;}
    state.time+=1/120;motion.update(state,1/120);
  }
  const e=motion.entries.get(0);assert.ok(e.cloth[8].x<e.cloth[0].x-12);
  const p=state.players[0],anchor=p.rig[1];
  for(const q of p.rig){const x=q.x-anchor.x,y=q.y-anchor.y;q.x=anchor.x-y;q.y=anchor.y+x;}
  p.knockdown=1;p.prone=true;
  for(let i=0;i<90;i++){state.time+=1/120;motion.update(state,1/120);}
  assert.ok(Math.hypot(e.cloth[0].x-p.rig[1].x,e.cloth[0].y-p.rig[1].y)<=4.01);
  for(let i=1;i<9;i++) assert.ok(Math.hypot(e.cloth[i].x-e.cloth[i-1].x,e.cloth[i].y-e.cloth[i-1].y)<8);
});

test("slot replacement, teleport, round reset, death, capture and leaving clear old cosmetics", () => {
  for(const change of [s=>s.round++,s=>s.players[0].name="Replacement",s=>{s.players[0].rig[1].x+=500;},s=>s.players[0].alive=false,s=>s.players[0].strands=[],s=>s.players=[]]) {
    const motion=new CosmeticMotion();for(let i=0;i<30;i++)motion.update(scene(i/60),1/60);
    const old=motion.entries.get(0),state=scene(.5);change(state);motion.update(state,1/60);
    assert.notEqual(motion.entries.get(0),old);assert.equal(motion.entries.get(0)?.trail.length||0,0);
  }
});

test("reduced motion removes trail animation and repeated zero-dt draws do not advance cloth", () => {
  const motion=new CosmeticMotion();for(let i=0;i<30;i++)motion.update(scene(i/60),1/60);
  const state=scene(.5);motion.update(state,1/60);const before=structuredClone(motion.entries.get(0).cloth);
  motion.update(state,0);assert.deepEqual(motion.entries.get(0).cloth,before);
  motion.update(state,1/60,true);assert.equal(motion.entries.get(0).trail.length,0);
  motion.update(null,0);assert.equal(motion.entries.size,0);
});

test("cosmetics survive snapshot compaction, interpolation, deaths, captured heads and late joins", () => {
  const world=new World({players:[0],fillSolo:false});world.setProfiles([{id:0,...look}]);world.step(1/120);
  const first=structuredClone(world.snapshot());world.step(1/120);
  const mixed=blend(first,structuredClone(world.snapshot()),.5);
  assert.deepEqual(cleanProfile(mixed.players[0]),look);
  const field={x:100,y:100};collectMatter(world,field,world.players[0],"fighter");
  assert.deepEqual(cleanProfile(field.matter.items[0]),{...look,name:defaultProfile().name});
  world.wreckage.push(field.matter);world.kill(world.players[0]);
  const snap=world.snapshot();assert.ok(validSnapshot(snap));
  const late=expandSnapshot(compactSnapshot(snap),validSnapshot);assert.ok(late);
  assert.equal(late.ragdolls[0].cape,look.cape);assert.equal(late.ragdolls[0].finish,look.finish);
  assert.equal(late.wreckage[0].items[0].accessory,"Crown");assert.equal(late.wreckage[0].items[0].finish,"Iridescent");
  late.wreckage[0].items[0].cape="arbitrary";assert.equal(validSnapshot(late),false);
});
