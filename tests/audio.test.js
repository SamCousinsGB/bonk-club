import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';
import { SOUND_NAMES, SOUND_RATE, NUKE_FUSE, WEAPON_SOUNDS, synthesizeSound, sirenCycle, weaponSound } from '../src/sound-design.js';
import { WEAPONS } from '../src/arsenal.js';
import { World, STEP } from '../src/engine.js';
import { RenderSnapshots } from '../src/render-state.js';
import { combatFloor } from './helpers.js';
import { Renderer } from '../src/renderer.js';
import { validSnapshot } from '../src/network.js';

test('every weapon has a designed voice; samples are finite, bounded, varied and fade to silence', () => {
  assert.deepEqual(Object.keys(WEAPON_SOUNDS).sort(), Object.keys(WEAPONS).sort());
  for (const [weapon, w] of Object.entries(WEAPONS)) assert.equal(weaponSound({weapon, kind:w.kind}), WEAPON_SOUNDS[weapon]);
  for (const name of SOUND_NAMES) {
    const samples = synthesizeSound(name), variation = synthesizeSound(name, 1);
    let energy = 0, peak = 0, difference = 0;
    for (let i = 0; i < samples.length; i++) {
      assert.ok(Number.isFinite(samples[i]));
      energy += samples[i] ** 2; peak = Math.max(peak, Math.abs(samples[i]));
      difference += Math.abs(samples[i] - variation[i]);
    }
    assert.ok(peak > .04 && peak <= .86, name + ' headroom');
    assert.ok(energy / samples.length > .000001, name + ' audible');
    assert.equal(samples[0], 0); assert.equal(Math.abs(samples.at(-1)), 0);
    assert.ok(difference > .01, name + ' repeated shots vary');
    assert.ok(samples.length <= SOUND_RATE * 4.6 + 1);
  }
});

test('nuclear warning has exactly two rise/fall cycles over the actual fuse', () => {
  assert.equal(NUKE_FUSE, WEAPONS.nuke.life);
  assert.equal(synthesizeSound('siren').length / SOUND_RATE, NUKE_FUSE);
  for (let cycle = 0; cycle < 2; cycle++) {
    const at = cycle * NUKE_FUSE / 2;
    assert.equal(sirenCycle(at), 0);
    assert.ok(sirenCycle(at + .3) < sirenCycle(at + .6));
    assert.ok(sirenCycle(at + .85) > sirenCycle(at + 1.2));
  }
});

function fixture() {
  const sound = new Sound(), samples = [], stops = [], gains = [];
  sound.context = { state:'running', currentTime:10 };
  sound.master = { gain:{setTargetAtTime:(...args)=>gains.push(args)} };
  sound.sample = (name, detail, options = {}) => {
    const voice = { end:sound.context.currentTime + (options.duration || .5), stopped:false,
      source:{stop:time=>stops.push(time)}, gain:{gain:{cancelScheduledValues(){}, setTargetAtTime(){}}} };
    samples.push({name, detail, options, voice}); return voice;
  };
  return { sound, samples, stops, gains };
}
const state = (life = 2.8, time = 1, netId = 12, round = 1) => ({round, time, projectiles:[{nuclear:true, life, netId}]});

test('host and guest sirens start at remaining fuse, stay continuous and stop on detonation', () => {
  for (const netId of [undefined, 12]) {
    const {sound,samples,stops} = fixture(), s = state(2.8,1,netId);
    if (netId === undefined) delete s.projectiles[0].netId;
    sound.update(s);
    assert.equal(samples[0].options.offset, 0);
    assert.equal(samples[0].options.duration, 2.8);
    for (let i = 1; i <= 25; i++) {
      sound.context.currentTime = 10 + i * .1;
      s.time = 1 + i * .1; s.projectiles[0].life = 2.8 - i * .1;
      sound.update(s);
    }
    assert.equal(samples.length, 1, 'no repeated scheduling per frame');
    sound.update({...s, projectiles:[]});
    assert.equal(stops.length, 1); assert.equal(sound.alarm, null);
  }
});

test('hot join and unmute seek into the siren; repeated stale state never restarts it', () => {
  const {sound,samples,stops,gains} = fixture();
  sound.update(state(1.2));
  assert.ok(Math.abs(samples[0].options.offset - 1.6) < .00001);
  sound.context.currentTime += 3;
  for (let i = 0; i < 10; i++) sound.update(state(1.2));
  assert.equal(samples.length, 1);
  sound.muted = true; assert.equal(stops.length, 1); assert.equal(gains.at(-1)[0], 0);
  sound.update(state(.7, 4)); assert.equal(samples.length, 1);
  sound.muted = false; sound.update(state(.6, 4.1));
  assert.ok(Math.abs(samples[1].options.offset - 2.2) < .00001);
  assert.equal(samples[1].options.duration, .6);
});

