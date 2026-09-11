import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { HAZARD_TYPES, createHazards, updateHazards, hazardZone } from "../src/hazards.js";
import { COVER_KINDS } from "../src/maps.js";
import { validSnapshot } from "../src/network.js";
import { combatFloor } from "./helpers.js";
function lab(type="geyser") {
 const w=new World({random:()=>.5,shuffle:false});combatFloor(w);w.phase="fight";
 w.arena={...w.arena,traps:[{type,x:650,y:565,w:type==="conveyor"?300:120,h:type==="conveyor"?20:230,dir:1}]};
 w.hazards=createHazards(w);const h=w.hazards[0];
 Object.assign(w.players[0],{x:h.x,y:535,ground:true,vx:0,vy:0});
 Object.assign(w.players[1],{x:h.x+500,y:535,ground:true,vx:0,vy:0});
 return {w,h,p:w.players[0]};
}
const advance=(w,t)=>{for(let n=0;n<t/STEP;n++)updateHazards(w,STEP);};
for(const type of HAZARD_TYPES)test(`${type} is a persistent map fixture with a valid live snapshot`,()=>{
 const {w,h}=lab(type);w.players.forEach(p=>p.x=1500);
 advance(w,3);assert.equal(h.active,false);
 advance(w,4);assert.ok(validSnapshot(w.snapshot()),type);
 advance(w,30);assert.equal(w.hazards.length,1);assert.equal(w.hazards[0],h);
 assert.ok(validSnapshot(JSON.parse(JSON.stringify(w.snapshot()))));
});
test("a flame vent warns, then instantly kills; solid floors shield the storey above",()=>{
 const {w,h,p}=lab();h.cooldown=0;advance(w,.8);assert.equal(p.hp,100);assert.ok(h.warning>0);
 w.platforms.push({id:"shield",x:550,y:380,w:200,h:25});
 Object.assign(w.players[1],{x:650,y:350});advance(w,.5);
 assert.equal(p.alive,false);assert.equal(w.players[1].hp,100);
});
for(const prone of [false,true])test(`a conveyor carries a ${prone?'prone':'standing'} fighter off its floor`,()=>{
 const {w,h,p}=lab("conveyor");w.platforms[0].w=650;h.x=590;h.y=565;h.cooldown=0;
 Object.assign(p,{x:650,y:prone?555:535,prone});
 let launchSpeed=0;for(let n=0;n<120;n++){w.move(p,{left:true,right:false,jump:false,duck:prone,aim:0,block:false},STEP);updateHazards(w,STEP);launchSpeed=Math.max(launchSpeed,p.vx);}
 assert.ok(p.x>730);assert.equal(p.ground,false);assert.ok(launchSpeed>400);
});
test("spike balls and saws hit at their moving body, not an entire invisible rectangle",()=>{
 for(const type of ["pendulum","saw"]){const {w,h,p}=lab(type);h.cooldown=0;updateHazards(w,STEP);
 Object.assign(p,{x:h.bodyX,y:h.bodyY});updateHazards(w,STEP);assert.ok(p.hp<100,type);
 if(type==="saw"){assert.equal(p.alive,false);assert.equal(w.ragdolls[0].effect,"slice");}
 assert.equal(w.players[1].hp,100);assert.ok(hazardZone(h).w<100);}
});
test("a crusher kills beneath its swept head and breaks cover",()=>{
 const {w,h,p}=lab("crusher");h.active=true;h.duration=1;h.cooldown=0;
 w.cover=[{id:"crate",kind:"crate",x:610,y:430,w:80,h:55,hp:75,maxHp:75}];
 advance(w,.25);assert.equal(w.cover[0].hp,0);assert.equal(p.alive,false);
});
test("traps stop in countdown/results and reset with the round; no random zones spawn",()=>{
 const {w,h,p}=lab();for(const phase of ["countdown","result"]){w.phase=phase;advance(w,20);assert.equal(h.age,0);assert.equal(p.hp,100);}
 w.phase="fight";w.hazards=[];advance(w,120);assert.equal(w.hazards.length,0);
 w.startRound();assert.equal(w.hazards.length,w.arena.traps.length);assert.ok(w.hazards.every(h=>!h.active));
});
test("destroying a fixture mounting floor disables it",()=>{
 const {w,h,p}=lab();w.platforms[0].hp=0;h.active=true;advance(w,1);assert.ok(h.done);assert.equal(p.hp,100);
});
test("every arena has fixed, varied traps away from spawns",()=>{
 const kinds=new Set();for(const a of ARENAS){assert.ok(a.traps.length>=2,a.name);
 for(const h of a.traps){kinds.add(h.type);assert.ok(a.platforms.some(p=>p.y===h.y&&p.x<=h.x&&p.x+p.w>=h.x));
 assert.ok(!a.spawns.some(([x,y])=>Math.abs(x-h.x)<h.w/2+85&&Math.abs(y-(h.y-30))<90),a.name);}}
 assert.equal(kinds.size,6);
});
test("trap snapshot validation rejects unknown types and invalid body positions",()=>{
 const {w}=lab();for(const patch of [{type:"<img>"},{bodyX:Infinity},{w:10000},{warning:-1},{active:"yes"},{hitIds:[9]}]){
 const s=structuredClone(w.snapshot());Object.assign(s.hazards[0],patch);assert.equal(validSnapshot(s),false);}
});
test("railgun rounds break cover or rupture a pressure cylinder", () => {
  for (const kind of COVER_KINDS.filter((k) => k !== "table")) {
    const { w, p } = lab();
    w.hazards = [];
    const c = {
      id: "cover0",
      kind,
      x: p.x + 40,
      y: 515,
      w: 70,
      h: 50,
      hp: 75,
      maxHp: 75,
    };
    w.cover = [c];
    p.weapon = "railgun";
    p.ammo = 3;
    p.aimAngle = 0;
    w.attack(p);
    for (let i = 0; i < 8; i++) w.updateProjectiles(STEP);
    if (kind === "canister") { assert.equal(c.hp,1);assert.equal(c.leak,1);assert.ok(c.fuse>0); }
    else assert.equal(c.hp, 0, kind);
  }
});
test("the full map rotation visits every map once before repeating", () => {
  const w = new World({ arena: 0, shuffle: true, random: () => 0.37 });
  const seen = [w.arenaIndex];
  for (let i = 1; i < ARENAS.length * 2; i++) {
    w.phase = "result";
    w.phaseTime = 0;
    w.step(STEP);
    seen.push(w.arenaIndex);
  }
  assert.equal(new Set(seen.slice(0, ARENAS.length)).size, ARENAS.length);
  assert.equal(new Set(seen.slice(ARENAS.length)).size, ARENAS.length);
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
});
test("throwing a weapon and exploding near furniture both damage every cover type", () => {
  for (const kind of COVER_KINDS)
    for (const action of ["throw", "blast"]) {
      const { w, p } = lab();
      w.hazards = [];
      const c = {
        id: "cover0",
        kind,
        x: p.x + 45,
        y: 515,
        w: 70,
        h: 50,
        hp: 75,
        maxHp: 75,
      };
      w.cover = [c];
      if (action === "throw") {
        p.weapon = "blaster";
        p.ammo = 3;
        p.aimAngle = 0;
        w.throwWeapon(p);
        for (let i = 0; i < 30; i++) w.updateDrops(STEP);
      } else
        w.explode({ x: c.x - 10, y: 535, damage: 58, force: 900, radius: 150 });
      assert.ok(c.hp < 75, kind + " " + action);
    }
});
