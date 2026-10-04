// Desktop source QA over real TURN, using test-only prototype instrumentation.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../../node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=new URL('../test-results/curl/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5398,strictPort:true,hmr:false,watch:null}});
await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',errors=[],report={};
async function page(){
  const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:fileURLToPath(output),size:{width:1600,height:900}}});
  await context.route('https://samcousinsgb.github.io/**',async route=>{
    const u=new URL(route.request().url()),path=u.pathname.replace(/^\/bonk-club\//,'/');
    const response=await route.fetch({url:'http://127.0.0.1:5398'+path+u.search});
    await route.fulfill({response});
  });
  await context.addInitScript(()=>{
    const RTC=RTCPeerConnection;window.qaConnections=[];window.qa={};
    window.RTCPeerConnection=class extends RTC{constructor(config,...rest){super({...config,iceTransportPolicy:'relay'},...rest);qaConnections.push(this);}};
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return p;
}
async function hook(p){await p.evaluate(async()=>{
  const url=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
  const {World}=await import(url('engine')),{Renderer}=await import(url('renderer'));
  const {Room}=await import(url('network')),{GuestPrediction}=await import(url('guest-prediction'));
  const step=World.prototype.step,draw=Renderer.prototype.draw,emit=Room.prototype.emit,receive=GuestPrediction.prototype.receive;
  World.prototype.step=function(...args){qa.world=this;return step.apply(this,args);};
  Renderer.prototype.draw=function(state,...args){qa.rendered=state;return draw.call(this,state,...args);};
  Room.prototype.emit=function(name,...args){qa.room=this;return emit.call(this,name,...args);};
  GuestPrediction.prototype.receive=function(...args){qa.prediction=this;return receive.apply(this,args);};
});}
async function fixture(host){await host.evaluate(()=>{
  const w=qa.world;w.round++;w.startRound();w.phase='fight';w.cover=[];w.hazards=[];w.drops=[];w.weaponTimer=w.grenadeTimer=999;
  const deck=w.platforms.find(s=>s.oneWay&&s.x===750);
  if(!deck)throw new Error('Missing train catwalk');
  for(const p of w.players)Object.assign(p,{x:820+p.id*70,y:deck.y-30,vx:0,vy:0,ground:true,support:deck.id,rig:null});
});await host.waitForTimeout(350);}
async function shot(p,name){await p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});}
async function relay(p){return p.evaluate(async()=>{
  const selected=[];for(const pc of qaConnections){const stats=await pc.getStats();
    for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated)
      selected.push({local:stats.get(s.localCandidateId)?.candidateType,remote:stats.get(s.remoteCandidateId)?.candidateType});}
  return selected;
});}
try{
  const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();
  await host.locator('#room-code').waitFor({timeout:45000});
  for(const id of [1,2,3])await host.locator(`[data-slot="${id}"]`).selectOption('player');
  await host.locator('#choose-maps').click();await host.locator('#select-none').click();
  await host.getByRole('checkbox',{name:'BULLET TRAIN',exact:true}).check();await host.locator('#selection-done').click();
  const code=await host.locator('#room-code').inputValue();
  const guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();
  await guest.locator('#room-code').waitFor({timeout:45000});await guest.locator('#ready-up').click();
  await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);await host.locator('#start-match').click();
  await guest.waitForFunction(()=>qa.rendered?.phase==='fight');await fixture(host);
  await host.mouse.move(900,350);await host.keyboard.down('d');await host.mouse.down({button:'right'});
  await host.waitForFunction(()=>qa.world.players[0].curl&&qa.world.players[0].vx>150);await shot(host,'host-roll');
  await host.keyboard.press('Space',{delay:80});
  await host.waitForFunction(()=>!qa.world.players[0].ground&&Math.abs(qa.world.players[0].bodyAngle)>1);
  report.hostFlip=await host.evaluate(()=>{const p=qa.world.players[0];return {curl:p.curl,vy:p.vy,spin:p.angularVelocity};});
  await shot(host,'host-flip');await host.mouse.up({button:'right'});await host.keyboard.up('d');
  await host.waitForFunction(()=>!qa.world.players[0].curl);await fixture(host);
  await guest.mouse.move(950,350);await guest.keyboard.down('d');await guest.mouse.down({button:'right'});
  await host.waitForFunction(()=>qa.world.players.find(p=>p.id===1)?.curl);await guest.keyboard.press('Space',{delay:80});
  await guest.waitForFunction(()=>qa.prediction?.player.curl&&!qa.prediction.player.ground);
  report.guestFlip=await guest.evaluate(()=>({curl:qa.prediction.player.curl,spin:qa.prediction.player.angularVelocity}));
  await shot(guest,'guest-flip');await guest.keyboard.up('d');
  await host.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/terrain.js')).name;
    const {carveExplosion}=await import(url);const floor=qa.world.platforms.find(s=>s.x>1400&&!s.oneWay);if(!floor)throw new Error("No damage target");carveExplosion(qa.world,{x:floor.x+floor.w/2,y:floor.y,radius:65});});
  const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();
  await late.waitForFunction(()=>qa.rendered?.phase==='fight'&&qa.rendered.players.some(p=>p.id===1&&p.curl),null,{timeout:45000});
  report.hotJoin=await late.evaluate(()=>({curl:qa.rendered.players.find(p=>p.id===1).curl,platforms:qa.rendered.platforms.length,wreckage:qa.rendered.wreckage.length}));
  assert.ok(await host.evaluate(()=>qa.world.terrainVersion>0),'world actually damaged');
  const geometry=p=>p.evaluate(()=>JSON.stringify(qa.rendered.platforms.map(s=>[s.id,s.x,s.y,s.w,s.h,s.cuts]),(key,value)=>typeof value==="number"?Math.round(value*100)/100:value));
  assert.equal(await geometry(late),await geometry(host),'late join has the damaged terrain');
  await shot(late,'hot-join');await guest.mouse.up({button:'right'});await host.waitForFunction(()=>!qa.world.players.find(p=>p.id===1).curl);
  await fixture(host);await host.keyboard.down('s');await host.waitForFunction(()=>qa.world.players[0].hangMotion?.age>.52);
  report.hang=await host.evaluate(()=>{const p=qa.world.players[0];return {age:p.hangMotion.age,y:p.y,head:p.rig[0].y};});
  await shot(host,'fast-hang');await host.keyboard.up('s');await host.keyboard.press('w',{delay:80});await host.waitForFunction(()=>!qa.world.players[0].hangSupport);
  await host.mouse.down({button:'right'});await host.waitForFunction(()=>qa.world.players[0].curl);
  await host.evaluate(()=>window.dispatchEvent(new Event('blur')));await host.waitForFunction(()=>!qa.world.players[0].curl);await host.mouse.up({button:'right'});
  await fixture(host);await guest.bringToFront();await guest.emulateMedia({reducedMotion:'reduce'});await guest.setViewportSize({width:1440,height:900});
  await guest.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await guest.keyboard.down('ShiftLeft');await host.waitForFunction(()=>qa.world.players.find(p=>p.id===1).curl);
  await guest.keyboard.up('ShiftLeft');await host.waitForFunction(()=>!qa.world.players.find(p=>p.id===1).curl);
  report.routes={host:await relay(host),guest:await relay(guest),late:await relay(late)};
  for(const routes of Object.values(report.routes))assert.ok(routes.some(p=>p.local==='relay'&&p.remote==='relay'));
  await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));
  assert.deepEqual(errors,[]);report.errors=errors;report.ok=true;
  await fs.writeFile(new URL('report.json',output),JSON.stringify(report,null,2));
  console.log('Desktop tuck, roll, flip, faster hang, release, reduced motion and changed-world relay hot join passed.');
}finally{await browser.close();await server.close();}
