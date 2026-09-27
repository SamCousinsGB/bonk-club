// Shared mechanical skeleton. The distant machine is assembled from rigid
// parts, never sampled from a background image. Beam origins use this same rig.
import {colossusStand} from './colossus-timing.js';
export {colossusEyeOpening} from './colossus-timing.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const COLOSSUS_EYES=Object.freeze([{x:-10.8,y:-49.1},{x:10.8,y:-49.1}]);
export const COLOSSUS_NECK=Object.freeze({x:1.7,y:-155});
export const COLOSSUS_SCALE=.58;
export const COLOSSUS_LEGS=Object.freeze({upper:110,lower:122});
export const COLOSSUS_ARMS=Object.freeze({upper:90,lower:96});
export const COLOSSUS_FIGURE=Object.freeze({x:1060,y:410,w:440,h:410});
export function rigPoint(frame,x,y){
  return {x:frame.x+frame.a*x+frame.c*y,y:frame.y+frame.b*x+frame.d*y};
}
function frame(x,y,angle,sx=1){
  return {x,y,a:Math.cos(angle)*sx,b:Math.sin(angle)*sx,c:-Math.sin(angle),d:Math.cos(angle)};
}
function endpoint(p,angle,length){return {x:p.x+Math.sin(angle)*length,y:p.y+Math.cos(angle)*length};}
export function colossusRig(h){
  const t=h.age,look=clamp(((h.gazeX??1280)-1280)/1280,-1,1);
  const standing=colossusStand(t),hidden=1-standing;
  // Reveal an already upright figure from the valley. Do not solve a frontal
  // squat against fixed feet: that splays both knees sideways like a crab.
  const lean=Math.sin(t*.21)*.006;
  const body=frame(1280+Math.sin(t*.19)*3,552+hidden*470+Math.sin(t*.17)*.5,lean);
  const neck=rigPoint(body,COLOSSUS_NECK.x,COLOSSUS_NECK.y);
  // Rotate around the cast neck collar, keeping its base attached to the torso.
  const head=frame(neck.x,neck.y,lean+Math.sin(t*.19)*.025+look*.008,
    .97-Math.sin(t*.23+look*.5)**2*.035);
  const arms=[-1,1].map(side=>{
    const shoulder=rigPoint(body,side*62,-123);
    // Keep daylight beneath both shoulders throughout the slow articulation.
    const a=side*(.10+Math.sin(t*.23+side*.5)*.03)+lean;
    const elbow=endpoint(shoulder,a,COLOSSUS_ARMS.upper);
    const b=a-side*(.045+Math.sin(t*.19+side)*.02);
    return {side,shoulder,elbow,hand:endpoint(elbow,b,COLOSSUS_ARMS.lower)};
  });
  const legs=[-1,1].map(side=>{
    const x=side*25;
    return {side,hip:rigPoint(body,x,0),
      knee:rigPoint(body,x,COLOSSUS_LEGS.upper),
      foot:rigPoint(body,x,COLOSSUS_LEGS.upper+COLOSSUS_LEGS.lower)};
  });
  const distant=p=>({x:1280+(p.x-1280)*COLOSSUS_SCALE,y:565+(p.y-500)*COLOSSUS_SCALE});
  const scaled=f=>({...distant(f),a:f.a*COLOSSUS_SCALE,b:f.b*COLOSSUS_SCALE,c:f.c*COLOSSUS_SCALE,d:f.d*COLOSSUS_SCALE});
  const distantHead=scaled(head);
  return {body:scaled(body),head:distantHead,
    arms:arms.map(a=>({side:a.side,shoulder:distant(a.shoulder),elbow:distant(a.elbow),hand:distant(a.hand)})),
    legs:legs.map(l=>({side:l.side,hip:distant(l.hip),knee:distant(l.knee),foot:distant(l.foot)})),
    eyes:COLOSSUS_EYES.map(e=>rigPoint(distantHead,e.x,e.y))};
}
