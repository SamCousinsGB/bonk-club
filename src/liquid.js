import { W, H } from './scale.js';
import { segmentBox, playerBox } from './collision.js';
import { bodyBounds, impulseProp } from './props.js';
import { carryImpulse } from './impact.js';
import { knockDown } from './knockdown.js';

export const WATER_LIMIT = 384, WATER_WIDTH = 32, WATER_DEPTH = 640, TANK_CAPACITY = 1200;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
// Local tick history is never transported or reused as stored electrical power.
const contacts = new WeakMap();
export const waterWireContact = q => contacts.get(q) === true;

export function emitWater(world,x,y,amount,velocity={}) {
  if (!(amount>0) || !Number.isFinite(x+y+amount) || x<0 || x>W || y<=-200 || y>H+80) return 0;
  let left=amount;
  // Admit a compact body of water, not a map-wide row of thin puddles. Retain
  // unaccepted volume in the tank when the bounded simulation is occupied.
  const depth=Math.min(y+200,clamp(Math.sqrt(amount*WATER_WIDTH)*.65,24,160));
  for(let n=0;n<WATER_LIMIT && left>1e-8;n++) {
    const offset=n?Math.ceil(n/2)*(n%2?1:-1):0;
    const column=Math.floor(x/WATER_WIDTH)*WATER_WIDTH+offset*WATER_WIDTH;
    if(column<0 || column+WATER_WIDTH>W)continue;
    if(world.platforms.some(p=>p.hp!==0 && !p.waterId &&
      segmentBox(x,y-1,column+WATER_WIDTH/2,y-1,p)))continue;
    let q=world.water.find(q=>!q.frozen && Math.abs(q.x-column)<.01 && Math.abs(q.y+q.h-y)<4);
    if(q && q.h>=depth)continue;
    if(!q) {
      if(world.water.length>=WATER_LIMIT)break;
      q={id:++world.reactionSerial,x:column,y,w:WATER_WIDTH,h:0,vx:0,vy:0,grounded:false,frozen:0,spark:0,charge:0};
      world.water.push(q);
    }
    const take=Math.min(left,depth-q.h),old=q.h;
    const vx=clamp((velocity.vx||0)+(velocity.burst||0)*Math.sign(column+16-x),-900,900);
    q.vx=((q.vx||0)*old+vx*take)/(old+take);
    q.vy=(q.vy*old+clamp(velocity.vy||0,-600,1000)*take)/(old+take);
    q.h+=take;q.y-=take;left-=take;
  }
  return amount-left;
}

function wireSweep(q,old,wires) {
  // Test the actual swept rectangle, including a fast droplet that crosses a
  // thin cable and is already below it at the next electrical tick.
  const dx=q.x-old.x,dy=q.y-old.y;
  const polygon=[{x:old.x,y:old.y},{x:old.x+old.w,y:old.y},
    {x:old.x+old.w,y:old.y+old.h},{x:old.x,y:old.y+old.h},
    {x:q.x,y:q.y},{x:q.x+q.w,y:q.y},{x:q.x+q.w,y:q.y+q.h},{x:q.x,y:q.y+q.h}];
  return wires.some(({a,b})=> {
    const axes=[[1,0],[0,1],[-(b.y-a.y),b.x-a.x],[-dy,dx]];
    return axes.every(([x,y])=>{
      const len=Math.hypot(x,y);if(!len)return true;x/=len;y/=len;
      const values=polygon.map(p=>p.x*x+p.y*y),u=a.x*x+a.y*y,v=b.x*x+b.y*y;
      return Math.max(...values)+5>=Math.min(u,v) && Math.min(...values)-5<=Math.max(u,v);
    });
  });
}

