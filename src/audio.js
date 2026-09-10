export class Sound {
  constructor() {
    this.muted = false;
    this.context = null;
    this.active = 0;
    this.last = new Map();
  }
  connect() {
    const c = this.context;
    this.master = c.createGain();
    this.master.gain.value = 0.65;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.22;
    // A compressor's attack can let overlapping transients through. Bound the
    // final signal as well, including simultaneous explosions and impacts.
    this.saturator = c.createWaveShaper();
    this.saturator.curve = Float32Array.from({ length: 8193 }, (_, i) =>
      0.9 * Math.tanh(1.2 * (i / 4096 - 1)) / Math.tanh(1.2));
    this.master.connect(this.limiter);
    this.limiter.connect(this.saturator);
    this.saturator.connect(c.destination);
    this.noise = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const samples = this.noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.12) / 1.025;
      samples[i] = previous * 2.6;
    }
  }
  unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.connect();
    }
    if (this.context.state === "suspended") this.context.resume();
  }
  tone(freq, end, length, gain, wave = "sine", delay = 0) {
    const c = this.context, start = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, start);
    o.frequency.exponentialRampToValueAtTime(Math.max(18, end), start + length);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, start + length);
    o.connect(g); g.connect(this.master);
    o.start(start); o.stop(start + length);
    this.active++;
    o.onended = () => { o.disconnect(); g.disconnect(); this.active--; };
  }
  rumble(length, gain, frequency, delay = 0) {
    const c = this.context, start = c.currentTime + delay;
    const noise = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
    noise.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(70, start + length);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, start + length);
    noise.connect(filter); filter.connect(g); g.connect(this.master);
    noise.start(start); noise.stop(start + length);
    this.active++;
    noise.onended = () => { noise.disconnect(); filter.disconnect(); g.disconnect(); this.active--; };
  }
  play(type, detail = {}) {
    const c = this.context;
    if (this.muted || !c || (c.state !== "running" && !c.startRendering)) return;
    if (!this.master) this.connect();
    const key = detail.nuclear ? "nuclear" : type;
    if (c.currentTime - (this.last.get(key) ?? -10) < (type === "shoot" ? 0.045 : 0.025)) return;
    this.last.set(key, c.currentTime);
    if (this.active > 28 && !detail.nuclear && !detail.melee) return;
    if (detail.nuclear && type === "explosion") {
      this.tone(130, 28, 2.7, 0.9);
      this.tone(52, 22, 3.8, 0.6, "triangle", 0.08);
      this.rumble(3.9, 1.2, 1800);
      return;
    }
    if (type === "hit") {
      const heavy = detail.move === "spin" || detail.damage > 35;
      const kick = detail.move === "kick";
      this.tone(detail.melee ? (kick ? 120 : 145) : 110, heavy ? 35 : kick ? 42 : 48, heavy ? 0.34 : kick ? 0.27 : 0.22,
        detail.melee ? 0.65 : 0.35);
      this.rumble(heavy ? 0.2 : kick ? 0.12 : 0.095, detail.melee ? 0.65 : 0.4, detail.melee ? 950 : 1800);
      return;
    }
    if (type === "explosion") {
      this.tone(95, 27, 0.75, 0.6);
      this.rumble(1.05, 0.75, 1500);
      return;
    }
    if (type === "shoot" || ["rocket", "rail", "plasma", "pellet"].includes(type)) {
      const kind = detail.kind || type;
      const heavy = detail.heavy || ["rocket", "rail", "plasma", "pellet"].includes(kind);
      this.tone(kind === "rail" ? 820 : kind === "plasma" ? 360 : 185,
        kind === "rail" ? 60 : 38, heavy ? 0.34 : 0.14, heavy ? 0.5 : 0.25, "triangle");
      this.rumble(heavy ? 0.24 : 0.09, heavy ? 0.6 : 0.3, 2300);
      return;
    }
    const table = {
      hazard: [780, 0.22, "sine"], ko: [65, 0.28, "sawtooth"],
      parry: [920, 0.15, "sine"], swing: [160, 0.035, "triangle"],
      throw: [190, 0.06, "triangle"], coverhit: [160, 0.055, "triangle"],
      break: [75, 0.16, "square"], jump: [230, 0.055, "sine"],
      pickup: [650, 0.12, "sine"], fight: [440, 0.2, "square"], round: [330, 0.23, "triangle"],
    };
    const def = table[type];
    if (def) this.tone(def[0], def[0] * (type === "pickup" ? 1.5 : 0.3), def[1], 0.13, def[2]);
  }
}
