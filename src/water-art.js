import { SPILLS } from './barrels.js';
import { liquidBounds } from './liquid-geometry.js';
import { segmentBox } from './collision.js';
import { liquidColumns } from './liquid-spatial.js';
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
  constructor() { this.previous = new Map(); this.bodies = new Map(); this.bursts = []; this.time = null; this.round = null; this.arena = null; }
  update(state,liquid=all(state)) {
    const time = state.time;
    if (this.round !== state.round || this.arena !== state.arenaIndex || time < this.time || time-this.time > .3) {
      this.previous.clear(); this.bodies.clear(); this.bursts = [];
    }
    if (this.time === time && this.round === state.round && this.arena === state.arenaIndex) return this.bursts;
    this.bursts = this.bursts.filter(b => time-b.time < .8);
    const pools=liquidColumns(liquid.filter(q=>q.grounded&&!q.frozen&&q.h>2)),seen=new Set();
    const impact=(q,x,force,seed)=>{
      if(this.bursts.some(b=>time-b.time<.12&&Math.abs(b.x-x)<20&&Math.abs(b.y-q.y)<12))return;
      if(this.bursts.length<32)this.bursts.push({x,y:q.y,time,force:clamp(force,.2,1),seed,color:palette(q).rim,kind:q.kind});
    };
    for (const q of liquid) {
      seen.add(q.id);
      const old = this.previous.get(q.id);
      if (!q.frozen && q.grounded && old && !old.grounded && old.vy > 80)impact(q,q.x+q.w/2,old.vy/650,q.id);
    }
    // Surface absorption removes the incoming parcel. Follow its observed flight
    // to the nearby pool instead of waiting for a non-existent floor landing.
    for(const [id,old] of this.previous)if(!seen.has(id)&&!old.grounded&&old.vy>80) {
      const interval=Math.max(.075,time-this.time),x=old.x+old.vx*(time-this.time),reach=Math.max(12,old.vy*interval+8);
      const q=pools.at(x).find(q=>(q.kind||'water')===old.kind&&x>=q.x&&x<=q.x+q.w&&q.y>=old.bottom-reach&&q.y<=old.bottom+reach);
      if(q)impact(q,x,old.vy/650,id);
    }
    const bodies=new Map();
    for(const b of [...(state.players||[]),...(state.cover||[]),...(state.chunks||[])]) {
      const fighter=b.alive!==undefined;if(fighter&&!b.alive)continue;
      const key=`${fighter?'p':'b'}${b.id}`,x=fighter?b.x:b.x+b.w/2,bottom=fighter?b.y+28:b.y+b.h;
      const old=this.bodies.get(key);bodies.set(key,{bottom,x});
      if(old && (b.vy||0)>100) {
        const q=pools.at(x).find(q=>x>=q.x&&x<=q.x+q.w&&old.bottom<=q.y+6&&bottom>=q.y);
        if(q)impact(q,x,(b.vy||0)/550,Math.round(x));
      }
    }
    this.bodies=bodies;
    this.previous = new Map(liquid.map(q => [q.id,{grounded:q.grounded,vy:q.vy,vx:q.vx||0,x:q.x+q.w/2,bottom:q.y+q.h,kind:q.kind||'water'}]));
    this.time = time; this.round = state.round; this.arena = state.arenaIndex;
    return this.bursts;
  }
}
const impacts = new WeakMap();

// Draw one continuous surface for each touching pool, rather than outlining
// individual simulation columns. Adjacent heights share a tangent at each join.
export function waterSurfaces(water,platforms=[]) {
  const rows=new Map(),terrain=water.length>8?liquidColumns(platforms,undefined,40):{at:()=>platforms};
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
        terrain.at(q.x).some(p=>p.hp!==0 && segmentBox(last.x+last.w/2,last.y+last.h/2,q.x+q.w/2,q.y+q.h/2,p)))) {
        runs.push(run);run=[];
      }
      run.push(q);
    }
    if(run.length)runs.push(run);
  }
  return runs;
}

