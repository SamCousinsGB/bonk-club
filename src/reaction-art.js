import { drawWater } from "./water-art.js";
import { drawElectricity } from "./electricity-art.js";
import { BARRELS, SPILLS, barrelWarning } from "./barrels.js";

const TAU=Math.PI*2;
const line=(c,points,color,width=2)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();};

export function drawReactiveProp(c,p) {
  if(p.kind!=="waterTank"&&!BARRELS[p.kind])return false;
  const tank=p.kind==="waterTank",x=p.x,y=p.y,w=p.w,h=p.h;
  const type=BARRELS[p.kind], warning=barrelWarning(p), flashing=warning.pulse>.45;
  c.save();
  c.translate(x+w/2,y+h/2);c.scale(warning.swell,warning.swell);c.translate(-x-w/2,-y-h/2);
  c.fillStyle=tank?"#236b84":flashing?"#fff2d1":type.color;
  c.beginPath();c.roundRect(x+2,y+8,w-4,h-9,tank?7:[12,12,6,6]);c.fill();
  c.strokeStyle=tank?"#76cedf":flashing?"#ffffff":type.rim;c.lineWidth=2;c.stroke();
  const shine=c.createLinearGradient(x,0,x+w,0);
  shine.addColorStop(0,"#ffffff00");shine.addColorStop(.3,"#ffffff35");shine.addColorStop(1,"#07141d66");
  c.fillStyle=shine;c.fill();
  c.fillStyle="#aec5c7";c.fillRect(x+w*.38,y,w*.24,9);
  line(c,[[x+w*.3,y+1],[x+w*.7,y+1]],tank?"#65cfe5":type.rim,4);
  for(const yy of [y+h*.25,y+h*.82]){c.fillStyle=flashing?"#e55d32":"#23343a";c.fillRect(x+2,yy,w-4,5);}
  c.fillStyle=flashing?"#af3528":"#ece9d5";c.beginPath();c.roundRect(x+w*.14,y+h*.36,w*.72,h*.34,3);c.fill();
  if(tank) {
    c.beginPath();c.moveTo(x+w*.5,y+h*.4);
    c.bezierCurveTo(x+w*.23,y+h*.66,x+w*.78,y+h*.68,x+w*.5,y+h*.4);
    c.fillStyle="#278aa7";c.fill();
    c.fillStyle="#8decf388";c.fillRect(x+w*.12,y+h*.33,4,h*.43);
  } else {
    c.fillStyle=flashing?"#fff7d6":"#29323b";c.textAlign="center";c.textBaseline="middle";
    c.font=`bold ${warning.count?Math.round(h*.33):Math.min(14,w*.25)}px sans-serif`;
    c.fillText(warning.count||type.label,x+w/2,y+h*.54,w*.67);
    if(p.kind==="canister") {
      circle(c,x+w*.78,y+h*.24,6,flashing?"#fff7d6":"#e0e5d6");
      const angle=-2.3+(p.leak?1-Math.max(0,p.fuse||0)/4.2:0)*4.2;
      line(c,[[x+w*.78,y+h*.24],[x+w*.78+Math.cos(angle)*4,y+h*.24+Math.sin(angle)*4]],"#933e31",1.5);
    } else if(p.kind==="barrel") {
      line(c,[[x+w*.6,y+6],[x+w*.7,y-2],[x+w*.87,y]],"#d8bd81",2.5);
      if(p.leak&&!p.cold){circle(c,x+w*.87,y,3+warning.pulse*2,"#ff9c44");circle(c,x+w*.87,y,1.8,"#fff4c4");}
    } else {
      const color=SPILLS[type.contents].color;
      // A coloured drip is attached to the casing and remains visible on shards.
      circle(c,x+w*.78,y+h*.78,3,color);
      line(c,[[x+w*.78,y+h*.68],[x+w*.78,y+h*.78]],color,3);
    }
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
  drawSpills(c,state,time);
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
      const active=b.kind==="canister"||(b.kind==="waterTank"&&b.waterLeft>0)||b.liquidLeft>0;
      if(active)for(let i=0;i<5;i++) {
        const d=22+((time*95+i*11)%57),spread=Math.sin(i*5+time*14)*(d-15)*.1;
        const contents=BARRELS[b.kind]?.contents;
        circle(c,cx+dx*d-dy*spread,cy+dy*d+dx*spread,1.5+i*.25,b.kind==="waterTank"?"#93e5ffc7":
          contents?SPILLS[contents].rim:b.fire?"#ffbb72a0":"#d9dfc68c");
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

function drawSpills(c,state,time) {
  for(const q of state.spills||[]) {
    const type=SPILLS[q.kind];
    c.save();c.globalAlpha=Math.min(1,q.life/2);
    if(!q.grounded) {
      const cx=q.x+q.w/2,len=Math.max(5,Math.min(38,q.vy*.04+q.h*.4));
      line(c,[[cx,q.y+q.h-len],[cx+Math.sin(q.id+time*5)*2,q.y+q.h]],type.color,Math.min(13,4+q.h*.35));
      circle(c,cx,q.y+q.h,3.5,type.rim);
    } else {
      const wobble=Math.sin(time*(q.kind==="oil"?3:1.5)+q.x*.04)*.8;
      c.fillStyle=type.color;
      c.beginPath();c.moveTo(q.x,q.y+1);c.quadraticCurveTo(q.x+q.w/2,q.y-2+wobble,q.x+q.w,q.y+1);
      c.lineTo(q.x+q.w,q.y+q.h);c.lineTo(q.x,q.y+q.h);c.closePath();c.fill();
      line(c,[[q.x+2,q.y+1],[q.x+q.w*.55,q.y+wobble],[q.x+q.w-2,q.y+1]],type.rim,1.5);
      if(q.kind==="oil")line(c,[[q.x+6,q.y+2],[q.x+q.w-7,q.y+2]],"#b69ccd77",1.2);
      if(q.kind==="tar")circle(c,q.x+q.w*.55,q.y+2,1.8,"#ad83b46b");
    }
    if(q.fire)flame(c,q.x+q.w/2,q.y+Math.min(3,q.h),25+Math.sin(q.id+time*7)*6,time*8+q.id);
    c.restore();
  }
  // Sticky strands follow feet; oil sheen and tar stains stay on the fighter.
  for(const p of state.players)if(p.alive&&(p.glued>0||p.tarred>0||p.oiled>0)) {
    const color=p.glued>0?SPILLS.glue.rim:p.tarred>0?SPILLS.tar.rim:SPILLS.oil.rim;
    for(const index of [8,10]) {
      const foot=p.rig?.[index]||{x:p.x+(index===8?-8:8),y:p.y+27};
      circle(c,foot.x,foot.y,3.5,color);
      if(p.ground&&p.glued>0)line(c,[[foot.x-4,foot.y+3],[foot.x,foot.y-5],[foot.x+4,foot.y+3]],color,1.5);
    }
  }
}
