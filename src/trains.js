import { playerBox } from "./collision.js";
import { TRAIN_Y, TRAIN_LENGTH, TRAIN_HEIGHT, TRAIN_SPEED, TRAIN_CYCLE, TRAIN_START } from "./setpiece-arenas.js";
import { deathPose } from "./death-effects.js";
import { carveExplosion } from "./terrain.js";

const W=2560,H=1440,GRAVITY=1850,MAX_FALL=2800,MAX_SPIN=7;
export const TRAIN_CARRIAGE_COUNT=8;
export const TRAIN_CARRIAGE_GAP=12;
export const TRAIN_CARRIAGE_LENGTH=(TRAIN_LENGTH-TRAIN_CARRIAGE_GAP*(TRAIN_CARRIAGE_COUNT-1))/TRAIN_CARRIAGE_COUNT;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlap=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;

const bodyFor=(x,y,angle=0)=>({x,y,w:TRAIN_CARRIAGE_LENGTH,h:TRAIN_HEIGHT,angle});
const scheduledCarriages=h=>Array.from({length:TRAIN_CARRIAGE_COUNT},(_,i)=>{
  const offset=-h.w/2+TRAIN_CARRIAGE_LENGTH/2+i*(TRAIN_CARRIAGE_LENGTH+TRAIN_CARRIAGE_GAP);
  return {id:i,x:h.bodyX+h.dir*offset,y:h.bodyY ?? h.y-h.h/2,angle:0,vx:h.dir*TRAIN_SPEED,vy:0,spin:0,onRail:true,coupled:i<TRAIN_CARRIAGE_COUNT-1};
});

export const trainBodies=h=>h.derailed&&Array.isArray(h.carriages)?h.carriages:scheduledCarriages(h);
export const trainBody=h=>({x:h.bodyX,y:h.bodyY ?? h.y-h.h/2,w:h.w,h:h.h,angle:h.angle||0});

function bodyCorners(body) {
  const c=Math.cos(body.angle),s=Math.sin(body.angle),rx=body.w/2,ry=body.h/2;
  return [[-rx,-ry],[rx,-ry],[rx,ry],[-rx,ry]].map(([x,y])=>({x:body.x+x*c-y*s,y:body.y+x*s+y*c}));
}

export function trainCorners(h) { return trainBodies(h).flatMap(c=>bodyCorners(bodyFor(c.x,c.y,c.angle))); }

export const carriageBox=car=>{
  const points=bodyCorners(bodyFor(car.x,car.y,car.angle)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};
};

export const trainCollisionBoxes=h=>trainBodies(h).map(carriageBox);
export const trainBox=h=>{
  const boxes=trainCollisionBoxes(h),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
};

function projection(points,axis) {
  const values=points.map(p=>p.x*axis.x+p.y*axis.y);
  return [Math.min(...values),Math.max(...values)];
}

function bodyIntersects(car,box,margin=0) {
  const body=bodyFor(car.x,car.y,car.angle),corners=bodyCorners(body),rect=[
    {x:box.x-margin,y:box.y-margin},{x:box.x+box.w+margin,y:box.y-margin},
    {x:box.x+box.w+margin,y:box.y+box.h+margin},{x:box.x-margin,y:box.y+box.h+margin},
  ];
  const axes=[{x:1,y:0},{x:0,y:1},{x:Math.cos(body.angle),y:Math.sin(body.angle)},{x:-Math.sin(body.angle),y:Math.cos(body.angle)}];
  return axes.every(axis=>{const a=projection(corners,axis),b=projection(rect,axis);return a[1]>=b[0]&&b[1]>=a[0];});
}

function carriageContact(a,b) {
  const aa=bodyCorners(bodyFor(a.x,a.y,a.angle)),bb=bodyCorners(bodyFor(b.x,b.y,b.angle));
  const axes=[a.angle,b.angle].flatMap(angle=>[{x:Math.cos(angle),y:Math.sin(angle)},{x:-Math.sin(angle),y:Math.cos(angle)}]);
  let depth=Infinity,normal=null;
  for(const axis of axes){
    const ap=projection(aa,axis),bp=projection(bb,axis),overlapDepth=Math.min(ap[1],bp[1])-Math.max(ap[0],bp[0]);
    if(overlapDepth<=0)return null;
    if(overlapDepth<depth){depth=overlapDepth;normal={...axis};}
  }
  if((b.x-a.x)*normal.x+(b.y-a.y)*normal.y<0){normal.x*=-1;normal.y*=-1;}
  return {...normal,depth};
}

