import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { combatFloor } from "./helpers.js";
import { validSnapshot } from "../src/network.js";
const advance = (w, t) => {
  for (let n = 0; n < t / STEP; n++) w.step(STEP);
};
const floor = (id, x, y, w, extra = {}) => ({
  id,
  x,
  y,
  w,
  h: 22,
  baseX: x,
  baseY: y,
  dx: 0,
  dy: 0,
  ...extra,
});
function fixture(players = [0, 1]) {
  const w = new World({
    players,
    bots: [1],
    shuffle: false,
    random: () => 0.45,
  });
  combatFloor(w);
  w.phase = "fight";
  return w;
}
for (const [left, width, gap] of [
  [300, 650, 140],
  [400, 700, 110],
  [500, 650, 190],
])
  test(`AI escapes a solid ceiling ${width} wide with ${gap} floor spacing instead of jumping into it`, () => {
    const w = fixture();
    w.platforms = [
      floor("bottom", 100, 900, 1400),
      floor("roof", left, 900 - gap, width),
    ];
    Object.assign(w.players[0], {
      x: left + width / 2,
      y: 870 - gap,
      ground: true,
      support: "roof",
    });
    Object.assign(w.players[1], {
      x: left + width / 2,
      y: 870,
      ground: true,
      support: "bottom",
      weapon: "blaster",
      ammo: 14,
    });
    advance(w, 1);
    assert.equal(
      w.players[1].ammo,
      14,
      "do not shoot into an indestructible ceiling",
    );
    assert.equal(
      w.events.filter((e) => e.type === "jump").length,
      0,
      "walk out from below the ceiling first",
    );
    advance(w, 11);
    assert.ok(
      w.players[0].hp < 100 || w.round > 1,
      "find a route around and attack the target above",
    );
  });
