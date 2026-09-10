import { dangerous, hazardZone } from "./hazards.js";
import { W, H, RUN_SPEED, JUMP_SPEED, AIR_JUMP_SPEED } from "./scale.js";

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const steer = (p, x) => {
  const speed = clamp((x - p.x) * 6, -RUN_SPEED, RUN_SPEED);
  return { left: speed < p.vx - 20, right: speed > p.vx + 20 };
};
export function predictedSurface(p, time) {
  return {
    ...p,
    x: p.move ? p.baseX + Math.sin(time * p.speed) * p.move : p.x,
    y: p.travel
      ? p.baseY +
        ((1 - Math.cos(time * p.speed + (p.phase || 0))) * p.travel) / 2
      : p.y,
  };
}
export function surfaceAt(solids, point) {
  return (
    solids.find((s) => s.id === point.support) ||
    solids
      .filter(
        (s) =>
          point.x > s.x - 12 && point.x < s.x + s.w + 12 && s.y >= point.y + 8,
      )
      .sort((a, b) => a.y - b.y)[0]
  );
}

// Start from rest, as the executor does. Trace acceleration, the full standing body,
// both jumps and moving surfaces. A head/side collision invalidates the route.
export function traceFlight(
  solids,
  from,
  startX,
  dir,
  jumps,
  secondAt = 0.38,
  time = 0,
  spikes = [],
  initialVx = 0,
  landingX = null,
) {
  let x = startX,
    y = from.y - 30,
    vx = initialVx,
    vy = jumps ? -JUMP_SPEED : 0,
    second = false,
    ground = !jumps,
    clearAt = jumps ? 0 : null;
  const dt = 1 / 60;
  const nearby = solids.filter(
    (p) =>
      (p.hp !== 0 &&
        p.x + p.w > startX - 470 &&
        p.x < startX + 470 &&
        p.y + p.h > from.y - 285 &&
        p.y < from.y + 950) ||
      p.travel ||
      p.move,
  );
  for (let age = dt; age < 1.75; age += dt) {
    if (jumps === 2 && !second && age >= secondAt) {
      vy = -AIR_JUMP_SPEED;
      second = true;
      ground = false;
    }
    if (clearAt === null && (x + 15 < from.x || x - 15 > from.x + from.w))
      clearAt = age;
    const input =
      landingX !== null && clearAt !== null ? steer({ x, vx }, landingX) : null;
    const move = input ? Number(input.right) - Number(input.left) : dir;
    if (move)
      vx +=
        move *
        Math.min(
          (ground ? 1500 : 950) * dt,
          Math.max(0, RUN_SPEED - vx * move),
        );
    else vx *= Math.pow(ground ? 0.86 : 0.996, dt * 120);
    const oldY = y;
    vy = Math.min(1150, vy + 1800 * dt);
    x += vx * dt;
    y += vy * dt;
    ground = false;
    if (x < 18 || x > W - 18 || y > H - 20) return null;
    if (
      spikes.some(
        (s) =>
          x + 15 > s.x &&
          x - 15 < s.x + s.w &&
          y + 30 > s.y - 20 &&
          y - 28 < s.y + 15,
      )
    )
      return null;
    for (const raw of nearby) {
      const p =
        raw.move || raw.travel ? predictedSurface(raw, time + age) : raw;
      if (
        x + 15 <= p.x ||
        x - 15 >= p.x + p.w ||
        y + 30 <= p.y ||
        y - 28 >= p.y + p.h
      )
        continue;
      if (vy >= 0 && oldY + 30 <= p.y + 5) {
        if (raw.id === from.id) {
          if (jumps) return null;
          y = p.y - 30;
          vy = 0;
          ground = true;
          continue;
        }
        const pad = Math.min(23, p.w / 4);
        if (x < p.x + pad || x > p.x + p.w - pad) return null;
        return {
          from: from.id,
          to: p.id,
          startX,
          endX: x,
          dir,
          jumps,
          secondAt,
          duration: age,
          landingX,
          clearAt,
          kind: "jump",
          key: `${from.id}:${p.id}:${Math.round(startX / 8)}:${dir}:${jumps}:${secondAt}:${landingX}`,
        };
      }
      return null;
    }
  }
  return null;
}

export function navigation(
  solids, options = {},
) {
  return new Map([...navigationSteps(solids, options)].filter(Boolean));
}

