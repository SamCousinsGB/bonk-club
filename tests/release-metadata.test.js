import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReleaseMetadata } from '../scripts/verify-release.mjs';

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