test('combat hitstop retimes the remaining siren without replaying its opening', () => {
  const {sound,samples,stops} = fixture();sound.update(state());
  sound.context.currentTime += 1;sound.update(state(1.8,2));
  sound.context.currentTime += .2;sound.update(state(1.8,2.2));
  assert.equal(samples.length,2);assert.equal(stops.length,1);
  assert.ok(Math.abs(samples[1].options.offset-1)<.00001);
  assert.equal(samples[1].options.duration,1.8);
});

test('one alarm covers simultaneous nukes; expiry, early blast, reset and exit cancel it', () => {
  for (const end of ['blast','reset','exit','removed']) {
    const {sound,samples,stops} = fixture();
    const s = state(2); s.projectiles.push({nuclear:true,life:1,netId:14});
    sound.update(s); assert.equal(samples.length, 1); assert.equal(samples[0].options.duration, 1);
    if (end === 'blast') sound.play('explosion',{nuclear:true});
    if (end === 'reset') sound.update({...s, round:2, projectiles:[]});
    if (end === 'exit') sound.update(null);
    if (end === 'removed') sound.update({...s,projectiles:[]});
    assert.equal(stops.length, 1); assert.equal(sound.alarm, null);
  }
});

test('invalid/non-nuclear fuse state stays silent; suspended audio does not start an alarm', () => {
  const {sound,samples} = fixture();
  for (const life of [-1, 0, Infinity, NaN, '2', 100]) sound.update(state(life));
  sound.update({round:1,time:1,projectiles:[{nuclear:false,life:2}]});
  sound.context.state = 'suspended'; sound.update(state());
  assert.equal(samples.length, 0);
});

test('actual thrown and fired nukes retain the same alarm deadline through guest snapshots', () => {
  for (const throwing of [false, true]) {
    const world = new World({players:[0,1],bots:[]}); combatFloor(world);
    const p = world.players[0]; Object.assign(p,{weapon:'nuke',ammo:1,x:500,y:400,aimAngle:0});
    if (throwing) world.throwWeapon(p); else world.attack(p);
    const wire = new RenderSnapshots(), {sound,samples} = fixture();
    sound.update(wire.make(world.snapshot()));
    for (let i = 0; i < 60; i++) {
      world.time += STEP; world.updateProjectiles(STEP); sound.context.currentTime += STEP;
      sound.update(wire.make(world.snapshot()));
    }
    assert.equal(samples.length, 1); assert.equal(samples[0].options.duration, 2.8);
    world.projectiles[0].life = STEP / 2; world.updateProjectiles(STEP);
    sound.update(wire.make(world.snapshot())); assert.equal(sound.alarm, null);
  }
});

test('simultaneous weapon types keep their voices; duplicate same-type bursts coalesce', () => {
  const {sound,samples} = fixture();
  sound.play('shoot',{weapon:'smg'}); sound.play('shoot',{weapon:'shotgun'});
  sound.play('shoot',{weapon:'smg'});
  assert.deepEqual(samples.map(s=>s.name), ['smg','shotgun']);
});

test('hot join skips historic combat sounds and particles but keeps fresh fire', () => {
  const renderer = {lastEvent:0,particles:[],impacts:[],shake:0}, played = [];
  Renderer.prototype.events.call(renderer,[
    {id:1,type:'shoot',kind:'bullet',weapon:'smg',x:100,y:100,at:1},
    {id:2,type:'explosion',nuclear:true,x:100,y:100,at:1.1},
    {id:3,type:'shoot',kind:'bullet',weapon:'shotgun',x:100,y:100,at:3},
  ],{play:(type,e)=>played.push(e.weapon)},3.1);
  assert.deepEqual(played,['shotgun']);
  assert.equal(renderer.particles.length,5);
  assert.equal(renderer.particles.filter(p=>p.smoke).length,3);
});

test('combat timestamps and sword/hammer handling survive validated guest state', () => {
  for (const weapon of ['sword','hammer']) {
    const w = new World({players:[0,1],bots:[]});combatFloor(w);w.time=12;
    Object.assign(w.players[0],{weapon,ammo:4,x:200,y:400,aimAngle:0});w.players[1].x=2000;
    w.attack(w.players[0]);
    const s = new RenderSnapshots().make(w.snapshot());assert.ok(validSnapshot(s));
    const e=s.events.find(e=>e.type==='swing');assert.equal(e.at,12);assert.equal(e.weapon,weapon);
    const {sound,samples}=fixture();sound.play(e.type,e);
    assert.equal(samples[0].name,weapon==='sword'?'blade':'heavy-swing');
  }
});
