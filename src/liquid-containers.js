import { PROP_TYPES } from './props.js';
import { BARRELS } from './barrels.js';

// Resize the host's round instances, never the arena templates. Keep each
// landing and its headroom usable; capacities and mass follow the actual size.
export function randomizeLiquidContainers(world) {
  for(const b of world.cover) {
    const water=b.kind==='waterTank';
    if(b.chunk || (!water && !BARRELS[b.kind]?.contents))continue;
    const cx=b.x+b.w/2,bottom=b.y+b.h,area=b.w*b.h;
    const choices=water?[.62,.76,.9,1]:[.65,.82,1,1.18,1.38];
    let scale=choices[Math.min(choices.length-1,Math.floor(world.random()*choices.length))];
    let w,h,x,y;
    do {
      w=Math.round(b.w*scale);h=Math.round(b.h*scale);x=cx-w/2;y=bottom-h;
      const blocked=world.platforms.some(p=>p.hp!==0 && p.y<bottom-.5 && x<p.x+p.w+4 && x+w>p.x-4 && y-110<p.y+p.h && bottom>p.y) ||
        world.cover.some(p=>p!==b && p.hp>0 && x<p.x+p.w+12 && x+w>p.x-12 && y<p.y+p.h+12 && bottom>p.y-12) ||
        world.arena.spawns.some(([px,py])=>Math.abs(px-cx)<w/2+45 && py+30>y && py-30<bottom);
      if(!blocked || scale<=.65)break;
      scale=Math.max(.62,scale-.1);
    } while(true);
    const ratio=w*h/area;
    Object.assign(b,{x,y,w,h,mass:PROP_TYPES[b.kind].mass*w*h/(water?64*76:54*68)});
    if(water)b.waterLeft=b.waterCapacity=Math.min(1200,Math.round((b.waterCapacity||b.waterLeft||210)*ratio));
    else b.liquidLeft=b.liquidCapacity=Math.min(1200,Math.round(96*ratio));
  }
}
