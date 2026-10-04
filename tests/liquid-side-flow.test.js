import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS} from '../src/engine.js';
import {moveLiquid,liquids,WATER_LIMIT} from '../src/liquid.js';
import {updateReactions} from '../src/reactions.js';
import {RenderSnapshots} from '../src/render-state.js';
import {validSnapshot} from '../src/network.js';
const volume=w=>liquids(w).reduce((n,q)=>n+q.w*q.h,0);
test('a deep pool flows under an overhead obstacle and over its roof without crossing a sealed wall',()=>{
  for(const sealed of [false,true]){
    const w=new World({players:[0,1],shuffle:false});w.phase='fight';w.spills=[];w.water=[];
    w.platforms=[{x:0,y:1000,w:2560,h:24,material:'stone'},
      {x:768,y:600,w:32,h:400,material:'stone'},
      {x:832,y:800,w:64,h:sealed?200:140,material:'metal'}];
    w.water=[{id:++w.reactionSerial,x:800,y:700,w:32,h:300,vx:0,vy:0,grounded:true,frozen:0,spark:0,charge:0}];
    const before=volume(w);for(let i=0;i<180;i++)moveLiquid(w,.05);
    assert.ok(Math.abs(volume(w)-before)<1e-6);
    assert.ok(w.water.some(q=>q.x>=896&&q.h>.5));
    const under=w.water.filter(q=>q.x>=832&&q.x<896&&q.y+q.h>940);
    if(sealed)assert.equal(under.length,0);else {assert.ok(under.length>0);assert.ok(under.every(q=>q.y>=940-.01));}
  }
});
test('a continuing refinery leak spreads to both sides instead of stacking between tanks',()=>{
  const w=new World({arena:ARENAS.findIndex(a=>a.refinery),players:[0,1],shuffle:false,random:()=>.42});w.phase='fight';w.players.forEach(p=>p.alive=false);w.cover=[];
  w.damageCover(w.platforms.find(p=>p.refineryPipe===3),200);
  for(let i=0;i<1800;i++){w.time+=.05;updateReactions(w,.05);}
  const oil=w.spills.filter(q=>q.kind==='oil');
  assert.ok(oil.filter(q=>q.x<500).reduce((n,q)=>n+q.h,0)>2000);
  assert.ok(oil.filter(q=>q.x>1500).reduce((n,q)=>n+q.h,0)>3000);
  assert.ok(Math.max(...oil.map(q=>q.h))<500);assert.ok(liquids(w).length<=WATER_LIMIT);
  assert.ok(validSnapshot(new RenderSnapshots().make(w.snapshot())));
});
