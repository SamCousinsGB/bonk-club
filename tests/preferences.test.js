import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPreferences } from '../src/preferences.js';
import { cleanPreferences } from '../src/preferences-data.js';
import { ControllerEdges } from '../src/controller-menu.js';

test('preferences migrate the existing browser character and difficulty', async () => {
  const data = new Map([['bonk-profile', JSON.stringify({ name: 'Sam', color: '#ff7393', hair: 'Bob' })], ['bonk-difficulty', 'hard']]);
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const prefs = await loadPreferences({ storage });
  assert.equal(prefs.value.profile.name, 'Sam'); assert.equal(prefs.value.difficulty, 'hard');
  await prefs.save({ muted: true });
  const loaded = await loadPreferences({ storage });
  assert.equal(loaded.value.profile.color, '#ff7393'); assert.equal(loaded.value.muted, true);
});
test('invalid stored values do not create arbitrary character state', () => {
  const p = cleanPreferences({ profile: { name: '\u202etest\n', color: 'url(x)', hair: '../../' }, difficulty: '__proto__', arena: '-1', muted: 'true', command: 'bad' });
  assert.equal(p.profile.name, 'test'); assert.equal(p.profile.color, '#55baff');
  assert.equal(p.difficulty, 'easy'); assert.equal(p.arena, 'random'); assert.equal(p.muted, false);
  assert.equal(p.command, undefined);
});
test('desktop preference writes are ordered and recover after a failed write', async () => {
  const writes = [];
  const prefs = await loadPreferences({ desktop: {
    loadPreferences: async () => ({ value: { profile: { name: 'Desktop' } } }),
    savePreferences: async value => { writes.push(value); if (writes.length === 1) throw new Error('disk'); },
  } });
  const first = prefs.save({ muted: true }); const second = prefs.save({ difficulty: 'normal' });
  await assert.rejects(first); await second;
  assert.equal(writes[1].muted, true); assert.equal(writes[1].difficulty, 'normal');
  assert.equal(writes[1].profile.name, 'Desktop');
});
test('desktop load failure is visible and browser storage failures are recoverable', async () => {
  const prefs = await loadPreferences({ desktop: { loadPreferences: async () => { throw new Error('disk'); } } });
  assert.match(prefs.warning, /unavailable/);
  const browser = await loadPreferences({ storage: { getItem: () => { throw new Error('private'); }, setItem: () => { throw new Error('private'); } } });
  assert.equal(browser.value.difficulty, 'easy'); await assert.rejects(browser.save({ muted: true }));
});
const pad = (...pressed) => ({ buttons: Array.from({ length: 16 }, (_, n) => ({ pressed: pressed.includes(n) })), axes: [0, 0] });
test('controller accept and menu are edge-triggered, including after disconnect', () => {
  const edges = new ControllerEdges();
  assert.deepEqual(edges.poll(pad(0, 9), 0), ['accept', 'menu']);
  assert.deepEqual(edges.poll(pad(0, 9), 1000), []);
  assert.deepEqual(edges.poll(null, 1100), []);
  assert.deepEqual(edges.poll(pad(0), 1200), ['accept']);
});
test('controller direction repeats after delay, without repeating activation', () => {
  const edges = new ControllerEdges();
  assert.deepEqual(edges.poll(pad(13, 0), 0), ['accept', 'down']);
  assert.deepEqual(edges.poll(pad(13, 0), 399), []);
  assert.deepEqual(edges.poll(pad(13, 0), 400), ['down']);
  assert.deepEqual(edges.poll(pad(13, 0), 500), []);
  assert.deepEqual(edges.poll(pad(13, 0), 550), ['down']);
  assert.deepEqual(edges.poll(pad(12), 551), ['up']);
});
