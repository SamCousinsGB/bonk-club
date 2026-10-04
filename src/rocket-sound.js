import {ROCKET,rocketPhase,rocketNozzle} from './rocket.js';
export const ROCKET_SOUND_SECONDS=ROCKET.warning+ROCKET.fire+ROCKET.purge;

// One original, seekable recording contains valve knocks, three warning pulses,
// turbopump spin-up, low combustion, turbulent crackle and the decaying purge.
export function synthesizeRocket(rate){
  const out=new Float32Array(Math.ceil(ROCKET_SOUND_SECONDS*rate)),tau=Math.PI*2;
  let seed=817263,low=0,mid=0,bass=0,phase=0;
  const a=f=>1-Math.exp(-tau*f/rate),al=a(165),am=a(2600),ab=a(35);
  for(let i=0;i<out.length;i++){
    const t=i/rate,fire=t-3,tail=Math.max(0,fire-5),charge=Math.min(1,t/3);
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/4294967296*2-1;
    low+=al*(noise-low);mid+=am*(noise-mid);bass+=ab*(noise-bass);
    phase+=tau*(72+charge*190)/rate;
    const pulse=t<3?Math.max(0,1-(t%1)/.28)*Math.min(1,(t%1)/.012):0;
    const warning=(Math.sin(tau*620*t)*.1+Math.sin(tau*930*t)*.035)*pulse;
    const pump=(Math.sin(phase)*.022+Math.sin(phase*1.007)*.014+mid*.035)*charge**2;
    const start=fire<0?0:Math.min(1,fire/.075),end=Math.exp(-tail*2.6);
    const flutter=.8+.12*Math.sin(tau*13.7*t)+.08*Math.sin(tau*31.3*t);
    const roar=(low*3.4+bass*2+mid*.5)*flutter+Math.sin(tau*42*t)*.12;
    const ignition=fire<0?0:Math.exp(-fire*9)*(low*3+Math.sin(tau*(65*fire-11*fire*fire))*.28);
    const vent=tail>0?mid*.27*Math.exp(-tail*.9)*Math.min(1,tail*12):0;
    const v=warning+pump*(fire<0?1:end*.25)+roar*start*end+ignition+vent;
    const fade=Math.min(1,t/.012,(out.length-1-i)/(rate*.06));
    out[i]=Math.tanh(v)*.64*Math.max(0,fade);
  }
  return out;
}
export class RocketSound{
  constructor(){this.current=null;}
  stop(sound){
    const voice=this.current?.voice;
    if(voice&&!voice.stopped){const now=sound.context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.018);voice.source.stop(now+.08);voice.stopped=true;}
    this.current=null;
  }
  update(sound,state){
    const h=state?.phase==='fight'&&state.hazards?.find(h=>h.type==='rocket'&&!h.done);
    if(!h||!sound.ready()){this.stop(sound);return;}
    const p=rocketPhase(h.age),offset=p.t-ROCKET.idle;
    if(offset<0||offset>=ROCKET_SOUND_SECONDS-.002){this.stop(sound);return;}
    const key=`${state.arenaIndex}:${state.round}:${h.id}:${p.cycle}`,remaining=ROCKET_SOUND_SECONDS-offset;
    if(this.current?.key===key){
      if(this.current.age===h.age)return;
      this.current.age=h.age;
      if(Math.abs(this.current.voice.end-sound.context.currentTime-remaining)<.2){
        this.current.voice.pan.pan.setTargetAtTime((rocketNozzle(h).x-1280)/1280*.7,sound.context.currentTime,.1);return;
      }
    }
    this.stop(sound);
    const voice=sound.sample('rocket-test',{x:rocketNozzle(h).x},{priority:true,fixed:true,offset,duration:remaining});
    if(voice)this.current={key,age:h.age,voice};
  }
}
