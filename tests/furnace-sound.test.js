import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';
import { FURNACE_SOUNDS, synthesizeFurnace } from '../src/furnace-sound.js';
import { SOUND_RATE } from '../src/sound-design.js';
import { World, ARENAS } from '../src/engine.js';
import { updateFurnace } from '../src/furnace.js';
import { RenderSnapshots } from '../src/render-state.js';
import { validSnapshot } from '../src/network.js';
import { drawFurnaceFixture } from '../src/furnace-art.js';

function fixture() {
  const sound = new Sound(), played = [], stopped = [];
  sound.context = { state: 'running', currentTime: 20 };
  sound.master = { gain: { setTargetAtTime() {} } };
  sound.sample = (name, detail, options) => {
    const voice = { end: sound.context.currentTime + options.duration, stopped: false,
      source: { stop: () => stopped.push(name) }, gain: { gain: { cancelScheduledValues() {}, setTargetAtTime() {} } } };
    played.push({ name, ...options }); return voice;
  };
  const world = new World({ arena: ARENAS.findIndex(a => a.furnace), players: [0, 1], bots: [], shuffle: false });
  world.phase = 'fight'; const h = world.hazards.find(h => h.type === 'furnace');
  const seek = age => { const dt = age - h.age; updateFurnace(world, h, dt); world.time += dt; };
  return { sound, played, stopped, world, h, seek };
}

test('furnace recordings cover each physical phase with finite output, headroom and silent edges', () => {
  const energies = {};
  for (const [name, seconds] of Object.entries(FURNACE_SOUNDS)) {
    const pcm = synthesizeFurnace(name, SOUND_RATE);
    assert.equal(pcm.length, seconds * SOUND_RATE);
    assert.equal(Math.abs(pcm[0]), 0); assert.equal(Math.abs(pcm.at(-1)), 0);
    let sum = 0, peak = 0;
    for (const v of pcm) { assert.ok(Number.isFinite(v)); sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak < .73 && peak > .03, name);
    energies[name] = sum / pcm.length;
  }
  assert.ok(energies['furnace-arc'] > energies['furnace-charge'] * 3);
  assert.ok(energies['furnace-arc'] > energies['furnace-cool'] * 3);
});

test('actual furnace cycle schedules charge, sustained electricity and cooling once per phase on host and guest', () => {
  for (const guest of [false, true]) {
    const f = fixture(), wire = new RenderSnapshots();
    const update = () => { const s = f.world.snapshot(); assert.ok(validSnapshot(s)); f.sound.update(guest ? wire.make(s) : f.world); };
    f.seek(8.9); update(); assert.equal(f.played.length, 0);
    for (const age of [9, 9.25, 9.5, 10, 10.5, 11, 12, 13, 15, 16, 17, 18.4, 18.5]) {
      f.sound.context.currentTime = 20 + age; f.seek(age); update();
    }
    assert.deepEqual(f.played.map(p => p.name), ['furnace-charge', 'furnace-arc', 'furnace-cool']);
    assert.equal(f.sound.furnace.current, null);
  }
});

test('late joins seek into the active discharge; stale frames never replay its opening', () => {
  const f = fixture(); f.seek(13); f.sound.update(f.world);
  assert.equal(f.played[0].name, 'furnace-arc');
  assert.ok(Math.abs(f.played[0].offset - 2) < .00001);
  assert.ok(Math.abs(f.played[0].duration - 3) < .00001);
  f.sound.context.currentTime += 10;
  for (let i = 0; i < 30; i++) f.sound.update(f.world.snapshot());
  assert.equal(f.played.length, 1);
});

test('mute, result, round reset, destruction, map exit and suspended audio silence the furnace', () => {
  for (const end of ['mute', 'result', 'reset', 'destroyed', 'exit', 'suspended']) {
    const f = fixture(); f.seek(12); f.sound.update(f.world);
    if (end === 'mute') f.sound.muted = true;
    if (end === 'result') f.world.phase = 'result';
    if (end === 'reset') f.world.startRound();
    if (end === 'destroyed') { f.world.platforms = []; updateFurnace(f.world, f.h, .01); }
    if (end === 'suspended') f.sound.context.state = 'suspended';
    f.sound.update(end === 'exit' ? null : f.world);
    assert.equal(f.stopped.length, 1, end); assert.equal(f.sound.furnace.current, null, end);
  }
});

test('unmute and time corrections resume at the remaining phase instead of repeating the strike', () => {
  const f = fixture(); f.seek(12); f.sound.update(f.world);
  f.sound.muted = true; f.seek(13); f.sound.muted = false; f.sound.update(f.world);
  assert.ok(Math.abs(f.played.at(-1).offset - 2) < .00001);
  f.sound.context.currentTime += .5; f.seek(13.01); f.sound.update(f.world);
  assert.ok(Math.abs(f.played.at(-1).offset - 2.01) < .00001);
  assert.equal(f.played.length, 3);
});

test('furnace warning artwork uses lamps without any screen labels/countdowns, including reduced motion', () => {
  const f = fixture(); let labels = 0, fills = 0;
  const gradient = { addColorStop() {} };
  const c = new Proxy({}, { get: (_, key) => key === 'fillText' ? () => labels++ :
    key === 'fill' ? () => fills++ : key.startsWith('create') ? () => gradient : () => {}, set: () => true });
  for (const age of [0, 9.5, 12, 17]) for (const reduced of [false, true]) {
    f.h.age = 0; f.seek(age); drawFurnaceFixture(c, f.h, age, 'front', reduced);
  }
  assert.equal(labels, 0); assert.ok(fills > 0);
  const before = fills; f.h.done = true; drawFurnaceFixture(c, f.h, 12, 'front');
  assert.equal(fills, before);
});