function drawPool(c,run,time,bursts,reduced) {
  const colors=palette(run[0]);
  const first=run[0],last=run.at(-1),bottom=first.y+first.h;
  const top=Math.min(...run.map(q=>q.y)),charged=run.some(q=>q.charge);
  const water=!first.kind,viscosity=SPILLS[first.kind]?.flow||1;
  const local=bursts.filter(b=>b.x>=first.x-60&&b.x<=last.x+last.w+60&&Math.abs(b.y-top)<32&&(b.kind||'water')===(first.kind||'water'));
  const wave=(x,h)=> {
    if(reduced)return 0;
    let y=(Math.sin(x*.026+time*2.1)+Math.sin(x*.059-time*3.2)*.3)*Math.min(1.2,h*.06)*viscosity;
    for(const b of local) {
      const age=time-b.time,distance=Math.abs(x-b.x),front=age*150;
      y+=Math.sin((distance-front)*.07)*Math.exp(-Math.abs(distance-front)/30)*(1-age/.8)*b.force*4;
    }
    return clamp(y,-Math.min(5,h*.15),Math.min(5,h*.15));
  };
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
  // The meniscus and depth bands share the pool path, so lighting cannot bridge
  // a dry gap or draw through a wall. No blur/filter/offscreen full-scene passes.
  c.beginPath();surface();c.strokeStyle=water?'#b4f4ed42':colors.rim;c.lineWidth=7;c.globalAlpha=.55;c.stroke();c.globalAlpha=1;
  for(const [i,q] of run.entries())if(q.h>12 && i%4===1) {
    const flow=(q.vx||0)*.015,drift=reduced?0:Math.sin(time*.8+q.id)*8;
    c.beginPath();c.moveTo(q.x-12+drift,q.y+q.h*.25);
    c.bezierCurveTo(q.x+12+drift,q.y+q.h*.20,q.x+38+drift,q.y+q.h*.42,q.x+84+drift,q.y+q.h*.32);
    c.strokeStyle=water?'#9ce8db29':colors.rim;c.globalAlpha=water?1:.18;c.lineWidth=1+Math.min(2,Math.abs(flow));c.stroke();c.globalAlpha=1;
    if(water&&q.h>55){
      c.beginPath();c.moveTo(q.x-18,bottom-7);c.quadraticCurveTo(q.x+12+drift,bottom-22,q.x+56,bottom-9);
      c.strokeStyle='#7ad8ca22';c.lineWidth=3;c.stroke();
    }
  }
  // Entrained bubbles remain below the surface and scale with measured current.
  if(water&&!reduced)for(let i=1;i<run.length;i+=3) {
    const q=run[i],speed=Math.abs(q.vx||0);if(speed<35||q.h<18)continue;
    const phase=(time*(.35+speed*.001)+noise(q.id))%1,x=q.x+8+noise(q.id+8)*16,y=q.y+4+(1-phase)*Math.min(50,q.h*.6);
    c.beginPath();c.arc(x,y,1+noise(q.id)*1.8,0,TAU);c.strokeStyle='#b9f6ed65';c.lineWidth=.9;c.stroke();
  }
  c.restore();
  c.beginPath();surface();c.strokeStyle=charged?'#dcffffdf':colors.rim;c.lineWidth=1.65;c.stroke();
  c.beginPath();
  for(let i=0;i<run.length;i++) {
    const q=run[i],slope=Math.abs(q.y-(run[i+1]?.y??q.y));
    if((Math.abs(q.vx||0)>45||slope>3)&&q.h>2) {
      const phase=(time*.45+noise(q.id))%1,x=q.x+phase*q.w*.55,y=q.y+wave(x,q.h);
      c.moveTo(x,y);c.quadraticCurveTo(x+5,y-1,x+12,y+.5);
    }
  }
  c.strokeStyle=water?'#e0fff1c0':colors.rim;c.lineWidth=2;c.stroke();
}

