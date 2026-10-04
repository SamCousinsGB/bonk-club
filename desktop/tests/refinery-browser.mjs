// Desktop-only source art, fluid, sound and changed-world relay verification.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/refinery-fire/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5407,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5407'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
  await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
  const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
  const {World}=await import(module('engine')),{Renderer}=await import(module('renderer')),{Sound}=await import(module('audio'));
  qa.carve=(await import(module('terrain'))).carveExplosion;qa.refinery=await import(module('refinery'));
  const {REFINERY_PIPES}=await import(module('refinery-arena'));
  qa.shootPipe=id=>{
    const w=qa.world,p=w.players[0],pipe=REFINERY_PIPES[id],save={x:p.x,y:p.y,weapon:p.weapon,ammo:p.ammo,aimAngle:p.aimAngle};
    const x=(pipe.x+pipe.ex)/2,y=Math.max(pipe.y,pipe.ey)+12;
    Object.assign(p,{x,y:y+80,aimAngle:-Math.PI/2,weapon:'railgun',ammo:12,cooldown:0,stun:0,ground:true});
    w.attack(p);w.updateProjectiles(.1);Object.assign(p,save);p.rig=null;
    return w.platforms.find(q=>q.refineryPipe===id)?.hp===0;
  };
  qa.igniteGas=()=>{
    const w=qa.world,p=w.players[0],save={x:p.x,y:p.y,weapon:p.weapon,ammo:p.ammo,aimAngle:p.aimAngle};
    // Aim at fresh gas from the supplied opening, before unrelated destruction
    // cuts its feed or releases the cooling water tank below it.
    const source=REFINERY_PIPES.find(q=>q.route===2&&w.refinery.pipes[q.id].broken),at=qa.refinery.pipeOpening(w.platforms,source.id);
    for(const g of w.gas.filter(g=>g.spray&&!g.lit&&Math.hypot(g.x-at.x,g.y-at.y)<80).sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y)))for(const side of [-1,1]){
      Object.assign(p,{x:g.x+side*75,y:g.y+8,rig:null,aimAngle:side>0?Math.PI:0,weapon:'flame',ammo:30,cooldown:0,stun:0,ground:true});
      w.attack(p);w.updateProjectiles(.12);
      if(w.gas.some(g=>g.spray&&g.lit)){Object.assign(p,save);p.rig=null;return true;}
    }
    Object.assign(p,save);p.rig=null;return false;
  };
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
  const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);await guest.keyboard.down('KeyA');await guest.waitForTimeout(500);await guest.keyboard.up('KeyA');await guest.keyboard.press('Space');await guest.waitForTimeout(350);
  const after=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(after<before-35);report.guestMovement=before-after;
  await host.waitForTimeout(12000);await shot(host,'working-refinery');report.process=await host.evaluate(()=>({processed:qa.world.refinery.processed,tanks:qa.world.refinery.tanks.map(q=>q.volume)}));assert.ok(report.process.processed>150);
  report.audio=await host.evaluate(()=>({state:qa.sound.context.state,voices:[...qa.sound.refinery.voices.keys()]}));assert.equal(report.audio.state,'running');assert.ok(report.audio.voices.includes('refinery-pump'));
  await host.evaluate(()=>qa.carve(qa.world,{x:1890,y:400,radius:35}));
  await host.waitForTimeout(350);
  assert.ok(await host.evaluate(()=>qa.igniteGas()));
  await host.waitForTimeout(1500);await shot(host,'burning-gas');
  assert.ok(await host.evaluate(()=>qa.world.gas.some(g=>g.spray&&g.lit)),'new fuel keeps the spray burning after the shot');
  const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});await late.waitForFunction(()=>qa.rendered?.refinery?.pipes.some(p=>p.broken));
  await host.waitForTimeout(250);
  const states=await Promise.all([host,guest,late].map(p=>p.evaluate(()=>({time:qa.rendered.refinery.clock,broken:qa.rendered.refinery.pipes.filter(q=>q.broken).map(q=>q.id),tanks:qa.rendered.refinery.tanks.map(q=>q.volume)}))));
  assert.deepEqual(states[0].broken,states[2].broken);assert.ok(Math.max(...states.map(s=>s.time))-Math.min(...states.map(s=>s.time))<.5);report.hotJoin=states;
  await late.waitForFunction(()=>qa.rendered.gas.some(g=>g.spray&&g.lit));
  for(const p of [host,guest,late])assert.ok(await p.evaluate(()=>qa.rendered.gas.some(g=>g.spray&&g.lit)));
  report.fireAudio=await host.evaluate(()=>({state:qa.sound.context.state,voices:[...qa.sound.refinery.voices.keys()]}));
  assert.ok(report.fireAudio.voices.includes('refinery-fire'));
  await shot(late,'hot-join');
  assert.ok(await host.evaluate(()=>qa.shootPipe(11)));assert.ok(await host.evaluate(()=>qa.shootPipe(35)));
  await host.waitForTimeout(1800);await shot(host,'pipe-leaks');assert.ok(await host.evaluate(()=>qa.world.spills.some(s=>s.kind==='petrol')&&qa.world.spills.some(s=>s.kind==='acid')));
  report.shotPipeLeaks=await host.evaluate(()=>({chemicals:[...new Set(qa.world.spills.map(s=>s.kind))],released:qa.world.refinery.released}));
  for(const p of [host,guest,late])assert.ok(await p.evaluate(()=>[11,35].every(id=>qa.rendered.refinery.pipes[id].broken&&!qa.rendered.platforms.some(q=>q.refineryPipe===id&&q.hp!==0))));
  await host.evaluate(()=>qa.refinery.heatRefinery(qa.world,t=>t.name==='PETROL',4));
  await host.waitForFunction(()=>qa.world.refinery.tanks[2].warning>0);await shot(host,'pressure-warning');
  // A falling water tank may cool the petrol vessel in this live scene. Heat
  // the separate central cracker to verify rupture independently of that spill.
  await host.evaluate(()=>qa.refinery.heatRefinery(qa.world,t=>t.name==='CRACKER',4));
  await host.waitForFunction(()=>qa.world.refinery.tanks[1].burst,{},{timeout:15000});await late.waitForFunction(()=>qa.rendered.refinery.tanks[1].burst);await shot(host,'tank-rupture');
  report.rupture=await host.evaluate(()=>({core:qa.world.refinery.tanks[1],petrol:qa.world.refinery.tanks[2],chunks:qa.world.chunks.length}));
  await guest.emulateMedia({reducedMotion:'reduce'});await guest.evaluate(()=>qa.renderer.reduced=true);await guest.setViewportSize({width:1280,height:800});await shot(guest,'reduced-resized');
  await host.evaluate(()=>qa.world.startRound());await late.waitForFunction(()=>qa.rendered.phase==='countdown'&&qa.rendered.platforms.length===89&&qa.rendered.refinery.pipes.every(p=>!p.broken));report.reset=true;
  for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
  await host.evaluate(()=>{qa.world.botIds=new Set([0,1,2,3]);qa.world.ids=[0,1,2,3];qa.world.startRound();qa.actions=0;const event=qa.world.event;qa.world.event=function(type,...a){if(type==='shoot'||type==='swing')qa.actions++;return event.call(this,type,...a);};});
  await host.waitForTimeout(18000);await shot(host,'bots');report.botActions=await host.evaluate(()=>qa.actions);assert.ok(report.botActions>0);
  report.render=await host.evaluate(()=>{const t=qa.timings.toSorted((a,b)=>a-b);return {median:t[Math.floor(t.length*.5)],p95:t[Math.floor(t.length*.95)]};});
  await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const [i,p]of pages.entries()){await shot(p,'failure-'+i);console.log(JSON.stringify(await p.evaluate(()=>({text:document.body.innerText.slice(-400),world:qa.world?.phase,render:qa.rendered?.phase,clock:qa.world?.refinery?.clock,tanks:qa.world?.refinery?.tanks}))));}console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
