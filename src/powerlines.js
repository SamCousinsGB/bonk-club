import { playerBox, segmentBox } from "./collision.js";
import { POWER_INTERVAL, WIRE_LEFT, WIRE_RIGHT } from "./transmission-arena.js";

export const wirePieces = (state,h) => state.platforms.filter(p=>p.material==="cable"&&p.circuit===h.circuit&&p.hp!==0&&!p.wreckId);
export function intactPowerline(world,h) {
  const pieces=wirePieces(world,h).sort((a,b)=>a.x-b.x);
  let end=WIRE_LEFT;
  for(const p of pieces) {if(p.x>end+.1)return false;end=Math.max(end,p.x+p.w);}
  if(end<WIRE_RIGHT-.1)return false;
  // Losing either insulator's mounting also opens the circuit.
  return [WIRE_LEFT-8,WIRE_RIGHT+8].every(x=>world.platforms.some(p=>
    p.hp!==0&&p.material!=="cable"&&!p.wreckId&&p.x<=x&&p.x+p.w>=x&&Math.abs(p.y-(h.y-28))<2));
}
export function updatePowerline(world,h,dt) {
  if(!intactPowerline(world,h)) {h.done=true;h.active=false;h.warning=0;return;}
  h.age+=dt;
  const phase=(h.age+1e-9)%(POWER_INTERVAL*2),wasActive=h.active;
  h.active=phase>=POWER_INTERVAL;
  h.warning=!h.active&&phase>=POWER_INTERVAL-1?POWER_INTERVAL-phase:0;
  h.duration=h.active?POWER_INTERVAL*2-phase:0;
  h.cooldown=h.active?0:POWER_INTERVAL-phase;
  if(h.active!==wasActive) {
    h.hitIds=[];h.hitTimer=0;
    if(h.active)world.event("hazard",{x:h.x,y:h.y,kind:"tesla"});
  }
  if(!h.active||world.prediction)return;
  h.hitTimer-=dt;
  if(h.hitTimer<=0){h.hitIds=[];h.hitTimer=.8;}
  const pieces=wirePieces(world,h);
  for(const p of world.players) {
    if(!p.alive||h.hitIds.includes(p.id))continue;
    const box=playerBox(p);
    const contact=pieces.find(s=>segmentBox(s.x,s.y+3,s.x+s.w,s.y+3,box,7));
    if(!contact)continue;
    h.hitIds.push(p.id);
    world.hit(p,{x:p.x,y:contact.y+4,vx:0,vy:0},70,650,h.dir,-.8,
      {blast:true,effect:"tesla",cause:"electrified",stun:.18,hitstop:.012});
  }
}
