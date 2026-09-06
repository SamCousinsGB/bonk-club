export class Sound {
  constructor() {
    this.muted = false;
    this.context = null;
  }
  unlock() {
    if (!this.context)
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === "suspended") this.context.resume();
  }
  play(type) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const table = {
      hit: [100, 0.12, "triangle"],
      ko: [65, 0.28, "sawtooth"],
      parry: [920, 0.15, "sine"],
      block: [270, 0.08, "square"],
      swing: [160, 0.035, "triangle"],
      shoot: [160, 0.09, "sawtooth"],
      explosion: [46, 0.35, "sawtooth"],
      jump: [230, 0.055, "sine"],
      pickup: [650, 0.12, "sine"],
      fight: [440, 0.2, "square"],
      round: [330, 0.23, "triangle"],
    };
    const def = table[type];
    if (!def) return;
    const [freq, len, wave] = def,
      c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      type === "pickup" ? freq * 1.5 : freq * 0.3,
      c.currentTime + len,
    );
    g.gain.setValueAtTime(0.085, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + len);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + len);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}
