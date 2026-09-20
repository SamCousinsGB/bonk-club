import test from 'node:test';
import assert from 'node:assert/strict';
import { StateCodec } from '../src/state-codec.js';

function workers() {
  const instances = [];
  class Worker {
    constructor() { this.requests = []; instances.push(this); }
    postMessage(message) { this.requests.push(message); }
    terminate() { this.terminated = true; }
    reply(index, value, error = false) { this.onmessage({ data: { id: this.requests[index].id, value, error } }); }
  }
  return { Worker, instances };
}

test('codec rejects invalid worker results and overload without retrying on the render thread', async () => {
  const { Worker, instances } = workers(), codec = new StateCodec({ WorkerClass: Worker });
  try {
    // This is valid for the fallback encoder, so a retry would incorrectly succeed.
    const invalid = codec.run('encode', { test: 1 });
    instances[0].reply(0, null, true);
    await assert.rejects(invalid, /Invalid frame/);
    const pending = Array.from({ length: 6 }, () => codec.run('encode', { test: 2 }));
    await assert.rejects(codec.run('encode', { test: 3 }), /Codec busy/);
    assert.equal(instances[0].requests.length, 7);
    for (let i = 1; i <= 6; i++) instances[0].reply(i, i);
    assert.deepEqual(await Promise.all(pending), [1, 2, 3, 4, 5, 6]);
    assert.equal(codec.pending.size, 0);
  } finally { codec.stop(); }
});

test('a stalled worker has a deadline and the next frame starts a fresh worker', async () => {
  const { Worker, instances } = workers(), codec = new StateCodec({ WorkerClass: Worker, timeoutMs: 20 });
  try {
    await assert.rejects(codec.run('encode', { frame: 1 }), /Codec stopped/);
    assert.equal(instances[0].terminated, true); assert.equal(codec.pending.size, 0);
    const next = codec.run('encode', { frame: 2 });
    assert.equal(instances.length, 2);
    instances[0].onerror(); assert.ok(!instances[1].terminated, 'late errors belong to the old worker');
    instances[1].reply(0, 'fresh');
    assert.equal(await next, 'fresh');
  } finally { codec.stop(); }
});

test('worker errors reject outstanding work once and closing prevents resurrection', async () => {
  const { Worker, instances } = workers(), codec = new StateCodec({ WorkerClass: Worker });
  const pending = codec.run('decode', new Uint8Array([1]));
  instances[0].onerror(); await assert.rejects(pending, /Codec stopped/);
  const next = codec.run('encode', {}); codec.stop();
  await assert.rejects(next, /Codec stopped/);
  await assert.rejects(codec.run('encode', {}), /Codec closed/);
  assert.equal(codec.pending.size, 0); assert.equal(instances.length, 2);
});

test('environments without worker support retain compression and size validation', async () => {
  const codec = new StateCodec({ WorkerClass: null });
  try {
    const state = { time: 1, list: [1, 2, 3] };
    assert.deepEqual(await codec.run('decode', await codec.run('encode', state)), state);
    await assert.rejects(codec.run('decode', new Uint8Array(250001)), /Invalid frame/);
  } finally { codec.stop(); }
});
