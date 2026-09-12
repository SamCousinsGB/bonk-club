import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyReleaseMetadata(web, windows, linux, revision) {
  assert.match(revision, /^[a-f0-9]{40}$/, 'Expected release revision');
  assert.equal(web.target, 'browser');
  assert.equal(windows.transport, 'steam'); assert.equal(windows.platform, 'win32');
  assert.equal(linux.transport, 'steam'); assert.equal(linux.platform, 'linux');
  assert.equal(windows.arch, 'x64'); assert.equal(linux.arch, 'x64');
  assert.equal(windows.steamAppId, linux.steamAppId, 'Steam App IDs differ');
  assert.match(web.version, /^\d+\.\d+\.\d+$/);
  assert.match(web.gameSourceHash, /^[a-f0-9]{64}$/);
  for (const record of [web, windows, linux]) {
    assert.equal(record.dirty, false, 'Release contains uncommitted inputs');
    assert.equal(record.revision, revision, 'Release revision differs');
    assert.equal(record.version, web.version, 'Release versions differ');
    assert.equal(record.gameSourceHash, web.gameSourceHash, 'Shared game source differs');
  }
  return { version: web.version, revision, gameSourceHash: web.gameSourceHash };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = path.resolve(process.argv[2]);
  const read = async (target, filename) => JSON.parse(await fs.readFile(path.join(directory, 'release-metadata-' + target, filename), 'utf8'));
  const result = verifyReleaseMetadata(await read('browser', 'build-metadata.json'), await read('win32', 'build-manifest.json'),
    await read('linux', 'build-manifest.json'), process.argv[3]);
  console.log(`Verified browser, Windows and Linux: v${result.version}, ${result.revision}, ${result.gameSourceHash}`);
}
