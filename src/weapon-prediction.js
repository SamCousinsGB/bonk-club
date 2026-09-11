import { segmentBox, playerBox } from "./collision.js";
import { stepFlight } from "./flight-replay.js";

const STEP = 1 / 120, LIMIT = 128, STALE = 250, MAX_PREVIEW = 750;
const key = b => `${b.action}:${b.shot || 0}`;
// These entities are display-only. They never enter a World's collision,
// inventory, damage, destruction or score calculations.
export class WeaponPrediction {
  constructor() { this.reset(); }
  reset() { this.pending = new Map(); this.retired = new Map(); this.effects = []; this.played = new Map(); this.lastAt=null; }
  capture(list, entity, seq, now) {
    const id = key(entity);
    if (!entity.action || this.pending.has(id) || this.pending.size >= LIMIT) return;
    this.retired.delete(id);
    this.pending.set(id, { list, entity:{...entity}, seq, at:now, confirmed:false });
  }
  event(e, now) {
    if (!e.action || !["shoot","throw"].includes(e.type)) return;
    const id=`${e.action}:${e.type}`;
    if (this.played.has(id)) return;
    this.played.set(id,now); this.effects.push({...e});
    while(this.played.size>256)this.played.delete(this.played.keys().next().value);
  }
  takeEvents() { return this.effects.splice(0); }
  acceptEvent(e) { return !e.action || !this.played.has(`${e.action}:${e.type}`); }
  position(r, now) {
    const b={...r.entity}, dt=Math.max(0,Math.min(MAX_PREVIEW,now-r.at))/1000;
    const ticks=Math.floor(dt/STEP), rest=dt-ticks*STEP;
    for(let n=0;n<ticks;n++)this.step(b,r.list,STEP);
    if(rest>0){const next={...b};this.step(next,r.list,STEP);const t=rest/STEP;
      b.x+=(next.x-b.x)*t;b.y+=(next.y-b.y)*t;b.angle=(b.angle||0)+((next.angle||0)-(b.angle||0))*t;
      b.age=(b.age||0)+rest;b.life+=(next.life-b.life)*t;}
    if(r.offset){const decay=Math.exp(-Math.max(0,now-r.at)/35);b.x+=r.offset.x*decay;b.y+=r.offset.y*decay;}
    return b;
  }
  step(b,list,dt) {
    if(list==='projectiles')stepFlight(b,dt);
    else if(list==='drops'){b.vy+=1000*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle=(b.angle||0)+(b.spin||0)*dt;b.life-=dt;}
    else {b.age+=dt;b.life-=dt;}
  }
  receive(state,id,now) {
    this.lastAt=now;
    const p=state.players.find(p=>p.id===id), ack=state.inputAcks?.[id] || 0;
    for(const [id,r] of this.pending) {
      const actual=state[r.list].find(b=>b.action===r.entity.action&&(b.shot||0)===(r.entity.shot||0));
      // A firing event arrives on the fast actor stream before a PHASER field
      // may arrive with the slower world. Its absence there is not rejection.
      if(r.list==='fields' && state.events.some(e=>e.type==='shoot'&&e.action===r.entity.action))r.authorized=true;
      if(actual && actual.owner===p?.id) {
        // Reconcile the same shot instead of drawing an extra confirmed copy.
        // Reflections/bounces use the authoritative trajectory immediately.
        const previous=this.position(r,now), turned=actual.bounces!==r.entity.bounces ||
          actual.vx*r.entity.vx+actual.vy*r.entity.vy<0;
        r.offset=turned?null:{x:previous.x-actual.x,y:previous.y-actual.y};
        r.entity={...actual};r.at=now;r.confirmed=true;
      } else if(r.confirmed || ack>=r.seq&&!r.authorized || !p?.alive || p.knockdown || p.freeze || p.strands || now-r.at>MAX_PREVIEW) {
        this.retired.set(id,{owner:r.entity.owner,at:now});
        while(this.retired.size>LIMIT)this.retired.delete(this.retired.keys().next().value);
        this.pending.delete(id);
      }
    }
    for(const [id,at] of this.played)if(now-at>2000)this.played.delete(id);
  }
  sample(state,now) {
    for(const [id,r] of this.retired)if(now-r.at>STALE)this.retired.delete(id);
    if(!this.pending.size&&!this.retired.size)return state;
    const out={...state};
    // The local shooter uses current confirmation, even when remote actors are
    // still buffered before this shot's birth or authoritative impact.
    for(const list of ['projectiles','drops','fields'])out[list]=state[list].filter(b=>{
      const retired=this.retired.get(key(b));return !retired||retired.owner!==b.owner;
    });
    const solids=[...state.platforms,...state.cover,...state.chunks].filter(s=>s.hp!==0);
    for(const [id,r] of this.pending) {
      if(now-r.at>MAX_PREVIEW || now-this.lastAt>STALE){this.pending.delete(id);continue;}
      const b=this.position(r,now);
      if(r.list==='fields' && b.life<=0)continue;
      // A preview may stop at contact, but only a host update can produce an
      // impact, bounce, explosion, hit marker or damaged fighter.
      if(r.list!=='fields') {
        const targets=[...solids,...(b.kind==='grenade'?[]:state.players.filter(p=>p.alive&&p.id!==b.owner).map(playerBox))];
        const hit=targets.map(s=>segmentBox(r.entity.x,r.entity.y,b.x,b.y,s,b.r||7))
          .filter(Boolean).sort((a,b)=>a.t-b.t)[0];
        if(hit){b.x=r.entity.x+(b.x-r.entity.x)*hit.t;b.y=r.entity.y+(b.y-r.entity.y)*hit.t;}
      }
      const list=out[r.list], index=list.findIndex(q=>key(q)===id);
      if(index>=0)list[index]=b;else list.push(b);
    }
    return out;
  }
}
