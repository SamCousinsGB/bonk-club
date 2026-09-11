import { drawWater } from "./water-art.js";
import { drawElectricity } from "./electricity-art.js";

const TAU=Math.PI*2;
const line=(c,points,color,width=2)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();};

export function drawReactiveProp(c,p) {
  if(!["canister","waterTank"].includes(p.kind))return false;
  const tank=p.kind==="waterTank",x=p.x,y=p.y,w=p.w,h=p.h;
  c.save();
  c.fillStyle="#101c2588";c.fillRect(x+4,y+h-3,w,6);
  c.fillStyle=tank?"#236b84":"#914938";
  c.beginPath();c.roundRect(x+2,y+8,w-4,h-9,tank?7:[12,12,6,6]);c.fill();
  c.strokeStyle=tank?"#76cedf":"#ed9470";c.lineWidth=2;c.stroke();
  const shine=c.createLinearGradient(x,0,x+w,0);
  shine.addColorStop(0,"#ffffff00");shine.addColorStop(.3,"#ffffff35");shine.addColorStop(1,"#07141d66");
  c.fillStyle=shine;c.fill();
  c.fillStyle="#aec5c7";c.fillRect(x+w*.38,y,w*.24,9);
  line(c,[[x+w*.3,y+1],[x+w*.7,y+1]],tank?"#65cfe5":"#f6c480",4);
  for(const yy of [y+h*.25,y+h*.82]){c.fillStyle="#142e3b";c.fillRect(x+2,yy,w-4,5);}
  c.fillStyle="#ece9d5";c.beginPath();c.roundRect(x+w*.23,y+h*.37,w*.54,h*.3,3);c.fill();
  if(tank) {
    c.beginPath();c.moveTo(x+w*.5,y+h*.4);
    c.bezierCurveTo(x+w*.23,y+h*.66,x+w*.78,y+h*.68,x+w*.5,y+h*.4);
    c.fillStyle="#278aa7";c.fill();
    c.fillStyle="#8decf388";c.fillRect(x+w*.12,y+h*.33,4,h*.43);
  } else {
    c.beginPath();c.moveTo(x+w*.5,y+h*.4);c.lineTo(x+w*.7,y+h*.62);c.lineTo(x+w*.3,y+h*.62);c.closePath();
    c.fillStyle="#8c3b2b";c.fill();
    c.fillStyle="#f8dca4";c.fillRect(x+w*.48,y+h*.47,2,6);c.fillRect(x+w*.48,y+h*.57,2,2);
    circle(c,x+w*.78,y+h*.24,6,"#e0e5d6");
    const angle=-2.3+(p.leak?1-Math.max(0,p.fuse||0)/4.2:0)*4.2;
    line(c,[[x+w*.78,y+h*.24],[x+w*.78+Math.cos(angle)*4,y+h*.24+Math.sin(angle)*4]],"#933e31",1.5);
  }
  if(p.leak){line(c,[[x+w*.75,y+h*.65],[x+w*.93,y+h*.72],[x+w*.8,y+h*.8]],"#10242b",3);}
  c.restore();return true;
}

export function drawGas(c,state,time) {
  for(const g of state.gas||[]) {
    c.save();
    const opacity=Math.min(.19,g.life*.16);
    c.globalAlpha=opacity;
    for(let i=0;i<5;i++) {
      const a=i*TAU/5+time*.3;
      circle(c,g.x+Math.cos(a)*g.r*.35,g.y+Math.sin(a)*g.r*.25,g.r*.65,g.lit?"#ffb04c":"#a8c39b");
    }
    c.globalAlpha=Math.min(.42,g.life*.3);
    line(c,[[g.x-g.r*.55,g.y],[g.x-g.r*.15,g.y-4],[g.x+g.r*.28,g.y+2]],g.lit?"#fff1ab":"#bbd5b6",1.5);
    c.restore();
  }
}

function flame(c,x,y,height,phase) {
  const sway=Math.sin(phase)*height*.2;
  c.beginPath();c.moveTo(x-6,y);
  c.bezierCurveTo(x-13,y-height*.3,x+sway+5,y-height*.65,x+sway,y-height);
  c.bezierCurveTo(x+sway+15,y-height*.5,x+12,y-height*.2,x+6,y);
  c.closePath();c.fillStyle="#fb713ace";c.fill();
  c.beginPath();c.moveTo(x-3,y);c.quadraticCurveTo(x-5,y-height*.3,x+sway*.6,y-height*.58);
  c.quadraticCurveTo(x+8,y-height*.2,x+3,y);c.fillStyle="#ffe794";c.fill();
}
export function drawReactions(c,state,time) {
  c.save();
  drawWater(c,state,time);
  for(const b of [...(state.cover||[]),...(state.chunks||[]),...state.platforms.filter(p=>p.fire||p.charge)]) {
    if(b.hp===0)continue;
    if(b.fire) {
      const count=b.chunk?1:Math.min(6,Math.max(2,Math.floor(b.w/18)));
      const cos=Math.cos(b.angle||0),sin=Math.sin(b.angle||0);
      for(let i=0;i<count;i++) {
        const rx=(i+.5)*b.w/count-b.w/2,ry=-b.h*.25;
        flame(c,b.x+b.w/2+rx*cos-ry*sin,b.y+b.h/2+rx*sin+ry*cos,
          (b.chunk?17:35)+Math.sin(time*8+i*3)*7,time*7+i*2);
      }
    }
    if(b.cold>0) {
      c.save();c.translate(b.x+b.w/2,b.y+b.h/2);c.rotate(b.angle||0);
      c.fillStyle="#b9f4fa44";c.fillRect(-b.w/2,-b.h/2,b.w,b.h);
      line(c,[[-b.w*.4,-b.h*.1],[b.w*.08,b.h*.23],[b.w*.22,-b.h*.38]],"#d6fcff",1.5);c.restore();
    }
    if(b.leak&&!b.chunk&&!(b.cold>0)&&!b.spent) {
      const a=(b.angle||0)+.45,dx=Math.cos(a),dy=Math.sin(a),cx=b.x+b.w/2,cy=b.y+b.h/2;
      const active=b.kind==="canister"||(b.waterLeft===undefined||b.waterLeft>0);
      if(active)for(let i=0;i<5;i++) {
        const d=22+((time*95+i*11)%57),spread=Math.sin(i*5+time*14)*(d-15)*.1;
        circle(c,cx+dx*d-dy*spread,cy+dy*d+dx*spread,1.5+i*.25,b.kind==="waterTank"?"#93e5ffc7":b.fire?"#ffbb72a0":"#d9dfc68c");
      }
      if(b.kind==="canister"&&b.fuse<1.5) {
        c.save();c.translate(cx,cy);c.rotate(b.angle||0);
        c.strokeStyle=`rgba(255,133,72,${.4+Math.sin(time*22)*.25})`;c.lineWidth=4;
        c.strokeRect(-b.w/2-2,-b.h/2-2,b.w+4,b.h+4);c.restore();
      }
    }
  }
  for(const p of state.players)if(p.alive&&p.soaked>0)for(let i=0;i<3;i++) {
    const age=(time*2.6+i*.31)%1;
    line(c,[[p.x-12+i*12,p.y+7+age*30],[p.x-12+i*12,p.y+10+age*30]],"#7ed9efaa",2);
  }
  drawElectricity(c,state,time);
  c.restore();
}
