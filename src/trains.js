import { playerBox } from "./collision.js";
import { TRAIN_Y, TRAIN_LENGTH, TRAIN_HEIGHT, TRAIN_SPEED, TRAIN_CYCLE, TRAIN_START } from "./setpiece-arenas.js";
import { deathPose } from "./death-effects.js";
import { carveExplosion } from "./terrain.js";

const W=2560,H=1440,GRAVITY=1500,MAX_FALL=2800,MAX_SPIN=7;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlap=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;

export const trainBody = h => ({x:h.bodyX,y:h.bodyY ?? h.y-h.h/2,w:h.w,h:h.h,angle:h.angle||0});

export function trainCorners(h) {
  const b=trainBody(h),c=Math.cos(b.angle),s=Math.sin(b.angle),rx=b.w/2,ry=b.h/2;
  return [[-rx,-ry],[rx,-ry],[rx,ry],[-rx,ry]].map(([x,y])=>({x:b.x+x*c-y*s,y:b.y+x*s+y*c}));
}

export const trainBox = h => {
  const points=trainCorners(h),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};
};

function projection(points,axis) {
  const values=points.map(p=>p.x*axis.x+p.y*axis.y);
  return [Math.min(...values),Math.max(...values)];
}

export function trainIntersects(h,box,margin=0) {
  const train=trainCorners(h),rect=[
    {x:box.x-margin,y:box.y-margin},{x:box.x+box.w+margin,y:box.y-margin},
    {x:box.x+box.w+margin,y:box.y+box.h+margin},{x:box.x-margin,y:box.y+box.h+margin},
  ];
  const angle=h.angle||0,axes=[{x:1,y:0},{x:0,y:1},{x:Math.cos(angle),y:Math.sin(angle)},{x:-Math.sin(angle),y:Math.cos(angle)}];
  return axes.every(axis=>{
    const a=projection(train,axis),b=projection(rect,axis);
    return a[1]>=b[0]&&b[1]>=a[0];
  });
}

// Navigation avoids the entire track during an announced pass. Once derailed,
// it follows the moving, rotated wreck rather than reserving an empty crossing.
export const trainDanger = h => h.derailed ? trainBox(h) : {x:0,y:h.y-h.h,w:W,h:h.h};

export function trainPose(age) {
  const lap=Math.floor(age/TRAIN_CYCLE),phase=age-lap*TRAIN_CYCLE,dir=lap%2?-1:1;
  const travel=(W+TRAIN_LENGTH)/TRAIN_SPEED;
  const active=phase>=TRAIN_START&&phase<TRAIN_START+travel;
  const warning=phase>=TRAIN_START-2&&phase<TRAIN_START?TRAIN_START-phase:0;
  const x=-TRAIN_LENGTH/2+(phase-TRAIN_START)*TRAIN_SPEED;
  return {active,warning,dir,bodyX:dir===1?x:W-x,bodyY:TRAIN_Y-TRAIN_HEIGHT/2};
}

function railAt(world,x,y) {
  return world.platforms.some(p=>p.hp!==0&&!p.wreckId&&Math.abs(p.y-y)<.5&&p.x<=x&&p.x+p.w>=x);
}

function missingRailUnderTrain(world,h) {
  for(let offset=-h.w/2+140;offset<=h.w/2-130;offset+=300){
    const x=h.bodyX+offset*h.dir;
    if(x>=0&&x<=W&&!railAt(world,x,h.y))return true;
  }
  return false;
}

function velocityAt(h,x,y) {
  const rx=x-h.bodyX,ry=y-h.bodyY;
  return {x:h.vx-(h.spin||0)*ry,y:h.vy+(h.spin||0)*rx};
}

function strikeMatter(world,h,dt) {
  const body=trainBox(h);
  for(const p of world.players)if(p.alive&&overlap(playerBox(p),body)&&trainIntersects(h,playerBox(p),3)){
    const v=velocityAt(h,p.x,p.y);p.vx=clamp(v.x,-2600,2600);p.vy=clamp(v.y-260,-1800,1800);
    world.kill(p,{effect:"blend",cause:"train",angle:Math.sign(v.x)||h.dir});
  }
  for(const rag of world.ragdolls){
    if(rag.effect==="singularity"||!rag.points.some(p=>trainIntersects(h,{x:p.x-5,y:p.y-5,w:10,h:10})))continue;
    if(rag.effect!=="blend"){delete rag.anchor;delete rag.ash;deathPose(rag,"blend");}
    for(const q of rag.points)if(trainIntersects(h,{x:q.x-5,y:q.y-5,w:10,h:10})){
      const v=velocityAt(h,q.x,q.y);q.px=q.x-clamp(v.x,-2600,2600)*dt;q.py=q.y-clamp(v.y-220,-1800,1800)*dt;
    }
  }
  for(const b of [...world.cover])if(b.hp>0&&overlap(b,body)&&trainIntersects(h,b)){
    const v=velocityAt(h,b.x+b.w/2,b.y+b.h/2);b.vx=clamp(v.x,-1500,1500);b.vy=clamp(v.y-260,-1500,1500);world.damageCover(b,1000);
  }
  for(const b of world.chunks)if(b.hp>0&&overlap(b,body)&&trainIntersects(h,b)){
    const v=velocityAt(h,b.x+b.w/2,b.y+b.h/2);b.vx=clamp(v.x,-1500,1500);b.vy=clamp(v.y-260,-1500,1500);b.spin=clamp((b.spin||0)+h.spin*1.7,-18,18);
  }
  for(const d of world.drops){
    const box={x:d.x-8,y:d.y-8,w:16,h:16};if(!overlap(box,body)||!trainIntersects(h,box))continue;
    const v=velocityAt(h,d.x,d.y);d.vx=clamp(v.x,-1900,1900);d.vy=clamp(v.y-260,-1500,1500);
  }
  for(const b of world.projectiles){
    const box={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};if(overlap(box,body)&&trainIntersects(h,box))b.life=0;
  }
}

