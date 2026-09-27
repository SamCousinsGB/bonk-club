import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReleaseMetadata } from '../scripts/verify-release.mjs';
import { gameFingerprint } from '../scripts/release-metadata.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('game fingerprints preserve binary artwork bytes while normalizing text line endings', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'bonk-fingerprint-'));
  try {
    await fs.mkdir(path.join(root,'src/assets'),{recursive:true});
    await fs.mkdir(path.join(root,'scripts'));
    for(const name of ['index.html','favicon.svg','package.json','package-lock.json','vite.config.js','scripts/release-metadata.mjs'])
      await fs.writeFile(path.join(root,name),'source\r\n');
    const asset=path.join(root,'src/assets/art.webp');
    await fs.writeFile(asset,Buffer.from([0x80,0x0d,0x0a]));
    const a=await gameFingerprint(root);
    await fs.writeFile(path.join(root,'index.html'),'source\n');
    assert.equal(await gameFingerprint(root),a);
    // Both invalid UTF-8 bytes would collapse to the same replacement character.
    await fs.writeFile(asset,Buffer.from([0x81,0x0d,0x0a]));
    assert.notEqual(await gameFingerprint(root),a);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('publication requires clean browser, Windows and Linux outputs of one game revision', () => {
  const common = { version: '0.19.0', revision: 'a'.repeat(40), gameSourceHash: 'b'.repeat(64), dirty: false };
  const web = { ...common, target: 'browser' };
  const windows = { ...common, transport: 'steam', platform: 'win32', arch: 'x64', steamAppId: null };
  const linux = { ...windows, platform: 'linux' };
  assert.equal(verifyReleaseMetadata(web, windows, linux, common.revision).gameSourceHash, common.gameSourceHash);
  for (const patch of [{ revision: 'c'.repeat(40) }, { dirty: true }, { version: '0.18.1' },
    { gameSourceHash: 'd'.repeat(64) }, { transport: 'webrtc' }, { platform: 'win32' }, { steamAppId: 123456 }])
    assert.throws(() => verifyReleaseMetadata(web, windows, { ...linux, ...patch }, common.revision));
  assert.throws(() => verifyReleaseMetadata(web, windows, linux, 'e'.repeat(40)));
});
