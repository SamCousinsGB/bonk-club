import test from "node:test";
import assert from "node:assert/strict";
import { World, ARENAS } from "../src/engine.js";
import { PLANE, planePose } from "../src/plane.js";
import { drawPlaneSky, drawPlaneInterior, drawPlaneHull, drawPlanePlatform, drawPlaneEngine } from "../src/plane-art.js";
import { drawHazards } from "../src/trap-art.js";
import { carveExplosion } from "../src/terrain.js";
import { hazardArtBounds } from "../src/hazard-break-art.js";

const world=()=>new World({arena:ARENAS.findIndex(a=>a.cargoPlane),players:[0,1,2,3],shuffle:false});
function recording() {
  const calls=[];let depth=0;
  const c=new Proxy({}, {get:(_,name)=>(...args)=>{
    for(const a of args)if(typeof a==="number")assert.ok(Number.isFinite(a),String(name));
    calls.push([name,...args]);
    if(name==="save")depth++;
    if(name==="restore")assert.ok(--depth>=0);
    if(name==="createLinearGradient"||name==="createRadialGradient")return {addColorStop(at){assert.ok(at>=0&&at<=1);}};
  }});
  return {c,calls,balanced:()=>assert.equal(depth,0)};
}

test("the roomier interior and full aircraft stay within the fixed camera during banking",()=>{
  assert.ok(PLANE.innerX*PLANE.innerY/(752*522)>1.10);
  assert.ok(PLANE.innerX*PLANE.innerY/(752*522)<1.12);
  const w=world(),engines=w.hazards.filter(h=>h.type==="turbine");
  const extents=[{x:50,y:700},{x:2510,y:732},{x:1280,y:PLANE.y-PLANE.ry},{x:1280,y:PLANE.y+PLANE.ry}];
  for(const h of engines)for(let i=0;i<32;i++)extents.push({x:h.bodyX+Math.cos(i*Math.PI/16)*(h.w/2+25),y:h.bodyY+Math.sin(i*Math.PI/16)*(h.w/2+30)});
  for(let age=0;age<100;age+=.17)for(const reduced of [false,true]) {
    const p=planePose(age,reduced),c=Math.cos(p.angle),s=Math.sin(p.angle);
    for(const q of extents) {
      const x=q.x-PLANE.x,y=q.y-PLANE.y;
      const sx=PLANE.x+p.x+p.scale*(x*c-y*s),sy=PLANE.y+p.y+p.scale*(x*s+y*c);
      assert.ok(sx>0&&sx<2560&&sy>0&&sy<1440);
    }
  }
});

test("smooth hull skin is clipped by actual surviving collision after a breach",()=>{
  const w=world();carveExplosion(w,{x:PLANE.x+PLANE.rx,y:PLANE.y,radius:150});
  const {c,calls,balanced}=recording();drawPlaneHull(c,w.platforms);balanced();
  const rects=calls.filter(a=>a[0]==="rect").map(a=>a.slice(1));
  assert.deepEqual(rects,w.platforms.filter(p=>p.planeHull&&p.hp!==0).map(p=>[p.x,p.y,p.w,p.h]));
  assert.ok(calls.some(a=>a[0]==="clip"&&a[1]==="evenodd"));
});

test("aircraft art stays finite, bounded and does not mutate gameplay state",()=>{
  const w=world(),before=structuredClone(w.snapshot()),{c,calls,balanced}=recording();
  drawPlaneSky(c,100,false);drawPlaneInterior(c);
  for(const p of w.platforms.filter(p=>!p.planeHull))drawPlanePlatform(c,p);
  drawHazards(c,w.hazards,10,"cargo-plane","all",false,w.platforms);
  balanced();assert.ok(calls.length<3000);assert.deepEqual(w.snapshot(),before);
});

test("aircraft engines animate in reduced motion and disappear fully when destroyed",()=>{
  const h=world().hazards.find(h=>h.type==="turbine"),first=recording(),second=recording();
  const bounds=hazardArtBounds(h,"cargo-plane");
  assert.ok(bounds.y<=720&&bounds.y+bounds.h>=h.bodyY+h.w/2+30);
  assert.ok(bounds.x<=h.bodyX-h.w/2-24&&bounds.w>=h.w+48);
  drawPlaneEngine(first.c,h,true,1);drawPlaneEngine(second.c,h,true,2);
  first.balanced();second.balanced();
  assert.notDeepEqual(first.calls.filter(a=>a[0]==="rotate"),second.calls.filter(a=>a[0]==="rotate"));
  const gone=recording();drawHazards(gone.c,[{...h,done:true}],2,"cargo-plane");
  assert.deepEqual(gone.calls,[]);
});
