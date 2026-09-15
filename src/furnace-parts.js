import { CABLE_LAYOUTS, cableLayout } from './cable-layout.js';

// Three shell sections, three electrodes, six independent terminal/riser sets.
// These are machinery hit surfaces, not new walking platforms.
export const FURNACE_PARTS = [
  ...[-1, 0, 1].map(n => ({x: n * 170 - 85, y: 35, w: 170, h: 280, kind: 'shell'})),
  ...[-145, 0, 145].map(x => ({x: x - 17, y: -234, w: 34, h: 202, kind: 'electrode'})),
  ...CABLE_LAYOUTS.filter(c => c.kind === 'furnace').map(c => ({x:c.b.x-1280-19,y:c.b.y-1000-20,w:38,h:825-c.b.y,kind:'terminal'})),
];
export const furnacePartBox = (h, i) => ({...FURNACE_PARTS[i],x:h.x+FURNACE_PARTS[i].x,y:h.y+FURNACE_PARTS[i].y});
export const furnacePartAlive = (h, i) => (h?.furnaceParts?.[i] ?? 100) > 0;
export const furnaceHits = world => world.hazards.filter(h=>h.type==='furnace').flatMap(h=>
  FURNACE_PARTS.flatMap((_,i)=>furnacePartAlive(h,i)?[{...furnacePartBox(h,i),furnaceHazard:h,furnaceIndex:i}]:[]));
export function damageFurnacePart(world,h,index,damage) {
  if(world.prediction || !Number.isFinite(damage) || damage<=0 || !h.furnaceParts) return;
  const old=h.furnaceParts[index];h.furnaceParts[index]=Math.max(0,old-damage);
  if(old===h.furnaceParts[index])return;
  const b=furnacePartBox(h,index);
  world.event('coverhit',{x:b.x+b.w/2,y:b.y+b.h/2,color:'#7c858a'});
}
export function damageFurnaceWhere(world,touches,damage=100) {
  if(world.prediction)return;
  for(const h of world.hazards.filter(h=>h.type==='furnace'))for(let i=0;i<FURNACE_PARTS.length;i++)
    if(furnacePartAlive(h,i)&&touches(furnacePartBox(h,i)))damageFurnacePart(world,h,i,damage);
}
export function blastFurnace(world,blast,damage=65) {
  if(!blast)return;
  damageFurnaceWhere(world,b=>Math.hypot(Math.max(b.x,Math.min(blast.x,b.x+b.w))-blast.x,
    Math.max(b.y,Math.min(blast.y,b.y+b.h))-blast.y)<blast.radius,damage);
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
  return Array.isArray(h.furnaceParts)&&h.furnaceParts.length===FURNACE_PARTS.length&&h.furnaceParts.every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&
    [h.furnaceFault,h.furnaceLeft,h.furnaceSpan,h.furnaceCooling].every(Number.isFinite)&&h.furnaceFault>=0&&h.furnaceFault<=1&&
    h.furnaceLeft>=0&&h.furnaceLeft<=9&&h.furnaceSpan>=0&&h.furnaceSpan<=9&&h.furnaceCooling>=0&&h.furnaceCooling<=2.5&&
    Number.isInteger(h.furnaceStage)&&h.furnaceStage>=0&&h.furnaceStage<=2&&Number.isInteger(h.furnaceCycle)&&h.furnaceCycle>=0&&h.furnaceCycle<=10000000&&
    Array.isArray(h.furnaceLanes)&&h.furnaceLanes.length===3&&h.furnaceLanes.every(v=>typeof v==='boolean')&&!h.done;
}
