import { COLOSSUS, colossusEye } from './colossus.js';
export const COLOSSUS_SOUND_SECONDS=COLOSSUS.charge+COLOSSUS.fire+3;

// One cached, seekable voice: distant gearing, a slowly rising pressure tone,
// then sustained discharge and a long falling echo. Idle periods stay silent.
export function synthesizeColossus(rate) {
  const pcm=new Float32Array(Math.ceil(COLOSSUS_SOUND_SECONDS*rate));
  let seed=314159,low=0,mid=0,phase=0;
  for(let i=0;i<pcm.length;i++){
    const t=i/rate,charge=Math.min(1,t/COLOSSUS.charge),fire=t-COLOSSUS.charge;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const noise=(seed>>>0)/4294967296*2-1;
    low+=(1-Math.exp(-TAU*82/rate))*(noise-low);
    mid+=(1-Math.exp(-TAU*1600/rate))*(noise-mid);
    phase+=TAU*(39+charge*22)/rate;
    const gear=(Math.sin(phase)+Math.sin(phase*2.013)*.26+Math.sin(phase*5.17)*.09)*(.045+.15*charge**2);
    const chargeNoise=(low*.85+mid*.055)*charge**2;
    const onset=fire<0?0:Math.min(1,fire/.06);
    const tail=Math.exp(-Math.max(0,fire-COLOSSUS.fire)*2.1);
    const discharge=(low*4+mid*.72+Math.sin(phase*.73)*.23)*onset*tail;
    const envelope=Math.max(0,Math.min(1,t/.4,(COLOSSUS_SOUND_SECONDS-t)/.35));
    pcm[i]=Math.tanh((gear+chargeNoise)*(fire<0?1:tail*.45)+discharge)*.64*envelope;
  }
  pcm[pcm.length-1]=0;return pcm;
}
const TAU=Math.PI*2;
export class ColossusSound {
  constructor(){this.current=null;}
  stop(sound){
    const voice=this.current?.voice;
    if(voice&&!voice.stopped){
      const now=sound.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.02);
      voice.source.stop(now+.09);voice.stopped=true;
    }
    this.current=null;
  }
  update(sound,state){
    const h=state?.phase==='fight'&&state.hazards?.find(h=>h.type==='colossus'&&!h.done);
    if(!h||!sound.ready()){this.stop(sound);return;}
    const offset=h.age%COLOSSUS.cycle-COLOSSUS.wake;
    if(offset<0||offset>=COLOSSUS_SOUND_SECONDS){this.stop(sound);return;}
    const key=`${state.arenaIndex}:${state.round}:${h.cycleId}`;
    if(this.current?.key===key){
      if(this.current.age===h.age)return;
      this.current.age=h.age;
      if(Math.abs(this.current.voice.end-sound.context.currentTime-(COLOSSUS_SOUND_SECONDS-offset))<.18)return;
    }
    this.stop(sound);
    const voice=sound.sample('colossus',{x:(colossusEye(h,0).x+colossusEye(h,1).x)/2},{priority:true,fixed:true,offset,duration:COLOSSUS_SOUND_SECONDS-offset});
    if(voice)this.current={key,age:h.age,voice};
  }
}
