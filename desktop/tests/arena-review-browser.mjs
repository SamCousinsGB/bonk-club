// Desktop arena review: the actual renderer and deterministic simulation, with
// intact, active and damaged scenes. Run again after changes for comparable art.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const label=process.argv[2]||'after';
const output=new URL(`../test-results/arena-review/${label}/`,import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5420,strictPort:true,hmr:false,watch:null}});
await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const errors=[],report=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/arena-review.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#111}canvas{width:1600px;height:900px;display:block}</style><canvas></canvas>'}));
  await page.goto('http://127.0.0.1:5420/arena-review.html');
  const names=await page.evaluate(async()=>{
    const {World,ARENAS,STEP}=await import('/src/engine.js');
    const {Renderer}=await import('/src/renderer.js');
    const {validSnapshot}=await import('/src/network.js');
    const {carveExplosion}=await import('/src/terrain.js');
    const {drawScorchedPlatforms}=await import('/src/nuclear-art.js');
    const {drawTrack}=await import('/src/setpiece-art.js');
    const {drawCarWashStructure}=await import('/src/compact-setpiece-art.js');
    window.qa={World,ARENAS,STEP,Renderer,validSnapshot,carveExplosion,drawScorchedPlatforms,drawTrack,drawCarWashStructure};
    return ARENAS.map(a=>a.name);
  });
  const materials=await page.evaluate(()=>{
    const results=[];
    // Compare a surviving lower fragment against a mask of its original face.
    // This catches repainted top trim, shifted gradients and art outside cuts.
    for(const kind of ['metal','stone','grating','panel','colossus','rocket','refinery','ship']){
      const p={id:'floor0',x:40,y:40,w:400,h:60,material:kind==='stone'?'stone':'metal',
        ...(kind==='grating'?{oneWay:true}:{}),...(kind==='panel'?{destructible:true,panel:'metal',hp:100,maxHp:100}:{}),
        ...(kind==='colossus'?{colossusStone:true}:{}),...(kind==='rocket'?{rocketDeck:true}:{}),
        ...(kind==='refinery'?{refineryDeck:true}:{}),...(kind==='ship'?{shipDeck:true}:{} )};
      const piece={...p,id:'cut1',sourceId:p.id,x:75,y:63,w:310,h:23};
      const create=()=>{const canvas=document.createElement('canvas');canvas.width=500;canvas.height=150;const r=new qa.Renderer(canvas);r.drawingArena={platforms:[p]};return r;};
      const expected=create(),actual=create();
      expected.ctx.save();expected.ctx.beginPath();expected.ctx.rect(piece.x,piece.y,piece.w,piece.h);expected.ctx.clip();expected.platform(p,0);expected.ctx.restore();
      qa.drawScorchedPlatforms(actual,[piece],0);
      const a=actual.ctx.getImageData(0,0,500,150).data,b=expected.ctx.getImageData(0,0,500,150).data;
      let diff=0,painted=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])diff++;if(i%4===3&&a[i])painted++;}
      results.push({kind,diff,painted});
    }
    for(const kind of ['train','wash']){
      const arena=qa.ARENAS.find(a=>kind==='train'?a.theme==='railway':a.carWash);
      const p={...arena.platforms[0],id:'floor0'},piece={...p,id:'cut1',sourceId:'floor0',x:p.x+15,y:p.y+14,w:p.w-30,h:18};
      const create=()=>{const c=document.createElement('canvas');c.width=2560;c.height=1440;return c.getContext('2d');};
      const expected=create(),actual=create(),draw=(c,platforms)=>kind==='train'?qa.drawTrack(c,{platforms}):qa.drawCarWashStructure(c,{platforms},arena);
      expected.save();expected.beginPath();expected.rect(piece.x,piece.y,piece.w,piece.h);expected.clip();draw(expected,[p]);expected.restore();draw(actual,[piece]);
      const a=actual.getImageData(p.x,p.y,p.w,p.h).data,b=expected.getImageData(p.x,p.y,p.w,p.h).data;
      let diff=0,painted=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])diff++;if(i%4===3&&a[i])painted++;}
      results.push({kind,diff,painted});
    }
    return results;
  });
  for(const m of materials){assert.equal(m.diff,0,`${m.kind}: cut art matches surviving original face`);assert.ok(m.painted>0);}
  for(const [index,name]of names.entries()){
    for(const phase of ['intact','active','damaged']){
      const result=await page.evaluate(({index,phase})=>{
        const {World,STEP,Renderer,validSnapshot,carveExplosion}=qa;
        let seed=712;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
        const w=new World({arena:index,players:[0,1,2,3],bots:[],shuffle:false,random});
        w.phase='fight';
        // Keep actors alive long enough to inspect a full setpiece cycle.
        w.hit=()=>{};w.kill=()=>{};
        for(let n=0;n<(phase==='intact'?30:1440);n++){
          w.step(STEP);
          if(n%240===0)for(const p of w.players)if(p.y>1450){const [x,y]=w.arena.spawns[p.id];Object.assign(p,{x,y,vx:0,vy:0,rig:null});}
        }
        if(phase==='damaged'){
          const before=JSON.stringify(w.platforms);
          for(const [x,y]of [[700,850],[1280,1040],[1900,600]])carveExplosion(w,{x,y,radius:150});
          if(JSON.stringify(w.platforms)===before)throw Error('Damage fixture missed '+w.arena.name);
          for(let n=0;n<90;n++)w.step(STEP);
        }
        const r=new Renderer(document.querySelector('canvas'));r.resize(1600,900);r.localId=0;
        r.draw(w.snapshot(),1/60,w.time);
        const snapshot=w.snapshot(),timings=[];
        for(let i=0;i<12;i++){const t=performance.now();r.draw(snapshot,1/60,w.time);timings.push(performance.now()-t);}
        timings.sort((a,b)=>a-b);
        qa.world=w;qa.renderer=r;
        return {name:w.arena.name,phase,valid:validSnapshot(w.snapshot()),platforms:w.platforms.length,spills:w.spills.length,renderMedianMs:timings[6]};
      },{index,phase});
      await page.waitForTimeout(120);
      await page.evaluate(()=>qa.renderer.draw(qa.world.snapshot(),1/60,qa.world.time));
      const filename=`${String(index).padStart(2,'0')}-${phase}.png`;
      await page.screenshot({path:fileURLToPath(new URL(filename,output))});
      assert.ok(result.valid,`${name}: ${phase} snapshot`);report.push({...result,filename});
    }
    console.log(`${name}: intact, active, damaged`);
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('report.json',output),JSON.stringify({report,materials,errors},null,2));
} finally {await browser.close();await server.close();}
