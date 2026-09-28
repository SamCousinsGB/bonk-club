import {JOINTS} from './puppet.js';
import {drawAppearance} from './identity.js';
import {HOLY_FIRE,holyFireStage} from './holy-fire.js';

export function drawHolyFire(r,rag){
  const c=r.ctx,pts=rag.points,age=rag.deathAge,t=r.reduced?0:age;
  const {swell,blister,ash,flame,fade}=holyFireStage(age);
  c.save();c.lineCap='round';c.lineJoin='round';
  // White-hot tongues curl up from the body. Counts and motion depend only on
  // transported age/points, so a late join sees the same stage immediately.
  for(let n=0;n<17;n++){
    const p=pts[n%11],side=n%2?1:-1,w=5+(n%4)*2+swell*3;
    const bend=Math.sin(t*4+n*2.3)*9,height=24+(n%5)*8+swell*15;
    c.globalAlpha=flame*fade*.65;c.fillStyle=n%3?'#e2ba63':'#fffbdc';
    c.beginPath();c.moveTo(p.x-side*w,p.y+5);
    c.bezierCurveTo(p.x-side*(w+12),p.y-12,p.x+bend+side*13,p.y-height*.65,p.x+bend,p.y-height);
    c.bezierCurveTo(p.x+bend+side*5,p.y-height*.45,p.x+side*w,p.y-7,p.x-side*w,p.y+5);c.fill();
  }
  c.globalAlpha=fade*(1-ash);
  const skin=age<.7?rag.color:'#574839',edge='#201b1c';
  for(const [i,[a,b]] of JOINTS.entries()){
    const p=pts[a],q=pts[b],width=(i===1?9+swell*27:5.5+swell*10);
    r.line([[p.x,p.y],[q.x,q.y]],edge,width+3);
    r.line([[p.x,p.y],[q.x,q.y]],skin,width);
    // Thin incandescent splits remain within the swollen skin.
    if(blister>0){c.globalAlpha=fade*blister*.7;r.line([[p.x-1,p.y],[q.x+1,q.y]],'#fff1b9',1.3);c.globalAlpha=fade*(1-ash);}
  }
  const head=pts[0],angle=Math.atan2(head.y-pts[1].y,head.x-pts[1].x)+Math.PI/2;
  r.circle(head.x,head.y,11+swell*10,edge);r.circle(head.x,head.y,9.5+swell*10,skin);
  c.save();c.translate(head.x,head.y);c.scale(1+swell*.9,1+swell*.9);
  drawAppearance(c,rag,0,0,angle,rag.facing||1);c.restore();
  // Uneven pressure blisters swell along real body segments and rupture into
  // black pits; do not replace the victim with an unrelated explosion sprite.
  for(let n=0;blister>.001&&n<22;n++){
    const [a,b]=JOINTS[n%10],p=pts[a],q=pts[b],u=.2+(n%4)*.2;
    const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,side=n%2?1:-1;
    const size=(2+(n%3)*1.1)*blister,offset=(n%10===1?9:3)+swell*5;
    const x=p.x+dx*u-dy/len*side*offset,y=p.y+dy*u+dx/len*side*offset;
    const ruptured=age>1.9+(n%6)*.16;
    r.circle(x,y,size+1,'#493123');r.circle(x,y,size,ruptured?'#1e1b1c':'#ecd6a1');
    if(!ruptured)r.circle(x-size*.25,y-size*.35,size*.35,'#fff8db');
  }
  // The body gives way to falling cinders at its physical particles. Staggered
  // flakes are bounded and fade completely with the host's death lifetime.
  const ashTime=Math.max(0,age-HOLY_FIRE.ashAt);
  for(let n=0;n<44;n++){
    const p=pts[n%11],start=(n%7)*.05,elapsed=Math.max(0,ashTime-start);
    c.globalAlpha=fade*Math.min(1,elapsed*5);
    const x=p.x+Math.sin(n*2.399+t*.9)*(4+elapsed*15),y=p.y-elapsed*(8+n%5*5);
    c.save();c.translate(x,y);c.rotate(n*1.4+(r.reduced?0:elapsed*(n%2?2:-2)));
    c.fillStyle=n%6===0?'#d8b875':n%2?'#77716b':'#292725';
    c.fillRect(-1.5,-1,2+n%3,1.5+n%2);c.restore();
  }
  c.restore();
}
