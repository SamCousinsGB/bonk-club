// Reproducible CPU comparison: both paths use the same authoritative snapshots
// and inputs. Timings are local CPU work, not FPS or internet latency.
import assert from 'node:assert/strict';
import { World, cleanInput } from '../src/engine.js';
import { RenderSnapshots } from '../src/render-state.js';
import { GuestPrediction } from '../src/guest-prediction.js';
import { blackholeField } from '../src/blackhole.js';
import { prepareProp } from '../src/props.js';

const quantile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
for (const debris of [0, 96]) {
  const w = new World({ players: [0, 1, 2, 3], random: () => .45 });
  w.phase = 'fight'; w.time = 1;
  w.cover = Array.from({ length: debris }, (_, i) => prepareProp({ id: `bench-${i}`, kind: 'crate',
    x: 100 + i % 16 * 150, y: 300 + Math.floor(i / 16) * 100, w: 40, h: 40,
    hp: 80, maxHp: 80, angle: i * .2 }));
  w.fields = debris ? [blackholeField(w, { x: 1100, y: 900, owner: 0 })] : [];
  const encoder = new RenderSnapshots();
  const state = { ...encoder.make(w.snapshot()), inputAcks: [0, 0, 0, 0] };
  const input = cleanInput({ right: true, jump: true });
  const times = { uncached: [], cached: [] }; let checks = 0;
  for (let n = 0; n < 160; n++) {
    const outcomes = [];
    // Alternate ordering to avoid assigning all warm-up/thermal effects to one.
    for (const mode of n % 2 ? ['cached', 'uncached'] : ['uncached', 'cached']) {
      const prediction = new GuestPrediction(); prediction.receive(state, 1, 1000);
      if (mode === 'uncached') prediction.context.solids = World.prototype.solids;
      const at = performance.now();
      for (let seq = 1; seq <= 12; seq++) prediction.advance(input, seq, 1000 + seq * 1000 / 60);
      if (n >= 20) times[mode].push(performance.now() - at);
      outcomes.push(prediction.player);
    }
    assert.deepEqual(outcomes[0], outcomes[1]); checks++;
  }
  console.log(JSON.stringify({ props: debris, exactReplayChecks: checks,
    uncachedP50Ms: quantile(times.uncached, .5), cachedP50Ms: quantile(times.cached, .5),
    uncachedP95Ms: quantile(times.uncached, .95), cachedP95Ms: quantile(times.cached, .95) }));
}
