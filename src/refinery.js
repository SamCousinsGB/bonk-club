import {REFINERY_TANKS as TANKS,REFINERY_PIPES as PIPES,REFINERY_ROUTES as ROUTES} from './refinery-arena.js';
import {emitLiquid,liquidTouches} from './liquid.js';
import {fractureProp,prepareProp} from './props.js';
import {playerBox} from './collision.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const live=p=>p.hp!==0&&!p.wreckId;
const contains=(p,x,y)=>live(p)&&x>=p.x-.01&&x<=p.x+p.w+.01&&y>=p.y-.01&&y<=p.y+p.h+.01;
const topology=new WeakMap();
export function resetRefinery(world){
  world.refinery=world.arena.refinery?{
    clock:0,heat:0,processed:0,released:0,combusted:0,
    tanks:TANKS.map((t,id)=>({id,volume:t.initial,temperature:0,pressure:0,warning:0,burst:false})),
    pipes:PIPES.map(p=>({id:p.id,volume:0,flow:0,broken:false})),
    products:[0,0,0],
  }:null;
  topology.delete(world);
}
// Search the actual surviving bore, rather than an original bounding box. A
// shallow dent can leave it connected; a complete cross-cut opens both ends.
export function pipeOpening(platforms,id){
  const p=PIPES[id],vertical=p.x===p.ex,start=vertical?p.y:p.x,end=vertical?p.ey:p.ex,sign=Math.sign(end-start),length=Math.abs(end-start);
  const intervals=platforms.filter(q=>q.refineryPipe===id&&live(q)&&
    (vertical?p.x>=q.x&&p.x<=q.x+q.w:p.y>=q.y&&p.y<=q.y+q.h)).map(q=>{
      const a=vertical?q.y:q.x,b=a+(vertical?q.h:q.w);
      return sign>0?[a-start,b-start]:[start-b,start-a];
    }).sort((a,b)=>a[0]-b[0]);
  let reached=0,gapEnd=length;
  for(const [a,b] of intervals){if(a>reached+.5){gapEnd=Math.min(length,a);break;}reached=Math.max(reached,b);}
  if(reached>=length-.5)return null;
  // A removed section starts inside the preceding flange or vessel port.
  // Release beyond that lip, while remaining inside the actual missing bore.
  // Small blast cuts keep the outlet centred inside their narrower opening.
  const t=clamp(reached+Math.min(16,(gapEnd-reached)/2),0,length)/length;
  return {x:p.x+(p.ex-p.x)*t,y:p.y+(p.ey-p.y)*t,vx:vertical?0:sign*200,vy:vertical?sign*200:30};
}
export function tankOpenings(platforms,id){
  const t=TANKS[id],parts=platforms.filter(p=>p.refineryTank===id&&live(p)),out=[];
  for(const side of [-1,1]){
    const x=side<0?t.x+8:t.x+t.w-8;
    for(let y=t.y+t.h-24;y>=t.y+24;y-=16)if(!parts.some(p=>contains(p,x,y))){out.push({x:x+side*16,y,side});break;}
  }
  for(let x=t.x+24;x<t.x+t.w-16;x+=16)if(!parts.some(p=>contains(p,x,t.y+t.h-8))){out.push({x,y:t.y+t.h+8,side:0});break;}
  // An open roof vents gas and relieves pressure, but does not drain liquid.
  for(let x=t.x+24;x<t.x+t.w-16;x+=16)if(!parts.some(p=>contains(p,x,t.y+8))){out.push({x,y:t.y-8,side:0,roof:true});break;}
  return out;
}
function geometry(world){
  let g=topology.get(world);
  if(!g||g.version!==world.terrainVersion||g.platforms!==world.platforms){
    g={version:world.terrainVersion,platforms:world.platforms,pipes:PIPES.map(p=>pipeOpening(world.platforms,p.id)),tanks:TANKS.map((_,i)=>tankOpenings(world.platforms,i))};topology.set(world,g);
  }
  return g;
}
function release(world,kind,amount,at,hot=false){
  if(!(amount>1e-8))return 0;
  if(kind==='gas'){
    // Coalesce only the current outlet's unlit cloud; a full atmosphere queue
    // leaves material in the pipe/tank instead of silently deleting it.
    const g=world.gas.find(g=>g.spray&&!g.lit&&g.life>2.7&&Math.hypot(g.x-at.x,g.y-at.y)<28&&g.r<50);
    let accepted;
    if(g){accepted=Math.min(amount,(50-g.r)/2);g.r+=accepted*2;}
    else if(world.gas.length<24){accepted=Math.min(amount,12);world.gas.push({id:++world.reactionSerial,x:at.x,y:at.y,vx:clamp(at.vx||0,-450,450),vy:clamp((at.vy||0)-75,-450,450),r:Math.min(50,8+accepted*2),life:3.2,lit:hot?.22:0,owner:0,spray:true});}
    else return 0;
    return accepted;
  }
  return emitLiquid(world,kind,at.x,at.y,amount,{vx:at.vx||0,vy:at.vy||100,depth:36,centered:true,fire:hot});
}
export function heatRefinery(world,touches,amount){
  const r=world.refinery;if(!r||world.prediction||world.phase!=='fight')return;
  r.tanks.forEach((q,i)=>{if(touches(TANKS[i]))q.temperature=clamp(q.temperature+amount,0,4);});
}
export function refineryDanger(world,x,y){
  return !!world.refinery?.tanks.some((q,i)=>q.warning>0&&Math.hypot(x-(TANKS[i].x+TANKS[i].w/2),y-(TANKS[i].y+TANKS[i].h/2))<refineryBlastRadius(i,q.volume)+50);
}
export const refineryBlastRadius=(id,volume)=>Math.min(300,100+Math.sqrt(volume)*(id===3?7:5));
export function refineryLiquids(r){
  if(!r)return [];
  return TANKS.flatMap((t,i)=>{
    if(t.kind==='gas'||r.tanks[i].volume<.01)return [];
    const h=(t.h-32)*r.tanks[i].volume/t.capacity;
    return [{reservoir:true,kind:t.kind,x:t.x+16,y:t.y+t.h-16-h,w:t.w-32,h,vx:0,vy:0,grounded:true}];
  });
}
function shrapnel(world,id,at){
  const p=PIPES[id],horizontal=p.y===p.ey;
  fractureProp(world,prepareProp({id:'pipe-break-'+id,kind:'cabinet',x:at.x-12,y:at.y-12,w:horizontal?32:24,h:horizontal?24:32,hp:0,maxHp:20,mass:7,vx:at.vx*.5,vy:-90,angle:0,spin:2}));
}
export function updateRefinery(world,dt){
  const r=world.refinery;if(!r||world.prediction||world.phase!=='fight'||!(dt>0))return;
  r.clock+=dt;
  // Process physics shares the liquid tick; stored contents and queues are
  // independent of render rate. Bounded substeps also support direct test ticks.
  const ticks=Math.ceil(dt/.05),step=dt/ticks;
  for(let tick=0;tick<ticks;tick++)advance(world,r,step);
}
function advance(world,r,dt){
  const g=geometry(world),core=r.tanks[1];
  const burner=world.platforms.some(p=>p.refineryTank===1&&contains(p,1280,1312));
  r.heat=clamp(r.heat+dt*(burner&&core.volume>3&&!core.burst?.22:-.15),0,1);
  // Conversion is conservative and halts under downstream backpressure.
  const yields=[.5,.3,.2],amount=Math.min(core.volume,26*r.heat*dt,...r.products.map((v,i)=>(80-v)/yields[i]));
  if(amount>0&&!core.burst){core.volume-=amount;r.processed+=amount;r.products.forEach((_,i)=>r.products[i]+=amount*yields[i]);}
  for(const route of ROUTES){
    const rIndex=PIPES[route.ids[0]].route,source=rIndex?r.products[rIndex-1]:r.tanks[0].volume;
    const first=r.pipes[route.ids[0]],admit=Math.max(0,Math.min(source,route.rate*dt,PIPES[first.id].capacity-first.volume));
    if(rIndex)r.products[rIndex-1]-=admit;else r.tanks[0].volume-=admit;
    first.volume+=admit;
    // Reverse order prevents one simulation tick from teleporting feed through
    // every empty pipe. Filled sections drive the next by their pressure head.
    for(let k=route.ids.length-1;k>=0;k--){
      const id=route.ids[k],q=r.pipes[id],p=PIPES[id],opening=g.pipes[id];q.flow=0;
      if(opening){
        if(!q.broken){shrapnel(world,id,opening);q.broken=true;}
        const n=release(world,route.kind,Math.min(q.volume,32*dt),opening);
        q.volume=Math.max(0,q.volume-n);q.flow=n/dt;r.released+=n;continue;
      }
      const next=r.pipes[route.ids[k+1]],dest=next||r.tanks[route.to],capacity=next?PIPES[next.id].capacity:TANKS[route.to].capacity;
      const head=Math.max(0,q.volume/p.capacity-dest.volume/capacity*.65);
      const n=Math.max(0,Math.min(q.volume,capacity-dest.volume,route.rate*dt*Math.min(1,head*4)));
      q.volume-=n;dest.volume+=n;q.flow=n/dt;
    }
  }
  for(let i=0;i<TANKS.length;i++){
    const t=TANKS[i],q=r.tanks[i],holes=g.tanks[i],level=t.y+t.h-16-(t.h-32)*q.volume/t.capacity;
    for(const hole of holes){
      if(t.kind!=='gas'&&(hole.roof||hole.y<level))continue;
      const head=t.kind==='gas'?80:Math.max(0,hole.y-level),speed=Math.min(430,Math.sqrt(head*1600));
      const n=release(world,t.kind,Math.min(q.volume,speed*.22*dt),{...hole,vx:hole.side*speed,vy:hole.roof?-160:hole.side?30:200},q.temperature>1.1);
      q.volume=Math.max(0,q.volume-n);r.released+=n;
    }
    // Real water/coolant exposure cools the vessel; existing fire heats it.
    const cooled=world.water.some(w=>!w.frozen&&liquidTouches(w,t))||world.spills.some(s=>s.kind==='coolant'&&liquidTouches(s,t));
    const burning=world.spills.some(s=>s.fire>0&&liquidTouches(s,t));
    q.temperature=clamp(q.temperature+dt*(cooled?-1.5:burning?.65:-.12),0,4);
    const jam=i===1&&r.products.some(v=>v>74),sealed=!holes.length;
    const target=sealed?clamp(q.volume/t.capacity*.36+q.temperature*.65+(jam?r.heat*.95:0),0,2):0;
    q.pressure+=clamp(target-q.pressure,-dt*1.8,dt*.5);
    if(q.burst||q.volume<15||t.kind==='acid'){q.warning=0;continue;}
    if(q.pressure>1||q.temperature>1.4){
      if(!q.warning)q.warning=2.4;
      else q.warning=Math.max(.000001,q.warning-dt);
    }else if(cooled||q.pressure<.5){q.warning=0;}
    if(q.warning>0&&q.warning<=dt){
      q.burst=true;q.warning=0;
      const burn=q.volume*.65;q.volume-=burn;r.combusted+=burn;
      // Internal pressure tears the shell outward before the blast is traced.
      // The failed vessel cannot shield the entire surrounding arena from its
      // own explosion. Other surviving cover still shields normally.
      const shell=world.platforms.filter(p=>p.refineryTank===i&&live(p));
      for(const p of shell.toSorted((a,b)=>b.w*b.h-a.w*a.h).slice(0,4)){
        const nx=Math.ceil(p.w/160),ny=Math.ceil(p.h/160);
        for(let a=0;a<nx;a++)for(let b=0;b<ny;b++){
          const x=p.x+a*p.w/nx,y=p.y+b*p.h/ny,w=p.w/nx,h=p.h/ny;
          fractureProp(world,prepareProp({id:'tank-break-'+i,kind:'cabinet',x,y,w,h,hp:0,maxHp:20,mass:w*h*.005,vx:(x+w/2-t.x-t.w/2)*2,vy:-180,angle:0,spin:1.5}));
        }
      }
      world.platforms=world.platforms.filter(p=>p.refineryTank!==i);world.terrainVersion++;
      world.explode({x:t.x+t.w/2,y:t.y+t.h/2,kind:'grenade',weapon:'gas',owner:-1,refineryBurst:true,radius:refineryBlastRadius(i,burn),damage:80,force:1050});
      q.temperature=2.5;
    }
  }
  // If the processing chamber is ruptured, separated products cannot remain
  // in invisible buffers. They escape from its actual breach as well.
  if(g.tanks[1].length)for(let i=0;i<3;i++){
    const n=release(world,ROUTES[i+1].kind,Math.min(r.products[i],12*dt),{...g.tanks[1][0],vx:g.tanks[1][0].side*160,vy:80},core.temperature>1.1);
    r.products[i]-=n;r.released+=n;
  }
  for(const q of refineryLiquids(r))for(const p of world.players)if(p.alive&&liquidTouches(q,playerBox(p))){
    if(q.kind==='acid')world.hit(p,{x:p.x,y:p.y,vx:0,vy:0,stun:0},24*dt,0,1,0,{cause:'acid'});
    else p.oiled=Math.max(p.oiled||0,.3);
  }
}
export function validRefinery(r){
  const number=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  return !!r&&number(r.clock,0,1e7)&&number(r.heat,0,1)&&number(r.processed,0,10000)&&number(r.released,0,10000)&&number(r.combusted,0,10000)&&
    Array.isArray(r.products)&&r.products.length===3&&r.products.every(v=>number(v,0,80.01))&&
    Array.isArray(r.tanks)&&r.tanks.length===TANKS.length&&r.tanks.every((q,i)=>q&&q.id===i&&number(q.volume,0,TANKS[i].capacity+.01)&&number(q.temperature,0,4)&&number(q.pressure,0,2)&&number(q.warning,0,2.4)&&typeof q.burst==='boolean')&&
    Array.isArray(r.pipes)&&r.pipes.length===PIPES.length&&r.pipes.every((q,i)=>q&&q.id===i&&number(q.volume,0,PIPES[i].capacity+.01)&&number(q.flow,0,32.01)&&typeof q.broken==='boolean');
}
