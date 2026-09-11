import { JOINTS } from "./puppet.js";
import { TRANSMUTATIONS, TRANSMUTATION_WEAPONS } from "./transmutation.js";

const TAU = Math.PI * 2;
function yarn(r, x, y, size, angle = 0) {
  const c = r.ctx;
  c.save(); c.translate(x,y); c.rotate(angle);
  r.circle(0,0,size,"#a84c85");
  for (let n = -2; n <= 2; n++) {
    c.beginPath(); c.moveTo(-size*.8,n*size*.23);
    c.quadraticCurveTo(0,-size*.7+n*size*.23,size*.8,n*size*.23);
    c.strokeStyle = n%2 ? "#ffd2eb" : "#ff97cf"; c.lineWidth=2.4; c.stroke();
  }
  c.restore();
}
function coin(r, x, y, size, angle) {
  const c=r.ctx;
  c.save(); c.translate(x,y); c.rotate(angle);
  r.circle(0,0,size,"#916018"); r.circle(-1,-1,size*.82,"#ffd35d");
  c.strokeStyle="#fff0a4";c.lineWidth=1.5;c.beginPath();c.arc(-1,-1,size*.6,3.3,5.2);c.stroke();
  r.line([[0,-size*.45],[0,size*.35]],"#a5751c",1.6);c.restore();
}
function jelly(r,x,y,size,time) {
  const c=r.ctx;c.beginPath();
  for(let n=0;n<=20;n++) {
    const a=n/20*TAU, rad=size*(1+Math.sin(a*3+time*13)*.12);
    const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;
    if(!n)c.moveTo(px,py);else c.lineTo(px,py);
  }
  c.fillStyle="#88dd5eb8";c.fill();c.strokeStyle="#d4ffa0";c.lineWidth=2;c.stroke();
  r.circle(x-size*.3,y-size*.35,Math.max(1,size*.2),"#f2ffd9");
}
export function drawTransmutationWeapon(r,type) {
  if(!Object.hasOwn(TRANSMUTATION_WEAPONS,type))return false;
  const c=r.ctx;
  c.fillStyle="#293443";c.fillRect(-12,-8,41,18);c.fillRect(-3,7,10,17);
  if(type==="jelly") {
    c.fillStyle="#455657";c.fillRect(-20,-17,21,28);
    jelly(r,-10,-8,14,0);
    r.line([[13,0],[43,0]],"#89ad85",13);
    r.line([[44,-11],[44,11]],"#d1fa9d",4);
    r.circle(32,10,4,"#a9ef76");
  } else if(type==="midas") {
    c.fillStyle="#e6b343";c.fillRect(-14,-10,42,17);
    r.line([[17,0],[48,0]],"#fff0a3",7);
    r.line([[28,-10],[28,-17],[35,-11],[42,-17],[42,-5]],"#eac358",3);
    coin(r,-9,-1,9,0);r.circle(46,0,5,"#fff6c0");
  } else {
    yarn(r,-8,-7,18,-.3);
    r.line([[10,3],[29,9],[34,-5],[48,0]],"#ffc1e2",2.5);
    r.line([[18,-4],[49,-4]],"#a4bfca",4);
    r.line([[48,-8],[54,-4],[48,0]],"#dcecf0",2);
  }
  return true;
}
export function drawTransmutationProjectile(r,b,time) {
  if(!TRANSMUTATIONS.includes(b.kind))return false;
  if(b.kind==="jelly") {
    r.line([[b.x-b.vx*.018,b.y-b.vy*.018],[b.x,b.y]],"#b2ff6a44",12);
    jelly(r,b.x,b.y,12,r.reduced?0:time);
  } else if(b.kind==="gold") {
    r.line([[b.x-b.vx*.024,b.y-b.vy*.024],[b.x,b.y]],"#ffc34c55",8);
    coin(r,b.x,b.y,8,time*14);
  } else {
    const angle=Math.atan2(b.vy,b.vx);
    const pts=Array.from({length:9},(_,i)=>[b.x-b.vx*.003*i+Math.sin(i+time*12)*3,
      b.y-b.vy*.003*i+Math.cos(i+time*12)*4]);
    r.line(pts,"#ffb0dc",2);yarn(r,b.x,b.y,11,angle+time*12);
  }
  return true;
}

export function drawTransformedBody(r,points,kind,age,time,pieces=false) {
  const c=r.ctx,t=r.reduced?0:time;
  if(pieces) {
    points.forEach((p,i)=>{
      if(kind==="gold")coin(r,p.x,p.y,6+i%3,t*9+i);
      else if(kind==="jelly")jelly(r,p.x,p.y,5+i%4,t+i);
      else {
        const length=Math.min(26,(age-.9)*36);
        r.line(Array.from({length:12},(_,n)=>[p.x+Math.cos(n*.8+i+t*2)*(4+n*.4),
          p.y+(n/11-.5)*length+Math.sin(n*.8+t*3)*3]),i%2?"#ffb2de":"#e974b4",2.8);
      }
    });
    return;
  }
  if(kind==="gold") {
    for(const [a,b] of JOINTS) {
      const p=points[a],q=points[b];
      r.line([[p.x,p.y],[q.x,q.y]],"#80541b",12);
      r.line([[p.x-1,p.y-1],[q.x-1,q.y-1]],"#e9b83d",8);
      r.line([[p.x-2,p.y-2],[q.x-2,q.y-2]],"#fff0a2",2);
    }
    coin(r,points[0].x,points[0].y,12,-.2);
    for(let i=0;i<3;i++) {
      const p=points[(i*3+1)%11],pulse=r.reduced?1:.6+.4*Math.sin(t*8+i);
      r.line([[p.x-6*pulse,p.y],[p.x+6*pulse,p.y]],"#fff7c9",1.5);
      r.line([[p.x,p.y-6*pulse],[p.x,p.y+6*pulse]],"#fff7c9",1.5);
    }
  } else if(kind==="jelly") {
    for(const [a,b] of JOINTS) {
      const p=points[a],q=points[b];
      c.beginPath();c.moveTo(p.x,p.y);
      c.quadraticCurveTo((p.x+q.x)/2+Math.sin(t*17+a)*3,(p.y+q.y)/2,q.x,q.y);
      c.strokeStyle="#9be568bb";c.lineWidth=14;c.lineCap="round";c.stroke();
      r.line([[p.x-2,p.y-2],[q.x-2,q.y-2]],"#dcffa38a",2);
    }
    jelly(r,points[0].x,points[0].y,14,t);
    for(const id of [3,5,7,9])r.circle(points[id].x-2,points[id].y-2,2,"#f1ffd8");
  } else {
    // Crossed cords follow the constrained wrists/ankles, rather than a scaled sprite.
    const ids=[4,6,8,10,1,4,10,6,8,2];
    r.line(ids.map(i=>[points[i].x,points[i].y]),"#7e3667",6);
    r.line(ids.map(i=>[points[i].x,points[i].y]),"#ffc2e4",3);
    for(const id of [4,6,8,10])yarn(r,points[id].x,points[id].y,6,id);
    const a=points[1],b=points[2];
    for(let n=0;n<6;n++) {
      const y=a.y+(b.y-a.y)*n/5,x=a.x+(b.x-a.x)*n/5;
      r.line([[x-13,y-3],[x+13,y+3]],n%2?"#ee88c0":"#ffd0e9",3);
    }
    yarn(r,points[2].x,points[2].y,9,.4);
  }
}
