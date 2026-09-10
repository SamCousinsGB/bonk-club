import test from "node:test";
import assert from "node:assert/strict";
import {FrameAssembler, LatestFrameDecoder, framePackets, PACKET_BYTES} from "../src/realtime.js";
import {compactSnapshot, expandSnapshot} from "../src/snapshot-wire.js";
import {World, ARENAS} from "../src/engine.js";
import {RenderSnapshots, GuestFrames} from "../src/render-state.js";
import {blackholeField} from "../src/blackhole.js";
import {updateFields} from "../src/specials.js";
import {encodeState,decodeState,validSnapshot} from "../src/network.js";

test("unordered frames tolerate reordered/duplicate parts and discard incomplete older state", () => {
  const a = new FrameAssembler(), bytes=Uint8Array.from({length:35000},(_,i)=>i%251);
  const old=framePackets(bytes,1), fresh=framePackets(bytes,2);
  assert.equal(a.push(old[0].buffer,0),null);
  assert.equal(a.push(fresh[2].buffer,10),null);
  assert.equal(a.push(fresh[2].buffer,11),null);
  assert.equal(a.push(fresh[0].buffer,12),null);
  assert.deepEqual(a.push(fresh[1].buffer,13),{t:"frame",seq:2,bytes});
  assert.equal(a.push(old[1].buffer,14),null);
  assert.equal(a.pending.size,0);
});
test("packet loss never grows an assembly queue; malformed and oversized parts are rejected", () => {
  const a=new FrameAssembler(), bytes=new Uint8Array(PACKET_BYTES*2);
  for(let i=1;i<=100;i++)a.push(framePackets(bytes,i)[0].buffer,i*30);
  assert.ok(a.pending.size<=2);
  const malformed=framePackets(bytes,101)[0];new DataView(malformed.buffer).setUint16(6,65535);
  assert.equal(a.push(malformed.buffer,3100),null);
  assert.equal(a.push(new ArrayBuffer(30000),3100),null);
  assert.equal(a.push("bad",3100),null);
  const max=new Uint8Array(250000), packets=framePackets(max,102);
  let frame;for(const p of packets.reverse())frame=a.push(p.buffer,3200)||frame;
  assert.deepEqual(frame.bytes,max);
  assert.throws(()=>framePackets(new Uint8Array(250001),103));
});
test("a blocked decoder processes only the in-progress and newest snapshots, ignoring late sequence numbers", async () => {
  const consumed=[];let release;
  const decoder=new LatestFrameDecoder(async f=>{consumed.push(f.seq);if(f.seq===1)await new Promise(r=>release=r);});
  decoder.push({seq:1});
  for(let seq=2;seq<=100;seq++)decoder.push({seq});
  decoder.push({seq:3});decoder.push({seq:NaN});
  assert.equal(decoder.pending.seq,100);release();await decoder.done;
  assert.deepEqual(consumed,[1,100]);
  decoder.close();decoder.push({seq:101});assert.deepEqual(consumed,[1,100]);
});
test("guest playback never reverses under changing jitter and abandons history after a stall", () => {
  const frames=new GuestFrames(),w=new World(),encoder=new RenderSnapshots();let last=-Infinity;
  for(let n=0;n<60;n++){
    w.time=n/30;frames.push(encoder.make(w.snapshot()),1000+n*1000/30+(n%3)*6);
    const sampled=frames.sample(1020+n*1000/30);assert.ok(sampled.time>=last);last=sampled.time;
  }
  w.time=4;frames.push(encoder.make(w.snapshot()),5000);
  assert.equal(frames.frames.length,1);assert.equal(frames.sample(5000).time,4);
  w.round++;w.time=0;frames.push(encoder.make(w.snapshot()),5033);
  assert.equal(frames.sample(5033).time,0);
});
test("compact black-hole snapshots preserve visible geometry and rebuild bounded collision on every arena", async () => {
  for(let arena=0;arena<ARENAS.length;arena++){
    const w=new World({arena,players:[0,1,2,3],random:()=>.45}),encoder=new RenderSnapshots();
    w.fields=[blackholeField(w,{x:1150,y:800,owner:0}),blackholeField(w,{x:1550,y:800,owner:0})];
    for(let n=0;n<150;n++)updateFields(w,1/120);
    const source=encoder.make(w.snapshot()),saved=structuredClone(source);
    const compact=compactSnapshot(source),bytes=await encodeState(compact);
    const guest=expandSnapshot(await decodeState(bytes),validSnapshot);
    assert.deepEqual(source,saved);assert.ok(validSnapshot(guest),`arena ${arena}`);
    assert.deepEqual(guest.players,JSON.parse(JSON.stringify(source.players)));
    assert.deepEqual(guest.platforms.map(p=>p.id).sort(),source.platforms.map(p=>p.id).sort(),`stable collision ids: arena ${arena}`);
    assert.deepEqual(guest.platforms.filter(p=>!p.wreckId),JSON.parse(JSON.stringify(source.platforms.filter(p=>!p.wreckId))));
    for(const w of source.wreckage){
      const g=guest.wreckage.find(g=>g.id===w.id);assert.ok(g);
      if(w.outline)for(let i=0;i<12;i++)assert.ok(Math.hypot(w.outline[i].x-g.outline[i].x,w.outline[i].y-g.outline[i].y)<.072);
    }
    assert.ok(bytes.length<(await encodeState(source)).length*.6,`arena ${arena}: ${bytes.length}`);
    w.startRound();const reset=expandSnapshot(compactSnapshot(encoder.make(w.snapshot())),validSnapshot);
    assert.equal(reset.wreckage.length,0);assert.ok(reset.platforms.every(p=>!p.wreckId));
  }
});
test("compact snapshot rejects malformed ribbons before collision reconstruction", () => {
  const s=compactSnapshot(new RenderSnapshots().make(new World().snapshot()));
  for(const ribbon of [null,Array(100).fill([0,0]),Array(12).fill([Infinity,0]),Array(12).fill([1e20,0])]){
    assert.throws(()=>expandSnapshot({...s,wreckage:[{ribbon}]},validSnapshot));
  }
  assert.throws(()=>expandSnapshot({...s,platforms:Array(1600).fill(null)},validSnapshot));
  assert.throws(()=>expandSnapshot({...s,wreckage:[{tiles:[10000000]}]},validSnapshot));
});
