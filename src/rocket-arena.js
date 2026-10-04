const deck = (x,y,w,h=28) => ({x,y,w,h,material:'metal',rocketDeck:true});
const grate = (x,y,w) => ({...deck(x,y,w,14),oneWay:true});

// Three connected crossings: the protected crown, exposed middle grating and
// wide flame trench. Alternating stairs leave clear double-jump takeoffs.
export const ROCKET_ARENA = {
  name:'ROCKET TEST STAND',theme:'rocket',color:'#142b38',rocket:true,setpiece:true,
  platforms:[
    deck(0,1320,2560,68),
    deck(40,1110,600),deck(1920,1110,600),
    grate(570,1130,450),grate(1540,1130,450),
    grate(800,1040,960),
    deck(90,880,400),deck(2070,880,400),
    grate(500,860,420),grate(1640,860,420),
    grate(890,800,780),
    grate(160,650,360),grate(2040,650,360),
    grate(600,650,410),grate(1550,650,410),
    deck(930,440,700,32),
    grate(520,440,270),grate(1770,440,270),
  ],
  spawns:[[190,1068],[2370,1068],[260,608],[2300,608]],
  weapons:[[750,825],[1810,825],[1100,405],[1460,405]],
  starterWeapons:[],spikes:[],
  cover:[
    {kind:'crate',x:355,y:1046,w:72,h:64,hp:75,maxHp:75},
    {kind:'crate',x:2133,y:1046,w:72,h:64,hp:75,maxHp:75},
    {kind:'trolley',x:1110,y:1262,w:82,h:58,hp:85,maxHp:85},
    {kind:'pallet',x:1410,y:1286,w:104,h:34,hp:55,maxHp:55},
  ],
  hazards:['rocket'],
  // The engine is mounted behind the playable plane. Its exhaust, rather than
  // the background hardware, contacts the destructible foreground structures.
  traps:[{type:'rocket',x:1280,y:660,w:360,h:280,dir:1}],
};
