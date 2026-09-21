import { W,H } from './scale.js';
import { bodyBounds } from './props.js';
import { cleanCarriedObjects } from './object-carry.js';

// Keep a margin for edge interactions. A body must be wholly past the boundary,
// so large props and ragdolls do not disappear while a visible part remains.
export const escapedBounds = b => b.y>H+160 || b.x+b.w<-320 || b.x>W+320;
export const escapedPoints = points => points.length>0 &&
  (points.every(p=>p.y>H+160) || points.every(p=>p.x<-320) || points.every(p=>p.x>W+320));
export function cleanEscapedEntities(world) {
  const old=world.cover.length+world.chunks.length;
  world.cover=world.cover.filter(b=>!escapedBounds(bodyBounds(b)));
  world.chunks=world.chunks.filter(b=>b.hp>0&&!escapedBounds(bodyBounds(b)));
  world.ragdolls=world.ragdolls.filter(r=>r.life>0&&!escapedPoints(r.points));
  world.debris=world.debris.filter(d=>!escapedBounds({x:d.x,y:d.y,w:12,h:12}));
  if(old!==world.cover.length+world.chunks.length){world.terrainVersion++;cleanCarriedObjects(world);}
}
