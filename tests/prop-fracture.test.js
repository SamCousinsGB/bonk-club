import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS} from '../src/engine.js';
import {fractureProp,bodyPoints} from '../src/props.js';
import {RenderSnapshots} from '../src/render-state.js';
import {validSnapshot,encodeState,decodeState} from '../src/network.js';
import {blackholeField,updateBlackhole} from '../src/blackhole.js';

function rng(seed) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
test('fractures retain bounded source artwork and convex collision across every prop size and varied cracks',()=>{
  for(let arena=0;arena<ARENAS.length;arena++)for(let seed=1;seed<=12;seed++) {
    const w=new World({arena,random:rng(seed)});
    for(const prop of w.cover) {
      w.chunks=[];prop.angle=.7;fractureProp(w,prop);
      assert.ok(w.chunks.length>=6 && w.chunks.length<=10);
      assert.ok(Math.abs(w.chunks.reduce((sum,p)=>sum+p.mass,0)-prop.mass)<1e-8);
      for(const p of w.chunks) {
        assert.ok(p.sourceArt && p.shape.length>=3);
        assert.equal(p.sourceArt[4],prop.w);assert.equal(p.sourceArt[5],prop.h);
        const points=bodyPoints(p);assert.ok(points.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));
      }
      assert.ok(w.chunks.filter(p=>p.shape.some((a,i)=>{
        const b=p.shape[(i+1)%p.shape.length];return Math.abs(a[0]-b[0])>.1&&Math.abs(a[1]-b[1])>.1;
      })).length>=4,'most shards have oblique broken edges');
      assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())),`${arena}, ${seed}, ${prop.kind}`);
    }
  }
});
test('different breaks do not repeat a tiled grid of identical pieces',()=>{
  const w=new World({random:rng(3)}),p=w.cover.find(p=>p.kind==='table')||w.cover[0];
  fractureProp(w,p);const first=w.chunks.map(c=>c.shape);w.chunks=[];fractureProp(w,p);
  assert.notDeepEqual(w.chunks.map(c=>c.shape),first);
  assert.ok(new Set(w.chunks.map(c=>JSON.stringify(c.shape))).size>=4);
});
test('original sprite crops survive black-hole capture, compressed hot join and round reset',async()=>{
  const w=new World({players:[0,1],random:rng(1)}),p=w.cover[0];
  w.cover=[p];fractureProp(w,p);p.hp=0;
  const sources=new Map(w.chunks.map(c=>[JSON.stringify(c.shape),c.sourceArt]));
  const f=blackholeField(w,{x:p.x+p.w/2,y:p.y+p.h/2,owner:0});w.fields=[f];updateBlackhole(w,f,.41);
  const state=new RenderSnapshots().make(w.snapshot()),joined=await decodeState(await encodeState(state));
  assert.ok(validSnapshot(joined));
  const fragments=joined.wreckage.filter(b=>b.sourceChunk);
  assert.ok(fragments.length>=6);
  for(const b of fragments)assert.deepEqual(b.sourceArt,sources.get(JSON.stringify(b.shape)));
  w.startRound();assert.equal(w.chunks.length,0);assert.equal(w.wreckage.length,0);
});
test('sprite crop validation rejects oversized, nonfinite, missing-shape and out-of-source data',()=>{
  const w=new World({random:rng(1)});fractureProp(w,w.cover[0]);
  for(const mutate of [b=>b.sourceArt=[0,0,10,10,100000,100000],b=>b.sourceArt[0]=-1,
    b=>b.sourceArt[1]=NaN,b=>b.sourceArt[2]=0,b=>b.sourceArt[3]=300,
    b=>b.sourceArt.push(1),b=>delete b.shape,b=>b.sourceArt={}]) {
    const s=structuredClone(w.snapshot());mutate(s.chunks[0]);assert.equal(validSnapshot(s),false);
  }
});
