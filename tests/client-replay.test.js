import test from 'node:test';
import assert from 'node:assert/strict';
import { World, STEP } from '../src/engine.js';
import { RenderSnapshots } from '../src/render-state.js';
import { FlightReplayer, compactFlights } from '../src/flight-replay.js';
import { MatterReplayer, compactMatter } from '../src/matter-replay.js';
import { blackholeField } from '../src/blackhole.js';
import { collectMatter, packMatter } from '../src/accretion.js';
import { SnapshotHistory } from '../src/snapshot-delta.js';
import { compactSnapshot, expandSnapshot } from '../src/snapshot-wire.js';
import { validSnapshot, encodeState, decodeState } from '../src/network.js';

const json=s=>JSON.parse(JSON.stringify(s));
const pose=b=>Object.fromEntries(['x','y','vx','vy','age','life'].map(k=>[k,b[k]||0]));
test('ballistic recipes match real host flight through gravity, bounce, packet loss and late join',()=>{
  const w=new World({players:[0,1],random:()=>.5});
  w.platforms=[];w.cover=[];w.chunks=[];w.hazards=[];w.fields=[];
  for(const p of w.players)Object.assign(p,{x:2000,y:1200});
  Object.assign(w.players[0],{x:400,y:100,weapon:'grenade',ammo:10,aimAngle:.2});
  w.attack(w.players[0]);w.platforms=[{id:'floor',x:0,y:500,w:2560,h:35}];
  const encoder=new RenderSnapshots(),replay=new FlightReplayer();let bounced=false,continued=false;
  for(let n=0;n<250;n++) {
    w.updateProjectiles(STEP);if(!w.projectiles.length)break;
    const b=w.projectiles[0];bounced ||= b.bounces<0;
    if(n%7!==0)continue;
    const state=compactFlights(encoder.make(w.snapshot()));assert.equal(state.projectiles[0].x,undefined);
    continued ||= state.projectiles[0].flight.steps>10;
    const guest=replay.expand(json(state)),late=new FlightReplayer().expand(json(state));
    assert.deepEqual(pose(guest.projectiles[0]),pose(b),`host step ${n}`);
    assert.deepEqual(pose(late.projectiles[0]),pose(b));
    guest.projectiles[0].x=999;assert.deepEqual(pose(replay.expand(json(state)).projectiles[0]),pose(b));
  }
  assert.ok(bounced);assert.ok(continued);
});

test('invalid flight recipes reject excessive work and non-finite state',()=>{
  const w=new World({players:[0,1]});Object.assign(w.players[0],{weapon:'blaster',ammo:10});w.attack(w.players[0]);w.updateProjectiles(STEP);
  const state=compactFlights(new RenderSnapshots().make(w.snapshot()));assert.ok(state.projectiles[0].flight);
  for(const mutate of [b=>b.flight.steps=1001,b=>b.flight.seed.dt=1,b=>b.flight.seed.x=Infinity,b=>b.netId=-1]) {
    const bad=structuredClone(state);mutate(bad.projectiles[0]);assert.throws(()=>new FlightReplayer().expand(bad));
  }
});