function derail(world,h) {
  h.derailed=true;h.warning=0;h.active=true;h.done=false;
  h.angle=0;h.vx=h.dir*TRAIN_SPEED;h.vy=40;h.spin=h.dir*.28;h.crashCooldown=0;
  world.event("hazard",{x:h.bodyX,y:h.bodyY,kind:"train-derail"});
}

function impactTerrain(world,h,dt) {
  h.crashCooldown=Math.max(0,(h.crashCooldown||0)-dt);
  const bounds=trainBox(h),hits=world.platforms.filter(p=>p.hp!==0&&overlap(p,bounds)&&trainIntersects(h,p));
  if(!hits.length)return;
  // Rails and platforms tear the train off line rather than behaving like an
  // immovable wall. Its great mass carries through while contact adds torque.
  h.vx*=Math.exp(-2.2*dt);h.vy*=Math.exp(-.45*dt);
  const lead=hits.sort((a,b)=>h.dir*(b.x-a.x))[0],cx=clamp(h.bodyX,lead.x,lead.x+lead.w),cy=clamp(h.bodyY,lead.y,lead.y+lead.h);
  h.spin=clamp(h.spin+h.dir*(cx-h.bodyX)/(h.w/2)*1.15*dt*60,-MAX_SPIN,MAX_SPIN);
  if(h.crashCooldown>0)return;
  h.crashCooldown=.04;
  carveExplosion(world,{x:cx,y:cy,radius:clamp(Math.max(lead.h*1.7,62),62,125)},{fixtures:false});
}

function updateDerailed(world,h,dt) {
  // Small substeps keep the 6,400-unit entry speed from tunnelling through
  // fighters and thin catwalks before the impact drag takes hold.
  const steps=Math.max(2,Math.min(12,Math.ceil((Math.abs(h.vx)*dt)/45))),step=dt/steps;
  for(let i=0;i<steps;i++){
    h.vy=clamp(h.vy+GRAVITY*step,-MAX_FALL,MAX_FALL);
    h.bodyX+=h.vx*step;h.bodyY+=h.vy*step;h.angle+=h.spin*step;
    if(h.angle>Math.PI)h.angle-=Math.PI*2;else if(h.angle< -Math.PI)h.angle+=Math.PI*2;
    impactTerrain(world,h,step);strikeMatter(world,h,step);
  }
  const bounds=trainBox(h);
  if(bounds.y>H+2300||bounds.x>W+4300||bounds.x+bounds.w< -4300){h.done=true;h.active=false;}
}

export function updateTrain(world,h,dt) {
  if(world.prediction)return;
  if(h.derailed){h.age+=dt;updateDerailed(world,h,dt);return;}
  // Destroying either tunnel approach still cancels future services. Damage to
  // the crossing itself now catches the next arriving wheel set and derails it.
  const approaches=[25,2535].every(x=>railAt(world,x,h.y));
  if(!approaches&&!h.active){h.done=true;h.warning=0;return;}
  const old=trainPose(h.age);h.age+=dt;
  const next=trainPose(h.age);Object.assign(h,next,{angle:0,vx:next.dir*TRAIN_SPEED,vy:0,spin:0});
  if(!h.active){h.bodyX=h.dir===1?-h.w:W+h.w;}
  if(h.warning>0&&!old.warning)world.event("hazard",{x:h.dir===1?0:W,y:h.y,kind:"train-warning"});
  if(!h.active&&!old.active)return;
  if(!old.active)world.event("hazard",{x:1280,y:h.y,kind:"train"});
  if(h.active&&missingRailUnderTrain(world,h)){derail(world,h);updateDerailed(world,h,dt);return;}
  const previous=old.active?old.bodyX:(h.dir===1?-h.w/2:W+h.w/2);
  const current=h.active?h.bodyX:(h.dir===1?W+h.w/2:-h.w/2);
  const sweep={x:Math.min(previous,current)-h.w/2,y:h.y-h.h,w:h.w+Math.abs(current-previous),h:h.h};
  for(const p of world.players)if(p.alive&&overlap(playerBox(p),sweep)){
    p.vx=h.dir*2100;p.vy=-380;world.kill(p,{effect:"blend",cause:"train",angle:h.dir});
  }
  for(const rag of world.ragdolls){
    if(rag.effect==="singularity"||!rag.points.some(p=>overlap({x:p.x-4,y:p.y-4,w:8,h:8},sweep)))continue;
    if(rag.effect!=="blend"){delete rag.anchor;delete rag.ash;deathPose(rag,"blend");}
    for(const q of rag.points)if(overlap({x:q.x-4,y:q.y-4,w:8,h:8},sweep)){q.px=q.x-h.dir*2100*dt;q.py=q.y+380*dt;}
  }
  for(const b of world.cover)if(b.hp>0&&overlap(b,sweep)){b.vx=h.dir*1500;b.vy=-300;world.damageCover(b,1000);}
  for(const b of world.chunks)if(b.hp>0&&overlap(b,sweep)){b.vx=h.dir*1500;b.vy=-300;b.spin=h.dir*8;}
  for(const d of world.drops)if(overlap({x:d.x-8,y:d.y-8,w:16,h:16},sweep)){d.vx=h.dir*1700;d.vy=-300;}
  const body=trainBox(h);
  for(const b of world.projectiles)if(overlap({x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2},body))b.life=0;
}
