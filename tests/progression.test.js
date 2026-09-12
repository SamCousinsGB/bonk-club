import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPreferences } from '../src/preferences-data.js';
import { cleanProfile } from '../src/identity.js';
import { createProgressionClient } from '../src/progression.js';

test('local preferences and room appearance cannot contain account identity or earned progression', () => {
  const forged = { steamId: '76561198000000000', account: 'another-user', xp: 100000, level: 100,
    unlocks: ['everything'], inventory: ['paid-item'], entitlements: ['paid-item'], verified: true };
  const prefs = cleanPreferences({ ...forged, profile: { name: 'Player', ...forged } });
  assert.equal(prefs.profile.name, 'Player');
  for (const key of Object.keys(forged)) {
    assert.equal(Object.hasOwn(prefs, key), false, key);
    assert.equal(Object.hasOwn(prefs.profile, key), false, key);
    assert.equal(Object.hasOwn(cleanProfile(forged), key), false, key);
  }
});

test('unconfigured progression is unavailable, never a writable local fallback', async () => {
  const client = createProgressionClient();
  assert.deepEqual(await client.read(), { status: 'unavailable', account: null, progression: null });
  await assert.rejects(client.requestEquip('hat_one'), /unavailable/);
  assert.deepEqual(Object.keys(client).sort(), ['read', 'requestEquip']);
  assert.equal(Object.isFrozen(client), true);
});

test('cosmetic requests carry only a bounded selection, never claimed rewards or another account', async () => {
  const calls = [], service = { async read() { return { status: 'unavailable' }; },
    async requestEquip(...args) { calls.push(args); return { equipped: false }; } };
  const client = createProgressionClient(service);
  for (const value of [{ cosmetic: 'hat', xp: 9000 }, '', '../admin', 'x'.repeat(65), null])
    await assert.rejects(client.requestEquip(value), /Invalid cosmetic/);
  assert.equal(calls.length, 0);
  await client.requestEquip('hat_one', { account: 'another-user', owned: true });
  assert.deepEqual(calls, [['hat_one']]);
});
