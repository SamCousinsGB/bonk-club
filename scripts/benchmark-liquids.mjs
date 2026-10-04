// Local solver CPU time, not FPS or network latency. Compare any Git revision
// without another checkout: node scripts/benchmark-liquids.mjs HEAD
import { execFileSync } from 'node:child_process';
import { World, ARENAS } from '../src/engine.js';
import { moveLiquid } from '../src/liquid.js';
import { updateReactions } from '../src/reactions.js';
import { carveExplosion } from '../src/terrain.js';
import assert from 'node:assert/strict';

let baseline;
if (process.argv[2]) {
  const source = execFileSync('git', ['show', `${process.argv[2]}:src/liquid.js`], { encoding: 'utf8' })
    .replace(/from '(.\/[^']+)'/g, (_, file) => `from '${new URL('../src/' + file.slice(2), import.meta.url).href}'`);
  baseline = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).moveLiquid;
}
const percentile = (a, p) => a.toSorted((a, b) => a - b)[Math.floor((a.length - 1) * p)];
for (const damaged of [false, true]) {
  const seed = new World({ arena: ARENAS.findIndex(a => a.waterworks), shuffle: false, random: () => .4 });
  seed.phase = 'fight'; seed.players.forEach(p => p.alive = false);
  for (let n = 0; n < 120; n++) { seed.elapsed = n * .05; updateReactions(seed, .05); }
  if (damaged) for (let x = 400; x < 2200; x += 85) carveExplosion(seed, { x, y: 1300, radius: 40 });
  const times = { current: [], baseline: [] };
  for (let n = 0; n < 70; n++) for (const mode of n % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
    const solver = mode === 'baseline' ? baseline : moveLiquid;
    if (!solver) continue;
    const w = { arena: seed.arena, platforms: structuredClone(seed.platforms), water: structuredClone(seed.water), spills: [], reactionSerial: seed.reactionSerial };
    const startVolume = w.water.reduce((a, q) => a + q.w * q.h, 0);
    const start = performance.now();
    for (let t = 0; t < 12; t++) solver(w, .05);
    const elapsed = (performance.now() - start) / 12;
    if (n >= 10) times[mode].push(elapsed);
    assert.ok(w.water.length <= 384);
    assert.ok(w.water.reduce((a, q) => a + q.w * q.h, 0) <= startVolume + 1e-5);
  }
  console.log(JSON.stringify({ damaged, terrain: seed.platforms.length, parcels: seed.water.length,
    ...Object.fromEntries(Object.entries(times).filter(([, a]) => a.length).map(([key, a]) => [key, { p50Ms: percentile(a, .5), p95Ms: percentile(a, .95) }])) }));
}
