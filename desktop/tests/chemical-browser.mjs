// Real desktop host/guest controls, chemistry rendering and changed-world joins.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/fuel/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5409,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5409'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
 await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
 const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
 const {World}=await import(module('engine')),{Renderer}=await import(module('renderer'));
 qa.carve=(await import(module('terrain'))).carveExplosion;
 qa.prepare=(await import(module('props'))).prepareProp;
 const {RenderSnapshots}=await import(module('render-state'));qa.pack=s=>new RenderSnapshots().make(s);
 const reactions=await import(module('reactions'));qa.spill=reactions.addSpill;qa.water=reactions.addWater;
 const step=World.prototype.step,draw=Renderer.prototype.draw;
 World.prototype.step=function(...a){qa.world=this;if(!qa.hold)return step.apply(this,a);};
 Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}return draw.call(this,s,...a);};
});}
const shot=async(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
async function state(p){return p.evaluate(()=>{const s=qa.pack(qa.rendered);return JSON.parse(JSON.stringify(Object.fromEntries(['cover','chunks','water','spills','gas','platforms'].map(k=>[k,s[k]])),(k,v)=>k==='netId'?undefined:v));});}
try{
 const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
 for(const id of [1,2,3])await host.locator(`[data-slot="${id}"]`).selectOption('player');
 await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'ROCKET TEST STAND',exact:true}).check();await host.locator('#selection-done').click();
 const code=await host.locator('#room-code').inputValue();
 const guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});await guest.locator('#ready-up').click();
 await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);await host.locator('#start-match').click();await guest.locator('body.playing').waitFor();await host.waitForFunction(()=>qa.world?.arena?.rocket&&qa.world.phase==='fight');await guest.waitForFunction(()=>qa.rendered?.arenaIndex===12&&qa.rendered.phase==='fight');
 const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
 await guest.keyboard.down('KeyA');await guest.waitForTimeout(500);await guest.keyboard.up('KeyA');
 const after=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(after<before-35);report.guestMovement=before-after;
 await host.evaluate(()=>{
  const w=qa.world;w.hazards[0].age=0;
  // Every object below goes through the real host simulation and normal renderer.
  w.cover=w.cover.filter(b=>!b.id.startsWith('reaction-prop'));
  for(const [i,kind]of ['oilBarrel','canister','tarBarrel','acidBarrel','coolantBarrel'].entries()){
   const x=680+i*240,h=kind==='canister'?187:177,wid=kind==='canister'?114:140;
   w.cover.push(qa.prepare({id:'chem-'+i,kind,x,y:1320-h,w:wid,h,hp:150,maxHp:150,mass:kind==='tarBarrel'?640:400,
    ...(kind==='canister'?{}:{liquidLeft:650,liquidCapacity:650})}));
  }
 });await host.waitForTimeout(400);await shot(host,'large-barrels');
 await host.evaluate(()=>{const w=qa.world;w.damageCover(w.cover.find(b=>b.id==='chem-0'),200);w.damageCover(w.cover.find(b=>b.id==='chem-2'),200);w.hazards[0].age=9.1;});
 await host.waitForTimeout(1400);await shot(host,'engine-fuel');
 report.ignition=await host.evaluate(()=>qa.world.spills.some(q=>q.fire>0)||qa.world.cover.some(b=>b.fire>0));assert.equal(report.ignition,true);
 await host.evaluate(()=>{
  // Restore the real floor between scenarios: the first chain can destroy the
  // cooling area, in which case water correctly drains instead of making ice.
  const w=qa.world;w.startRound();w.phase='fight';w.cover=[];
  for(const [i,kind]of ['acidBarrel','coolantBarrel'].entries()){
   const b=qa.prepare({id:'spill-'+i,kind,x:1360+i*240,y:1143,w:140,h:177,hp:150,maxHp:150,mass:400,liquidLeft:650,liquidCapacity:650});
   w.cover.push(b);w.damageCover(b,200);
  }
  qa.water(w,1780,1318,200);qa.spill(w,'coolant',1780,1318,120);
  qa.spill(w,'acid',550,1318,240);w.cover.push(qa.prepare({id:'corrode',kind:'cabinet',x:530,y:1210,w:78,h:110,hp:150,maxHp:150}));
 });await host.waitForTimeout(1400);await shot(host,'chemistry');
 report.chemistry=await host.evaluate(()=>({acid:qa.world.spills.some(q=>q.kind==='acid'),coolant:qa.world.spills.some(q=>q.kind==='coolant'),ice:qa.world.water.some(q=>q.frozen),gas:qa.world.gas.length,metalHp:qa.world.cover.find(b=>b.id==='corrode')?.hp}));
 assert.ok(report.chemistry.acid&&report.chemistry.coolant&&report.chemistry.ice,JSON.stringify(report.chemistry));assert.ok(report.chemistry.metalHp<150);
 await host.evaluate(()=>{qa.carve(qa.world,{x:1200,y:1320,radius:100});qa.world.step(1/120);qa.hold=true;});
 const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});await late.waitForFunction(()=>qa.rendered?.spills?.some(q=>q.kind==='acid')&&qa.rendered.platforms.some(p=>p.sourceId));
 await host.waitForTimeout(600);assert.deepEqual(await state(late),await state(host));assert.deepEqual(await state(guest),await state(host));report.changedWorldJoin=true;await shot(late,'hot-join');
 await guest.emulateMedia({reducedMotion:'reduce'});await guest.evaluate(()=>{qa.renderer.reduced=true;});await guest.setViewportSize({width:1280,height:800});await shot(guest,'reduced-resized');
 await host.evaluate(()=>{qa.world.startRound();qa.hold=false;});await late.waitForFunction(()=>qa.rendered.phase==='countdown');assert.equal((await state(late)).spills.length,0);report.reset=true;
 for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
 // Inspect actual auto-populated rounds in several different arenas.
 for(const arena of [0,4,7,9,11,12]){
  await host.evaluate(arena=>{const w=qa.world;w.arenaPool=[arena];w.arenaIndex=arena;w.botIds=new Set([0,1,2,3]);w.ids=[0,1,2,3];w.startRound();},arena);
  await host.waitForTimeout(3500);await shot(host,'arena-'+arena);
 }
 await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));assert.deepEqual(errors,[]);
 await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const[i,p]of pages.entries())await shot(p,'failure-'+i);console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
