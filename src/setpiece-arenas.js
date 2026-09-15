const solid = (x,y,w,h=40) => ({x,y,w,h,material:"stone"});
const grate = (x,y,w) => ({x,y,w,h:12,material:"metal",oneWay:true});

export const TRAIN_Y = 1060;
export const TRAIN_LENGTH = 980;
export const TRAIN_HEIGHT = 150;
export const TRAIN_SPEED = 2000;
export const TRAIN_CYCLE = 11;
export const TRAIN_START = 5;
export const TRAIN_ARENA = {
  name:"BULLET TRAIN", theme:"railway", color:"#263c50", setpiece:true,
  platforms:[
    ...Array.from({length:16},(_,i)=>solid(i*160,TRAIN_Y,160,44)),
    solid(30,1300,610),solid(960,1300,640),solid(1920,1300,610),
    grate(70,820,270),grate(2220,820,270),
    grate(460,780,280),grate(900,780,260),grate(1400,780,260),grate(1820,780,280),
    grate(170,550,260),grate(650,530,280),grate(1110,510,340),grate(1630,530,280),grate(2130,550,260),
    solid(0,TRAIN_Y,50,90),solid(2510,TRAIN_Y,50,90),
  ],
  spawns:[[180,778],[2380,778],[300,508],[2260,508]],
  weapons:[[1030,750],[1530,750]],starterWeapons:[],spikes:[],
  cover:[{x:510,y:712,w:65,h:68,kind:"crate",hp:85,maxHp:85},
    {x:1980,y:712,w:65,h:68,kind:"crate",hp:85,maxHp:85}],
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
    grate(450,860,260),grate(880,830,240),grate(1440,830,240),grate(1850,860,260),
    grate(100,610,260),grate(530,570,280),grate(970,550,260),grate(1330,550,260),grate(1750,570,280),grate(2200,610,260),
    solid(1120,800,320,44),
  ],
  spawns:[[160,858],[2400,858],[230,568],[2330,568]],
  weapons:[[1000,800],[1560,800]],starterWeapons:[],spikes:[],
  cover:[{x:400,y:1072,w:64,h:68,kind:"crate",hp:80,maxHp:80},
    {x:2070,y:1072,w:64,h:68,kind:"barrel",hp:75,maxHp:75},
    {x:1160,y:1072,w:64,h:68,kind:"crate",hp:80,maxHp:80}],
  hazards:["conveyor","slag","crusher","ladle"],
  traps:[
    {type:"conveyor",x:400,y:1140,w:400,h:22,dir:1,beltSpeed:330,beltForce:1300},
    {type:"conveyor",x:2160,y:1140,w:400,h:22,dir:-1,beltSpeed:330,beltForce:1300},
    {type:"slag",x:790,y:1380,w:380,h:160,dir:1},
    {type:"slag",x:1770,y:1380,w:380,h:160,dir:-1},
    {type:"crusher",x:1280,y:1140,w:280,h:290,dir:1},
    {type:"ladle",x:790,y:1380,w:150,h:760,dir:1},
    {type:"ladle",x:1770,y:1380,w:150,h:760,dir:-1},
  ],
};
