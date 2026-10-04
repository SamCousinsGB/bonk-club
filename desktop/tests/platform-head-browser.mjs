// Opt-in desktop source regression over real TURN, with test-only fixtures.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from '../../node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('../test-results/head-stretch/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5399, strictPort: true, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const base = 'https://samcousinsgb.github.io/bonk-club/', errors = [], report = [], pages = [];
async function page() {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 },
    recordVideo: { dir: fileURLToPath(output), size: { width: 1600, height: 900 } } });
  await context.route('https://samcousinsgb.github.io/**', async route => {
    const u = new URL(route.request().url()), pathname = u.pathname.replace(/^\/bonk-club\//, '/');
    const response = await route.fetch({ url: 'http://127.0.0.1:5399' + pathname + u.search });
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
  await p.evaluate(async () => {
    const url = name => performance.getEntriesByType('resource').find(e => e.name.includes('/src/' + name + '.js')).name;
    const { World } = await import(url('engine')), { Renderer } = await import(url('renderer'));
    const { GuestPrediction } = await import(url('guest-prediction')), { JOINTS } = await import(url('puppet'));
    const step = World.prototype.step, draw = Renderer.prototype.draw, receive = GuestPrediction.prototype.receive;
    const observe = (player, source) => {
      if (!qa.measure || !player?.rig || player.id !== qa.measure.id) return;
      const m = qa.measure;
      for (const [a, b, length] of JOINTS) m.maxStretch = Math.max(m.maxStretch,
        Math.hypot(player.rig[a].x - player.rig[b].x, player.rig[a].y - player.rig[b].y) - length);
      m.headCleared ||= player.rig[0].y + 10 < m.ceiling;
      if (!m.oneWay) {
        m.minHead = Math.min(m.minHead, player.rig[0].y - 10);
        if (source !== 'render') m.minPhysicalHead = Math.min(m.minPhysicalHead, player.rig[0].y - 10);
      }
      m.sources[source] = (m.sources[source] || 0) + 1;
    };
    World.prototype.step = function (...args) { qa.world = this; const result = step.apply(this, args);
      for (const p of this.players) observe(p, 'host'); return result; };
    Renderer.prototype.draw = function (state, ...args) { qa.rendered = state;
      observe(qa.prediction?.player, 'prediction');
      for (const p of state?.players || []) observe(p, 'render'); return draw.call(this, state, ...args); };
    GuestPrediction.prototype.receive = function (...args) { qa.prediction = this; return receive.apply(this, args); };
  });
}
async function fixture(host, guest, oneWay, id) {
  const ceiling = oneWay ? 620 : 680;
  await guest.evaluate(() => { qa.measure = null; });
  const round = await host.evaluate(({ oneWay, ceiling }) => {
    qa.measure = null;
    const w = qa.world; w.round++; w.startRound(); w.phase = 'fight';
    w.cover = []; w.hazards = []; w.drops = []; w.weaponTimer = w.grenadeTimer = 999;
    w.platforms = [{ id: 'qa-floor', x: 250, y: 800, w: 2000, h: 30 },
      { id: 'qa-ceiling', x: 500, y: ceiling, w: 1450, h: 16, oneWay, material: 'metal' }]
      .map(s => ({ ...s, baseX: s.x, baseY: s.y, dx: 0, dy: 0 }));
    for (const p of w.players) Object.assign(p, { x: 1000 + p.id * 450, y: 770, vx: 0, vy: 0,
      ground: true, support: 'qa-floor', rig: null });
    return w.round;
  }, { oneWay, ceiling });
  await guest.waitForFunction(round => qa.rendered?.round === round &&
    qa.rendered.platforms.some(s => s.id === 'qa-ceiling') &&
    qa.rendered.players.every(p => Math.abs(p.y - 770) < .1 && p.rig?.[0].y > 700), round);
  await host.waitForTimeout(400);
  for (const p of [host, guest]) await p.evaluate(({ oneWay, ceiling, id }) => {
    qa.measure = { oneWay, ceiling, id, maxStretch: 0, minHead: 9999, minPhysicalHead: 9999, headCleared: false, sources: {} };
  }, { oneWay, ceiling, id });
}
try {
  const host = await page(); await host.goto(base); await hook(host); await host.locator('#play').click();
  await host.locator('#room-code').waitFor({ timeout: 45000 });
  for (const id of [1, 2, 3]) await host.locator(`[data-slot="${id}"]`).selectOption('player');
  await host.locator('#choose-maps').click(); await host.locator('#select-none').click();
  await host.getByRole('checkbox', { name: 'BULLET TRAIN', exact: true }).check(); await host.locator('#selection-done').click();
  const code = await host.locator('#room-code').inputValue();
  const guest = await page(); await guest.goto(base + '?room=' + code); await hook(guest); await guest.locator('#join-invite').click();
  await guest.locator('#room-code').waitFor({ timeout: 45000 }); await guest.locator('#ready-up').click();
  await host.waitForFunction(() => !document.querySelector('#start-match').disabled); await host.locator('#start-match').click();
  await guest.waitForFunction(() => qa.rendered?.phase === 'fight');
  for (const oneWay of [false, true]) for (const id of [0, 1]) {
    await fixture(host, guest, oneWay, id);
    const actor = id ? guest : host, name = `${oneWay ? 'slatted' : 'solid'}-${id ? 'guest' : 'host'}`;
    await actor.keyboard.press('Space', { delay: 80 }); await actor.waitForTimeout(oneWay ? 220 : 40);
    await actor.screenshot({ path: fileURLToPath(new URL(name + '.png', output)) });
    await actor.waitForTimeout(900);
    for (const [p, source] of [[host, 'host'], [guest, 'guest']]) {
      const result = await p.evaluate(() => qa.measure);
      assert.ok(result.maxStretch < 8, `${name} ${source}: stretched by ${result.maxStretch}`);
      assert.equal(result.headCleared, oneWay, `${name} ${source}: correct side of platform`);
      if (!oneWay) {
        assert.ok(result.minPhysicalHead >= result.ceiling + 16 - .1, `${name} ${source}: physical ceiling contact`);
        // Reconciliation eases the entire rendered fighter by a few units.
        // It must never put the head above the platform or stretch any joint.
        assert.ok(result.minHead >= result.ceiling, `${name} ${source}: rendered head stays beneath platform`);
      }
      report.push({ name, source, ...result });
    }
  }
  for (const p of [host, guest]) {
    assert.ok(await p.evaluate(async () => {
      for (const pc of qaConnections) { const stats = await pc.getStats();
        for (const s of stats.values()) if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated &&
          stats.get(s.localCandidateId)?.candidateType === 'relay' && stats.get(s.remoteCandidateId)?.candidateType === 'relay') return true;
      } return false;
    }));
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(new URL('source-browser.json', output), JSON.stringify({ ok: true, report, errors }, null, 2));
  console.log('Desktop host/guest ceiling jumps pass over real relay routes with connected physical and rendered rigs.');
} catch (error) {
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: fileURLToPath(new URL(`failure-${i}.png`, output)) });
    console.log(await p.evaluate(() => ({ text: document.body.innerText.slice(-1200),
      world: qa.world?.phase, rendered: qa.rendered?.phase, players: qa.rendered?.players?.length })));
  }
  console.log({ errors }); throw error;
} finally { for (const p of pages) await p.context().close(); await browser.close(); await server.close(); }
