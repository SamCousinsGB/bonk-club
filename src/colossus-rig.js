// Shared anatomy and pose. Painted eyes and host-owned beams use this same rig.
import {COLOSSUS,colossusStand,colossusPhase} from './colossus-timing.js';
export {colossusEyeOpening} from './colossus-timing.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const COLOSSUS_EYES=Object.freeze([{x:-9.1,y:-52.7},{x:7.7,y:-52.7}]);
export const COLOSSUS_NECK=Object.freeze({x:-1,y:-150});
export const COLOSSUS_SCALE=.5;
export const COLOSSUS_LEGS=Object.freeze({upper:130,lower:140});
export const COLOSSUS_ARMS=Object.freeze({upper:100,lower:112});
export const COLOSSUS_FIGURE=Object.freeze({x:1060,y:410,w:440,h:410});
export function rigPoint(frame,x,y){
  return {x:frame.x+frame.a*x+frame.c*y,y:frame.y+frame.b*x+frame.d*y};
}
function frame(x,y,angle,sx=1){
  return {x,y,a:Math.cos(angle)*sx,b:Math.sin(angle)*sx,c:-Math.sin(angle),d:Math.cos(angle)};
}
function endpoint(p,angle,length){return {x:p.x+Math.sin(angle)*length,y:p.y+Math.cos(angle)*length};}
const smooth=n=>{const v=clamp(n,0,1);return v*v*(3-2*v);};
const mix=(a,b,t)=>a+(b-a)*t;
// Continuous, age-derived poses also work when a guest first sees the creature
// halfway through a climb or discharge. No renderer-local animation clock.
function track(t,keys){
  for(let i=1;i<keys.length;i++)if(t<keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i];return mix(x,y,smooth((t-a)/(b-a)));
  }
  return keys.at(-1)[1];
}
function reach(start,target,upper,lower,bend){
  const dx=target.x-start.x,dy=target.y-start.y,raw=Math.hypot(dx,dy);
  const d=clamp(raw,Math.abs(upper-lower)+.1,upper+lower-.1),ux=dx/(raw||1),uy=dy/(raw||1);
  const along=(upper*upper-lower*lower+d*d)/(2*d),across=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {joint:{x:start.x+ux*along-uy*across*bend,y:start.y+uy*along+ux*across*bend},
    end:{x:start.x+ux*d,y:start.y+uy*d}};
}
export function colossusRig(h){
  const t=h.age,look=clamp(((h.gazeX??1280)-1280)/1280,-1,1);
  const standing=colossusStand(t),awake=smooth((t-4.3)/1.2),phase=colossusPhase(t,h.chargeAt);
  const charge=phase.charge,shot=t-(h.chargeAt??COLOSSUS.wake)-COLOSSUS.charge;
  const recoil=smooth(shot/.18)*(1-smooth((shot-.18)/.85));
  const exertion=phase.firing?1:phase.phase>=COLOSSUS.charge+COLOSSUS.fire?phase.cooling:charge;
  // Settle onto one leg and hold the weight there. Slow shallow breathing moves
  // the whole chest; no independent, looping arm swing or sideways head bob.
  const breath=awake*Math.sin(t*.19)*.8;
  const lean=track(t,[[0,.17],[1.25,.1],[2.7,-.08],[4,.035],[5.5,.04]])-recoil*.014;
  const body=frame(1280+track(t,[[0,22],[1.3,-12],[2.7,25],[4,-9],[5.5,-5]]),
    track(t,[[0,1080],[1.05,940],[2.55,810],[3.8,690],[5.5,600]])+breath+recoil*3,lean);
  const neck=rigPoint(body,COLOSSUS_NECK.x,COLOSSUS_NECK.y);
  const tilt=track(t,[[0,-.16],[1.4,-.12],[3.2,.05],[5.5,-.045],[7.7,-.085]]);
  // Small deliberate turns retain an attached neck and an unreadable stare.
  const head=frame(neck.x,neck.y,lean+tilt+awake*(look*.065-exertion*.028-recoil*.035),
    .97-Math.abs(look)*.035);
  const arms=[-1,1].map(side=>{
    const shoulder=rigPoint(body,side*63,side<0?-136:-127);
    const a=(side<0?-.07:.18)+side*1.65*(1-smooth(t/1.3))+lean;
    const elbow=endpoint(shoulder,a,COLOSSUS_ARMS.upper),b=a-side*(side<0?.22:.29);
    const rest=endpoint(elbow,b,COLOSSUS_ARMS.lower),left=side<0;
    const grip=smooth((t-(left?.15:.65))/.75)*(1-smooth((t-(left?2.9:3))/.9));
    // Asymmetric planted hands haul the shoulders past the actual painted ridge.
    const target={x:mix(rest.x,1280+side*(left?174:180),grip),y:mix(rest.y,left?754:800,grip)};
    const solved=reach(shoulder,target,COLOSSUS_ARMS.upper,COLOSSUS_ARMS.lower,side);
    return {side,shoulder,elbow:solved.joint,hand:solved.end,grip};
  });
  const legs=[-1,1].map(side=>{
    const hip=rigPoint(body,side*27,22),fold=1-smooth((t-(side<0?2.3:3.1))/2.2);
    // Knees tuck in succession under the climbing body, then extend beneath it.
    const a=lean+(side<0?-.03:.04)+fold*(side<0?-.85:.65),b=lean+(side<0?.01:-.035)+fold*(side<0?1.25:-1.15);
    const knee=endpoint(hip,a,COLOSSUS_LEGS.upper);
    return {side,hip,knee,foot:endpoint(knee,b,COLOSSUS_LEGS.lower)};
  });
  const distant=p=>({x:1280+(p.x-1280)*COLOSSUS_SCALE,y:565+(p.y-500)*COLOSSUS_SCALE});
  const scaled=f=>({...distant(f),a:f.a*COLOSSUS_SCALE,b:f.b*COLOSSUS_SCALE,c:f.c*COLOSSUS_SCALE,d:f.d*COLOSSUS_SCALE});
  const distantHead=scaled(head);
  return {body:scaled(body),head:distantHead,standing,
    arms:arms.map(a=>({side:a.side,grip:a.grip,shoulder:distant(a.shoulder),elbow:distant(a.elbow),hand:distant(a.hand)})),
    legs:legs.map(l=>({side:l.side,hip:distant(l.hip),knee:distant(l.knee),foot:distant(l.foot)})),
    eyes:COLOSSUS_EYES.map(e=>rigPoint(distantHead,e.x,e.y))};
}
