import { dressArena } from "./arena-dressing.js";
import { TOWER_LEVELS, TOWER_MOUNTS, TOWER_BASE } from "./cable-layout.js";

export const POWER_INTERVAL = 7;
export const WIRE_LEFT = TOWER_MOUNTS[0][0].x, WIRE_RIGHT = TOWER_MOUNTS[0][1].x;
const deck = (x,y,w,h=20,extra={}) => ({x,y,w,h,material:"metal",...extra});
const platforms = [deck(30,TOWER_BASE,960,36),deck(1570,TOWER_BASE,960,36)];
// Access gaps beside the tower bodies leave room to climb and drop between
// levels without trapping fighters beneath the broad cross-arms.
for (const y of TOWER_LEVELS) platforms.push(deck(50,y,670,24),deck(820,y,170,24),
  deck(1570,y,170,24),deck(1840,y,670,24));
for (const y of [150,590,1070]) {
  platforms.push(deck(300,y,360),deck(1900,y,360));
  if (y>150) platforms.push(deck(15,y,175),deck(790,y,290),deck(1480,y,290),deck(2370,y,175));
}
for (const x of [170,660,1750,2190]) platforms.push(deck(x,1250,150));
// The only centre crossings are the actual intact wires. Cut spans lose all
// supporting collision while their loose physical tails remain live.

export const TRANSMISSION_ARENA = dressArena({
  name:"TRANSMISSION TOWERS",theme:"transmission",color:"#243047",transmission:true,
  platforms,spawns:[[210,1338],[2350,1338],[280,788],[2280,788]],
  cover:[],weapons:[],spikes:[],hazards:["powerline"],
  traps:TOWER_LEVELS.map((y,circuit)=>({type:"powerline",circuit,x:1280,y:y+140,
    w:WIRE_RIGHT-WIRE_LEFT,h:85,dir:circuit?1:-1})),
});
