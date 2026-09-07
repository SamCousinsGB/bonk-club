import { NUCLEAR } from "./impact.js";
import { segmentBox } from "./collision.js";
import { breakable } from "./maps.js";
import { W } from "./scale.js";
const sweeps = new WeakMap();

export function nuclearField(world, b) {
  const floors = world.platforms.filter(s => s.hp !== 0 && s.w >= 90);
  const strikes = Array.from({length: 6}, (_, n) => {
    const x = W * (n + 0.5) / 6;
    const floor = [...floors].sort((a, c) =>
      Math.abs(a.x + a.w / 2 - x) + Math.abs(a.y - b.y) * 0.3 -
      Math.abs(c.x + c.w / 2 - x) - Math.abs(c.y - b.y) * 0.3)[0];
    return { x: floor ? Math.max(floor.x + 20, Math.min(floor.x + floor.w - 20, x)) : x,
      y: floor ? floor.y - 8 : b.y, at: 1.1 + n * 0.36 };
  });
  return { kind: "shockwave", x: b.x, y: b.y, ex: b.x, ey: b.y,
    radius: NUCLEAR.waveRadius, life: NUCLEAR.duration, age: 0, owner: b.owner,
    hitIds: [], strikes, nextStrike: 0 };
}

export function updateNuclear(world, f, dt) {
  const previous = Math.min(f.radius, f.age * NUCLEAR.waveSpeed);
  f.age += dt;
  const radius = Math.min(f.radius, f.age * NUCLEAR.waveSpeed);
  if (world.phase !== "fight") return;
  const walls = world.platforms.filter(s => !s.destructible);
  for (const p of world.players) {
    const distance = Math.hypot(p.x - f.x, p.y - f.y);
    if (!p.alive || f.hitIds.includes(p.id) || distance < previous - 35 || distance > radius + 35) continue;
    f.hitIds.push(p.id);
    const shield = walls.some(s => segmentBox(f.x, f.y, p.x, p.y, s));
    const power = (1 - distance / (f.radius * 1.4)) * (shield ? 0.5 : 1);
    world.hit(p, {x:f.x, y:f.y, vx:0, vy:0}, 46 * power, 2400 * power,
      Math.sign(p.x - f.x) || 1, -0.46, {blast:true, stun:0.3, hitstop:0.012});
  }
  const swept = sweeps.get(f) || new WeakSet();
  sweeps.set(f, swept);
  for (const c of world.solids().filter(breakable)) {
    if (Math.hypot(c.x + c.w / 2 - f.x, c.y - f.y) > radius || swept.has(c)) continue;
    swept.add(c);
    world.damageCover(c, 240, Math.sign(c.x - f.x) * 2000, -1500);
  }
  for (const p of [...world.drops, ...world.debris, ...world.projectiles]) {
    const distance = Math.hypot(p.x - f.x, p.y - f.y);
    if (swept.has(p) || distance > radius + 35 || distance < previous - 35) continue;
    swept.add(p);
    const power = Math.max(0.25, 1 - distance / f.radius);
    p.vx += (Math.sign(p.x - f.x) || 1) * 1100 * power;
    p.vy -= 650 * power;
    p.support = null;
  }
  for (const ragdoll of world.ragdolls) {
    if (swept.has(ragdoll) || Math.hypot(ragdoll.points[0].x-f.x, ragdoll.points[0].y-f.y)>radius) continue;
    swept.add(ragdoll);
    for (const p of ragdoll.points) { p.px -= (Math.sign(p.x-f.x)||1)*9; p.py += 7; }
  }
  while (f.nextStrike < f.strikes.length && f.age >= f.strikes[f.nextStrike].at) {
    const s = f.strikes[f.nextStrike++];
    world.explode({ ...s, damage: 75, force: 1600, radius: 210, aftershock: true });
  }
}
