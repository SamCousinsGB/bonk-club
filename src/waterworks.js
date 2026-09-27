import { emitWater } from './liquid.js';
import { WATERWORKS_PIPES, WATERWORKS_POOL } from './waterworks-arena.js';

// Sources are water mains. Only admitted water enters the shared bounded solver;
// a full budget neither allocates extra parcels nor accumulates a deferred burst.
// The outlet needs its actual surviving throat, including after circular cuts.
export function waterworksOutlet(platforms,index) {
  const pipe=WATERWORKS_PIPES[index];
  return platforms.some(p=>p.waterworksPipe===index && p.hp!==0 && p.x<=pipe.x-8 && p.x+p.w>=pipe.x+8 &&
    p.y<=pipe.y-12 && p.y+p.h>=pipe.y-2);
}
export const generatorPhase = (elapsed,id='cover0') => {
  // Stable cover IDs keep the two banks alternating after movement/destruction
  // and on guests. Both banks start safe; each retains its 7/1/4 second cycle.
  const match=/^cover(\d+)$/.exec(id);
  if(!match)return 'off';
  const delay=(Number(match[1])%2)*6;
  const phase=Math.max(0,elapsed-delay)%12;
  return phase<7?'off':phase<8?'warning':'live';
};
export function resetWaterworks(world) {
  if(!world.arena.waterworks)return;
  const p=WATERWORKS_POOL;
  for(let x=p.x;x<p.x+p.w;x+=32)emitWater(world,x+16,p.bottom,p.h,{depth:p.h});
  for(const q of world.water)q.grounded=true;
}
export function updateWaterworks(world,dt) {
  if(!world.arena.waterworks || world.prediction || world.phase!=='fight')return;
  for(const [i,p] of WATERWORKS_PIPES.entries())if(waterworksOutlet(world.platforms,i))
    emitWater(world,p.x,p.y+16,p.rate*dt,{vy:420,depth:24});
}
