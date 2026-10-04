const deck=(x,y,w,h=20)=>({x,y,w,h,material:'metal',oneWay:true,refineryDeck:true});
export const REFINERY_TANKS=[
  {name:'CRUDE',kind:'oil',x:110,y:1120,w:410,h:200,capacity:2200,initial:2100,color:'#b99b68'},
  {name:'CRACKER',kind:'oil',x:1110,y:1080,w:340,h:240,capacity:700,initial:0,color:'#f18952'},
  {name:'PETROL',kind:'petrol',x:1720,y:1130,w:250,h:190,capacity:1100,initial:150,color:'#e6ba58'},
  {name:'GAS',kind:'gas',x:2080,y:570,w:280,h:190,capacity:900,initial:110,color:'#77cfce'},
  {name:'ACID',kind:'acid',x:2090,y:1120,w:340,h:200,capacity:1400,initial:180,color:'#b8d566'},
];
// Ordered centre-lines are also the hydraulic graph. Every elbow and straight
// has finite contents, real collision and its own persistent damage identity.
const paths=[
  [[510,1190],[640,1190],[640,1000],[870,1000],[870,930],[1090,930],[1090,1170],[1120,1170]],
  [[1270,1090],[1270,880],[1470,880],[1470,700],[1760,700],[1760,960],[1850,960],[1850,1140]],
  [[1330,1090],[1330,520],[1520,520],[1520,300],[1890,300],[1890,500],[2210,500],[2210,580]],
  [[1210,1090],[1210,800],[1040,800],[1040,590],[740,590],[740,390],[980,390],[980,180],[1630,180],[1630,820],[2280,820],[2280,1130]],
];
export const REFINERY_ROUTES=paths.map((points,i)=>({from:i?1:0,to:i?i+1:1,kind:['oil','petrol','gas','acid'][i],points,rate:i?18:30}));
export const REFINERY_PIPES=[];
REFINERY_ROUTES.forEach((route,r)=>{
  route.ids=[];
  for(let n=1;n<route.points.length;n++){
    const [ax,ay]=route.points[n-1],[bx,by]=route.points[n],length=Math.hypot(bx-ax,by-ay),parts=Math.ceil(length/230);
    for(let k=0;k<parts;k++){
      const x=ax+(bx-ax)*k/parts,y=ay+(by-ay)*k/parts,ex=ax+(bx-ax)*(k+1)/parts,ey=ay+(by-ay)*(k+1)/parts,id=REFINERY_PIPES.length;
      route.ids.push(id);REFINERY_PIPES.push({id,route:r,x,y,ex,ey,capacity:Math.max(6,length/parts*.085)});
    }
  }
});
const pipePanels=REFINERY_PIPES.map(p=>({x:Math.min(p.x,p.ex)-12,y:Math.min(p.y,p.ey)-12,w:Math.abs(p.ex-p.x)+24,h:Math.abs(p.ey-p.y)+24,
  material:'metal',oneWay:true,destructible:true,panel:'metal',hp:95,maxHp:95,refineryPipe:p.id}));
const tankPanels=REFINERY_TANKS.flatMap((t,i)=>[
  [t.x,t.y,t.w,16],[t.x,t.y+16,16,t.h-16],[t.x+t.w-16,t.y+16,16,t.h-16],[t.x,t.y+t.h-16,t.w,16],
].map(([x,y,w,h])=>({x,y,w,h,material:'metal',destructible:true,panel:'metal',hp:200,maxHp:200,refineryTank:i})));
export const REFINERY_ARENA={
  name:'REFINERY',theme:'refinery',color:'#19383d',refinery:true,
  platforms:[
    {x:0,y:1320,w:2560,h:64,material:'stone',refineryDeck:true},
    deck(20,1050,560),deck(1980,1050,560),deck(660,1080,370),deck(1500,1080,340),
    deck(70,810,460),deck(1980,810,490),deck(560,790,410),deck(1550,790,370),deck(1030,1000,500),
    deck(60,560,390),deck(2010,540,490),deck(500,520,380),deck(990,550,420),deck(1590,530,350),
    deck(140,310,380),deck(2080,310,360),deck(640,280,390),deck(1520,280,390),deck(1110,100,400),
    ...pipePanels,...tankPanels,
  ],
  spawns:[[180,1018],[2390,1018],[200,528],[2410,508]],
  weapons:[[750,758],[1740,758],[1180,518],[800,248],[1710,248]],
  starterWeapons:[],spikes:[],hazards:[],traps:[],
  cover:[
    {kind:'trolley',x:300,y:984,w:94,h:66,hp:70,maxHp:70},
    {kind:'trolley',x:2100,y:984,w:94,h:66,hp:70,maxHp:70},
    {kind:'crate',x:580,y:455,w:65,h:65,hp:75,maxHp:75},
    {kind:'waterTank',x:1820,y:454,w:80,h:76,hp:100,maxHp:100},
    {kind:'waterTank',x:350,y:734,w:80,h:76,hp:100,maxHp:100},
  ],
};
