import { segmentBox } from "./collision.js";
import { W, H, RUN_SPEED } from "./scale.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const idle = () => ({
  left: false,
  right: false,
  jump: false,
  attack: false,
  block: false,
  throw: false,
  duck: false,
  aim: null,
});

// Build routes by tracing the same gravity, jump speeds and solid ceilings as players.
// Each edge records a launch point and a landing, including deliberate walk-offs.
export function navigation(platforms) {
  const graph = new Map(platforms.map((p) => [p.id, []]));
  for (const from of platforms) {
    const launches = new Set([
      from.x + 25,
      from.x + from.w - 25,
      from.x + from.w / 2,
    ]);
    for (let x = from.x + 45; x < from.x + from.w - 25; x += 70)
      launches.add(x);
    for (const to of platforms) {
      if (to === from || Math.abs(to.y - from.y) > 240) continue;
      for (const x of [
        to.x - 28,
        to.x - 85,
        to.x - 140,
        to.x + to.w + 28,
        to.x + to.w + 85,
        to.x + to.w + 140,
      ])
        if (x > from.x + 20 && x < from.x + from.w - 20) launches.add(x);
    }
    const best = new Map();
    for (const startX of launches)
      for (const dir of [-1, 1])
        for (const jumps of [1, 2]) {
          trace(startX, dir, jumps);
        }
    trace(from.x - 18, -1, 0);
    trace(from.x + from.w + 18, 1, 0);
    graph.set(from.id, [...best.values()]);
    function trace(startX, dir, jumps) {
      let x = startX,
        y = from.y - 30,
        vy = jumps ? -700 : 0,
        second = false;
      const dt = 1 / 40;
      for (let time = dt; time < 1.8; time += dt) {
        if (jumps === 2 && !second && time >= 0.32) {
          vy = -590;
          second = true;
        }
        const oldY = y;
        vy = Math.min(1150, vy + 1800 * dt);
        x += dir * RUN_SPEED * dt;
        y += vy * dt;
        if (x < 20 || x > W - 20 || y > H) return;
        for (const p of platforms) {
          if (
            x + 15 <= p.x ||
            x - 15 >= p.x + p.w ||
            y + 30 <= p.y ||
            y - 28 >= p.y + p.h
          )
            continue;
          if (vy >= 0 && oldY + 30 <= p.y + 3) {
            if (p === from || x < p.x + 12 || x > p.x + p.w - 12) return;
            const edge = {
              to: p.id,
              startX,
              endX: x,
              dir,
              jumps,
              duration: time,
              cost: time + Math.abs(startX - (from.x + from.w / 2)) / RUN_SPEED,
            };
            if (!best.has(p.id) || edge.cost < best.get(p.id).cost)
              best.set(p.id, edge);
          }
          return;
        }
      }
    }
  }
  return graph;
}

function surface(world, point) {
  return (
    world.platforms.find((p) => p.id === point.support) ||
    world.platforms
      .filter(
        (p) =>
          point.x >= p.x - 12 &&
          point.x <= p.x + p.w + 12 &&
          p.y >= point.y + 8,
      )
      .sort((a, b) => a.y - b.y)[0]
  );
}
function route(graph, from, to) {
  if (!from || !to || from === to) return null;
  const costs = new Map([[from, 0]]),
    first = new Map(),
    todo = new Set([from]);
  while (todo.size) {
    const current = [...todo].sort((a, b) => costs.get(a) - costs.get(b))[0];
    todo.delete(current);
    if (current === to) return first.get(current);
    for (const edge of graph.get(current) || []) {
      const cost = costs.get(current) + edge.cost;
      if (cost >= (costs.get(edge.to) ?? Infinity)) continue;
      costs.set(edge.to, cost);
      first.set(edge.to, first.get(current) || edge);
      todo.add(edge.to);
    }
  }
  return null;
}

