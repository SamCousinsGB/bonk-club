import test from 'node:test';
import assert from 'node:assert/strict';
import {Sound} from '../src/audio.js';
import {COLOSSUS_SOUND_SECONDS,synthesizeColossus} from '../src/colossus-sound.js';

test('colossus sound builds slowly, sustains the laser and decays to silence with bounded output',()=>{
  const rate=12000,pcm=synthesizeColossus(rate);
  const rms=(a,b)=>Math.sqrt(pcm.slice(a*rate,b*rate).reduce((s,v)=>s+v*v,0)/((b-a)*rate));
  assert.equal(pcm.length,rate*COLOSSUS_SOUND_SECONDS);
  assert.ok(pcm.every(n=>Number.isFinite(n)&&Math.abs(n)<=.64));
  assert.equal(Math.abs(pcm[0]),0);assert.equal(Math.abs(pcm.at(-1)),0);
  assert.ok(rms(8,9)>rms(1,2)*2);assert.ok(rms(11,13)>rms(8,9)*1.3);
  assert.ok(rms(16.5,17)<rms(11,13)*.12);
});
function fixture(){
  const sound=new Sound(),played=[],stopped=[];
  sound.context={currentTime:0,state:'running'};sound.master={gain:{setTargetAtTime(){}}};
  sound.sample=(name,detail,options)=>{played.push({name,detail,...options});return {end:sound.context.currentTime+options.duration,
    source:{stop(){stopped.push(name);}},gain:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}}};};
  const state={arenaIndex:40,round:1,phase:'fight',players:[],projectiles:[],hazards:[{type:'colossus',id:1,age:0,eye:0,cycleId:0}]};
  const seek=age=>{sound.context.currentTime=age;state.time=age;state.hazards[0].age=age;sound.update(state);};
  return {sound,state,seek,played,stopped};
}
test('one voice seeks into charge or firing for hot joins and ignores repeated snapshots',()=>{
  const f=fixture();f.seek(15);assert.equal(f.played.length,0);
  f.seek(22);assert.equal(f.played.length,1);assert.equal(f.played[0].offset,6);
  for(let n=0;n<100;n++)f.sound.update(f.state);assert.equal(f.played.length,1);
  f.seek(27);assert.equal(f.played.length,1);
  f.seek(35);assert.equal(f.sound.colossus.current,null);assert.equal(f.stopped.length,1);
});
test('mute, leaving the arena, reset, result and suspension stop the colossus voice',()=>{
  for(const stop of ['mute','leave','reset','result','suspend']){
    const f=fixture();f.seek(28);
    if(stop==='mute')f.sound.muted=true;
    if(stop==='reset')f.state.hazards[0].age=0;
    if(stop==='result')f.state.phase='result';
    if(stop==='suspend')f.sound.context.state='suspended';
    f.sound.update(stop==='leave'?null:f.state);
    assert.equal(f.sound.colossus.current,null,stop);assert.equal(f.stopped.length,1,stop);
    if(stop==='mute'){f.sound.muted=false;f.seek(29);assert.equal(f.played.at(-1).offset,13);}
  }
});
