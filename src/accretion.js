import { orbitPoint, seedOrbit } from "./orbit.js";
import { trackKillSource } from "./kill-credit.js";
import { cleanProfile } from "./identity.js";
import { segmentBox } from "./collision.js";
import { JOINTS } from "./puppet.js";
// Samples retain the source appearance; totals include every object even when
// many bullets or splinters share a bounded visual sample.
export const MATTER_KINDS = ["platform", "prop", "trap", "fighter", "weapon", "projectile", "debris", "blood"];
export const MATTER_LIMIT = 96;
const colors = ["#87919b", "#9f795b", "#958baf", "#ecbf8b", "#d4d9dc", "#ffcb79", "#a8937d", "#943345"];
export function collectMatter(world, f, source, kind) {
  const core = (f.matter ||= trackKillSource(world, {
    id: ++world.wreckSerial, kind: "matter", x: f.x, y: f.y,
    w: 48, h: 48, angle: 0, hp: 120, packing: 0,
    mass: 0, totals: MATTER_KINDS.map(() => 0), items: [],
  }, f));
  if (source.kind === "matter") {
    core.mass += source.mass;
    core.totals = core.totals.map((n, i) => n + source.totals[i]);
    for (const item of source.items) addSample(core, { ...item });
  } else {
    const index = MATTER_KINDS.indexOf(kind);
    core.totals[index]++;
    core.mass += kind === "fighter" ? 70 : Math.max(1, Math.min(300, (source.w || 8) * (source.h || 8) / 30));
    const { name, ...appearance } = cleanProfile(source);
    addSample(core, {
      kind, x: source.x ?? f.x, y: source.y ?? f.y, angle: source.angle || 0,
      size: kind === "fighter" ? 12 : Math.max(3, Math.min(16, Math.sqrt((source.w || 10) * (source.h || 10)) * .2)),
      color: /^#[0-9a-f]{6}$/i.test(source.color) ? source.color : colors[index],
      ...(kind === "fighter" ? { ...appearance, facing: source.facing === -1 ? -1 : 1 } : {}),
      type: kind === "weapon" ? (source.type || source.weapon) : null,
      sourceKind: source.sourceKind || (kind === "prop" && source.kind !== "prop" ? source.kind : null) || null,
      vx: source.vx || 0, vy: source.vy || 0,
      spin: source.spin || source.angularVelocity || 0,
    });
  }
  core.mass = Math.min(1000000, core.mass);
  core.w = core.h = Math.min(140, 42 + Math.sqrt(core.mass) * 1.5);
  return core;
}
function addSample(core, item) {
  item.id = core.sampleSerial = (core.sampleSerial || 0) + 1;
  seedOrbit(item, core, .7);
  item.spin ||= Math.sin(item.id * 2.399963) * 9;
  if (core.items.length < MATTER_LIMIT) core.items.push(item);
  else {
    // Keep rare contents (a fighter, weapon or trap) visible among the rubble.
    const counts = MATTER_KINDS.map(kind => core.items.filter(i => i.kind === kind).length);
    const common = MATTER_KINDS[counts.indexOf(Math.max(...counts))];
    const index = core.items.findIndex(i => i.kind === common);
    if (counts[MATTER_KINDS.indexOf(item.kind)] < counts[MATTER_KINDS.indexOf(common)]) core.items[index] = item;
  }
}
export function packMatter(f, dt) {
  const core = f.matter;
  if (!core) return;
  core.packing = Math.max(0, Math.min(1, 1 - f.life / 1.1));
  const heads = core.items.filter(q => q.kind === "fighter");
  for (let i = 0; i < core.items.length; i++) {
    const q = core.items[i], head = q.kind === "fighter",
      a = head ? heads.indexOf(q) * Math.PI * 2 / heads.length - Math.PI / 2 : i * 2.399963,
      d = head ? (heads.length === 1 ? 0 : Math.max(0, Math.min(core.w * .25, core.w / 2 - 24))) :
        Math.sqrt((i + .5) / core.items.length) * Math.max(0, core.w / 2 - q.size - 3),
      x = core.x + Math.cos(a) * d, y = core.y + Math.sin(a) * d;
    if (f.life > 1.1) {
      orbitPoint(q, f, dt, .8, 155);
      q.spin += Math.sin(f.age * 9 + q.id) * dt * 7;
      q.angle += q.spin * dt;
      continue;
    }
    const response = f.life <= 0 ? 1 : Math.min(1, dt * (core.packing ? 12 : 3));
    q.x += (x - q.x) * response; q.y += (y - q.y) * response;
    // Settle heads mostly upright so hair, facial hair and eyewear remain legible.
    q.angle += ((head ? Math.sin(a) * .22 : a) - q.angle) * response;
  }
}

// Use the same strips as solid collision, including the solver's tiny separation
// epsilon. A living ragdoll touches with its actual limbs, never its empty bounds.
export function absorbMatterContacts(world) {
  if (world.phase !== "fight") return;
  for (const core of world.wreckage) {
    if (core.kind !== "matter" || core.hp <= 0 || core.packing < 1) continue;
    for (const p of world.players) {
      if (!p.alive) continue;
      const tiles = matterTiles(core);
      const rx = p.prone ? 34 : 15, top = p.prone ? 10 : 28, bottom = p.prone ? 10 : 30;
      const bodyTouch = !p.knockdown && tiles.some(s =>
        p.x + rx >= s.x - .15 && p.x - rx <= s.x + s.w + .15 &&
        p.y + bottom >= s.y - .15 && p.y - top <= s.y + s.h + .15);
      const limbTouch = p.rig && tiles.some(s =>
        p.rig.some((q, i) => segmentBox(q.px ?? q.x, q.py ?? q.y, q.x, q.y, s, i === 0 ? 10.15 : 3.15)) ||
        JOINTS.some(([a,b]) => segmentBox(p.rig[a].x,p.rig[a].y,p.rig[b].x,p.rig[b].y,s,3.15)));
      if (!bodyTouch && !limbTouch) continue;
      const field = { x: core.x, y: core.y, life: 0, matter: core };
      collectMatter(world, field, p, "fighter");
      if (p.weapon) collectMatter(world, field, { ...p, type: p.weapon }, "weapon");
      packMatter(field, 0);
      world.kill(p, { effect: "singularity", sourceX: core.x, sourceY: core.y, source: core });
      world.ragdolls.pop();
      delete p.capturedBy; delete p.strands;
      world.wreckDirty = true;
      world.terrainVersion++;
    }
  }
}
export function matterTiles(core, old = new Map()) {
  if (!core.hp || core.packing < 1) return [];
  const radius = core.w / 2, count = 14, width = core.w / count;
  return Array.from({ length: count }, (_, i) => {
    const dx = -radius + (i + .5) * width,
      half = Math.sqrt(Math.max(0, radius * radius - dx * dx)),
      id = `matter${core.id}:${i}`, x = core.x - radius + i * width, y = core.y - half;
    return { id, wreckId: core.id, x, y, w: width, h: half * 2,
      baseX: x, baseY: y, dx: old.has(id) ? x - old.get(id).x : 0,
      dy: old.has(id) ? y - old.get(id).y : 0, destructible: true, panel: "wood", hp: core.hp, maxHp: 120 };
  });
}
