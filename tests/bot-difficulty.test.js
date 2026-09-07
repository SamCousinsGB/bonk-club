import test from "node:test";
import assert from "node:assert/strict";
import { combatPerception } from "../src/bot-difficulty.js";
import { World } from "../src/engine.js";

const enemy={id:0,x:600,y:500,vx:200,vy:0};
test("bots default to Easy, retain delayed observations and wait before firing", () => {
  assert.equal(new World().difficulty,"easy");
  const b={};
  const first=combatPerception(b,enemy,"blaster",0,()=>.9,"easy");
  assert.equal(first.fire,false);
  const later=combatPerception(b,{...enemy,x:700},"blaster",.1,()=>.9,"easy");
  assert.equal(later.enemy.x,600);
  assert.ok(later.enemy.vx<enemy.vx);
  assert.equal(combatPerception(b,enemy,"blaster",.6,()=>.9,"easy").fire,true);
  assert.equal(combatPerception(b,enemy,"railgun",.7,()=>.9,"easy").fire,false);
});

test("Easy has substantially wider aim error and spends less time firing than Hard", () => {
  const measure=difficulty=>{
    let error=0,fire=0;const b={};
    for(let i=0;i<1000;i++){
      const p=combatPerception(b,enemy,"minigun",i*.05,()=>.8,difficulty);
      error+=p.error*p.error;fire+=p.fire?1:0;
    }
    return {error,fire};
  };
  const easy=measure("easy"),hard=measure("hard");
  assert.ok(easy.error>hard.error*9);
  assert.ok(easy.fire<hard.fire*.65);
});
