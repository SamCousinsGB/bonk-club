import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS,STEP} from '../src/engine.js';
import {validSnapshot} from '../src/room-session.js';
import {RenderSnapshots} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
const total=Number(process.env.ARENA_SHARD_TOTAL||1),shard=Number(process.env.ARENA_SHARD_INDEX||0);
for(let arena=0;arena<ARENAS.length;arena++)if(arena%total===shard)test(`Crown repeated deaths and hot joins: ${ARENAS[arena].name}`,()=>{
 let seed=8123+arena;const w=new World({arena,mode:'crown',players:[0,1,2,3],shuffle:false,
  random:()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)});
 const pack=new RenderSnapshots();let respawns=0;
 for(let n=0;n<120*18;n++){
  if(w.phase==='fight'&&n%360===0){
   const p=w.players[n/360%4];if(p.alive){w.crown.holder=p.id;w.kill(p);}
  }
  w.step(STEP,{0:{right:true},1:{left:true},2:{jump:n%120<20},3:{left:true,jump:n%120<20}});
  if(n%120===0){
   assert.equal(w.phase==='result',false);
   const snapshot=pack.make(w.snapshot());assert.equal(validSnapshot(snapshot),true);
   const joined=expandSnapshot(compactSnapshot(snapshot),validSnapshot);
   assert.deepEqual(joined.crown,snapshot.crown);
   respawns=Math.max(respawns,...w.players.map(p=>p.lifeId));
   assert.ok(w.ragdolls.length<=4);assert.ok(w.chunks.length<=96);
  }
 }
 assert.ok(respawns>0,'players return to a changing arena');
});
