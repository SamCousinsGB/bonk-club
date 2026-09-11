import { segmentBox } from "./collision.js";
import { carryImpulse } from "./impact.js";
import { impulseRig } from "./puppet.js";

export const EXPANDED_WEAPONS = {
  hammer: { name: "SLEDGEHAMMER", kind: "melee", damage: 68, force: 1500,
    cooldown: .95, ammo: 6, range: 118, stun: .65, rarity: "uncommon", color: "#ffbf72" },
  crossbow: { name: "CROSSBOW", kind: "bolt", damage: 58, force: 560,
    cooldown: .75, ammo: 9, speed: 1750, recoil: 45, life: 1.4, r: 4,
    range: 1700, rarity: "uncommon", color: "#e7d0a2" },
  harpoon: { name: "HARPOON GUN", kind: "harpoon", damage: 28, force: 0,
    cooldown: 1.05, ammo: 6, speed: 1100, recoil: 80, life: .8, r: 5,
    range: 850, rarity: "rare", color: "#7aeee1" },
  shrapnel: { name: "SHRAPNEL CANNON", kind: "ricochet", damage: 16, force: 230,
    cooldown: 1.05, ammo: 5, speed: 1200, recoil: 460, life: .65, r: 4,
    count: 8, spread: .085, bounces: 2, dismember: true,
    range: 720, rarity: "rare", color: "#ffc48d" },
  firework: { name: "FIREWORK LAUNCHER", kind: "rocket", damage: 20, force: 400,
    cooldown: 1.2, ammo: 5, speed: 600, recoil: 180, life: 1.15, r: 8,
    radius: 90, range: 900, rarity: "rare", color: "#ff95ce" },
  cryo: { name: "CRYO GRENADE", kind: "grenade", damage: 22, force: 220,
    cooldown: 1.1, ammo: 3, speed: 450, lift: 580, life: 2.8, r: 9,
    radius: 210, chill: 1.4, recoil: 20, range: 1280,
    rarity: "rare", color: "#a2edff" },
};

const clear = (world, a, b) => !world.solids().some(s => segmentBox(a.x, a.y, b.x, b.y, s));

export function harpoonImpact(world, b, target) {
  const owner = world.players.find(p => p.id === b.owner && p.alive);
  const anchor = owner && { x: owner.x, y: owner.y - 10 };
  const contact = { x: target.x, y: target.y - 10 };
  if (!target.alive || !anchor || !clear(world, anchor, contact)) return;
  const dx = anchor.x - contact.x, dy = anchor.y - contact.y;
  const distance = Math.hypot(dx, dy) || 1;
  const vx = dx / distance * 1050, vy = dy / distance * 1050 - 160;
  target.vx = vx; target.vy = vy;
  target.ground = false; target.support = null;
  carryImpulse(target, .5);
  impulseRig(target, contact.x, contact.y, vx, vy);
  world.fields.push({ kind: "tether", ...anchor, ex: contact.x, ey: contact.y,
    radius: 0, life: .18, age: 0, owner: b.owner });
  world.fields = world.fields.slice(-12);
}

export function cryoBurst(world, b, freeze) {
  for (const p of world.players) {
    if (!p.alive || Math.hypot(p.x - b.x, p.y - b.y) >= b.radius ||
        !clear(world, b, { x: p.x, y: p.y - 10 })) continue;
    const hp = p.hp;
    world.hit(p, { x: b.x, y: b.y, vx: 0, vy: 0 }, b.damage, b.force,
      Math.sign(p.x - b.x) || 1, -.4,
      { blast: true, effect: "ice", weapon: "cryo", hitstop: .018 });
    freeze(world, b, p, p.hp < hp);
  }
  world.fields.push({ kind: "cryo", x: b.x, y: b.y, ex: b.x, ey: b.y,
    radius: b.radius, life: .55, age: 0, owner: b.owner });
  world.fields = world.fields.slice(-12);
  world.event("explosion", { x: b.x, y: b.y, radius: b.radius, weapon: "cryo" });
}

export function fireworkBurst(world, b) {
  // The child kind cannot create another burst. Both projectiles and art are bounded.
  for (let n = 0; n < 10; n++) {
    const angle = n * Math.PI * 2 / 10;
    world.projectiles.push({ x: b.x, y: b.y, vx: Math.cos(angle) * 620,
      vy: Math.sin(angle) * 620, owner: b.owner, weapon: "firework", kind: "spark",
      damage: 18, force: 200, life: .65, r: 4, bounces: 0, hitIds: [] });
  }
  world.fields.push({ kind: "firework", x: b.x, y: b.y, ex: b.x, ey: b.y,
    radius: 120, life: .45, age: 0, owner: b.owner });
  world.fields = world.fields.slice(-12);
}

export function validExpandedProjectile(p) {
  if (!Object.hasOwn(EXPANDED_WEAPONS, p.weapon) && !["bolt", "harpoon", "spark"].includes(p.kind)) return true;
  const w = EXPANDED_WEAPONS[p.weapon];
  if (!w || w.kind === "melee") return false;
  const spark = p.weapon === "firework" && p.kind === "spark";
  return (spark || p.kind === w.kind) && Number.isInteger(p.owner) && p.owner >= 0 && p.owner <= 3 &&
    p.r === (spark ? 4 : w.r) && p.life >= 0 && p.life <= (spark ? .65 : w.life) + .001 &&
    Math.abs(p.vx) <= 5000 && Math.abs(p.vy) <= 6000 &&
    Array.isArray(p.hitIds) && p.hitIds.length <= 4 && new Set(p.hitIds).size === p.hitIds.length &&
    p.hitIds.every(id => Number.isInteger(id) && id >= 0 && id <= 3);
}
