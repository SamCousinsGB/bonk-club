const solid = (x,y,w,h=40) => ({x,y,w,h,material:"stone"});
const grate = (x,y,w) => ({x,y,w,h:12,material:"metal",oneWay:true});

export const TRAIN_Y = 1380;
export const TRAIN_LENGTH = 3200;
export const TRAIN_HEIGHT = 150;
export const TRAIN_SPEED = 5120;
export const TRAIN_CYCLE = 11;
export const TRAIN_START = 5;
export const TRAIN_ARENA = {
  name:"BULLET TRAIN", theme:"railway", color:"#263c50", setpiece:true,
  platforms:[
    // Single segmented guide beam at the bottom; no fighting floor beneath it.
    ...Array.from({length:16},(_,i)=>solid(i*160,TRAIN_Y,160,60)),
    // Arrival concourses, a low central service island and exposed stepping decks.
    solid(0,1120,460,46),solid(2100,1120,460,46),
    grate(580,1160,230),grate(1750,1160,230),grate(1060,1100,440),
    grate(280,900,280),grate(2000,900,280),
    grate(750,930,260),grate(1550,930,260),
    solid(1110,710,340,36),
    grate(50,660,240),grate(2270,660,240),
    grate(490,660,310),grate(1760,660,310),
    grate(880,470,260),grate(1420,470,260),
    solid(270,400,300,32),solid(1990,400,300,32),
  ],
  spawns:[[160,1090],[2400,1090],[630,630],[1930,630]],
  weapons:[[870,900],[1690,900]],starterWeapons:[],spikes:[],
  cover:[{x:300,y:1052,w:65,h:68,kind:"crate",hp:85,maxHp:85},
    {x:2195,y:1052,w:65,h:68,kind:"crate",hp:85,maxHp:85},
    {x:1190,y:1032,w:64,h:68,kind:"cabinet",hp:95,maxHp:95}],
  hazards:["train"],traps:[{type:"train",x:1280,y:TRAIN_Y,w:TRAIN_LENGTH,h:TRAIN_HEIGHT,dir:1}],
};

// Scrap belts feed two open crucibles. The suspended press is a separate route
// risk; staggered catwalks allow fighters to move above all three machines.
export const FOUNDRY_ARENA = {
  name:"SCRAP FOUNDRY",theme:"foundry",color:"#352b2b",setpiece:true,
  platforms:[
    solid(0,1140,600),solid(980,1140,600),solid(1960,1140,600),
    solid(600,1380,380),solid(1580,1380,380),
    grate(50,900,250),grate(2260,900,250),
    // Fast lower crossings pass directly through the alternating pours.
    grate(560,1010,460),grate(1540,1010,460),
    grate(450,860,260),grate(880,830,240),grate(1440,830,240),grate(1850,860,260),
    grate(100,610,260),grate(530,570,380),grate(970,550,260),grate(1330,550,260),grate(1650,570,380),grate(2200,610,260),
    solid(1120,800,320,44),
    // Crucible walls share destruction and collision with the rest of the arena.
    solid(592,1220,16,160),solid(960,1220,16,160),
    solid(1584,1220,16,160),solid(1952,1220,16,160),
  ],
  spawns:[[160,858],[2400,858],[230,568],[2330,568]],
  weapons:[[1000,800],[1560,800]],starterWeapons:[],spikes:[],
  cover:[{x:400,y:1072,w:64,h:68,kind:"crate",hp:80,maxHp:80},
    {x:2070,y:1072,w:64,h:68,kind:"barrel",hp:75,maxHp:75},
    {x:1160,y:1072,w:64,h:68,kind:"crate",hp:80,maxHp:80}],
  hazards:["conveyor","slag","crusher","ladle","loader"],
  traps:[
    {type:"conveyor",x:400,y:1140,w:400,h:22,dir:1,beltSpeed:330,beltForce:1300},
    {type:"conveyor",x:2160,y:1140,w:400,h:22,dir:-1,beltSpeed:330,beltForce:1300},
    {type:"slag",x:790,y:1380,w:380,h:160,dir:1},
    {type:"slag",x:1770,y:1380,w:380,h:160,dir:-1},
    {type:"crusher",x:1280,y:1140,w:280,h:290,dir:1},
    {type:"ladle",x:790,y:1380,w:150,h:760,dir:1},
    {type:"ladle",x:1770,y:1380,w:150,h:760,dir:-1},
    {type:"loader",x:250,y:1140,w:130,h:190,dir:1},
    {type:"loader",x:2310,y:1140,w:130,h:190,dir:-1},
  ],
};
