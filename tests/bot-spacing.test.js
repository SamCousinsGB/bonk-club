import test from "node:test";
import assert from "node:assert/strict";
import {World, STEP, WEAPONS} from "../src/engine.js";
import {combatFloor} from "./helpers.js";

function fixture(weapon, bots = [1], separation = 32) {
  const w = new World({players:[0,1], bots, shuffle:false, random:()=>.45});
  combatFloor(w);
  w.phase = "fight";
  w.grenadeTimer = 999;
  Object.assign(w.players[0], {x:1280 + separation,y:535,ground:true,support:"floor0"});
  Object.assign(w.players[1], {x:1280,y:535,ground:true,support:"floor0",weapon,ammo:WEAPONS[weapon].ammo});
  if (bots.includes(0)) Object.assign(w.players[0],{weapon,ammo:WEAPONS[weapon].ammo});
  return w;
}
function advance(w, seconds, observe = ()=>{}) {
  for (let n=0; n<seconds/STEP && w.phase === "fight"; n++) {w.step(STEP); observe(w);}
}

for (const weapon of ["blackhole","nuke","grenade","rocket","plasma","duck"]) {
  test(`${weapon} carrier retreats from contact and uses the weapon after creating space`,()=>{
    const w = fixture(weapon);
    let fired = false, firingRange = 0;
    advance(w,.65);
    assert.ok(w.players[1].x < 1200, `bot must retreat, x=${w.players[1].x}`);
    assert.equal(w.players[1].weapon,weapon,"keep the weapon rather than throw it away");
    advance(w,7,()=>{
      if (!fired && w.projectiles.some(s=>s.owner===1)) {
        fired=true;
        firingRange=Math.hypot(w.players[0].x-w.players[1].x,w.players[0].y-w.players[1].y);
      }
    });
    assert.ok(fired, "retreat must produce an actual shot");
    assert.ok(firingRange > (weapon === "blackhole" ? WEAPONS.blackhole.radius + 80 : 180),`fired at ${firingRange}`);
  });
}

for (const weapon of ["blackhole","nuke"]) {
  for (const separation of [0,32]) test(`two ${weapon} bots separate from ${separation}-unit contact and fire`,()=>{
    const w=fixture(weapon,[0,1],separation);
    let gap=0, fired=false;
    advance(w,7,()=>{
      gap=Math.max(gap,Math.abs(w.players[0].x-w.players[1].x));
      fired ||= w.projectiles.length>0 || w.fields.length>0;
    });
    assert.ok(gap>550,`only separated by ${gap}`);
    assert.ok(fired);
  });

  test(`${weapon} bot leaves a crowded small platform along a safe jump route`,()=>{
    const w=fixture(weapon);
    w.platforms=[{id:"floor0",x:1150,y:800,w:270,h:25},
      {id:"escape",x:200,y:800,w:700,h:25}];
    for(const p of w.players)p.y=770;
    let landed=false, shot=false;
    advance(w,12,()=>{
      landed ||= w.players[1].support==="escape";
      shot ||= w.projectiles.some(s=>s.owner===1);
    });
    assert.ok(landed,"must follow the retreat route to another platform");
    assert.ok(shot,"must use the new firing position");
  });

  test(`${weapon} bot stays separated on a stranded ledge after the stale-attack timer`,()=>{
    const w=fixture(weapon);
    w.platforms=[{id:"floor0",x:1000,y:1200,w:420,h:25}];
    for(const p of w.players)p.y=1170;
    advance(w,15);
    assert.equal(w.players[1].alive,true);
    assert.equal(w.players[1].weapon,weapon);
    assert.ok(Math.abs(w.players[0].x-w.players[1].x)>150,"must not return to cuddling");
    assert.ok(w.players[1].x>1000 && w.players[1].x<1420);
  });
}

test("a retreat does not choose a spike-covered platform",()=>{
  const w=fixture("blackhole");
  w.platforms=[{id:"floor0",x:1150,y:800,w:270,h:25},
    {id:"escape",x:200,y:800,w:700,h:25}];
  for(const p of w.players)p.y=770;
  w.arena={...w.arena,spikes:[{x:200,y:776,w:700,h:24}]};
  advance(w,10);
  assert.equal(w.players[1].alive,true);
  assert.equal(w.players[1].support,"floor0");
});

test("black-hole carriers keep retreating when a close wall blocks a distant enemy",()=>{
  const w=fixture("blackhole",[1],800);
  w.platforms.push({id:"wall",x:1400,y:300,w:40,h:265});
  advance(w,1);
  assert.ok(w.players[1].x<1150);
  assert.equal(w.players[1].ammo,1);
});
