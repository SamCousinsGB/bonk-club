import {REFINERY_TANKS,REFINERY_PIPES} from './refinery-arena.js';
export const REFINERY_SOUNDS=['refinery-pump','refinery-hiss','refinery-alarm','refinery-fire','refinery-flow'];
export function synthesizeRefinery(name,rate){
  const out=new Float32Array(rate*4),tau=Math.PI*2;let seed=75196,low=0,mid=0;
  for(let i=0;i<out.length;i++){
    const t=i/rate;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/4294967296*2-1;
    low+=(1-Math.exp(-tau*180/rate))*(noise-low);mid+=(1-Math.exp(-tau*1900/rate))*(noise-mid);
    const pulse=Math.exp(-(t*3%1)*14),fade=Math.max(0,Math.min(1,t/.015,(out.length-1-i)/(rate*.025)));
    let v;
    if(name==='refinery-pump')v=Math.sin(tau*48*t)*.065+Math.sin(tau*96*t)*.018+low*.32+(Math.sin(tau*135*t)*.07+mid*.045)*pulse;
    else if(name==='refinery-hiss')v=(noise-mid)*.15+mid*.08+Math.sin(tau*720*t)*.009;
    else if(name==='refinery-fire')v=(low*.9+mid*.15)*(1+Math.sin(tau*7*t)*.15)+Math.sin(tau*62*t)*.065;
    else if(name==='refinery-flow')v=low*.75*(1+Math.sin(tau*3.5*t)*.3)+mid*.13+Math.sin(tau*(92*t+Math.sin(tau*2*t)*.5))*.022;
    else {const beep=Math.max(0,Math.min(1,(t%.6)/.015,(.26-t%.6)/.04));v=(Math.sin(tau*690*t)*.16+Math.sin(tau*1035*t)*.045)*beep;}
    out[i]=Math.tanh(v)*fade;
  }
  return out;
}
export class RefinerySound{
  constructor(){this.voices=new Map();}
  stop(sound){for(const v of this.voices.values())this.release(sound,v);this.voices.clear();this.stamp=null;}
  release(sound,v){if(v.voice.stopped)return;const now=sound.context.currentTime;v.voice.gain.gain.cancelScheduledValues(now);v.voice.gain.gain.setTargetAtTime(0,now,.02);v.voice.source.stop(now+.09);v.voice.stopped=true;}
  update(sound,state){
    const r=state?.phase==='fight'&&state.refinery;if(!r||!sound.ready()){this.stop(sound);return;}
    const stamp=state.round+':'+r.clock,fresh=this.stamp!==stamp;this.stamp=stamp;
    const warning=r.tanks.filter(t=>t.warning>0).sort((a,b)=>a.warning-b.warning)[0],leaks=r.pipes.filter(q=>q.broken&&q.flow>.05),levels=new Map();
    if(r.feed.flow>.05||r.pipes[0].flow>.05||r.heat>.05)levels.set('refinery-pump',{x:1000,level:.45+r.heat*.3});
    if(r.feed.broken||leaks.length||state.gas?.length||r.tanks.some(t=>t.burst&&t.volume>1))levels.set('refinery-hiss',{x:r.feed.broken?40:leaks.length?REFINERY_PIPES[leaks[0].id].x:state.gas?.[0]?.x??1280,level:Math.min(.65,.2+leaks.length*.06)});
    const pouring=leaks.filter(q=>REFINERY_PIPES[q.id].route!==2&&q.flow>10);
    if(pouring.length)levels.set('refinery-flow',{x:REFINERY_PIPES[pouring[0].id].x,level:Math.min(.75,.2+pouring.reduce((sum,q)=>sum+q.flow,0)/360)});
    if(r.feed.broken&&r.feed.flow>10)levels.set('refinery-flow',{x:40,level:.75});
    const flames=[...(state.gas||[]).filter(g=>g.spray&&g.lit>0),...(state.spills||[]).filter(q=>q.fire>0&&q.h>.1)];
    if(flames.length)levels.set('refinery-fire',{x:flames.reduce((sum,g)=>sum+g.x,0)/flames.length,level:Math.min(.7,.25+flames.length*.04)});
    if(warning){const t=REFINERY_TANKS[warning.id];levels.set('refinery-alarm',{x:t.x+t.w/2,level:.8});}
    const cycle=Math.floor(r.clock/4),offset=r.clock%4,key=state.round+':'+cycle;
    for(const [name,v] of this.voices)if(!levels.has(name)||v.key!==key||v.voice.stopped){this.release(sound,v);this.voices.delete(name);}
    for(const [name,detail] of levels){
      if(!this.voices.has(name)&&offset<3.98&&fresh){const voice=sound.sample(name,detail,{fixed:true,offset,duration:4-offset});if(voice)this.voices.set(name,{key,voice});}
      const v=this.voices.get(name);if(v)v.voice.gain.gain.setTargetAtTime(detail.level,sound.context.currentTime,.08);
    }
  }
}
