// Shared profiles: the artwork and the car's stepped physical silhouette use
// the same outlines. Coordinates are relative to its pallet centre.
export const CAR_BODY = [[-125,1158],[-125,1140],[-106,1120],[79,1120],[117,1131],[125,1143],[125,1158]];
export const CAR_CABIN = [[-76,1120],[-42,1056],[30,1056],[86,1120]];
export const PRESS_HOME = 894;
export const PRESS_BOTTOM = 1082;
export const PRESS_HALF_HEIGHT = 38;
export const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };
export const mix = (a,b,t) => a+(b-a)*t;

// Parts are independent: destroyed stations leave visibly incomplete cars.
export const PART = { BODY:1, CABIN:2, REAR:4, FRONT:8, PAINT:16 };
export const CAR_COLORS = ["#dfa44d", "#58aaa7", "#cf655b", "#7e98cb"];
export const carHeight = stage => stage & PART.CABIN ? 134 : stage & PART.BODY ? 70 : stage & (PART.REAR|PART.FRONT) ? 46 : 32;
export const carMass = stage => 140 + (stage & 1 ? 20:0) + (stage & 2 ? 20:0) + (stage & 4 ? 10:0) + (stage & 8 ? 10:0);
export function carProfile(stage, hull = false) {
  if(!(stage & (PART.BODY|PART.CABIN))){
    const rear=stage&PART.REAR,front=stage&PART.FRONT;
    if(hull&&rear&&front)return [[-125,1190],[-125,1158],[-104,1144],[104,1144],[125,1158],[125,1190]];
    const points=[[-125,1190],[-125,1158]];
    if(rear)points.push([-104,1144],[-58,1144]);
    if(!hull&&rear)points.push([-58,1158]);
    if(!hull&&front)points.push([58,1158]);
    if(front)points.push([58,1144],[104,1144]);
    points.push([125,1158],[125,1190]);return points;
  }
  if(!(stage & PART.CABIN))return [[-125,1190],...CAR_BODY.slice(1,-1),[125,1190]];
  return hull ? [[-125,1190],[-125,1140],[-42,1056],[30,1056],[125,1143],[125,1190]] :
    [[-125,1190],[-125,1140],[-106,1120],...CAR_CABIN,[117,1131],[125,1143],[125,1190]];
}
export function carShape(stage) {
  const h=carHeight(stage);
  return carProfile(stage,true).map(([x,y])=>[x/250,(y-(1190-h/2))/h]);
}
export function carPoints(b) {
  const c=Math.cos(b.angle||0),s=Math.sin(b.angle||0),h=carHeight(b.carStage??0);
  return carProfile(b.carStage??0).map(([x,y])=>{
    const rx=x*b.w/250,ry=(y-1190+h/2)*b.h/h;
    return {x:b.x+b.w/2+rx*c-ry*s,y:b.y+b.h/2+rx*s+ry*c};
  });
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
export const wheelSupply = h => ({x:h.x+145,y:1012});
export const wheelHeld = phase => phase>=1.12&&phase<1.78 || phase>=2.14&&phase<2.85;
export const paintStrength = (h,phase) => h.assemblyStation===4&&h.active&&h.assemblyWork>0&&h.assemblyFault==="none" ? Math.min(1,Math.max(0,(phase-1)/.2),Math.max(0,(3-phase)/.2)) : 0;
export function robotPose(h, phase) {
  const side=h.assemblyStation===2?-1:1, base={x:h.x+side*152,y:873};
  const home=h.assemblyStation===3?wheelSupply(h):{x:h.x+side*120,y:989};
  let target=home;
  const workPoint=(offset,y)=>{
    const angle=h.assemblyAngle||0, dx=offset,dy=y-1190;
    return {x:h.x+(h.assemblyOffset||0)+dx*Math.cos(angle)-dy*Math.sin(angle),
      y:(h.assemblyBottom??1190)+dx*Math.sin(angle)+dy*Math.cos(angle)};
  };
  if(h.assemblyWork>0 && h.assemblyFault==="none" && !h.done){
    const first=workPoint(side*(h.assemblyStation===2?55:81),h.assemblyStation===2?1106:1167);
    const second=workPoint(-side*(h.assemblyStation===2?55:81),h.assemblyStation===2?1106:1167);
    const move=(a,b,t)=>({x:mix(a.x,b.x,smooth(t)),y:mix(a.y,b.y,smooth(t))});
    if(h.assemblyStation===3){
      // Pick one wheel, seat it, return to the feeder, then fit the other axle.
      if(phase>=1.12&&phase<1.6)target=move(home,first,(phase-1.12)/.48);
      else if(phase>=1.6&&phase<1.78)target=first;
      else if(phase>=1.78&&phase<2.08)target=move(first,home,(phase-1.78)/.3);
      else if(phase>=2.14&&phase<2.65)target=move(home,second,(phase-2.14)/.51);
      else if(phase>=2.65&&phase<2.85)target=second;
      else if(phase>=2.85&&phase<3.4)target=move(second,home,(phase-2.85)/.55);
    } else {
      if(phase>=1&&phase<1.3)target=move(home,first,(phase-1)/.3);
      else if(phase>=1.3&&phase<1.7)target=first;
      else if(phase>=1.7&&phase<1.95)target=move(first,second,(phase-1.7)/.25);
      else if(phase>=1.95&&phase<2.3)target=second;
      else if(phase>=2.3&&phase<3)target=move(second,home,(phase-2.3)/.7);
    }
  }
  const length1=215,length2=220,dx=target.x-base.x,dy=target.y-base.y;
  const distance=Math.hypot(dx,dy)||1,d=Math.max(6,Math.min(434,distance)),nx=dx/distance,ny=dy/distance;
  target={x:base.x+nx*d,y:base.y+ny*d};
  const along=(length1*length1-length2*length2+d*d)/(2*d),height=Math.sqrt(Math.max(0,length1*length1-along*along));
  const elbow={x:base.x+nx*along+side*ny*height,y:base.y+ny*along-side*nx*height};
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
