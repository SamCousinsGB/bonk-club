import test from "node:test";
import assert from "node:assert/strict";
import { BotChat, BOT_CHAT_GROUPS, BOT_CHAT_LINES } from "../src/bot-chat.js";
import { killCredit, trackKillSource } from "../src/kill-credit.js";
import { World, STEP } from "../src/engine.js";
import { blackholeField } from "../src/blackhole.js";
import { nuclearField } from "../src/nuclear.js";
import { updateFields } from "../src/specials.js";
import { makeRig } from "../src/puppet.js";
import { combatFloor } from "./helpers.js";
import { validSnapshot, encodeState, decodeState } from "../src/network.js";

const memory = () => ({ value: "[]", getItem() { return this.value; }, setItem(key, value) { this.value = value; } });
function fixture(random = () => 0, storage = memory()) {
  const world = new World({ players: [0, 1, 2], bots: [1], shuffle: false, random: () => .4 });
  combatFloor(world); world.phase = "fight";
  const [victim, bot] = world.players;
  let now = 1000;
  const chat = new BotChat({ random, storage, clock: () => now }); chat.attach(world);
  const said = [], publish = (id, text) => { said.push({ id, text }); return true; };
  return { world, victim, bot, chat, said, publish, advance: ms => { now += ms; chat.update(world, publish); } };
}
test("a spectacular kill schedules a brief, delayed reaction from its actual bot", () => {
  const f = fixture(); f.world.kill(f.victim, { cause: "phaser", source: f.bot });
  f.advance(699); assert.equal(f.said.length, 0); f.advance(1);
  assert.deepEqual(f.said, [{ id: 1, text: "lol" }]);
  assert.equal(f.chat.used.size, 1);
});
test("ordinary kills, player kills, suicides and random skips stay quiet", () => {
  for (const cause of ["bullet", "punch", "fall", "sudden", "impale", null]) {
    const f = fixture(); f.world.kill(f.victim, { cause, source: f.bot }); f.advance(1500);
    assert.equal(f.said.length, 0, String(cause));
  }
  for (const mode of ["human", "suicide", "chance", "environment"]) {
    const f = fixture(mode === "chance" ? () => .8 : () => 0);
    f.world.kill(mode === "suicide" ? f.bot : f.victim,
      { cause: "singularity", source: mode === "human" ? f.world.players[2] : mode === "environment" ? null : f.bot });
    f.advance(1500); assert.equal(f.said.length, 0, mode);
  }
});
test("multikills make one roll, with a shared cooldown and at most one line per round", () => {
  let rolls = 0; const f = fixture(() => { rolls++; return .8; });
  for (const victim of [f.victim, f.world.players[2]]) f.world.kill(victim, { cause: "nuke", source: f.bot });
  assert.equal(rolls, 1); assert.equal(f.chat.pending, null);
  const g = fixture(); g.world.kill(g.victim, { cause: "nuke", source: g.bot }); g.advance(700);
  g.world.kill(g.world.players[2], { cause: "phaser", source: g.bot }); g.advance(700);
  assert.equal(g.said.length, 1); g.world.startRound(); g.world.phase = "fight";
  g.world.kill(g.world.players[0], { cause: "nuke", source: g.world.players[1] }); g.advance(700);
  assert.equal(g.said.length, 1, "round changes do not bypass the cooldown");
});
test("dead, captured, replaced or stale speakers cannot fire a queued reaction", () => {
  for (const change of [f => f.world.kill(f.bot), f => f.bot.capturedBy = 2,
    f => f.world.replacePlayer(1, false), f => f.world.occupants[1]++,
    f => f.world.startRound(), f => f.bot.knockdown = 1, f => f.bot.freeze = 1]) {
    const f = fixture(); f.world.kill(f.victim, { cause: "phaser", source: f.bot }); change(f); f.advance(1500);
    assert.equal(f.said.length, 0);
  }
  const f = fixture(); f.world.kill(f.victim, { cause: "phaser", source: f.bot }); f.advance(5000);
  assert.equal(f.said.length, 0, "no stale reaction after tab suspension");
});
test("all lines are unique and short; used lines and nearby phrase families stay retired", () => {
  assert.equal(new Set(BOT_CHAT_LINES).size, BOT_CHAT_LINES.length);
  assert.ok(BOT_CHAT_LINES.every(text => text.length <= 24 && text.split(" ").length <= 4));
  const f = fixture(), causes = ["singularity", "nuke", "phaser", "saw", "ice", "plasma"];
  for (let n = 0; n < 350; n++) {
    f.advance(76000); f.world.round++; f.victim.alive = true;
    f.world.kill(f.victim, { cause: causes[n % causes.length], source: f.bot }); f.advance(700);
  }
  const lines = f.said.map(m => m.text);
  assert.equal(lines.length, BOT_CHAT_LINES.length); assert.equal(new Set(lines).size, lines.length);
  const firstFamilies = lines.slice(0, 6).map(text => BOT_CHAT_GROUPS.find(g => g.lines.includes(text)).family);
  assert.equal(new Set(firstFamilies).size, 6);
  assert.equal(f.chat.pending, null, "exhaustion does not start the pool over");
});
test("history survives reloads and unavailable storage still prevents session repeats", () => {
  const storage = memory(), f = fixture(() => 0, storage);
  f.world.kill(f.victim, { cause: "phaser", source: f.bot }); f.advance(700);
  const g = fixture(() => 0, storage);
  g.world.kill(g.victim, { cause: "phaser", source: g.bot }); g.advance(700);
  assert.notEqual(g.said[0].text, f.said[0].text); assert.ok(g.chat.used.has("lol"));
  const blocked = fixture(() => 0, { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } });
  blocked.world.kill(blocked.victim, { cause: "phaser", source: blocked.bot }); blocked.advance(700);
  assert.ok(blocked.chat.used.has("lol"));
});
for (const [cause, factory] of [["singularity", blackholeField], ["nuke", nuclearField]]) {
  test(`real ${cause} fields preserve the killer and create just one reaction`, async () => {
    const f = fixture(); f.bot.x = 2400; f.bot.rig = makeRig(f.bot);
    f.world.players[2].x = 2450; f.world.players[2].rig = makeRig(f.world.players[2]);
    const field = factory(f.world, { owner: f.bot.id, x: f.victim.x, y: f.victim.y });
    f.world.fields.push(field);
    for (let i = 0; i < 650 && f.victim.alive; i++) updateFields(f.world, STEP);
    assert.equal(f.victim.alive, false); assert.equal(f.chat.pending?.cause, cause);
    f.advance(700); assert.equal(f.said.length, 1); assert.equal(f.said[0].id, f.bot.id);
    const state = await decodeState(await encodeState(f.world.snapshot()));
    assert.ok(validSnapshot(state)); assert.equal(state.onKill, undefined);
  });
}
test("fired projectiles preserve occupant credit; replacing a slot cannot inherit its kills", () => {
  const f = fixture(); f.bot.weapon = "railgun"; f.bot.ammo = 1;
  f.world.attack(f.bot); const shot = f.world.projectiles[0];
  assert.deepEqual(killCredit(f.world, shot), { id: 1, occupant: 0 });
  f.world.replacePlayer(1, false); f.world.replacePlayer(1, true);
  f.world.kill(f.victim, { cause: "railgun", source: shot }); f.advance(700); assert.equal(f.said.length, 0);
  shot.owner = 2; trackKillSource(f.world, shot, null, true);
  assert.equal(killCredit(f.world, shot).id, 2, "reflection moves credit to the parrying fighter");
});
test("real railgun and phase-cannon kills use source ownership, not the surviving leader", () => {
  for (const weapon of ["railgun", "phaser"]) {
    const f = fixture(); Object.assign(f.bot, { x: 500, y: 535, aimAngle: 0, weapon, ammo: 1 });
    Object.assign(f.victim, { x: 750, y: 535, hp: 1 });
    f.bot.rig = makeRig(f.bot); f.victim.rig = makeRig(f.victim); f.world.players[2].x = 2300;
    f.world.attack(f.bot);
    for (let i = 0; i < 80 && f.victim.alive; i++) f.world.updateProjectiles(STEP);
    assert.equal(f.victim.alive, false, weapon); f.advance(700);
    assert.equal(f.said[0]?.id, 1, weapon);
  }
});
