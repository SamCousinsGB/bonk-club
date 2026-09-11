const floor = (x,y,w,material) => ({x,y,w,h:28,material});
const lift = (x,y,travel) => ({...floor(x,y,120,"metal"),h:18,elevator:true,travel,speed:.32});
// Broad rooms, offset outdoor terraces and a production floor, each with two
// independent ascent routes. Keep the centre contested and the four starts clear.
function arena(name,theme,color,material,rows,extras,buildings) {
  return {name,theme,color,platforms:[...rows.map(r=>floor(...r,material)),...extras],
    spawns:[[220,1278],[2340,1278],[220,858],[2340,858]],
    cover:[],weapons:[],spikes:[],...(buildings?{buildings}:{}),hazards:[]};
}
const edges = material => [1110,690,270].flatMap(y=>[floor(20,y,120,material),floor(2420,y,120,material)]);
export const NEW_ARENAS = [
  arena("RADIOLOGY", "hospital", "#29434c", "tile", [
    [60,1320,2440],[100,900,540],[1920,900,540],
    [100,480,540],[1920,480,540],[960,1110,640],
    [1010,690,540],[1080,270,400],
    [760,1110,65],[1735,1110,65],[760,690,65],[1735,690,65],
  ],[...edges("tile"),lift(835,1300,-1030),lift(1605,270,1030)],
  [[100,370,710,950],[1750,370,710,950],[950,160,660,1160]]),
  arena("PRODUCTION HALL", "factory", "#353d42", "metal", [
    [60,1320,2440],[100,900,540],[1920,900,540],
    [100,480,540],[1920,480,540],[780,1110,1000],
    [830,690,350],[1380,690,350],[1050,270,460],
    [540,1110,160],[1860,1110,160],[570,690,160],[1830,690,160],
    [1200,480,160],
  ],[...edges("metal"),lift(660,1300,-1030),lift(1780,270,1030)]),
  arena("GEOTHERMAL TERRACES", "volcano", "#492f37", "basalt", [
    [60,1320,700],[1800,1320,700],[100,900,600],[1860,900,600],
    [100,480,520],[1940,480,520],[860,1170,340],[1360,1170,340],
    [760,750,360],[1440,750,360],[1030,540,500],[1080,330,400],
    [630,1110,160],[1770,1110,160],[580,690,160],[1820,690,160],
    [790,1010,140],[1630,1010,140],
  ],[...edges("basalt"),lift(1220,1320,-400)]),
];
// Two belts feed a saw and press on the same production floor. The outside
// lifts and upper catwalks bypass the line; its platforms remain destructible.
NEW_ARENAS[1].fixtures = [
  {type:"conveyor",x:995,y:1110,w:310,h:20,dir:1},
  {type:"saw",x:1250,y:1110,w:170,h:180,dir:1},
  {type:"crusher",x:1470,y:1110,w:120,h:220,dir:-1},
  {type:"conveyor",x:1660,y:1110,w:180,h:20,dir:-1},
  {type:"steam",x:1530,y:690,w:100,h:210,dir:-1},
];
