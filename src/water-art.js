import { segmentBox } from './collision.js';
const TAU = Math.PI * 2;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// The finite 32-unit simulation columns remain a contact envelope. Airborne
// artwork breaks that envelope into downward, tapered strands, never pool bars.
export function fallingWaterStrands(q, time) {
  const count = Math.min(5,Math.max(2,Math.ceil(q.h/5))), speed = clamp(q.vy/1000,0,1);
  return Array.from({length:count},(_,i) => {
    const seed = q.id*7+i*19, phase = noise(seed), sway = Math.sin(time*5+seed)*1.8;
    const length = 8 + speed*(20+phase*27) + Math.sqrt(q.h)*2;
    const bottom = q.y+q.h-(i ? phase*Math.min(q.h+speed*20,30) : 0);
    const x = q.x+q.w*(i+.5)/count+sway;
    return {x, bottom, length, bend:Math.sin(seed+time*3)*(1.5+speed*2),
      radius:clamp(Math.sqrt(q.w*q.h/count/length)*.85,1.2,5), seed};
  });
}

export class WaterImpacts {
  constructor() { this.previous = new Map(); this.bursts = []; this.time = null; this.round = null; this.arena = null; }
  update(state) {
    const time = state.time;
    if (this.round !== state.round || this.arena !== state.arenaIndex || time < this.time || time-this.time > .3) {
      this.previous.clear(); this.bursts = [];
    }
    if (this.time === time && this.round === state.round && this.arena === state.arenaIndex) return this.bursts;
    this.bursts = this.bursts.filter(b => time-b.time < .42);
    for (const q of state.water || []) {
      const old = this.previous.get(q.id);
      if (!q.frozen && q.grounded && old && !old.grounded && old.vy > 80 && this.bursts.length < 32)
        this.bursts.push({x:q.x+q.w/2,y:q.y,time,force:clamp(old.vy/600,.25,1),seed:q.id});
    }
    this.previous = new Map((state.water || []).map(q => [q.id,{grounded:q.grounded,vy:q.vy}]));
    this.time = time; this.round = state.round; this.arena = state.arenaIndex;
    return this.bursts;
  }
}
const impacts = new WeakMap();

// Draw one continuous surface for each touching pool, rather than outlining
// individual simulation columns. Adjacent heights share a tangent at each join.
export function waterSurfaces(water,platforms=[]) {
  const rows=new Map();
  for(const q of water)if(q.grounded && !q.frozen && q.h>.02) {
    const key=Math.round((q.y+q.h)*2);
    if(!rows.has(key))rows.set(key,[]);rows.get(key).push(q);
  }
  const runs=[];
  for(const row of rows.values()) {
    row.sort((a,b)=>a.x-b.x);let run=[];
    for(const q of row) {
      const last=run.at(-1);
      if(last && (Math.abs(last.x+last.w-q.x)>1 || Math.min(last.y+last.h,q.y+q.h)<=Math.max(last.y,q.y) ||
        platforms.some(p=>p.hp!==0 && segmentBox(last.x+last.w/2,last.y+last.h/2,q.x+q.w/2,q.y+q.h/2,p)))) {
        runs.push(run);run=[];
      }
      run.push(q);
    }
    if(run.length)runs.push(run);
  }
  return runs;
}

function drawPool(c,run,time) {
  const first=run[0],last=run.at(-1),bottom=first.y+first.h;
  const top=Math.min(...run.map(q=>q.y)),charged=run.some(q=>q.charge);
  const wave=(x,h)=> (Math.sin(x*.032+time*2.8)+Math.sin(x*.067-time*3.6)*.35)*Math.min(1.6,h*.1);
  const surface=()=>{
    c.moveTo(first.x,first.y+wave(first.x,first.h));
    for(let i=0;i<run.length;i++) {
      const q=run[i],next=run[i+1],x=q.x+q.w;
      const end=next?(q.y+next.y)/2:q.y;
      c.quadraticCurveTo(q.x+q.w/2,q.y+wave(q.x+q.w/2,q.h),x,end+wave(x,q.h));
    }
  };
  c.beginPath();surface();c.lineTo(last.x+last.w,bottom);c.lineTo(first.x,bottom);c.closePath();
  const fill=c.createLinearGradient(0,top,0,Math.max(top+1,bottom));
  fill.addColorStop(0,charged?'#77e6efac':'#75dbed91');
  fill.addColorStop(.22,charged?'#32acc6a6':'#229ec19e');
  fill.addColorStop(1,'#145782be');c.fillStyle=fill;c.fill();
  c.save();c.clip();
  // Broad refracted highlights drift with the current, within the real volume.
  for(const [i,q] of run.entries())if(q.h>12 && i%4===1) {
    const flow=(q.vx||0)*.015;
    c.beginPath();c.moveTo(q.x+2,q.y+q.h*.35);
    c.bezierCurveTo(q.x+20,q.y+q.h*.32,q.x+45,q.y+q.h*.43,q.x+70,q.y+q.h*.4);
    c.strokeStyle='#b0f4ef25';c.lineWidth=1+Math.min(2,Math.abs(flow));c.stroke();
  }
  c.restore();
  c.beginPath();surface();c.strokeStyle=charged?'#dcffffdf':'#d2f8ffc5';c.lineWidth=1.65;c.stroke();
  for(const q of run)if(Math.abs(q.vx||0)>70 && q.h>2) {
    const phase=(time*.7+noise(q.id))%1,x=q.x+phase*q.w;
    c.beginPath();c.moveTo(x,q.y+1);c.quadraticCurveTo(x+4,q.y-.5,x+9,q.y+1);
    c.strokeStyle='#f0ffffa8';c.lineWidth=1.8;c.stroke();
  }
}

