import { COVER_KINDS } from "./maps.js";
import { HAZARD_TYPES } from "./hazards.js";
import PeerModule from "peerjs";
const Peer = PeerModule.Peer ?? PeerModule;
import { cleanInput, ARENAS, WEAPONS } from "./engine.js";
export const validCode = (value) =>
  typeof value === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
const PREFIX = "bonkclub-v6-";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (v) => alphabet[v % alphabet.length],
  ).join("");
}
export class Room {
  constructor(callbacks = {}, PeerClass = Peer) {
    this.callbacks = callbacks;
    this.PeerClass = PeerClass;
    this.peer = null;
    this.connections = new Map();
    this.pending = new Set();
    this.timers = new Set();
    this.host = false;
    this.id = null;
    this.code = "";
    this.roster = [];
    this.running = false;
    this.closed = false;
    this.inputTimes = {};
    this.lastInputs = {};
  }
  emit(name, ...args) {
    this.callbacks[name]?.(...args);
  }
  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.closed) fn();
    }, ms);
    this.timers.add(t);
    return t;
  }
  clear(t) {
    clearTimeout(t);
    this.timers.delete(t);
  }
  send(c, data) {
    if (c?.open)
      try {
        c.send(data);
      } catch {
        this.emit("onNotice", "Connection interrupted.");
      }
  }
  broadcast(data) {
    for (const c of this.connections.values()) this.send(c, data);
  }
  async openPeer(id) {
    return new Promise((resolve, reject) => {
      const p = (this.peer = new this.PeerClass(id, { debug: 0 }));
      let settled = false;
      const t = this.later(() => {
        settled = true;
        reject(
          new Error("The room service did not respond. Try again in a moment."),
        );
      }, 12000);
      p.on("open", () => {
        if (settled || this.closed) return;
        settled = true;
        this.clear(t);
        resolve(p);
      });
      p.on("error", (e) => {
        const map = {
          "peer-unavailable":
            "That room could not be found. Check the code and ask the host to keep the room open.",
          "unavailable-id":
            "That room code is taken. Please create another room.",
          network:
            "Could not reach the room service. Check your connection and try again.",
          webrtc:
            "These browsers could not connect directly. Try another network.",
          "browser-incompatible":
            "This browser cannot use online rooms. Try a current Chrome, Edge, Firefox or Safari.",
        };
        const message =
          map[e.type] || "The online connection failed. Please try again.";
        if (!settled) {
          settled = true;
          this.clear(t);
          reject(Object.assign(new Error(message), { type: e.type }));
        } else if (this.joinReject) {
          this.joinReject(Object.assign(new Error(message), { type: e.type }));
          this.joinReject = null;
        } else if (this.host && e.type === "peer-unavailable") {
          this.emit(
            "onNotice",
            "A joining player could not connect. Your room is still open.",
          );
        } else this.emit("onError", message);
      });
      p.on("disconnected", () => {
        if (!this.closed)
          this.emit(
            "onNotice",
            "Room service disconnected. Existing players can keep playing; reopen the room to add friends.",
          );
      });
    });
  }
  async create(code = makeCode()) {
    if (!validCode(code)) throw new Error("Invalid room code.");
    this.host = true;
    this.id = 0;
    this.code = code;
    this.roster = [{ id: 0 }];
    await this.openPeer(PREFIX + this.code);
    this.peer.on("connection", (c) => this.accept(c));
    this.running = true;
    this.emit("onRoster", this.roster);
    this.emit("onStart");
    return this.code;
  }
  accept(c) {
    if (this.closed) return c.close();
    this.pending.add(c);
    const t = this.later(() => {
      this.pending.delete(c);
      c.close();
    }, 12000);
    let id = null;
    c.on("open", () => {
      this.clear(t);
      this.pending.delete(c);
      if (this.closed) return c.close();
      if (this.connections.size >= 3) {
        this.send(c, {
          t: "reject",
          code: "room-full",
          reason: "This room is full (4 players).",
        });
        this.later(() => c.close(), 300);
        return;
      }
      id = [1, 2, 3].find((n) => !this.connections.has(n));
      this.connections.set(id, c);
      this.roster.push({ id });
      this.send(c, { t: "welcome", id, code: this.code });
      this.publishRoster();
      if (this.latestState)
        this.send(c, { t: "state", state: this.latestState });
    });
    c.on("data", (m) => {
      if (
        id === null ||
        this.connections.get(id) !== c ||
        !m ||
        typeof m !== "object"
      )
        return;
      if (m.t === "input") {
        this.lastInputs[id] = cleanInput(m.input);
        this.inputTimes[id] = performance.now();
      }
      if (m.t === "ping" && typeof m.time === "number")
        this.send(c, { t: "pong", time: m.time });
    });
    c.on("close", () => {
      this.clear(t);
      this.pending.delete(c);
      if (id === null || this.closed || this.connections.get(id) !== c) return;
      this.connections.delete(id);
      delete this.lastInputs[id];
      delete this.inputTimes[id];
      this.roster = this.roster.filter((p) => p.id !== id);
      this.publishRoster();
    });
    c.on("error", () => c.close());
  }
  async join(code) {
    if (!validCode(code)) throw new Error("Enter the six-character room code.");
    this.code = code;
    await this.openPeer(PREFIX + "guest-" + crypto.randomUUID());
    return new Promise((resolve, reject) => {
      this.joinReject = reject;
      let welcomed = false;
      const c = (this.connection = this.peer.connect(PREFIX + code, {
        reliable: true,
        // Combat snapshots exceed PeerJS JSON's 16 KB limit. Binary mode chunks them.
        serialization: "binary",
      }));
      const t = this.later(() => {
        reject(
          new Error(
            "Could not reach this room. Ask the host to check the code. Some networks need a relay server.",
          ),
        );
        c.close();
      }, 15000);
      c.on("data", (m) => {
        if (!m || typeof m !== "object") return;
        if (
          !welcomed &&
          m.t === "welcome" &&
          Number.isInteger(m.id) &&
          m.id > 0 &&
          m.id < 4
        ) {
          welcomed = true;
          this.joinReject = null;
          this.clear(t);
          this.id = m.id;
          this.running = true;
          this.emit("onStart");
          resolve();
        }
        if (m.t === "reject") {
          this.clear(t);
          this.joinReject = null;
          reject(
            Object.assign(new Error(String(m.reason).slice(0, 180)), {
              type: m.code,
            }),
          );
        }
        if (!welcomed) return;
        if (
          m.t === "roster" &&
          Array.isArray(m.players) &&
          m.players.length <= 4
        ) {
          this.roster = m.players
            .filter((p) => Number.isInteger(p.id) && p.id >= 0 && p.id < 4)
            .map((p) => ({ id: p.id }));
          this.emit("onRoster", this.roster);
        }
        if (m.t === "state" && this.running && validSnapshot(m.state))
          this.emit("onState", m.state);
        if (m.t === "pong")
          this.emit("onPing", Math.round(performance.now() - m.time));
      });
      c.on("close", () => {
        this.clear(t);
        if (!welcomed)
          reject(new Error("The room connection closed. Try joining again."));
        else if (!this.closed)
          this.emit(
            "onError",
            "The host left the room. Create or join a new room to keep playing.",
          );
      });
      c.on("error", () => {
        this.clear(t);
        reject(
          new Error("Could not connect to this room. Try a different network."),
        );
        if (welcomed && !this.closed)
          this.emit("onError", "The connection to the host failed.");
      });
    });
  }
  publishRoster() {
    this.roster.sort((a, b) => a.id - b.id);
    this.broadcast({ t: "roster", players: this.roster });
    this.emit("onRoster", this.roster);
  }
  sendInput(input) {
    this.send(this.connection, { t: "input", input: cleanInput(input) });
  }
  getInputs(now = performance.now()) {
    const out = {};
    for (const id in this.lastInputs)
      out[id] =
        now - (this.inputTimes[id] || 0) < 700
          ? this.lastInputs[id]
          : cleanInput(null);
    return out;
  }
  sendState(state) {
    if (this.host && this.running) {
      this.latestState = state;
      this.broadcast({ t: "state", state });
    }
  }
  ping() {
    this.send(this.connection, { t: "ping", time: performance.now() });
  }
  close() {
    this.closed = true;
    this.joinReject?.(new Error("Connection cancelled."));
    this.joinReject = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const c of this.pending) c.close();
    this.pending.clear();
    for (const c of this.connections.values()) c.close();
    this.connections.clear();
    this.connection?.close();
    this.peer?.destroy();
  }
}
const finite = (n) =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 10000000;
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const weaponTypes = Object.keys(WEAPONS);
const list = (value, max, check) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((v) => v && typeof v === "object" && check(v));
const xy = (p) => finite(p.x) && finite(p.y);
export function validSnapshot(s) {
  return (
    !!s &&
    typeof s === "object" &&
    ["countdown", "fight", "result"].includes(s.phase) &&
    integer(s.arenaIndex, 0, ARENAS.length - 1) &&
    integer(s.round, 1, Number.MAX_SAFE_INTEGER) &&
    [s.phaseTime, s.elapsed, s.time].every(finite) &&
    (s.winner === null || integer(s.winner, 0, 3)) &&
    list(
      s.players,
      4,
      (p) =>
        integer(p.id, 0, 3) &&
        typeof p.bot === "boolean" &&
        integer(p.occupant, 0, Number.MAX_SAFE_INTEGER) &&
        xy(p) &&
        [
          p.vx,
          p.vy,
          p.hp,
          p.walk,
          p.swing,
          p.blockTime,
          p.stamina,
          p.flash,
        ].every(finite) &&
        (p.rig === null || (list(p.rig, 11, xy) && p.rig.length === 11)) &&
        integer(p.ammo, 0, 100) &&
        p.hp >= 0 &&
        p.hp <= 100 &&
        (p.facing === 1 || p.facing === -1) &&
        typeof p.alive === "boolean" &&
        (p.weapon === null || weaponTypes.includes(p.weapon)),
    ) &&
    s.players.length >= 2 &&
    new Set(s.players.map((p) => p.id)).size === s.players.length &&
    list(
      s.platforms,
      72,
      (p) =>
        xy(p) &&
        [p.w, p.h, p.baseX, p.baseY, p.dx, p.dy].every(finite) &&
        p.w > 0 &&
        p.w < 3000 &&
        p.h > 0 &&
        p.h < 1000,
    ) &&
    list(
      s.cover,
      64,
      (c) =>
        xy(c) &&
        [c.w, c.h, c.hp, c.maxHp].every(finite) &&
        c.w > 0 &&
        c.h > 0 &&
        c.hp >= 0 &&
        c.hp <= c.maxHp &&
        COVER_KINDS.includes(c.kind),
    ) &&
    list(
      s.hazards,
      3,
      (h) =>
        integer(h.id, 1, 1000000) &&
        HAZARD_TYPES.includes(h.type) &&
        [h.x, h.y, h.w, h.h, h.warning, h.age, h.duration, h.bodyY, h.vy].every(
          finite,
        ) &&
        h.w > 0 &&
        h.w <= 300 &&
        h.h > 0 &&
        h.h <= 300 &&
        h.warning >= 0 &&
        h.warning <= 2 &&
        h.age >= 0 &&
        h.duration > 0 &&
        h.duration <= 6 &&
        (h.dir === 1 || h.dir === -1) &&
        typeof h.done === "boolean" &&
        Array.isArray(h.hitIds) &&
        h.hitIds.length <= 4 &&
        h.hitIds.every((id) => integer(id, 0, 3)),
    ) &&
    list(
      s.debris,
      90,
      (d) => xy(d) && [d.w, d.h, d.angle, d.life].every(finite),
    ) &&
    list(
      s.projectiles,
      100,
      (p) =>
        xy(p) &&
        [p.vx, p.vy, p.r, p.life].every(finite) &&
        ["bullet", "pellet", "rocket", "grenade", "rail", "plasma"].includes(
          p.kind,
        ),
    ) &&
    list(
      s.drops,
      20,
      (d) => xy(d) && finite(d.life) && weaponTypes.includes(d.type),
    ) &&
    list(
      s.ragdolls,
      4,
      (r) =>
        finite(r.life) &&
        typeof r.color === "string" &&
        /^#[a-fA-F0-9]{6}$/.test(r.color) &&
        list(r.points, 11, xy) &&
        r.points.length === 11,
    ) &&
    Array.isArray(s.scores) &&
    s.scores.length === 4 &&
    s.scores.every((n) => integer(n, 0, Number.MAX_SAFE_INTEGER)) &&
    list(
      s.events,
      35,
      (e) =>
        integer(e.id, 0, 10000000) &&
        [
          "hazard",
          "fight",
          "round",
          "jump",
          "swing",
          "hit",
          "ko",
          "parry",
          "block",
          "shoot",
          "explosion",
          "pickup",
          "throw",
          "coverhit",
          "break",
        ].includes(e.type) &&
        (e.x === undefined || xy(e)) &&
        (e.color === undefined ||
          (typeof e.color === "string" && /^#[a-fA-F0-9]{6}$/.test(e.color))),
    )
  );
}