test("AI chooses a reachable opponent over one behind an unreachable solid floor", () => {
  const w = fixture([0, 1, 2]);
  w.platforms = [floor("bottom", 0, 1000, 2560), floor("roof", 0, 700, 2560)];
  Object.assign(w.players[0], {
    x: 1000,
    y: 670,
    ground: true,
    support: "roof",
  });
  Object.assign(w.players[1], {
    x: 1000,
    y: 970,
    ground: true,
    support: "bottom",
    weapon: "blaster",
    ammo: 14,
  });
  Object.assign(w.players[2], {
    x: 1500,
    y: 970,
    ground: true,
    support: "bottom",
  });
  advance(w, 1.8);
  assert.equal(w.players[0].hp, 100);
  assert.ok(w.players[2].hp < 100);
});
test("AI shoots out a marked floor beneath an opponent with ordinary ammunition", () => {
  const w = fixture();
  const panel = floor("panel", 690, 660, 220, {
    destructible: true,
    panel: "glass",
    hp: 65,
    maxHp: 65,
  });
  w.platforms = [floor("bottom", 100, 900, 1800), panel];
  Object.assign(w.players[0], {
    x: 800,
    y: 630,
    ground: true,
    support: "panel",
  });
  Object.assign(w.players[1], {
    x: 800,
    y: 870,
    ground: true,
    support: "bottom",
    weapon: "blaster",
    ammo: 14,
  });
  advance(w, 2);
  assert.equal(panel.hp, 0);
  assert.equal(w.terrainVersion, 1);
  assert.ok(w.players[1].ammo < 14);
});
test("AI upgrades a melee weapon to a nearby ranged weapon for a distant opponent", () => {
  const w = fixture();
  Object.assign(w.players[0], { x: 2000, y: 535, ground: true });
  Object.assign(w.players[1], {
    x: 900,
    y: 535,
    ground: true,
    weapon: "bat",
    ammo: 8,
  });
  w.drops = [
    { x: 950, y: 555, vx: 0, vy: 0, type: "railgun", ammo: 4, life: 60 },
  ];
  advance(w, 1.2);
  assert.equal(w.players[1].weapon, "railgun");
});
for (const difficulty of ["easy", "hard"])
test(`${difficulty} AI defence is fallible on Easy and predictive on Hard`, () => {
  const w = fixture();
  w.difficulty = difficulty;
  Object.assign(w.players[0], { x: 600, y: 535, ground: true });
  Object.assign(w.players[1], { x: 900, y: 535, ground: true });
  w.projectiles = [
    {
      x: 620,
      y: 525,
      vx: 1300,
      vy: 0,
      r: 4,
      owner: 0,
      kind: "bullet",
      damage: 17,
      force: 350,
      life: 2,
      hitIds: [],
    },
  ];
  let defended = false;
  for (let n = 0; n < 48; n++) {
    w.step(STEP);
    defended ||= w.players[1].block || w.players[1].prone;
  }
  if (difficulty === "hard") {
    assert.equal(w.players[1].hp, 100);
    assert.ok(defended);
  } else {
    assert.ok(w.players[1].hp < 100);
    assert.equal(defended, false);
  }
});
test("wide furniture is attacked at its surface instead of trapping an unarmed AI", () => {
  const w = fixture();
  Object.assign(w.players[0], { x: 1300, y: 535, ground: true });
  Object.assign(w.players[1], { x: 800, y: 535, ground: true });
  w.cover = [
    {
      id: "sofa",
      kind: "sofa",
      x: 835,
      y: 511,
      w: 124,
      h: 54,
      hp: 75,
      maxHp: 75,
      dx: 0,
      dy: 0,
    },
  ];
  advance(w, 4);
  assert.equal(w.cover[0].hp, 0);
  assert.ok(w.players[1].x > 950);
});
test("arena surfaces preserve their material rules and bounded starting geometry", () => {
  for (let arena = 0; arena < ARENAS.length; arena++) {
    const w = new World({ arena });
    const panels = w.platforms.filter((p) => p.destructible);
    if(w.arena.survival||w.arena.transmission)assert.equal(panels.length,0,"steel structures resist bullets");
    else assert.ok(panels.length > 0 && panels.length <= 6, ARENAS[arena].name);
    assert.ok(w.platforms.some((p) => !p.destructible));
    assert.ok(w.platforms.filter(p=>p.material!=="cable").length <= 72);
    assert.equal(w.platforms.filter(p=>p.material==="cable").length,w.arena.transmission?80:0);
    for (const p of panels) {
      assert.equal(p.hp, p.maxHp);
      assert.ok(!p.travel && !p.move && !p.elevator);
    }
  }
});
test("destroying a floor drops its player, furniture and weapon and clears projectile collisions", () => {
  const w = fixture();
  w.botIds.clear();
  w.players[1].bot = false;
  const panel = floor("panel", 500, 500, 190, {
    destructible: true,
    panel: "wood",
    hp: 100,
    maxHp: 100,
  });
  w.platforms = [panel, floor("bottom", 100, 900, 1800)];
  Object.assign(w.players[0], {
    x: 550,
    y: 470,
    ground: true,
    support: "panel",
  });
  Object.assign(w.players[1], {
    x: 1100,
    y: 870,
    ground: true,
    support: "bottom",
  });
  w.cover = [
    {
      id: "table",
      kind: "table",
      x: 600,
      y: 450,
      w: 70,
      h: 50,
      hp: 75,
      maxHp: 75,
      dx: 0,
      dy: 0,
    },
  ];
  w.drops = [
    {
      x: 580,
      y: 493,
      vx: 0,
      vy: 0,
      type: "rocket",
      ammo: 3,
      life: 60,
      support: "panel",
      lock: 5,
    },
  ];
  w.explode({x:595,y:511,radius:145,damage:0,force:0});
  w.projectiles = [
    {
      x: 520,
      y: 440,
      vx: 0,
      vy: 1200,
      r: 4,
      owner: 1,
      kind: "bullet",
      damage: 17,
      force: 350,
      life: 2,
      hitIds: [],
    },
  ];
  advance(w, 0.35);
  assert.ok(w.players[0].y > 540);
  assert.ok(w.cover[0].y > 500);
  assert.ok(w.drops[0].y > 540);
  assert.ok(!w.solids().includes(panel));
  assert.ok(w.projectiles[0]?.y > 700, "shots pass through the opening");
});
test("explosions carve panels and structural floors while distant terrain remains solid", () => {
  const w = fixture();
  const panel = floor("panel", 600, 600, 180, {
    destructible: true,
    panel: "wood",
    hp: 100,
    maxHp: 100,
  });
  const concrete = floor("concrete", 200, 900, 1600);
  w.platforms = [panel, concrete];
  w.explode({ x: 690, y: 640, radius: 160, damage: 80, force: 500 });
  assert.ok(!w.platforms.includes(panel));
  w.damageCover(concrete, 9999);
  assert.ok(w.solids().includes(concrete));
  assert.equal(concrete.hp, undefined);
  w.explode({x:1000,y:900,radius:160,damage:0,force:0});
  assert.ok(!w.platforms.includes(concrete));
  assert.ok(!w.solids().some(s => s.x < 1000 && s.x+s.w > 1000 && s.y === 900));
});
test("new rounds restore floor panels after destruction", () => {
  const w = new World({ arena: 18 });
  const panel = w.platforms.find((p) => p.destructible);
  w.explode({x:panel.x+panel.w/2,y:panel.y,radius:220,damage:0,force:0});
  assert.ok(!w.platforms.includes(panel));
  w.startRound();
  assert.ok(
    w.platforms.filter((p) => p.destructible).every((p) => p.hp === p.maxHp),
  );
});

