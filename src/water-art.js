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

export function drawWater(c,state,time) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  for (const q of state.water || []) {
    if (q.frozen) continue;
    if (q.grounded) {
      // Adjacent parcels use the same world-space wave, hiding column seams.
      const wave = x => Math.sin(x*.07+time*4)*.8 + Math.sin(x*.13-time*3)*.4;
      c.beginPath(); c.moveTo(q.x,q.y+q.h);
      for(let i=0;i<=4;i++) {const x=q.x+i*q.w/4;c.lineTo(x,q.y+wave(x));}
      c.lineTo(q.x+q.w,q.y+q.h);c.closePath();
      c.fillStyle=q.charge?"#3ebcd88c":"#278fbf88";c.fill();
      c.beginPath();for(let i=0;i<=4;i++){const x=q.x+i*q.w/4;i?c.lineTo(x,q.y+wave(x)):c.moveTo(x,q.y+wave(x));}
      c.strokeStyle=q.charge?"#b6f6ffaa":"#a6e6f7ad";c.lineWidth=1.4;c.stroke();
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
