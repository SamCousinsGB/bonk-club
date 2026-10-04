// Desktop source gameplay, visual, sound and changed-world relay verification.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../../node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/rocket/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5407,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
 const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:fileURLToPath(output),size:{width:1600,height:900}}});
 await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5407'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
 await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
 const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
 const {World}=await import(module('engine')),{Renderer}=await import(module('renderer')),{Sound}=await import(module('audio'));
 qa.carve=(await import(module('terrain'))).carveExplosion;
 const step=World.prototype.step,draw=Renderer.prototype.draw,update=Sound.prototype.update;
 World.prototype.step=function(...a){qa.world=this;return step.apply(this,a);};
 Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}return draw.call(this,s,...a);};
 Sound.prototype.update=function(...a){qa.sound=this;return update.apply(this,a);};
});}
const shot=async(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
async function geometry(p){return p.evaluate(()=>qa.rendered.platforms.map(({id,x,y,w,h,oneWay})=>({id,x:+x.toFixed(2),y:+y.toFixed(2),w:+w.toFixed(2),h:+h.toFixed(2),oneWay})));}
try{
 const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
 for(const id of [1,2,3])await host.locator(`[data-slot="${id}"]`).selectOption('player');
 await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'ROCKET TEST STAND',exact:true}).check();await host.locator('#selection-done').click();
 const code=await host.locator('#room-code').inputValue();
 const guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});await guest.locator('#ready-up').click();
 await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);await host.locator('#start-match').click();await guest.locator('body.playing').waitFor();await host.waitForFunction(()=>qa.world?.arena?.rocket&&qa.world.phase==='fight');await guest.waitForFunction(()=>qa.rendered?.arenaIndex===12&&qa.rendered.phase==='fight');
 const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
 await guest.keyboard.down('KeyA');await guest.waitForTimeout(500);await guest.keyboard.up('KeyA');await guest.keyboard.press('Space');await guest.waitForTimeout(350);
 const after=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(after<before-35);report.guestMovement=before-after;
 await shot(host,'idle');
 await host.evaluate(()=>{qa.world.hazards[0].age=6.1;});await host.waitForTimeout(350);await shot(host,'warning');
 await host.evaluate(()=>{qa.world.hazards[0].age=10.8;});await host.waitForTimeout(350);await shot(host,'firing');
 report.audio=await host.evaluate(()=>({state:qa.sound?.context?.state,voice:qa.sound?.rocket?.current?.key,active:qa.sound?.active}));assert.equal(report.audio.state,'running');assert.ok(report.audio.voice);
 // The genuine solid floor is breached during a running match. The late guest
 // receives that exact terrain and the currently firing engine from the host.
 await host.evaluate(()=>{qa.carve(qa.world,{x:1280,y:1320,radius:170});qa.world.hazards[0].age=9.3;});
 const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});await late.waitForFunction(()=>qa.rendered?.platforms?.some(p=>p.sourceId));
 await host.waitForTimeout(250);assert.deepEqual(await geometry(late),await geometry(host));assert.deepEqual(await geometry(guest),await geometry(host));report.changedWorldJoin=true;
 await host.evaluate(()=>{qa.world.hazards[0].age=11.4;});await host.waitForTimeout(300);await shot(late,'hot-join-breach');
 const phases=await Promise.all([host,guest,late].map(p=>p.evaluate(()=>qa.rendered.hazards[0].age)));assert.ok(Math.max(...phases)-Math.min(...phases)<.45);report.phases=phases;
 await guest.emulateMedia({reducedMotion:'reduce'});await guest.evaluate(()=>{qa.renderer.reduced=true;});await guest.setViewportSize({width:1280,height:800});await guest.waitForTimeout(200);await shot(guest,'reduced-resized');
 await host.evaluate(()=>{qa.world.startRound();});await late.waitForFunction(()=>qa.rendered.phase==='countdown');assert.equal((await geometry(late)).length,18);report.reset=true;
 for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
 // Observe normal bots using the complete gameplay and rendering pipeline.
 await host.evaluate(()=>{qa.world.botIds=new Set([0,1,2,3]);qa.world.ids=[0,1,2,3];qa.world.startRound();qa.actions=0;const event=qa.world.event;qa.world.event=function(type,...a){if(type==='shoot'||type==='swing')qa.actions++;return event.call(this,type,...a);};});
 await host.waitForTimeout(18000);await shot(host,'bots');report.botActions=await host.evaluate(()=>qa.actions);assert.ok(report.botActions>0);
 await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));assert.deepEqual(errors,[]);
 await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const [i,p]of pages.entries()){await shot(p,'failure-'+i);console.log(await p.evaluate(()=>({text:document.body.innerText.slice(-400),world:qa.world?.phase,render:qa.rendered?.phase})));}console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
