import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS, cleanInput } from "../src/engine.js";
import { prepareProp, bodyBounds, bodyPoints, impulseProp, CHUNK_LIMIT, PROP_TYPES, propSolids } from "../src/props.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";
import { RenderSnapshots, interpolateStates } from "../src/render-state.js";
import { blackholeField, updateBlackhole, updateWreckage } from "../src/blackhole.js";
import { nuclearField, updateNuclear } from "../src/nuclear.js";
import { hazardProps } from "../src/props.js";
import { firePhaser } from "../src/phaser.js";

const floor = (id,x,y,w,h=24) => ({id,x,y,w,h,baseX:x,baseY:y,dx:0,dy:0});
const prop = (kind="crate", extra={}) => prepareProp({id:"prop0",kind,x:500,y:950,w:90,h:50,hp:110,maxHp:110,...extra});

test("collision tiles follow prop movement, resizing, replacement shape and destruction", () => {
  const b = prop("crate", { angle: .4 });
  const tiles = propSolids(b);
  assert.equal(propSolids(b), tiles);
  const before = tiles.map(t => ({x:t.x,y:t.y,w:t.w,h:t.h}));
  b.x += 20; b.y -= 30;
  const moved = propSolids(b);
  moved.forEach((t,i) => {
    assert.ok(Math.abs(t.x-before[i].x-20)<1e-8);
    assert.ok(Math.abs(t.y-before[i].y+30)<1e-8);
  });
  b.w *= 1.5; b.h *= .8;
  const resized = propSolids(b), bounds = bodyBounds(b);
  assert.notEqual(resized, moved);
  assert.ok(Math.abs(resized.at(-1).x+resized.at(-1).w-bounds.x-bounds.w)<1e-8);
  b.shape = [[-.5,-.5],[.5,0],[-.5,.5]];
  const shaped = propSolids(b);
  assert.notDeepEqual(shaped.map(t=>t.h), resized.map(t=>t.h));
  b.dx = 12; b.dy = -8;
  assert.ok(propSolids(b).every(t=>t.dx===12&&t.dy===-8));
  b.hp = 0; assert.deepEqual(propSolids(b), []);
  b.hp = 45; assert.ok(propSolids(b).every(t=>t.hp===45));
});
function lab(kind="crate", extra={}) {
  const w = new World({players:[0,1],shuffle:false,random:()=>.43});
  w.phase="fight"; w.cover=[prop(kind,extra)]; w.chunks=[]; w.hazards=[]; w.drops=[];
  w.weaponTimer=999; w.arena={...w.arena,spikes:[]};
  w.platforms=[floor("floor",0,1000,2560)];
  w.players.forEach((p,i)=>Object.assign(p,{x:1900+i*300,y:970,vx:0,vy:0,ground:true,support:"floor"}));
  return w;
}
function advance(w,seconds) { for(let n=0;n<seconds/STEP;n++) { w.time+=STEP;w.updateCover(STEP); } }

test("every arena prop starts with a material, mass, and resettable physical state",()=>{
  for(let arena=0;arena<ARENAS.length;arena++) {
    const w=new World({arena});
    assert.ok(w.cover.every(c=>c.mass===PROP_TYPES[c.kind].mass && c.vx===0 && c.angle===0));
    assert.ok(validSnapshot(w.snapshot()),ARENAS[arena].name);
  }
});

test("equal impulses move light furniture more than heavy stone and off-centre hits cause torque",()=>{
  const light=lab("table"), heavy=lab("stone");
  for(const w of [light,heavy]) w.damageCover(w.cover[0],5,400,-160,{x:500,y:952});
  assert.ok(light.cover[0].vx>heavy.cover[0].vx*5);
  assert.ok(Math.abs(light.cover[0].spin)>Math.abs(heavy.cover[0].spin));
  advance(light,1);advance(heavy,1);
  assert.ok(light.cover[0].x>heavy.cover[0].x+20);
});

