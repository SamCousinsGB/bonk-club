import { orbitPoint } from "./orbit.js";

// Only the host captures objects and changes mass. The motion of the authorised
// visual samples depends on this shared solver and the current contents.
export function stepMatter(core, f, dt) {
  core.packing = Math.max(0, Math.min(1, 1 - f.life / 1.1));
  const heads = core.items.filter(q => q.kind === "fighter");
  for (let i = 0; i < core.items.length; i++) {
    const q = core.items[i], head = q.kind === "fighter",
      a = head ? heads.indexOf(q) * Math.PI * 2 / heads.length - Math.PI / 2 : i * 2.399963,
      d = head ? (heads.length === 1 ? 0 : Math.max(0, Math.min(core.w * .25, core.w / 2 - 24))) :
        Math.sqrt((i + .5) / core.items.length) * Math.max(0, core.w / 2 - q.size - 3),
      x = core.x + Math.cos(a) * d, y = core.y + Math.sin(a) * d;
    if (f.life > 1.1) {
      orbitPoint(q, f, dt, .8, 155);
      q.spin += Math.sin(f.age * 9 + q.id) * dt * 7;
      q.angle += q.spin * dt;
      continue;
    }
    const response = f.life <= 0 ? 1 : Math.min(1, dt * (core.packing ? 12 : 3));
    q.x += (x - q.x) * response; q.y += (y - q.y) * response;
    q.angle += ((head ? Math.sin(a) * .22 : a) - q.angle) * response;
  }
}
const records = new WeakMap();
const keys = ["id","x","y","px","py","spin","angle","size","kind"];
const copyItem = q => Object.fromEntries(keys.map(k=>[k,q[k]]));
export function recordMatterStep(core,f,dt) {
  if (dt<=0 || dt>.025 || f.life<=0) { records.delete(core); stepMatter(core,f,dt); return; }
  let r=records.get(core);
  if(!r || r.nextAge!==f.age || r.nextLife!==f.life || r.seed.dt!==dt || r.steps>=1000 ||
      r.seed.x!==f.x || r.seed.y!==f.y || r.seed.core.x!==core.x || r.seed.core.y!==core.y || r.seed.core.w!==core.w ||
      core.items.length!==r.seed.core.items.length || core.items.some((q,i)=>q.id!==r.seed.core.items[i].id)) {
    r={seed:{x:f.x,y:f.y,age:f.age,life:f.life,dt,core:{x:core.x,y:core.y,w:core.w,items:core.items.map(copyItem)}},steps:0};
    records.set(core,r);
  }
  stepMatter(core,f,dt);r.steps++;r.nextAge=f.age+dt;r.nextLife=f.life-dt;
}
export function matterRecipe(core) {
  const r=records.get(core);return r?{seed:r.seed,steps:r.steps}:undefined;
}
const finite=n=>Number.isFinite(n)&&Math.abs(n)<=1000000;
const xy=b=>b&&finite(b.x)&&finite(b.y);
const kinds=["platform","prop","trap","fighter","weapon","projectile","debris","blood"];
function compact(core) {
  if(!core?.orbit)return core;
  const {packing,...out}=core;
  return {...out,items:core.items.map(({x,y,angle,spin,vx,vy,...q})=>q)};
}
export function compactMatter(state) {
  return {...state,fields:state.fields.map(f=>f.matter?{...f,matter:compact(f.matter)}:f),
    wreckage:state.wreckage.map(w=>w.kind==='matter'?compact(w):w)};
}
export class MatterReplayer {
  constructor(){this.cores=new Map();}
  expand(state) {
    if(!Array.isArray(state.fields)||state.fields.length>12||!Array.isArray(state.wreckage)||state.wreckage.length>60)throw new Error("Invalid matter lists");
    const epoch=`${state.round}:${state.arenaIndex}`;
    if(this.epoch!==epoch){this.cores.clear();this.epoch=epoch;}
    const ids=new Set([...state.fields.map(f=>f?.matter?.id),...state.wreckage.filter(w=>w?.kind==='matter').map(w=>w.id)]);
    for(const id of this.cores.keys())if(!ids.has(id))this.cores.delete(id);
    const expand=core=>{
      if(!core || core.orbit===undefined)return core;
      const {seed,steps}=core.orbit||{}, body=seed?.core;
      if(!Number.isSafeInteger(core.id)||core.id<1||!xy(seed)||!xy(body)||!(body.w>0&&body.w<=140)||
          !Number.isFinite(seed.age)||seed.age<0||seed.age>6||!(seed.life>0&&seed.life<=6)||!(seed.dt>0&&seed.dt<=.025)||
          !Number.isInteger(steps)||steps<1||steps>1000||!Array.isArray(body.items)||body.items.length>96||
          !Array.isArray(core.items)||core.items.length!==body.items.length||
          !body.items.every((q,i)=>xy(q)&&[q.px,q.py,q.spin,q.angle,q.size].every(finite)&&q.size>0&&q.size<=16&&
            Number.isSafeInteger(q.id)&&q.id>0&&kinds.includes(q.kind)&&q.id===core.items[i]?.id&&q.kind===core.items[i]?.kind))
        throw new Error("Invalid matter recipe");
      const key=JSON.stringify(seed);let r=this.cores.get(core.id);
      if(!r||r.key!==key||r.steps>steps){r={key,body:structuredClone(body),field:{...seed},steps:0};this.cores.set(core.id,r);}
      while(r.steps<steps){stepMatter(r.body,r.field,seed.dt);r.field.age+=seed.dt;r.field.life-=seed.dt;r.steps++;}
      const {orbit,...out}=core;
      return {...out,packing:r.body.packing,items:core.items.map((q,i)=>({...q,x:r.body.items[i].x,y:r.body.items[i].y,angle:r.body.items[i].angle}))};
    };
    return {...state,fields:state.fields.map(f=>f?.matter?{...f,matter:expand(f.matter)}:f),
      wreckage:state.wreckage.map(w=>w?.kind==='matter'?expand(w):w)};
  }
}