const strikingCarriage=(h,box,margin=0)=>trainBodies(h).find(car=>overlap(carriageBox(car),box)&&bodyIntersects(car,box,margin));
export function trainIntersects(h,box,margin=0) { return !!strikingCarriage(h,box,margin); }

// Navigation avoids the entire track during an announced pass. Once derailed,
// it follows the articulated wreck rather than reserving an empty crossing.
export const trainDanger=h=>h.derailed?trainBox(h):{x:0,y:h.y-h.h,w:W,h:h.h};

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
    if(x>=0&&x<=W&&!railAt(world,x,h.y))return x;
  }
  return null;
}

function carriageSupported(world,car) {
  if(!car.onRail||Math.abs(car.angle)>.16||Math.abs(car.y-(TRAIN_Y-TRAIN_HEIGHT/2))>34)return false;
  const axle=TRAIN_CARRIAGE_LENGTH*.31;
  return railAt(world,car.x-axle,TRAIN_Y)&&railAt(world,car.x+axle,TRAIN_Y);
}

function pointVelocity(car,x,y) {
  const rx=x-car.x,ry=y-car.y;
  return {x:car.vx-car.spin*ry,y:car.vy+car.spin*rx};
}

function strikeMatter(world,h,dt) {
  for(const p of world.players)if(p.alive){
    const car=strikingCarriage(h,playerBox(p),3);if(!car)continue;
    const v=pointVelocity(car,p.x,p.y);p.vx=clamp(v.x,-2600,2600);p.vy=clamp(v.y-260,-1800,1800);
    world.kill(p,{effect:"blend",cause:"train",angle:Math.sign(v.x)||h.dir});
  }
  for(const rag of world.ragdolls){
    if(rag.effect==="singularity")continue;
    const hits=rag.points.map(q=>[q,strikingCarriage(h,{x:q.x-5,y:q.y-5,w:10,h:10})]).filter(([,car])=>car);
    if(!hits.length)continue;
    if(rag.effect!=="blend"){delete rag.anchor;delete rag.ash;deathPose(rag,"blend");}
    for(const [q,car] of hits){const v=pointVelocity(car,q.x,q.y);q.px=q.x-clamp(v.x,-2600,2600)*dt;q.py=q.y-clamp(v.y-220,-1800,1800)*dt;}
  }
  for(const b of [...world.cover])if(b.hp>0){
    const car=strikingCarriage(h,b);if(!car)continue;
    const v=pointVelocity(car,b.x+b.w/2,b.y+b.h/2);b.vx=clamp(v.x,-1500,1500);b.vy=clamp(v.y-260,-1500,1500);world.damageCover(b,1000);
  }
  for(const b of world.chunks)if(b.hp>0){
    const car=strikingCarriage(h,b);if(!car)continue;
    const v=pointVelocity(car,b.x+b.w/2,b.y+b.h/2);b.vx=clamp(v.x,-1500,1500);b.vy=clamp(v.y-260,-1500,1500);b.spin=clamp((b.spin||0)+car.spin*1.7,-18,18);
  }
  for(const d of world.drops){
    const car=strikingCarriage(h,{x:d.x-8,y:d.y-8,w:16,h:16});if(!car)continue;
    const v=pointVelocity(car,d.x,d.y);d.vx=clamp(v.x,-1900,1900);d.vy=clamp(v.y-260,-1500,1500);
  }
  for(const b of world.projectiles){
    const box={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};if(strikingCarriage(h,box))b.life=0;
  }
}

function derail(world,h,gapX) {
  h.derailed=true;h.warning=0;h.active=true;h.done=false;
  h.carriages=scheduledCarriages(h);h.crashCooldown=0;
  const falling=h.carriages.reduce((best,car)=>Math.abs(car.x-gapX)<Math.abs(best.x-gapX)?car:best);
  falling.onRail=false;falling.vy=110;falling.spin=h.dir*.52;
  world.event("hazard",{x:gapX,y:h.bodyY,kind:"train-derail"});
}