test("running fighters push props with two-way momentum and cannot walk straight through them",()=>{
  const w=lab("table"), p=w.players[0], c=w.cover[0];
  Object.assign(p,{x:470,y:970,vx:240,vy:0});
  let slowest=240;
  for(let n=0;n<90;n++) { w.time+=STEP;w.updateCover(STEP);w.move(p,cleanInput({right:true}),STEP);slowest=Math.min(slowest,p.vx); }
  assert.ok(c.x>510,`prop moved to ${c.x}`);
  assert.ok(p.x<bodyBounds(c).x+20,`fighter ${p.x}, prop ${c.x}`);
  assert.ok(slowest<220,"contact spends some of the fighter's momentum");
});

test("props settle, stay supported, and wake when their floor is destroyed",()=>{
  const w=lab("bed",{y:880}),c=w.cover[0];
  advance(w,2);const at={x:c.x,y:c.y,angle:c.angle};advance(w,2);
  assert.ok(Math.abs(c.y+c.h-1000)<1);
  assert.ok(Math.hypot(c.x-at.x,c.y-at.y)<.3);
  assert.ok(Math.abs(c.spin)<.1);
  w.platforms=[];advance(w,.3);
  assert.ok(c.y>at.y+40 && c.vy>350);
});

test("a prop balanced past a ledge tips and falls instead of sleeping on one corner",()=>{
  const w=lab("bed",{x:570,w:138,h:42,y:958});
  w.platforms=[floor("edge",300,1000,310)];advance(w,.8);
  assert.ok(Math.abs(w.cover[0].angle)>.1 || w.cover[0].y>1000);
});

test("stacked props exchange weight and remain above a solid floor",()=>{
  const w=lab();w.cover.push(prop("crate",{id:"upper",y:899}));advance(w,3);
  const [lower,upper]=w.cover;
  assert.ok(lower.y<952 && upper.y<905,`${lower.y}, ${upper.y}`);
  assert.ok(upper.y+upper.h<lower.y+3);
  assert.ok(Math.abs(lower.vy)<40 && Math.abs(upper.vy)<40);
});

test("moving platforms carry props horizontally and vertically",()=>{
  const w=lab("crate"),c=w.cover[0],f=w.platforms[0];
  for(let n=0;n<180;n++) {w.time+=STEP;f.x+=.6;f.y-=.3;f.dx=.6;f.dy=-.3;w.updateCover(STEP);}
  assert.ok(c.x>570,`x=${c.x}`);
  assert.ok(Math.abs(bodyBounds(c).y+bodyBounds(c).h-f.y)<2,`bottom=${bodyBounds(c).y+bodyBounds(c).h}, floor=${f.y}`);
});

test("fast props collide with thin walls, floors and ceilings without tunnelling",()=>{
  for(const [vx,vy,wall] of [[1500,0,floor("wall",650,600,5,400)],[0,-1500,floor("ceiling",300,800,700,5)]]) {
    const w=lab("crate",{x:550,y:900,vx,vy});w.platforms.push(wall);advance(w,.08);
    const box=bodyBounds(w.cover[0]);
    if(vx) assert.ok(box.x+box.w<wall.x+2);
    else assert.ok(box.y>wall.y+wall.h-2);
  }
});

test("a flying heavy prop can hurt and knock down a living fighter",()=>{
  const w=lab("stone",{x:400,y:930,vx:1100}),p=w.players[0];
  Object.assign(p,{x:590,y:970,vx:0,vy:0});advance(w,.16);
  assert.ok(p.hp<100);assert.ok(p.knockdown>0 || !p.alive);assert.ok(p.x>590);
});

test("impacting props transfer momentum to another prop",()=>{
  const w=lab("stone",{x:400,y:950,vx:600});w.cover.push(prop("table",{id:"target",x:550}));
  advance(w,.2);assert.ok(w.cover[1].vx>20 || w.cover[1].hp===0);
  assert.ok(w.cover[0].vx<600);
});

