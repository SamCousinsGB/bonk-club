import { segmentBox, playerBox } from "./collision.js";
import { impulseRig } from "./puppet.js";
import { breakable } from "./maps.js";
export const HAZARD_TYPES = [
  "rockfall",
  "cargo",
  "lightning",
  "gust",
  "gas",
  "steam",
  "electric",
  "lava",
];
export const HAZARD_LABELS = {
  rockfall: "Falling rocks",
  cargo: "Falling cargo",
  lightning: "Lightning",
  gust: "Strong wind",
  gas: "Gas leak",
  steam: "Steam vent",
  electric: "Electrical fault",
  lava: "Lava vent",
};
const overlaps = (a, b) =>
  a.x + a.w > b.x && a.x < b.x + b.w && a.y + a.h > b.y && a.y < b.y + b.h;
const choose = (w, items) =>
  items[Math.min(items.length - 1, Math.floor(w.random() * items.length))];

export function spawnHazard(w) {
  if (w.hazards.length >= 3) return null;
  const candidates = w.platforms.filter(
    (p) => p.hp !== 0 && p.w >= 240 && !p.elevator && !p.move,
  );
  if (!candidates.length) return null;
  const surface = choose(w, candidates),
    type = choose(w, w.arena.hazards || ["rockfall", "gust"]);
  const width =
    type === "gust"
      ? 300
      : type === "gas"
        ? 240
        : type === "rockfall" || type === "cargo"
          ? 100
          : 140;
  const span = Math.min(width, surface.w - 30);
  const x =
    surface.x + 15 + span / 2 + w.random() * Math.max(0, surface.w - 30 - span);
  // The entire zone stays in this room. Floors above shield other storeys.
  const ceiling = Math.max(
    18,
    surface.y - 300,
    ...w.platforms
      .filter(
        (p) =>
          p.hp !== 0 &&
          p !== surface &&
          p.y < surface.y - 40 &&
          p.x < x + span / 2 &&
          p.x + p.w > x - span / 2,
      )
      .map((p) => p.y + p.h),
  );
  const available = surface.y - ceiling - 18;
  if (available < 80) return null;
  const h = Math.min(type === "electric" ? 70 : 280, available);
  const hazard = {
    id: ++w.nextHazard,
    support: surface.id,
    type,
    x,
    y: surface.y,
    w: span,
    h,
    warning: 2,
    age: 0,
    duration:
      type === "lightning"
        ? 0.55
        : type === "rockfall" || type === "cargo"
          ? 3.5
          : 5,
    bodyY: surface.y - h + 26,
    vy: 0,
    dir: w.random() < 0.5 ? -1 : 1,
    done: false,
    hitIds: [],
  };
  w.hazards.push(hazard);
  w.event("hazard", { x, y: surface.y, kind: type });
  return hazard;
}
function hurt(w, p, h, damage, vx = 0, vy = 0) {
  p.hp = Math.max(0, p.hp - damage);
  p.flash = 0.12;
  if (vx || vy) {
    p.vx += vx;
    p.vy = Math.min(p.vy, vy);
    p.ground = false;
    p.support = null;
    p.stun = Math.max(p.stun, 0.15);
    impulseRig(p, p.x, p.y, vx, vy);
  }
  if (damage >= 10)
    w.event("hit", {
      x: p.x,
      y: p.y,
      color: "#ffb277",
      force: Math.abs(vx) + Math.abs(vy),
    });
  if (p.hp <= 0) w.kill(p);
}
export function updateHazards(w, dt) {
  if (w.phase !== "fight") return;
  w.hazardTimer -= dt;
  if (w.hazardTimer <= 0) {
    spawnHazard(w);
    w.hazardTimer = 7 + w.random() * 7;
  }
  w.hazards = w.hazards.filter(
    (h) =>
      !h.support || w.platforms.some((p) => p.id === h.support && p.hp !== 0),
  );
  for (const h of w.hazards) {
    if (h.warning > 0) {
      h.warning = Math.max(0, h.warning - dt);
      continue;
    }
    h.age += dt;
    if (h.done || h.age > h.duration) continue;
    if (h.type === "rockfall" || h.type === "cargo") {
      const oldY = h.bodyY;
      h.vy += 1250 * dt;
      const endY = oldY + h.vy * dt;
      const hits = w
        .solids()
        .map((s) => ({ s, hit: segmentBox(h.x, oldY, h.x, endY, s, 26) }))
        .filter((c) => c.hit)
        .sort((a, b) => a.hit.t - b.hit.t);
      const stop = hits[0]?.hit.t ?? 1;
      for (const p of w.players)
        if (p.alive && !h.hitIds.includes(p.id)) {
          const hit = segmentBox(h.x, oldY, h.x, endY, playerBox(p), 26);
          if (hit && hit.t <= stop) {
            hurt(w, p, h, 38, Math.sign(p.x - h.x || h.dir) * 330, -220);
            h.hitIds.push(p.id);
          }
        }
      h.bodyY = oldY + (endY - oldY) * stop;
      if (hits.length) {
        if (breakable(hits[0].s)) w.damageCover(hits[0].s, 120);
        h.done = true;
        h.duration = h.age + 0.45;
        w.event("break", { x: h.x, y: h.bodyY, color: "#af9c85" });
      }
      continue;
    }
    const zone = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
    for (const p of w.players) {
      if (!p.alive || !overlaps(playerBox(p), zone)) continue;
      if (h.type === "gust") {
        const push = h.dir * (p.prone ? 85 : p.block ? 180 : 480) * dt;
        p.vx += push;
        impulseRig(p, p.x, p.y, push * 8, -10 * dt);
      } else if (h.type === "gas") hurt(w, p, h, 11 * dt);
      else if (h.type === "lightning") {
        if (!h.hitIds.includes(p.id)) {
          hurt(w, p, h, 34, h.dir * 190, -260);
          h.hitIds.push(p.id);
        }
      } else if (h.type === "electric") {
        // Alternating pulses leave gaps for a timed crossing or jump.
        if (h.age % 1 < 0.45 && p.y + (p.prone ? 10 : 30) > h.y - 70)
          hurt(w, p, h, 24 * dt);
      } else if (h.type === "steam" || h.type === "lava") {
        if (h.age % 1.4 < 0.85) {
          hurt(w, p, h, (h.type === "lava" ? 22 : 8) * dt);
          p.vy = Math.min(p.vy, -(h.type === "lava" ? 520 : 620));
          p.ground = false;
          p.support = null;
        }
      }
    }
  }
  w.hazards = w.hazards.filter((h) => h.age < h.duration);
}
