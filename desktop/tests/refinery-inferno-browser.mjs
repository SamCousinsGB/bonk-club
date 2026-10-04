// Desktop-only source art, fluid, sound and changed-world relay verification.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/refinery-inferno/',import.meta.url);
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
  const {World}=await import(module('engine')),{Renderer}=await import(module('renderer')),{Sound}=await import(module('audio'));
  qa.carve=(await import(module('terrain'))).carveExplosion;
  qa.smoke=(await import(module('refinery-smoke'))).refinerySmokeSources;
  const step=World.prototype.step,draw=Renderer.prototype.draw,update=Sound.prototype.update;
  World.prototype.step=function(...a){qa.world=this;return step.apply(this,a);};
  Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}const t=performance.now(),v=draw.call(this,s,...a);(qa.timings||=[]).push(performance.now()-t);if(qa.timings.length>600)qa.timings.shift();return v;};
  Sound.prototype.update=function(...a){qa.sound=this;return update.apply(this,a);};
});}
const shot=(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
try{
  const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
  for(const id of [1,2,3])await host.locator('[data-slot="'+id+'"]').selectOption('player');
  await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'REFINERY',exact:true}).check();await host.locator('#selection-done').click();
  const code=await host.locator('#room-code').inputValue(),guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});await guest.locator('#ready-up').click();
  await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);await host.locator('#start-match').click();await host.waitForFunction(()=>qa.world?.arena?.refinery&&qa.world.phase==='fight');await guest.waitForFunction(()=>qa.rendered?.arenaIndex===13&&qa.rendered.phase==='fight');
  const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);await guest.keyboard.down('KeyA');await guest.waitForTimeout(500);await guest.keyboard.up('KeyA');
  report.guestMovement=before-await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(report.guestMovement>35);
  await host.waitForTimeout(12000);await shot(host,'oil-in-tanks');
  assert.ok(await host.evaluate(()=>{
    const w=qa.world,p=w.players[0],save={x:p.x,y:p.y,vx:p.vx,vy:p.vy,weapon:p.weapon,ammo:p.ammo,aimAngle:p.aimAngle};
    Object.assign(p,{x:970,y:975,rig:null,aimAngle:Math.PI,weapon:'railgun',ammo:12,cooldown:0,stun:0});w.attack(p);w.updateProjectiles(.1);Object.assign(p,save);p.rig=null;
    return w.platforms.find(p=>p.refineryPipe===3)?.hp===0;
  }));
  await host.waitForTimeout(2000);await shot(host,'oil-pouring');
  report.flow=await host.evaluate(()=>({released:qa.world.refinery.released,voices:[...qa.sound.refinery.voices.keys()]}));assert.ok(report.flow.released>350);assert.ok(report.flow.voices.includes('refinery-flow'));
  await host.waitForTimeout(8000);await shot(host,'oil-lake');
  const pool=p=>p.evaluate(()=>{const oil=qa.rendered.spills.filter(q=>q.kind==='oil');return {volume:oil.reduce((s,q)=>s+q.h,0),depth:Math.max(0,...oil.map(q=>q.h)),burning:oil.filter(q=>q.fire>0).length,columns:oil.length,clock:qa.rendered.refinery.clock};});
  report.lake=await pool(host);assert.ok(report.lake.volume>1400&&report.lake.depth>60);
  assert.ok(await host.evaluate(()=>{
    const w=qa.world,p=w.players[0],q=w.spills.find(q=>q.kind==='oil'&&q.x>700&&q.x<900&&q.h>60),save={x:p.x,y:p.y,vx:p.vx,vy:p.vy,weapon:p.weapon,ammo:p.ammo,aimAngle:p.aimAngle};
    Object.assign(p,{x:q.x+16,y:q.y-70,rig:null,aimAngle:Math.PI/2,weapon:'flame',ammo:30,cooldown:0,stun:0});w.attack(p);w.updateProjectiles(.15);Object.assign(p,save);p.rig=null;
    return w.spills.some(q=>q.kind==='oil'&&q.fire>0);
  }));
  await host.waitForTimeout(8000);await shot(host,'burning-lake');
  report.inferno=await host.evaluate(()=>({smoke:qa.smoke(qa.rendered).length,gas:qa.world.gas.filter(g=>g.spray&&g.lit).length,supplied:qa.world.refinery.supplied,broken:qa.world.refinery.pipes.filter(p=>p.broken).length}));
  assert.ok(report.inferno.smoke>0&&report.inferno.supplied>2200);
  const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});await late.waitForFunction(()=>qa.rendered?.spills.some(q=>q.kind==='oil'&&q.fire>0&&q.h>20));
  report.hotJoin=await Promise.all([host,guest,late].map(pool));assert.ok(report.hotJoin.every(p=>p.burning>0&&p.depth>20));
  assert.ok(Math.max(...report.hotJoin.map(p=>p.clock))-Math.min(...report.hotJoin.map(p=>p.clock))<.5);await shot(late,'hot-join-burning-lake');
  report.audio=await host.evaluate(()=>({state:qa.sound.context.state,voices:[...qa.sound.refinery.voices.keys()]}));assert.equal(report.audio.state,'running');assert.ok(report.audio.voices.includes('refinery-fire'));
  await guest.emulateMedia({reducedMotion:'reduce'});await guest.evaluate(()=>qa.renderer.reduced=true);await guest.setViewportSize({width:1280,height:800});await shot(guest,'reduced-resized');
  const ground=await host.evaluate(()=>JSON.stringify(qa.world.platforms.filter(p=>p.refineryGround)));
  await host.evaluate(()=>qa.carve(qa.world,{x:800,y:1424,radius:300}));await host.waitForTimeout(2000);await shot(host,'contained-after-blast');
  assert.equal(await host.evaluate(()=>JSON.stringify(qa.world.platforms.filter(p=>p.refineryGround))),ground);
  assert.ok(await host.evaluate(()=>qa.world.spills.every(q=>q.y+q.h<=1424.01)));
  await host.evaluate(()=>qa.world.damageCover(qa.world.platforms.find(p=>p.refineryPipe===-1),200));await host.waitForTimeout(3000);await shot(host,'external-feed');
  report.feed=await host.evaluate(()=>({...qa.world.refinery.feed,supplied:qa.world.refinery.supplied}));assert.ok(report.feed.broken&&report.feed.flow>0);
  await host.evaluate(()=>qa.world.startRound());await late.waitForFunction(()=>qa.rendered.phase==='countdown'&&qa.rendered.spills.length===0&&qa.rendered.refinery.pipes.every(p=>!p.broken));report.reset=true;
  for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
  report.render=await host.evaluate(()=>{const t=qa.timings.toSorted((a,b)=>a-b);return {median:t[Math.floor(t.length*.5)],p95:t[Math.floor(t.length*.95)]};});
  await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const [i,p]of pages.entries()){await shot(p,'failure-'+i);console.log(JSON.stringify(await p.evaluate(()=>({text:document.body.innerText.slice(-400),world:qa.world?.phase,render:qa.rendered?.phase,clock:qa.world?.refinery?.clock,oil:qa.world?.spills?.filter(q=>q.kind==='oil').reduce((s,q)=>s+q.h,0)}))));}console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
