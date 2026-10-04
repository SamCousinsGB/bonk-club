// Desktop-only source art, fluid, sound and changed-world relay verification.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/liquid-swimming/',import.meta.url);
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
  const {World}=await import(module('engine')),{Renderer}=await import(module('renderer')),{Sound}=await import(module('audio'));
  qa.carve=(await import(module('terrain'))).carveExplosion;
  qa.reactions=(await import(module('reactions'))).updateReactions;
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
  report.flow=await host.evaluate(()=>{
    const w=qa.world;w.damageCover(w.platforms.find(p=>p.refineryPipe===3),200);
    for(let n=0;n<1800;n++){w.time+=.05;qa.reactions(w,.05);}
    const oil=w.spills.filter(q=>q.kind==='oil');
    return {left:oil.filter(q=>q.x<500).reduce((n,q)=>n+q.h,0),right:oil.filter(q=>q.x>1500).reduce((n,q)=>n+q.h,0),depth:Math.max(...oil.map(q=>q.h)),columns:oil.length};
  });
  assert.ok(report.flow.left>2000&&report.flow.right>3000&&report.flow.depth<500);await host.waitForTimeout(500);await shot(host,'sideways-flow');
  await host.evaluate(()=>{for(const [i,p]of qa.world.players.entries())Object.assign(p,{x:760+i*140,y:1270,rig:null,vx:0,vy:0,ground:false,weapon:'blaster',ammo:20,cooldown:0});});
  await guest.waitForFunction(()=>qa.rendered.players.find(p=>p.id===1)?.submerged);await host.waitForTimeout(1800);
  report.breath=await Promise.all([host,guest].map(p=>p.evaluate(()=>qa.rendered.players.filter(p=>p.alive).map(p=>({id:p.id,swimming:p.swimming,submerged:p.submerged,oxygen:p.oxygen})))));
  assert.ok(report.breath.every(ps=>ps.every(p=>p.swimming&&p.submerged&&p.oxygen<11)));await shot(guest,'oil-breath');
  const oldY=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).y);
  const aim=await guest.evaluate(()=>{const p=qa.rendered.players.find(p=>p.id===1),c=document.querySelector('canvas').getBoundingClientRect();return {x:c.left+p.x*c.width/2560,y:c.top+(p.y-400)*c.height/1440};});
  await guest.mouse.move(aim.x,aim.y);await guest.mouse.down();await guest.keyboard.down('Space');await guest.waitForTimeout(850);await guest.mouse.up();await guest.keyboard.up('Space');
  report.guestRise=oldY-await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).y);assert.ok(report.guestRise>30);
  await shot(guest,'guest-swimming');
  await host.evaluate(()=>{const p=qa.world.players.find(p=>p.id===1);Object.assign(p,{x:1280,y:200,rig:null,vx:0,vy:0,knockdown:0,stun:0});});
  await guest.waitForFunction(()=>{const p=qa.rendered.players.find(p=>p.id===1);return !p.submerged&&p.oxygen>11.9;});report.recovered=true;
  const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});
  await late.waitForFunction(()=>qa.rendered?.spills.some(q=>q.kind==='oil'&&q.x>1500&&q.h>2));
  report.hotJoin=await late.evaluate(()=>({spills:qa.rendered.spills.length,breath:qa.rendered.players.some(p=>p.oxygen<12)}));assert.ok(report.hotJoin.breath);await shot(late,'hot-join');
  await host.evaluate(()=>qa.world.startRound());await late.waitForFunction(()=>qa.rendered.phase==='countdown'&&qa.rendered.spills.length===0&&qa.rendered.players.every(p=>p.oxygen===12&&!p.swimming));report.reset=true;
  for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
  report.render=await host.evaluate(()=>{const t=qa.timings.toSorted((a,b)=>a-b);return {median:t[Math.floor(t.length*.5)],p95:t[Math.floor(t.length*.95)]};});
  await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const [i,p]of pages.entries()){await shot(p,'failure-'+i);console.log(JSON.stringify(await p.evaluate(()=>({text:document.body.innerText.slice(-400),world:qa.world?.phase,render:qa.rendered?.phase,clock:qa.world?.refinery?.clock,oil:qa.world?.spills?.filter(q=>q.kind==='oil').reduce((s,q)=>s+q.h,0)}))));}console.log(errors);throw e;}
finally{for(const p of pages)await p.context().close();await browser.close();await server.close();}
