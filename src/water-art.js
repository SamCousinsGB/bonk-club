import { SPILLS } from './barrels.js';
import { liquidBounds } from './liquid-geometry.js';
import { segmentBox } from './collision.js';
const TAU = Math.PI * 2;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// The visible strand occupies exactly the shared falling contact envelope.
export function fallingWaterStrands(q, time) {
  const b=liquidBounds(q);
  return [{x:b.x+b.w/2,bottom:b.y+b.h,length:b.h,radius:b.w/2,
    bend:Math.sin(time*4+q.id)*b.w*.08,seed:q.id}];
}
const palette=q=>SPILLS[q.kind] ? {top:SPILLS[q.kind].rim,mid:SPILLS[q.kind].color,
  bottom:q.kind==='molten'?'#ae3423':SPILLS[q.kind].color,rim:SPILLS[q.kind].rim}:
  {top:q.charge?'#77e6efac':'#75dbed91',mid:'#229ec19e',bottom:'#145782be',rim:'#d2f8ffc5'};
const all=state=>[...(state.water||[]),...(state.spills||[])];

export class WaterImpacts {
  constructor() { this.previous = new Map(); this.bursts = []; this.time = null; this.round = null; this.arena = null; }
  update(state) {
    const time = state.time;
    if (this.round !== state.round || this.arena !== state.arenaIndex || time < this.time || time-this.time > .3) {
      this.previous.clear(); this.bursts = [];
    }
    if (this.time === time && this.round === state.round && this.arena === state.arenaIndex) return this.bursts;
    this.bursts = this.bursts.filter(b => time-b.time < .42);
    for (const q of all(state)) {
      const old = this.previous.get(q.id);
      if (!q.frozen && q.grounded && old && !old.grounded && old.vy > 80 && this.bursts.length < 32)
        this.bursts.push({x:q.x+q.w/2,y:q.y,time,force:clamp(old.vy/600,.25,1),seed:q.id,color:palette(q).rim});
    }
    this.previous = new Map((all(state)).map(q => [q.id,{grounded:q.grounded,vy:q.vy}]));
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
    const key=`${q.kind||'water'}:${Math.round((q.y+q.h)*2)}`;
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
  const colors=palette(run[0]);
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
  fill.addColorStop(0,colors.top);
  fill.addColorStop(.22,colors.mid);
  fill.addColorStop(1,colors.bottom);c.fillStyle=fill;c.fill();
  c.save();c.clip();
  // Broad refracted highlights drift with the current, within the real volume.
  for(const [i,q] of run.entries())if(q.h>12 && i%4===1) {
    const flow=(q.vx||0)*.015;
    c.beginPath();c.moveTo(q.x+2,q.y+q.h*.35);
    c.bezierCurveTo(q.x+20,q.y+q.h*.32,q.x+45,q.y+q.h*.43,q.x+70,q.y+q.h*.4);
    c.strokeStyle='#b0f4ef25';c.lineWidth=1+Math.min(2,Math.abs(flow));c.stroke();
  }
  c.restore();
  c.beginPath();surface();c.strokeStyle=charged?'#dcffffdf':colors.rim;c.lineWidth=1.65;c.stroke();
  for(const q of run)if(Math.abs(q.vx||0)>70 && q.h>2) {
    const phase=(time*.7+noise(q.id))%1,x=q.x+phase*q.w;
    c.beginPath();c.moveTo(x,q.y+1);c.quadraticCurveTo(x+4,q.y-.5,x+9,q.y+1);
    c.strokeStyle=colors.rim;c.lineWidth=1.8;c.stroke();
  }
}

export function drawWater(c,state,time) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  for(const run of waterSurfaces(all(state),state.platforms||[]))drawPool(c,run,time);
  const falling=[];
  for(const q of all(state).filter(q=>!q.frozen&&!q.grounded&&q.h>1e-8).sort((a,b)=>a.x-b.x)) {
    const box={...liquidBounds(q)},last=falling.at(-1),a=last?.box;
    if(last && last.kind===q.kind && box.w>20 && a.w>20 && box.h>22 && a.h>22 &&
      Math.abs(a.x+a.w-box.x)<.5 && Math.abs(a.y+a.h-box.y-box.h)<2 && Math.abs(a.y-box.y)<16) {
      const bottom=Math.max(a.y+a.h,box.y+box.h);a.y=Math.min(a.y,box.y);a.h=bottom-a.y;a.w=box.x+box.w-a.x;
      last.charge=Math.max(last.charge||0,q.charge||0);
    } else falling.push({...q,box});
  }
  for(const q of falling) {
    const box=q.box,colors=palette(q),x=box.x,y=box.y,w=box.w,h=box.h;
    // A rounded continuous ribbon, bounded by the exact collision silhouette.
    // Internal highlights move; no decorative droplets imply a false circuit.
    c.beginPath();c.moveTo(x+w*.5,y);
    c.bezierCurveTo(x+w*.08,y,x,y+h*.4,x,y+h*.78);
    c.bezierCurveTo(x,y+h,x+w,y+h,x+w,y+h*.78);
    c.bezierCurveTo(x+w,y+h*.4,x+w*.92,y,x+w*.5,y);
    const sheen=c.createLinearGradient(x,0,x+Math.max(.01,w),0);
    sheen.addColorStop(0,colors.top);sheen.addColorStop(.3,colors.mid);sheen.addColorStop(1,colors.bottom);
    c.fillStyle=sheen;c.fill();
    c.save();c.clip();c.beginPath();
    c.moveTo(x+w*.3,y+h*.18);c.quadraticCurveTo(x+w*(.15+.06*Math.sin(time*4+q.id)),y+h*.55,x+w*.3,y+h*.9);
    c.strokeStyle=colors.rim;c.lineWidth=Math.min(1.3,w*.2);c.stroke();c.restore();
  }
  let tracker=impacts.get(c);if(!tracker){tracker=new WaterImpacts();impacts.set(c,tracker);}
  for(const b of tracker.update(state)) {
    const age=state.time-b.time,life=1-age/.42;
    c.globalAlpha=life*.75;c.strokeStyle=b.color||"#bceeff";c.lineWidth=1.2;
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
