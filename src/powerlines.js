import { playerBox, segmentBox } from "./collision.js";
import { POWER_INTERVAL } from "./transmission-arena.js";
import { cableIntact, releaseCableMounts } from "./heavy-cables.js";
import { powerlineCircuit } from "./powerline-circuit.js";

export const wireCable = (state, h) => state.cables?.find(c => c.id === `${state.cables?.some(c => c.id.startsWith("turbine")) ? "turbine" : "tower"}${h.circuit}`);
export const wirePieces = (state, h) => {
  const c = wireCable(state, h);
  return c ? c.links.flatMap((live, i) => live ? [{ a: c.points[i], b: c.points[i + 1] }] : []) : [];
};
export function intactPowerline(world,h) {
  releaseCableMounts(world);
  return cableIntact(wireCable(world, h));
}
export function updatePowerline(world,h,dt) {
  releaseCableMounts(world);
  const cable = wireCable(world,h);
  if(!cable || !cable.links.some(Boolean)) {h.done=true;h.active=false;h.warning=0;h.duration=0;h.cooldown=0;return;}
  h.age+=dt;
  const phase=(h.age+1e-9)%(POWER_INTERVAL*2),wasActive=h.active;
  const runs=powerlineCircuit(world).runs.filter(r=>r.cable===cable.id);
  h.active=runs.some(r=>r.powered);
  h.warning=!h.active&&runs.some(r=>r.supplied)&&phase>=POWER_INTERVAL-1&&phase<POWER_INTERVAL?POWER_INTERVAL-phase:0;
  h.duration=h.active?(phase>=POWER_INTERVAL?POWER_INTERVAL*2-phase:POWER_INTERVAL):0;
  h.cooldown=!h.active&&runs.some(r=>r.supplied)&&phase<POWER_INTERVAL?POWER_INTERVAL-phase:0;
  if(h.active!==wasActive) {
    h.hitIds=[];h.hitTimer=0;
    if(h.active)world.event("hazard",{x:h.x,y:h.y,kind:"tesla"});
  }
  if(!h.active||world.prediction)return;
  h.hitTimer-=dt;
  if(h.hitTimer<=0){h.hitIds=[];h.hitTimer=.8;}
  const pieces=runs.flatMap(r=>r.powered?r.points.slice(1).map((b,i)=>({a:r.points[i],b})):[]);
  for(const p of world.players) {
    if(!p.alive||h.hitIds.includes(p.id))continue;
    const box=playerBox(p);
    const contact=pieces.find(s=>segmentBox(s.a.x,s.a.y,s.b.x,s.b.y,box,7));
    if(!contact)continue;
    h.hitIds.push(p.id);
    world.hit(p,{x:p.x,y:(contact.a.y+contact.b.y)/2,vx:0,vy:0},70,650,h.dir,-.8,
      {blast:true,effect:"tesla",cause:"electrified",stun:.18,hitstop:.012});
  }
}
