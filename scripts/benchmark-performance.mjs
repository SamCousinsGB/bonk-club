// Seeded CPU workloads; timings are diagnostics, never machine-dependent gates.
// BONK_BENCH_SRC can point at a saved src/ tree for an identical baseline run.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const source = process.env.BONK_BENCH_SRC;
const moduleUrl = name => source ? pathToFileURL(path.resolve(source, name + '.js')) : new URL('../src/' + name + '.js', import.meta.url);
const { World, ARENAS, STEP } = await import(moduleUrl('engine'));
const { carveExplosion } = await import(moduleUrl('terrain'));
const quantile = (values, p) => [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
for (const name of ['ARC FURNACE', 'CAR ASSEMBLY', 'CARGO PLANE HOLD', 'WATERWORKS', 'SUSPENSION BRIDGE']) {
  let seed = 7382;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const w = new World({ arena: ARENAS.findIndex(a=>a.name===name), players:[0,1,2,3], bots:[0,1,2,3], random, shuffle:false });
  const times = [], hashes = createHash('sha256');
  for (let tick=0; tick<1800; tick++) {
    if (tick === 600) carveExplosion(w,{x:1280,y:1000,radius:210});
    const at = performance.now(); w.step(STEP);
    if (tick>=120) times.push(performance.now()-at);
    if (tick%120===0) hashes.update(JSON.stringify(w.snapshot()));
  }
  console.log(JSON.stringify({ arena:name, ticks:1800, medianMs:quantile(times,.5), p95Ms:quantile(times,.95), p99Ms:quantile(times,.99), hash:hashes.digest('hex') }));
}
