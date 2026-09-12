import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { network, createRoom, validCode } from '../src/platform/steam.js';

test('Steam builds cannot fall back to WebRTC or accept browser invites before integration', () => {
  assert.equal(network.transport, 'steam');
  assert.equal(network.available, false);
  assert.equal(validCode('ABC234'), false);
  assert.throws(() => createRoom(), { code: 'steam-not-configured' });
});

test('both targets use identical game inputs while the Steam bundle excludes browser networking', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const compile = async mode => (await build({ root, mode, base: './', logLevel: 'silent', build: { write: false } })).output;
  const web = await compile('production'), steam = await compile('desktop');
  const modules = result => result.filter(f => f.type === 'chunk').flatMap(f => f.moduleIds).map(id => id.replaceAll('\\', '/'));
  assert.ok(modules(web).some(id => id.endsWith('/src/network.js')));
  assert.ok(modules(web).some(id => id.includes('/node_modules/peerjs/')));
  for (const id of modules(steam)) assert.doesNotMatch(id, /\/src\/(network|ice|room-service|connection-diagnostics)\.js$|\/node_modules\/peerjs\//, id);
  assert.ok(modules(steam).some(id => id.endsWith('/src/engine.js')));
  const metadata = result => JSON.parse(result.find(f => f.fileName === 'build-metadata.json').source);
  const w = metadata(web), s = metadata(steam);
  assert.equal(w.target, 'browser'); assert.equal(s.target, 'steam');
  assert.match(w.gameSourceHash, /^[a-f0-9]{64}$/);
  assert.equal(w.gameSourceHash, s.gameSourceHash);
  assert.equal(w.version, s.version); assert.equal(w.revision, s.revision);
});
