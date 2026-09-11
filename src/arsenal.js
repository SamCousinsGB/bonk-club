import { NUCLEAR } from "./impact.js";
import { EXPANDED_WEAPONS } from "./expanded-weapons.js";
import { TRANSMUTATION_WEAPONS } from "./transmutation.js";
const original = {
  bat: {
    name: "BAT",
    range: 112,
    damage: 55,
    force: 950,
    cooldown: 0.56,
    ammo: 8,
    kind: "melee",
  },
  sword: {
    name: "SWORD",
    range: 128,
    damage: 42,
    force: 680,
    cooldown: 0.38,
    ammo: 12,
    kind: "melee",
  },
  blaster: {
    name: "PISTOL",
    damage: 24,
    force: 440,
    cooldown: 0.25,
    ammo: 14,
    kind: "bullet",
    speed: 1300,
  },
  shotgun: {
    name: "SHOTGUN",
    damage: 15,
    force: 300,
    cooldown: 0.85,
    ammo: 5,
    kind: "pellet",
    speed: 1050,
    alt: {
      label: "DOUBLE SHOT",
      description: "Fire both shotgun barrels; uses two shells",
      count: 10,
      spread: 0.075,
      recoil: 420,
      cooldown: 1.25,
      ammoCost: 2,
    },
  },
  rocket: {
    name: "ROCKET LAUNCHER",
    damage: 100,
    force: 1600,
    radius: 205,
    cooldown: 1.1,
    ammo: 3,
    kind: "rocket",
    speed: 680,
    recoil: 560,
  },
  grenade: {
    name: "GRENADE",
    damage: 95,
    force: 1550,
    radius: 215,
    cooldown: 0.9,
    ammo: 4,
    kind: "grenade",
    speed: 450,
    lift: 580,
    life: 2.8,
    range: 1280,
    recoil: 20,
  },
  minigun: {
    name: "MINIGUN",
    damage: 13,
    force: 250,
    cooldown: 0.075,
    ammo: 80,
    kind: "bullet",
    speed: 1650,
    recoil: 180,
    spread: 0.045,
  },
  railgun: {
    name: "RAILGUN",
    damage: 160,
    force: 1550,
    cooldown: 1.25,
    ammo: 4,
    kind: "rail",
    speed: 4600,
    recoil: 720,
  },
  plasma: {
    name: "PLASMA CANNON",
    damage: 72,
    force: 1200,
    cooldown: 0.65,
    ammo: 7,
    kind: "plasma",
    speed: 850,
    recoil: 280,
    radius: 155,
    alt: {
      label: "CHARGED SHOT",
      description: "Fire a charged plasma orb; uses two rounds",
      damage: 110,
      force: 1550,
      radius: 205,
      bounces: 4,
      recoil: 440,
      speed: 720,
      cooldown: 1.2,
      ammoCost: 2,
      r: 15,
    },
  },
  barrage: {
    name: "TRIPLE ROCKET LAUNCHER",
    damage: 76,
    force: 1500,
    cooldown: 1.6,
    ammo: 3,
    kind: "rocket",
    speed: 780,
    recoil: 760,
    count: 3,
    radius: 215,
  },
};

