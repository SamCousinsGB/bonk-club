import { segmentBox, playerBox } from "./collision.js";
import { JOINTS } from "./puppet.js";
import { passiveBody } from "./body-physics.js";

export const BLOOD_LIMIT = 144;
export function bloodBurst(world, x, y, vx = 0, vy = -120, count = 18) {
  for (let n = 0; n < count; n++) {
    const a = world.random() * Math.PI * 2,
      speed = 35 + world.random() * 190;
    world.blood.push({
      x,
      y,
      vx: vx * 0.28 + Math.cos(a) * speed,
      vy: vy * 0.3 + Math.sin(a) * speed - 80,
      r: 1.2 + world.random() * 2.2,
      life: 5 + world.random() * 2,
      landed: false,
    });
  }
  world.blood = world.blood.slice(-BLOOD_LIMIT);
}
export function updateBlood(world, dt) {
  if (!world.blood.length) return;
  const solids = world.solids();
  for (const b of world.blood) {
    b.life -= dt;
    if (b.landed) {
      const support = solids.find((s) => s.id === b.support);
      if (support) {
        b.x += support.dx || 0;
        b.y += support.dy || 0;
        continue;
      }
      b.landed = false;
    }
    const x = b.x,
      y = b.y;
    b.vy += 800 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let hit;
    for (const s of solids) {
      const h = segmentBox(x, y, b.x, b.y, s);
      if (h && (!hit || h.t < hit.h.t)) hit = { s, h };
    }
    if (hit) {
      b.x = x + (b.x - x) * hit.h.t;
      b.y = y + (b.y - y) * hit.h.t;
      b.vx = b.vy = 0;
      b.landed = true;
      b.support = hit.s.id;
    }
  }
  world.blood = world.blood
    .filter((b) => b.life > 0 && b.y < 1600)
    .slice(-BLOOD_LIMIT);
}
export function spikeBase(s, i) {
  return {
    id: `spikes${i}`,
    x: s.x,
    y: s.y + 2,
    w: s.w,
    h: 8,
    baseX: s.x,
    baseY: s.y + 2,
    dx: 0,
    dy: 0,
    spike: true,
  };
}
export function impale(world, p, s) {
  if (!p.alive) return;
  const box = playerBox(p),
    sweepY = p.spikeY ?? box.y;
  if (
    box.x + box.w < s.x ||
    box.x > s.x + s.w ||
    (box.y > s.y + 12 && sweepY > s.y + 12) ||
    Math.max(box.y + box.h, sweepY) < s.y - 20
  )
    return;
  const tipX = Math.max(
    s.x + 10,
    Math.min(s.x + s.w - 10, s.x + Math.floor((p.x - s.x) / 20) * 20 + 10),
  );
  const y = s.y - 12;
  world.kill(p, { effect: "impale" });
  const rag = world.ragdolls.at(-1);
  let point = 0;
  for (let n = 1; n < rag.points.length; n++)
    if (
      Math.hypot(rag.points[n].x - tipX, rag.points[n].y - y) <
      Math.hypot(rag.points[point].x - tipX, rag.points[point].y - y)
    )
      point = n;
  rag.anchor = { point, x: tipX, y };
  rag.life = 6;
  rag.bleed = 0;
  bloodBurst(world, tipX, y, p.vx, p.vy, 26);
}
export function updateImpaled(world, rag, dt) {
  const a = rag.anchor;
  if (
    !a ||
    !world
      .spikes()
      .some(
        (s) => a.x >= s.x && a.x <= s.x + s.w && Math.abs(a.y - (s.y - 12)) < 1,
      )
  ) {
    delete rag.anchor;
    delete rag.effect;
    delete rag.deathAge;
    return false;
  }
  rag.bleed = (rag.bleed || 0) - dt;
  if (rag.deathAge < 2.3 && rag.bleed <= 0) {
    bloodBurst(world, a.x, a.y, 0, 110, 2);
    rag.bleed = 0.15;
  }
  passiveBody(rag.points, JOINTS, world.solids(), dt, { anchor: a });
  return true;
}
export function drawBlood(r, blood) {
  const c = r.ctx;
  c.save();
  for (const b of blood || []) {
    c.globalAlpha = Math.min(1, b.life * 0.8);
    const color = b.landed ? "#721e35" : "#e4485b";
    if (b.landed)
      r.line(
        [
          [b.x - b.r * 1.5, b.y],
          [b.x + b.r * 1.5, b.y],
        ],
        color,
        b.r,
      );
    else {
      r.line(
        [
          [b.x - b.vx * 0.015, b.y - b.vy * 0.015],
          [b.x, b.y],
        ],
        "#972840",
        b.r * 1.4,
      );
      r.circle(b.x, b.y, b.r, color);
    }
  }
  c.restore();
}
