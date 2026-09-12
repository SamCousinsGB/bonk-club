import { FURNACE_CYCLE, FURNACE_ON, FURNACE_WARNING, FURNACE_COOLING } from './furnace-arena.js';
import { furnaceHeat } from './furnace.js';

export const FURNACE_SOUNDS = Object.freeze({
  'furnace-charge': FURNACE_ON - FURNACE_WARNING,
  'furnace-arc': FURNACE_CYCLE - FURNACE_ON,
  'furnace-cool': FURNACE_COOLING,
});

// Original bounded PCM recordings, cached by Sound. No oscillators or noise
// sources are spawned per frame; the complete discharge is a single voice.
export function synthesizeFurnace(name, rate) {
  const duration = FURNACE_SOUNDS[name];
  if (!duration) throw new Error(`Unknown furnace sound: ${name}`);
  const out = new Float32Array(Math.ceil(duration * rate)), tau = Math.PI * 2;
  let seed = 83719, low = 0, bass = 0, crack = 0, nextCrack = .06;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < out.length; i++) {
    const t = i / rate, u = t / duration, n = random() * 2 - 1;
    low += (1 - Math.exp(-tau * 2200 / rate)) * (n - low);
    bass += (1 - Math.exp(-tau * 125 / rate)) * (n - bass);
    const hum = Math.sin(tau * 50 * t) * .6 + Math.sin(tau * 100 * t) * .25 + Math.sin(tau * 151 * t) * .15;
    let v;
    if (name === 'furnace-charge') {
      // Transformer strain rises in pitch and body without a spoken warning.
      const whine = Math.sin(tau * (170 * t + 80 * t * t));
      v = (hum * .15 + whine * .065 * u + low * .12 * u) * (.18 + .82 * u * u);
    } else if (name === 'furnace-arc') {
      if (t >= nextCrack) { crack = .55 + random() * .4; nextCrack = t + .055 + random() * .31; }
      crack *= Math.exp(-1 / (.013 * rate));
      const flutter = .65 + .35 * Math.sin(tau * 17.3 * t) ** 2;
      const strike = Math.exp(-t * 18);
      v = hum * .16 + bass * 1.15 + low * (.24 * flutter + crack * .65) +
        Math.sin(tau * (65 * t - 2 * t * t)) * strike * .27;
    } else {
      // Breaker drops out; the vessel rings and vents as the grate cools.
      v = (low * .24 + hum * .075 + Math.sin(tau * 327 * t) * .04) * Math.exp(-u * 4);
    }
    const fade = Math.min(1, t / .012) * Math.min(1, (out.length - 1 - i) / (rate * .035));
    out[i] = .72 * Math.tanh(v / .72) * fade;
  }
  return out;
}

export class FurnaceSound {
  constructor() { this.current = null; }
  stop(sound) {
    const voice = this.current?.voice;
    if (voice && !voice.stopped) {
      const now = sound.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, .008);
      voice.source.stop(now + .035); voice.stopped = true;
    }
    this.current = null;
  }
  update(sound, state) {
    const h = state?.phase === 'fight' && state.hazards?.find(h => h.type === 'furnace' && !h.done);
    if (!h || !Number.isFinite(h.age) || h.age < 0 || !sound.ready()) { this.stop(sound); return; }
    const phase = (h.age + 1e-9) % FURNACE_CYCLE;
    const name = h.active ? 'furnace-arc' : h.warning > 0 ? 'furnace-charge' : furnaceHeat(h) > 0 ? 'furnace-cool' : null;
    if (!name) { this.stop(sound); return; }
    const offset = Math.max(0, phase - (h.active ? FURNACE_ON : h.warning > 0 ? FURNACE_WARNING : 0));
    const remaining = FURNACE_SOUNDS[name] - offset;
    if (remaining <= .002) { this.stop(sound); return; }
    const key = `${state.round}:${h.id}:${Math.floor((h.age + 1e-9) / FURNACE_CYCLE)}:${name}`;
    if (this.current?.key === key) {
      // A stale snapshot cannot repeat the strike or sustain electricity forever.
      if (this.current.age === h.age) return;
      this.current.age = h.age;
      if (Math.abs(sound.context.currentTime + remaining - this.current.voice.end) < .2) return;
    }
    this.stop(sound);
    const voice = sound.sample(name, { x: h.x }, { priority: true, fixed: true, offset, duration: remaining });
    if (voice) this.current = { key, age: h.age, voice };
  }
}
