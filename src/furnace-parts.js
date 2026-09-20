import { carveRectangle } from './nuclear.js';
import { CABLE_LAYOUTS, cableLayout } from './cable-layout.js';

// Three shell sections, three electrodes, six independent terminal/riser sets.
// These are machinery hit surfaces, not new walking platforms.
export const FURNACE_PARTS = [
  ...[-1, 0, 1].map(n => ({x: n * 170 - 85, y: 35, w: 170, h: 280, kind: 'shell'})),
  ...[-145, 0, 145].map(x => ({x: x - 17, y: -234, w: 34, h: 202, kind: 'electrode'})),
  ...CABLE_LAYOUTS.filter(c => c.kind === 'furnace').map(c => ({x:c.b.x-1280-14,y:c.b.y-1000-20,w:28,h:825-c.b.y,kind:'terminal'})),
];
export const furnacePartBox = (h, i) => ({...FURNACE_PARTS[i],x:h.x+FURNACE_PARTS[i].x,y:h.y+FURNACE_PARTS[i].y});
export const initialFurnacePieces = () => FURNACE_PARTS.map(({x,y,w,h},part)=>({x,y,w,h,part}));
export function furnacePartAlive(h,i) {
  if(!h?.furnacePieces)return (h?.furnaceParts?.[i]??100)>0;
  const b=FURNACE_PARTS[i],pieces=h.furnacePieces.filter(p=>p.part===i);
  if(i<3)return pieces.length>0;
  // A severed electrode or riser loses continuity even if both ends remain.
  let end=b.y;
  for(const p of pieces.filter(p=>p.x<=b.x+b.w/2&&p.x+p.w>=b.x+b.w/2).sort((a,b)=>a.y-b.y)){
    if(p.y>end+.05)return false;end=Math.max(end,p.y+p.h);
  }
  return end>=b.y+b.h-.05;
}
export const furnaceHits = world => world.hazards.filter(h=>h.type==='furnace').flatMap(h=>
  (h.furnacePieces||initialFurnacePieces()).map(p=>({...p,x:p.x+h.x,y:p.y+h.y,furnaceHazard:h,furnaceIndex:p.part})));
const area=p=>p.w*p.h;
const near=(b,p)=>({x:Math.max(b.x,Math.min(p.x,b.x+b.w)),y:Math.max(b.y,Math.min(p.y,b.y+b.h))});
function recordCut(world,h,pieces,removed,point,radius) {
  if(!removed.length)return;
  // Bound the representation by merging adjacent strips, never filling a hole.
  const merged=[];
  for(const p of pieces.sort((a,b)=>a.part-b.part||a.y-b.y||a.x-b.x)) {
    const prev=merged.at(-1);
    if(prev&&prev.part===p.part&&Math.abs(prev.y-p.y)<.001&&Math.abs(prev.h-p.h)<.001&&Math.abs(prev.x+prev.w-p.x)<.001)prev.w+=p.w;
    else merged.push({...p});
  }
  h.furnacePieces=merged;
  h.furnaceParts=FURNACE_PARTS.map((b,i)=>Math.min(100,merged.filter(p=>p.part===i).reduce((n,p)=>n+area(p),0)/area(b)*100));
  if(!merged.some(p=>p.part<3)){h.furnaceMelt=0;h.furnaceLeaks=[];}
  const shell=removed.filter(p=>p.part<3);
  if(shell.length&&h.furnaceMelt>0) {
    const target=point||{x:shell[0].x+shell[0].w/2,y:shell[0].y+shell[0].h/2};
    const mouth=shell.map(p=>near(p,target)).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0];
    const r=Math.max(5,Math.min(24,radius*.3)),leaks=h.furnaceLeaks;
    const old=leaks.find(l=>Math.hypot(l.x-mouth.x,l.y-mouth.y)<l.r+r+16);
    if(old){old.r=Math.min(30,Math.max(old.r,r)+2);}
    else if(leaks.length<12)leaks.push({...mouth,r,born:h.age});
    else {const l=leaks.reduce((a,b)=>Math.hypot(a.x-mouth.x,a.y-mouth.y)<Math.hypot(b.x-mouth.x,b.y-mouth.y)?a:b);Object.assign(l,{...mouth,r:Math.max(l.r,r),born:h.age});}
  }
  const q=point||removed[0];world.event('coverhit',{x:h.x+q.x,y:h.y+q.y,color:'#bd7c49'});
}
export function carveFurnace(world,h,carve,point,radius=30) {
  if(world.prediction)return;
  const removed=[],pieces=[];
  for(const p of h.furnacePieces||[]) {
    const remains=carve(p);
    if(remains.length!==1||remains[0]!==p)removed.push(p);
    pieces.push(...remains.map(q=>({x:q.x,y:q.y,w:q.w,h:q.h,part:p.part})));
  }
  recordCut(world,h,pieces,removed,point,radius);
}
export function damageFurnacePart(world,h,index,damage,impact) {
  if(world.prediction||!Number.isFinite(damage)||damage<=0)return;
  const b=furnacePartBox(h,index),point=impact||{x:b.x+b.w/2,y:b.y+b.h/2};
  blastFurnace(world,{...point,radius:Math.min(70,12+damage*.35)},0,h);
}
export function damageFurnaceWhere(world,touches) {
  if(world.prediction)return;
  for(const h of world.hazards.filter(h=>h.type==='furnace')){
    const breach={x:0,y:0};let found=false;
    carveFurnace(world,h,p=>{
    const box={...p,x:h.x+p.x,y:h.y+p.y};if(!touches(box))return [p];
    const keep=[];
    // Beam/swept-tool cuts keep the same bounded eight-unit edge resolution.
    for(let y=p.y;y<p.y+p.h;y+=8)for(let x=p.x;x<p.x+p.w;x+=8){
      const q={...p,x,y,w:Math.min(8,p.x+p.w-x),h:Math.min(8,p.y+p.h-y)};
      if(!touches({...q,x:x+h.x,y:y+h.y}))keep.push(q);
      else if(!found&&p.part<3){Object.assign(breach,{x:x+q.w/2,y:y+q.h/2});found=true;}
    }
    return keep;
  },breach);
  }
}
export function blastFurnace(world,blast,_damage,hazard) {
  if(!blast||world.prediction)return;
  for(const h of hazard?[hazard]:world.hazards.filter(h=>h.type==='furnace')) {
    const cut={x:blast.x-h.x,y:blast.y-h.y,radius:blast.radius};
    carveFurnace(world,h,p=>carveRectangle(p,cut),cut,blast.radius);
  }
}
// Subtract the missing metal from the original artwork. Remaining rectangles
// are disjoint, so overlapping successive craters never paint a hole back in.
export function clipFurnace(c,h) {
  if(!h?.furnacePieces)return;
  c.beginPath();c.rect(-4000,-4000,12000,12000);
  for(const b of FURNACE_PARTS)c.rect(h.x+b.x,h.y+b.y,b.w,b.h);
  for(const p of h.furnacePieces)c.rect(h.x+p.x,h.y+p.y,p.w,p.h);
  c.clip('evenodd');
}
export function furnaceFeed(state,index) {
  const h=state.hazards?.find(h=>h.type==='furnace');
  return furnacePartAlive(h,index+3)&&(state.cables||[]).some(c=>{
    const spec=cableLayout(c.id);
    return spec?.kind==='furnace'&&spec.index===index&&furnacePartAlive(h,6+Number(c.id.slice(7)))&&
      c.attached.every(Boolean)&&c.links.every(Boolean);
  });
}
export const furnaceFault = (world,h) => Math.min(1, Math.max(
  1-h.furnaceParts.reduce((a,b)=>a+b,0)/(FURNACE_PARTS.length*100),
  (world.cables||[]).filter(c=>c.id.startsWith('furnace')).reduce((sum,c)=>sum+c.links.filter(v=>!v).length+c.attached.filter(v=>!v).length*4,0)/60));
