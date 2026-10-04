// Desktop source integration: real relay guests, possession, respawns, altered
// terrain, hot joins and the actual renderer. Scenario setup is host-only.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/crown/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5413,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5413'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
 await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
 const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
 const {World}=await import(module('engine')),{Renderer}=await import(module('renderer'));
 qa.carve=(await import(module('terrain'))).carveExplosion;
 const {RenderSnapshots}=await import(module('render-state'));qa.pack=s=>new RenderSnapshots().make(s);
 const step=World.prototype.step,draw=Renderer.prototype.draw;qa.step=(w,dt)=>step.call(w,dt);
 World.prototype.step=function(...a){qa.world=this;if(qa.quietArena&&this.arena.colossus)this.hazards.find(h=>h.type==='colossus').age=0;if(!qa.hold)return step.apply(this,a);};
 Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}return draw.call(this,s,...a);};
});}
const shot=async(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
async function state(p){return p.evaluate(()=>{const s=qa.pack(qa.rendered);return JSON.parse(JSON.stringify({mode:s.mode,crown:s.crown,platforms:s.platforms,players:s.players.map(p=>({id:p.id,occupant:p.occupant,lifeId:p.lifeId,alive:p.alive,accessory:p.accessory}))},(k,v)=>k==='netId'?undefined:v));});}
try{
 const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
 for(const id of [1,2,3])await host.locator(`[data-slot="${id}"]`).selectOption('player');
 await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'COLOSSUS',exact:true}).check();await host.locator('#selection-done').click();
 const code=await host.locator('#room-code').inputValue();
 const guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});
 await guest.locator('#lobby-customise').click();await guest.getByRole('tab',{name:'Gear',exact:true}).click();await guest.locator('#player-accessory').selectOption('Horns');await guest.locator('#character-close').click();await guest.locator('#ready-up').click();
 await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);
 await host.locator('#game-mode').selectOption('crown');
 await guest.waitForFunction(()=>document.querySelector('#game-mode').value==='crown'&&document.querySelector('#ready-up').getAttribute('aria-pressed')==='false');
 assert.equal(await guest.locator('#game-mode').isDisabled(),true);assert.equal(await host.locator('#start-match').isDisabled(),true);
 await shot(host,'lobby');report.modeAndReadiness=true;
 await guest.locator('#ready-up').click();await host.locator('#start-match').click();await guest.locator('body.playing').waitFor();
 await host.waitForFunction(()=>qa.world?.phase==='fight');await guest.waitForFunction(()=>qa.rendered?.mode==='crown');
 await shot(host,'centre');
 const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
 await guest.keyboard.down('KeyA');await guest.waitForTimeout(500);await guest.keyboard.up('KeyA');
 const after=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(Math.abs(after-before)>35);report.guestMovement=after-before;
 await host.evaluate(()=>{
  const w=qa.world;qa.quietArena=true;w.cover=[];w.drops=[];w.weaponTimer=999;w.grenadeTimer=999;
  const p=w.players.find(p=>p.id===1);Object.assign(p,{...w.profiles[1],x:w.crown.x,y:w.crown.y+6,vx:0,vy:0,rig:null});
 });
 await guest.waitForFunction(()=>qa.rendered.crown.holder===1&&qa.rendered.crown.times[1]>.7);
 await shot(guest,'carrier');assert.equal(await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).accessory),'Horns');
 await guest.emulateMedia({reducedMotion:'reduce'});await guest.evaluate(()=>{qa.renderer.reduced=true;});await shot(guest,'reduced-motion');
 const total=await host.evaluate(()=>qa.world.crown.times[1]);
 await host.evaluate(()=>qa.world.kill(qa.world.players.find(p=>p.id===1)));
 await guest.waitForFunction(()=>!qa.rendered.players.find(p=>p.id===1).alive&&qa.rendered.crown.holder===null);await shot(guest,'respawn-countdown');
 await guest.waitForFunction(()=>qa.rendered.players.find(p=>p.id===1).lifeId===1&&qa.rendered.players.find(p=>p.id===1).alive);
 assert.ok(Math.abs((await host.evaluate(()=>qa.world.crown.times[1]))-total)<.2);await shot(guest,'headgear-restored');report.deathRespawnAndSavedAppearance=true;
 await host.evaluate(()=>{
  const w=qa.world,p=w.players.find(p=>p.id===1);Object.assign(w.crown,{holder:1,loose:false,x:p.x,y:p.y-38});w.crown.times[1]=12.5;
  qa.carve(w,{x:1450,y:1090,radius:110});qa.step(w,1/120);qa.hold=true;
 });
 const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});
 await late.waitForFunction(()=>qa.rendered?.crown?.holder===1&&qa.rendered.platforms.some(p=>p.sourceId));
 await host.evaluate(()=>{qa.world.time+=.1;});
 await guest.waitForFunction(()=>qa.rendered.players.length===3);await late.waitForFunction(()=>qa.rendered.players.length===3);
 await host.waitForTimeout(500);assert.deepEqual(await state(late),await state(host));assert.deepEqual(await state(guest),await state(host));
 await shot(late,'damaged-hot-join');report.changedWorldJoin=true;
 await guest.setViewportSize({width:1280,height:800});await shot(guest,'desktop-resize');
 await host.evaluate(()=>{qa.world.crown.times[1]=29.9;qa.hold=false;});
 await guest.waitForFunction(()=>qa.rendered.phase==='result'&&qa.rendered.winner===1);
 assert.equal(await guest.evaluate(()=>qa.rendered.crown.times[1]),30);await shot(guest,'winner');report.crownWinner=true;
 await late.waitForFunction(()=>qa.rendered.round===2&&qa.rendered.phase==='countdown');
 assert.deepEqual(await late.evaluate(()=>qa.rendered.crown.times),[0,0,0,0]);report.reset=true;
 for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
 await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const[i,p]of pages.entries())await shot(p,'failure-'+i);console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
