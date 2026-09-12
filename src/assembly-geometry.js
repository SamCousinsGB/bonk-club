// Shared profiles: the artwork and the car's stepped physical silhouette use
// the same outlines. Coordinates are relative to its pallet centre.
export const CAR_BODY = [[-125,1158],[-125,1140],[-106,1120],[79,1120],[117,1131],[125,1143],[125,1158]];
export const CAR_CABIN = [[-76,1120],[-42,1056],[30,1056],[86,1120]];
export const PRESS_HOME = 894;
export const PRESS_BOTTOM = 1082;
export const PRESS_HALF_HEIGHT = 38;
export const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };
export const mix = (a,b,t) => a+(b-a)*t;

function sections(profile, name) {
  const min = Math.min(...profile.map(p=>p[1])), max = Math.max(...profile.map(p=>p[1]));
  const result=[];
  for(let y=min;y<max;y+=8){
    const h=Math.min(8,max-y), sample=y+h/2, xs=[];
    for(let i=0;i<profile.length;i++){
      const a=profile[i], b=profile[(i+1)%profile.length];
      if((a[1]<=sample&&b[1]>sample)||(b[1]<=sample&&a[1]>sample)){
        for(const yy of [y,y+h])xs.push(a[0]+(yy-a[1])/(b[1]-a[1])*(b[0]-a[0]));
      }
    }
    xs.sort((a,b)=>a-b);
    if(xs.length>=2)result.push({name,x:xs[0],y,w:xs.at(-1)-xs[0],h});
  }
  return result;
}
export function carParts(stage) {
  if(stage===0)return [{name:"chassis",x:-125,y:1158,w:250,h:18}];
  if(stage===1)return sections(CAR_BODY,"body");
  if(stage===2)return sections(CAR_CABIN,"cabin");
  return [-81,81].map((x,i)=>({name:i?"frontWheel":"rearWheel",x:x-23,y:1144,w:46,h:46}));
}

export function pressPosition(phase, working) {
  if(!working)return PRESS_HOME;
  if(phase<1)return PRESS_HOME;
  if(phase<1.55)return mix(PRESS_HOME,PRESS_BOTTOM,smooth((phase-1)/.55));
  if(phase<2.15)return PRESS_BOTTOM;
  return mix(PRESS_BOTTOM,PRESS_HOME,smooth((phase-2.15)/.85));
}

// Rigid, fixed-length links, solved to a programmed tool position. No idle
// oscillation, changing arm lengths or clock-driven elbow wobble.
export function robotPose(h, phase) {
  const side=h.assemblyStation===2?-1:1, base={x:h.x+side*152,y:873};
  const home={x:h.x+side*120,y:989};
  let target=home;
  if(h.assemblyWork>0 && h.assemblyFault==="none" && !h.done){
    const first={x:h.x+side*(h.assemblyStation===2?55:81),y:h.assemblyStation===2?1106:1163};
    const second={x:h.x-side*(h.assemblyStation===2?55:81),y:h.assemblyStation===2?1106:1163};
    if(phase>=1&&phase<1.3){const t=smooth((phase-1)/.3);target={x:mix(home.x,first.x,t),y:mix(home.y,first.y,t)};}
    else if(phase>=1.3&&phase<1.7)target=first;
    else if(phase>=1.7&&phase<1.95){const t=smooth((phase-1.7)/.25);target={x:mix(first.x,second.x,t),y:mix(first.y,second.y,t)};}
    else if(phase>=1.95&&phase<2.3)target=second;
    else if(phase>=2.3&&phase<3){const t=smooth((phase-2.3)/.7);target={x:mix(second.x,home.x,t),y:mix(second.y,home.y,t)};}
  }
  const length1=190,length2=200,dx=target.x-base.x,dy=target.y-base.y,d=Math.hypot(dx,dy);
  const along=(length1*length1-length2*length2+d*d)/(2*d), height=Math.sqrt(Math.max(0,length1*length1-along*along));
  const elbow={x:base.x+dx/d*along+side*dy/d*height,y:base.y+dy/d*along-side*dx/d*height};
  return [base,elbow,target];
}

export function welding(h, phase) {
  return h.assemblyStation===2 && h.active && h.assemblyWork>0 && h.assemblyFault==="none" &&
    (phase>=1.3&&phase<1.7 || phase>=1.95&&phase<2.3);
}
export function steamStrength(h, phase) {
  if(h.done||h.assemblyFault!=="none"||!h.assemblyWork||phase<1.55||phase>=2.55)return 0;
  return Math.min(1,(phase-1.55)/.08,(2.55-phase)/.3);
}
export function steamZones(h) {
  return [-1,1].map(side=>({x:h.x+(side<0?-245:140),y:1050,w:105,h:100}));
}