test("AI stays on an ascending elevator, then exits to fight on the upper floor", () => {
  const w = new World({ players: [0, 1], bots: [1], arena: 8, shuffle: false });
  w.phase = "fight";
  w.cover = [];
  w.drops = [];
  w.weaponTimer = w.hazardTimer = 999;
  const lift = w.platforms.find((p) => p.travel),
    upper = w.platforms.find(
      (p) => p.y === 980 && 950 > p.x && 950 < p.x + p.w,
    );
  Object.assign(w.players[0], {
    x: 950,
    y: 950,
    ground: true,
    support: upper.id,
  });
  Object.assign(w.players[1], {
    x: lift.x + lift.w / 2,
    y: lift.y - 30,
    ground: true,
    support: lift.id,
    weapon: "blaster",
    ammo: 14,
  });
  advance(w, 2);
  assert.equal(w.players[1].support, lift.id);
  assert.ok(w.players[1].y < 1230);
  advance(w, 4);
  assert.ok(w.players[0].hp < 100);
});

test("network snapshots validate intact and broken panels and reject invalid panel data", () => {
  const w = new World({ arena: 18 });
  const panel = w.platforms.find((p) => p.destructible);
  assert.ok(validSnapshot(w.snapshot()));
  w.damageCover(panel, 999);
  assert.ok(validSnapshot(w.snapshot()));
  panel.hp = -1;
  assert.equal(validSnapshot(w.snapshot()), false);
  panel.hp = 0;
  panel.panel = "unknown";
  assert.equal(validSnapshot(w.snapshot()), false);
});

test("furniture carried by an elevator stays supported in both directions", () => {
  const w = new World({ arena: 8 });
  w.hazardTimer = w.weaponTimer = 999;
  const lift = w.platforms.find((p) => p.travel);
  w.cover = [
    {
      id: "table",
      kind: "table",
      x: lift.x + 10,
      y: lift.y - 50,
      w: 70,
      h: 50,
      hp: 75,
      maxHp: 75,
      dx: 0,
      dy: 0,
    },
  ];
  for (let n = 0; n < 2400; n++) {
    w.time += STEP;
    w.movePlatforms();
    w.updateCover(STEP);
    assert.ok(Math.abs(w.cover[0].y + w.cover[0].h - lift.y) < 2);
  }
});
