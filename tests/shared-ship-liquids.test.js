import test from 'node:test';
import assert from 'node:assert/strict';
import { World, ARENAS } from '../src/engine.js';
import { flowLiquidReservoirs } from '../src/liquid.js';
import { liquidPolygonHit } from '../src/liquid-geometry.js';
import { absorbShipWater, shipWaterRegions, shipCapacity, shipWaterAt } from '../src/ship.js';
import { reactionContacts, contactReaction, updateReactions } from '../src/reactions.js';
import { RenderSnapshots } from '../src/render-state.js';
import { validSnapshot, encodeState, decodeState } from '../src/network.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';

const fixture=()=>new World({arena:ARENAS.findIndex(a=>a.ship),players:[0,1],shuffle:false,random:()=>.4});
const water=(id,x,bottom,h)=>({id,x,y:bottom-h,w:32,h,vx:0,vy:0,grounded:true,frozen:0,charge:0,spark:0,fallDistance:0});

test('shared reservoir exchange conserves every material and bounds competing openings',()=>{
  for(const kind of ['water','oil','glue','tar','molten']) {
    const v=[50,100,0],capacity=[80,100,100];
    const ports=[{i:0,j:1,head:1000,width:500,direction:1},{i:2,j:1,head:1000,width:500,direction:1}];
    flowLiquidReservoirs(v,capacity,ports,10,kind);
    assert.deepEqual(v,[80,0,70]);assert.equal(v.reduce((a,b)=>a+b),150);
    flowLiquidReservoirs(v,capacity,[{i:2,j:-1,head:1000,width:500,direction:1}],10,kind);
    assert.equal(v[2],100);
    flowLiquidReservoirs(v,capacity,[{i:2,j:-1,head:-1000,width:500,direction:1}],10,kind);
    assert.equal(v[2],0);
  }
});

test('spilled tank water joins flood mass only at a real water surface or the hull floor',()=>{
  const w=fixture();w.water=[water(1,800,1130,10),water(2,800,800,10)];
  w.water[0].spark=.4;w.water[0].charge=1;
  absorbShipWater(w);assert.equal(w.ship.volumes[1],320);assert.equal(w.water.length,1);
  assert.equal(w.ship.sparks[1],.4);assert.equal(w.ship.charges[1],1);
  assert.equal(w.water[0].id,2);
  w.ship.volumes[1]=shipCapacity(1)-100;w.water=[water(3,800,1000,10)];
  absorbShipWater(w);assert.equal(w.ship.volumes[1],shipCapacity(1));
  assert.equal(w.water[0].w*w.water[0].h,220);assert.equal(w.water[0].y+w.water[0].h,1000);
  absorbShipWater(w);assert.equal(w.water[0].w*w.water[0].h,220);
});

test('tilted floodwater contacts use the wet polygon and exclude its dry bounding-box corner',()=>{
  const w=fixture();w.ship.volumes[2]=80000;w.ship.angle=.3;
  const q=shipWaterRegions(w)[0],x=q.x+20,y=q.y+15;
  assert.equal(shipWaterAt(w,x,y),null);
  assert.equal(liquidPolygonHit(q.polygon,x,y,x+10,y,1),null);
  assert.ok(liquidPolygonHit(q.polygon,1280,1100,1290,1100,1));
  assert.equal(reactionContacts(w,{kind:'tesla',r:1},x,y,x+10,y).length,0);
});

test('Tesla powers a flooded room and wet metal, shocks immersed fighters and clears after expiry',()=>{
  const w=fixture();w.phase='fight';w.platforms=[];w.cover=[];w.chunks=[];w.hazards=[];w.cables=[];
  w.ship.volumes[2]=80000;w.ship.angle=.3;
  const q=shipWaterRegions(w)[0];
  Object.assign(w.players[0],{x:1280,y:1070,rig:null});
  Object.assign(w.players[1],{x:q.x+30,y:q.y+35,rig:null});
  const metal={id:'wet-metal',x:1390,y:1100,w:50,h:15,material:'metal'};w.platforms=[metal];
  const shot={kind:'tesla',r:1},hit=reactionContacts(w,shot,1280,700,1280,1100)[0];
  assert.ok(hit);assert.equal(contactReaction(w,shot,hit),true);updateReactions(w,.05);
  assert.equal(w.ship.charges[2],1);assert.equal(metal.charge,1);
  assert.ok(w.players[0].hp<100);assert.equal(w.players[1].hp,100);
  for(let i=0;i<16;i++)updateReactions(w,.05);
  assert.equal(w.ship.charges[2],0);assert.equal(metal.charge,0);
  w.ship.sparks[2]=.6;w.ship.charges[2]=1;w.ship.volumes[2]=0;updateReactions(w,.05);
  assert.equal(w.ship.sparks[2],0);assert.equal(w.ship.charges[2],0);
  w.ship.volumes[2]=80000;updateReactions(w,.05);assert.equal(w.ship.charges[2],0);
});

test('flood circuits survive validated compressed hot join and reset without retained charge',async()=>{
  const w=fixture();w.ship.volumes[1]=80000;w.ship.charges[1]=1;w.ship.sparks[1]=.6;
  const s=new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
  const copy=expandSnapshot(await decodeState(await encodeState(compactSnapshot(s))),validSnapshot);
  assert.deepEqual(copy.ship,s.ship);
  for(const key of ['charges','sparks'])for(const value of [NaN,Infinity,-.1,1.1]) {
    const bad=structuredClone(s);bad.ship[key][1]=value;assert.equal(validSnapshot(bad),false);
  }
  w.startRound();assert.ok(w.ship.charges.every(v=>v===0));assert.ok(w.ship.sparks.every(v=>v===0));
  assert.ok(w.ship.volumes.every(v=>v===0));
});
