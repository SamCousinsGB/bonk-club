import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, emptyInput } from "../src/engine.js";
import { JOINTS, makeRig } from "../src/puppet.js";
import { blackholeField } from "../src/blackhole.js";
import { updateFields } from "../src/specials.js";
import { captureFighter, moveCaptured } from "../src/singularity-body.js";
import { collectMatter, MATTER_LIMIT } from "../src/accretion.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
const wire = new RenderSnapshots();
function fixture() {
  const w = new World({players:[0,1],shuffle:false,random:()=>.4});
  w.botIds.clear(); w.phase="fight"; w.weaponTimer=999;
  w.platforms=[]; w.cover=[]; w.chunks=[]; w.hazards=[]; w.drops=[];
  for(const p of w.players) { Object.assign(p,{x:1800+p.id*300,y:400,vx:0,vy:0});p.rig=makeRig(p); }
  return w;
}
function advance(w,seconds) {
  for(let t=0;t<seconds;t+=STEP) { w.time+=STEP; updateFields(w,STEP); w.updateRagdolls(STEP); }
}
test("living fighters orbit as connected stretched limbs and cannot fire, jump or recover during capture",()=>{
  const w=fixture(),p=w.players[0],f=blackholeField(w,{x:1100,y:700,owner:1});
  w.fields=[f]; f.torn=true;f.age=.41;
  Object.assign(p,{x:850,y:600,weapon:"rocket",ammo:4});p.rig=makeRig(p);captureFighter(p,f);
  const start=Math.atan2(p.y-f.y,p.x-f.x);let angle=start,turn=0;
  for(let n=0;n<360;n++) {
    const input={...emptyInput(),jump:true,attack:true,throw:true,right:true};
    w.move(p,input,STEP); w.attack(p);
    const a=Math.atan2(p.y-f.y,p.x-f.x);turn+=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));angle=a;
    assert.ok(p.alive && p.knockdown>0 && !p.ground);
  }
  const length=p.strands.reduce((sum,s)=>sum+s.points.slice(1).reduce((n,q,i)=>n+Math.hypot(q.x-s.points[i].x,q.y-s.points[i].y),0),0);
  const rest=JOINTS.reduce((sum,j)=>sum+j[2],0);
  assert.ok(turn>2.5,`orbit turns ${turn}`);
  assert.ok(length>rest*2 && length<rest*5.5,`body length ${length}`);
  assert.equal(p.ammo,4);assert.equal(w.projectiles.length,0);
  for(let n=0;n<JOINTS.length;n++) {
    assert.equal(p.strands[n].points[0],p.rig[JOINTS[n][0]]);
    assert.equal(p.strands[n].points[5],p.rig[JOINTS[n][1]]);
  }
  assert.ok(validSnapshot(wire.make(w.snapshot())));
  w.fields=[];w.move(p,emptyInput(),STEP);
  assert.equal(p.strands,undefined);assert.ok(p.knockdown>0 && p.knockdown<1);
  for(let n=0;n<100;n++)w.move(p,emptyInput(),STEP);
  assert.equal(p.knockdown,0);assert.ok(p.alive);
});
test("orbiting limbs sweep against a thin wall instead of passing through it",()=>{
  const w=fixture(),p=w.players[0],f=blackholeField(w,{x:1050,y:700,owner:1});w.fields=[f];
  Object.assign(p,{x:850,y:620});p.rig=makeRig(p);captureFighter(p,f);
  const wall={id:"wall",x:910,y:350,w:8,h:600,hp:120,dx:0,dy:0};let contacts=0;
  for(let n=0;n<150;n++) {
    moveCaptured(p,w,[wall],STEP);
    for(const q of new Set(p.strands.flatMap(s=>s.points))) {
      assert.ok(!(q.x>wall.x && q.x<wall.x+wall.w && q.y>wall.y && q.y<wall.y+wall.h));
      if(Math.abs(q.x-(wall.x-2.55))<.2)contacts++;
    }
  }
  assert.ok(contacts>0,"limbs contact the wall during orbit");
});
test("closing collects every matter category into a persistent, collidable ball while retaining outer twisted platforms",async()=>{
  const w=fixture(),f=blackholeField(w,{x:1100,y:700,owner:0});w.fields=[f];
  w.platforms=[{id:"floor",x:520,y:900,w:1160,h:24,baseX:520,baseY:900,dx:0,dy:0}];
  w.cover=[{x:1150,y:700,w:80,h:40,kind:"sofa",hp:75,maxHp:75}];
  w.hazards=[{id:1,type:"saw",x:1200,y:650,bodyX:1200,bodyY:650,w:70,h:40}];
  const p=w.players[0];Object.assign(p,{x:900,y:620,weapon:"rocket",ammo:3});p.rig=makeRig(p);
  w.drops=[{x:1200,y:650,type:"bat",ammo:4,life:5}];
  w.projectiles=[{x:1200,y:650,kind:"grenade",weapon:"nuke",nuclear:true,vx:0,vy:0,r:5,life:.1}];
  w.debris=[{x:1200,y:650,w:8,h:6,angle:0,life:2}];
  w.blood=[{x:1200,y:650,r:2,vx:0,vy:0,life:4,landed:false}];
  advance(w,1);
  assert.equal(w.fields.length,1,"captured nuke never detonates");
  const before=wire.make(w.snapshot()); assert.ok(validSnapshot(before));
  advance(w,4.6);
  const core=w.wreckage.find(q=>q.kind==="matter");assert.ok(core);
  assert.ok(core.totals.every(n=>n>0),JSON.stringify(core.totals));
  assert.equal(core.totals[3],1);assert.equal(core.totals[4],2);
  assert.ok(core.items.some(q=>q.kind==="fighter" && q.color===p.color));
  assert.ok(core.items.some(q=>q.type==="rocket"));
  assert.ok(w.wreckage.some(q=>q.outer && q.hp>0 && q.outline));
  const tiles=w.platforms.filter(q=>q.wreckId===core.id);assert.equal(tiles.length,14);
  const late=await decodeState(await encodeState(wire.make(w.snapshot())));
  assert.ok(validSnapshot(late));assert.deepEqual(late.wreckage.find(q=>q.kind==="matter").totals,core.totals);
  assert.ok(validSnapshot(interpolateStates(before,late,.5)));
  const stable=structuredClone(w.wreckage);advance(w,.5);assert.deepEqual(w.wreckage,stable);
  w.damageCover(tiles[0],200);advance(w,.02);assert.ok(!w.platforms.some(q=>q.wreckId===core.id));
  w.startRound();assert.equal(w.wreckage.length,0);assert.equal(w.fields.length,0);
});
test("bounded samples retain all captured counts and reject malformed matter and live strands",()=>{
  const w=fixture(),f=blackholeField(w,{x:1100,y:700,owner:0});w.fields=[f];
  for(let i=0;i<300;i++)collectMatter(w,f,{x:1200,y:700,w:4,h:3},"debris");
  collectMatter(w,f,{x:1200,y:700,color:w.players[0].color},"fighter");
  collectMatter(w,f,{x:1200,y:700,type:"bat"},"weapon");
  assert.equal(f.matter.items.length,MATTER_LIMIT);assert.equal(f.matter.totals[6],300);
  assert.ok(f.matter.items.some(q=>q.kind==="fighter"));assert.ok(f.matter.items.some(q=>q.type==="bat"));
  const p=w.players[0];captureFighter(p,f);const a=wire.make(w.snapshot());assert.ok(validSnapshot(a));
  for(const corrupt of [s=>s.fields[0].matter.items[0].x=Infinity,s=>s.fields[0].matter.totals[3]=-1,
    s=>s.fields[0].matter.items[0].type="unknown",s=>s.fields[0].matter.items[1].id=s.fields[0].matter.items[0].id,
    s=>s.players[0].strands[0].points.pop(),s=>s.fields[0].matter.w=900]) {
    const bad=structuredClone(a);corrupt(bad);assert.equal(validSnapshot(bad),false);
  }
});
