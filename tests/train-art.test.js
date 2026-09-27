import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainCrashEffects, trainScrapeContacts } from '../src/train-wreck-art.js';
import { synthesizeTrainCrash } from '../src/train-sound.js';

const car=()=>({id:0,x:800,y:985,vx:1200,vy:0,angle:0,crush:0,coupled:false});
const state=c=>({arenaIndex:34,round:1,time:1,platforms:[{x:0,y:1060,w:2560,h:44}],hazards:[{id:1,type:'train',derailed:true,carriages:[c]}]});
test('grinding sparks require surviving contact and motion, including rotated roof contact',()=>{
  const c=car(),s=state(c);assert.ok(trainScrapeContacts(c,s.platforms).length);
  assert.equal(trainScrapeContacts({...c,y:700},s.platforms).length,0);
  assert.equal(trainScrapeContacts(c,[]).length,0);
  assert.equal(trainScrapeContacts({...c,vx:0},s.platforms).length,0);
  assert.ok(trainScrapeContacts({...c,angle:Math.PI},s.platforms).length);
});
test('crash fragments are bounded, inert on stale frames and clear on reset and reduced motion',()=>{
  const fx=new TrainCrashEffects(),c=car(),s=state(c);fx.update(s);assert.equal(fx.particles.length,0);
  s.time+=.05;c.crush=.4;fx.update(s);assert.ok(fx.particles.some(p=>p.kind==='glass'));
  const count=fx.particles.length;for(let i=0;i<50;i++)fx.update(s);assert.equal(fx.particles.length,count);
  for(let i=0;i<500;i++){s.time+=.02;fx.update(s);}assert.ok(fx.particles.length<=260);
  fx.update(s,true);assert.equal(fx.particles.length,0);
  s.time+=.05;fx.update(s);assert.ok(fx.particles.length);s.round++;fx.update(s);assert.equal(fx.particles.length,0);
});
test('a hot-joined or stationary wreck does not replay impact bursts or keep generating sparks',()=>{
  const fx=new TrainCrashEffects(),c={...car(),crush:.8,ruptured:true,energy:0,vx:0},s=state(c);
  for(let i=0;i<300;i++){s.time+=.02;fx.update(s);}assert.equal(fx.particles.length,0);
});
test('crash audio is finite, varied and fades without clipping',()=>{
  const a=synthesizeTrainCrash(24000),b=synthesizeTrainCrash(24000,1);
  assert.equal(a.length,64800);assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.74));
  assert.ok(Math.abs(a[0])<1e-6&&Math.abs(a.at(-1))<.001);assert.notDeepEqual(a,b);
  const power=(from,to)=>a.slice(from*24000,to*24000).reduce((sum,v)=>sum+v*v,0)/((to-from)*24000);
  assert.ok(power(.02,.3)>power(2.4,2.6)*5);
});
