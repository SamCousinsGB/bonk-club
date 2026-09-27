import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS} from '../src/engine.js';
import {updateHazards} from '../src/hazards.js';
import {carveExplosion} from '../src/terrain.js';
import {TRAIN_Y,TRAIN_CYCLE} from '../src/setpiece-arenas.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots} from '../src/render-state.js';

test('repeated monorail crashes keep alternating, bounded and valid through a long round',()=>{
  for(const gaps of [[25,1280,2535],[1280]]){
    const w=new World({arena:ARENAS.findIndex(a=>a.theme==='railway'),players:[0,1],shuffle:false,random:()=>.4});
    w.phase='fight';w.cover=[];for(const p of w.players)p.alive=false;
    for(const x of gaps)carveExplosion(w,{x,y:TRAIN_Y,radius:90});
    const h=w.hazards[0],directions=[];let previous=false;
    for(let i=0;i<TRAIN_CYCLE*20*30;i++){
      updateHazards(w,1/30);
      if(h.derailed&&!previous)directions.push(h.dir);previous=h.derailed;
      assert.ok(w.hazards.length<=8);assert.ok(w.chunks.length<=96);
      if(i%150===0)assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())),`gaps ${gaps} frame ${i}`);
    }
    assert.deepEqual(directions,Array.from({length:20},(_,i)=>i%2?-1:1));
  }
});