test('black-hole samples reproduce exact orbit and packing after new captures and late join',async()=>{
  const w=new World({players:[0,1],random:()=>.5});const f=blackholeField(w,{x:1000,y:700,owner:0});w.fields=[f];
  for(let i=0;i<100;i++)collectMatter(w,f,{x:850+i*2,y:600+i,w:20,h:10,vx:i,vy:100-i},'debris');
  const encoder=new RenderSnapshots(),replay=new MatterReplayer();let advanced=false;
  for(let n=0;n<670&&f.life>0;n++) {
    f.age+=STEP;f.life=Math.max(0,f.life-STEP);
    if(n===100)collectMatter(w,f,{...w.players[1],x:1100,y:740},'fighter');
    packMatter(f,STEP);
    if(n%13!==0||!f.life)continue;
    const state=compactMatter(encoder.make(w.snapshot()));advanced ||= state.fields[0].matter.orbit.steps>20;
    assert.equal(state.fields[0].matter.items[0].x,undefined);
    for(const client of [replay,new MatterReplayer()]) {
      const received=client.expand(json(state)).fields[0].matter;
      assert.deepEqual(received.items.map(q=>[q.x,q.y,q.angle]),f.matter.items.map(q=>[q.x,q.y,q.angle]),`step ${n}`);
      assert.deepEqual(received.totals,f.matter.totals);
      assert.equal(received.packing,f.matter.packing);
    }
  }
  assert.ok(advanced);f.life=0;packMatter(f,0);w.fields=[];w.wreckage.push(f.matter);
  const state=encoder.make(w.snapshot());assert.equal(state.wreckage[0].orbit,undefined);
  const received=expandSnapshot(await decodeState(await encodeState(compactSnapshot(state))),validSnapshot);
  assert.deepEqual(received.wreckage[0],state.wreckage[0]);assert.equal(received.wreckage[0].packing,1);
  assert.ok(received.wreckage[0].items.some(q=>q.kind==='fighter'));
});

test('steady black-hole contents and flying shots need tick changes rather than repeated poses',async()=>{
  const w=new World({players:[0,1],random:()=>.5});w.platforms=[];w.cover=[];w.chunks=[];w.hazards=[];
  const f=blackholeField(w,{x:1000,y:700,owner:0});w.fields=[f];
  for(let i=0;i<96;i++)collectMatter(w,f,{x:850+i*2,y:600+i,w:20,h:10,vx:i,vy:100-i},'debris');
  for(let i=0;i<40;i++){Object.assign(w.players[0],{weapon:'blaster',ammo:10,aimAngle:-1+i*.02});w.attack(w.players[0]);}
  const encoder=new RenderSnapshots(),old=new SnapshotHistory(),next=new SnapshotHistory();let oldBytes=0,newBytes=0;
  for(let seq=1;seq<=31;seq++) {
    for(let i=0;i<4;i++){f.age+=STEP;f.life-=STEP;packMatter(f,STEP);w.updateProjectiles(STEP);}
    const raw=encoder.make(w.snapshot()),compact=compactMatter(compactFlights(raw));
    // Compare the same snapshots against the old coordinate transport.
    const legacy=structuredClone(raw);delete legacy.fields[0].matter.orbit;legacy.projectiles.forEach(b=>delete b.flight);
    if(seq>1){oldBytes+=(await encodeState(old.encode(legacy,seq-1))).length;newBytes+=(await encodeState(next.encode(compact,seq-1))).length;}
    old.remember(seq,legacy);next.remember(seq,compact);
  }
  assert.ok(newBytes<oldBytes*.25,`${oldBytes} -> ${newBytes} bytes`);
  console.log(`Steady matter/flight deltas: ${oldBytes} -> ${newBytes} bytes (${Math.round(100*(1-newBytes/oldBytes))}% less)`);
  const bad=compactMatter(encoder.make(w.snapshot()));bad.fields[0].matter.orbit.steps=1001;
  assert.throws(()=>new MatterReplayer().expand(bad));
});

test('entity reordering reuses survivor state and rejects duplicate indices or unfilled births',()=>{
  const h=new SnapshotHistory(),a={round:1,arenaIndex:0,list:Array.from({length:100},(_,i)=>({netId:i+1,art:'x'.repeat(100),x:i}))};
  const b={...a,list:[...a.list.slice(1).reverse(),{netId:101,art:'new',x:99}]};h.remember(1,a);
  const encoded=h.encode(b,1);assert.deepEqual(encoded.patch.list[0].slice(0,3),[99,98,97]);
  const decoded=h.decode(json(encoded),2);assert.deepEqual(decoded,b);assert.equal(decoded.list[0],a.list[99]);
  assert.ok(JSON.stringify(encoded).length<JSON.stringify(b).length*.1);
  for(const order of [[-1],[100],[-2],[0,0],[1.5]])assert.throws(()=>h.decode({base:1,patch:{list:[order,{}]}},2));
});
