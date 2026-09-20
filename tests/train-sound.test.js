import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';
import { synthesizeTrain, TRAIN_PASS_SECONDS, TRAIN_SOUND_SECONDS } from '../src/train-sound.js';
import { trainPose } from '../src/trains.js';

test('express crosses the arena in under a second; rushing wind remains strong across the pass and fades out',()=>{
  assert.ok(TRAIN_PASS_SECONDS<1);
  const rate=24000,pcm=synthesizeTrain(rate);
  const rms=(a,b)=>Math.sqrt(pcm.slice(a*rate,b*rate).reduce((s,v)=>s+v*v,0)/((b-a)*rate));
  assert.equal(pcm.length,Math.ceil(TRAIN_SOUND_SECONDS*rate));
  assert.ok(pcm.every(v=>Number.isFinite(v)&&Math.abs(v)<=.82));
  assert.equal(Math.abs(pcm[0]),0);assert.equal(Math.abs(pcm.at(-1)),0);
  assert.ok(rms(.2,.4)>.16);assert.ok(rms(.6,.75)>.12);
  assert.ok(rms(1.02,1.1)<rms(.2,.4)/3);
});

function fixture(){
  const s=new Sound(),played=[],stops=[],pans=[];
  s.context={currentTime:10,state:'running'};s.master={gain:{setTargetAtTime(){}}};
  s.sample=(name,detail,options)=>{
    played.push({name,...options});return {end:s.context.currentTime+options.duration,stopped:false,
      gain:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}},source:{stop(){stops.push(name);}},
      pan:{pan:{setValueAtTime(v){pans.push(v);},linearRampToValueAtTime(v){pans.push(v);}}}};
  };
  const state={arenaIndex:1,round:1,phase:'fight',time:1,players:[],projectiles:[],hazards:[]};
  const seek=age=>{state.time=age;state.hazards=[{id:1,type:'train',age,...trainPose(age)}];s.context.currentTime=10+age;s.update(state);};
  return {s,state,played,stops,pans,seek};
}
test('one bounded pass voice seeks on hot join, pans in travel direction and cannot restart from a stale frame',()=>{
  const f=fixture();f.seek(5.35);assert.equal(f.played.length,1);
  assert.ok(Math.abs(f.played[0].offset-.35)<1e-6);assert.equal(f.pans.at(-1),.85);
  for(let i=0;i<100;i++)f.s.update(f.state);assert.equal(f.played.length,1);
  f.seek(5.55);assert.equal(f.played.length,1);
  f.seek(6.15);assert.equal(f.s.train.current,null);assert.equal(f.stops.length,1);
  f.seek(16.3);assert.equal(f.pans.at(-1),-.85);
  f.s.play('hazard',{kind:'train'});assert.equal(f.played.length,2);
});
test('mute, destruction, results and departure stop the rushing wind; unmute seeks to the current pass',()=>{
  for(const end of ['mute','done','result','leave']){
    const f=fixture();f.seek(5.2);
    if(end==='mute')f.s.muted=true;
    if(end==='done')f.state.hazards[0].done=true;
    if(end==='result')f.state.phase='result';
    f.s.update(end==='leave'?null:f.state);
    assert.equal(f.s.train.current,null,end);assert.equal(f.stops.length,1,end);
    if(end==='mute'){f.s.muted=false;f.seek(5.6);assert.ok(Math.abs(f.played.at(-1).offset-.6)<1e-6);}
  }
});
