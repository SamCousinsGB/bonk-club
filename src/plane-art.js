import { PLANE, planePose, planeBreaches } from "./plane.js";

const line = (c, points, color, width = 3) => {
  c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.strokeStyle=color; c.lineWidth=width; c.stroke();
};
function ellipse(c,x,y,rx,ry,color) {
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fillStyle=color; c.fill();
}

export function drawPlaneSky(c,time,reduced) {
  const sky=c.createLinearGradient(0,0,0,1440);
  sky.addColorStop(0,"#23485c"); sky.addColorStop(.55,"#81afc0"); sky.addColorStop(1,"#d1dad6");
  c.fillStyle=sky; c.fillRect(0,0,2560,1440);
  for(let i=0;i<14;i++) {
    const x=((i*431-(reduced?0:time*95))%3200+3200)%3200-320;
    const y=180+(i*193)%1200;
    ellipse(c,x,y,240+i%3*70,22+i%4*9,"#e9f1ee28");
  }
}

export function transformPlane(c,age,reduced) {
  const p=planePose(age,reduced);
  c.translate(PLANE.x+p.x,PLANE.y+p.y); c.rotate(p.angle); c.scale(p.scale,p.scale); c.translate(-PLANE.x,-PLANE.y);
}

export function drawPlaneInterior(c) {
  // Wing structure and nacelle pylons remain outside the pressure vessel.
  for(const side of [-1,1]) {
    c.save(); c.translate(1280,0); c.scale(side,1);
    c.beginPath(); c.moveTo(710,630); c.lineTo(1180,700); c.lineTo(1120,765); c.lineTo(710,745); c.closePath();
    c.fillStyle="#8fa7ad"; c.fill(); c.strokeStyle="#d3dddb"; c.lineWidth=5; c.stroke();
    line(c,[[730,670],[1130,719],[730,715]],"#3a545f",9);
    line(c,[[1005,731],[1005,795]],"#435f6b",32);
    ellipse(c,1005,905,147,145,"#aebdbb");
    ellipse(c,1005,905,135,133,"#405864");
    c.restore();
  }
  const wall=c.createRadialGradient(1280,530,60,1280,710,800);
  wall.addColorStop(0,"#344958"); wall.addColorStop(1,"#101f2b");
  ellipse(c,1280,710,PLANE.innerX+8,PLANE.innerY+8,wall);
  c.save(); c.beginPath(); c.ellipse(1280,710,PLANE.innerX,PLANE.innerY,0,0,Math.PI*2); c.clip();
  for(const scale of [.99,.92]) {
    c.beginPath(); c.ellipse(1280,710,PLANE.innerX*scale,PLANE.innerY*scale,0,0,Math.PI*2);
    c.strokeStyle="#71889644"; c.lineWidth=10; c.stroke();
  }
  for(let x=660;x<2000;x+=205) {
    line(c,[[x,190],[x,1260]],"#8298a520",9);
    for(let y=260;y<1180;y+=165) {
      c.fillStyle="#142733"; c.fillRect(x+28,y,112,65);
      c.strokeStyle="#6e879233"; c.lineWidth=3; c.strokeRect(x+28,y,112,65);
    }
  }
  for(const x of [980,1280,1580]) {
    line(c,[[x-48,270],[x+48,270]],"#263846",20);
    line(c,[[x-40,270],[x+40,270]],"#d7e9d4",5);
  }
  for(const x of [1080,1480]) {
    line(c,[[x,835],[x,1035]],"#9a8d6155",4);
    for(let y=840;y<1030;y+=28)line(c,[[x-55,y],[x+55,y]],"#9a8d6133",3);
  }
  c.restore();
}

export function drawPlaneHull(c,platforms) {
  c.save();c.beginPath();
  for(const p of platforms)if(p.planeHull&&p.hp!==0)c.rect(p.x,p.y,p.w,p.h);
  c.clip();
  c.fillStyle="#829ca9";c.fillRect(400,100,1760,1230);
  c.beginPath();c.ellipse(1280,710,776,546,0,0,Math.PI*2);
  c.strokeStyle="#c1cfd0";c.lineWidth=36;c.stroke();
  c.beginPath();c.ellipse(1280,710,793,563,0,0,Math.PI*2);
  c.strokeStyle="#e5ebe3";c.lineWidth=4;c.stroke();
  for(let i=0;i<48;i++) {
    const a=i*Math.PI/24;
    line(c,[[1280+Math.cos(a)*748,710+Math.sin(a)*518],[1280+Math.cos(a)*807,710+Math.sin(a)*577]],"#526c7c",2);
    ellipse(c,1280+Math.cos(a+.015)*773,710+Math.sin(a+.015)*543,2.5,2.5,"#415a69");
  }
  c.restore();
}

let previousPlatforms=null,previousHullCount=-1,breaches=[];
export function drawPlaneOutflows(c,state,time,reduced) {
  const count=state.platforms.filter(p=>p.planeHull&&p.hp!==0).length;
  if(previousPlatforms!==state.platforms||previousHullCount!==count) {
    breaches=planeBreaches(state.platforms); previousPlatforms=state.platforms;previousHullCount=count;
  }
  for(const b of breaches) {
    c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.ny,b.nx));
    for(let i=0;i<18;i++) {
      const flow=reduced?.5:((time*1.8+i*.137)%1);
      const x=-380+flow*720,spread=(i-8.5)/8.5;
      const width=b.width*.32+Math.abs(x)*.18;
      line(c,[[x-55,spread*(width+12)],[x,spread*width]],x<0?"#d5f6ff55":"#ecfcffbb",i%3?2:4);
    }
    c.restore();
  }
}
