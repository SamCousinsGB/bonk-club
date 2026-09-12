import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await fs.readFile(path.join(desktop, '../package.json'), 'utf8'));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'bonk-desktop-smoke-'));
const results = path.join(desktop, 'test-results');
await fs.mkdir(results, { recursive: true });
let app;
const errors = [];
async function launch() {
  app = await electron.launch({ args: [desktop, '--profile-dir=' + profile], timeout: 30000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(expected => document.querySelector('#release-version')?.textContent === expected, `v${version}`);
  return page;
}
try {
  let page = await launch();
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  assert.equal(await page.evaluate(() => isSecureContext), true);
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(prefs.sandbox, true); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false); assert.equal(prefs.webSecurity, true);
  const status = await page.evaluate(() => window.bonkDesktop.platformStatus());
  assert.equal(status.platform, 'steam'); assert.equal(status.network.available, false);
  assert.equal(status.account.subject, null); assert.equal(status.progression.authority, null);
  const remoteRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.origin !== 'https://samcousinsgb.github.io') remoteRequests.push(url.origin);
  });
  await page.locator('#online').click();
  await page.getByText('Steam online play is not configured in this build. Single player is available.').waitFor();
  assert.equal(await page.locator('#room-code').count(), 0);
  await page.screenshot({ path: path.join(results, 'steam-unavailable.png') });
  await page.locator('#back').click();
  assert.deepEqual(remoteRequests, [], 'Steam setup cannot trigger a browser signalling or relay request');
  await page.screenshot({ path: path.join(results, 'menu.png') });
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.querySelector('#fullscreen').getAttribute('aria-pressed') === 'true');
  // Native window accelerators live above Chromium's CDP keyboard injection.
  await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    contents.sendInputEvent({ type: 'keyDown', keyCode: 'F11' });
    contents.sendInputEvent({ type: 'keyUp', keyCode: 'F11' });
  });
  await page.waitForFunction(() => document.querySelector('#fullscreen').getAttribute('aria-pressed') === 'false');
  // Preserve settings through an actual process exit and relaunch.
  await page.locator('#character').click();
  let name = page.locator('#panel input:not([readonly])').first();
  await name.fill('Desktop Tester'); await name.dispatchEvent('input'); await name.dispatchEvent('change');
  await page.locator('#back').click();
  await page.locator('#arenas').click();
  await page.locator('#difficulty').selectOption('normal');
  await page.locator('#settings-sound').selectOption('off');
  await page.locator('#arena-close').click();
  await page.locator('#solo').click();
  await page.locator('body.playing').waitFor();
  await page.waitForFunction(() => document.querySelector('#scoreboard').textContent.includes('Desktop Tester'));
  await page.screenshot({ path: path.join(results, 'solo.png') });
  await page.keyboard.press('Escape'); await page.locator('#leave').click();
  // The app cannot open popups, navigate away or read arbitrary files.
  await page.evaluate(() => window.open('https://example.com'));
  assert.equal(app.windows().length, 1);
  assert.equal(await page.evaluate(async () => (await fetch('/bonk-club/assets/%2e%2e%2fpackage.json')).status), 403);
  await app.close(); app = null;
  const saved = JSON.parse(await fs.readFile(path.join(profile, 'saves/preferences.json'), 'utf8'));
  assert.equal(saved.profile.name, 'Desktop Tester'); assert.equal(saved.muted, true); assert.equal(saved.difficulty, 'normal');
  // A corrupt machine-specific window preference must not break game startup.
  await fs.writeFile(path.join(profile, 'window.json'), 'null');
  page = await launch();
  name = page.locator('#panel input:not([readonly])').first();
  assert.equal(await page.locator('#sound').getAttribute('aria-label'), 'Unmute sound');
  // Test the exact bundled controller poll path; gamepad values are supplied by
  // this external harness, never by a shipped debug hook. Physical Deck QA remains.
  await page.evaluate(() => {
    window.qaPad = { buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0] };
    navigator.getGamepads = () => [window.qaPad];
    document.querySelector('#solo').focus();
  });
  async function press(n) {
    await page.evaluate(n => window.qaPad.buttons[n].pressed = true, n);
    await page.waitForTimeout(130);
    await page.evaluate(n => window.qaPad.buttons[n].pressed = false, n);
    await page.waitForTimeout(130);
  }
  await press(13); await press(13);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'character');
  await press(0);
  await name.waitFor();
  await name.focus(); await press(0);
  await page.locator('#controller-keyboard').waitFor();
  await page.screenshot({ path: path.join(results, 'keyboard.png') });
  await press(1); await press(1);
  await page.locator('#solo').focus(); await press(0);
  await page.locator('body.playing').waitFor(); await press(9);
  await page.locator('#resume').waitFor(); await press(9);
  assert.equal(await page.locator('#panel').isVisible(), false);
  // Disconnect all network access: bundled assets and solo still start.
  await page.context().setOffline(true); await page.reload();
  await page.locator('#solo').click(); await page.locator('body.playing').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.score').length === 4);
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  await fs.writeFile(path.join(results, 'smoke.json'), JSON.stringify({ ok: true, platform: process.platform, steamSetupGate: true, browserNetworkRequests: 0,
    offlineSolo: true, saveRestart: true, controllerMenus: 'emulated standard gamepad', errors }, null, 2));
  console.log('Desktop smoke passed: isolation, bundled offline solo, save/relaunch, controller menus and on-screen keyboard.');
} finally {
  if (app) await app.close();
  await fs.rm(profile, { recursive: true, force: true });
}
