// Fixed fixtures are part of each arena. Only their activation times vary.
const sets = {
  jungle: ["pendulum", "geyser", "pendulum"],
  temple: ["crusher", "pendulum", "geyser"],
  desert: ["geyser", "saw", "crusher"],
  ruins: ["pendulum", "crusher", "geyser"],
  houses: ["saw", "geyser", "conveyor"],
  mansion: ["pendulum", "geyser", "crusher"],
  hospital: ["tesla", "saw", "conveyor"],
  atrium: ["tesla", "crusher", "saw"],
  arctic: ["conveyor", "crusher", "tesla"],
  volcano: ["geyser", "geyser", "pendulum"],
  port: ["conveyor", "pendulum", "crusher"],
  factory: ["conveyor", "saw", "crusher", "geyser"],
};
// Landings outside broad overhangs give a double jump room to arc back inward.
const connectors = {
  1:[[824,1120,150],[1586,1120,150],[674,540,150],[1736,540,150]],
  3:[[674,540,150],[1736,540,150]],
  5:[[674,540,150],[1736,540,150]],
  6:[[700,1220,140],[1710,1220,160],[864,1120,150],[1536,1120,150]],
  15:[[664,1090,150],[1734,1090,150]],
  20:[[704,1080,150]],
};

export function equipArena(arena, index) {
  // Remove ledges tucked immediately above/below a larger floor. Those tiny
  // pockets trap heads and cannot serve as useful double-jump destinations.
  const platforms = arena.platforms.flatMap(p => {
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
  const kinds = sets[arena.theme] || (arena.city ? ["conveyor","tesla","crusher"] : ["pendulum","geyser","saw"]);
  const candidates = platforms.filter(p=>p.w>=270 && !p.move && !p.elevator && p.y>300)
    .sort((a,b)=>b.y-a.y || a.x-b.x);
  const used = new Set(), traps=[];
  for (const [i,type] of kinds.entries()) {
    for (let n=0;n<candidates.length;n++) {
      const p=candidates[(n+i*3+index)%candidates.length];
      if(used.has(p)) continue;
      const dir = (i+index)%2 ? -1 : 1;
      const width=type==="conveyor"?Math.min(310,p.w-30):type==="saw"?Math.min(270,p.w-40):type==="pendulum"?220:100;
      const x=type==="conveyor" ? (dir>0?p.x+p.w-width/2-4:p.x+width/2+4) : p.x+p.w*(i%2?.72:.28);
      const ceiling=Math.max(30,p.y-265,...platforms.filter(q=>q!==p&&q.y<p.y&&q.x<x+width/2&&q.x+q.w>x-width/2).map(q=>q.y+q.h+15));
      const h=type==="conveyor"?20:Math.min(240,p.y-ceiling);
      if(h<100&&type!=="conveyor")continue;
      if(arena.spawns.some(([sx,sy])=>Math.abs(sx-x)<width/2+85 && Math.abs(sy-(p.y-30))<90))continue;
      traps.push({type,x,y:p.y,w:width,h,dir});used.add(p);break;
    }
  }
  const cover=(arena.cover||[]).filter(c=>!traps.some(t=>Math.abs(c.y+c.h-t.y)<5&&c.x<t.x+t.w/2+12&&c.x+c.w>t.x-t.w/2-12));
  return {...arena,platforms,cover,traps,hazards:kinds};
}
