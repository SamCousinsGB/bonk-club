import { TRAIN_LENGTH, TRAIN_SPEED, TRAIN_START, TRAIN_CYCLE } from './setpiece-arenas.js';
export const TRAIN_PASS_SECONDS = (2560 + TRAIN_LENGTH) / TRAIN_SPEED;
export const TRAIN_SOUND_SECONDS = TRAIN_PASS_SECONDS + .24;

// A single cached pressure/wind recording. Its envelope follows the entire
// train pass; the noise does not decay away immediately after the nose arrives.
export function synthesizeTrain(rate, variant=0) {
  const pcm = new Float32Array(Math.ceil(TRAIN_SOUND_SECONDS * rate));
  let seed=43971+variant*7919,low=0,bass=0,phase=0;
  for(let i=0;i<pcm.length;i++){
    const t=i/rate,u=t/TRAIN_PASS_SECONDS;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const n=(seed>>>0)/4294967296*2-1;
    low+=(1-Math.exp(-Math.PI*2*(5200-2600*Math.min(1,u))/rate))*(n-low);
    bass+=(1-Math.exp(-Math.PI*2*160/rate))*(n-bass);
    phase+=Math.PI*2*(130-58*Math.min(1,u))/rate;
    const approach=Math.min(1,t/.11),depart=Math.exp(-Math.max(0,t-TRAIN_PASS_SECONDS+.12)*15);
    const rush=(.63+.37*Math.sin(Math.PI*Math.min(1,u)))*approach*depart;
    const seams=.78+.22*Math.sin(Math.PI*2*t*TRAIN_SPEED/400)**8;
    const pressure=Math.exp(-(((t-.18)/.07)**2));
    const v=(low*1.1+bass*2.5+Math.sin(phase)*.16)*rush*seams+Math.sin(phase*.53)*pressure*.2;
    const fade=Math.min(1,i/(rate*.006),(pcm.length-1-i)/(rate*.035));
    pcm[i]=Math.tanh(v)*.82*Math.max(0,fade);
  }
  return pcm;
}

export class TrainSound {
  constructor(){this.current=null;}
  stop(sound){
    const voice=this.current?.voice;
    if(voice&&!voice.stopped){
      voice.gain.gain.cancelScheduledValues(sound.context.currentTime);
      voice.gain.gain.setTargetAtTime(0,sound.context.currentTime,.008);
      voice.source.stop(sound.context.currentTime+.035);voice.stopped=true;
    }
    this.current=null;
  }
  update(sound,state){
    const h=state?.phase==='fight'&&state.hazards?.find(h=>h.type==='train'&&!h.done);
    if(!h||!sound.ready()){this.stop(sound);return;}
    const offset=h.age%TRAIN_CYCLE-TRAIN_START;
    if(offset<0||offset>=TRAIN_SOUND_SECONDS){this.stop(sound);return;}
    const key=`${state.arenaIndex}:${state.round}:${h.id}:${Math.floor(h.age/TRAIN_CYCLE)}`;
    if(this.current?.key===key){
      if(this.current.age===h.age)return;
      this.current.age=h.age;
      if(Math.abs(this.current.voice.end-sound.context.currentTime-(TRAIN_SOUND_SECONDS-offset))<.12)return;
    }
    this.stop(sound);
    const voice=sound.sample('train',{}, {priority:true,fixed:true,offset,duration:TRAIN_SOUND_SECONDS-offset});
    if(!voice)return;
    const pan=voice.pan?.pan,now=sound.context.currentTime;
    if(pan){pan.setValueAtTime(h.dir*(-.85+1.7*Math.min(1,offset/TRAIN_PASS_SECONDS)),now);
      pan.linearRampToValueAtTime(h.dir*.85,now+Math.max(.001,TRAIN_PASS_SECONDS-offset));}
    this.current={key,age:h.age,voice};
  }
}