export function drawWater(c,state,time,reduced=false) {
  const liquid=all(state);
  let tracker=impacts.get(c);if(!tracker){tracker=new WaterImpacts();impacts.set(c,tracker);}
  const bursts=tracker.update(state,liquid);
  if(!liquid.length&&!bursts.length)return;
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  for(const run of waterSurfaces(liquid,state.platforms||[]))drawPool(c,run,time,bursts,reduced);
  const falling=[];
  for(const q of liquid.filter(q=>!q.frozen&&!q.grounded&&q.h>1e-8).sort((a,b)=>a.x-b.x)) {
    const box={...liquidBounds(q)},last=falling.at(-1),a=last?.box;
    if(last && last.kind===q.kind && box.w>20 && a.w>20 && box.h>22 && a.h>22 &&
      Math.abs(a.x+a.w-box.x)<.5 && Math.abs(a.y+a.h-box.y-box.h)<2 && Math.abs(a.y-box.y)<16) {
      const bottom=Math.max(a.y+a.h,box.y+box.h);a.y=Math.min(a.y,box.y);a.h=bottom-a.y;a.w=box.x+box.w-a.x;
      last.charge=Math.max(last.charge||0,q.charge||0);
    } else falling.push({...q,box});
  }
  // Fill each liquid's overlapping parcels in one pass. Per-parcel gradients
  // and bright outlines made a draining basin look like a chain of glass beads.
  // Keep separate subpaths: dry gaps never become visible water or conductors.
  const sheets=new Map();
  for(const q of falling){const key=q.kind||'water';if(!sheets.has(key))sheets.set(key,[]);sheets.get(key).push(q);}
  let highlights=0;
  for(const sheet of sheets.values()) {
    const colors=palette(sheet[0]);
    c.beginPath();
    for(const {box:{x,y,w,h}} of sheet) {
      c.roundRect(x,y,w,h,Math.min(w*.5,h*.5));
    }
    const top=Math.min(...sheet.map(q=>q.box.y)),bottom=Math.max(...sheet.map(q=>q.box.y+q.box.h));
    const fill=c.createLinearGradient(0,top,0,Math.max(top+1,bottom));
    fill.addColorStop(0,colors.top);fill.addColorStop(.5,colors.mid);fill.addColorStop(1,colors.bottom);
    c.fillStyle=fill;c.fill();
    // Specular streaks stay inside each occupied strand; batch by material.
    c.beginPath();
    for(const {box:{x,y,w,h}} of sheet)if(w>3&&h>7&&highlights++<48) {
      c.moveTo(x+w*.3,y+h*.22);c.quadraticCurveTo(x+w*.18,y+h*.5,x+w*.32,y+h*.72);
    }
    c.strokeStyle=colors.rim;c.globalAlpha=.4;c.lineWidth=1;c.stroke();c.globalAlpha=1;
  }
  for(const b of reduced?[]:bursts) {
    const age=state.time-b.time,life=1-age/.8;
    c.globalAlpha=life*.75;c.strokeStyle=b.color||"#bceeff";c.lineWidth=1.2;
    c.beginPath();c.ellipse(b.x,b.y,5+age*80*b.force,1+age*3,0,Math.PI,TAU);c.stroke();
    // A low fan of aerated spray at an observed impact, not a glow around every
    // parcel. Its width and lifetime are capped independently of fluid volume.
    if(!b.kind && age<.3) {
      c.beginPath();
      for(let i=0;i<7;i++) {
        const spread=(i-3)*(3+age*28)*b.force,x=b.x+spread,y=b.y-3-Math.sin(i/6*Math.PI)*(4+age*24)*b.force;
        c.moveTo(x+1.3,y);c.arc(x,y,1.3,0,TAU);
      }
      c.fillStyle='#dbfff0';c.globalAlpha=life*.45;c.fill();
    }
    for(let i=0;i<5;i++) {
      const vx=(i-2)*30*b.force,vy=-(45+noise(b.seed+i)*65)*b.force;
      const x=b.x+vx*age,y=b.y+vy*age+220*age*age;
      if(y>b.y)continue;
      c.beginPath();c.moveTo(x-vx*.016,y-(vy+440*age)*.016);c.lineTo(x,y);c.stroke();
    }
  }
  c.restore();
}
