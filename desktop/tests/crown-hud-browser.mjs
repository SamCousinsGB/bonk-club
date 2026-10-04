// Desktop HUD/respawn QA through real relay guests and the actual game renderer.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/crown-hud/',import.meta.url);
assert.ok(process.env.VITE_ROOM_SERVICE_URL && process.env.VITE_TURN_CREDENTIALS_URL,'Set the repository production VITE URLs before relay QA');
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5416,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5416'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
 await context.addInitScript(()=>{window.qa={notes:[]};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
 const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
 const {World}=await import(module('engine')),{Renderer}=await import(module('renderer')),{Sound}=await import(module('audio'));
 const step=World.prototype.step,draw=Renderer.prototype.draw,tone=Sound.prototype.tone;
 qa.step=(w,dt)=>step.call(w,dt);
 World.prototype.step=function(...a){qa.world=this;if(!qa.hold)return step.apply(this,a);this.time+=a[0];};
 Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}return draw.call(this,s,...a);};
 Sound.prototype.tone=function(...a){qa.notes.push(a);return tone.apply(this,a);};
});}
const shot=async(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
async function layout(p){return p.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
 const focus=rect(document.querySelector('#crown-focus')),cards=[...document.querySelectorAll('.score')].map(rect),hud=rect(document.querySelector('#hud'));
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const buttons=[...document.querySelectorAll('#hud button:not(.hidden)')].map(rect);
 return {focus,cards,centerError:Math.abs(focus.x+focus.w/2-hud.x-hud.w/2),overlap:cards.some(c=>overlap(c,focus)||buttons.some(b=>overlap(c,b))),overflow:document.documentElement.scrollWidth>innerWidth};
});}
try{
 const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
 await host.locator('#game-mode').selectOption('crown');await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'CARGO PLANE HOLD',exact:true}).check();await host.locator('#selection-done').click();
 const code=await host.locator('#room-code').inputValue();const guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});
 await guest.locator('#ready-up').click();await host.locator('#start-match').click();await guest.locator('body.playing').waitFor();await host.waitForFunction(()=>qa.world?.phase==='fight');
 await host.evaluate(()=>{qa.hold=true;qa.world.crown.holder=1;qa.world.crown.times=[29,25.2,3,12];qa.world.players[1].name='Long player name';qa.notes=[];});
 await guest.waitForFunction(()=>document.querySelector('#crown-focus strong')?.textContent==='4.8s');
 assert.ok(await guest.locator('#crown-focus').evaluate(e=>e.classList.contains('crown-urgent')));
 assert.equal(await guest.locator('.crown-focus-person b').textContent(),'Long player name');
 report.layouts=[];
 for(const viewport of [{width:1600,height:900},{width:1280,height:800},{width:960,height:600}]){
  await guest.setViewportSize(viewport);await guest.waitForTimeout(250);const result=await layout(guest);report.layouts.push({viewport,...result});
  assert.ok(result.centerError<1);assert.equal(result.overlap,false);assert.equal(result.overflow,false);await shot(guest,'urgent-'+viewport.width);
 }
 await guest.setViewportSize({width:1600,height:900});
 await host.evaluate(()=>{qa.world.crown.holder=null;});
 await guest.waitForFunction(()=>document.querySelector('.crown-focus-person small').textContent==='LEADER · CROWN LOOSE');
 assert.equal(await guest.locator('#crown-focus strong').textContent(),'1.0s');assert.equal(await guest.locator('#crown-focus').evaluate(e=>e.classList.contains('crown-urgent')),false);await shot(guest,'loose');
 // A real death/respawn increments the transported life identity. Each viewer
 // follows their own fighter, even if several players respawn together.
 const lives=await host.evaluate(()=>{const w=qa.world;w.crown.holder=null;for(const p of w.players)w.kill(p);for(let i=0;i<270;i++)qa.step(w,1/120);return w.players.map(p=>p.lifeId);});
 await guest.waitForFunction(lives=>qa.rendered.players.every((p,i)=>p.lifeId===lives[i]),lives);
 const marker=await guest.evaluate(()=>{const r=qa.renderer,cue=r.respawnCue.update(qa.rendered,r.localId);return {id:cue?.player.id,local:r.localId,age:cue?.age};});
 assert.equal(marker.id,1);assert.equal(marker.local,1);assert.ok(marker.age<2.8);report.marker=marker;await shot(guest,'respawn-guest');
 await host.evaluate(()=>{qa.world.crown.holder=1;qa.world.crown.times[1]=25.9;});await guest.waitForFunction(()=>document.querySelector('#crown-focus strong').textContent==='4.1s');
 await guest.evaluate(()=>{qa.notes=[];});
 await host.evaluate(()=>{qa.world.time+=.1;qa.world.crown.times[1]=26;});await guest.waitForFunction(()=>qa.notes.some(n=>n[0]===830));
 report.countdownSound=true;
 const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});
 await late.waitForFunction(()=>document.querySelector('#crown-focus strong')?.textContent==='4.0s');report.hotJoin=true;
 await guest.emulateMedia({reducedMotion:'reduce'});await guest.evaluate(()=>{qa.renderer.reduced=true;});await guest.waitForTimeout(150);
 assert.equal(await guest.locator('.crown-focus-clock').evaluate(e=>getComputedStyle(e).animationName),'none');await shot(guest,'reduced-motion');
 for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
 await host.evaluate(()=>{qa.world.mode='elimination';qa.world.crown=null;});await guest.waitForFunction(()=>document.querySelector('#crown-focus').classList.contains('hidden'));report.eliminationUnchanged=true;
 await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const[i,p]of pages.entries())await shot(p,'failure-'+i);console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
