// Opt-in source-build QA over real TURN. Packet impairment is deterministic and
// local to these test pages; it is not a cross-ISP or Steam measurement.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = fileURLToPath(new URL('../../', import.meta.url));
const root = process.env.BONK_QA_ROOT || here, label = process.env.BONK_QA_LABEL || 'netcode';
const results = path.join(here, 'desktop/test-results');
await fs.mkdir(results, { recursive: true });
const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5397, strictPort: true, hmr: false, watch: null } });
await server.listen();
const base = 'https://samcousinsgb.github.io/bonk-club/';
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const errors = [], reports = [];
async function page() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.route('https://samcousinsgb.github.io/**', async route => {
    const u = new URL(route.request().url());
    const pathname = u.pathname.startsWith('/bonk-club/') ? u.pathname.slice('/bonk-club/'.length) : u.pathname.slice(1);
    const response = await route.fetch({ url: 'http://127.0.0.1:5397/' + pathname + u.search });
    await route.fulfill({ response });
  });
  await context.addInitScript(() => {
    const RTC = RTCPeerConnection; window.qaConnections = [];
    window.RTCPeerConnection = class extends RTC {
      constructor(config, ...rest) { super({ ...config, iceTransportPolicy: 'relay' }, ...rest); qaConnections.push(this); }
    };
    window.qa = { measuring: false, frames: [], draws: [], steps: [], updates: [], notices: [], reconciles: [] };
    function frame(now) { if (qa.measuring && qa.frameLast) qa.frames.push(now - qa.frameLast); qa.frameLast = now; requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  });
  const p = await context.newPage(); p.on('pageerror', error => errors.push(error.message)); return p;
}
async function hook(p) {
  await p.evaluate(async () => {
    const url = name => performance.getEntriesByType('resource').find(e => e.name.includes('/src/' + name + '.js')).name;
    const { World } = await import(url('engine')), { Renderer } = await import(url('renderer'));
    const { Room } = await import(url('network')), { GuestPrediction } = await import(url('guest-prediction'));
    const step = World.prototype.step, draw = Renderer.prototype.draw, emit = Room.prototype.emit, receive = GuestPrediction.prototype.receive;
    World.prototype.step = function (...args) { qa.world = this; const at = performance.now(); const result = step.apply(this, args); if (qa.measuring) qa.steps.push(performance.now() - at); return result; };
    Renderer.prototype.draw = function (state, ...args) { qa.rendered = state; if (qa.skipDrawing) return; const at = performance.now(); const result = draw.call(this, state, ...args); if (qa.measuring) qa.draws.push(performance.now() - at); return result; };
    Room.prototype.emit = function (name, ...args) { qa.room = this; if (name === 'onNotice') qa.notices.push(args[0]); if (name === 'onState' && qa.measuring) qa.updates.push({ at: performance.now(), time: args[0].time, round: args[0].round }); return emit.call(this, name, ...args); };
    GuestPrediction.prototype.receive = function (...args) { qa.prediction = this; const at = performance.now(); const result = receive.apply(this, args); if (qa.measuring) qa.reconciles.push(performance.now() - at); return result; };
  });
}
async function measure(p, scenario, role) {
  const report = await p.evaluate(async () => {
    qa.measuring = false;
    const q = (values, percentile) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * percentile)] : 0;
    const gaps = qa.updates.slice(1).map((v, i) => v.at - qa.updates[i].at);
    const selected = [];
    for (const pc of qaConnections) {
      const stats = await pc.getStats();
      for (const s of stats.values()) if (s.type === 'transport' && s.selectedCandidatePairId) {
        const pair = stats.get(s.selectedCandidatePairId);
        selected.push({ local: stats.get(pair.localCandidateId)?.candidateType, remote: stats.get(pair.remoteCandidateId)?.candidateType, rttMs: (pair.currentRoundTripTime || 0) * 1000 });
      }
    }
    return { frameP50: q(qa.frames, .5), frameP95: q(qa.frames, .95), frameMax: q(qa.frames, 1),
      drawP95: q(qa.draws, .95), stepP95: q(qa.steps, .95), reconcileP95: q(qa.reconciles, .95),
      updates: qa.updates.length, gapP95: q(gaps, .95), gapMax: q(gaps, 1),
      backwards: qa.updates.slice(1).filter((v, i) => v.round === qa.updates[i].round && v.time < qa.updates[i].time).length,
      stream: qa.room.connectionReport().realtime, selected, notices: [...new Set(qa.notices)],
    };
  });
  assert.ok(report.selected.some(pair => pair.local === 'relay' && pair.remote === 'relay'));
  assert.equal(report.backwards, 0); reports.push({ scenario, role, ...report });
  console.log(JSON.stringify(reports.at(-1)));
}
async function resetMetrics(p) {
  await p.evaluate(() => { for (const k of ['frames', 'draws', 'steps', 'updates', 'reconciles']) qa[k] = []; qa.frameLast = null; qa.measuring = true; });
}
async function fixture(host, name, holes = 0) {
  await host.evaluate(async ({ name, holes }) => {
    const url = name => performance.getEntriesByType('resource').find(e => e.name.includes('/src/' + name + '.js')).name;
    const { ARENAS } = await import(url('engine'));
    const { blackholeField } = await import(url('blackhole'));
    const w = qa.world; let seed = 12345;
    w.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    w.arenaIndex = ARENAS.findIndex(a => a.name.toLowerCase() === name.toLowerCase());
    if (w.arenaIndex < 0) throw new Error('Unknown arena ' + name);
    w.round++; w.startRound(); w.phase = 'fight'; w.weaponTimer = 999;
    w.fields = Array.from({ length: holes }, (_, i) => blackholeField(w, { x: 1050 + i * 430, y: 850, owner: 0 }));
  }, { name, holes });
}
try {
  const host = await page(); await host.goto(base); await hook(host); await host.locator('#play').click();
  await host.locator('#room-code').waitFor({ timeout: 45000 });
  const code = await host.locator('#room-code').inputValue();
  const guests = [];
  for (let i = 0; i < 2; i++) {
    const guest = await page(); await guest.goto(base + '?room=' + code); await hook(guest);
    await guest.locator('#join-invite').click(); await guest.locator('#room-code').waitFor({ timeout: 45000 });
    guests.push(guest);
  }
  for (const g of guests) await g.locator('#ready-up').click();
  await host.locator('#start-match').click(); await guests[0].waitForFunction(() => qa.rendered?.phase === 'fight');
  const guest = guests[0];
  await guest.keyboard.down('d'); await host.waitForFunction(() => qa.room.getInputs(performance.now(), false)[1]?.right);
  await guest.keyboard.up('d'); await host.waitForFunction(() => !qa.room.getInputs(performance.now(), false)[1]?.right);
  // A fourth player arrives after real terrain destruction.
  await fixture(host, 'Platforms', 2);
  await guest.waitForFunction(() => qa.rendered?.wreckage.length > 0);
  await host.waitForFunction(() => !qa.world.fields.some(f => f.kind === 'blackhole' && f.life > 0));
  const late = await page(); await late.goto(base + '?room=' + code); await hook(late); await late.locator('#join-invite').click();
  await late.waitForFunction(() => qa.rendered?.wreckage.length > 0, null, { timeout: 45000 }); guests.push(late);
  const terrainIds = await host.evaluate(() => qa.world.platforms.map(p => p.id).sort());
  for (const p of [guest, late]) {
    await p.waitForFunction(() => !qa.room.worldState.fields.some(f => f.kind === 'blackhole' && f.life > 0));
    assert.deepEqual(await p.evaluate(() => qa.room.worldState.platforms.map(p => p.id).sort()), terrainIds);
  }
  for (const [name, holes] of [['Platforms', 0], ['Car Assembly', 0], ['Platforms', 2]]) {
    await fixture(host, name, holes);
    await guest.waitForTimeout(400);
    for (const p of [host, ...guests]) await resetMetrics(p);
    await guest.waitForTimeout(4500);
    for (const [role, p] of [['host', host], ['guest', guest]]) await measure(p, name + (holes ? ' / two black holes' : ''), role);
    await guest.screenshot({ path: path.join(results, label + '-' + name.replaceAll(' ', '-') + '-' + holes + '.png') });
  }
  // Isolate the guest's rendering cost from four arenas competing for one GPU.
  for (const p of [host, ...guests.slice(1)]) await p.evaluate(() => { qa.skipDrawing = true; });
  await fixture(host, 'Platforms', 2); await guest.waitForTimeout(500);
  await resetMetrics(guest); await guest.waitForTimeout(3000);
  await measure(guest, 'two black holes / one rendered viewport', 'guest');
  await guest.screenshot({ path: path.join(results, label + '-single-viewport.png') });
  for (const p of [host, ...guests.slice(1)]) await p.evaluate(() => { qa.skipDrawing = false; });
  // Apply delay, loss, duplication and reordering in both directions. Controls
  // and snapshot channels remain real RTCDataChannels underneath the shim.
  for (const [p, hostSide] of [[host, true], [guest, false]]) await p.evaluate(hostSide => {
    const c = hostSide ? qa.room.connections.get(1) : qa.room.connection;
    const channel = c.realtime, send = channel.send.bind(channel); let serial = 0;
    channel.send = data => {
      const n = ++serial;
      if (n % 10 === 0) return;
      const copy = typeof data === 'string' ? data : data.slice();
      const deliver = () => { if (channel.readyState === 'open') send(copy); };
      setTimeout(deliver, 45 + n % 4 * 8 + (n % 13 === 0 ? 85 : 0));
      if (n % 17 === 0) setTimeout(deliver, 150);
    };
  }, hostSide);
  await fixture(host, 'Platforms'); await guest.waitForTimeout(700);
  for (const p of [host, guest]) await resetMetrics(p);
  await guest.keyboard.down('d'); await host.waitForFunction(() => qa.room.getInputs(performance.now(), false)[1]?.right);
  await guest.keyboard.up('d'); await host.waitForFunction(() => !qa.room.getInputs(performance.now(), false)[1]?.right);
  await guest.waitForTimeout(4500);
  await measure(host, '10% packet loss / delay / duplicates / reordering', 'host');
  await measure(guest, '10% packet loss / delay / duplicates / reordering', 'guest');
  assert.ok(reports.at(-1).updates > 35); assert.ok(reports.at(-1).gapMax < 600);
  await guest.evaluate(() => { const end = performance.now() + 1200; while (performance.now() < end) {} });
  await guest.waitForTimeout(1000);
  const hostTime = await host.evaluate(() => qa.world.time), guestTime = await guest.evaluate(() => qa.room.emittedState.time);
  assert.ok(Math.abs(hostTime - guestTime) < .4, `stall recovery ${hostTime - guestTime}`);
  const session = await guest.context().newCDPSession(guest); await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await session.send('Profiler.enable'); await session.send('Profiler.start');
  await resetMetrics(guest); await guest.waitForTimeout(3000); await measure(guest, 'impaired connection / 4x CPU throttle', 'guest');
  const profile = await session.send('Profiler.stop');
  await fs.writeFile(path.join(results, label + '.cpuprofile'), JSON.stringify(profile.profile));
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // A round reset clears old destruction on established and joining clients.
  const round = await host.evaluate(() => { qa.world.round++; qa.world.startRound(); return qa.world.round; });
  await late.waitForFunction(round => qa.room.emittedState?.round === round && qa.room.worldState.wreckage.length === 0, round);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(results, label + '.json'), JSON.stringify({ reports, errors, hotJoin: true, reset: true, stallRecoverySeconds: hostTime - guestTime,
    scope: 'Four isolated contexts on one machine over real TURN. Injected impairments affect the tested host/guest link. Source-only hooks; not cross-ISP or Steam proof.' }, null, 2));
} finally { await browser.close(); await server.close(); }