export class BotController {
  constructor() {
    this.reset();
  }
  reset() {
    this.bots = new Map();
    this.graph = null;
    this.rebuildAt = 0;
  }
  forget(id) {
    this.bots.delete(id);
  }
  inputs(world, dt) {
    if (!this.graph || world.time >= this.rebuildAt) {
      this.graph = navigation(world.platforms);
      this.rebuildAt = world.time + 3;
    }
    const inputs = {};
    for (const p of world.players)
      if (p.bot && p.alive) {
        let brain = this.bots.get(p.id);
        if (!brain || brain.occupant !== p.occupant) {
          brain = {
            occupant: p.occupant,
            think: 0,
            x: p.x,
            stuck: 0,
            input: idle(),
            flight: null,
          };
          this.bots.set(p.id, brain);
        }
        brain.think -= dt;
        if (brain.think <= 0) {
          brain.think = 0.1 + p.id * 0.009;
          brain.stuck =
            Math.abs(p.x - brain.x) < 3 ? brain.stuck + brain.think : 0;
          brain.x = p.x;
          brain.input = this.decide(world, p, brain);
        }
        const input = { ...brain.input, jump: false };
        if (brain.flight) {
          const flight = brain.flight,
            age = world.time - flight.started;
          const desired = clamp((flight.endX - p.x) * 6, -RUN_SPEED, RUN_SPEED);
          input.left = desired < p.vx - 18;
          input.right = desired > p.vx + 18;
          input.jump =
            flight.jumps > 0 &&
            (age < 0.04 || (flight.jumps === 2 && age >= 0.32 && age < 0.37));
          if ((age > 0.18 && p.ground) || age > flight.duration + 0.5)
            brain.flight = null;
        } else if (brain.input.jump) {
          input.jump = !p.jumpHeld;
          brain.input.jump = false;
        }
        inputs[p.id] = input;
      }
    return inputs;
  }
  decide(world, p, brain) {
    const i = idle();
    const enemies = world.players
      .filter((q) => q.id !== p.id && q.alive)
      .sort((a, b) => distance(a, p) - distance(b, p));
    const enemy = enemies[0];
    if (!enemy) return i;
    const range = distance(p, enemy),
      ranged = p.weapon && !["bat", "sword"].includes(p.weapon);
    const speed =
      {
        blaster: 1300,
        shotgun: 1050,
        rocket: 680,
        grenade: 470,
        minigun: 1650,
        railgun: 4600,
        plasma: 850,
        barrage: 780,
      }[p.weapon] || 2000;
    const lead = ranged ? Math.min(0.45, range / speed) : 0;
    const aimX = enemy.x + enemy.vx * lead,
      aimY = enemy.y - 10 + enemy.vy * lead * 0.3;
    i.aim =
      Math.atan2(aimY - (p.y - 10), aimX - p.x) +
      Math.sin(world.time * 2 + p.id * 2) * (ranged ? 0.035 : 0);
    const clear = !world.platforms.some((s) =>
      segmentBox(p.x, p.y - 10, enemy.x, enemy.y - 10, s),
    );
    const explosive = ["rocket", "grenade", "barrage", "plasma"].includes(
      p.weapon,
    );
    i.attack =
      clear &&
      (ranged
        ? range < 1250 && (!explosive || range > 200)
        : range < (p.weapon ? 110 : 75));
    const threat = world.projectiles.find(
      (q) =>
        q.owner !== p.id &&
        distance(q, p) < 220 &&
        (p.x - q.x) * q.vx + (p.y - q.y) * q.vy > 0,
    );
    i.block =
      p.stamina > 25 &&
      (threat || (range < 90 && enemy.swing > 0)) &&
      Math.sin(world.time * 8 + p.id) > -0.3;
    if (i.block) {
      i.attack = false;
      i.aim = Math.atan2((threat || enemy).y - p.y, (threat || enemy).x - p.x);
    }
    if (explosive && range < 150) i.throw = true;
    const here = surface(world, p);
    let goal = enemy;
    if (!p.weapon && range > 150) {
      const drops = world.drops
        .filter((d) => !d.armed && d.ammo > 0)
        .sort((a, b) => distance(a, p) - distance(b, p));
      goal =
        drops.find((d) => {
          const dest = surface(world, d);
          return (
            distance(d, p) < Math.min(1200, range * 1.2) &&
            dest &&
            (dest.id === here?.id || route(this.graph, here?.id, dest.id))
          );
        }) || enemy;
    }
    const dest = surface(world, goal);
    let aim = goal.x;
    if (here && dest && here.id !== dest.id) {
      const edge = route(this.graph, here.id, dest.id);
      if (edge) {
        aim = edge.startX;
        if (p.ground && Math.abs(p.x - aim) < 12 && !brain.flight)
          brain.flight = { ...edge, started: world.time };
      } else {
        // Follow a lift or head to the nearest usable stair when its current position breaks a route.
        const options = this.graph.get(here.id) || [];
        const next = options.sort((a, b) => {
          const pa = world.platforms.find((p) => p.id === a.to),
            pb = world.platforms.find((p) => p.id === b.to);
          return (
            Math.abs(pa.y - dest.y) +
            Math.abs(a.endX - goal.x) * 0.4 -
            Math.abs(pb.y - dest.y) -
            Math.abs(b.endX - goal.x) * 0.4
          );
        })[0];
        if (next) {
          aim = next.startX;
          if (p.ground && Math.abs(p.x - aim) < 12 && !brain.flight)
            brain.flight = { ...next, started: world.time };
        } else aim = clamp(goal.x, here.x + 25, here.x + here.w - 25);
      }
    } else if (
      goal === enemy &&
      ranged &&
      clear &&
      range < 650 &&
      Math.abs(enemy.y - p.y) < 150
    ) {
      aim =
        range < (explosive ? 350 : 220)
          ? p.x - Math.sign(enemy.x - p.x) * 100
          : p.x;
      if (here) aim = clamp(aim, here.x + 30, here.x + here.w - 30);
    }
    i.left = aim < p.x - 12;
    i.right = aim > p.x + 12;
    const dir = Number(i.right) - Number(i.left);
    const obstacle = world.cover.find(
      (c) =>
        c.hp > 0 &&
        Math.abs(c.x + c.w / 2 - p.x) < c.w / 2 + 65 &&
        (c.x + c.w / 2 - p.x) * dir > 0 &&
        p.y + 30 > c.y &&
        p.y - 28 < c.y + c.h,
    );
    if (obstacle) {
      i.attack = true;
      i.aim = Math.atan2(
        obstacle.y + obstacle.h / 2 - p.y,
        obstacle.x + obstacle.w / 2 - p.x,
      );
      i.jump = p.ground && obstacle.h < 100;
    }
    if (brain.stuck > 0.7 && dir && p.ground) {
      i.jump = true;
      brain.stuck = 0;
    }
    if (
      !p.ground &&
      !brain.flight &&
      p.jumps === 1 &&
      p.vy > -120 &&
      (goal.y < p.y - 50 || p.y > H - 100)
    )
      i.jump = true;
    const hazard = world.hazards.find(
      (h) =>
        p.x > h.x - h.w / 2 - 40 &&
        p.x < h.x + h.w / 2 + 40 &&
        p.y + 30 > h.y - h.h &&
        p.y - 28 < h.y,
    );
    if (hazard) {
      brain.flight = null;
      let escape = p.x < hazard.x ? -1 : 1;
      if (here && p.x + escape * 80 < here.x + 15) escape = 1;
      if (here && p.x + escape * 80 > here.x + here.w - 15) escape = -1;
      i.left = escape < 0;
      i.right = escape > 0;
      i.block = false;
      i.jump =
        p.ground &&
        hazard.warning === 0 &&
        ["electric", "lava"].includes(hazard.type);
    }
    return i;
  }
}
