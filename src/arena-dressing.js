// All dressing has real prop collision; wall details are drawn separately in
// the cached scenery. Exit lips and the first weapon run stay free of furniture.
export const PROP_SIZES = {
  table:[90,50],crate:[72,64],log:[110,42],stone:[92,64],sofa:[124,54],
  bed:[138,42],cabinet:[62,78],barrel:[54,68],trolley:[82,58],
  generator:[88,66],planter:[70,58],pallet:[104,34],
};
const palettes = {
  jungle:["log","planter","crate"],temple:["stone","planter","log"],
  desert:["stone","barrel","crate"],ruins:["stone","crate","planter"],
  houses:["sofa","planter","table"],mansion:["cabinet","sofa","planter"],
  hospital:["bed","trolley","cabinet"],atrium:["trolley","planter","bed"],
  arctic:["generator","crate","barrel"],volcano:["stone","generator","barrel"],
  factory:["pallet","generator","barrel"],port:["crate","pallet","barrel"],
  transmission:["generator","pallet","crate"],
};
export const fixtureBounds = t => {
  const half = t.type === "pendulum" ? Math.max(t.w/2, (t.h-35)*.76+36) : t.w/2;
  return {x:t.x-half,y:t.y-t.h,w:half*2,h:t.h};
};
export function nearFixture(x,y,traps,margin=30) {
  return traps.some(t=>{const b=fixtureBounds(t);return !t.done && x>b.x-margin&&x<b.x+b.w+margin&&y>b.y-35&&y<t.y+25;});
}
export function dressArena(arena) {
  const {platforms,spawns,traps}=arena;
  const starters=spawns.map(([x,y])=>[x+(x<1280?100:-100),y+12,"blaster"]);
  const props=palettes[arena.theme]||["table","cabinet","planter"],cover=[];
  const clear=(x,y,w,h)=>!platforms.some(p=>p.x<x+w+28&&p.x+p.w>x-28&&p.y<y+h-1&&p.y+p.h>y-180)&&
    !traps.some(t=>{const b=fixtureBounds(t);return b.x<x+w+28&&b.x+b.w>x-28&&b.y<y+h&&t.y>y;})&&
    !spawns.some(([sx,sy])=>Math.abs(sy+42-y-h)<15&&sx>x-175&&sx<x+w+175)&&
    !cover.some(c=>c.x<x+w+65&&c.x+c.w>x-65&&Math.abs(c.y+c.h-y-h)<5);
  for(const [i,p] of platforms.filter(p=>p.w>=300&&!p.move&&!p.elevator).entries()) {
    const kind=props[i%props.length],[w,h]=PROP_SIZES[kind];
    for(const f of (p.w>850?[.33,.67,.5]:[.5,.35,.65])) {
      const x=p.x+p.w*f-w/2,y=p.y-h;
      if(x<p.x+65||x+w>p.x+p.w-65||!clear(x,y,w,h))continue;
      const hp=kind==="stone"?110:kind==="pallet"?55:75;
      cover.push({x,y,w,h,hp,maxHp:hp,kind});
      if(p.w<=850||cover.filter(c=>c.y+c.h===p.y&&c.x>=p.x&&c.x<p.x+p.w).length>=2)break;
    }
  }
  // Premium pickups are in the interior, at least 300 units from every start.
  // Both sides have access; shuffle these locations each round, never the starts.
  const candidates=platforms.filter(p=>!p.move&&!p.elevator&&p.w>=150).flatMap(p=>
    [.5,.25,.75].map(f=>[p.x+p.w*f,p.y-30,"blaster"]))
    .filter(([x,y])=>x>=650&&x<=1910&&!nearFixture(x,y,traps,65)&&
      !cover.some(c=>x>c.x-35&&x<c.x+c.w+35&&y>c.y-30&&y<c.y+c.h)&&
      !spawns.some(([sx,sy])=>Math.hypot(sx-x,sy-y)<300))
    .sort((a,b)=>Math.abs(a[0]-1280)-Math.abs(b[0]-1280)||b[1]-a[1]);
  const weapons=[];
  for(const d of candidates) {
    if(weapons.some(q=>Math.hypot(q[0]-d[0],q[1]-d[1])<270))continue;
    weapons.push(d);if(weapons.length===4)break;
  }
  return {...arena,cover,starterWeapons:starters,weapons};
}
