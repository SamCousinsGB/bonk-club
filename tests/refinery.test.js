import test from 'node:test';
import assert from 'node:assert/strict';
import {World,ARENAS} from '../src/engine.js';
import {updateRefinery,pipeOpening,tankOpenings,heatRefinery,refineryDanger,refineryLiquids} from '../src/refinery.js';
import {REFINERY_TANKS as TANKS,REFINERY_PIPES as PIPES,REFINERY_ROUTES as ROUTES} from '../src/refinery-arena.js';
import {carveExplosion} from '../src/terrain.js';
import {validSnapshot} from '../src/network.js';
import {RenderSnapshots,interpolateStates} from '../src/render-state.js';
import {compactSnapshot,expandSnapshot} from '../src/snapshot-wire.js';
import {SnapshotHistory} from '../src/snapshot-delta.js';
import {updateReactions,heatReactions} from '../src/reactions.js';
import {liquidForces} from '../src/liquid.js';
import {RefinerySound,REFINERY_SOUNDS,synthesizeRefinery} from '../src/refinery-sound.js';
const fixture=()=>{const w=new World({arena:ARENAS.findIndex(a=>a.refinery),players:[0,1,2,3],shuffle:false,random:()=>.42});w.phase='fight';return w;};
const advance=(w,t)=>{for(let i=0;i<Math.round(t/.05);i++)updateRefinery(w,.05);};
const stored=r=>r.tanks.reduce((s,q)=>s+q.volume,0)+r.pipes.reduce((s,q)=>s+q.volume,0)+r.products.reduce((s,q)=>s+q,0)+r.released+r.combusted;
const transport=w=>JSON.parse(JSON.stringify(expandSnapshot(compactSnapshot(new RenderSnapshots().make(w.snapshot())),validSnapshot)));
test('finite crude travels section by section, heats and splits into three independent products',()=>{
  const w=fixture(),total=stored(w.refinery);updateRefinery(w,.05);
  assert.ok(w.refinery.pipes[0].volume>0);assert.equal(w.refinery.tanks[1].volume,0);
  advance(w,30);const r=w.refinery;assert.ok(r.processed>600&&r.heat===1);
  for(let i=2;i<5;i++)assert.ok(r.tanks[i].volume>TANKS[i].initial+50);
  assert.ok(Math.abs(stored(r)-total)<1e-7);assert.equal(r.released,0);assert.ok(r.tanks.every(t=>!t.warning&&!t.burst));assert.ok(validSnapshot(transport(w)));
  advance(w,120);assert.equal(r.tanks[0].volume,0);assert.ok(Math.abs(stored(r)-total)<1e-7);
});
test('a dent retains the bore; a through-cut disconnects flow and leaks at the actual cut',()=>{
  const w=fixture(),id=ROUTES[1].ids[3],p=PIPES[id];advance(w,20);
  const x=(p.x+p.ex)/2,y=p.y;carveExplosion(w,{x,y:y-18,radius:9});assert.equal(pipeOpening(w.platforms,id),null);
  carveExplosion(w,{x,y,radius:35});const hole=pipeOpening(w.platforms,id);assert.ok(hole&&Math.abs(hole.x-x)<42);
  const before=stored(w.refinery);advance(w,10);assert.ok(w.refinery.pipes[id].broken);assert.ok(w.spills.some(s=>s.kind==='petrol'));
  assert.ok(w.chunks.some(c=>c.material==='metal'&&c.mass>0));assert.ok(Math.abs(stored(w.refinery)-before)<1e-7);
  const volume=w.refinery.tanks[2].volume;advance(w,30);assert.ok(w.refinery.tanks[2].volume-volume<3,'downstream drains but receives no new feed');assert.ok(validSnapshot(transport(w)));
});
test('gas and acid are carried in distinct pipes and emerge only from their broken route',()=>{
  for(const route of [2,3]){
    const w=fixture();advance(w,20);const id=ROUTES[route].ids[3],p=PIPES[id];
    carveExplosion(w,{x:(p.x+p.ex)/2,y:(p.y+p.ey)/2,radius:32});advance(w,2);
    if(route===2)assert.ok(w.gas.length>0&&w.gas.every(g=>g.vy<0));else assert.ok(w.spills.some(q=>q.kind==='acid'));
    assert.ok(validSnapshot(transport(w)));
  }
});
test('shooting out every pipe section releases its stored chemical through the exposed fitting',()=>{
  for(const p of PIPES){
    const w=fixture();advance(w,30);
    const panel=w.platforms.find(q=>q.refineryPipe===p.id),kind=ROUTES[p.route].kind,total=stored(w.refinery);
    w.damageCover(panel,200);assert.equal(panel.hp,0);
    advance(w,1);
    assert.ok(w.refinery.released>.05,`pipe ${p.id} (${kind}) must not trap its contents inside an overlapping fitting`);
    assert.ok(kind==='gas'?w.gas.length:w.spills.some(q=>q.kind===kind),`pipe ${p.id} releases ${kind}`);
    assert.ok(Math.abs(stored(w.refinery)-total)<1e-7);
    assert.ok(validSnapshot(transport(w)));
  }
});
test('a narrow cut emits within its missing bore and solid walls still block liquid admission',()=>{
  const w=fixture(),id=ROUTES[1].ids[3],p=PIPES[id],x=(p.x+p.ex)/2;
  advance(w,20);carveExplosion(w,{x,y:p.y,radius:9});
  const hole=pipeOpening(w.platforms,id);assert.ok(hole&&Math.abs(hole.x-x)<9);
  w.platforms.push({id:'plug',x:hole.x-35,y:hole.y-35,w:70,h:70,material:'stone',baseX:hole.x-35,baseY:hole.y-35,dx:0,dy:0});w.terrainVersion++;
  advance(w,1);assert.equal(w.refinery.released,0,'solid cover cannot be bypassed by an emitter');
  w.platforms=w.platforms.filter(q=>q.id!=='plug');w.terrainVersion++;
  advance(w,1);assert.ok(w.refinery.released>0);
});
test('breached tanks drain down to the real opening and a roof cut only vents gas',()=>{
  const w=fixture(),t=TANKS[0];
  carveExplosion(w,{x:t.x+t.w/2,y:t.y,radius:35});assert.ok(tankOpenings(w.platforms,0).some(h=>h.roof));
  const before=w.refinery.released;advance(w,.5);assert.equal(w.refinery.released,before);
  carveExplosion(w,{x:t.x+8,y:t.y+110,radius:30});advance(w,4);
  assert.ok(w.refinery.released>0&&w.spills.some(q=>q.kind==='oil'));assert.ok(w.refinery.tanks[0].volume>0);
  const gas=TANKS[3];carveExplosion(w,{x:gas.x+gas.w/2,y:gas.y,radius:30});advance(w,1);assert.ok(w.gas.length);
});
test('full emission queues retain unaccepted liquid and gas in the process',()=>{
  const w=fixture();advance(w,12);const id=ROUTES[2].ids[2],p=PIPES[id];
  carveExplosion(w,{x:(p.x+p.ex)/2,y:(p.y+p.ey)/2,radius:40});
  w.gas=Array.from({length:24},(_,i)=>({id:i+1,x:100,y:100,r:62,life:1,vx:0,vy:0,lit:0,owner:0}));
  const before=w.refinery.released;advance(w,2);assert.equal(w.refinery.released,before);assert.ok(w.refinery.pipes[id].volume>0);
  const oil=TANKS[0];carveExplosion(w,{x:oil.x,y:oil.y+150,radius:35});
  w.spills=Array.from({length:384},(_,i)=>({id:i+1,kind:'oil',x:2500,y:200,w:32,h:1,vx:0,vy:0,life:35,fire:0,cold:0,spark:0,grounded:false}));
  advance(w,1);assert.equal(w.refinery.released,before);
});
test('downstream backpressure stops conversion and raises a readable pressure warning',()=>{
  const w=fixture(),r=w.refinery;advance(w,10);
  r.products=[80,80,80];r.tanks.slice(2).forEach((q,i)=>q.volume=TANKS[i+2].capacity);
  r.pipes.filter(p=>PIPES[p.id].route>0).forEach(p=>p.volume=PIPES[p.id].capacity);
  const processed=r.processed;advance(w,2.3);assert.equal(r.processed,processed);assert.ok(r.tanks[1].pressure>1);assert.ok(r.tanks[1].warning>0);
  assert.ok(refineryDanger(w,1280,1200));assert.equal(refineryDanger(w,100,500),false);
});
test('heat warns before a finite pressure burst, while cooling cancels it',()=>{
  const w=fixture(),r=w.refinery,t=TANKS[2];heatRefinery(w,b=>b===t,3);
  advance(w,2.2);assert.ok(r.tanks[2].warning>0&&!r.tanks[2].burst);
  heatRefinery(w,b=>b===t,-4);advance(w,1);assert.equal(r.tanks[2].warning,0);assert.equal(r.tanks[2].burst,false);
  heatRefinery(w,b=>b===t,4);advance(w,6);assert.equal(r.tanks[2].burst,true);assert.ok(r.combusted>0);assert.ok(tankOpenings(w.platforms,2).length>0);
  assert.ok(validSnapshot(transport(w)));
});
test('contained liquid pushes physical bodies and an acid tank hurts a fighter inside it',()=>{
  const w=fixture(),t=TANKS[0],p=w.players[0];Object.assign(p,{x:t.x+100,y:t.y+t.h-45,vx:200,vy:200,spawnShield:0});
  liquidForces(w,.05,refineryLiquids(w.refinery));assert.ok(p.vx<200&&p.vy<200);
  const a=TANKS[4];Object.assign(p,{x:a.x+100,y:a.y+a.h-27,spawnShield:0});advance(w,1);assert.ok(p.hp<100);
});
test('a bursting shell becomes bounded physical metal and does not shield its own blast',()=>{
  const w=fixture(),t=TANKS[2],p=w.players[0];
  w.platforms=w.platforms.filter(q=>q.refineryTank===2);w.terrainVersion++;w.cover=[];
  Object.assign(p,{x:t.x-10,y:t.y+t.h/2,spawnShield:0,vx:0,vy:0});
  heatRefinery(w,q=>q===t,4);advance(w,3);
  assert.ok(w.refinery.tanks[2].burst);assert.ok(p.hp<100);assert.ok(Math.abs(p.vx)>0);
  assert.ok(w.chunks.length>0&&w.chunks.length<=96);assert.ok(w.chunks.every(q=>q.mass>0&&q.material==='metal'));
  assert.ok(validSnapshot(transport(w)));
});
test('petrol spills catch fire, water extinguishes them, and leaks stay within shared bounds',()=>{
  const w=fixture(),t=TANKS[2];carveExplosion(w,{x:t.x,y:t.y+t.h-40,radius:38});advance(w,2);assert.ok(w.spills.some(q=>q.kind==='petrol'));
  heatReactions(w,()=>true,.05);assert.ok(w.spills.some(q=>q.fire>0));
  const q=w.spills.find(q=>q.kind==='petrol');w.water=[{id:++w.reactionSerial,x:q.x,y:q.y,w:q.w,h:q.h+20,vx:0,vy:0,grounded:false,charge:0,frozen:false}];
  w.reactionClock=.05;updateReactions(w,.01);assert.ok(w.spills.some(q=>q.kind==='petrol'&&!q.fire&&q.cold>0));assert.ok(w.water.length+w.spills.length<=384);
});
test('prediction and non-fighting phases cannot advance refinery state',()=>{
  const w=fixture();for(const flag of ['prediction','countdown','result']){w.prediction=flag==='prediction';w.phase=flag==='prediction'?'fight':flag;const r=structuredClone(w.refinery);advance(w,3);assert.deepEqual(w.refinery,r);}
});
test('damaged-world joins, deltas and interpolation retain bounded process state and reset',()=>{
  const w=fixture();advance(w,12);const a=transport(w);carveExplosion(w,{x:1630,y:820,radius:90});advance(w,3);const b=transport(w);
  const history=new SnapshotHistory();history.remember(1,a);assert.deepEqual(history.decode(history.encode(b,1),2),b);const blend=interpolateStates(a,b,.5);assert.ok(validSnapshot(blend));assert.ok(blend.refinery.pipes.some(q=>q.broken));
  for(const modify of [s=>s.refinery.tanks[0].volume=1e8,s=>s.refinery.pipes[0].flow=Infinity,s=>s.refinery.products.push(1),s=>s.refinery.pipes[0].id=10,s=>s.refinery.tanks[0].warning=-1,s=>s.arenaIndex=0,s=>s.platforms[0].refineryPipe=1000]){const s=structuredClone(b);modify(s);assert.equal(validSnapshot(s),false);}
  w.startRound();assert.equal(w.refinery.clock,0);assert.equal(w.refinery.tanks[0].volume,TANKS[0].initial);assert.ok(w.refinery.pipes.every(q=>!q.broken));assert.equal(w.spills.length,0);assert.equal(w.gas.length,0);assert.ok(validSnapshot(transport(w)));
});
test('refinery recordings are original bounded distinct signals with silent endpoints',()=>{
  const rate=12000,samples=REFINERY_SOUNDS.map(n=>synthesizeRefinery(n,rate));
  for(const s of samples){assert.equal(s.length,rate*4);assert.ok(s.every(v=>Number.isFinite(v)&&Math.abs(v)<.6));assert.equal(Math.abs(s[0]),0);assert.equal(Math.abs(s.at(-1)),0);assert.ok(s.some(v=>Math.abs(v)>.06));}
  assert.notDeepEqual(samples[0],samples[1]);assert.notDeepEqual(samples[1],samples[2]);
});
test('sound seeks to live process time, caps voices, and stops on mute or reset',()=>{
  const played=[],stops=[],sound={context:{currentTime:10},ready:()=>true,sample:(name,d,o)=>{played.push({name,...o});return {stopped:false,gain:{gain:{setTargetAtTime(){},cancelScheduledValues(){}}},source:{stop(){stops.push(name);}}};}};
  const w=fixture();advance(w,13);const s=w.snapshot(),audio=new RefinerySound();s.refinery.pipes[2].broken=true;s.refinery.tanks[2].warning=2;
  audio.update(sound,s);assert.equal(played.length,3);assert.ok(played.every(v=>Math.abs(v.offset-1)<.001));for(let i=0;i<30;i++)audio.update(sound,s);assert.equal(played.length,3);
  sound.ready=()=>false;audio.update(sound,s);assert.equal(stops.length,3);assert.equal(audio.voices.size,0);
  sound.ready=()=>true;audio.update(sound,s);assert.equal(played.length,6);
  for(const v of audio.voices.values())v.voice.stopped=true;
  audio.update(sound,s);audio.update(sound,s);assert.equal(played.length,6,'a frozen last snapshot cannot restart expired recordings');
});