test("bed, desk, rock and sofa fracture into material-specific physical pieces",()=>{
  for(const kind of ["bed","table","stone","sofa"]) {
    const w=lab(kind),c=w.cover[0];w.damageCover(c,200,240,-200,{x:520,y:965});
    assert.equal(c.hp,0);assert.ok(w.chunks.length>=6);
    assert.ok(Math.abs(w.chunks.reduce((sum,b)=>sum+b.mass,0)-c.mass)<1e-8);
    assert.ok(w.chunks.every(b=>Number.isFinite(b.spin) && b.mass>0));
    if(kind==="bed") assert.deepEqual(new Set(w.chunks.map(b=>b.material)),new Set(["fabric","metal"]));
    if(kind==="stone") assert.ok(w.chunks.every(b=>b.material==="stone"&&b.shape?.length>=3));
    if(kind==="sofa") assert.ok(w.chunks.some(b=>b.material==="wood"));
    const before=structuredClone(w.chunks);advance(w,.12);
    assert.ok(w.chunks.some((b,i)=>Math.hypot(b.x-before[i].x,b.y-before[i].y)>1));
    assert.ok(!w.solids().some(s=>s.id===c.id || s.propId===c.id));
  }
});

test("resting chunks persist, collisions follow rotation, and their count stays bounded",()=>{
  const w=lab("stone");w.damageCover(w.cover[0],200);advance(w,8);
  assert.ok(w.chunks.length>0);
  assert.ok(w.chunks.every(c=>bodyBounds(c).y+bodyBounds(c).h<1002));
  for(let n=0;n<20;n++) {const c=prop("bed",{id:`extra${n}`,x:500+n*20});w.cover.push(c);w.damageCover(c,200);}
  assert.equal(w.chunks.length,CHUNK_LIMIT);
  assert.equal(new Set(w.chunks.map(c=>c.id)).size,w.chunks.length);
  const c=w.chunks[0];c.angle=.7;
  const bounds=bodyBounds(c), tiles=propSolids(c);
  assert.ok(tiles.every(t=>t.x>=bounds.x-.01 && t.x+t.w<=bounds.x+bounds.w+.01));
  assert.ok(bodyPoints(c).every(p=>tiles.some(t=>p.x>=t.x-.01 && p.x<=t.x+t.w+.01 && p.y>=t.y-.01 && p.y<=t.y+t.h+.01)));
});

test("explosions launch surviving props and existing rubble; solid walls shield them",()=>{
  const w=lab("stone");w.explode({x:440,y:940,radius:180,damage:5,force:800});
  assert.ok(w.cover[0].vx>0 && w.cover[0].hp>0);
  w.damageCover(w.cover[0],200);const c=w.chunks[0], vx=c.vx;
  w.explode({x:c.x-30,y:c.y,radius:100,damage:1,force:600});assert.ok(c.vx>vx);
  const blocked=lab();blocked.platforms.push(floor("wall",470,750,10,250));
  blocked.explode({x:440,y:940,radius:180,damage:80,force:800});assert.equal(blocked.cover[0].vx,0);
});

test("grenades bump furniture without applying their explosion before the fuse",()=>{
  const w=lab("table");
  w.projectiles=[{x:490,y:970,vx:450,vy:0,r:6,kind:"grenade",weapon:"grenade",damage:95,force:1550,life:2.8,owner:0,bounces:0,hitIds:[]}];
  w.updateProjectiles(.02);
  assert.equal(w.cover[0].hp,110);assert.ok(w.cover[0].vx>0);
  assert.equal(w.projectiles.length,1);assert.ok(w.projectiles[0].life>2.7);
});

test("faster tracers do not imply heavier hits, and bullets collide with physical rubble",()=>{
  const shot=(speed,force=200)=>({x:460,y:975,vx:speed,vy:0,r:3,kind:"bullet",damage:5,force,life:1,owner:0,hitIds:[]});
  const a=lab(),b=lab();a.projectiles=[shot(2000)];b.projectiles=[shot(4000)];
  a.updateProjectiles(.025);b.updateProjectiles(.025);
  assert.ok(Math.abs(a.cover[0].vx-b.cover[0].vx)<.001);
  const w=lab("stone");w.damageCover(w.cover[0],200);
  const c=w.chunks[0];w.chunks=[c];
  w.projectiles=[{...shot(4000,1000),x:c.x-40,y:c.y+c.h/2}];
  const hp=c.hp,vx=c.vx;w.updateProjectiles(.025);
  assert.ok(c.hp<hp);assert.ok(c.vx>vx);assert.equal(w.projectiles.length,0);
});

