// Desktop source integration: real relay guests, possession, respawns, altered
// terrain, hot joins and the actual renderer. Scenario setup is host-only.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/crown-recovery/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5415,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5415'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
 await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
 const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
 const {World}=await import(module('engine')),{Renderer}=await import(module('renderer'));
 qa.carve=(await import(module('terrain'))).carveExplosion;
 qa.spawns=(await import(module('crown'))).crownSpawns;qa.centre=(await import(module('crown'))).centreCrown;
 const {RenderSnapshots}=await import(module('render-state'));qa.pack=s=>new RenderSnapshots().make(s);
 const step=World.prototype.step,draw=Renderer.prototype.draw;qa.step=(w,dt)=>step.call(w,dt);
 World.prototype.step=function(...a){qa.world=this;if(qa.stopOnRecovery&&this.events.some(e=>e.type==='arena-rebuilt')){qa.hold=true;qa.stopOnRecovery=false;}const result=qa.freezeAfterRespawn&&this.players.every(p=>p.alive&&p.lifeId>=(qa.nextLife[p.id]||0));if(result){qa.hold=true;qa.freezeAfterRespawn=false;}if(qa.quietArena&&this.arena.colossus)this.hazards.find(h=>h.type==='colossus').age=0;if(!qa.hold)return step.apply(this,a);};
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
 const setup=await host.evaluate(()=>{
  const w=qa.world;w.platforms=w.platforms.filter(p=>p.planeHull||p.planeWing);
  w.cover=[];w.chunks=[];w.drops=[];w.projectiles=[];w.fields=[];w.spills=[];w.water=[];w.gas=[];w.cables=[];
  w.weaponTimer=999;w.grenadeTimer=999;w.terrainVersion++;
  w.crown.holder=null;w.crown.times=[7,19,2,3];w.scores=[1,2,3,4];
  for(const p of w.players){p.rig=null;p.vx=0;p.vy=0;p.weapon=null;p.carryId=null;
   if(p.id>=2)w.kill(p);else Object.assign(p,{x:p.id===0?350:2200,y:669,ground:false,support:null});}
  const placed=qa.centre(w);qa.stopOnRecovery=true;qa.failedAt=w.time;
  return {placed,points:qa.spawns(w).length,round:w.round,arena:w.arenaIndex,lives:w.players.map(p=>p.lifeId)};
 });
 assert.equal(setup.placed,false);assert.equal(setup.points,0);
 await guest.waitForFunction(()=>qa.rendered.players.filter(p=>!p.alive).length>=2);
 await shot(guest,'unplayable-plane');
 const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});
 await late.waitForFunction(()=>qa.rendered?.crown?.times[1]===19);
 await host.evaluate(()=>{const p=qa.world.players.find(p=>p.id===2);Object.assign(p,{x:300,y:669,vx:0,vy:0,rig:null,ground:false,support:null});});
 await host.waitForFunction(()=>qa.hold,{},{timeout:30000});
 await guest.waitForFunction(()=>qa.rendered.phase==='countdown'&&qa.rendered.events.some(e=>e.type==='arena-rebuilt'));
 await late.waitForFunction(()=>qa.rendered.phase==='countdown'&&qa.rendered.events.some(e=>e.type==='arena-rebuilt'));
 const result=await host.evaluate(()=>({elapsed:qa.world.time-qa.failedAt,round:qa.world.round,arena:qa.world.arenaIndex,
  times:qa.world.crown.times,scores:qa.world.scores,players:qa.world.players.map(p=>({id:p.id,alive:p.alive,lifeId:p.lifeId})),points:qa.spawns(qa.world).length}));
 assert.ok(result.elapsed>=12&&result.elapsed<13);assert.equal(result.round,setup.round);assert.equal(result.arena,setup.arena);
 assert.equal(result.times[0],7);assert.equal(result.times[1],19);assert.equal(result.times[3],3);
 // The hot-joining player owns a fresh slot, so it never inherits the departed bot's time or wins.
 assert.equal(result.times[2],0);assert.equal(result.scores[0],1);assert.equal(result.scores[1],2);
 assert.ok(result.players.every(p=>p.alive&&p.lifeId>0));assert.ok(result.points>0);
 assert.ok((await guest.locator('#toast').textContent()).includes('Arena rebuilt. Crown time kept.'));
 await shot(guest,'recovered-plane');await guest.waitForTimeout(500);
 assert.deepEqual(await state(guest),await state(host));assert.deepEqual(await state(late),await state(host));
 report.recovery=result;report.hotJoinDuringFailure=true;
 await host.evaluate(()=>{qa.hold=false;});await guest.waitForFunction(()=>qa.rendered.phase==='fight');
 const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
 await guest.keyboard.down('KeyA');await guest.waitForTimeout(450);await guest.keyboard.up('KeyA');
 const after=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(Math.abs(after-before)>30);report.controlsAfterRecovery=after-before;
 for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
 await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const[i,p]of pages.entries())await shot(p,'failure-'+i);console.log(errors);console.log(await pages[0]?.evaluate(()=>({time:qa.world?.time,phase:qa.world?.phase,round:qa.world?.round,health:qa.world?.crownRecovery,crown:qa.world?.crown,players:qa.world?.players.map(p=>({id:p.id,x:p.x,y:p.y,alive:p.alive}))})));throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
