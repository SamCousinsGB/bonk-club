import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { steamAppId, platformStatus } = createRequire(import.meta.url)('../platform.cjs');

test('a configured App ID cannot masquerade as verified Steam identity or networking', () => {
  assert.equal(steamAppId(undefined), null);
  assert.equal(steamAppId('123456'), 123456);
  for (const value of ['480', '0', '-1', '1e3', '123x', '999999999999', {}, true]) assert.throws(() => steamAppId(value));
  for (const config of [{}, { steamAppId: 123456, account: 'forged', xp: 9999, network: true }]) {
    const status = platformStatus(config);
    assert.equal(status.network.available, false);
    assert.deepEqual(status.account, { status: 'unavailable', subject: null });
    assert.deepEqual(status.progression, { status: 'unavailable', authority: null });
  }
});
