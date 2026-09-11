import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PreferenceStore } from '../store.mjs';
const { assetPath, gameDocument, networkPolicy, GAME_URL } = createRequire(import.meta.url)('../policy.cjs');

test('bundled asset routing rejects traversal, remote origins and source access', () => {
  const root = path.resolve('dist-desktop');
  assert.equal(assetPath(GAME_URL, root), path.join(root, 'index.html'));
  assert.equal(assetPath(GAME_URL + 'assets/index-abc.js', root), path.join(root, 'assets/index-abc.js'));
  for (const url of [GAME_URL + '%2e%2e/package.json', GAME_URL + 'assets/%2e%2e%2fpackage.json', GAME_URL + 'assets/%5c..%5csecret', GAME_URL + 'assets/%00.js', GAME_URL + 'src/main.js', GAME_URL + 'assets/nested/x.js', 'file:///etc/passwd', 'https://evil.example/bonk-club/', 'https://samcousinsgb.github.io.evil.test/bonk-club/'])
    assert.equal(assetPath(url, root), null, url);
});
test('IPC document trust excludes bundled subresources and remote documents', () => {
  assert.equal(gameDocument(GAME_URL + '?room=ABC234'), true);
  assert.equal(gameDocument(GAME_URL + 'index.html'), true);
  for (const url of [GAME_URL + 'assets/evil.js', 'https://evil.test/', 'https://x@samcousinsgb.github.io/bonk-club/', 'about:blank']) assert.equal(gameDocument(url), false);
});
test('network endpoints are explicit HTTPS paths; no fallback to remote game code', () => {
  const policy = networkPolicy({ roomServiceUrl: 'https://service.example/peerjs', turnCredentialsUrl: 'https://service.example/ice' });
  for (const url of ['https://service.example/peerjs/id?ts=1', 'wss://service.example/peerjs/peerjs?key=x', 'https://service.example/ice']) assert.equal(policy.allowed(url), true, url);
  for (const url of ['http://service.example/ice', 'https://service.example/ice/private', 'https://service.example/peerjsevil/', 'https://evil.test/ice', GAME_URL, 'file:///etc/passwd']) assert.equal(policy.allowed(url), false, url);
  assert.match(policy.csp, /script-src 'self'/); assert.doesNotMatch(policy.csp, /unsafe-eval/);
  assert.throws(() => networkPolicy({ roomServiceUrl: 'https://user:secret@service.example/', turnCredentialsUrl: 'https://service.example/ice' }));
});
test('atomic settings survive restart and preserve corrupt input for recovery', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonk-save-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new PreferenceStore(dir);
  store.save({ profile: { name: 'Tester', hair: 'Bob' }, difficulty: 'normal', muted: true });
  assert.equal(new PreferenceStore(dir).value.profile.name, 'Tester');
  assert.equal(new PreferenceStore(dir).value.muted, true);
  assert.equal(fs.existsSync(store.file + '.tmp'), false);
  assert.throws(() => store.save({ name: 'x'.repeat(20000) }));
  assert.equal(new PreferenceStore(dir).value.profile.name, 'Tester');
  fs.writeFileSync(store.file, '{invalid');
  const recovered = new PreferenceStore(dir);
  assert.match(recovered.warning, /recovery/);
  const backup = fs.readdirSync(dir).find(n => n.includes('.recovery-'));
  assert.equal(fs.readFileSync(path.join(dir, backup), 'utf8'), '{invalid');
  recovered.save({ difficulty: 'hard' }); assert.equal(new PreferenceStore(dir).value.difficulty, 'hard');
});
