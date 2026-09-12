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
for (const y of [150,590,1050]) {
  // Inward service landings reach the climbing gaps within each tower. They
  // stop before the removed centre ledges and never cross between pylons.
  platforms.push(deck(300,y,y>150?480:360),deck(y>150?1780:1900,y,y>150?480:360));
  if (y>150) platforms.push(deck(15,y,175),deck(2370,y,175));
}
for (const x of [170,660,1750,2240]) platforms.push(deck(x,1250,150));
// The only centre crossings are the actual intact wires. Cut spans lose all
// supporting collision while their loose physical tails remain live.

export const TRANSMISSION_ARENA = dressArena({
  name:"TRANSMISSION TOWERS",theme:"transmission",color:"#243047",transmission:true,
  platforms,spawns:[[210,1338],[2350,1338],[280,788],[2280,788]],
  cover:[],weapons:[],spikes:[],hazards:["powerline"],
  traps:TOWER_LEVELS.map((y,circuit)=>({type:"powerline",circuit,x:1280,y:y+140,
    w:WIRE_RIGHT-WIRE_LEFT,h:85,dir:circuit?1:-1})),
});

// One finite, physical water jug on each inner and outer cross-arm. Reserve
// these positions after automatic dressing so furniture cannot replace a jug.
for (const y of TOWER_LEVELS) for (const x of [170, 930, 1630, 2390]) {
  const jug = {x:x-32,y:y-76,w:64,h:76,kind:"waterTank",hp:85,maxHp:85,waterLeft:210};
  TRANSMISSION_ARENA.cover = TRANSMISSION_ARENA.cover.filter(p =>
    p.x+p.w < jug.x-18 || p.x > jug.x+jug.w+18 || p.y+p.h < jug.y || p.y > y);
  TRANSMISSION_ARENA.cover.push(jug);
}