function impactTerrain(world,car,dt) {
  car.crashCooldown=Math.max(0,(car.crashCooldown||0)-dt);
  const bounds=carriageBox(car),hits=world.platforms.filter(p=>p.hp!==0&&overlap(p,bounds)&&bodyIntersects(car,p));
  if(!hits.length)return;
  car.onRail=false;car.vx*=Math.exp(-2.8*dt);car.vy*=Math.exp(-.7*dt);
  const lead=hits.sort((a,b)=>Math.sign(car.vx||1)*(b.x-a.x))[0],cx=clamp(car.x,lead.x,lead.x+lead.w),cy=clamp(car.y,lead.y,lead.y+lead.h);
  const torque=((cx-car.x)*Math.sign(car.vy||1)-(cy-car.y)*Math.sign(car.vx||1))/TRAIN_CARRIAGE_LENGTH;
  car.spin=clamp(car.spin+torque*1.65*dt*60,-MAX_SPIN,MAX_SPIN);
  if(car.crashCooldown>0)return;
  car.crashCooldown=.055;
  carveExplosion(world,{x:cx,y:cy,radius:clamp(Math.max(lead.h*1.7,62),62,112)},{fixtures:false});
}

function couplerPoint(car,side) {
  const reach=TRAIN_CARRIAGE_LENGTH/2,c=Math.cos(car.angle),s=Math.sin(car.angle);
  return {x:car.x+c*reach*side,y:car.y+s*reach*side};
}

function solveCouplers(h,dt) {
  for(let pass=0;pass<4;pass++)for(let i=0;i<h.carriages.length-1;i++){
    const a=h.carriages[i],b=h.carriages[i+1];if(!a.coupled)continue;
    const pa=couplerPoint(a,h.dir),pb=couplerPoint(b,-h.dir),dx=pb.x-pa.x,dy=pb.y-pa.y,dist=Math.hypot(dx,dy)||1;
    const nx=dx/dist,ny=dy/dist,stretch=dist-TRAIN_CARRIAGE_GAP;
    const av=pointVelocity(a,pa.x,pa.y),bv=pointVelocity(b,pb.x,pb.y),relative=(bv.x-av.x)*nx+(bv.y-av.y)*ny;
    const centreDistance=Math.hypot(b.x-a.x,b.y-a.y);
    if(centreDistance<TRAIN_CARRIAGE_LENGTH*.4||dist>155||(dist>70&&Math.abs(relative)>2400)){a.coupled=false;continue;}
    if(Math.abs(stretch)<1)continue;
    const correction=clamp(stretch*.42,-18,18),aWeight=a.onRail?.12:.5,bWeight=b.onRail?.12:.5,total=aWeight+bWeight;
    a.x+=nx*correction*(aWeight/total);a.y+=ny*correction*(aWeight/total);
    b.x-=nx*correction*(bWeight/total);b.y-=ny*correction*(bWeight/total);
    const impulse=clamp((stretch*48+relative*1.8)*dt,-520,520);
    if(!a.onRail){a.vx+=nx*impulse;a.vy+=ny*impulse;a.spin=clamp(a.spin+(pa.x-a.x)*ny*impulse*.000035,-MAX_SPIN,MAX_SPIN);}
    if(!b.onRail){b.vx-=nx*impulse;b.vy-=ny*impulse;b.spin=clamp(b.spin-(pb.x-b.x)*ny*impulse*.000035,-MAX_SPIN,MAX_SPIN);}
  }
}

function solveCarriageContacts(h) {
  for(let pass=0;pass<2;pass++)for(let i=0;i<h.carriages.length;i++)for(let j=i+1;j<h.carriages.length;j++){
    const a=h.carriages[i],b=h.carriages[j],contact=carriageContact(a,b);if(!contact)continue;
    const aWeight=a.onRail?.08:.5,bWeight=b.onRail?.08:.5,total=aWeight+bWeight;
    const correction=Math.min(25,contact.depth*.48);
    a.x-=contact.x*correction*(aWeight/total);a.y-=contact.y*correction*(aWeight/total);
    b.x+=contact.x*correction*(bWeight/total);b.y+=contact.y*correction*(bWeight/total);
    const relative=(b.vx-a.vx)*contact.x+(b.vy-a.vy)*contact.y;
    if(relative<0){
      const impulse=-relative*.32;
      if(!a.onRail){a.vx-=contact.x*impulse;a.vy-=contact.y*impulse;}
      if(!b.onRail){b.vx+=contact.x*impulse;b.vy+=contact.y*impulse;}
    }
    const twist=Math.sin(b.angle-a.angle)*.015;
    a.spin=clamp(a.spin-twist,-MAX_SPIN,MAX_SPIN);b.spin=clamp(b.spin+twist,-MAX_SPIN,MAX_SPIN);
  }
}

