import { carriageShape, carriageBox } from './trains.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const line=(c,x,y,xx,yy,color,width=1)=>{c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const polygon=(c,points,fill)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();};

// All folds stay inside the same compressed, rotated body used by collision.
// Seeds belong to carriage IDs: damage cannot crawl around between guest frames.
export function drawTrainCarriage(c,car,h){
  const {w,h:height}=carriageShape(car),d=car.crush||0,l=-w/2,r=w/2,t=-height/2,b=height/2;
  const front=car.id===7,tail=car.id===0,seed=car.id*37;
  const roof=x=>t+5+d*(7+noise(seed+Math.floor((x-l)/27))*18);
  c.save();c.translate(car.x,car.y);c.rotate(car.angle||0);c.scale(h.dir,1);
  // Two bogies, axle boxes, suspension and the underfloor equipment tray.
  c.fillStyle='#182128';c.fillRect(l+24,b-36,w-48,23);
  for(const centre of [l+w*.23,r-w*.23]){
    const skew=d*(noise(seed+centre)-.5)*12;
    polygon(c,[[centre-36,b-30],[centre+34,b-28+skew],[centre+30,b-10],[centre-30,b-12]],'#252b2d');
    for(const x of [centre-22,centre+22]){
      c.beginPath();c.arc(x,b-13,12,0,Math.PI*2);c.fillStyle='#11191e';c.fill();
      c.strokeStyle='#697074';c.lineWidth=3;c.stroke();
      c.beginPath();c.arc(x,b-13,4,0,Math.PI*2);c.fillStyle='#90958f';c.fill();
    }
    line(c,centre-20,b-31,centre+20,b-31,'#8a8d85',3);
    for(let n=0;n<5;n++)line(c,centre-12+n*6,b-30,centre-16+n*6,b-20,'#555e60',2);
  }
  const shell=[];
  shell.push([l,b-30]);
  if(tail)shell.push([l+22,t+30],[l+76,roof(l+76)]);else shell.push([l+3,roof(l)]);
  for(let x=l+(tail?76:3);x<r-(front?82:3);x+=26)shell.push([x,roof(x)]);
  if(front)shell.push([r-82,roof(r-82)],[r-40,t+22+d*14],[r,b-32]);
  else shell.push([r-3,roof(r-3)],[r,b-26]);
  for(let x=r;x>l;x-=28)shell.push([x,b-27-d*noise(seed+x)*12]);
  const metal=c.createLinearGradient(0,t,0,b);metal.addColorStop(0,'#d6dbd5');metal.addColorStop(.22,'#aebec1');metal.addColorStop(.55,'#c5ceca');metal.addColorStop(1,'#5b6b70');
  polygon(c,shell,metal);c.strokeStyle='#354249';c.lineWidth=2;c.stroke();
  c.save();c.clip();
  // Longitudinal stripes buckle with local panel folds instead of staying pristine.
  const band=[];for(let x=l;x<=r;x+=12)band.push([x,b-48+d*Math.sin(x*.08+seed)*7]);
  for(let x=r;x>=l;x-=12)band.push([x,b-39+d*Math.sin(x*.08+seed)*7]);polygon(c,band,'#a74e38');
  line(c,l,t+18,r,t+18,'#edf0e1',1.3);
  for(let x=l+20;x<r-10;x+=49){
    line(c,x,t+18,x,b-29,'#626f7180');
    for(const y of [t+22,b-34]){c.fillStyle='#657172';c.fillRect(x-1,y,2,2);}
  }
  const start=l+(tail?83:20),end=r-(front?89:20);
  for(let x=start,n=0;x<end-30;x+=55,n++){
    const broken=d> .17+noise(seed+n*7)*.42,shift=d*Math.sin(n*2+seed)*11;
    const glass=[[x,t+32+shift],[x+40,t+32-shift*.4],[x+41,t+65],[x+2,t+65+shift*.3]];
    polygon(c,glass,broken?'#121c22':'#233e49');c.strokeStyle='#6f858a';c.lineWidth=2;c.stroke();
    if(broken){
      polygon(c,[[x+2,t+34+shift],[x+14,t+36],[x+8,t+43],[x+17,t+51],[x+3,t+58]],'#6b8e9980');
      line(c,x+27,t+35,x+22,t+43,'#abc3c3',1);
      line(c,x+35,t+57,x+30,t+64,'#abc3c3',1);
      line(c,x+10,t+53,x+29,t+53,'#32434a',3);
    }else{line(c,x+4,t+36,x+35,t+36,'#90aeb080',2);}
  }
  if(front||tail){const side=front?1:-1;
    polygon(c,[[side*(r-79),t+23],[side*(r-44),t+33],[side*(r-16),b-40],[side*(r-71),b-47]],d>.3?'#172127':'#284552');
    if(d>.3)line(c,side*(r-75),t+28,side*(r-25),b-43,'#6e878d',1.5);
    c.fillStyle=d>.4?'#333b3c':front?'#e9e4ba':'#a74836';c.fillRect(side*(r-23)-5,b-38,10,5);
  }
  if(d>.12){
    // Abrasion is a broad, irregular scrape at one damaged end, with fine bare-metal scores.
    const side=car.id%2?1:-1,edge=side*w*.35;
    polygon(c,[[edge-side*48,t+23],[edge+side*22,t+45],[edge+side*31,b-31],
      [edge-side*52,b-33],[edge-side*27,t+61]],`rgba(43,47,45,${d*.48})`);
    for(let n=0;n<5;n++){
      const x=l+18+noise(seed+n*9)*Math.max(1,w-50),width=9+d*(10+noise(seed+n)*18),y=t+16+noise(seed+n*3)*35;
      polygon(c,[[x,y],[x+width*.4,y+22],[x-width*.3,b-30],[x+width,b-34],[x+width*.65,y+17]],'#34434a88');
      line(c,x,y,x+width*.4,y+22,'#e0e1ce',1.4);
      line(c,x+width*.4,y+22,x-width*.3,b-30,'#25343a',1.7);
      for(let j=0;j<3;j++)line(c,x-15,b-36-j*4,x+27,b-39-j*5,'#e5dfcb88',1);
    }
  }
  if(car.ruptured){
    const x=(noise(seed+3)-.5)*w*.5;
    polygon(c,[[x-36,b-45],[x-21,b-68],[x-6,b-49],[x+15,b-63],[x+35,b-33]],'#162027');
    polygon(c,[[x-33,b-44],[x-20,b-62],[x-10,b-44],[x-18,b-31]],'#819092');
    line(c,x+10,b-52,x+27,b-33,'#bfc5b4',2);
    for(let n=0;n<3;n++)line(c,x-8+n*8,b-43,x-15+n*12,b-28,'#4a4f4a',2);
    if(d>.72){
      const tear=d-.72;
      polygon(c,[[x-24,t+21],[x+18,t+31],[x+9,t+47],[x+32,b-35],[x-23,b-39],
        [x-12,t+56],[x-31,t+44]],'#172228');
      for(let j=0;j<3;j++)line(c,x-19,t+44+j*19,x+16,t+49+j*19,'#68777a',3);
      polygon(c,[[x+18,t+31],[x+36+tear*40,t+40],[x+30,b-35],[x+9,t+47]],'#8d9a98');
      line(c,x+18,t+31,x+36+tear*40,t+40,'#d6d8c9',2);
    }
  }
  c.restore();
  // Torn gangway bellows and restrained hoses hang with gravity, not neon arcs.
  for(const side of [-1,1])if(!front||side<0){
    const x=side*(w/2-6);line(c,x,t+21,x,b-31,'#364246',5);
    if(d>.3){c.beginPath();c.moveTo(x,b-32);c.quadraticCurveTo(x-side*17,b-15,x-side*10,b-3);c.strokeStyle='#22292d';c.lineWidth=3;c.stroke();}
  }
  c.restore();
}

