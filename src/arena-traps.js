import { dressArena, fixtureBounds } from "./arena-dressing.js";
// Fixed fixtures are part of each arena. Only their activation times vary.
const sets = {
  jungle: ["spores", "pendulum", "spores"],
  temple: ["crusher", "pendulum", "spores"],
  desert: ["steam", "pendulum", "crusher"],
  ruins: ["pendulum", "crusher", "steam"],
  houses: ["geyser", "tesla", "geyser"],
  mansion: ["tesla", "geyser", "tesla"],
  hospital: ["xray", "magnet", "xray"],
  atrium: ["magnet", "xray", "tesla"],
  arctic: ["frost", "conveyor", "frost"],
  volcano: ["geyser", "steam", "geyser", "steam"],
  port: ["conveyor", "pendulum", "crusher"],
  factory: ["conveyor", "saw", "crusher", "steam"],
};
// Landings outside broad overhangs give a double jump room to arc back inward.
const connectors = {
  1:[[824,1120,150],[1586,1120,150],[674,540,150],[1736,540,150],[806,350,150],[1614,350,150]],
  2:[[960,390,120],[1480,390,120]],
  3:[[674,540,150],[1736,540,150],[950,350,140]],
  5:[[674,540,150],[1736,540,150],[926,320,150],[1494,320,150]],
  6:[[700,1220,140],[1710,1220,160],[864,1120,150],[1536,1120,150]],
  11:[[1020,810,120],[1420,490,120]],
  12:[[640,620,140],[1100,440,140],[1650,350,140]],
  14:[[650,800,130],[620,620,140],[640,390,140],[1770,470,140],[1750,320,140],[1090,350,140]],
  15:[[664,1090,150],[1734,1090,150],[1210,420,140],[840,390,140]],
  19:[[1280,840,120],[1280,640,120],[1570,430,140],[870,400,150]],
  20:[[704,1080,150],[680,600,140],[1290,350,140],[720,420,140]],
  21:[[640,590,130],[1190,470,140],[1770,550,140],[1700,360,150],[680,360,140],[1770,1300,150],[640,1300,200],[1130,1320,640]],
  22:[[820,850,140],[1610,690,140],[770,430,140],[1640,390,140]],
  23:[[850,810,70],[1640,810,50],[860,430,150],[1530,430,140]],
  24:[[960,380,100],[1500,380,100]],
  25:[[800,570,140],[1620,570,140],[970,440,140],[1450,440,140]],
  26:[[860,420,140],[1560,420,140]],
};

export function equipArena(arena, index) {
  // Remove ledges tucked immediately above/below a larger floor. Those tiny
  // pockets trap heads and cannot serve as useful double-jump destinations.
  const platforms = arena.platforms.flatMap(p => {
    if(index===23&&p.y===520)return [{...p,y:600}];
    if(index===23&&p.x===940&&p.y===740)return [{...p,x:1030,w:500}];
    if(!p.move&&!p.elevator&&arena.platforms.some(q=>q!==p&&!q.move&&!q.elevator&&q.y===p.y&&q.h>=p.h&&q.w>p.w&&q.x<=p.x&&q.x+q.w>=p.x+p.w))return [];
    if(index===19&&p.x===1380&&p.y===410)return [];
    if(index===12&&p.x===560&&p.y===1130)return [{...p,x:714,y:1090}];
    if(index===20&&p.y===1100&&p.w===150)return [];
    if(p.w>180||p.elevator||p.move)return [p];
    const adjacent=arena.platforms.filter(q=>q!==p&&q.w>=250&&!q.elevator&&Math.abs(q.y-p.y)<145);
    const clear=x=>x>=10&&x+p.w<=2550&&!adjacent.some(q=>q.x<x+p.w+18&&q.x+q.w>x-18);
    if(clear(p.x))return [p];
    const alternatives=adjacent.flatMap(q=>[q.x-p.w-24,q.x+q.w+24])
      .filter(x=>Math.abs(x-p.x)<300&&clear(x)).sort((a,b)=>Math.abs(a-p.x)-Math.abs(b-p.x));
    return alternatives.length?[{...p,x:alternatives[0]}]:[];
  });
  platforms.push(...(connectors[index]||[]).map(([x,y,w])=>({x,y,w,h:20,material:arena.platforms[0].material,...(arena.theme==="arctic"?{ice:true}:{})})));
  // Lift shafts stay physically open through every intermediate landing.
  // Trim intersecting slab ends; never let a new connector stop a passenger.
  const lifts=platforms.filter(p=>p.elevator);
  for(let n=platforms.length-1;n>=0;n--){
    const p=platforms[n];if(p.elevator||p.move)continue;
    let pieces=[p];
    for(const l of lifts){
      if(p.y<Math.min(l.y,l.y+l.travel)-60||p.y>Math.max(l.y,l.y+l.travel)+l.h)continue;
      const left=l.x-8,right=l.x+l.w+8;
      pieces=pieces.flatMap(q=>q.x>=right||q.x+q.w<=left?[q]:[
        {...q,w:left-q.x},{...q,x:right,w:q.x+q.w-right}].filter(q=>q.w>=50));
    }
    platforms.splice(n,1,...pieces);
  }
  const kinds = sets[arena.theme] || (arena.city ? ["conveyor","tesla","crusher"] : ["pendulum","geyser","saw"]);
  const candidates = platforms.filter(p=>p.w>=270 && !p.move && !p.elevator && p.y>300)
    .sort((a,b)=>b.y-a.y || a.x-b.x);
  const used = new Set(), traps=[];
  for (const [i,type] of kinds.entries()) {
    for (let n=0;n<candidates.length;n++) {
      const p=candidates[(n+i*3+index)%candidates.length];
      if(used.has(p)) continue;
      const dir = (i+index)%2 ? -1 : 1;
      const width=type==="conveyor"?Math.min(310,p.w-100):type==="saw"?Math.min(270,p.w-90):type==="pendulum"?220:type==="magnet"?260:type==="xray"?160:type==="frost"?140:100;
      // Entire sweep stays on its mounting floor; leave a takeoff at both ends.
      const margin=type==="pendulum"?200:width/2+45;
      if(p.w<margin*2)continue;
      const x=Math.max(p.x+margin,Math.min(p.x+p.w-margin,p.x+p.w*(i%2?.62:.38)));
      const ceiling=Math.max(30,p.y-265,...platforms.filter(q=>q!==p&&q.y<p.y&&q.x<x+width/2&&q.x+q.w>x-width/2).map(q=>q.y+q.h+15));
      const maxHeight=type==="magnet"?150:type==="xray"?190:type==="frost"?150:type==="spores"?150:240;
      const h=type==="conveyor"?20:Math.min(maxHeight,p.y-ceiling);
      if(h<100&&type!=="conveyor")continue;
      const bounds=fixtureBounds({type,x,y:p.y,w:width,h});
      if(arena.spawns.some(([sx,sy])=>sx>bounds.x-210&&sx<bounds.x+bounds.w+210&&sy>bounds.y-65&&sy<p.y+30))continue;
      traps.push({type,x,y:p.y,w:width,h,dir});used.add(p);break;
    }
  }
  const cover=(arena.cover||[]).filter(c=>!traps.some(t=>Math.abs(c.y+c.h-t.y)<5&&c.x<t.x+t.w/2+12&&c.x+c.w>t.x-t.w/2-12));
  const fixtures=arena.fixtures||traps;
  return dressArena({...arena,platforms,cover,traps:fixtures,hazards:[...new Set(fixtures.map(t=>t.type))]});
}
