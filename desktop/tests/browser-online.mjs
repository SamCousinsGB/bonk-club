// Opt-in real browser/WebRTC test. Uses the production bundle at its publisher
// origin and real signalling/TURN. --public tests the published assets instead.
// No Steam connectivity or cross-ISP claim is made by this one-machine test.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = 'https://samcousinsgb.github.io/bonk-club/';
const published = process.argv.includes('--public');
const results = path.join(root, 'desktop/test-results');
await fs.mkdir(results, { recursive: true });
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
const errors = [], pages = [];
function trackRelay() {
  const RTC = window.RTCPeerConnection; window.qaConnections = [];
  window.RTCPeerConnection = class extends RTC {
    constructor(config, constraints) {
      super({ ...config, iceTransportPolicy: 'relay' }, constraints);
      window.qaConnections.push(this);
    }
  };
}
async function page() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(trackRelay);
  if (!published) await context.route(base + '**', async route => {
    const pathname = new URL(route.request().url()).pathname.slice('/bonk-club/'.length) || 'index.html';
    if (!/^(index\.html|build-metadata\.json|assets\/[a-zA-Z0-9_.-]+)$/.test(pathname)) return route.abort();
    const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2' }[path.extname(pathname)];
    await route.fulfill({ body: await fs.readFile(path.join(root, 'dist', pathname)), contentType });
  });
  const p = await context.newPage(); p.on('pageerror', error => errors.push(error.message)); pages.push(p); return p;
}
async function routes(p) {
  return p.evaluate(async () => {
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
  const host = await page(); await host.goto(base);
  await host.waitForFunction(expected => document.querySelector('#release-version')?.textContent === expected, `v${version}`);
  await host.locator('#solo').click(); await host.locator('body.playing').waitFor();
  await host.keyboard.press('Escape'); await host.locator('#leave').click();
  await host.locator('#online').click();
  await host.locator('#room-code').waitFor({ timeout: 45000 });
  const code = await host.locator('#room-code').inputValue();
  const guest = await page(); await guest.goto(base + '?room=' + code);
  await guest.locator('#join-invite').click();
  await guest.locator('#room-code').waitFor({ timeout: 45000 });
  await host.waitForFunction(() => document.querySelector('#lobby-count')?.textContent.startsWith('2/'));
  await host.locator('#start-match').click();
  await guest.locator('body.playing').waitFor({ timeout: 30000 });
  await guest.waitForFunction(() => document.querySelectorAll('.score').length === 4);
  await guest.keyboard.down('KeyD'); await guest.waitForTimeout(400); await guest.keyboard.up('KeyD');
  await guest.keyboard.press('Space');
  await guest.mouse.move(640, 320); await guest.mouse.down(); await guest.waitForTimeout(500); await guest.mouse.up();
  const late = await page(); await late.goto(base + '?room=' + code); await late.locator('#join-invite').click();
  await late.locator('body.playing').waitFor({ timeout: 45000 });
  await late.waitForFunction(() => document.querySelectorAll('.score').length === 4);
  const selected = { host: await routes(host), guest: await routes(guest), hotJoin: await routes(late) };
  for (const pairs of Object.values(selected)) assert.ok(pairs.some(p => p.local === 'relay' && p.remote === 'relay'));
  await host.screenshot({ path: path.join(results, 'browser-host.png') });
  await guest.screenshot({ path: path.join(results, 'browser-guest.png') });
  await late.keyboard.press('Escape'); await late.locator('#leave').click();
  await host.keyboard.press('Escape'); await host.locator('#leave').click();
  await guest.waitForFunction(() => !document.body.classList.contains('playing'));
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(results, 'browser-online.json'), JSON.stringify({ ok: true, published, selected, hotJoin: true, errors,
    scope: 'Three separate browser contexts on one QA machine using real public TURN; not cross-ISP or Steam validation.' }, null, 2));
  console.log('Browser host, guest controls, hot join and host departure passed with selected relay routes.');
} finally {
  await browser.close();
}
