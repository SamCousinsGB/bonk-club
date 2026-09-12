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
  assert.deepEqual(await host.locator('.menu-buttons button').allTextContents(), ['PLAY ↗','CUSTOMISE']);
  await host.screenshot({ path: path.join(results, 'play-menu.png') });
  await host.locator('#play').click();
  const soloCode=await host.locator('#room-code').inputValue();
  assert.match(soloCode,/^[A-HJ-NP-Z2-9]{6}$/);
  for(const id of [1,2,3])await host.locator(`[data-slot="${id}"]`).selectOption('ai');
  assert.equal(await host.locator('#room-code').inputValue(),soloCode,'bots-only slots retain the invite code');
  assert.equal(await host.locator('#character-preview').count(),0,'host lobby has no embedded editor');
  await host.locator('#start-match').click(); await host.locator('body.playing').waitFor();
  await host.keyboard.press('Escape'); await host.locator('#leave').click();
  await host.locator('#play').click();
  await host.locator('#room-code').waitFor({ timeout: 45000 });
  const code = await host.locator('#room-code').inputValue();
  const guest = await page(); await guest.goto(base + '?room=' + code);
  await guest.locator('#join-invite').click();
  await guest.locator('#room-code').waitFor({ timeout: 45000 });
  await host.waitForFunction(() => document.querySelector('#lobby-count')?.textContent.startsWith('2 /'));
  assert.equal(await host.locator('#start-match').isDisabled(),true);
  assert.equal(await guest.locator('#difficulty').isDisabled(),true);
  await guest.locator('#lobby-customise').click();
  await guest.locator('#player-name').fill('Lobby Guest');
  await guest.locator('#character-close').click();
  await guest.locator('#ready-up').click();
  await host.waitForFunction(()=>!document.querySelector('#start-match').disabled);
  await host.locator('#choose-weapons').click();
  await host.locator('#select-none').click();
  assert.equal(await host.locator('#selection-done').isDisabled(),true);
  await host.getByRole('checkbox',{name:'BUBBLE GUN',exact:true}).check();
  await host.locator('#selection-done').click();
  await guest.waitForFunction(()=>document.querySelector('#ready-up').getAttribute('aria-pressed')==='false');
  assert.equal(await host.locator('#start-match').isDisabled(),true);
  await host.locator('#choose-maps').click();
  await host.locator('#select-none').click();
  await host.getByRole('checkbox',{name:'PLATFORMS',exact:true}).check();
  await host.getByRole('checkbox',{name:'ARC FURNACE',exact:true}).check();
  await host.screenshot({path:path.join(results,'play-maps.png')});
  await host.locator('#selection-done').click();
  await host.locator('#difficulty').selectOption('normal');
  await guest.waitForFunction(()=>document.querySelector('#difficulty').value==='normal' && document.querySelector('#map-count').textContent==='2 selected' && document.querySelector('#weapon-count').textContent==='1 selected');
  await host.screenshot({path:path.join(results,'play-host-lobby.png')});
  await guest.screenshot({path:path.join(results,'play-guest-lobby.png')});
  for(const [width,height] of [[390,844],[568,320]]) {
    await host.setViewportSize({width,height});
    assert.equal(await host.evaluate(()=>document.querySelector('#panel').scrollWidth<=document.querySelector('#panel').clientWidth+1),true,'lobby has no horizontal overflow');
    await host.screenshot({path:path.join(results,`play-lobby-${width}.png`)});
    await host.locator('#choose-maps').click();
    assert.equal(await host.evaluate(()=>document.querySelector('#panel').scrollWidth<=document.querySelector('#panel').clientWidth+1),true,'map selection has no horizontal overflow');
    await host.screenshot({path:path.join(results,`play-maps-${width}.png`)});
    await host.locator('#selection-done').click();
  }
  await host.setViewportSize({width:1280,height:800});
  await guest.locator('#ready-up').click();
  await host.locator('#start-match').click();
  await guest.locator('body.playing').waitFor({ timeout: 30000 });
  await guest.waitForFunction(() => document.querySelectorAll('.score').length === 4);
  assert.ok(['PLATFORMS','ARC FURNACE'].includes(await guest.locator('#arena-name').textContent()));
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
