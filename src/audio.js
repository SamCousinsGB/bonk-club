import { SOUND_NAMES, SOUND_RATE, NUKE_FUSE, synthesizeSound, weaponSound } from './sound-design.js';
import { W } from './scale.js';
import { Landings } from './landings.js';

export class Sound {
  constructor() {
    this._muted = false;
    this.context = null;
    this.active = 0;
    this.last = new Map();
    this.buffers = new Map();
    this.variants = new Map();
    this.nukeIds = new WeakMap();
    this.nextNukeId = 0;
    this.alarm = null;
    this.landings = new Landings();
  }
  get muted() { return this._muted; }
  set muted(value) {
    this._muted = !!value;
    if (this.master?.gain) this.master.gain.setTargetAtTime(value ? 0 : .8, this.context.currentTime, .008);
    if (value) this.stopAlarm();
  }
  connect() {
    const c = this.context;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : .8;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = .003;
    this.limiter.release.value = .22;
    this.saturator = c.createWaveShaper();
    // Transparent at normal levels. The old tanh distorted the entire mix and
    // clamped at +/-1 before the curve, adding grit to overlapping bass/voices.
    // Expand the represented input range and oversample the safety knee.
    this.safetyInput = c.createGain();
    this.safetyInput.gain.value = 1.25 / 8;
    this.saturator.curve = Float32Array.from({ length: 16385 }, (_, i) => {
      const x = (i / 8192 - 1) * 8, a = Math.abs(x);
      return a <= .6 ? x : Math.sign(x) * (.6 + .2 * Math.tanh((a - .6) / .2));
    });
    this.saturator.oversample = '4x';
    this.master.connect(this.limiter);
    this.limiter.connect(this.safetyInput);
    this.safetyInput.connect(this.saturator);
    this.saturator.connect(c.destination);
  }
  unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.connect();
      // Warm one recording at a time outside the simulation/render callback.
      const queue = SOUND_NAMES.flatMap(name => name === 'siren' ? [[name, 0]] : [0, 1, 2].map(v => [name, v]));
      const schedule = globalThis.requestIdleCallback
        ? fn => globalThis.requestIdleCallback(fn, { timeout: 1500 })
        : fn => globalThis.setTimeout(fn, 25);
      const next = () => {
        const args = queue.shift();
        if (!args || this.context.state === 'closed') return;
        this.buffer(...args);
        if (queue.length) schedule(next);
      };
      schedule(next);
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }
  buffer(name, variant = 0) {
    const key = name + ':' + variant;
    if (!this.buffers.has(key)) {
      const samples = synthesizeSound(name, variant);
      const buffer = this.context.createBuffer(1, samples.length, SOUND_RATE);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(key, buffer);
    }
    return this.buffers.get(key);
  }
  ready() {
    const c = this.context;
    if (this.muted || !c || (c.state !== 'running' && !c.startRendering)) return false;
    if (!this.master) this.connect();
    return true;
  }
  sample(name, detail = {}, { priority = false, offset = 0, duration, fixed = false } = {}) {
    const ceiling = name === 'siren' || name === 'nuclear' ? 48 : priority ? 45 : 36;
    if (!this.ready() || this.active >= ceiling) return null;
    const c = this.context, now = c.currentTime;
    const variant = fixed ? 0 : (this.variants.get(name) || 0);
    if (!fixed) this.variants.set(name, (variant + 1) % 3);
    const source = c.createBufferSource(), gain = c.createGain(), pan = c.createStereoPanner();
    source.buffer = this.buffer(name, variant);
    // Keep combat legible across the arena, with room for the central siren.
    pan.pan.value = name === 'siren' ? 0 : Number.isFinite(detail.x) ? Math.max(-.7, Math.min(.7, (detail.x / W * 2 - 1) * .7)) : 0;
    const level = name === 'siren' ? .8 : this.alarm ? .72 : 1;
    gain.gain.setValueAtTime(offset > 0 ? 0 : level, now);
    if (offset > 0) gain.gain.linearRampToValueAtTime(level, now + .008);
    source.connect(gain); gain.connect(pan); pan.connect(this.master);
    const length = Math.min(duration ?? source.buffer.duration - offset, source.buffer.duration - offset);
    // Every source stops at zero, including a siren seek with a shortened tail.
    const end = now + Math.max(.001, length);
    gain.gain.setValueAtTime(level, Math.max(now + .008, end - .012));
    gain.gain.linearRampToValueAtTime(0, end);
    source.start(now, offset, Math.max(.001, length));
    this.active++;
    const voice = { source, gain, end: now + length, stopped: false };
    source.onended = () => { voice.stopped = true; source.disconnect(); gain.disconnect(); pan.disconnect(); this.active--; };
    return voice;
  }
  // The short room-arrival interface chimes remain separate from combat.
  tone(freq, end, length, gain, wave = 'sine', delay = 0) {
    const c = this.context, start = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, start);
    o.frequency.exponentialRampToValueAtTime(Math.max(18, end), start + length);
    g.gain.setValueAtTime(.001, start);
    g.gain.linearRampToValueAtTime(gain, start + .006);
    g.gain.exponentialRampToValueAtTime(.001, start + length);
    o.connect(g); g.connect(this.master);
    o.start(start); o.stop(start + length);
    this.active++;
    o.onended = () => { o.disconnect(); g.disconnect(); this.active--; };
  }
  stopAlarm() {
    const voice = this.alarm?.voice;
    if (voice && !voice.stopped) {
      const now = this.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, .004);
      voice.source.stop(now + .018);
      voice.stopped = true;
    }
    this.alarm = null;
  }
  update(state) {
    for (const contact of this.landings.update(state)) this.sample(contact.name, contact);
    const projectile = state?.projectiles?.filter(b => b.nuclear && Number.isFinite(b.life) && b.life > 0 && b.life <= NUKE_FUSE + .01)
      .reduce((first, b) => !first || b.life < first.life ? b : first, null);
    if (!projectile || !this.ready()) { this.stopAlarm(); return; }
    // Host projectiles keep object identity; guests already have stable netIds.
    // Nothing new is added to the wire protocol or authoritative world state.
    if (projectile.netId == null && !this.nukeIds.has(projectile)) this.nukeIds.set(projectile, ++this.nextNukeId);
    const key = state.round + ':' + (projectile.netId ?? this.nukeIds.get(projectile));
    const remaining = Math.min(NUKE_FUSE, projectile.life), now = this.context.currentTime;
    const deadline = now + remaining;
    if (this.alarm?.key === key) {
      // Repeated rendering of one snapshot cannot restart or prolong the fuse.
      if (state.time === this.alarm.stateTime) return;
      this.alarm.stateTime = state.time;
      if (Math.abs(deadline - this.alarm.voice.end) < .14) return;
    }
    this.stopAlarm();
    const voice = this.sample('siren', {}, { priority: true, fixed: true, offset: NUKE_FUSE - remaining, duration: remaining });
    if (voice) this.alarm = { key, voice, stateTime: state.time };
  }
  play(type, detail = {}) {
    if (!this.ready()) return;
    const c = this.context;
    if (type === 'player-join' || type === 'player-leave') {
      if (c.currentTime - (this.last.get(type) ?? -10) < .3 || this.active > 44) return;
      this.last.set(type, c.currentTime);
      const notes = type === 'player-join' ? [660, 880] : [440, 330];
      this.tone(notes[0], notes[0], .17, .2);
      this.tone(notes[1], notes[1], .3, .18, 'sine', .12);
      return;
    }
    const shooting = type === 'shoot' || ['rocket', 'rail', 'plasma', 'pellet'].includes(type);
    const shot = shooting ? weaponSound({ ...detail, kind: detail.kind || type }) : null;
    const key = detail.nuclear ? 'nuclear' : shot ? 'shot:' + shot : type;
    if (c.currentTime - (this.last.get(key) ?? -10) < (type === 'ko' ? .12 : shooting ? .04 : .025)) return;
    this.last.set(key, c.currentTime);
    if (type === 'ko') {
      // A shared physical death impact stays identifiable across every cause.
      // Do not stack another full weapon discharge on top of the lethal hit.
      this.sample('death', detail, { priority: true });
      return;
    }
    if (detail.nuclear && type === 'explosion') {
      this.stopAlarm();
      this.sample('nuclear', detail, { priority: true }); return;
    }
    if (shooting) { this.sample(shot, detail); return; }
    if (detail.effect && ['hit', 'ko', 'explosion'].includes(type)) {
      const effect = ({ bubble: 'bubble', ice: 'ice', tesla: 'tesla', plasma: 'plasma', phaser: 'phaser',
        slice: 'slice', singularity: 'singularity', burn: 'burn', jelly: 'jelly', gold: 'gold', tangle: 'tangle' })[detail.effect];
      if (effect) { this.sample(effect, detail, { priority: type === 'ko' }); return; }
    }
    if (type === 'hit') {
      this.sample(detail.move === 'spin' || detail.move === 'kick' || detail.force >= 2000 || detail.damage > 35 ? 'heavy-impact' : 'impact', detail,
        { priority: !!detail.melee }); return;
    }
    if (type === 'explosion') {
      this.sample(detail.weapon === 'cryo' ? 'ice' : 'explosion', detail); return;
    }
    if(type==='hazard'&&detail.kind==='leak') {
      this.sample('frost',detail,{duration:.22});
      if(detail.urgent)this.tone(940,1250,.08,.12,'triangle');
      return;
    }
    const swing = ['bat', 'sword', 'hammer', 'powerfist'].includes(detail.weapon) ? weaponSound(detail) : 'whoosh';
    const name = { hazard: 'burn', parry: 'parry', swing, throw: 'whoosh',
      coverhit: 'cover', break: 'debris', jump: 'jump', pickup: 'pickup', fight: 'fight', round: 'round' }[type];
    if (name) this.sample(name, detail);
  }
}