// Finite-volume columns pool at arbitrary depths; gravity transports airborne
// parcels while hydrostatic head and retained momentum drive lateral flux.
// Substeps bound collision travel. Oil/glue/tar keep their separate viscosity.
export function moveLiquid(world,dt,wires,thaw) {
  for(const q of world.water)contacts.set(q,false);
  const steps=Math.ceil(dt/(1/60)),step=dt/steps;
  for(let tick=0;tick<steps;tick++) {
    const solids=world.platforms.filter(p=>p.hp!==0 && p.material!=='cable');
    for(const q of world.water) {
      if(q.h<=0)continue;
      if(q.frozen) {
        const area=solids.filter(p=>p.waterId===q.id).reduce((s,p)=>s+p.w*p.h,0);
        if(Math.abs(area-q.w*q.h)>.1){q.h=0;thaw(world,q);continue;}
        q.frozen=Math.max(0,q.frozen-step);if(!q.frozen)thaw(world,q);
        continue;
      }
      const old={...q},bottom=q.y+q.h;
      q.vx=clamp(q.vx||0,-900,900);
      q.vy=clamp(q.vy+1000*step,-600,1000);
      if(!q.grounded) {
        let nx=clamp(q.x+q.vx*step,0,W-q.w);
        const side=solids.some(p=>p.waterId!==q.id && p.y<bottom-.5 && p.y+p.h>q.y+.5 &&
          segmentBox(q.x+q.w/2,q.y+q.h/2,nx+q.w/2,q.y+q.h/2,p,q.w/2));
        if(side){nx=q.x;q.vx*=.2;}
        q.x=nx;
      }
      const x=q.x+q.w/2;
      let floor=null;
      for(const p of solids)if(p.waterId!==q.id && x>p.x && x<p.x+p.w && p.y>=bottom-.8 &&
        (!floor||p.y<floor.y))floor=p;
      if(q.vy>=0 && floor && bottom+q.vy*step>=floor.y) {
        q.y=floor.y-q.h;q.vy=0;q.grounded=true;
        // Keep columns aligned on landing, unless a side wall occupies that cell.
        const nx=clamp(Math.round(q.x/WATER_WIDTH)*WATER_WIDTH,0,W-q.w);
        if(!solids.some(p=>p!==floor && !p.waterId && overlap({...q,x:nx},p)))q.x=nx;
      } else {
        let ceiling=null;
        if(q.vy<0)for(const p of solids)if(p.waterId!==q.id && x>p.x && x<p.x+p.w &&
          p.y+p.h<=q.y+.8 && q.y+q.vy*step<=p.y+p.h && (!ceiling||p.y+p.h>ceiling.y+ceiling.h))ceiling=p;
        if(ceiling){q.y=ceiling.y+ceiling.h;q.vy=0;}else q.y+=q.vy*step;
        q.grounded=false;
      }
      if(q.y<-200){q.y=-200;q.vy=Math.max(0,q.vy);}
      if(wires.length && wireSweep(q,old,wires))contacts.set(q,true);
    }
    const pools=new Map();
    const key=(x,y)=>`${Math.round(x*10)}:${Math.round(y*10)}`;
    for(const q of world.water)if(q.grounded && !q.frozen && q.h>0) {
      const k=key(q.x,q.y+q.h),old=pools.get(k);
      if(old && old.h+q.h<=WATER_DEPTH) {
        old.vx=((old.vx||0)*old.h+(q.vx||0)*q.h)/(old.h+q.h);
        old.h+=q.h;old.y-=q.h;old.spark=Math.max(old.spark,q.spark);
        if(waterWireContact(q))contacts.set(old,true);q.h=0;
      } else pools.set(k,q);
    }
    // Alternate ordering avoids a permanent left/right bias in dam breaks.
    const ordered=[...pools.values()].sort((a,b)=>(tick%2?1:-1)*(a.x-b.x));
    for(const q of ordered) {
      if(q.h<=.04)continue;
      const floorY=q.y+q.h;
      for(const dir of tick%2?[1,-1]:[-1,1]) {
        const nx=q.x+dir*q.w;if(nx<0 || nx+q.w>W)continue;
        let outletY=floorY;
        for(const p of solids)if(!p.waterId && p.y<floorY && p.y+p.h>=floorY-.5 &&
          segmentBox(q.x+q.w/2,floorY-.2,nx+q.w/2,floorY-.2,p))outletY=Math.min(outletY,p.y);
        const available=q.h-(floorY-outletY);
        if(available<=.02)continue;
        let other=pools.get(key(nx,outletY));
        const head=available-(other?.h||0);
        const speed=clamp(Math.sqrt(1000*Math.max(0,head))*dir+(q.vx||0)*.45,-900,900);
        let flux=Math.min(available*.22,Math.max(0,head-.12)*step*5 + Math.max(0,(q.vx||0)*dir)*available*step/q.w*.24);
        if(flux<.008 || other && other.h>=WATER_DEPTH)continue;
        const surface=outletY-Math.min(available,Math.max(other?.h||0,.5))*.5;
        if(solids.some(p=>!p.waterId && segmentBox(q.x+q.w/2,surface,nx+q.w/2,surface,p)))continue;
        if(!other) {
          if(world.water.length>=WATER_LIMIT)continue;
          other={id:++world.reactionSerial,x:nx,y:outletY,w:q.w,h:0,vx:speed,vy:0,
            grounded:false,frozen:0,spark:0,charge:0};
          world.water.push(other);pools.set(key(nx,outletY),other);
        }
        flux=Math.min(flux,WATER_DEPTH-other.h);
        other.vx=((other.vx||0)*other.h+speed*flux)/(other.h+flux);
        q.h-=flux;q.y+=flux;other.h+=flux;other.y-=flux;
        // A conductive stream remains live only through present contacts.
      }
      q.vx*=Math.exp(-step*2.5);
    }
    world.water=world.water.filter(q=>q.h>1e-8 && q.y<H+80);
  }
}

