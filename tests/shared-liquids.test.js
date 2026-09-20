import { carveExplosion } from '../src/terrain.js';
import { updateLadle } from '../src/foundry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS } from '../src/engine.js';
import { emitLiquid, liquids, moveLiquid, liquidForces, WATER_LIMIT } from '../src/liquid.js';
import { liquidBounds } from '../src/liquid-geometry.js';
import { updateReactions } from '../src/reactions.js';
import { BARRELS } from '../src/barrels.js';
import { prepareProp } from '../src/props.js';
import { RenderSnapshots } from '../src/render-state.js';
import { validSnapshot, encodeState, decodeState } from '../src/network.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';
import { poweredWirePieces } from '../src/powerline-circuit.js';
import { segmentBox } from '../src/collision.js';

const solid=(id,x,y,w,h,material='stone')=>({id,x,y,w,h,material,baseX:x,baseY:y,dx:0,dy:0});
const parcel=(id,y,h=.2)=>({id,x:800,y,w:32,h,vx:0,vy:900,grounded:false,frozen:0,spark:0,charge:0});
const amount=w=>liquids(w).reduce((n,q)=>n+q.h*q.w,0);
function lab() {
  const w=new World({players:[0,1],shuffle:false,random:()=>.4});
  Object.assign(w,{phase:'fight',platforms:[solid('floor',0,1000,2560,24)],cover:[],chunks:[],water:[],spills:[],gas:[],hazards:[],cables:[],drops:[],reactionClock:0});
  w.players.forEach((p,i)=>Object.assign(p,{x:2100+i*100,y:970,vx:0,vy:0}));
  return w;
}

test('thin falling water closes a live wire / stream / metal circuit and a real air gap opens it',()=>{
  const w=lab();w.platforms=[solid('receiver',812,575,8,40,'metal')];
  w.hazards=[{type:'powerline',circuit:0,age:8,active:true}];
  w.cables=[{id:'tower0',attached:[true,true],links:[true],points:[{x:700,y:500},{x:1100,y:500}]}];
  w.water=[parcel(1,510),parcel(2,560)];
  updateReactions(w,.05);
  assert.ok(w.water.every(q=>q.charge===1));assert.equal(w.platforms[0].charge,1);
  // Both parcels are much thinner than the old half-unit conduction cutoff.
  assert.ok(w.water.every(q=>q.h<.5));
  w.water[0].x=1400;w.cables[0].attached=[false,false];updateReactions(w,.05);
  assert.equal(w.platforms[0].charge,0);assert.ok(w.water.every(q=>!q.charge));
});

for(const kind of ['water','oil','glue','tar','molten'])test(`${kind} uses finite deep pools, dam breaks, wall collision and body currents`,()=>{
  const w=lab();w.platforms.push(solid('left',608,650,32,350),solid('right',832,650,32,350));
  const accepted=emitLiquid(w,kind,720,850,1000);
  for(let i=0;i<80;i++)moveLiquid(w,.05);
  assert.ok(liquids(w).some(q=>q.h>70));assert.ok(liquids(w).every(q=>q.x>=640&&q.x<832));
  assert.ok(Math.abs(amount(w)-accepted*32)<1e-6);
  w.platforms=w.platforms.filter(p=>p.id!=='right');for(let i=0;i<60;i++)moveLiquid(w,.05);
  assert.ok(liquids(w).some(q=>q.x>900));assert.ok(Math.abs(amount(w)-accepted*32)<1e-6);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
  const q=liquids(w).find(q=>q.h>3);q.h=100;q.y=900;q.vx=600;q.grounded=true;
  const p=w.players[0];Object.assign(p,{x:q.x+16,y:950,vx:0,vy:0});
  liquidForces(w,.05);assert.ok(p.vx>50);assert.ok(p.knockdown>0);
});

test('oil remains insulating while molten metal can carry electricity through the same geometry',()=>{
  for(const kind of ['oil','glue','tar','molten']) {
    const w=lab();w.platforms=[solid('a',640,1000,96,20,'metal'),solid('b',768,1000,96,20,'metal'),solid('base',0,1020,2560,30)];
    emitLiquid(w,kind,752,1020,40,{depth:40});w.platforms[0].spark=.7;
    updateReactions(w,.05);assert.equal(w.platforms[1].charge||0,kind==='molten'?1:0);
  }
});

test('all liquids share one admission budget and rejected contents remain inside the container',()=>{
  const w=lab();w.platforms=[];
  for(const [i,kind] of ['water','oil','glue','tar','molten'].entries())emitLiquid(w,kind,1200,200+i*220,20000);
  assert.equal(liquids(w).length,WATER_LIMIT);
  const b=prepareProp({id:'oil',kind:'oilBarrel',x:800,y:900,w:70,h:90,hp:80,liquidLeft:500,liquidCapacity:500});w.cover=[b];
  const before=amount(w);w.damageCover(b,1000);
  assert.equal(b.hp,1);assert.equal(b.liquidLeft,500);assert.equal(amount(w),before);
});

