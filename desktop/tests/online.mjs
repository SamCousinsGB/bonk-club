// Opt-in check against the real public signalling/TURN services. It creates only
// temporary game rooms. No account credentials, room codes or IPs are logged.
import { _electron as electron, chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await fs.readFile(path.join(desktop, '../package.json'), 'utf8'));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'bonk-online-'));
const app = await electron.launch({ args: [desktop, '--profile-dir=' + profile] });
let browser;
const errors = [];
let host;
function trackRelay() {
  const RTC = window.RTCPeerConnection; window.qaConnections = [];
  window.RTCPeerConnection = class extends RTC {
    constructor(config, constraints) {
      super({ ...config, iceTransportPolicy: 'relay' }, constraints);
      window.qaConnections.push(this);
    }
  };
}
async function selected(page) {
  return page.evaluate(async () => {
    const pairs = [];
    for (const pc of window.qaConnections) {
      const stats = await pc.getStats();
      for (const s of stats.values()) if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated)
        pairs.push({ local: stats.get(s.localCandidateId)?.candidateType, remote: stats.get(s.remoteCandidateId)?.candidateType });
    }
    return pairs;
  });
}
try {
  host = await app.firstWindow(); host.on('pageerror', e => errors.push(e.message));
  await app.evaluate(({ net }) => {
    const original = net.fetch.bind(net); globalThis.qaRequests = [];
    net.fetch = async (request, options) => {
      const response = await original(request, options);
      globalThis.qaRequests.push({ origin: options.headers?.get('origin'), method: options.method, status: response.status });
      return response;
    };
  });
  host.on('console', message => { if (message.type() === 'error') console.log('Renderer:', message.text().replace(/https?:\/\/[^\s]+/g, '[URL]')); });
  await host.waitForFunction(expected => document.querySelector('#release-version')?.textContent === expected, `v${version}`);
  await host.addInitScript(trackRelay); await host.reload();
  await host.locator('#solo').waitFor();
  await host.locator('#online').click();
  await host.locator('#room-code').waitFor({ timeout: 45000 });
  const code = await host.locator('#room-code').inputValue();
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(trackRelay);
  const guest = await context.newPage(); guest.on('pageerror', e => errors.push(e.message));
  await guest.goto('https://samcousinsgb.github.io/bonk-club/?room=' + code);
  await guest.locator('#join-invite').click();
  await guest.locator('#room-code').waitFor({ timeout: 45000 });
  await host.waitForFunction(() => document.querySelector('#lobby-count')?.textContent.startsWith('2/'));
  await host.locator('#copy-link').click();
  await host.waitForFunction(() => document.querySelector('#toast').textContent.length > 0);
  assert.match(await host.locator('#toast').textContent(), /copied/);
  await host.locator('#start-match').click();
  await guest.locator('body.playing').waitFor({ timeout: 30000 });
  await guest.waitForFunction(() => document.querySelectorAll('.score').length === 4);
  const late = await context.newPage(); late.on('pageerror', e => errors.push(e.message));
  await late.goto('https://samcousinsgb.github.io/bonk-club/?room=' + code);
  await late.locator('#join-invite').click();
  await late.locator('body.playing').waitFor({ timeout: 45000 });
  await late.waitForFunction(() => document.querySelectorAll('.score').length === 4);
  await guest.mouse.move(640, 320); await guest.mouse.down(); await guest.waitForTimeout(600); await guest.mouse.up();
  await guest.keyboard.down('KeyD'); await guest.waitForTimeout(500); await guest.keyboard.up('KeyD');
  const routes = { host: await selected(host), guest: await selected(guest), hotJoin: await selected(late) };
  console.log('Selected candidate types:', JSON.stringify(routes));
  for (const pairs of Object.values(routes)) assert.ok(pairs.some(p => p.local === 'relay' && p.remote === 'relay'));
  await host.screenshot({ path: path.join(desktop, 'test-results/online-host.png') });
  await guest.screenshot({ path: path.join(desktop, 'test-results/online-guest.png') });
  await late.keyboard.press('Escape'); await late.locator('#leave').click();
  await host.keyboard.press('Escape'); await host.locator('#leave').click();
  await guest.waitForFunction(() => !document.body.classList.contains('playing'));
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(desktop, 'test-results/online.json'), JSON.stringify({ ok: true, routes, browserGuest: true, hotJoin: true, errors, scope: 'One QA machine, public TURN relay; not separate ISPs.' }, null, 2));
  console.log('Desktop host / browser guest / hot join passed through selected TURN relay candidates.');
} catch (error) {
  console.error('Online check failed:', error.message);
  if (host && !host.isClosed()) {
    try {
      console.log('Request diagnostics:', await app.evaluate(() => globalThis.qaRequests));
      console.log('Desktop panel:', await host.locator('#panel').innerText());
      await host.screenshot({ path: path.join(desktop, 'test-results/online-failure.png') });
    } catch { /* Keep the original failure if the app already exited. */ }
  }
  throw error;
} finally {
  if (browser) await browser.close(); await app.close().catch(() => {}); await fs.rm(profile, { recursive: true, force: true });
}
