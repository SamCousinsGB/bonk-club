import test from 'node:test';
import assert from 'node:assert/strict';
import { fighterStatuses, statusMarkup } from '../src/status-effects.js';
import { World, STEP } from '../src/engine.js';
import { encodeState, decodeState, validSnapshot } from '../src/network.js';
import { blackholeField } from '../src/blackhole.js';
import { captureFighter, moveCaptured } from '../src/singularity-body.js';

const player = extra => ({ id: 0, alive: true, x: 100, y: 100, ...extra });
const state = extra => ({ phase: 'fight', spills: [], water: [], ...extra });
const spill = kind => ({ kind, x: 80, y: 120, w: 40, h: 8, life: 5, grounded: true });

test('Spaghetti-fied is untimed and requires capture by the active black hole', () => {
  const hole = { kind: 'blackhole', riftId: 1, life: 5, x: 100, y: 100 };
  const s = state({ fields: [hole] }), p = player({ capturedBy: 1 });
  assert.deepEqual(fighterStatuses(s, p), [{ id: 'spaghetti', label: 'Spaghetti-fied', seconds: null }]);
  for (const other of [player(), player({ capturedBy: 2 }), player({ capturedBy: 1, alive: false })])
    assert.deepEqual(fighterStatuses(s, other), []);
  hole.life = 0;
  assert.deepEqual(fighterStatuses(s, p), []);
  hole.life = 5; hole.kind = 'shockwave';
  assert.deepEqual(fighterStatuses(s, p), []);
});

test('real captured fighters retain the indicator over transport and clear it on release/reset', async () => {
  const w = new World({ players: [0, 1], shuffle: false });
  w.phase = 'fight';
  const p = w.players[0], f = blackholeField(w, { x: p.x + 100, y: p.y, owner: 1 });
  w.fields.push(f); captureFighter(p, f);
  const s = w.snapshot(), remote = await decodeState(await encodeState(s));
  assert.ok(validSnapshot(remote));
  assert.equal(fighterStatuses(remote, remote.players[0])[0].label, 'Spaghetti-fied');
  assert.deepEqual(fighterStatuses(remote, remote.players[0]), fighterStatuses(s, s.players[0]));
  w.fields = []; moveCaptured(p, w, [], STEP);
  assert.deepEqual(fighterStatuses(w.snapshot(), p), []);
  w.fields.push(f); captureFighter(p, f); w.startRound();
  assert.deepEqual(fighterStatuses(w.snapshot(), w.players[0]), []);
});

test('frozen takes precedence over chilled; timers preserve fractional remaining time', () => {
  const p = player({ freeze: .62, chill: 2 });
  assert.deepEqual(fighterStatuses(state(), p), [{ id: 'frozen', label: 'Frozen', seconds: .62 }]);
  assert.match(statusMarkup(fighterStatuses(state(), p)), /0.7s/);
  p.freeze = 0;
  assert.equal(fighterStatuses(state(), p)[0].id, 'chilled');
});
test('glue is untimed and flammable counts down only after leaving an active oil or tar source', () => {
  for (const kind of ['oil', 'tar']) {
    const p = player({ glued: .55, [kind === 'oil' ? 'oiled' : 'tarred']: .3 });
    const s = state({ spills: [spill(kind)] });
    assert.deepEqual(fighterStatuses(s, p).map(e => e.seconds), [null, null]);
    p.x = 200;
    assert.deepEqual(fighterStatuses(s, p).map(e => e.seconds), [null, .3]);
    s.spills[0].life = 0; p.x = 100;
    assert.equal(fighterStatuses(s, p)[1].seconds, .3);
  }
});
test('wet and burning timers hide while their source refreshes; air includes drowning at zero', () => {
  const p = player({ soaked: 2.5, oxygen: 4.2, submerged: true });
  let effects = fighterStatuses(state({ water: [spill('water')] }), p);
  assert.deepEqual(effects.map(e => e.seconds), [null, 4.2]);
  p.oxygen = 0;
  assert.equal(fighterStatuses(state(), p).at(-1).label, 'Drowning');
  assert.equal(fighterStatuses(state(), p)[0].seconds, 2.5);
  assert.equal(fighterStatuses(state({ spills: [{ ...spill('oil'), fire: 2 }] }), player({ burn: 3 }))[0].seconds, null);
});
test('effects clear for dead fighters, bots, absent local players and between rounds', () => {
  for (const p of [undefined, player({ alive: false, freeze: 1 }), player({ bot: true, freeze: 1 })])
    assert.deepEqual(fighterStatuses(state(), p), []);
  for (const phase of ['countdown', 'result']) assert.deepEqual(fighterStatuses(state({ phase }), player({ burn: 3 })), []);
});
test('bubble and each transformation expose actual expiry, without generic hit-stun flicker', () => {
  for (const morph of ['jelly', 'gold', 'tangle']) {
    const effects = fighterStatuses(state(), player({ bubble: 2.4, morph, morphTime: 1.2, stun: .1 }));
    assert.deepEqual(effects.map(e => e.id), ['bubble', morph]);
    assert.deepEqual(effects.map(e => e.seconds), [2.4, 1.2]);
  }
});
test('host, transported guest state and round reset agree on status effects', async () => {
  const w = new World({ players: [0, 1], shuffle: false });
  w.phase = 'fight';
  Object.assign(w.players[0], { freeze: 1.1, chill: 2, glued: .4, oiled: .3, bubble: 2 });
  const s = w.snapshot(), remote = await decodeState(await encodeState(s));
  assert.ok(validSnapshot(remote));
  assert.deepEqual(fighterStatuses(remote, remote.players[0]), fighterStatuses(s, s.players[0]));
  w.step(STEP, {});
  assert.ok(w.players[0].freeze < 1.1);
  w.startRound();
  assert.deepEqual(fighterStatuses(w.snapshot(), w.players[0]), []);
});