export function* navigationSteps(
  solids,
  { time = 0, spikes = [], cache = null, batchSize = Infinity } = {},
) {
  solids = solids.filter((p) => p.hp !== 0);
  let traces = 0;
  for (const from of solids) {
    const signature =
      cache &&
      JSON.stringify(
        solids
          .filter(
            (p) =>
              p.x + p.w > from.x - 470 &&
              p.x < from.x + from.w + 470 &&
              p.y + p.h > from.y - 285 &&
              p.y < from.y + 950,
          )
          .map((p) => [
            p.id,
            Math.round(p.x),
            Math.round(p.y),
            p.w,
            p.h,
            Math.sign(p.dy || 0),
            Math.sign(p.dx || 0),
          ]),
      );
    if (cache?.get(from.id)?.signature === signature) {
      yield [from.id, cache.get(from.id).edges];
      continue;
    }
    const pad = Math.min(28, from.w / 3);
    const launches = new Set([
      from.x + pad,
      from.x + from.w - pad,
      from.x + from.w / 2,
    ]);
    for (let x = from.x + 45; x < from.x + from.w - 25; x += 85)
      launches.add(x);
    for (const to of solids) {
      if (
        to === from ||
        to.y < from.y - 265 ||
        to.y > from.y + 220 ||
        to.x > from.x + from.w + 300 ||
        to.x + to.w < from.x - 300
      )
        continue;
      for (const x of [
        to.x - 45,
        to.x - 100,
        to.x - 150,
        to.x + to.w + 45,
        to.x + to.w + 100,
        to.x + to.w + 150,
      ])
        if (x > from.x + pad && x < from.x + from.w - pad) launches.add(x);
    }
    const candidates = [];
    for (const startX of launches)
      for (const dir of [-1, 1])
        for (const [jumps, secondAt] of [
          [1, 0.38],
          [2, 0.27],
          [2, 0.38],
          [2, 0.6],
          [2, 0.7],
        ]) {
          const edge = traceFlight(
            solids,
            from,
            startX,
            dir,
            jumps,
            secondAt,
            time,
            spikes,
          );
          if (edge) candidates.push(edge);
          if (++traces % batchSize === 0) yield null;
        }
    for (const dir of [-1, 1]) {
      const edge = traceFlight(
        solids,
        from,
        dir < 0 ? from.x + 6 : from.x + from.w - 6,
        dir,
        0,
        0.38,
        time,
        spikes,
      );
      if (edge) candidates.push(edge);
    }
    // A constant horizontal direction misses narrow stairs and drops beside cover.
    // Also trace controlled landings, including braking after stepping off a ledge.
    const starts = [from.x + 20, from.x + from.w - 20, from.x + from.w / 2];
    for (const to of solids) {
      if (
        to === from ||
        to.y < from.y - 265 ||
        to.y > from.y + 600 ||
        to.x > from.x + from.w + 300 ||
        to.x + to.w < from.x - 300
      )
        continue;
      const landingX = clamp(
        from.x + from.w / 2,
        to.x + Math.min(30, to.w / 2),
        to.x + to.w - Math.min(30, to.w / 2),
      );
      for (const startX of starts) {
        const dir = Math.sign(landingX - startX) || 1;
        for (const [jumps, secondAt] of [
          [0, 0.38],
          [1, 0.38],
          [2, 0.27],
          [2, 0.6],
        ]) {
          if (!jumps && to.y <= from.y) continue;
          const edge = traceFlight(
            solids,
            from,
            startX,
            dir,
            jumps,
            secondAt,
            time,
            spikes,
            0,
            landingX,
          );
          if (edge?.to === to.id) candidates.push(edge);
          if (++traces % batchSize === 0) yield null;
        }
      }
    }
    const edges = [];
    // Preserve alternative takeoffs so a failed route is never retried indefinitely.
    candidates.sort((a, b) => a.duration - b.duration);
    for (const edge of candidates) {
      const siblings = edges.filter((e) => e.to === edge.to);
      if (
        siblings.length < 4 &&
        !siblings.some(
          (e) =>
            e.dir === edge.dir &&
            Math.abs(e.startX - edge.startX) < 32 &&
            e.jumps === edge.jumps &&
            e.landingX === edge.landingX,
        )
      )
        edges.push(edge);
    }
    for (const to of solids)
      if (to !== from && Math.abs(to.y - from.y) < 4) {
        const gap =
          Math.max(from.x, to.x) - Math.min(from.x + from.w, to.x + to.w);
        if (gap <= 8 && gap >= -5) {
          const dir = Math.sign(to.x - from.x),
            startX = dir > 0 ? from.x + from.w - 20 : from.x + 20;
          edges.push({
            from: from.id,
            to: to.id,
            kind: "walk",
            startX,
            endX: dir > 0 ? to.x + 30 : to.x + to.w - 30,
            dir,
            duration: 0.25,
            jumps: 0,
            key: `${from.id}:${to.id}:walk`,
          });
        }
      }
    cache?.set(from.id, { signature, edges });
    yield [from.id, edges];
  }
}

export function routesFrom(
  graph,
  solids,
  from,
  x,
  failures,
  time,
  hazards = [],
) {
  const routes = new Map();
  if (!from) return routes;
  routes.set(from.id, { cost: 0, x, edge: null });
  const queue = new Set([from.id]);
  while (queue.size) {
    const id = [...queue].sort(
      (a, b) => routes.get(a).cost - routes.get(b).cost,
    )[0];
    queue.delete(id);
    const current = routes.get(id);
    for (const edge of graph.get(id) || []) {
      if ((failures.get(edge.key) || 0) > time) continue;
      const to = solids.find((p) => p.id === edge.to);
      if (!to) continue;
      const danger = hazards.some(
        (h) =>
          dangerous(h) && Math.abs(edge.endX - (hazardZone(h).x+hazardZone(h).w/2)) < hazardZone(h).w/2 + 40 &&
          to.y > h.y - h.h &&
          to.y < h.y + 50,
      )
        ? 8
        : 0;
      const cost =
        current.cost +
        Math.abs(current.x - edge.startX) / RUN_SPEED +
        edge.duration +
        0.2 +
        danger;
      if (cost >= (routes.get(edge.to)?.cost ?? Infinity)) continue;
      routes.set(edge.to, { cost, x: edge.endX, edge: current.edge || edge });
      queue.add(edge.to);
    }
  }
  return routes;
}
