import { playerBox } from "./collision.js";
import { TRAIN_Y, TRAIN_LENGTH, TRAIN_HEIGHT, TRAIN_SPEED, TRAIN_CYCLE, TRAIN_START } from "./setpiece-arenas.js";
import { deathPose } from "./death-effects.js";
const overlap=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;
export const trainBox = h => ({x:h.bodyX-h.w/2,y:h.y-h.h,w:h.w,h:h.h});
// Navigation avoids the entire track during warning/pass, not only the current
// nose: a fast train can arrive before a bot completes a planned jump.
export const trainDanger = h => ({x:0,y:h.y-h.h,w:2560,h:h.h});
export function trainPose(age) {
  const lap=Math.floor(age/TRAIN_CYCLE),phase=age-lap*TRAIN_CYCLE,dir=lap%2?-1:1;
  const travel=(2560+TRAIN_LENGTH)/TRAIN_SPEED;
  const active=phase>=TRAIN_START&&phase<TRAIN_START+travel;
  const warning=phase>=TRAIN_START-2&&phase<TRAIN_START?TRAIN_START-phase:0;
  const x=-TRAIN_LENGTH/2+(phase-TRAIN_START)*TRAIN_SPEED;
  return {active,warning,dir,bodyX:dir===1?x:2560-x,bodyY:TRAIN_Y-TRAIN_HEIGHT/2};
}
export function updateTrain(world,h,dt) {
  if(world.prediction)return;
  // The approach track is destructible. Losing either entrance stops subsequent
  // services. An already arriving train completes its pass over the damaged span.
  const supported=[25,2535].every(x=>world.platforms.some(p=>p.hp!==0&&!p.wreckId&&p.y===h.y&&p.x<=x&&p.x+p.w>=x));
  if(!supported&&!h.active){h.done=true;h.warning=0;return;}
  const old=trainPose(h.age);h.age+=dt;
  const next=trainPose(h.age);Object.assign(h,next);
  // Keep dormant coordinates bounded and avoid offscreen teleports blending
  // across the arena at the next cycle.
  if(!h.active){h.bodyX=h.dir===1?-h.w:2560+h.w;}
  if(h.warning>0&&!old.warning)world.event("hazard",{x:h.dir===1?0:2560,y:h.y,kind:"train-warning"});
  if(!h.active&&!old.active)return;
  if(!old.active)world.event("hazard",{x:1280,y:h.y,kind:"train"});
  const previous=old.active?old.bodyX:(h.dir===1?-h.w/2:2560+h.w/2);
  const current=h.active?h.bodyX:(h.dir===1?2560+h.w/2:-h.w/2);
  const sweep={x:Math.min(previous,current)-h.w/2,y:h.y-h.h,w:h.w+Math.abs(current-previous),h:h.h};
  for(const p of world.players)if(p.alive&&overlap(playerBox(p),sweep)){
    p.vx=h.dir*2100;p.vy=-380;
    world.kill(p,{effect:"blend",cause:"train",angle:h.dir});
  }
  for(const rag of world.ragdolls){
    if(rag.effect==="singularity"||!rag.points.some(p=>overlap({x:p.x-4,y:p.y-4,w:8,h:8},sweep)))continue;
    if(rag.effect!=="blend"){delete rag.anchor;delete rag.ash;deathPose(rag,"blend");}
    for(const q of rag.points)if(overlap({x:q.x-4,y:q.y-4,w:8,h:8},sweep)){
      q.px=q.x-h.dir*2100*dt;q.py=q.y+380*dt;
    }
  }
  for(const b of world.cover)if(b.hp>0&&overlap(b,sweep)){b.vx=h.dir*1500;b.vy=-300;world.damageCover(b,1000);}
  for(const b of world.chunks)if(b.hp>0&&overlap(b,sweep)){b.vx=h.dir*1500;b.vy=-300;b.spin=h.dir*8;}
  for(const d of world.drops)if(overlap({x:d.x-8,y:d.y-8,w:16,h:16},sweep)){d.vx=h.dir*1700;d.vy=-300;}
  // Shots hit the actual train body. The crossing itself is otherwise open.
  const body=trainBox(h);
  for(const b of world.projectiles)if(overlap({x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2},body))b.life=0;
}