export function trainScrapeContacts(car,platforms){
  if(Math.hypot(car.vx||0,car.vy||0)<75)return [];
  const {w,h}=carriageShape(car),co=Math.cos(car.angle||0),si=Math.sin(car.angle||0),points=[];
  for(const lx of [-w/2,-w*.28,0,w*.28,w/2])for(const ly of [-h/2,h/2]){
    const x=car.x+lx*co-ly*si,y=car.y+lx*si+ly*co;
    if(platforms.some(p=>p.hp!==0&&x>=p.x-3&&x<=p.x+p.w+3&&y>=p.y-12&&y<=p.y+p.h+5))points.push({x,y});
  }
  return points.slice(0,2);
}

export class TrainCrashEffects {
  constructor(){this.reset();}
  reset(){this.previous=new Map();this.particles=[];this.time=null;this.key=null;this.serial=0;}
  emit(x,y,vx,vy,count,kind){
    for(let i=0;i<count;i++){
      const seed=++this.serial,n=noise(seed),life=kind==='dust'?1.4+n:kind==='spark'?.16+n*.3:.55+n*.7;
      this.particles.push({x,y,vx:vx*.23+(n-.5)*(kind==='spark'?500:280),vy:vy*.12-35-noise(seed+17)*190,
        age:0,life,kind,size:kind==='dust'?16+n*21:kind==='glass'?2+n*4:2+n*3,angle:n*6.28,spin:(n-.5)*12});
    }
    this.particles=this.particles.slice(-260);
  }
  update(state,reduced=false){
    const key=state&&`${state.arenaIndex}:${state.round}`,time=state?.time;
    if(!state||key!==this.key||time<this.time||time-this.time>.5){this.reset();this.key=key;}
    if(!state)return;
    const dt=this.time===null?0:clamp(time-this.time,0,.05);this.time=time;
    if(reduced){this.particles=[];}
    for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
      p.vx*=Math.exp(-(p.kind==='dust'?2:.4)*dt);p.vy+=(p.kind==='dust'?-28:1000)*dt;}
    this.particles=this.particles.filter(p=>p.age<p.life);
    const next=new Map();
    for(const h of state.hazards||[])if(h.type==='train'&&h.derailed&&!h.done)for(const car of h.carriages||[]){
      const id=`${h.id}:${car.id}`,old=this.previous.get(id);next.set(id,{...car});
      if(!old||!dt||reduced)continue;
      const damage=car.crush-old.crush;
      if(damage>.012){
        const {w}=carriageShape(car),side=Math.sign(car.vx)||h.dir;
        const x=car.x+Math.cos(car.angle)*w*.4*side,y=car.y+Math.sin(car.angle)*w*.4*side;
        this.emit(x,y,car.vx,car.vy,Math.min(12,3+Math.ceil(damage*40)),'glass');
        this.emit(x,y,car.vx,car.vy,5,'dust');
      }
      // Same state time cannot emit again; floating cars do not spray rail sparks.
      if(Math.floor(time*24)!==Math.floor((time-dt)*24))for(const p of trainScrapeContacts(car,state.platforms||[])){
        this.emit(p.x,p.y,-car.vx*.5,0,3,'spark');this.emit(p.x,p.y,-car.vx*.1,0,1,'dust');
      }
      if(car.ruptured&&car.energy>0&&Math.floor(time*8)!==Math.floor((time-dt)*8)){
        const box=carriageBox(car);this.emit(car.x,box.y+box.h*.7,car.vx,0,1,'dust');
      }
    }
    this.previous=next;
  }
  draw(c){
    c.save();
    for(const p of this.particles){const fade=1-p.age/p.life;
      c.globalAlpha=fade*(p.kind==='dust'?.34:.85);
      if(p.kind==='dust'){const r=p.size*(1+p.age*1.7);const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'#b8ad91');g.addColorStop(1,'#847e7000');c.fillStyle=g;c.fillRect(p.x-r,p.y-r,r*2,r*2);}
      else if(p.kind==='spark')line(c,p.x,p.y,p.x-p.vx*.018,p.y-p.vy*.018,p.age<.1?'#ffeac0':'#c98c49',1.4);
      else{c.save();c.translate(p.x,p.y);c.rotate(p.angle);polygon(c,[[0,-p.size],[p.size*.45,p.size*.7],[-p.size*.6,p.size*.3]],'#a9bfc1');c.restore();}
    }
    c.restore();
  }
}
