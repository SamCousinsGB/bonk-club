import { WEAPONS } from "./arsenal.js";
import { segmentBox, playerBox } from "./collision.js";
import { propSolids } from "./props.js";
import { conductive, conductorsTouch } from "./conductors.js";
import { projectileMuzzle } from "./weapon-mount.js";

export const TESLA_LINKS = 7, TESLA_HOP = 240, TESLA_LIFE = .14;
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const pointAt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const castingTesla = (p, i) => p?.alive && p.weapon === "tesla" &&
  (p.ammo > 0 || p.swing > 0) && i?.attack && !i.throw && !p.stun &&
  !p.freeze && !p.knockdown && !p.strands && !p.carryId;

// Geometry is shared with the display-only guest preview. Only fireTesla applies
// damage or powers a circuit. Rays use the same rotated prop tiles as collision.
export function traceTesla(world, p) {
  const angle = p.aimAngle ?? (p.facing === 1 ? 0 : Math.PI);
  const props = [...(world.cover || []), ...(world.chunks || [])].filter(b => b.hp > 0);
  const platforms = world.platforms.filter(b => b.hp !== 0);
  const solids = [...platforms, ...props.flatMap(propSolids)];
  const nodes = [
    ...world.players.filter(q => q.alive && q.id !== p.id).map(q =>
      ({ key: `p${q.id}`, kind: "player", body: q, boxes: [playerBox(q)], at: { x: q.x, y: q.y - 10 } })),
    ...props.map(b => ({ key: `b${b.id}`, kind: "prop", body: b, boxes: propSolids(b), at: center(b) })),
    ...(world.water || []).filter(q => !q.frozen && q.h >= .5).map(q =>
      ({ key: `w${q.id}`, kind: "water", body: q, boxes: [q], at: center(q) })),
  ];
  const muzzle = projectileMuzzle({ solids: () => solids }, p, "tesla", Math.cos(angle), Math.sin(angle));
  const end = { x: muzzle.x + Math.cos(angle) * WEAPONS.tesla.range,
    y: muzzle.y + Math.sin(angle) * WEAPONS.tesla.range };
  const belongs = (s, n) => n && (s === n.body || s.propId === n.body.id && n.kind === "prop");
  const firstHit = (boxes, a, b, padding = 0) => boxes.map(s => ({ s, hit: segmentBox(a.x, a.y, b.x, b.y, s, padding) }))
    .filter(v => v.hit).sort((a, b) => a.hit.t - b.hit.t)[0];
  const wall = firstHit(solids, muzzle, end);
  const targets = nodes.map(n => ({ n, hit: firstHit(n.boxes, muzzle, end, n.kind === "player" ? 5 : 0)?.hit }))
    .filter(v => v.hit && (!wall || v.hit.t <= wall.hit.t + .00001))
    .sort((a, b) => a.hit.t - b.hit.t);
  const first = targets[0], point = first ? pointAt(muzzle, end, first.hit.t) : wall ? pointAt(muzzle, end, wall.hit.t) : end;
  const links = [{ x: muzzle.x, y: muzzle.y, ex: point.x, ey: point.y, key: `gun:${first?.n.key || "air"}` }];
  const hits = [], visited = new Set();
  let origins = first ? [first.n] : [];
  // A metal platform can energize its existing contact circuit, without making
  // structural walls transparent or turning every platform into a chain target.
  if (!first && wall && conductive(wall.s)) hits.push({ node: { kind: "metal", body: wall.s }, point, from: muzzle });
  function visit(node, point, from) {
    visited.add(node.key); hits.push({ node, point, from });
    const group = [node];
    if (node.kind === "water") for (let i = 0; i < group.length; i++)
      for (const n of nodes) if (n.kind === "water" && !visited.has(n.key) &&
          conductorsTouch(group[i].body, n.body, platforms)) {
        visited.add(n.key); group.push(n);
      }
    return group;
  }
  if (first) origins = visit(first.n, point, muzzle);
  while (origins.length && links.length < TESLA_LINKS) {
    // A connected pool occupies one hop; its far edge can pass the arc onward.
    const choices = [];
    for (const from of origins) for (const n of nodes) if (!visited.has(n.key)) {
      const d = distance(from.at, n.at);
      if (d <= TESLA_HOP) choices.push({ from, n, d });
    }
    choices.sort((a, b) => a.d - b.d);
    const next = choices.find(({ from, n }) => !solids.some(s => !belongs(s, from) && !belongs(s, n) &&
      segmentBox(from.at.x, from.at.y, n.at.x, n.at.y, s)));
    if (!next) break;
    const { from, n } = next;
    links.push({ x: from.at.x, y: from.at.y, ex: n.at.x, ey: n.at.y, key: `${from.key}:${n.key}` });
    origins = visit(n, n.at, from.at);
  }
  return { links, hits };
}

function fieldFor(world, p, trace, action) {
  let field = world.fields.find(f => f.kind === "tesla" && f.owner === p.id);
  if (!field) {
    // Never evict a physical black hole or explosion to admit a cosmetic arc.
    if (world.fields.length >= 12) return;
    field = { kind: "tesla", owner: p.id, radius: 0, age: 0 };
    world.fields.push(field);
  }
  Object.assign(field, trace.links[0], { links: trace.links, life: TESLA_LIFE });
  if (action) field.action = action;
  return field;
}

export function fireTesla(world, p, action) {
  if (world.prediction) return;
  const trace = traceTesla(world, p);
  fieldFor(world, p, trace, action);
  trace.hits.forEach(({ node, point, from }, hop) => {
    const b = node.body, power = Math.max(.45, 1 - hop * .12);
    if (node.kind === "player") {
      const length = distance(from, point) || 1;
      world.hit(b, { ...from, vx: 0, vy: 0 }, WEAPONS.tesla.damage * power,
        WEAPONS.tesla.force * power, (point.x - from.x) / length, (point.y - from.y) / length - .12,
        { projectile: true, weapon: "tesla", effect: "tesla", stun: .018, hitstop: 0, source: p });
    } else {
      if (node.kind === "water" || conductive(b)) b.spark = .18;
      if (node.kind === "prop") world.damageCover(b, 2.5 * power,
        Math.sign(point.x - from.x) * 18, -8, point);
    }
  });
}

export function updateTesla(world, inputs) {
  world.fields = world.fields.filter(f => f.kind !== "tesla" ||
    castingTesla(world.players.find(p => p.id === f.owner), inputs[f.owner]));
  for (const f of world.fields) if (f.kind === "tesla") {
    const p = world.players.find(p => p.id === f.owner);
    fieldFor(world, p, traceTesla(world, p));
  }
}

export function previewTesla(state, p, input, fresh) {
  const fields = state.fields.filter(f => f.kind !== "tesla" || f.owner !== p.id);
  if (fresh && castingTesla(p, input) && fields.length < 12) {
    const { links } = traceTesla(state, p);
    fields.push({ kind: "tesla", owner: p.id, radius: 0, age: 0, life: TESLA_LIFE, ...links[0], links });
  }
  return { ...state, fields };
}