export const COMBO = [
  {
    move: "punch",
    range: 82,
    damage: 25,
    force: 210,
    cooldown: 0.22,
    duration: 0.22,
    boost: 300,
    stun: 0.14,
  },
  {
    move: "kick",
    range: 103,
    damage: 32,
    force: 280,
    cooldown: 0.28,
    duration: 0.28,
    boost: 340,
    stun: 0.19,
  },
  {
    move: "spin",
    range: 112,
    damage: 43,
    force: 820,
    cooldown: 0.62,
    duration: 0.38,
    boost: 390,
    stun: 0.38,
  },
];
const additions = {
  bubble: {
    name: "BUBBLE GUN", kind: "bubble", damage: 14, force: 60,
    cooldown: .55, ammo: 10, speed: 660, life: 1.4, r: 14,
    recoil: 12, rarity: "rare", range: 900, color: "#b2edff",
  },
  boomerang: {
    name: "BOOMERANG", kind: "boomerang", damage: 38, force: 420,
    cooldown: .9, ammo: 7, speed: 780, life: 2.4, r: 14, bounces: 3,
    recoil: 35, rarity: "rare", range: 650, color: "#ffce87",
  },
  duck: {
    name: "RUBBER DUCK LAUNCHER", kind: "duck", damage: 76, force: 1450,
    cooldown: 1.05, ammo: 5, speed: 610, life: 2.2, r: 14, bounces: 8,
    radius: 175, recoil: 180, rarity: "exotic", range: 1000, color: "#ffe665",
  },
  phaser: {
    name: "PHASER CANNON",
    kind: "phaser",
    damage: 38,
    force: 150,
    cooldown: 1.8,
    ammo: 2,
    speed: 12000,
    range: 3500,
    radius: 72,
    flare: 150,
    life: .42,
    recoil: 90,
    rarity: "exotic",
    color: "#89ffce",
  },
  nuke: {
    name: "NUCLEAR GRENADE",
    kind: "grenade",
    damage: 260,
    force: 3000,
    cooldown: 1.5,
    ammo: 1,
    speed: 450,
    lift: 580,
    life: 2.8,
    radius: NUCLEAR.coreRadius,
    recoil: 25,
    nuclear: true,
    rarity: "exotic",
    range: 1280,
    color: "#ffe77b",
    r: 12,
  },
  smg: {
    name: "SMG",
    kind: "bullet",
    damage: 12,
    force: 145,
    cooldown: 0.065,
    ammo: 60,
    speed: 1400,
    recoil: 12,
    spread: 0.14,
    rarity: "common",
    range: 700,
  },
  burst: {
    name: "BURST RIFLE",
    kind: "bullet",
    damage: 17,
    force: 210,
    cooldown: 0.3,
    ammo: 20,
    speed: 1750,
    count: 3,
    spread: 0.035,
    recoil: 45,
    rarity: "uncommon",
    range: 1100,
  },
  flame: {
    name: "FLAMETHROWER",
    kind: "flame",
    damage: 10,
    force: 50,
    cooldown: 0.055,
    ammo: 80,
    speed: 950,
    recoil: 3,
    spread: 0.16,
    life: 0.85,
    burn: 1,
    rarity: "uncommon",
    range: 800,
    color: "#ff9447",
  },
  frost: {
    name: "FREEZE RAY",
    kind: "frost",
    damage: 12,
    force: 105,
    cooldown: 0.12,
    ammo: 32,
    speed: 1250,
    recoil: 10,
    chill: 1.4,
    rarity: "uncommon",
    range: 700,
    color: "#a9f4ff",
  },
  ricochet: {
    name: "RICOCHET GUN",
    kind: "ricochet",
    damage: 34,
    force: 470,
    cooldown: 0.28,
    ammo: 16,
    speed: 1450,
    recoil: 35,
    bounces: 6,
    life: 3,
    rarity: "uncommon",
    range: 1100,
    color: "#ffb6ea",
  },
  saw: {
    name: "SAWBLADE LAUNCHER",
    kind: "saw",
    damage: 160,
    force: 650,
    cooldown: 0.65,
    ammo: 7,
    speed: 800,
    recoil: 65,
    bounces: 3,
    life: 3,
    rarity: "rare",
    range: 950,
    color: "#edf3f7",
  },
  tesla: {
    name: "TESLA GUN",
    kind: "tesla",
    damage: 48,
    force: 400,
    cooldown: 0.45,
    ammo: 10,
    speed: 2200,
    recoil: 30,
    rarity: "rare",
    range: 850,
    color: "#bbabff",
  },
  homing: {
    name: "HOMING LAUNCHER",
    kind: "rocket",
    damage: 85,
    force: 1400,
    cooldown: 1.1,
    ammo: 4,
    speed: 530,
    recoil: 320,
    homing: true,
    radius: 195,
    rarity: "rare",
    range: 1400,
    color: "#ffb79c",
  },
  cluster: {
    name: "CLUSTER LAUNCHER",
    kind: "grenade",
    damage: 48,
    force: 1100,
    cooldown: 1.3,
    ammo: 3,
    speed: 490,
    recoil: 260,
    cluster: true,
    radius: 170,
    rarity: "rare",
    range: 650,
    color: "#ffe796",
  },
  machinegun: {
    name: "HEAVY MACHINE GUN",
    kind: "bullet",
    damage: 24,
    force: 220,
    cooldown: 0.055,
    ammo: 100,
    speed: 2100,
    recoil: 0,
    spread: 0.018,
    proneOnly: true,
    rarity: "rare",
    range: 1600,
    color: "#f8c66e",
  },
  repulsor: {
    name: "REPULSOR",
    kind: "force",
    damage: 28,
    force: 2200,
    cooldown: 0.6,
    ammo: 6,
    speed: 1050,
    recoil: 380,
    life: 0.32,
    rarity: "rare",
    range: 330,
    color: "#8bffe0",
  },
  blackhole: {
    name: "BLACK HOLE GENERATOR",
    kind: "singularity",
    damage: 14,
    force: 0,
    cooldown: 1.7,
    ammo: 2,
    speed: 760,
    recoil: 300,
    life: 1.05,
    radius: 620,
    rarity: "exotic",
    range: 950,
    color: "#c6a1ff",
  },
};
const rarity = {
  bat: "common",
  sword: "common",
  blaster: "common",
  shotgun: "common",
  grenade: "uncommon",
  rocket: "uncommon",
  minigun: "uncommon",
  plasma: "rare",
  railgun: "rare",
  barrage: "exotic",
};
export const WEAPONS = Object.fromEntries(
  Object.entries({ ...original, ...additions, ...EXPANDED_WEAPONS, ...TRANSMUTATION_WEAPONS }).map(([key, w]) => [
    key,
    { rarity: rarity[key] || w.rarity, dismember: ["minigun","machinegun","shotgun"].includes(key), ...w, ...(w.kind === "melee" ? { boost: 260 } : {}) },
  ]),
);
export const RARITY_COLORS = {
  common: "#cfdbb3",
  uncommon: "#76dac4",
  rare: "#90bbff",
  exotic: "#daa1ff",
};
export function secondaryAction(player) {
  if (!player?.alive) return null;
  return player.weapon
    ? WEAPONS[player.weapon]?.alt || null
    : {
        label: "PARRY",
        description: "Tap to parry one hit. Release and wait for the cooldown before trying again",
      };
}
export function firingRecoil(weapon, player) {
  if (weapon.proneOnly && player.prone && player.ground) return 0;
  return (
    weapon.recoil ??
    (weapon.kind === "pellet" ? 380 : weapon.kind === "melee" ? 0 : 150)
  );
}
// Non-featured pickups use weighted tiers and avoid duplicate weapons when possible.
export function chooseWeapon(random = Math.random, exclude = new Set()) {
  const roll = random();
  const tier =
    roll < 0.4
      ? "common"
      : roll < 0.72
        ? "uncommon"
        : roll < 0.92
          ? "rare"
          : "exotic";
  let pool = Object.keys(WEAPONS).filter(
    (k) => WEAPONS[k].rarity === tier && !exclude.has(k),
  );
  if (!pool.length) pool = Object.keys(WEAPONS).filter((k) => !exclude.has(k));
  if (!pool.length) pool = Object.keys(WEAPONS);
  if (pool.includes("nuke")) pool.push("nuke");
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
export const PROJECTILE_KINDS = [
  "spark",
  ...new Set(
    Object.values(WEAPONS)
      .filter((w) => w.kind !== "melee")
      .map((w) => w.kind),
  ),
];

// Keep the featured rotation between rounds so brief fights still expose the arsenal.
export class WeaponRotation {
  constructor(random = Math.random) {
    this.random = random;
    this.bag = [];
  }
  next() {
    if (!this.bag.length) {
      this.bag = Object.keys(WEAPONS).filter(
        (k) => k !== "nuke" && ["rare", "exotic"].includes(WEAPONS[k].rarity),
      );
      for (let n = this.bag.length - 1; n > 0; n--) {
        const i = Math.floor(this.random() * (n + 1));
        [this.bag[n], this.bag[i]] = [this.bag[i], this.bag[n]];
      }
    }
    return this.bag.pop();
  }
  opening(round) {
    return [round % 3 === 1 ? "nuke" : this.next(), this.next()];
  }
}

// Ranged base damage stays useful at distance; close contact adds a bounded bonus.
// Travelled distance includes bounces, so reflected rounds do not regain the bonus.
export function projectileImpact(projectile, distance = 0) {
  const w = WEAPONS[projectile.weapon];
  const bonus = w && ["bullet","pellet","flame","frost"].includes(w.kind)
    ? (w.kind === "pellet" ? 0.45 : 0.3) * Math.max(0,1-distance/(w.kind === "pellet" ? 320 : 260)) : 0;
  return {damage:projectile.damage*(1+bonus),force:projectile.force*(1+bonus*0.65)};
}