export function waterForces(world,dt) {
  if(world.prediction || !world.water.length)return;
  const actors=[...world.players.filter(p=>p.alive),...world.cover.filter(p=>p.hp>0),
    ...world.chunks.filter(p=>p.hp>0),...(world.drops||[])];
  for(const b of actors) {
    const fighter=b.alive!==undefined,box=fighter?playerBox(b):b.mass?bodyBounds(b):{x:b.x-8,y:b.y-8,w:16,h:16};
    let area=0,vx=0,vy=0,depth=0;
    for(const q of world.water)if(!q.frozen && overlap(box,q)) {
      const a=Math.max(0,Math.min(box.x+box.w,q.x+q.w)-Math.max(box.x,q.x))*
        Math.max(0,Math.min(box.y+box.h,q.y+q.h)-Math.max(box.y,q.y));
      area+=a;vx+=a*(q.vx||0);vy+=a*q.vy;depth=Math.max(depth,q.h);
    }
    if(!area)continue;
    const immersed=clamp(area/(box.w*box.h),0,1),mass=b.mass||55;
    const drag=1-Math.exp(-dt*immersed*9*Math.sqrt(55/mass));
    const dx=clamp((vx/area-(b.vx||0))*drag,-240,240);
    const buoyancy=depth>10?Math.min(1.12,55/mass)*1400*immersed:0;
    const dy=clamp((vy/area-(b.vy||0))*drag-buoyancy*dt,-180,180);
    if(b.mass)impulseProp(b,dx*mass,dy*mass,box.x+box.w/2,box.y+box.h*.7);
    else {b.vx=(b.vx||0)+dx;b.vy=(b.vy||0)+dy;}
    if(fighter) {
      if(Math.abs(dx)>3 || Math.abs(dy)>3)carryImpulse(b,.18);
      if(!b.knockdown && immersed>.3 && Math.hypot(vx/area,vy/area)>290 && Math.hypot(dx,dy)>35)
        knockDown(b,'water');
    }
  }
  // Death bodies use Verlet particles. Feed the same current into each wetted
  // limb's velocity so a floating corpse still collides and tumbles normally.
  for(const rag of world.ragdolls||[])for(const p of rag.points||[]) {
    const q=world.water.find(q=>!q.frozen && p.x>=q.x && p.x<=q.x+q.w && p.y>=q.y && p.y<=q.y+q.h);
    if(!q)continue;
    const drag=1-Math.exp(-dt*7),vx=(p.x-p.px)*120,vy=(p.y-p.py)*120;
    p.px-=clamp(((q.vx||0)-vx)*drag,-180,180)/120;
    p.py-=clamp((q.vy-vy)*drag-(q.h>10?1650*dt:0),-180,180)/120;
  }
}
