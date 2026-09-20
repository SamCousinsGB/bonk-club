import { shipHull, SHIP } from './ship.js';
const deck=(x,y,w,extra={})=>({x,y,w,h:20,material:'metal',shipDeck:true,...extra});
export const SHIP_ARENA={
  name:'OCEAN LINER',theme:'ocean-liner',color:'#142936',ship:true,
  platforms:[...shipHull(),
    ...SHIP.edges.slice(1,-1).map(x=>({x:x-12,y:805,w:24,h:325,material:'metal',shipBulkhead:true,boundary:true,destructible:true,panel:'metal',hp:200,maxHp:200})),
    deck(242,680,352),deck(704,680,320),deck(1134,680,312),deck(1556,680,312),deck(1976,680,340),
    deck(460,900,150,{oneWay:true}),deck(720,900,180,{oneWay:true}),deck(1160,900,190,{oneWay:true}),deck(1580,900,190,{oneWay:true}),deck(1965,900,145,{oneWay:true}),
    deck(400,505,190,{oneWay:true}),deck(1960,505,210,{oneWay:true}),
    deck(700,445,420),deck(1430,445,420),deck(1190,250,200,{oneWay:true}),
  ],
  spawns:[[435,648],[2160,648],[820,413],[1740,413]],
  weapons:[[880,1060],[1680,1060],[1275,218],[1270,648]],starterWeapons:[],spikes:[],hazards:[],traps:[],
  cover:[
    {x:450,y:1054,w:110,h:76,kind:'crate',hp:85,maxHp:85},
    {x:815,y:1058,w:128,h:72,kind:'pallet',hp:75,maxHp:75},
    {x:1540,y:1046,w:104,h:84,kind:'crate',hp:90,maxHp:90},
    {x:2025,y:1058,w:85,h:72,kind:'oilBarrel',hp:65,maxHp:65},
    {x:1530,y:387,w:82,h:58,kind:'trolley',hp:75,maxHp:75},
  ],
};
