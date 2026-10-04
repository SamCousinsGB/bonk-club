// Desktop source integration: real relay guests, possession, respawns, altered
// terrain, hot joins and the actual renderer. Scenario setup is host-only.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/crown-plane/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5414,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5414'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
 await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
 const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
 const {World}=await import(module('engine')),{Renderer}=await import(module('renderer'));
 qa.carve=(await import(module('terrain'))).carveExplosion;
 qa.spawns=(await import(module('crown'))).crownSpawns;
 const {RenderSnapshots}=await import(module('render-state'));qa.pack=s=>new RenderSnapshots().make(s);
 const step=World.prototype.step,draw=Renderer.prototype.draw;qa.step=(w,dt)=>step.call(w,dt);
 World.prototype.step=function(...a){qa.world=this;const result=qa.freezeAfterRespawn&&this.players.every(p=>p.alive&&p.lifeId>=(qa.nextLife[p.id]||0));if(result){qa.hold=true;qa.freezeAfterRespawn=false;}if(qa.quietArena&&this.arena.colossus)this.hazards.find(h=>h.type==='colossus').age=0;if(!qa.hold)return step.apply(this,a);};
 Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}return draw.call(this,s,...a);};
});}
const shot=async(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
async function state(p){return p.evaluate(()=>{const s=qa.pack(qa.rendered);return JSON.parse(JSON.stringify({mode:s.mode,crown:s.crown,platforms:s.platforms,players:s.players.map(p=>({id:p.id,occupant:p.occupant,lifeId:p.lifeId,alive:p.alive,accessory:p.accessory}))},(k,v)=>k==='netId'?undefined:v));});}
try{
 const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
 await host.locator('#game-mode').selectOption('crown');
 await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'CARGO PLANE HOLD',exact:true}).check();await host.locator('#selection-done').click();
 const code=await host.locator('#room-code').inputValue();
 const guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});
 await guest.locator('#ready-up').click();await host.locator('#start-match').click();await guest.locator('body.playing').waitFor();
 await host.waitForFunction(()=>qa.world?.phase==='fight');await guest.waitForFunction(()=>qa.rendered?.mode==='crown');
 await shot(host,'plane-start');
 const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
 await guest.keyboard.down('KeyA');await guest.waitForTimeout(500);await guest.keyboard.up('KeyA');
 const after=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(Math.abs(after-before)>35);report.guestMovement=after-before;
 await host.waitForFunction(()=>qa.world.crown.times[2]+qa.world.crown.times[3]>.3,{},{timeout:45000});
 report.botPickup=await host.evaluate(()=>({time:qa.world.time,times:qa.world.crown.times}));await shot(guest,'bot-carrier');
 for(const damaged of [false,true]) {
  await host.evaluate(damaged=>{
   const w=qa.world;qa.hold=false;
   if(damaged){qa.carve(w,{x:900,y:910,radius:110});qa.carve(w,{x:530,y:710,radius:100});}
   qa.nextLife=Object.fromEntries(w.players.map(p=>[p.id,p.lifeId+1]));qa.freezeAfterRespawn=true;
   for(const p of w.players)w.kill(p);
  },damaged);
  await guest.waitForFunction(()=>qa.rendered.players.every(p=>!p.alive));
  await host.waitForFunction(()=>qa.hold);
  await guest.waitForFunction(()=>qa.rendered.players.every(p=>p.alive));
  const evidence=await host.evaluate(()=>{
   const w=qa.world,solids=w.solids();return w.players.map(p=>({id:p.id,x:p.x,y:p.y,lifeId:p.lifeId,
    support:solids.find(s=>s.id===qa.spawns(w).find(q=>Math.abs(q.x-p.x)<5&&Math.abs(q.y-p.y)<5)?.support),matches:qa.spawns(w).some(q=>Math.abs(q.x-p.x)<5&&Math.abs(q.y-p.y)<5)}));
  });
  for(const p of evidence){assert.ok(p.matches,JSON.stringify(p));assert.ok(p.support&&!p.support.planeHull&&!p.support.planeWing&&!p.support.boundary);}
  report[damaged?'damagedRespawns':'intactRespawns']=evidence.map(({support,matches,...p})=>p);
  await shot(guest,damaged?'damaged-cabin-respawns':'cabin-respawns');
 }
 const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});
 await late.waitForFunction(()=>qa.rendered?.platforms.some(p=>p.sourceId));
 await host.evaluate(()=>{qa.world.time+=.1;});await guest.waitForTimeout(700);
 assert.deepEqual(await state(late),await state(host));assert.deepEqual(await state(guest),await state(host));
 report.changedWorldJoin=true;await shot(late,'plane-hot-join');
 await host.evaluate(()=>{qa.hold=false;});
 const resumed=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
 await guest.keyboard.down('KeyD');await guest.waitForTimeout(400);await guest.keyboard.up('KeyD');
 assert.ok(Math.abs((await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x))-resumed)>20);report.controlsAfterRespawn=true;
 for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
 await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const[i,p]of pages.entries())await shot(p,'failure-'+i);console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