test("all arenas keep valid, bounded physical rubble after repeated destruction and motion",()=>{
  for(let arena=0;arena<ARENAS.length;arena++) {
    const w=new World({arena,random:()=>.43});w.phase="fight";w.hazards=[];w.drops=[];
    for(const c of w.cover)w.damageCover(c,200,300,-180,{x:c.x,y:c.y});
    for(let n=0;n<120;n++) {w.time+=STEP;w.updateCover(STEP);}
    assert.ok(w.chunks.length<=CHUNK_LIMIT);assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())),ARENAS[arena].name);
  }
});

test("conveyors carry rubble and saw fixtures break intact objects",()=>{
  const w=lab(),c=w.cover[0],zone={x:400,y:900,w:300,h:100};
  hazardProps(w,{type:"conveyor",dir:1,y:1000},zone,STEP);assert.ok(c.vx>0);
  hazardProps(w,{type:"saw",bodyX:550,bodyY:975,dir:1},zone,STEP);assert.equal(c.hp,0);assert.ok(w.chunks.length>0);
});

test("black holes capture loose chunks into real wreckage, and nukes consume it without respawning props",()=>{
  const w=lab("bed");w.damageCover(w.cover[0],200);
  const f=blackholeField(w,{x:550,y:940,owner:0});w.fields=[f];updateBlackhole(w,f,.41);updateWreckage(w,STEP);
  assert.equal(w.chunks.length,0);assert.ok(w.wreckage.some(b=>b.kind==="prop"&&b.spine));
  assert.ok(w.wreckage.some(b=>b.sourceChunk && b.material==="fabric"));
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  const other=lab("stone");other.damageCover(other.cover[0],200);
  const n=nuclearField(other,{x:550,y:940,owner:0});updateNuclear(other,n,.4);
  assert.equal(other.chunks.length,0);assert.equal(other.cover.length,0);
  advance(other,.2);assert.equal(other.chunks.length,0);
});

test("PHASER consumes rotated props and rubble in its corridor and leaves pieces behind the muzzle intact",()=>{
  const w=lab("stone");w.damageCover(w.cover[0],200);
  const protectedPiece={...w.chunks[0],id:"protected",x:100};w.chunks.push(protectedPiece);
  const p=w.players[0];Object.assign(p,{x:300,y:980});
  firePhaser(w,p,1,0);
  assert.deepEqual(w.chunks.map(c=>c.id),["protected"]);
});

test("props and persistent chunks survive bounded wire transport and hot join with stable interpolation",async()=>{
  const w=lab("bed");w.cover.push(prop("stone",{id:"stone",x:900}));
  w.damageCover(w.cover[0],200,200,-100);
  const encoder=new RenderSnapshots(),a=encoder.make(w.snapshot());
  const payload=await encodeState(a), joined=await decodeState(payload);
  assert.ok(validSnapshot(joined));assert.deepEqual(joined.chunks,a.chunks);
  w.cover[1].x+=30;w.cover[1].angle=3.13;
  const b=encoder.make(w.snapshot());b.cover[1].angle=-3.13;a.cover[1].angle=3.13;
  b.chunks.shift();b.chunks[0].x+=40;
  const blend=interpolateStates(a,b,.5);
  assert.equal(blend.chunks[0].x,b.chunks[0].x-20);
  assert.ok(Math.abs(blend.cover[1].angle)>3.1);
  w.startRound();assert.equal(w.chunks.length,0);assert.ok(w.cover.every(c=>c.hp===c.maxHp&&c.vx===0));
});

test("snapshots reject invalid mass, spin, shape, duplicate identity and unbounded rubble",()=>{
  const w=lab();w.damageCover(w.cover[0],200);
  for(const mutate of [s=>s.chunks[0].mass=0,s=>s.chunks[0].vx=Infinity,s=>s.chunks[0].spin=19,
    s=>s.chunks[0].material="unknown",s=>s.chunks[0].shape=[[0,0],[.6,0],[0,.5]],
    s=>s.chunks[0].shape=[[0,0],[0,0],[0,0]],
    s=>s.chunks[0].shape=[[-.5,-.5],[.5,.5],[-.5,.5],[.5,-.5]],
    s=>s.chunks[1].id=s.chunks[0].id,s=>s.chunks=Array(97).fill(s.chunks[0])]) {
    const s=structuredClone(w.snapshot());mutate(s);assert.equal(validSnapshot(s),false);
  }
});
