import { World, STEP, WEAPONS } from "./engine.js";
import { makeRig } from "./puppet.js";
import { prepareProp } from "./props.js";

// The original menu's small fighting arena. Its actors use the same bots,
// controls, ammunition, collisions and death effects as a match.
const ARENA = {
  city: true,
  towers: [{ x: 620, y: 160, w: 680, h: 710 }],
  platforms: [
    { x: 600, y: 155, w: 20, h: 473, material: "metal" },
    { x: 1300, y: 155, w: 20, h: 473, material: "metal" },
    { x: 620, y: 600, w: 680, h: 28, material: "metal" },
    { x: 645, y: 420, w: 205, h: 22, material: "metal" },
    { x: 1040, y: 430, w: 240, h: 22, material: "metal" },
    { x: 855, y: 260, w: 200, h: 20, material: "wood", panel: "wood", destructible: true, hp: 100, maxHp: 100 },
  ],
  spawns: [[730, 570], [1080, 570], [1180, 400], [735, 390]],
  weapons: [], spikes: [], hazards: [],
};
const GUNS = ["blaster", "shotgun", "smg", "tesla", "frost", "flame",
  "railgun", "plasma", "minigun", "crossbow", "harpoon", "shrapnel",
  "bubble", "boomerang", "jelly", "midas", "tangle"];
const MELEE = [null, "bat", "sword", "hammer"];
const shuffle = (values, random) => {
  const bag = [...values];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

class MenuWorld extends World {
  nextWeapon() {
    if (!this.menuWeapons?.length) this.menuWeapons = shuffle(GUNS, this.random);
    return this.menuWeapons.pop();
  }
  startRound() {
    super.startRound();
    this.arena = ARENA;
    this.platforms = ARENA.platforms.map((p, i) => ({ ...p,
      id: `menu-floor-${i}`, baseX: p.x, baseY: p.y, dx: 0, dy: 0 }));
    this.hazards = [];
    this.cover = [prepareProp({ id: "menu-table", kind: "table", x: 900, y: 557,
      w: 78, h: 43, hp: 65, maxHp: 65 })];
    this.players = this.ids.map(id => this.makePlayer(id));
    const loadout = shuffle([MELEE[(this.round - 1) % MELEE.length], this.nextWeapon(), this.nextWeapon()], this.random);
    const spawns = shuffle(ARENA.spawns.slice(0, 3), this.random);
    this.players.forEach((p, i) => {
      const [x, y] = spawns[i], weapon = loadout[i];
      Object.assign(p, { x, y, weapon, ammo: weapon ? WEAPONS[weapon].ammo : 0 });
      p.rig = makeRig(p);
    });
    this.drops = [];
    this.spawnWeapon();
    this.phase = "fight";
    this.weaponTimer = 2.5;
    this.ai.reset();
  }
  spawnWeapon() {
    const surfaces = this.platforms.filter(p => p.hp !== 0 && p.w > 120);
    if (!surfaces.length) return;
    const surface = surfaces[Math.floor(this.random() * surfaces.length)];
    const type = this.nextWeapon();
    this.drops.push({ ...this.pickupPosition({ x: surface.x + surface.w * (0.25 + this.random() * 0.5), y: surface.y - 60 }),
      type, ammo: WEAPONS[type].ammo, vx: 0, vy: 0, life: 16 });
    this.drops = this.drops.slice(-8);
  }
}

export class MenuFight {
  constructor(random = Math.random) {
    this.world = new MenuWorld({ players: [0, 1, 2], bots: [0, 1, 2], random, shuffle: false });
    this.accumulator = 0;
  }
  advance(dt, reduced = false) {
    if (!reduced && Number.isFinite(dt)) {
      this.accumulator += Math.max(0, Math.min(dt, 0.05));
      let steps = 0;
      while (this.accumulator + 1e-9 >= STEP && steps++ < 6) {
        this.world.step(STEP);
        this.accumulator = Math.max(0, this.accumulator - STEP);
        // Unobserved long-range shots need no retained history in menu play.
        this.world.projectiles = this.world.projectiles.filter(p => (p.age || 0) < 15);
      }
      // Keep the real elimination aftermath, without a match result screen.
      if (this.world.phase === "result") this.world.phaseTime = Math.min(this.world.phaseTime, 1.8);
    }
    return this.world.snapshot();
  }
}

export function menuFightCamera(width, height) {
  const portrait = width < 650 && height > width;
  const compact = height <= 600 && width > height;
  return {
    x: width * (portrait ? 0.51 : compact ? 0.76 : 0.7),
    y: height * (portrait ? 0.22 : 0.51),
    scale: portrait ? Math.min(width / 780, height * 0.31 / 480)
      : Math.min(width * (compact ? 0.48 : 0.6) / 760, height * 0.8 / 530, 1.65),
  };
}

export function menuFightVeil(ctx, width, height) {
  const portrait = width < 650 && height > width;
  const g = portrait ? ctx.createLinearGradient(0, height * 0.27, 0, height * 0.4)
    : ctx.createLinearGradient(0, 0, width * 0.53, 0);
  g.addColorStop(0, portrait ? "#15242100" : "#152421");
  g.addColorStop(1, portrait ? "#152421" : "#15242100");
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
}
