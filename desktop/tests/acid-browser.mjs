// Desktop source QA: actual barrel rupture, progressive floor cuts, real relay
// transport and a guest joining the already damaged world.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../../node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('../test-results/acid/', import.meta.url);
const { version } = JSON.parse(await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'));
await fs.mkdir(output, { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5401, strictPort: true, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const base = 'https://samcousinsgb.github.io/bonk-club/', errors = [], pages = [];
async function page() {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 },
    recordVideo: { dir: fileURLToPath(output), size: { width: 1600, height: 900 } } });
  await context.route('https://samcousinsgb.github.io/**', async route => {
    const u = new URL(route.request().url()), pathname = u.pathname.replace(/^\/bonk-club\//, '/');
    const response = await route.fetch({ url: 'http://127.0.0.1:5401' + pathname + u.search });
    await route.fulfill({ response });
  });
  await context.addInitScript(() => {
    window.qa = {}; const RTC = RTCPeerConnection; window.qaConnections = [];
    window.RTCPeerConnection = class extends RTC {
      constructor(config, ...rest) { super({ ...config, iceTransportPolicy: 'relay' }, ...rest); qaConnections.push(this); }
    };
  });
  const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); pages.push(p); return p;
}
async function hook(p) {
  await p.waitForFunction(version => document.querySelector('#release-version')?.textContent === `v${version}`, version);
  await p.evaluate(async () => {
    const url = name => performance.getEntriesByType('resource').find(e => e.name.includes('/src/' + name + '.js')).name;
    const { World } = await import(url('engine')), { Renderer } = await import(url('renderer'));
    qa.props = await import(url('props')); qa.reactions = await import(url('reactions'));
    const { RenderSnapshots } = await import(url('render-state')); qa.snapshots = new RenderSnapshots();
    const step = World.prototype.step, draw = Renderer.prototype.draw;
    World.prototype.step = function (...args) { qa.world = this; if (qa.hold) return;
      const result = step.apply(this, args);
      if (qa.stopAt && this.time >= qa.stopAt) qa.hold = true;
      return result;
    };
    Renderer.prototype.draw = function (state, ...args) { qa.rendered = state; return draw.call(this, state, ...args); };
  });
}
const pick = s => JSON.parse(JSON.stringify({ platforms: s.platforms, spills: s.spills.map(({ netId, ...q }) => q) }));
try {
  const host = await page(); await host.goto(base); await hook(host); await host.locator('#play').click();
  await host.locator('#room-code').waitFor({ timeout: 45000 });
  for (const id of [1, 2, 3]) await host.locator(`[data-slot="${id}"]`).selectOption('player');
  await host.locator('#choose-maps').click(); await host.locator('#select-none').click();
  await host.getByRole('checkbox', { name: 'COLOSSUS', exact: true }).check(); await host.locator('#selection-done').click();
  const code = await host.locator('#room-code').inputValue();
  const guest = await page(); await guest.goto(base + '?room=' + code); await hook(guest); await guest.locator('#join-invite').click();
  await guest.locator('#room-code').waitFor({ timeout: 45000 }); await guest.locator('#ready-up').click();
  await host.waitForFunction(() => !document.querySelector('#start-match').disabled); await host.locator('#start-match').click();
  await guest.waitForFunction(() => qa.rendered?.phase === 'fight');
  const start = await host.evaluate(() => {
    const w = qa.world; w.round++; w.startRound(); w.phase = 'fight';
    w.cover = []; w.chunks = []; w.hazards = []; w.drops = []; w.water = []; w.spills = []; w.gas = [];
    w.weaponTimer = w.grenadeTimer = 999;
    w.platforms = [
      { id: 'qa-top', x: 300, y: 500, w: 1960, h: 48 },
      { id: 'qa-middle', x: 300, y: 800, w: 1960, h: 24 },
      { id: 'qa-bottom', x: 300, y: 1120, w: 1960, h: 32 },
    ].map(s => ({ ...s, material: 'metal', baseX: s.x, baseY: s.y, dx: 0, dy: 0 }));
    const barrel = qa.props.prepareProp({ id: 'qa-acid', kind: 'acidBarrel', x: 1210, y: 414, w: 72, h: 86,
      hp: 85, maxHp: 85, liquidLeft: 240, liquidCapacity: 240 });
    const stone = qa.props.prepareProp({ id: 'qa-stone', kind: 'stone', x: 1215, y: 1060, w: 90, h: 60, hp: 85, maxHp: 85 });
    w.cover = [barrel, stone];
    for (const p of w.players) Object.assign(p, { x: 650 + p.id * 1250, y: 470, vx: 0, vy: 0, ground: true,
      support: 'qa-top', rig: null, spawnShield: 0 });
    w.terrainVersion++; qa.hold = true;
    return w.time;
  });
  await host.screenshot({ path: fileURLToPath(new URL('before.png', output)) });
  await host.evaluate(() => {
    qa.world.damageCover(qa.world.cover.find(p => p.id === 'qa-acid'), 1000);
    qa.stopAt = qa.world.time + .7; qa.hold = false;
  });
  await host.waitForFunction(() => qa.hold);
  assert.ok(await host.evaluate(() => qa.world.platforms.some(p => p.sourceId === 'qa-top')));
  assert.ok(await host.evaluate(() => qa.world.platforms.some(p => p.id === 'qa-middle')), 'middle remains shielded initially');
  await host.screenshot({ path: fileURLToPath(new URL('first-bites.png', output)) });
  await host.evaluate(() => { qa.stopAt = qa.world.time + 10; qa.hold = false; });
  await guest.keyboard.down('KeyD'); await guest.waitForTimeout(250); await guest.keyboard.up('KeyD');
  await host.waitForFunction(() => qa.hold, null, { timeout: 45000 });
  const lower = await host.evaluate(() => ({
    middle: qa.world.platforms.some(p => p.sourceId === 'qa-middle'), bottom: qa.world.platforms.some(p => p.sourceId === 'qa-bottom'),
    stone: qa.world.cover.find(p => p.id === 'qa-stone')?.hp ?? 0,
    guestX: qa.world.players.find(p => p.id === 1).x,
    state: qa.snapshots.make(qa.world.snapshot()),
  }));
  assert.ok(lower.middle && lower.bottom, 'acid reaches both lower floors'); assert.ok(lower.stone < 85);
  assert.ok(lower.guestX > 1920, 'guest controls reach the host');
  await guest.waitForFunction(() => qa.rendered?.platforms.some(p => p.sourceId === 'qa-bottom'));
  await guest.waitForTimeout(400);
  assert.deepEqual(pick(await guest.evaluate(() => qa.rendered)), pick(lower.state));
  await host.screenshot({ path: fileURLToPath(new URL('through-floors.png', output)) });
  const late = await page(); await late.goto(base + '?room=' + code); await hook(late); await late.locator('#join-invite').click();
  await late.locator('body.playing').waitFor({ timeout: 45000 });
  await late.waitForFunction(() => qa.rendered?.platforms.some(p => p.sourceId === 'qa-bottom'));
  assert.deepEqual(pick(await late.evaluate(() => qa.rendered)), pick(lower.state));
  await late.screenshot({ path: fileURLToPath(new URL('hot-join.png', output)) });
  await late.emulateMedia({ reducedMotion: 'reduce' });
  await late.screenshot({ path: fileURLToPath(new URL('reduced-motion.png', output)) });
  for (const p of [host, guest, late]) assert.ok(await p.evaluate(async () => {
    for (const pc of qaConnections) { const stats = await pc.getStats();
      for (const s of stats.values()) if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated &&
        stats.get(s.localCandidateId)?.candidateType === 'relay' && stats.get(s.remoteCandidateId)?.candidateType === 'relay') return true;
    } return false;
  }));
  await host.evaluate(() => {
    qa.world.round++; qa.world.startRound(); qa.world.phase = 'fight';
    qa.stopAt = qa.world.time + .15; qa.hold = false;
  });
  await late.waitForFunction(() => qa.rendered?.spills.length === 0 && !qa.rendered.platforms.some(p => p.id.startsWith('acid')));
  assert.deepEqual(errors, []);
  await fs.writeFile(new URL('source-browser.json', output), JSON.stringify({ ok: true, simulated: lower.state.time - start,
    middle: lower.middle, bottom: lower.bottom, stoneHp: lower.stone, guestControls: true, exactHotJoin: true, reset: true, errors }, null, 2));
  console.log('Desktop acid rupture, progressive floor cuts, lower objects, guest controls, exact hot join and reset pass over real relay routes.');
} catch (error) {
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: fileURLToPath(new URL(`failure-${i}.png`, output)) });
    console.log(await p.evaluate(() => ({ text: document.body.innerText.slice(-800), phase: qa.world?.phase,
      time: qa.world?.time, spills: qa.world?.spills.length, platforms: qa.world?.platforms.length })));
  }
  console.log({ errors }); throw error;
} finally { for (const p of pages) await p.context().close(); await browser.close(); await server.close(); }
