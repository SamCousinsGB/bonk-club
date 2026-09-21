import { liquidBounds } from './liquid-geometry.js';
import { flowLiquidReservoirs, liquidDrag, liquidTransfer } from './liquid.js';
import { segmentBox } from './collision.js';
import { impulseProp } from './props.js';

const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const SHIP = Object.freeze({ x:1280, y:800, sea:900, top:680, bottom:1130, oxygen:12,
  edges:[230,654,1078,1502,1926,2350] });
export const shipBottom = x => Math.min(1130,680+(x-230)*450/210,680+(2350-x)*450/230);
export const shipCell = x => x<230 || x>2350 ? -1 : Math.min(4,Math.floor((x-230)/424));
export function shipHull() {
  const out=[];
  for(let y=680;y<1130;y+=18) {
    const inset=(y-680)/450;
    out.push({x:202+210*inset,y,w:37,h:18}, {x:2350-230*inset,y,w:38,h:18});
  }
  for(let x=412;x<2140;x+=96)out.push({x,y:1130,w:Math.min(96,2140-x),h:28});
  return out.map(p=>({...p,material:'metal',shipHull:true,boundary:p.y<1130,destructible:true,panel:'metal',hp:120,maxHp:120}));
}
export const shipCapacity = i => volumeAt(i,680,0);
// Volume and free surfaces use the same cross-section as the visible cutaway.
// A horizontal world surface becomes a sloping line in the ship's local frame.
export function volumeAt(i,level,slope) {
  const x0=SHIP.edges[i],dx=424/16;let area=0;
  for(let n=0;n<16;n++) {const x=x0+(n+.5)*dx;area+=Math.max(0,shipBottom(x)-Math.max(680,level+slope*(x-1280)))*dx;}
  return area;
}
export function waterLevel(i,volume,angle) {
  if(volume<=.001)return 1800;
  const slope=-Math.tan(angle);
  // A saturated compartment has a plateau of equally full solutions. Choose
  // the lowest full surface instead of inventing an arbitrarily high head.
  if(volume>=shipCapacity(i)-.001)return Math.min(...[SHIP.edges[i]+13.25,SHIP.edges[i+1]-13.25].map(x=>680-slope*(x-1280)));
  let lo=-1000,hi=2100;
  for(let n=0;n<22;n++){const mid=(lo+hi)/2;if(volumeAt(i,mid,slope)>volume)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
export const seaLevel = (s,x) => 800+(SHIP.sea-800-s.sink)/Math.cos(s.angle)-Math.tan(s.angle)*(x-1280);
export const compartmentLevel = (s,i,x) => waterLevel(i,s.volumes[i],s.angle)-Math.tan(s.angle)*(x-1280);
export function createShip(arena) {
  return arena.ship ? {angle:0,omega:0,sink:0,vy:0,age:0,volumes:[0,0,0,0,0],currents:[0,0,0,0,0],charges:[0,0,0,0,0],sparks:[0,0,0,0,0]} : null;
}
export function validShip(s) {
  return !!s && ['charges','sparks'].every(k=>Array.isArray(s[k])&&s[k].length===5&&s[k].every(v=>Number.isFinite(v)&&v>=0&&v<=1)) && ['angle','omega','sink','vy','age'].every(k=>Number.isFinite(s[k])) &&
    Math.abs(s.angle)<=.56 && Math.abs(s.omega)<=.3 && s.sink>=-60 && s.sink<=1100 && Math.abs(s.vy)<=100 && s.age>=0 &&
    Array.isArray(s.volumes)&&s.volumes.length===5&&s.volumes.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=shipCapacity(i)+.02) &&
    Array.isArray(s.currents)&&s.currents.length===5&&s.currents.every(v=>Number.isFinite(v)&&Math.abs(v)<=240);
}
export function shipPose(s) {return {angle:s?.angle||0,x:0,y:(s?.sink||0)*.25,scale:.9};}
export function shipLocalPoint(p,s) {
  const pose=shipPose(s),c=Math.cos(pose.angle),sn=Math.sin(pose.angle),x=(p.x-1280)/pose.scale,y=(p.y-800-pose.y)/pose.scale;
  return {x:1280+x*c+y*sn,y:800-x*sn+y*c};
}
const topology=new WeakMap();
// Scan actual surviving shell/bulkheads. A dent leaves at least one solid on
// the ray and stays watertight. Destroyed metal never seals an invisible wall.
export function shipOpenings(world) {
  const cached=topology.get(world);
  if(cached?.platforms===world.platforms&&cached.version===world.terrainVersion)return cached.openings;
  const hull=world.platforms.filter(p=>p.shipHull&&p.hp!==0),walls=world.platforms.filter(p=>p.shipBulkhead&&p.hp!==0),openings=[];
  for(let x=452;x<2120;x+=26.5) {
    const y=1130;
    if(!hull.some(p=>segmentBox(x,y-36,x,y+44,p)))openings.push({i:shipCell(x),j:-1,x,y,width:26.5});
  }
  for(let y=689;y<1130;y+=18)for(const side of [-1,1]) {
    const x=side<0?230+(y-680)*210/450:2350-(y-680)*230/450;
    if(!hull.some(p=>segmentBox(x-48,y,x+48,y,p)))openings.push({i:shipCell(x),j:-1,x,y,width:18});
  }
  for(let i=0;i<4;i++)for(let y=696;y<1128;y+=24) {
    const x=SHIP.edges[i+1];
    if(!walls.some(p=>segmentBox(x-24,y,x+24,y,p)))openings.push({i,j:i+1,x,y,width:24});
  }
  topology.set(world,{platforms:world.platforms,version:world.terrainVersion,openings});return openings;
}
const displacement = s => SHIP.edges.slice(0,5).reduce((v,_,i)=>v+volumeAt(i,seaLevel(s,1280),-Math.tan(s.angle)),0);
const dryDisplacement=displacement({angle:0,sink:0});
const levelsCache=new WeakMap();
export function shipLevels(s) {
  const key=`${s.angle}:${s.volumes.join(',')}`,old=levelsCache.get(s);
  if(old?.key===key)return old.levels;
  const levels=s.volumes.map((v,i)=>waterLevel(i,v,s.angle));levelsCache.set(s,{key,levels});return levels;
}
export function shipWaterAt(world,x,y) {
  const s=world.ship;if(!s)return null;
  const i=shipCell(x),inside=i>=0&&y>=680&&y<=shipBottom(x);
  const level=inside?shipLevels(s)[i]-Math.tan(s.angle)*(x-1280):seaLevel(s,x);
  return y>level ? {depth:y-level,vx:inside?s.currents[i]:24*Math.sin(s.age*.7),i:inside?i:-1} : null;
}
// The same controls and host-owned oxygen apply in Waterworks' free pool.
export function swimmingWaterAt(world,x,y) {
  if(world.ship)return shipWaterAt(world,x,y);
  if(!world.arena?.waterworks)return null;
  for(const q of world.water||[])if(!q.frozen && q.grounded && q.h>22) {
    const b=liquidBounds(q);
    if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return {depth:y-b.y,vx:q.vx||0};
  }
  return null;
}
export function updateShip(world,dt) {
  const s=world.ship;if(!s||world.prediction)return;
  s.age+=dt;
  const levels=shipLevels(s),slope=-Math.tan(s.angle),ports=[];
  const transfer=(i,j,x,y,width)=>{
    const a=levels[i]+slope*(x-1280),b=j<0?seaLevel(s,x):levels[j]+slope*(x-1280);
    const headA=Math.max(0,y-a),headB=Math.max(0,y-b),head=headB-headA;
    ports.push({i,j,head,width,direction:j<0?(x<1280?1:-1):-1});
  };
  for(const b of shipOpenings(world))transfer(b.i,b.j,b.x,b.y,b.width);
  // Open hatches/downflooding once a deck edge is underwater. This is driven
  // by the ocean level, so a dry above-water hole cannot magically flood.
  for(let i=0;i<5;i++)for(const x of [SHIP.edges[i]+80,SHIP.edges[i+1]-80])transfer(i,-1,x,680,45);
  const flow=flowLiquidReservoirs(s.volumes,s.volumes.map((_,i)=>shipCapacity(i)),ports,dt);
  for(let i=0;i<5;i++) {s.currents[i]+=(clamp(flow[i]/Math.max(dt,1e-6)/320,-240,240)-s.currents[i])*Math.min(1,dt*3);}
  const flooded=s.volumes.reduce((a,b)=>a+b,0),lift=displacement(s);
  // Lost reserve buoyancy changes heave; asymmetric flood mass creates torque.
  // Fully flooded hulls have more weight than maximum displacement and sink.
  const acceleration=clamp((dryDisplacement+flooded-lift)/2800,-85,95)-s.vy*1.4;
  s.vy=clamp(s.vy+acceleration*dt,-50,95);s.sink=clamp(s.sink+s.vy*dt,-60,1100);
  if(s.sink===1100)s.vy=0;
  const moment=s.volumes.reduce((m,v,i)=>m+v*((SHIP.edges[i]+212-1280)/1060),0);
  const target=clamp(moment/350000,-.50,.50)+.009*Math.sin(s.age*.72);
  s.omega=clamp(s.omega+((target-s.angle)*.75-s.omega*1.6)*dt,-.28,.28);
  s.angle=clamp(s.angle+s.omega*dt,-.55,.55);
  const gx=1800*Math.sin(s.angle),gy=1800*(Math.cos(s.angle)-1);
  for(const b of [...world.cover,...world.chunks])if(b.hp>0) {
    const wet=shipWaterAt(world,b.x+b.w/2,b.y+b.h*.7),fraction=wet?clamp(wet.depth/Math.max(12,b.h),0,1):0;
    if(wet){b.fire=0;b.cold=Math.max(b.cold||0,.3);b.soaked=2;}
    const lift=1400*(b.material==='wood'?1.35:b.material==='metal'?.48:.75)*fraction;
    const drag=liquidDrag(dt,fraction,3);
    impulseProp(b,(gx*dt+((wet?.vx||0)-b.vx)*drag)*b.mass,(gy*dt-lift*dt-b.vy*drag)*b.mass);
  }
  for(const list of [world.drops,world.debris,world.blood,world.projectiles])for(const p of list||[]) {
    const wet=shipWaterAt(world,p.x,p.y),drag=wet?(1-liquidDrag(dt,1,list===world.projectiles?1.4:3)):1;
    if(Number.isFinite(p.vx)){p.vx=p.vx*drag+gx*dt;p.vy=p.vy*drag+(gy-(wet&&list!==world.projectiles?1050:0))*dt;}
  }
  for(const rag of world.ragdolls||[])for(const q of rag.points||[]) {
    const wet=shipWaterAt(world,q.x,q.y),drag=wet?(1-liquidDrag(dt,1,3)):1;
    q.px=q.x-(q.x-q.px)*drag-gx*dt*dt;q.py=q.y-(q.y-q.py)*drag-(gy-(wet?1550:0))*dt*dt;
  }
}

// Called by shared host/guest movement; only authority changes oxygen/health.
export function swimPlayer(world,p,input,dt) {
  if(!world.ship&&!world.arena?.waterworks)return input;
  const wet=swimmingWaterAt(world,p.x,p.y+16),head=swimmingWaterAt(world,p.rig?.[0]?.x??p.x,p.rig?.[0]?.y??p.y-40);
  p.submerged=!!head;p.swimming=!!wet&&wet.depth>22;
  if(!world.prediction) {
    p.oxygen=clamp((p.oxygen??12)+(head?-dt:dt*3),0,12);
    if(wet)p.burn=0;
    if(head&&p.oxygen===0&&world.phase==='fight'){p.hp=Math.max(0,p.hp-dt*16);if(!p.hp)world.kill(p,{cause:'drowning'});}
  }
  const angle=world.ship?.angle||0;
  p.vx+=1800*Math.sin(angle)*dt;p.vy+=1800*(Math.cos(angle)-1)*dt;
  if(!p.swimming)return input;
  const immersion=clamp(wet.depth/65,0,1),drag=(1-liquidDrag(dt,immersion,3.7));
  p.vx=(p.vx-(wet.vx||0))*drag+(wet.vx||0);p.vy=p.vy*drag-1810*immersion*dt;
  if(p.knockdown>0)for(const q of p.rig||[]){q.px=q.x-(q.x-q.px)*drag;q.py=q.y-(q.y-q.py)*drag+1810*immersion*dt*dt;}
  const able=!p.freeze&&p.stun<=0&&!p.knockdown;
  p.swimStroke=!!input.attack&&able;
  if(p.swimStroke) {
    const a=input.aim??p.aimAngle??-Math.PI/2,strength=p.carryId?600:1150;
    p.vx+=Math.cos(a)*strength*dt;p.vy+=Math.sin(a)*strength*dt;
    p.ground=false;p.support=null;
  }
  if(input.jump&&able){p.vx-=Math.sin(angle)*650*dt;p.vy-=Math.cos(angle)*650*dt;}
  p.jumps=1;p.jumpBuffer=0;
  return {...input,jump:false,duck:false};
}
export function shipSwimControls(world,p) {
  if((swimmingWaterAt(world,p.x,p.y+16)?.depth||0)<=22)return null;
  // Swim towards open air, routing around intact decks using their nearest end.
  const overhead=world.platforms.filter(q=>q.hp!==0&&q.y<p.y&&q.y>p.y-230&&p.x>q.x-18&&p.x<q.x+q.w+18)
    .sort((a,b)=>b.y-a.y)[0];
  let dx=-Math.sin(world.ship?.angle||0)*90,dy=-130;
  if(world.arena.waterworks)dx=p.x<1280?-160:160;
  if(overhead){const left=overhead.x-45,right=overhead.x+overhead.w+45;dx=(Math.abs(p.x-left)<Math.abs(p.x-right)?left:right)-p.x;dy=-25;}
  return {left:false,right:false,jump:false,duck:false,attack:true,block:false,throw:false,aim:Math.atan2(dy,dx)};
}


// Reservoir water joins the same electrical graph as free droplets and metal.
// Clip the actual hull cross-section by compartment edges and the free surface.
export function shipWaterRegions(state) {
  const s=state.ship;if(!s)return [];
  const levels=shipLevels(s),slope=-Math.tan(s.angle);
  return s.volumes.flatMap((volume,i)=>{
    if(volume<=.001)return [];
    let poly=[{x:230,y:680},{x:440,y:1130},{x:2120,y:1130},{x:2350,y:680}];
    for(const distance of [p=>p.x-SHIP.edges[i],p=>SHIP.edges[i+1]-p.x,p=>p.y-levels[i]-slope*(p.x-1280)]) {
      const next=[];
      for(let n=0;n<poly.length;n++) {
        const a=poly[n],b=poly[(n+1)%poly.length],da=distance(a),db=distance(b);
        if(da>=0)next.push(a);
        if((da>=0)!==(db>=0)){const t=da/(da-db);next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
      }
      poly=next;
    }
    if(poly.length<3)return [];
    const x=Math.min(...poly.map(p=>p.x)),y=Math.min(...poly.map(p=>p.y));
    return [{id:`ship-water-${i}`,shipCell:i,x,y,w:Math.max(...poly.map(p=>p.x))-x,h:Math.max(...poly.map(p=>p.y))-y,
      grounded:true,polygon:poly,get charge(){return s.charges[i];},set charge(v){s.charges[i]=v;},
      get spark(){return s.sparks[i];},set spark(v){s.sparks[i]=v;}}];
  });
}

export function absorbShipWater(world) {
  const s=world.ship;if(!s || world.prediction)return;
  for(const q of world.water) {
    if(q.frozen || q.h<=0)continue;
    const x=q.x+q.w/2,y=q.y+q.h,i=shipCell(x);
    if(i<0 || y<680 || y>shipBottom(x)+3)continue;
    if(!shipWaterAt(world,x,y) && !(q.grounded && y>=shipBottom(x)-3))continue;
    const take=liquidTransfer(q.w*q.h,q.w*q.h,shipCapacity(i)-s.volumes[i]);
    if(take>0){s.sparks[i]=Math.max(s.sparks[i],q.spark||0);s.charges[i]=Math.max(s.charges[i],q.charge||0);}
    s.volumes[i]+=take;q.h-=take/q.w;q.y+=take/q.w;
  }
  world.water=world.water.filter(q=>q.h>1e-8);
}