test('container sizes, capacity and mass vary throughout the arena rotation without changing templates',()=>{
  const templates=JSON.stringify(ARENAS);let changed=0,oilChanged=0;
  for(let arena=0;arena<ARENAS.length;arena++) {
    const a=new World({arena,shuffle:false,random:()=>.05}),b=new World({arena,shuffle:false,random:()=>.95});
    for(const small of a.cover.filter(q=>q.kind==='waterTank'||BARRELS[q.kind]?.contents)) {
      const large=b.cover.find(q=>q.id===small.id);assert.ok(large);
      assert.ok(small.w<=large.w && small.h<=large.h);
      if(small.w<large.w){changed++;if(BARRELS[small.kind]?.contents)oilChanged++;assert.ok(small.mass<large.mass);}
      const key=small.kind==='waterTank'?'water':'liquid';
      assert.equal(small[key+'Left'],small[key+'Capacity']);assert.ok(small[key+'Capacity']<=large[key+'Capacity']);
    }
    assert.ok(validSnapshot(a.snapshot()));assert.ok(validSnapshot(b.snapshot()));
  }
  assert.ok(changed>ARENAS.length);assert.ok(oilChanged>10);assert.equal(JSON.stringify(ARENAS),templates);
});

test('mixed flowing liquids and random container capacities survive compressed hot join and reset',async()=>{
  const w=lab();for(const [i,kind] of ['water','oil','glue','tar','molten'].entries())emitLiquid(w,kind,400+i*350,700,240,{vx:140,vy:300});
  for(let i=0;i<5;i++)moveLiquid(w,.05);
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  const copy=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(copy.water,s.water);assert.deepEqual(copy.spills,s.spills);
  for(const list of ['water','spills'])for(const key of ['vx','vy','h','charge']) {
    const bad=structuredClone(s);bad[list][0][key]=Infinity;assert.equal(validSnapshot(bad),false);
  }
  w.startRound();assert.equal(w.spills.length,0);
});

test('a microscopic conductive film retains positive volume after network quantization',()=>{
  const w=lab();w.water=[{...parcel(1,999.9999,.0001),grounded:true,vy:0}];
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(s.water[0].h>0);assert.ok(validSnapshot(s));
  for(const vy of [0,100,1000]) {
    const q={...parcel(2,500,3),vy},b=liquidBounds(q);
    assert.ok(Math.abs(b.w*b.h-q.w*q.h)<1e-9);
  }
});

test('punctured tower tanks conduct at every visible falling-wire contact across container sizes',()=>{
  for(const random of [.05,.4,.95]) {
    const w=new World({arena:ARENAS.findIndex(a=>a.transmission),players:[0,1],shuffle:false,random:()=>random});
    w.phase='fight';for(const h of w.hazards)h.age=8;
    const tank=w.cover.filter(b=>b.kind==='waterTank'&&b.x>800&&b.x<1000).sort((a,b)=>a.y-b.y)[0];
    w.damageCover(tank,1);let touching=0;
    for(let i=0;i<160;i++) {
      w.time+=.05;updateReactions(w,.05);const wires=poweredWirePieces(w);
      for(const q of w.water.filter(q=>!q.grounded))if(wires.some(s=>segmentBox(s.a.x,s.a.y,s.b.x,s.b.y,liquidBounds(q),5))) {
        touching++;assert.equal(q.charge,1,`size ${tank.w}, tick ${i}`);
      }
    }
    assert.ok(touching>200);assert.ok(tank.waterLeft<tank.waterCapacity);
    for(const cable of w.cables)cable.attached=[false,false];
    updateReactions(w,.05);assert.ok(w.water.every(q=>!q.charge));
  }
});

test('falling fluid never draws or conducts a tail above the source it has left',()=>{
  const w=lab();w.platforms=[];emitLiquid(w,'water',816,600,1,{vy:900});
  const top=w.water[0].y;
  for(let i=0;i<4;i++){moveLiquid(w,.05);assert.ok(liquidBounds(w.water[0]).y>=top-1e-6);}
});


test('a ladle emits only its remaining finite metal and stops pouring when empty',()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.theme==='foundry'),shuffle:false});w.phase='fight';
  const h=w.hazards.find(h=>h.type==='ladle');h.age=6.5;h.ladleLeft=2;
  const before=amount(w);updateLadle(w,h,.05);
  assert.equal(h.ladleLeft,0);assert.ok(Math.abs(amount(w)-before-64)<1e-6);
  updateLadle(w,h,.05);assert.equal(h.active,false);assert.equal(h.warning,0);
  assert.ok(Math.abs(amount(w)-before-64)<1e-6);assert.ok(validSnapshot(w.snapshot()));
});


for(const theme of ['foundry','furnace'])test(`${theme} retains its molten pools until actual terrain is breached`,()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.theme===theme),shuffle:false});w.phase='fight';
  const before=amount(w);
  for(let i=0;i<100;i++)moveLiquid(w,.05);
  assert.ok(Math.abs(amount(w)-before)<1e-6);
  const h=w.hazards.find(h=>h.type==='slag');
  carveExplosion(w,{x:h.x,y:h.y,radius:85});let drained=false;
  for(let i=0;i<30;i++){moveLiquid(w,.05);drained ||=w.spills.some(q=>q.y+q.h>h.y+30);}
  assert.ok(drained);assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});
