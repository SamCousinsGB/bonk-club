// Desktop host/guest movement and changed-world joins through real public TURN.
// Source is served at the publisher origin so the normal room policy applies.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/arena-review/relay/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5421,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report=[];
async function page(){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5421'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
  await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
  const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
  const {World,ARENAS}=await import(module('engine')),{Renderer}=await import(module('renderer'));
  qa.names=ARENAS.map(a=>a.name);qa.carve=(await import(module('terrain'))).carveExplosion;
  qa.encoder=new (await import(module('render-state'))).RenderSnapshots();
  const step=World.prototype.step,draw=Renderer.prototype.draw;
  World.prototype.step=function(...a){qa.world=this;if(!qa.freeze)return step.apply(this,a);};
  Renderer.prototype.draw=function(s,...a){if(s){qa.rendered=s;qa.renderer=this;}return draw.call(this,s,...a);};
  qa.geometry=s=>JSON.stringify(s.platforms.map(p=>[p.id,p.x,p.y,p.w,p.h,p.hp??null,p.sourceId??null]));
});}
async function relay(p){return p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;});}
const shot=(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
try{
  const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
  for(const id of [1,2,3])await host.locator('[data-slot="'+id+'"]').selectOption('player');
  const code=await host.locator('#room-code').inputValue(),guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});await guest.locator('#ready-up').click();
  await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);await host.locator('#start-match').click();await guest.locator('body.playing').waitFor();
  const names=await host.evaluate(()=>qa.names);
  for(const [index,name]of names.entries()){
    const round=await host.evaluate(index=>{qa.freeze=false;const w=qa.world;w.shuffle=false;w.arenaIndex=index;w.round++;w.startRound();return w.round;},index);
    for(const p of [host,guest])await p.waitForFunction(({index,round})=>qa.rendered?.arenaIndex===index&&qa.rendered.round===round&&qa.rendered.phase==='fight',{index,round});
    const before=await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);
    await guest.keyboard.down('KeyA');await guest.waitForTimeout(400);await guest.keyboard.up('KeyA');
    const moved=before-await guest.evaluate(()=>qa.rendered.players.find(p=>p.id===1).x);assert.ok(moved>20,`${name}: guest moves inward (${moved})`);
    await guest.keyboard.press('Space');await host.keyboard.down('KeyD');await host.waitForTimeout(350);await host.keyboard.up('KeyD');
    await shot(guest,`${index}-guest-play`);
    const expected=await host.evaluate(()=>{
      const w=qa.world,before=qa.geometry(w.snapshot());
      for(const [x,y]of [[700,850],[1280,1040],[1900,600]])qa.carve(w,{x,y,radius:150});
      w.step(1/120);qa.freeze=true;
      const s=qa.encoder.make(w.snapshot());return {geometry:qa.geometry(s),changed:qa.geometry(s)!==before,cover:JSON.stringify(s.cover.map(b=>[b.id,b.x,b.y,b.w,b.h]))};
    });assert.ok(expected.changed,`${name}: damaged fixture`);
    await guest.waitForFunction(g=>qa.geometry(qa.rendered)===g,expected.geometry,{timeout:20000});
    const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});
    await late.waitForFunction(g=>qa.rendered&&qa.geometry(qa.rendered)===g,expected.geometry,{timeout:20000});
    assert.equal(await late.evaluate(()=>JSON.stringify(qa.rendered.cover.map(b=>[b.id,b.x,b.y,b.w,b.h]))),expected.cover,`${name}: resized supplies survive join`);
    assert.ok(await relay(late));await shot(late,`${index}-damaged-join`);
    await late.keyboard.press('Escape');await late.locator('#leave').click();await late.context().close();
    report.push({name,moved,damagedJoin:true,geometryExact:true,containersExact:true});console.log(`${name}: controls, damaged geometry, supplies and relay hot join passed`);
  }
  assert.ok(await relay(host));assert.ok(await relay(guest));
  // Reset and desktop resize/reduced-motion checks use the real game renderer.
  await host.evaluate(()=>{qa.freeze=false;qa.world.startRound();});await guest.waitForFunction(()=>qa.rendered.phase==='countdown'&&!qa.rendered.platforms.some(p=>p.sourceId));
  await guest.emulateMedia({reducedMotion:'reduce'});await guest.setViewportSize({width:1280,height:800});await shot(guest,'reset-reduced-desktop');
  await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));
  assert.deepEqual(errors,[]);await fs.writeFile(new URL('report.json',output),JSON.stringify({report,reset:true,departure:true,errors,scope:'One-machine desktop public relay checks; not cross-ISP or Steam qualification.'},null,2));
}catch(e){for(const [i,p]of pages.entries())if(!p.isClosed()){await shot(p,'failure-'+i);console.log(await p.evaluate(()=>({text:document.body.innerText.slice(-600),arena:qa.rendered?.arenaIndex,phase:qa.rendered?.phase})));}throw e;}
finally{await browser.close();await server.close();}
