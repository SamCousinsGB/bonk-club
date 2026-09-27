const steel = (x,y,w,h=36,bridgePart="pier") => ({x,y,w,h,material:"metal",bridgePart});
const walk = (x,y,w) => ({...steel(x,y,w,18,"walk"),oneWay:true});
export const BRIDGE_DECK_Y = 850;
export const BRIDGE_PANELS = 16;
export const BRIDGE_BAYS = [
  {x:720,y:1110,w:380,mounts:[1,5]},
  {x:1460,y:1110,w:380,mounts:[10,14]},
  {x:1150,y:1220,w:260,mounts:[6,9]},
];
// The visual suspension rods and the motion solver use the same surviving
// attachment points. Cutting the steel at a hanger removes that attachment.
export function bridgeBayMounts(platforms,bay){
  const spec=BRIDGE_BAYS[bay];
  return spec.mounts.map((id,i)=>{
    const offset=spec.x+(i?spec.w-16:16)-(560+id*90);
    const p=platforms.find(q=>q.bridgePanel===id&&q.hp!==0&&
      offset>=(q.bridgeOffsetX||0)&&offset<=(q.bridgeOffsetX||0)+q.w);
    return p?{panel:p,x:p.x-(p.bridgeOffsetX||0)+offset,y:p.y+p.h}:null;
  });
}
export const BRIDGE_ARENA = {
  name:"SUSPENSION BRIDGE",theme:"suspension-bridge",color:"#263d4c",bridge:true,
  platforms:[
    {...steel(0,BRIDGE_DECK_Y,560,52,"road"),oneWay:true},{...steel(2000,BRIDGE_DECK_Y,560,52,"road"),oneWay:true},
    ...Array.from({length:BRIDGE_PANELS},(_,i)=>({
      ...steel(560+i*90,BRIDGE_DECK_Y,90,52,"road"),bridgePanel:i,oneWay:true,
    })),
    ...[320,1920].flatMap(x=>[
      // The front cutaway leaves full-height doorways at each service floor.
      // Continuous rear tower legs are scenery; these surviving faces collide.
      ...[x,x+286].flatMap(u=>[
        steel(u,240,34,100),steel(u,470,34,70),
        steel(u,1080,34,60),steel(u,1290,34,150),
      ]),
      steel(x-16,240,352,32,"cap"),
      walk(x-45,450,410),walk(x-55,650,430),
      walk(x-40,1040,400),walk(x-40,1250,400),
    ]),
    walk(55,540,225),walk(2280,540,225),
    walk(60,720,220),walk(2280,720,220),
    ...BRIDGE_BAYS.map((b,bridgeBay)=>({...walk(b.x,b.y,b.w),bridgeBay})),
  ],
  spawns:[[160,678],[2400,678],[450,608],[2110,608]],
  weapons:[[850,818],[1710,818],[1250,818]],starterWeapons:[],spikes:[],
  cover:[
    {kind:'crate',x:536,y:386,w:56,h:64,hp:65,maxHp:65},
    {kind:'crate',x:1968,y:386,w:56,h:64,hp:65,maxHp:65},
    {kind:'generator',x:892,y:1044,w:88,h:66,hp:85,maxHp:85},
  ],hazards:[],traps:[],
};
