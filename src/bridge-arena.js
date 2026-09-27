const steel = (x,y,w,h=36) => ({x,y,w,h,material:"metal"});
const walk = (x,y,w) => ({x,y,w,h:16,material:"metal",oneWay:true});
export const BRIDGE_DECK_Y = 850;
export const BRIDGE_PANELS = 16;
export const BRIDGE_ARENA = {
  name:"SUSPENSION BRIDGE",theme:"suspension-bridge",color:"#263d4c",bridge:true,
  platforms:[
    {...steel(0,BRIDGE_DECK_Y,560),oneWay:true},{...steel(2000,BRIDGE_DECK_Y,560),oneWay:true},
    ...Array.from({length:BRIDGE_PANELS},(_,i)=>({
      ...steel(560+i*90,BRIDGE_DECK_Y,90,30),bridgePanel:i,oneWay:true,
    })),
    ...[405,2015].flatMap(x=>[
      steel(x,240,24,460),steel(x+116,240,24,460),
      steel(x,950,24,450),steel(x+116,950,24,450),
      walk(x-95,510,330),walk(x-60,1110,260),
    ]),
    walk(75,590,280),walk(2205,590,280),
    walk(120,710,230),walk(2210,710,230),
    walk(650,1140,370),walk(1540,1140,370),
    walk(1050,1270,460),
  ],
  spawns:[[190,808],[2370,808],[270,548],[2290,548]],
  weapons:[[850,818],[1710,818],[1250,818]],starterWeapons:[],spikes:[],
  cover:[],hazards:["steam"],traps:[
    {type:"steam",x:800,y:1140,w:160,h:180,dir:1},
    {type:"steam",x:1760,y:1140,w:160,h:180,dir:-1},
  ],
};
