// Original procedural recordings. Render layered pressure transients, turbulent
// air and damped material resonances once, then reuse them as short PCM samples.
// No downloaded assets, per-shot DSP graph, or pitched arcade sweeps.
export const SOUND_RATE = 24000;
export const NUKE_FUSE = 2.8;
const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = n => n * n * (3 - 2 * n);

export function sirenCycle(age) {
  const phase = clamp(age / NUKE_FUSE, 0, 1) * 2 % 1;
  return smooth(phase < .56 ? phase / .56 : (1 - phase) / .44);
}

const guns = {
  pistol: [.19, 150, .75, .085], smg: [.13, 190, .55, .047],
  rifle: [.24, 125, .85, .09], minigun: [.15, 105, .7, .045],
  machinegun: [.32, 78, 1, .11], shotgun: [.5, 72, 1.2, .2],
  shrapnel: [.58, 63, 1.3, .23], ricochet: [.25, 170, .8, .095],
};
export const WEAPON_SOUNDS = Object.freeze({
  blaster: 'pistol', smg: 'smg', burst: 'rifle', minigun: 'minigun',
  machinegun: 'machinegun', shotgun: 'shotgun', shrapnel: 'shrapnel', ricochet: 'ricochet',
  rocket: 'rocket', barrage: 'barrage', homing: 'rocket', cluster: 'rocket',
  grenade: 'pin', nuke: 'pin', cryo: 'pin',
  railgun: 'rail', plasma: 'plasma', tesla: 'tesla', phaser: 'phaser',
  flame: 'flame', frost: 'frost', saw: 'saw', repulsor: 'force',
  blackhole: 'singularity', crossbow: 'crossbow', harpoon: 'harpoon',
  firework: 'firework', bubble: 'bubble', boomerang: 'whoosh', duck: 'duck',
  bat: 'whoosh', sword: 'blade', hammer: 'heavy-swing',
  jelly: 'jelly', midas: 'gold', tangle: 'tangle',
});
export const SOUND_NAMES = Object.freeze([...new Set([
  ...Object.values(WEAPON_SOUNDS), 'impact', 'heavy-impact', 'slice', 'ice',
  'burn', 'explosion', 'nuclear', 'siren', 'debris', 'cover', 'parry',
  'jump', 'pickup', 'fight', 'round', 'death', 'footstep', 'landing',
])]);

export function weaponSound(detail = {}) {
  return WEAPON_SOUNDS[detail.weapon] || ({
    bullet: 'pistol', pellet: 'shotgun', bolt: 'crossbow', grenade: 'pin',
    force: 'force', singularity: 'singularity',
  })[detail.kind] || (SOUND_NAMES.includes(detail.kind) ? detail.kind : 'pistol');
}

