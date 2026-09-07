import test from "node:test";
import assert from "node:assert/strict";
import { activeSlots, defaultSlots, validSlots } from "../src/slots.js";
import { World, STEP } from "../src/engine.js";
import { validSnapshot } from "../src/network.js";

test("slot modes distinguish empty reservations, bots and closed slots", () => {
  assert.ok(validSlots(defaultSlots()));
  assert.ok(!validSlots(["closed", "mixed", "mixed", "mixed"]));
  const slots = ["player", "mixed", "ai", "player"];
  assert.deepEqual(activeSlots(slots, [{id:0}]), [{id:0,bot:false},{id:1,bot:true},{id:2,bot:true}]);
  assert.deepEqual(activeSlots(slots, [{id:0},{id:1},{id:3}]), [{id:0,bot:false},{id:1,bot:false},{id:2,bot:true},{id:3,bot:false}]);
  assert.equal(activeSlots(["player","closed","closed","closed"], [{id:0}]).length, 1);
});

test("reserved slots hot join without resetting the arena, then leave empty; mixed slots return to AI", () => {
  const w = new World({players:[0,2], bots:[2], shuffle:false});
  const slots = ["player", "player", "mixed", "closed"];
  const host = {id:0,name:"Host"}, guest = {id:1,name:"Friend"};
  w.phase = "fight";
  w.scores = [4,0,9,0];
  const platforms = w.platforms, original = w.players[0];
  w.syncSlots(slots,[host,guest]);
  assert.deepEqual(w.players.map(p => [p.id,p.bot]), [[0,false],[1,false],[2,true]]);
  assert.equal(w.players[0],original);
  assert.equal(w.platforms,platforms);
  assert.deepEqual(w.scores,[4,0,9,0]);
  assert.ok(w.players.find(p=>p.id===1).alive);
  const occupant = w.players[1].occupant;
  w.scores[1] = 6;
  w.syncSlots(slots,[host]);
  assert.deepEqual(w.players.map(p=>p.id),[0,2]);
  assert.equal(w.scores[1],0);
  w.syncSlots(slots,[host,guest]);
  assert.ok(w.players[1].occupant > occupant);
  w.syncSlots(slots,[host,guest,{id:2,name:"Third"}]);
  assert.equal(w.players[2].bot,false);
  assert.equal(w.scores[2],0);
  w.syncSlots(slots,[host,guest]);
  assert.equal(w.players[2].bot,true);
  assert.ok(validSnapshot(w.snapshot()));
});

test("closed fighters remain absent across rounds and a lone player cannot farm wins", () => {
  const w = new World({players:[0,1],shuffle:false});
  w.syncSlots(["player","player","closed","closed"],[{id:0}]);
  w.startRound();
  assert.deepEqual(w.players.map(p=>p.id),[0]);
  w.phase = "fight";
  for (let i=0;i<60;i++) w.step(STEP);
  assert.deepEqual(w.scores,[0,0,0,0]);
  assert.ok(validSnapshot(w.snapshot()));
});
