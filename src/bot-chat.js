import { killCredit } from "./kill-credit.js";

// Deliberately short, authored reactions. Families keep near-synonyms apart.
// A line is retired once spoken; exhaustion is silent, never a reshuffle.
export const BOT_CHAT_GROUPS = [
  { family: "laugh", lines: ["lol", "lmao", "hehe"] },
  { family: "okay", lines: ["ok then", "alright", "fair enough"] },
  { family: "oops", lines: ["oops", "my bad", "sorry about that"] },
  { family: "leave", lines: ["bye", "see ya", "off you go"] },
  { family: "done", lines: ["sorted", "that's that", "that'll do"] },
  { family: "surprise", lines: ["oh", "wait what", "well then"] },
  { family: "rough", lines: ["unlucky", "rough", "oof"] },
  { family: "worked", lines: ["that worked", "i'll take it", "there it is"] },
  { family: "unsure", lines: ["uh", "huh", "apparently"] },
  { family: "extra", lines: ["bit much", "overdid it", "oh dear"] },
  { family: "quick", lines: ["that was quick", "already?", "oh it's over"] },
  { family: "approve", lines: ["nice", "yep", "gg"] },
  { family: "hole", causes: ["singularity"], lines: ["yoink", "in you go", "tiny now", "all fits", "bit small", "round you go"] },
  { family: "gone", causes: ["singularity", "phaser", "nuke"], lines: ["gone", "where'd you go", "nothing left", "not there now", "all gone", "lost ya"] },
  { family: "blast", causes: ["nuke", "blast"], lines: ["bit loud", "too close", "there it went", "that reached", "did that hit", "little too much"] },
  { family: "beam", causes: ["phaser", "plasma", "tesla"], lines: ["lights out", "bit bright", "fried", "one less", "went through", "didn't last"] },
  { family: "cut", causes: ["saw", "railgun", "ice"], lines: ["clean", "straight through", "in bits", "that connected", "quick one", "barely touched it"] },
];
export const BOT_CHAT_LINES = BOT_CHAT_GROUPS.flatMap(group => group.lines);
const allowed = new Set(BOT_CHAT_LINES);
const spectacular = new Set(["singularity", "nuke", "phaser", "plasma", "tesla", "saw", "railgun", "ice", "blast"]);
const storageKey = "bonk-bot-chat-used";

export class BotChat {
  constructor({ random = Math.random, clock = () => performance.now(), storage } = {}) {
    this.random = random; this.clock = clock; this.used = new Set();
    this.recentFamilies = []; this.nextAt = 0; this.pending = null;
    try {
      this.storage = storage ?? globalThis.localStorage;
      const saved = JSON.parse(this.storage?.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) for (const text of saved.slice(0, BOT_CHAT_LINES.length))
        if (allowed.has(text)) this.used.add(text);
    } catch { /* The in-memory history still works when storage is unavailable. */ }
    this.recentFamilies = [...this.used].slice(-5).map(text => BOT_CHAT_GROUPS.find(group => group.lines.includes(text)).family);
  }
  attach(world) {
    this.pending = null; this.world = world; this.spokenRound = null;
    world.onKill = event => this.consider(world, event);
  }
  consider(world, { victim, source, cause }) {
    const now = this.clock(), credit = killCredit(world, source);
    if (world !== this.world || world.phase !== "fight" || !spectacular.has(cause) ||
      this.pending || now < this.nextAt || this.spokenRound === world.round || !credit) return;
    const bot = world.players.find(p => p.id === credit.id);
    if (!bot?.bot || !bot.alive || bot.id === victim.id || world.occupants[bot.id] !== credit.occupant) return;
    // One roll per spectacle, including blasts which eliminate several players.
    this.nextAt = now + 8000;
    const chance = ["singularity", "nuke", "phaser"].includes(cause) ? .4 : .25;
    if (this.random() >= chance) return;
    this.pending = { ...credit, fighter: bot, round: world.round, cause, at: now + 700 + this.random() * 700 };
  }
  update(world, publish) {
    const pending = this.pending, now = this.clock();
    if (!pending || world !== this.world) return;
    const bot = world.players.find(p => p.id === pending.id);
    if (world.round !== pending.round || world.occupants[pending.id] !== pending.occupant || bot !== pending.fighter || !bot?.bot || !bot.alive) {
      this.pending = null; return;
    }
    if (now < pending.at) return;
    this.pending = null;
    if (now > pending.at + 2500 || bot.capturedBy || bot.knockdown > 0 || bot.freeze > 0) return;
    let groups = BOT_CHAT_GROUPS.filter(group => (!group.causes || group.causes.includes(pending.cause)) && group.lines.some(text => !this.used.has(text)));
    const fresh = groups.filter(group => !this.recentFamilies.includes(group.family));
    if (fresh.length) groups = fresh;
    if (!groups.length) return;
    const group = groups[Math.min(groups.length - 1, Math.floor(this.random() * groups.length))];
    const lines = group.lines.filter(text => !this.used.has(text));
    const text = lines[Math.min(lines.length - 1, Math.floor(this.random() * lines.length))];
    if (!publish(bot.id, text)) return;
    this.used.add(text);
    this.recentFamilies = [...this.recentFamilies, group.family].slice(-5);
    this.spokenRound = world.round; this.nextAt = now + 45000 + this.random() * 30000;
    try { this.storage?.setItem(storageKey, JSON.stringify([...this.used])); } catch { /* Keep the session history. */ }
  }
}
