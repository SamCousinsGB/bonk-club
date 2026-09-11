import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine.js";
import { blackholeField } from "../src/blackhole.js";
import { updateFields } from "../src/specials.js";
import { carveExplosion } from "../src/terrain.js";
import { RenderSnapshots } from "../src/render-state.js";
import { compactSnapshot, expandSnapshot } from "../src/snapshot-wire.js";
import { WreckReplayer } from "../src/wreck-motion.js";
import { SnapshotHistory } from "../src/snapshot-delta.js";
import { encodeState, validSnapshot } from "../src/network.js";

function scene() {
  const w = new World({ players:[0,1], random:() => .45 });
  Object.assign(w, {fields:[],cover:[],chunks:[],hazards:[],drops:[],water:[],gas:[],spills:[],projectiles:[]});
  w.platforms = Array.from({length:12}, (_,i) => ({ id:`beam${i}`, x:600+i*90, y:480+(i%3)*110,
    w:180, h:28, baseX:600+i*90, baseY:480+(i%3)*110, dx:0, dy:0 }));
  w.fields = [blackholeField(w,{x:1080,y:530,owner:0})];
  return w;
}
const geometry = w => ({x:w.x,y:w.y,w:w.w,h:w.h,angle:w.angle,
  spine:w.spine?.map(({x,y})=>({x,y})),outline:w.outline});
const collision = s => s.platforms.filter(p=>p.wreckId && !s.wreckage.find(w=>w.id===p.wreckId&&w.kind==='matter'))
  .map(({id,x,y,w,h})=>({id,x,y,w,h}));

test("guests replay exact terrain through packet loss, field transfers, destruction and final hot join", () => {
  const w=scene(), renderer=new RenderSnapshots(), replayer=new WreckReplayer();
  let active=0, transfers=0, settled=0, destroyed=0;
  for(let tick=1;tick<=1020;tick++) {
    if(tick===240) w.fields.push(blackholeField(w,{x:1390,y:610,owner:0}));
    updateFields(w,1/120); w.time+=1/120;
    if(tick===400) {
      const target=w.wreckage.find(p=>p.spine&&p.outer);
      assert.ok(target); const count=w.wreckage.length;
      carveExplosion(w,{x:target.spine[0].x,y:target.spine[0].y,radius:36});
      destroyed=count-w.wreckage.length;
    }
    // Skip deliveries and recreate a receiver mid-field: no prior events needed.
    if(tick%13) continue;
    const wire=JSON.parse(JSON.stringify(compactSnapshot(renderer.make(w.snapshot()))));
    const saved=JSON.stringify(wire), guest=expandSnapshot(wire,validSnapshot,replayer);
    assert.equal(JSON.stringify(wire),saved);
    assert.deepEqual(collision(guest),collision(w));
    for(const piece of w.wreckage.filter(p=>p.spine)) {
      assert.deepEqual(geometry(guest.wreckage.find(g=>g.id===piece.id)),geometry(piece));
      const sent=wire.wreckage.find(g=>g.id===piece.id);
      for(const key of ['x','y','angle','spine','outline','ribbon','tiles'])assert.equal(sent[key],undefined);
      if(sent.terrain.seed){active++; if(sent.terrain.seed.revision>1)transfers++;}
      else settled++;
    }
    if(tick===260 || tick===1014) {
      const hot=expandSnapshot(wire,validSnapshot);
      assert.deepEqual(hot,guest);
    }
    assert.ok(replayer.pieces.size<=60);
  }
  assert.ok(active>0&&transfers>0&&settled>0&&destroyed>0,{active,transfers,settled,destroyed});
  w.startRound();expandSnapshot(compactSnapshot(renderer.make(w.snapshot())),validSnapshot,replayer);
  assert.equal(replayer.pieces.size,0);
});

test("moving terrain transmits seed changes and ticks instead of continuously moving vertices", async () => {
  const w=scene(),renderer=new RenderSnapshots(),recipes=new SnapshotHistory(),vertices=new SnapshotHistory();
  let recipeBytes=0,vertexBytes=0,seq=0;
  for(let tick=0;tick<540;tick++){
    updateFields(w,1/120);w.time+=1/120;
    if(tick%4 || tick<52)continue;
    const full=renderer.make(w.snapshot()),a=compactSnapshot(full);
    const b=compactSnapshot({...full,wreckage:full.wreckage.map(({terrain,...piece})=>piece)});
    // Isolate the terrain so actor/matter traffic cannot obscure its saving.
    const select=s=>({round:s.round,arenaIndex:s.arenaIndex,wreckage:s.wreckage.filter(p=>p.kind!=='matter')});
    const ra=select(a),vb=select(b);
    const [r,v]=await Promise.all([encodeState(recipes.encode(ra,seq)),encodeState(vertices.encode(vb,seq))]);
    recipeBytes+=r.length;vertexBytes+=v.length;seq++;
    recipes.remember(seq,ra);vertices.remember(seq,vb);
  }
  assert.ok(recipeBytes<vertexBytes*.2,`${recipeBytes} recipe bytes / ${vertexBytes} vertex bytes`);
});

test("terrain replay rejects excessive work, invalid seeds and malformed final checkpoints", () => {
  const w=scene(),renderer=new RenderSnapshots();for(let n=0;n<90;n++)updateFields(w,1/120);
  const base=compactSnapshot(renderer.make(w.snapshot())),i=base.wreckage.findIndex(w=>w.terrain?.seed);
  assert.ok(i>=0);
  for(const mutate of [t=>t.steps=1000000,t=>t.steps=-1,t=>t.seed.dt=0,t=>t.seed.age=Infinity,
    t=>t.seed.body.spine=Array(1000).fill({x:0,y:0,px:0,py:0}),t=>t.seed.body.w=1000000,
    t=>{delete t.seed;delete t.steps;t.final={x:0,y:0,w:30,h:10,angle:0,spine:[],outline:[]};}]){
    const bad=structuredClone(base);mutate(bad.wreckage[i].terrain);
    assert.throws(()=>expandSnapshot(bad,validSnapshot),/Invalid terrain/);
  }
});
