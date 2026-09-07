import { segmentBox } from "./collision.js";
import { breakable } from "./maps.js";

const clear = (world, a, b) =>
  !world.solids().some((s) => segmentBox(a.x, a.y, b.x, b.y, s));
export function steerSpecial(world, b, dt) {
  if (b.homing) {
    const target = world.players
      .filter((p) => p.alive && p.id !== b.owner && clear(world, b, p))
      .sort(
        (a, c) =>
          Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y),
      )[0];
    if (target) {
      const current = Math.atan2(b.vy, b.vx),
        goal = Math.atan2(target.y - b.y, target.x - b.x);
      const delta = Math.atan2(
        Math.sin(goal - current),
        Math.cos(goal - current),
      );
      const angle = current + Math.max(-1.8 * dt, Math.min(1.8 * dt, delta));
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
    }
  }
  if (b.kind === "force") {
    for (const other of world.projectiles) {
      if (other === b || other.owner === b.owner || other.kind === "force")
        continue;
      if (
        Math.hypot(other.x - b.x, other.y - b.y) < 65 &&
        clear(world, b, other)
      ) {
        other.owner = b.owner;
        const angle = Math.atan2(b.vy, b.vx),
          speed = Math.max(600, Math.hypot(other.vx, other.vy));
        other.vx = Math.cos(angle) * speed;
        other.vy = Math.sin(angle) * speed;
      }
    }
  }
}

export function impactSpecial(world, b, target, hurt) {
  if (!hurt) return;
  if (b.burn) target.burn = Math.max(target.burn || 0, b.burn);
  if (b.chill) target.chill = Math.max(target.chill || 0, b.chill);
  if (b.kind !== "tesla") return;
  const hit = new Set([b.owner, target.id]);
  let from = target;
  for (let hop = 0; hop < 2; hop++) {
    const next = world.players
      .filter(
        (p) =>
          p.alive &&
          !hit.has(p.id) &&
          Math.hypot(p.x - from.x, p.y - from.y) < 240 &&
          clear(world, from, p),
      )
      .sort(
        (a, c) =>
          Math.hypot(a.x - from.x, a.y - from.y) -
          Math.hypot(c.x - from.x, c.y - from.y),
      )[0];
    if (!next) break;
    world.fields.push({
      kind: "arc",
      x: from.x,
      y: from.y - 10,
      ex: next.x,
      ey: next.y - 10,
      radius: 0,
      life: 0.16,
      owner: b.owner,
    });
    world.hit(
      next,
      { x: from.x, y: from.y, vx: 0, vy: 0 },
      b.damage * (0.75 - hop * 0.15),
      b.force,
      Math.sign(next.x - from.x) || 1,
      -0.2,
      { projectile: true, stun: 0.09 },
    );
    hit.add(next.id);
    from = next;
  }
}

export function expireSpecial(world, b) {
  if (b.kind === "singularity") {
    world.fields.push({
      kind: "blackhole",
      x: b.x,
      y: b.y,
      ex: b.x,
      ey: b.y,
      radius: b.radius,
      life: 4.5,
      owner: b.owner,
      age: 0,
      tick: 0,
    });
    world.fields = world.fields.slice(-12);
  }
  if (b.cluster) {
    for (let n = 0; n < 6; n++) {
      const a = -Math.PI + (n * Math.PI) / 5;
      world.projectiles.push({
        x: b.x,
        y: b.y - 8,
        vx: Math.cos(a) * 330,
        vy: Math.sin(a) * 400 - 220,
        owner: b.owner,
        kind: "grenade",
        weapon: "cluster",
        damage: 34,
        force: 650,
        life: 0.4 + n * 0.055,
        radius: 115,
        r: 5,
        bounces: 0,
        hitIds: [],
      });
    }
  }
}

export function updateFields(world, dt) {
  for (const f of world.fields) {
    f.life -= dt;
    if (f.kind !== "blackhole") continue;
    f.age += dt;
    if (f.age < 0.4) continue;
    f.tick -= dt;
    const pulse = f.tick <= 0;
    if (pulse) f.tick = 0.25;
    for (const p of [
      ...world.players.filter((p) => p.alive),
      ...world.drops,
      ...world.projectiles,
    ]) {
      const dx = f.x - p.x,
        dy = f.y - p.y,
        d = Math.hypot(dx, dy);
      if (d > f.radius || !clear(world, f, p)) continue;
      const pull = (1 - d / f.radius) * 2800 * dt;
      p.vx += (dx / Math.max(d, 18)) * pull;
      p.vy += (dy / Math.max(d, 18)) * pull;
      if (p.id !== undefined && pulse && d < 100) {
        p.hp = Math.max(0, p.hp - (d < 38 ? 22 : 9));
        p.flash = 0.09;
        if (p.hp <= 0) world.kill(p);
      }
    }
    if (pulse)
      for (const s of world.solids().filter(breakable)) {
        const x = Math.max(s.x, Math.min(s.x + s.w, f.x)),
          y = Math.max(s.y, Math.min(s.y + s.h, f.y));
        if (Math.hypot(x - f.x, y - f.y) < 125)
          world.damageCover(s, 16, Math.sign(f.x - x) * 200, -100);
      }
  }
  world.fields = world.fields.filter((f) => f.life > 0).slice(-12);
}
