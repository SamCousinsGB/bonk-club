// Desktop source verification: real controls and host-owned fire over TURN.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from '../../node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=new URL('../test-results/roll-fire/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:5412,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium',headless:true});
const base='https://samcousinsgb.github.io/bonk-club/',pages=[],errors=[],report={};
async function page(){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  await context.route('https://samcousinsgb.github.io/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:'http://127.0.0.1:5412'+u.pathname.replace(/^\/bonk-club\//,'/')+u.search});await route.fulfill({response:r});});
  await context.addInitScript(()=>{window.qa={};window.qaConnections=[];const RTC=RTCPeerConnection;window.RTCPeerConnection=class extends RTC{constructor(c,...r){super({...c,iceTransportPolicy:'relay'},...r);qaConnections.push(this);}};});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);return p;
}
async function hook(p){await p.evaluate(async()=>{
  const module=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/'+name+'.js')).name;
  const {World}=await import(module('engine')),{Renderer}=await import(module('renderer'));
  qa.ignite=(await import(module('specials'))).impactSpecial;
  const step=World.prototype.step,draw=Renderer.prototype.draw;
  World.prototype.step=function(...a){qa.world=this;return step.apply(this,a);};
  Renderer.prototype.draw=function(s,...a){if(s)qa.rendered=s;return draw.call(this,s,...a);};
});}
const shot=(p,name)=>p.screenshot({path:fileURLToPath(new URL(name+'.png',output))});
const ignite=(host,id)=>host.evaluate(id=>qa.ignite(qa.world,{kind:'flame',burn:1},qa.world.players.find(p=>p.id===id),true),id);
try{
  const host=await page();await host.goto(base);await hook(host);await host.locator('#play').click();await host.locator('#room-code').waitFor({timeout:45000});
  for(const id of [1,2,3])await host.locator('[data-slot="'+id+'"]').selectOption('player');
  await host.locator('#choose-maps').click();await host.locator('#select-none').click();await host.getByRole('checkbox',{name:'REFINERY',exact:true}).check();await host.locator('#selection-done').click();
  const code=await host.locator('#room-code').inputValue(),guest=await page();await guest.goto(base+'?room='+code);await hook(guest);await guest.locator('#join-invite').click();await guest.locator('#room-code').waitFor({timeout:45000});await guest.locator('#ready-up').click();
  await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);await host.locator('#start-match').click();await host.waitForFunction(()=>qa.world?.phase==='fight'&&qa.world.players.every(p=>p.ground));
  await ignite(host,0);await host.locator('.effect-burning').waitFor({timeout:1000});await shot(host,'host-burning');
  await host.mouse.down({button:'right'});await host.waitForTimeout(250);
  assert.ok(await host.evaluate(()=>qa.world.players[0].burn>2),'stationary curl keeps burning');
  await host.keyboard.down('KeyD');await host.waitForFunction(()=>qa.world.players[0].curl&&qa.world.players[0].burn===0,null,{timeout:1000});await host.waitForTimeout(150);await shot(host,'host-extinguished');
  await host.mouse.up({button:'right'});await host.keyboard.up('KeyD');
  const hp=await host.evaluate(()=>qa.world.players[0].hp);await host.waitForTimeout(300);assert.equal(await host.evaluate(()=>qa.world.players[0].hp),hp);
  assert.equal(await host.locator('.effect-burning').count(),0);report.host={hp,extinguished:true};
  await ignite(host,1);await guest.locator('.effect-burning').waitFor({timeout:1000});await shot(guest,'guest-burning');
  await guest.keyboard.down('ShiftLeft');await guest.keyboard.down('KeyA');
  await host.waitForFunction(()=>qa.world.players.find(p=>p.id===1).curl&&qa.world.players.find(p=>p.id===1).burn===0,null,{timeout:1000});
  await guest.waitForFunction(()=>qa.rendered.players.find(p=>p.id===1).burn===0,null,{timeout:1000});await guest.waitForTimeout(150);await shot(guest,'guest-extinguished');
  await guest.keyboard.up('ShiftLeft');await guest.keyboard.up('KeyA');assert.equal(await guest.locator('.effect-burning').count(),0);report.guest=true;
  const late=await page();await late.goto(base+'?room='+code);await hook(late);await late.locator('#join-invite').click();await late.locator('body.playing').waitFor({timeout:45000});await late.waitForFunction(()=>qa.rendered?.arenaIndex===13&&qa.rendered.phase==='fight'&&qa.rendered.players.length===3);
  assert.ok(await late.evaluate(()=>qa.rendered.players.every(p=>p.burn===0)));report.hotJoin=true;
  await ignite(host,0);await host.locator('.effect-burning').waitFor({timeout:1000});assert.ok(await host.evaluate(()=>qa.world.players[0].burn>0));report.reignition=true;
  for(const p of [host,guest,late])assert.ok(await p.evaluate(async()=>{for(const pc of qaConnections){const stats=await pc.getStats();for(const s of stats.values())if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated&&stats.get(s.localCandidateId)?.candidateType==='relay'&&stats.get(s.remoteCandidateId)?.candidateType==='relay')return true;}return false;}));report.relay=true;
  await host.keyboard.press('Escape');await host.locator('#leave').click();await guest.waitForFunction(()=>!document.body.classList.contains('playing'));assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('source-browser.json',output),JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify(report));
}catch(e){for(const [i,p]of pages.entries())await shot(p,'failure-'+i);throw e;}
finally{await browser.close();await server.close();}