export function validFurnace(h) {
  if(h.type!=='furnace')return true;
  return Array.isArray(h.furnacePieces)&&h.furnacePieces.length<=2048&&h.furnacePieces.every(p=>Number.isInteger(p.part)&&p.part>=0&&p.part<12&&[p.x,p.y,p.w,p.h].every(Number.isFinite)&&p.w>0&&p.h>0&&p.x>=FURNACE_PARTS[p.part].x-.01&&p.y>=FURNACE_PARTS[p.part].y-.01&&p.x+p.w<=FURNACE_PARTS[p.part].x+FURNACE_PARTS[p.part].w+.01&&p.y+p.h<=FURNACE_PARTS[p.part].y+FURNACE_PARTS[p.part].h+.01)&&
    Number.isFinite(h.furnaceMelt)&&h.furnaceMelt>=0&&h.furnaceMelt<=1&&Array.isArray(h.furnaceLeaks)&&h.furnaceLeaks.length<=12&&h.furnaceLeaks.every(l=>[l.x,l.y,l.r,l.born].every(Number.isFinite)&&Math.abs(l.x)<=256&&l.y>=35&&l.y<=315&&l.r>=5&&l.r<=30&&l.born>=0&&l.born<=h.age+.01)&&
    Array.isArray(h.furnaceParts)&&h.furnaceParts.length===FURNACE_PARTS.length&&h.furnaceParts.every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&
    [h.furnaceFault,h.furnaceLeft,h.furnaceSpan,h.furnaceCooling].every(Number.isFinite)&&h.furnaceFault>=0&&h.furnaceFault<=1&&
    h.furnaceLeft>=0&&h.furnaceLeft<=9&&h.furnaceSpan>=0&&h.furnaceSpan<=9&&h.furnaceCooling>=0&&h.furnaceCooling<=2.5&&
    Number.isInteger(h.furnaceStage)&&h.furnaceStage>=0&&h.furnaceStage<=2&&Number.isInteger(h.furnaceCycle)&&h.furnaceCycle>=0&&h.furnaceCycle<=10000000&&
    Array.isArray(h.furnaceLanes)&&h.furnaceLanes.length===3&&h.furnaceLanes.every(v=>typeof v==='boolean')&&!h.done;
}
