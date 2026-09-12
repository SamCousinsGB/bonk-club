import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const script = fileURLToPath(new URL('../../scripts/prepare-steam.mjs', import.meta.url));
test('SteamPipe preparation fails without real IDs', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /No Steamworks IDs/);
});
test('SteamPipe verifies both depots, defaults to preview and rejects tampering or mismatched builds', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonk-depot-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const args = [script, '--app-id=123456', '--windows-depot=123457', '--linux-depot=123458', '--content=' + temp, '--output=' + path.join(temp, 'vdf')];
  for (const platform of ['win32', 'linux']) {
    const dir = path.join(temp, `BonkClub-${platform}-x64`); fs.mkdirSync(path.join(dir, 'resources'), { recursive: true });
    const hashes = {};
    for (const file of [platform === 'win32' ? 'BonkClub.exe' : 'BonkClub', 'resources/app.asar']) {
      fs.writeFileSync(path.join(dir, file), 'test fixture');
      hashes[file] = createHash('sha256').update('test fixture').digest('hex');
    }
    fs.writeFileSync(path.join(dir, 'build-manifest.json'), JSON.stringify({ platform, arch: 'x64', dirty: false, version: '0.9.0', revision: 'a'.repeat(40),
      transport: 'steam', steamAppId: 123456, gameSourceHash: 'c'.repeat(64), hashes }));
  }
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(run().status, 0);
  const vdf = fs.readFileSync(path.join(temp, 'vdf/app_123456.vdf'), 'utf8');
  assert.match(vdf, /"Preview" "1"/); assert.doesNotMatch(vdf, /SetLive|password|login/);
  const linux = path.join(temp, 'BonkClub-linux-x64');
  fs.writeFileSync(path.join(linux, 'steam_appid.txt'), '480');
  assert.match(run().stderr, /Excluded file/); fs.unlinkSync(path.join(linux, 'steam_appid.txt'));
  const manifestFile = path.join(linux, 'build-manifest.json');
  const m = JSON.parse(fs.readFileSync(manifestFile));
  m.steamAppId = 123450; fs.writeFileSync(manifestFile, JSON.stringify(m));
  assert.match(run().stderr, /STEAM_APP_ID matching/);
  m.steamAppId = 123456; m.gameSourceHash = 'd'.repeat(64); fs.writeFileSync(manifestFile, JSON.stringify(m));
  assert.match(run().stderr, /same shared game source/);
  m.gameSourceHash = 'c'.repeat(64); m.revision = 'b'.repeat(40); fs.writeFileSync(manifestFile, JSON.stringify(m));
  assert.match(run().stderr, /same version and source revision/);
  fs.writeFileSync(path.join(linux, 'resources/app.asar'), 'modified');
  assert.match(run().stderr, /Modified\/untracked depot file/);
});
