// Shared anatomy and pose. Painted eyes and host-owned beams use this same rig.
export {colossusEyeOpening} from './colossus-timing.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const COLOSSUS_EYES=Object.freeze([{x:-11.83,y:-65.9},{x:10,y:-65.9}]);
export const COLOSSUS_NECK=Object.freeze({x:-1,y:-150});
export const COLOSSUS_SCALE=.5;
export const COLOSSUS_LEGS=Object.freeze({upper:130,lower:140});
export const COLOSSUS_ARMS=Object.freeze({upper:94,lower:101});
export const COLOSSUS_FIGURE=Object.freeze({x:1060,y:410,w:440,h:410});
export function rigPoint(frame,x,y){
  return {x:frame.x+frame.a*x+frame.c*y,y:frame.y+frame.b*x+frame.d*y};
}
function frame(x,y,angle,sx=1){
  return {x,y,a:Math.cos(angle)*sx,b:Math.sin(angle)*sx,c:-Math.sin(angle),d:Math.cos(angle)};
}
function endpoint(p,angle,length){return {x:p.x+Math.sin(angle)*length,y:p.y+Math.cos(angle)*length};}
export function colossusRig(h){
  const look=clamp(((h.gazeX??1280)-1280)/1280,-1,1),lean=.015;
  // Already present at full height on the first frame, including countdown and
  // reset. Only the small host-driven gaze changes; the body never rises,
  // breathes, recoils or releases a climbing grip.
  const body=frame(1275,600,lean);
  const neck=rigPoint(body,COLOSSUS_NECK.x,COLOSSUS_NECK.y);
  const head=frame(neck.x,neck.y,lean-.045+look*.045,
    .97-Math.abs(look)*.035);
  const arms=[-1,1].map(side=>{
    // Attach inside the painted deltoids, below the clavicles. Hands hang
    // beside the thighs with a slight natural bend, clear of the waist.
    const shoulder=rigPoint(body,side*57,-122);
    const elbow=endpoint(shoulder,lean+side*.11,COLOSSUS_ARMS.upper);
    return {side,shoulder,elbow,hand:endpoint(elbow,lean-side*.015,COLOSSUS_ARMS.lower)};
  });
  const legs=[-1,1].map(side=>{
    const hip=rigPoint(body,side*27,22);
    const a=lean+(side<0?-.03:.04),b=lean+(side<0?.01:-.035);
    const knee=endpoint(hip,a,COLOSSUS_LEGS.upper);
    return {side,hip,knee,foot:endpoint(knee,b,COLOSSUS_LEGS.lower)};
  });
  const distant=p=>({x:1280+(p.x-1280)*COLOSSUS_SCALE,y:565+(p.y-500)*COLOSSUS_SCALE});
  const scaled=f=>({...distant(f),a:f.a*COLOSSUS_SCALE,b:f.b*COLOSSUS_SCALE,c:f.c*COLOSSUS_SCALE,d:f.d*COLOSSUS_SCALE});
  const distantHead=scaled(head);
  return {body:scaled(body),head:distantHead,
    arms:arms.map(a=>({side:a.side,shoulder:distant(a.shoulder),elbow:distant(a.elbow),hand:distant(a.hand)})),
    legs:legs.map(l=>({side:l.side,hip:distant(l.hip),knee:distant(l.knee),foot:distant(l.foot)})),
    eyes:COLOSSUS_EYES.map(e=>rigPoint(distantHead,e.x,e.y))};
}
