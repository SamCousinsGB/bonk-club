// The original arenas had different lower floors but identical upper grids.
// Each now has its own central routes, with spacious common spawn balconies.
const layouts = [
  [[860,1180,810],[700,1000,390],[1450,940,410],[1060,770,420],[700,600,340],[1480,550,360],[1040,370,410],[1140,190,300]],
  [[80,940,720],[1760,940,720],[960,1090,640],[850,790,330],[1410,680,330],[120,650,620],[1820,610,620],[980,480,610],[1150,230,250]],
  [[720,1270,310],[1510,1270,310],[970,1080,610],[750,890,300],[1530,890,300],[1040,700,480],[600,530,340],[1620,530,340],[1100,250,360]],
  [[680,1070,320],[950,930,320],[1260,790,320],[1570,650,320],[1260,470,330],[950,630,270],[670,800,240],[1120,230,320]],
  [[660,1150,380],[1500,1150,400],[980,970,600],[670,790,400],[1490,790,400],[1060,600,440],[680,430,290],[1590,430,290],[1120,220,320]],
  [[680,1120,280],[1610,1100,280],[1080,890,400],[660,660,290],[1610,660,310],[1100,430,370],[1170,210,230]],
  [[80,960,760],[1710,960,770],[80,700,550],[1920,660,560],[660,820,310],[1590,810,310],[1060,1030,450],[1030,650,480],[700,450,320],[1510,440,310],[1120,230,300]],
  [[760,1300,1040],[640,1100,330],[1590,1100,330],[970,960,620],[760,750,380],[1430,750,380],[1040,550,480],[800,370,290],[1490,370,290],[1140,190,280]],
];
const themes = ["jungle", "ruins", "volcano", "temple", "arctic", "factory", "port", "jungle"];
const colors = ["#173f39", "#52422e", "#362633", "#213e37", "#284b68", "#263847", "#253d50", "#254d4b"];
const materials = ["grass", "sand", "basalt", "moss", "ice", "metal", "metal", "wood"];

export function remakeClassic(arena, index) {
  const material = materials[index];
  const slab = ([x,y,w], extra={}) => ({x,y,w,h:24,material,...(index===4?{ice:true}:{}),...extra});
  const platforms = [
    ...[[100,1180,560],[1900,1180,560],[120,360,530],[1910,360,530]].map(r=>slab(r)),
    ...layouts[index].map(r=>slab(r)),
  ];
  // These narrow outside landings are separated horizontally, leaving headroom.
  for(let i=0;i<5;i++) for(const right of [false,true])
    platforms.push(slab([right ? (i%2?2330:2420) : (i%2?80:10), 1260-i*210, 130]));
  if ([2,5,7].includes(index)) {
    platforms.push(slab([50,1380,600]), slab([1910,1380,600]));
  } else platforms.push(slab([60,1380,2440]));
  if (index===5) platforms.push(
    slab([970,1190,90],{elevator:true,travel:-660,speed:0.4}),
    slab([1490,530,100],{elevator:true,travel:660,speed:0.4}),
    slab([1200,700,170],{move:60,speed:0.6}),
  );
  const broad=platforms.filter(p=>p.w>=300&&p.y<1350);
  const props=["log","stone","barrel","stone","crate","barrel","crate","log"];
  return {...arena,theme:themes[index],color:colors[index],platforms,
    cover:broad.map((p,i)=>({x:p.x+p.w*(i%2?.65:.4)-36,y:p.y-48,w:72,h:48,hp:75,maxHp:75,kind:props[index]})),
    spawns:[[230,1138],[2320,1138],[230,318],[2320,318]],
    weapons:broad.slice(0,8).map(p=>[p.x+p.w*.72,p.y-70,"blaster"]),
    hazards:index===4?["gust","steam"]:index===2?["lava","rockfall"]:index===5?["electric","cargo"]:["gust","rockfall"],
    spikes:[2,5,7].includes(index)?[{x:660,y:1420,w:1240}]:[],
  };
}

export const CLASSIC_ARENAS = ["PLATFORMS","SPLIT FLOOR","SPIKES","TIERS","ICE","MOVING PLATFORMS","SIDE BALCONIES","ISLAND"]
  .map((name,index)=>remakeClassic({name},index));
