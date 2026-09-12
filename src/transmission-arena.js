import { dressArena } from "./arena-dressing.js";

export const POWER_INTERVAL = 7;
export const WIRE_LEFT = 770, WIRE_RIGHT = 1790;
const deck = (x,y,w,h=20,extra={}) => ({x,y,w,h,material:"metal",...extra});
const platforms = [deck(80,1280,760,30),deck(1720,1280,760,30)];
for (const y of [440,860]) platforms.push(deck(180,y,660),deck(1720,y,660));
for (const y of [230,650,1070]) {
  platforms.push(deck(300,y,300),deck(1960,y,300));
  if (y>230) platforms.push(deck(30,y,160),deck(700,y,200),deck(1660,y,200),deck(2370,y,160));
}
// Foreground maintenance walkways keep both routes usable. The live conductors
// hang below their cross-arm insulators in the background and are pass-through.
for (const y of [440, 860]) platforms.push(deck(840, y, 880, 12));

export const TRANSMISSION_ARENA = dressArena({
  name:"TRANSMISSION TOWERS",theme:"transmission",color:"#243047",transmission:true,
  platforms,spawns:[[230,1238],[2330,1238],[300,818],[2260,818]],
  cover:[],weapons:[],spikes:[],hazards:["powerline"],
  traps:[440,860].map((y,circuit)=>({type:"powerline",circuit,x:1280,y:y+28,
    w:WIRE_RIGHT-WIRE_LEFT,h:200,dir:circuit?1:-1})),
});