function updateDerailed(world,h,dt) {
  const peak=Math.max(...h.carriages.map(c=>Math.hypot(c.vx,c.vy))),steps=Math.max(2,Math.min(14,Math.ceil(peak*dt/42))),step=dt/steps;
  for(let i=0;i<steps;i++){
    for(const car of h.carriages){
      if(carriageSupported(world,car)){
        car.y=TRAIN_Y-TRAIN_HEIGHT/2;car.vy=0;car.angle*=Math.exp(-16*step);car.spin*=Math.exp(-12*step);
      }else{
        car.onRail=false;car.vy=clamp(car.vy+GRAVITY*step,-MAX_FALL,MAX_FALL);
        car.vx*=Math.exp(-.055*step);car.spin*=Math.exp(-.12*step);
      }
      car.x+=car.vx*step;car.y+=car.vy*step;car.angle+=car.spin*step;
      if(car.angle>Math.PI)car.angle-=Math.PI*2;else if(car.angle< -Math.PI)car.angle+=Math.PI*2;
    }
    solveCouplers(h,step);
    solveCarriageContacts(h);
    for(const car of h.carriages)impactTerrain(world,car,step);
    strikeMatter(world,h,step);
  }
  const count=h.carriages.length;
  h.bodyX=h.carriages.reduce((n,c)=>n+c.x,0)/count;h.bodyY=h.carriages.reduce((n,c)=>n+c.y,0)/count;
  h.vx=h.carriages.reduce((n,c)=>n+c.vx,0)/count;h.vy=h.carriages.reduce((n,c)=>n+c.vy,0)/count;
  h.angle=h.carriages.reduce((n,c)=>n+c.angle,0)/count;h.spin=h.carriages.reduce((n,c)=>n+c.spin,0)/count;
  const boxes=trainCollisionBoxes(h);
  if(boxes.every(b=>b.y>H+1800||b.x>W+4300||b.x+b.w< -4300)){h.done=true;h.active=false;}
}

export function updateTrain(world,h,dt) {
  if(world.prediction)return;
  if(h.derailed){h.age+=dt;updateDerailed(world,h,dt);return;}
  const approaches=[25,2535].every(x=>railAt(world,x,h.y));
  if(!approaches&&!h.active){h.done=true;h.warning=0;return;}
  const old=trainPose(h.age);h.age+=dt;
  const next=trainPose(h.age);Object.assign(h,next,{angle:0,vx:next.dir*TRAIN_SPEED,vy:0,spin:0});
  if(!h.active){h.bodyX=h.dir===1?-h.w:W+h.w;}
  if(h.warning>0&&!old.warning)world.event("hazard",{x:h.dir===1?0:W,y:h.y,kind:"train-warning"});
  if(!h.active&&!old.active)return;
  if(!old.active)world.event("hazard",{x:1280,y:h.y,kind:"train"});
  const gapX=h.active?missingRailUnderTrain(world,h):null;
  if(gapX!==null){derail(world,h,gapX);updateDerailed(world,h,dt);return;}
  const previous=old.active?old.bodyX:(h.dir===1?-h.w/2:W+h.w/2);
  const current=h.active?h.bodyX:(h.dir===1?W+h.w/2:-h.w/2);
  const sweep={x:Math.min(previous,current)-h.w/2,y:h.y-h.h,w:h.w+Math.abs(current-previous),h:h.h};
  for(const p of world.players)if(p.alive&&overlap(playerBox(p),sweep)){p.vx=h.dir*2100;p.vy=-380;world.kill(p,{effect:"blend",cause:"train",angle:h.dir});}
  for(const rag of world.ragdolls){
    if(rag.effect==="singularity"||!rag.points.some(p=>overlap({x:p.x-4,y:p.y-4,w:8,h:8},sweep)))continue;
    if(rag.effect!=="blend"){delete rag.anchor;delete rag.ash;deathPose(rag,"blend");}
    for(const q of rag.points)if(overlap({x:q.x-4,y:q.y-4,w:8,h:8},sweep)){q.px=q.x-h.dir*2100*dt;q.py=q.y+380*dt;}
  }
  for(const b of world.cover)if(b.hp>0&&overlap(b,sweep)){b.vx=h.dir*1500;b.vy=-300;world.damageCover(b,1000);}
  for(const b of world.chunks)if(b.hp>0&&overlap(b,sweep)){b.vx=h.dir*1500;b.vy=-300;b.spin=h.dir*8;}
  for(const d of world.drops)if(overlap({x:d.x-8,y:d.y-8,w:16,h:16},sweep)){d.vx=h.dir*1700;d.vy=-300;}
  for(const b of world.projectiles){const box={x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2};if(trainIntersects(h,box))b.life=0;}
}