export function drawWater(c,state,time) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  for(const run of waterSurfaces(state.water||[],state.platforms||[]))drawPool(c,run,time);
  // Joining neighbouring airborne columns turns a ruptured tank into a sheet
  // with a single silhouette, rather than a rack of identical vertical tubes.
  const airborne=[];
  for(const q of [...(state.water||[])].filter(q=>!q.grounded&&!q.frozen).sort((a,b)=>a.x-b.x)) {
    const old=airborne.at(-1);
    if(old && q.h>22 && old.h>22 && Math.abs(old.x+old.w-q.x)<2 &&
      Math.abs(old.y+old.h-q.y-q.h)<2 && Math.abs(old.y-q.y)<20 && Math.abs((old.vx||0)-(q.vx||0))<80) {
      const right=q.x+q.w;old.y=Math.min(old.y,q.y);old.h=q.y+q.h-old.y;old.w=right-old.x;
    } else airborne.push({...q});
  }
  for (const q of airborne) {
    if (q.frozen || q.grounded || q.h<.02) continue;
    if(q.h>22) {
      const x=q.x+q.w/2,y=q.y,r=q.w*.48,bend=clamp((q.vx||0)*.025,-12,12);
      c.beginPath();c.moveTo(x-r*.7,y+3);
      c.bezierCurveTo(x-r,y+q.h*.25,x-r+bend,y+q.h*.75,x-r*.6+bend,y+q.h-2);
      c.quadraticCurveTo(x+bend,y+q.h+2,x+r*.6+bend,y+q.h-2);
      c.bezierCurveTo(x+r+bend,y+q.h*.75,x+r,y+q.h*.25,x+r*.7,y+3);
      c.quadraticCurveTo(x,y-1,x-r*.7,y+3);
      const sheen=c.createLinearGradient(q.x,0,q.x+q.w,0);
      sheen.addColorStop(0,'#b3f2f5a2');sheen.addColorStop(.25,'#62cbe4a8');sheen.addColorStop(1,'#1684b580');
      c.fillStyle=sheen;c.fill();
      c.beginPath();c.moveTo(x-r*.65,y+6);c.quadraticCurveTo(x-r*.85,y+q.h*.6,x-r*.4+bend,y+q.h-5);
      c.strokeStyle='#d2faffad';c.lineWidth=1.3;c.stroke();
      continue;
    }
    for (const s of fallingWaterStrands(q,time)) {
      const {x,bottom:y,length:l,radius:r,bend:b} = s, top=y-l;
      c.beginPath();c.moveTo(x+b,top);
      c.bezierCurveTo(x+b-r*.3,top+l*.4,x-r*1.35,y-r*3,x-r,y-r);
      c.bezierCurveTo(x-r,y+r*.7,x+r,y+r*.7,x+r,y-r);
      c.bezierCurveTo(x+r*1.2,y-r*3,x+b+r*.2,top+l*.4,x+b,top);
      c.fillStyle=q.charge?"#54d9ef8c":"#4fb8e082";c.fill();
      c.beginPath();c.moveTo(x+b,top+l*.25);c.quadraticCurveTo(x-r*.4,y-l*.25,x-r*.3,y-r);
      c.strokeStyle="#c9f6ffd0";c.lineWidth=Math.max(.8,r*.4);c.stroke();
      // Detached satellite droplets keep thick spills from reading as icicles.
      const lag=(time*1.8+noise(s.seed+3))%1;
      c.beginPath();c.ellipse(x+b*1.7,y-l-4-lag*9,r*.45,1.5+q.vy*.003,0,0,TAU);
      c.fillStyle="#96e0fba0";c.fill();
    }
  }
  let tracker=impacts.get(c);if(!tracker){tracker=new WaterImpacts();impacts.set(c,tracker);}
  for(const b of tracker.update(state)) {
    const age=state.time-b.time,life=1-age/.42;
    c.globalAlpha=life*.75;c.strokeStyle="#bceeff";c.lineWidth=1.2;
    c.beginPath();c.ellipse(b.x,b.y,5+age*48*b.force,1+age*3,0,Math.PI,TAU);c.stroke();
    for(let i=0;i<5;i++) {
      const vx=(i-2)*30*b.force,vy=-(45+noise(b.seed+i)*65)*b.force;
      const x=b.x+vx*age,y=b.y+vy*age+220*age*age;
      if(y>b.y)continue;
      c.beginPath();c.moveTo(x-vx*.016,y-(vy+440*age)*.016);c.lineTo(x,y);c.stroke();
    }
  }
  c.restore();
}
