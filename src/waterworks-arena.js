const concrete = (x,y,w,h=32,extra={}) => ({x,y,w,h,material:'stone',...extra});
const grate = (x,y,w) => ({x,y,w,h:16,material:'metal',oneWay:true});

export const WATERWORKS_POOL = {x:672,y:1140,w:1216,h:200,bottom:1340};
export const WATERWORKS_PIPES = [
  {x:400,y:590,rate:100}, {x:800,y:760,rate:125},
  {x:1168,y:510,rate:150}, {x:1392,y:510,rate:150},
  {x:1760,y:760,rate:125}, {x:2160,y:590,rate:100},
];
export const WATERWORKS_ARENA = {
  name:'WATERWORKS',theme:'waterworks',color:'#163b45',waterworks:true,
  platforms:[
    concrete(32,1050,608,42), concrete(1920,1050,608,42),
    concrete(640,1010,32,370),concrete(1888,1010,32,370),
    ...Array.from({length:8},(_,i)=>concrete(640+i*160,1340,160,40)),
    // Open pool access and two staggered routes above the flood line.
    grate(64,830,288),grate(2208,830,288),
    grate(460,710,260),grate(1840,710,260),
    grate(820,540,260),grate(1480,540,260),
    grate(1100,330,360),
    grate(100,520,240),grate(2220,520,240),
    grate(430,320,300),grate(1830,320,300),
    grate(820,180,260),grate(1480,180,260),
    // Low stepping ledges let swimmers climb out before the basin overflows.
    grate(704,1190,150),grate(1706,1190,150),
    grate(810,1000,170),grate(1580,1000,170),
    ...WATERWORKS_PIPES.map((p,i)=>({x:p.x-40,y:p.y-146,w:80,h:146,
      material:'metal',destructible:true,panel:'metal',hp:160,maxHp:160,waterworksPipe:i})),
  ],
  spawns:[[160,798],[2400,798],[550,288],[2010,288]],
  weapons:[[580,678],[1980,678],[1280,298],[900,968],[1660,968]],
  starterWeapons:[],spikes:[],hazards:[],traps:[],
  cover:[
    ...[[180,1050],[2310,1050],[550,710],[1930,710],[940,540],[1540,540],
      [1040,1340],[1430,1340]].map(([x,y])=>({kind:'generator',x,y:y-76,w:100,h:76,hp:115,maxHp:115})),
    {kind:'trolley',x:350,y:984,w:94,h:66,hp:70,maxHp:70},
    {kind:'trolley',x:2070,y:984,w:94,h:66,hp:70,maxHp:70},
  ],
};
