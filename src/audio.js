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
    if (type === "player-join" || type === "player-leave") {
      // A soft rising chime for arrivals; a lower falling chime for exits.
      // Closely spaced arrivals or exits share a cue, with a bounded voice reserve
      // so normal gunfire cannot swallow it or a join burst stack loud chords.
      if (c.currentTime - (this.last.get(type) ?? -10) < 0.3 || this.active > 44) return;
      this.last.set(type, c.currentTime);
      const notes = type === "player-join" ? [660, 880] : [440, 330];
      this.tone(notes[0], notes[0], 0.17, 0.2, "sine");
      this.tone(notes[1], notes[1], 0.3, 0.18, "sine", 0.12);
      return;
    }
    const key = detail.nuclear ? "nuclear" : type;
    if (c.currentTime - (this.last.get(key) ?? -10) < (type === "ko" ? 0.12 : type === "shoot" ? 0.045 : 0.025)) return;
    this.last.set(key, c.currentTime);
    if (this.active > 28 && !detail.nuclear && !detail.melee && type !== "ko") return;
    if (type === "ko") {
      // Reserve a short, recognizable death cue even during busy gunfire.
      // Simultaneous deaths share one cue; the existing master limits output.
      if (this.active > 44) return;
      this.tone(145, 62, 0.12, 0.35, "triangle");
      this.tone(784, 740, 0.18, 0.25, "sine", 0.015);
      this.tone(1568, 1480, 0.12, 0.07, "sine", 0.015);
      this.tone(523, 392, 0.43, 0.3, "triangle", 0.13);
      if (!detail.effect || this.active > 44) return;
    }
    if (detail.nuclear && type === "explosion") {
      this.tone(130, 28, 2.7, 0.9);
      this.tone(52, 22, 3.8, 0.6, "triangle", 0.08);
      this.rumble(3.9, 1.2, 1800);
      return;
    }
    if(detail.effect && ["hit","ko","explosion"].includes(type)) {
      const dead=type==="ko",effect=detail.effect;
      if(effect==="ice"){this.tone(1550,380,dead?.55:.17,.28,"triangle");this.rumble(dead?.45:.08,.22,4500);return;}
      if(effect==="tesla"||effect==="plasma"){this.tone(effect==="tesla"?980:510,60,dead?.7:.23,.32,"sawtooth");this.rumble(dead?.6:.15,.32,2600);return;}
      if(effect==="slice"){this.rumble(dead?.26:.12,.65,3800);this.tone(210,38,.24,.45);return;}
      if(effect==="singularity"&&type!=="hit"){this.tone(150,22,dead?1.3:3,.55,"triangle");this.rumble(dead?1.1:2.8,.6,750);return;}
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
      if (detail.weapon === "cryo") {
        this.tone(1300, 280, .45, .3, "triangle"); this.rumble(.3, .28, 4200); return;
      }
      if (detail.weapon === "firework") {
        this.rumble(.28, .42, 3300); this.tone(900, 180, .3, .25, "triangle"); return;
      }
      this.tone(95, 27, 0.75, 0.6);
      this.rumble(1.05, 0.75, 1500);
      return;
    }
    if (type === "shoot" || ["rocket", "rail", "plasma", "pellet"].includes(type)) {
      const kind = detail.kind || type;
      if (kind === "jelly") { this.tone(120,620,.16,.28,"sine"); this.tone(540,95,.27,.2,"sine"); return; }
      if (kind === "gold") { this.tone(1320,880,.32,.24,"triangle"); this.tone(1980,1320,.24,.12,"sine"); return; }
      if (kind === "tangle") { this.tone(330,105,.22,.2,"triangle"); this.rumble(.08,.12,1700); return; }
      if (kind === "bolt") { this.tone(360, 85, .18, .25, "triangle"); this.rumble(.07, .15, 2700); return; }
      if (kind === "harpoon") { this.tone(190, 55, .25, .3, "sawtooth"); this.rumble(.16, .24, 1300); return; }
      if (detail.weapon === "firework") { this.tone(380, 1500, .42, .22, "sine"); this.rumble(.18, .18, 2500); return; }
      if (detail.weapon === "shrapnel") { this.tone(120, 28, .28, .45); this.rumble(.3, .55, 3200); return; }
      if (detail.weapon === "cryo") { this.tone(720, 460, .14, .16, "sine"); return; }
      if (kind === "bubble") { this.tone(280, 920, .19, .24, "sine"); return; }
      if (kind === "boomerang") { this.tone(560, 160, .23, .18, "triangle"); this.rumble(.15, .12, 2200); return; }
      if (kind === "duck") { this.tone(620, 390, .18, .25, "square"); this.tone(470, 320, .25, .12, "triangle"); return; }
      if (kind === "phaser") {
        this.tone(520, 85, .42, .35, "sawtooth");
        this.tone(1040, 210, .35, .18, "sine");
        this.rumble(.35, .45, 850);
        return;
      }
      const heavy = detail.heavy || ["rocket", "rail", "plasma", "pellet"].includes(kind);
      this.tone(kind === "rail" ? 820 : kind === "plasma" ? 360 : 185,
        kind === "rail" ? 60 : 38, heavy ? 0.34 : 0.14, heavy ? 0.5 : 0.25, "triangle");
      this.rumble(heavy ? 0.24 : 0.09, heavy ? 0.6 : 0.3, 2300);
      return;
    }
    if(type==="hazard"&&detail.kind==="leak"){
      this.rumble(.28,.16,detail.urgent?3800:2600);
      if(detail.urgent)this.tone(940,1250,.08,.12,"triangle");
      return;
    }
    const table = {
      hazard: [780, 0.22, "sine"],
      parry: [920, 0.15, "sine"], swing: [160, 0.035, "triangle"],
      throw: [190, 0.06, "triangle"], coverhit: [160, 0.055, "triangle"],
      break: [75, 0.16, "square"], jump: [230, 0.055, "sine"],
      pickup: [650, 0.12, "sine"], fight: [440, 0.2, "square"], round: [330, 0.23, "triangle"],
    };
    const def = table[type];
    if (def) this.tone(def[0], def[0] * (type === "pickup" ? 1.5 : 0.3), def[1], 0.13, def[2]);
  }
}