export function synthesizeSound(name, variant = 0, rate = SOUND_RATE) {
  if (!SOUND_NAMES.includes(name)) throw new Error(`Unknown sound: ${name}`);
  let seed = 2166136261 ^ variant * 7919;
  for (const ch of name) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const duration = name === 'siren' ? NUKE_FUSE : name === 'nuclear' ? 4.6 :
    name === 'explosion' ? 1.65 : name === 'singularity' ? 1.4 :
    name === 'phaser' ? .9 : name === 'footstep' ? .24 : name === 'landing' ? .38 :
    guns[name] ? guns[name][0] + .22 : .8;
  const samples = new Float32Array(Math.ceil(duration * rate));
  // Each layer is bounded and fades to zero; high-pass differences remove DC.
  function noise(at, length, gain, low = 7000, high = 50, attack = .0008, texture = 0) {
    let lp = 0, hp = 0, mod = 0;
    const a = 1 - Math.exp(-TAU * Math.min(rate * .42, low) / rate);
    const b = 1 - Math.exp(-TAU * high / rate);
    const start = Math.round(at * rate), count = Math.min(Math.ceil(length * rate), samples.length - start);
    for (let i = 0; i < count; i++) {
      const t = i / rate, q = t / length;
      lp += a * (random() * 2 - 1 - lp); hp += b * (lp - hp);
      mod += .015 * (random() - mod);
      const env = Math.min(1, t / attack) * Math.exp(-q * 6) * Math.min(1, (length - t) / .008);
      const flutter = texture ? .3 + .7 * Math.pow(Math.abs(Math.sin(t * texture + mod * 9)), 3) : 1;
      samples[start + i] += (lp - hp) * env * gain * flutter;
    }
  }
  function modes(at, length, gain, frequencies) {
    const start = Math.round(at * rate), count = Math.min(Math.ceil(length * rate), samples.length - start);
    for (let m = 0; m < frequencies.length; m++) {
      const frequency = frequencies[m] * (1 + (random() - .5) * .035);
      const phase = random() * TAU;
      for (let i = 0; i < count; i++) {
        const t = i / rate;
        samples[start + i] += Math.sin(t * TAU * frequency + phase) *
          gain / (1 + m) * Math.min(1, t / .0015) * Math.exp(-t / length * (7 + m * 2)) *
          Math.min(1, (length - t) / .008);
      }
    }
  }
  function mechanics(at = .05, strength = .2) {
    noise(at, .032, strength, 6500, 900);
    modes(at, .06, strength * .35, [860, 2341, 3877]);
    noise(at + .028, .023, strength * .6, 4700, 800);
  }
  function blast(length = 1.5, gain = 1) {
    noise(0, .055, .9 * gain, 8500, 1400);
    noise(.004, length, 2.4 * gain, 320, 28, .006);
    noise(.018, length * .65, 1.3 * gain, 2200, 180, .008, 57);
    modes(.004, .35, .24 * gain, [47, 73, 121]);
    for (let n = 0; n < 9; n++) noise(.12 + random() * length * .65, .06 + random() * .12, .08 * gain, 4300, 1100);
  }

  if (guns[name]) {
    const [tail, body, gain, action] = guns[name];
    noise(0, .026, (name === 'smg' ? 1.25 : 1.05) * gain, name === 'smg' ? 10000 : 7500, 1800, .0002);
    noise(.001, tail, 2.8 * gain, body * 7, 65, .0007);
    modes(.002, tail * .8, .22 * gain, [body, body * 1.63, body * 2.71]);
    noise(.012, tail * .75, .5 * gain, 3400, 750);
    for (const [delay, level] of [[.047, .2], [.091, .12], [.157, .07]])
      noise(delay, tail * .75, gain * level, 2300, 160, .002);
    mechanics(action, name === 'shotgun' ? .35 : .18);
    // Add weight below the report while retaining the SMG's attack and cadence.
    modes(.003, name === 'smg' ? .16 : tail, name === 'smg' ? .14 : .36 * gain,
      [name === 'smg' ? 94 : Math.max(56, body * .53), 123, 187]);
    if (name !== 'smg') noise(.004, tail * .8, .7 * gain, 240, 35, .004);
  } else if (name === 'siren') {
    let rotor = 0, second = 0, air = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate, cycle = sirenCycle(t), frequency = 285 + cycle * 360;
      rotor += TAU * frequency / rate; second += TAU * frequency * 1.013 / rate;
      air += .12 * (random() * 2 - 1 - air);
      const horn = Math.sin(rotor) + .22 * Math.sin(rotor * 2) + .07 * Math.sin(rotor * 3) + .14 * Math.sin(second);
      const lowRotor = .65 * Math.sin(rotor * .5) + .38 * Math.sin(rotor * .25) + .16 * Math.sin(second * .5);
      const envelope = Math.min(1, t / .06) * Math.min(1, (NUKE_FUSE - t) / .015);
      samples[i] = (.3 * horn + .3 * lowRotor + air * .025) * (.65 + cycle * .35) * envelope;
    }
  } else if (name === 'nuclear') {
    blast(4.5, 1.4);
    noise(.15, 4.3, 3.3, 135, 24, .08, 13);
    noise(.24, 3.2, .8, 1200, 90, .1, 21);
  } else if (name === 'explosion') blast();
  else if (['rocket', 'barrage', 'firework', 'harpoon'].includes(name)) {
    mechanics(0, .35);
    noise(.008, name === 'harpoon' ? .24 : .65, 2, 1400, 90, .007, 89);
    noise(.005, .07, .6, 6500, 1600);
    modes(.008, .2, .22, [68, 127, 249]);
    if (name === 'barrage') { noise(.035, .5, .7, 2900, 250); mechanics(.08, .3); }
    if (name === 'firework') noise(.05, .7, .5, 4100, 2300, .02, 155);
  } else if (name === 'pin' || name === 'pickup') {
    mechanics(.005, name === 'pin' ? .42 : .3); noise(.07, .14, .2, 2300, 180, .01);
  } else if (name === 'crossbow') {
    noise(0, .08, .8, 4400, 500);
    modes(.004, .19, .24, [147, 293, 589, 1253]); mechanics(.025, .23);
  } else if (['rail', 'tesla', 'plasma', 'phaser', 'force', 'singularity'].includes(name)) {
    const length = name === 'phaser' ? .78 : name === 'singularity' ? 1.3 : name === 'tesla' ? .3 : .5;
    noise(0, .024, .9, 9500, 2200, .0002);
    noise(.005, length, name === 'tesla' ? .9 : 2.2, name === 'tesla' ? 5800 : 650, 35, .003, name === 'tesla' ? 890 : 97);
    noise(.011, length * .8, .9, 4600, 950, .004, name === 'rail' ? 340 : 173);
    modes(.003, length * .7, .2, name === 'tesla' ? [93, 187, 375] : [41, 67, 109]);
    for (let n = 0; n < (name === 'tesla' ? 14 : 6); n++)
      noise(.018 + random() * length * .75, .008 + random() * .036, .5, 9200, 2700, .0002);
    if (name === 'rail') { mechanics(.11, .3); noise(.035, .4, .4, 7800, 1700); }
  } else if (['flame', 'burn', 'frost'].includes(name)) {
    noise(0, name === 'burn' ? .65 : .22, name === 'frost' ? .65 : 1.6,
      name === 'frost' ? 7400 : 1700, name === 'frost' ? 2100 : 75, .014, name === 'frost' ? 120 : 53);
    if (name !== 'frost') for (let n = 0; n < 8; n++) noise(random() * .17, .012, .2, 6500, 1900);
  } else if (['ice', 'slice', 'debris', 'cover', 'parry'].includes(name)) {
    noise(0, name === 'slice' ? .19 : .09, .85, 7600, name === 'cover' ? 150 : 1700);
    const glass = name === 'ice', metal = name === 'parry';
    if (glass || metal) modes(.002, .4, .18, glass ? [2147, 3371, 4969, 7133] : [683, 1811, 2963, 4567]);
    if (name !== 'parry') for (let n = 0; n < 10; n++) {
      const at = .03 + random() * .3;
      noise(at, .013 + random() * .04, .12, glass ? 9500 : 4300, glass ? 3100 : 400);
    }
    if (name === 'slice' || name === 'cover') noise(.003, .16, 1.1, 700, 80);
  } else if (name === 'death') {
    noise(0, .07, .65, 2800, 230, .003);
    noise(.006, .55, 1.75, 390, 35, .009);
    modes(.004, .65, .5, [58, 92, 143]);
    noise(.025, .55, .36, 1800, 160, .035);
    noise(.09, .25, .12, 3100, 800, .018);
  } else if (name === 'footstep' || name === 'landing') {
    const heavy = name === 'landing';
    noise(0, .035, heavy ? .28 : .16, 2300, 400, .002);
    noise(.004, heavy ? .23 : .14, heavy ? 1.9 : 1.1, 420, 45, .004);
    modes(.003, heavy ? .26 : .17, heavy ? .42 : .27, [heavy ? 66 : 88, 147, 231]);
    noise(.025, .09, .12, 1800, 300, .008);
  } else if (name === 'impact' || name === 'heavy-impact') {
    const heavy = name === 'heavy-impact';
    noise(0, .03, .75, 5100, 1100);
    noise(.002, heavy ? .3 : .19, heavy ? 3.5 : 2.4, heavy ? 520 : 900, 55, .001);
    modes(.003, .18, heavy ? .3 : .2, [83, 137, 219]);
    noise(.014, .18, .23, 3300, 800);
  } else if (['whoosh', 'heavy-swing', 'blade', 'jump'].includes(name)) {
    noise(0, name === 'heavy-swing' ? .38 : .22, name === 'jump' ? .32 : .8,
      name === 'blade' ? 6000 : 2200, 200, .026, 0);
    if (name === 'blade') modes(.012, .16, .035, [1381, 2389]);
  } else if (name === 'saw') {
    mechanics(0, .32); noise(.004, .6, 1.3, 3700, 180, .005, 470);
    modes(.015, .35, .09, [211, 439, 877, 1731]);
  } else if (name === 'gold') {
    noise(0, .028, .7, 6800, 1100);
    modes(.002, .45, .2, [973, 1747, 2917, 4283]);
    for (let n = 0; n < 7; n++) mechanics(.06 + random() * .25, .13);
  } else if (name === 'jelly') {
    noise(0, .25, 1.6, 850, 70, .006, 81);
    for (let n = 0; n < 5; n++) {
      const at = random() * .17;
      noise(at, .05, .5, 2100, 240);
      modes(at, .07, .1, [173 + random() * 110, 413]);
    }
  } else if (name === 'tangle') {
    noise(0, .32, .8, 3700, 320, .018, 217);
    noise(.003, .03, .4, 6200, 1500); mechanics(.05, .17);
  } else if (name === 'bubble' || name === 'duck') {
    // Air pressure and damped rubber/cavity resonances, without square-wave quacks.
    noise(0, .13, .8, 1800, 160, .003);
    modes(.007, .19, .25, name === 'bubble' ? [277, 433, 719] : [391, 623, 1087]);
    mechanics(.09, .12);
  } else if (name === 'fight' || name === 'round') {
    modes(0, .65, .27, name === 'fight' ? [131, 263, 397] : [196, 294, 491]);
    noise(0, .3, .5, 1300, 70);
  }
  // Consistent headroom and no DC/click at a clip boundary. Do not normalize each
  // clip: that would make quiet handling as loud as a shotgun or nuclear blast.
  let dc = 0;
  for (let i = 0; i < samples.length; i++) {
    dc += .002 * (samples[i] - dc);
    const fade = Math.min(1, i / (rate * .0003), (samples.length - 1 - i) / (rate * .01));
    samples[i] = Math.tanh((samples[i] - dc) * .8) * .86 * Math.max(0, fade);
  }
  return samples;
}
